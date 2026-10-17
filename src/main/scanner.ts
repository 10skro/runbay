import { app as electronApp } from 'electron'
import type { AppsBatch, AppInfo, Provider, ProviderStatus } from '../shared/types'
import { providers } from './providers'
import { settings } from './settings'

/** Applique les versions volontairement ignorées : plus de badge ni d'action Update.
 *  L'info reste visible (resta possible via le menu contextuel de la ligne) ;
 *  si une version ENCORE plus récente sort, la mise à jour réapparaît d'elle-même.
 *  Exporté : réappliqué après restauration du cache de démarrage (settings.ignored
 *  reste autoritaire, le fichier de cache n'est qu'un état provisoire). */
export function applyIgnored(apps: AppInfo[]): void {
  for (const app of apps) {
    const ignored = settings.ignored[app.id]
    if (ignored && app.latestVersion === ignored) {
      app.ignoredVersion = ignored
      app.latestVersion = undefined
    }
  }
}

/**
 * Liste les apps d'un provider. `onBatch` est appelé dès que la liste locale est
 * connue (affichage immédiat), puis la fonction retourne la liste enrichie des
 * mises à jour — la vérification interroge le registre et est souvent plus lente.
 */
export async function listProvider(
  provider: Provider,
  onBatch?: (apps: AppInfo[]) => void
): Promise<AppInfo[]> {
  const outdatedPromise: Promise<Record<string, string>> = provider.checkOutdated
    ? provider.checkOutdated().catch(() => ({}))
    : Promise.resolve({})

  // RunBay ne se gère pas elle-même dans la liste : se réinstaller pendant
  // qu'on tourne est impossible sur Windows (fichiers verrouillés, EBUSY).
  // Sa propre mise à jour passe par le menu Options, avec le flux sûr
  // « fermer → installer → relancer ».
  const self = electronApp.getAppPath().toLowerCase()
  const apps = (await provider.list()).filter((a) => a.path?.toLowerCase() !== self)
  applyIgnored(apps)
  onBatch?.(apps)

  const outdated = await outdatedPromise
  for (const app of apps) {
    const latest = outdated[app.name]
    if (latest && latest !== app.version) app.latestVersion = latest
  }
  applyIgnored(apps)
  return apps
}

export async function scanAll(
  onBatch: (batch: AppsBatch) => void,
  onStatus: (status: ProviderStatus) => void
): Promise<void> {
  await Promise.allSettled(
    providers.map(async (provider) => {
      onStatus({ id: provider.id, state: 'scanning', count: 0 })
      try {
        if (!(await provider.isAvailable())) {
          // Provider devenu absent depuis le dernier scan : lot vide aussi,
          // pour que ses apps cachées sortent de la liste (comme à froid).
          onStatus({ id: provider.id, state: 'absent', count: 0 })
          onBatch({ provider: provider.id, apps: [] })
          return
        }
        // Premier lot + compteur dès que la liste locale est connue ;
        // un second lot enrichi (badges de mise à jour) suit la vérification registre.
        // Le statut précède le lot : la persistance du cache (ipc) se déclenche
        // sur le lot et doit trouver un statut déjà « ok » à enregistrer.
        const apps = await listProvider(provider, (partial) => {
          onStatus({ id: provider.id, state: 'ok', count: partial.length })
          onBatch({ provider: provider.id, apps: partial })
        })
        // Second lot uniquement si la vérification a apporté quelque chose (badges, ignorées).
        if (apps.some((a) => a.latestVersion || a.ignoredVersion)) {
          onBatch({ provider: provider.id, apps })
        }
      } catch (err) {
        onStatus({
          id: provider.id,
          state: 'error',
          count: 0,
          error: err instanceof Error ? err.message : String(err)
        })
        // Échec de liste : rien de confirmé, le comportement à froid (pas de
        // liste pour ce provider) l'emporte sur le cache.
        onBatch({ provider: provider.id, apps: [] })
      }
    })
  )
}
