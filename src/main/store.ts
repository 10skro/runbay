import type { AppInfo, ProviderId } from '../shared/types'

/** Miroir main process des apps connues (clé = AppInfo.id). */
const apps = new Map<string, AppInfo>()

export const store = {
  clear(): void {
    apps.clear()
  },
  replaceAllFor(provider: ProviderId, list: AppInfo[]): void {
    for (const [id, app] of apps) if (app.provider === provider) apps.delete(id)
    for (const app of list) apps.set(app.id, app)
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
  }
}
