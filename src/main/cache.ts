import { app } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CacheSnapshot, ProviderState } from '../shared/types'
import { applyIgnored } from './scanner'
import { store } from './store'

/**
 * Cache de démarrage — même patron que settings.ts et icons.ts : le dernier
 * état connu du store (apps + statuts des providers) est écrit sur disque au
 * fil de l'eau, provider par provider, puis restauré avant la création de la
 * fenêtre. Le scan complet repart aussitôt en arrière-plan et corrige provider
 * par provider : la liste affichée n'est jamais vide, jamais définitive.
 */

// Numéro de schéma : à incrémenter quand le format change. Un cache
// incompatible est ignoré silencieusement, comme un premier lancement.
const CACHE_VERSION = 1

/** États « finaux » seuls persistés (jamais 'idle' ni 'scanning'). */
const PERSISTABLE: ProviderState[] = ['ok', 'absent', 'error']

function file(): string {
  return join(app.getPath('userData'), 'runbay-cache.json')
}

/** Écrit l'état courant. Non critique : un échec ne doit jamais gêner l'app. */
export function saveCache(): void {
  try {
    const snapshot: CacheSnapshot = { cacheVersion: CACHE_VERSION, ...store.snapshot() }
    const f = file()
    // Écriture atomique : une fermeture brutale ne doit jamais laisser un
    // fichier à moitié écrit (tmp + renommage, comme les caches d'icônes).
    const tmp = `${f}.tmp`
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2))
    renameSync(tmp, f)
  } catch {
    // Disque, droits : le cache est un confort, pas une dépendance.
  }
}

/** Restaure le dernier état connu dans le store. False si rien d'exploitable. */
export function loadCache(): boolean {
  try {
    const f = file()
    if (!existsSync(f)) return false
    const data = JSON.parse(readFileSync(f, 'utf8')) as CacheSnapshot
    if (data.cacheVersion !== CACHE_VERSION || !isWellFormed(data)) return false
    // settings.ignored reste autoritaire : les versions volontairement
    // ignorées sont réappliquées après restauration (le fichier de cache est
    // une entrée non fiable, pas une source de vérité).
    for (const entry of Object.values(data.providers)) if (entry) applyIgnored(entry.apps)
    store.restore(data)
    return true
  } catch {
    // Un fichier corrompu ne doit pas empêcher l'app de démarrer : plein scan.
    return false
  }
}

/** Le cache est une entrée non fiable : tout doute sur la forme ⇒ on l'écarte. */
function isWellFormed(data: CacheSnapshot): boolean {
  if (typeof data.savedAt !== 'number' || typeof data.providers !== 'object' || !data.providers)
    return false
  for (const [id, entry] of Object.entries(data.providers)) {
    if (!entry) continue
    if (entry.status?.id !== id || !PERSISTABLE.includes(entry.status.state)) return false
    if (!Array.isArray(entry.apps)) return false
    for (const app of entry.apps) {
      if (app.provider !== id || app.id !== `${id}:${app.name}`) return false
      if (typeof app.name !== 'string' || typeof app.version !== 'string') return false
    }
  }
  return true
}
