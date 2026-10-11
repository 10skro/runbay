import { app } from 'electron'
import { spawn } from 'node:child_process'
import { run } from './providers/util'

/**
 * Mise à jour de RunBay lui-même. L'app étant distribuée par npm, le registre
 * npm est la source de vérité pour la dernière version, et se mettre à jour
 * signifie réinstaller le paquet.
 *
 * RUNBAY_REGISTRY / RUNBAY_SELFUPDATE_CMD (variables d'environnement) permettent
 * de simuler tout le parcours en local avant la publication du paquet :
 * registre factice, commande d'installation factice, pas de redémarrage réel.
 */
const REGISTRY = process.env.RUNBAY_REGISTRY ?? 'https://registry.npmjs.org'
const PKG = 'runbay'
const SIM_CMD = process.env.RUNBAY_SELFUPDATE_CMD
// En mode simulation, pas de redémarrage automatique : en dev, l'app redémarrée
// hors du watcher perdrait le serveur de dev (fenêtre blanche).
const SIMULATED = !!SIM_CMD

export interface SelfUpdate {
  current: string
  latest: string
}

export interface ApplyResult {
  state: 'done' | 'manual' | 'error'
  message?: string
}

let available: SelfUpdate | null = null

export function selfUpdateStatus(): SelfUpdate | null {
  return available
}

/** Comparaison numérique x.y.z : vrai si `latest` est strictement plus récente. */
function isNewer(latest: string, current: string): boolean {
  const parts = (v: string): number[] => v.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0)
  const a = parts(current)
  const b = parts(latest)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

/** Interroge le registre ; échec réseau : on garde le dernier résultat connu. */
export async function checkSelfUpdate(): Promise<SelfUpdate | null> {
  try {
    const res = await fetch(`${REGISTRY}/${PKG}/latest`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return available
    const meta = (await res.json()) as { version?: unknown }
    const latest = typeof meta.version === 'string' ? meta.version : null
    available =
      latest && isNewer(latest, app.getVersion())
        ? { current: app.getVersion(), latest }
        : null
  } catch {
    // Hors ligne, registre injoignable : silencieux, le prochain cycle réessaiera.
  }
  return available
}

/** RunBay est-il installé dans la racine globale npm ? Seul ce cas sait se réinstaller seul. */
async function installedGlobally(): Promise<boolean> {
  try {
    const root = (await run('npm', ['root', '-g'], { shim: true, timeout: 30_000 })).trim()
    return app.getAppPath().toLowerCase().startsWith(root.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Applique la mise à jour : réinstallation via npm, puis redémarrage différé
 * (le temps que le toast « updated » s'affiche). Hors installation globale
 * (dev, npx), on renvoie la commande à exécuter manuellement.
 */
export async function applySelfUpdate(): Promise<ApplyResult> {
  if (!available) return { state: 'error', message: 'No update pending' }
  const target = available.latest
  const registryFlag = REGISTRY === 'https://registry.npmjs.org' ? '' : ` --registry "${REGISTRY}"`
  const command =
    SIM_CMD ?? ((await installedGlobally()) ? `npm install -g ${PKG}@latest${registryFlag}` : null)
  if (!command) {
    // Installé ailleurs qu'en global (dev, npx) : l'app ne peut pas se remplacer elle-même.
    return { state: 'manual', message: `npm install -g ${PKG}@latest` }
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, { shell: true, windowsHide: true })
      const timer = setTimeout(() => {
        child.kill()
        reject(new Error('npm timed out'))
      }, 5 * 60_000)
      child.on('error', reject)
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`npm exited with code ${code}`))
      })
    })
  } catch (err) {
    return { state: 'error', message: err instanceof Error ? err.message : String(err) }
  }
  available = null
  if (SIMULATED) return { state: 'done', message: `Updated to ${target} — restart to apply` }
  setTimeout(() => {
    app.relaunch()
    app.quit()
  }, 1500)
  return { state: 'done', message: `Updated to ${target} — restarting…` }
}
