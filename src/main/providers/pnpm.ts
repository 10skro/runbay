import type { AppInfo, Provider } from '../../shared/types'
import { commandAvailable, openConsole, readPkgMeta, run, runAllowFail } from './util'

interface PnpmDep {
  name: string
  version?: string
  dependencyPath?: string
}

/** `pnpm ls -g --json` renvoie un tableau d'entrées racines, chacune avec `dependencies`. */
function parseDeps(raw: unknown): PnpmDep[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => (entry?.dependencies ?? []) as PnpmDep[])
  }
  if (raw && typeof raw === 'object') {
    const deps = (raw as { dependencies?: Record<string, PnpmDep> }).dependencies
    return deps ? (Object.values(deps) as PnpmDep[]) : []
  }
  return []
}

async function list(): Promise<AppInfo[]> {
  const out = await run('pnpm', ['ls', '-g', '--depth=0', '--json'], { shim: true })
  const deps = parseDeps(JSON.parse(out || '[]'))
  const apps: AppInfo[] = []
  for (const dep of deps) {
    const meta = await readPkgMeta(dep.dependencyPath, dep.name)
    apps.push({
      id: `pnpm:${dep.name}`,
      provider: 'pnpm',
      name: dep.name,
      version: dep.version ?? meta.version ?? '',
      description: meta.description,
      homepage: meta.homepage,
      bin: meta.bins,
      path: dep.dependencyPath,
      runnable: meta.bins.length > 0,
      uninstallable: true
    })
  }
  return apps
}

export const pnpmProvider: Provider = {
  id: 'pnpm',
  isAvailable: () => commandAvailable('pnpm', true),
  list,
  async checkOutdated() {
    const out = await runAllowFail('pnpm', ['outdated', '-g', '--json'], { shim: true })
    const parsed = JSON.parse(out || '[]')
    const entries: Array<{ name?: string; latest?: string }> = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed as Record<string, { name?: string; latest?: string }>)
    const map: Record<string, string> = {}
    for (const entry of entries) {
      if (entry.name && entry.latest) map[entry.name] = entry.latest
    }
    return map
  },
  async launch(app) {
    openConsole(app.bin?.[0] ?? app.name)
  },
  async uninstall(app) {
    await run('pnpm', ['remove', '-g', app.name], { shim: true })
  },
  async update(app) {
    await run('pnpm', ['add', '-g', `${app.name}@latest`], { shim: true })
  }
}
