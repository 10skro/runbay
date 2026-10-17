import type {
  AppInfo,
  AppsBatch,
  CacheSnapshot,
  CachedProvider,
  ProviderId,
  ProviderState,
  ProviderStatus
} from '../shared/types'

/** Miroir main process des apps connues (clé = AppInfo.id). */
const apps = new Map<string, AppInfo>()
/** Dernier statut connu par provider : alimenté par le scan, lu par le cache de démarrage. */
const statuses = new Map<ProviderId, ProviderStatus>()

/** États « finaux » : seuls ceux-là méritent d'être persistés ou renvoyés au renderer. */
const PERSISTABLE: ProviderState[] = ['ok', 'absent', 'error']

export const store = {
  replaceAllFor(provider: ProviderId, list: AppInfo[]): void {
    for (const [id, app] of apps) if (app.provider === provider) apps.delete(id)
    for (const app of list) apps.set(app.id, app)
  },
  setStatus(status: ProviderStatus): void {
    statuses.set(status.id, status)
  },
  remove(id: string): void {
    apps.delete(id)
  },
  get(id: string): AppInfo | undefined {
    return apps.get(id)
  },
  countUpdatable(): number {
    let n = 0
    for (const app of apps.values()) if (app.latestVersion) n += 1
    return n
  },
  /** Instantané pour le cache disque (cacheVersion est posé par cache.ts). */
  snapshot(): Omit<CacheSnapshot, 'cacheVersion'> {
    const providers: Partial<Record<ProviderId, CachedProvider>> = {}
    for (const status of statuses.values())
      if (PERSISTABLE.includes(status.state)) providers[status.id] = { status, apps: [] }
    for (const app of apps.values()) {
      const entry = (providers[app.provider] ??= {
        status: { id: app.provider, state: 'ok', count: 0 },
        apps: []
      })
      entry.apps.push(app)
    }
    return { savedAt: Date.now(), providers }
  },
  /** Restaurer un instantané validé : le store démarre avec le dernier état connu. */
  restore(snapshot: CacheSnapshot): void {
    apps.clear()
    statuses.clear()
    for (const entry of Object.values(snapshot.providers)) {
      if (!entry) continue
      statuses.set(entry.status.id, entry.status)
      for (const app of entry.apps) apps.set(app.id, app)
    }
  },
  /** Apps connues groupées par provider : premier état envoyé au renderer. */
  groups(): AppsBatch[] {
    const byProvider = new Map<ProviderId, AppInfo[]>()
    for (const app of apps.values()) {
      const list = byProvider.get(app.provider) ?? []
      list.push(app)
      byProvider.set(app.provider, list)
    }
    return [...byProvider].map(([provider, list]) => ({ provider, apps: list }))
  },
  /** Derniers statuts « finaux » connus (ok/absent/error), pour le renderer. */
  knownStatuses(): ProviderStatus[] {
    return [...statuses.values()].filter((s) => PERSISTABLE.includes(s.state))
  }
}
