import { app } from 'electron'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

/** Racine globale npm, ou null si npm est injoignable. */
async function globalRoot(): Promise<string | null> {
  try {
    return (await run('npm', ['root', '-g'], { shim: true, timeout: 30_000 })).trim()
  } catch {
    return null
  }
}

/** RunBay est-il installé dans la racine globale npm ? Seul ce cas sait se réinstaller seul. */
async function installedGlobally(): Promise<boolean> {
  const root = await globalRoot()
  return !!root && app.getAppPath().toLowerCase().startsWith(root.toLowerCase())
}

function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
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
}

/**
 * Applique la mise à jour. L'app ne peut pas se réinstaller elle-même pendant
 * qu'elle tourne : Windows verrouille ses propres fichiers (EBUSY sur le
 * electron.exe en cours). On délègue donc à un script détaché : il attend la
 * fermeture de l'app, installe (seconde tentative si le registre n'a pas
 * encore propagé la version), puis relance RunBay. La sortie npm est écrite
 * dans update.log (dossier de données de l'app) pour le diagnostic.
 * Hors installation globale (dev, npx), on renvoie la commande manuelle.
 */
export async function applySelfUpdate(): Promise<ApplyResult> {
  if (!available) return { state: 'error', message: 'No update pending' }
  const target = available.latest
  const registryFlag = REGISTRY === 'https://registry.npmjs.org' ? '' : ` --registry "${REGISTRY}"`
  if (SIM_CMD) {
    try {
      await runCommand(SIM_CMD)
    } catch (err) {
      return { state: 'error', message: err instanceof Error ? err.message : String(err) }
    }
    available = null
    return { state: 'done', message: `Updated to ${target} — restart to apply` }
  }
  if (!(await installedGlobally())) {
    return { state: 'manual', message: `npm install -g ${PKG}@latest` }
  }
  const root = (await globalRoot()) as string
  const shim = join(dirname(root), `${PKG}.cmd`) // le lanceur posé par npm dans le PATH
  const script = join(app.getPath('userData'), 'update.cmd')
  const log = join(app.getPath('userData'), 'update.log')
  const install = `call npm install -g ${PKG}@latest${registryFlag}`
  const body = [
    '@echo off',
    'ping -n 5 127.0.0.1 >nul', // le temps que l'app se ferme et relâche ses fichiers
    `${install} > "${log}" 2>&1`,
    'if errorlevel 1 (',
    '  ping -n 31 127.0.0.1 >nul', // le registre met parfois une minute à propager une publication prouvée
    `${install} --prefer-online >> "${log}" 2>&1`,
    ')',
    `start "" "${shim}"`,
    'del "%~f0"',
    ''
  ].join('\r\n')
  try {
    writeFileSync(script, body)
    spawn(script, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } catch (err) {
    return { state: 'error', message: err instanceof Error ? err.message : String(err) }
  }
  available = null
  // Le temps que le toast s'affiche, puis on se ferme : le script prend le relais.
  setTimeout(() => app.quit(), 1500)
  return { state: 'done', message: `Updating to ${target} — restarting…` }
}
