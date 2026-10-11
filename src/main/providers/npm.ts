import { join } from 'node:path'
import type { AppInfo, Provider } from '../../shared/types'
import { commandAvailable, openConsole, readPkgMeta, run, runAllowFail } from './util'

interface NpmLsJson {
  dependencies?: Record<string, { version?: string }>
}

async function list(): Promise<AppInfo[]> {
  const [lsOut, rootOut] = await Promise.all([
    run('npm', ['ls', '-g', '--depth=0', '--json'], { shim: true }),
    run('npm', ['root', '-g'], { shim: true })
  ])
  const data = (JSON.parse(lsOut || '{}') as NpmLsJson).dependencies ?? {}
  const root = rootOut.trim()
  const apps: AppInfo[] = []
  for (const [name, info] of Object.entries(data)) {
    const dir = join(root, name)
    const meta = await readPkgMeta(dir, name)
    apps.push({
      id: `npm:${name}`,
      provider: 'npm',
      name,
      version: info.version ?? meta.version ?? '',
      description: meta.description,
      homepage: meta.homepage,
      bin: meta.bins,
      path: dir,
      runnable: meta.bins.length > 0,
      uninstallable: true
    })
  }
  return apps
}

export const npmProvider: Provider = {
  id: 'npm',
  isAvailable: () => commandAvailable('npm', true),
  list,
  async checkOutdated() {
    const out = await runAllowFail('npm', ['outdated', '-g', '--json'], { shim: true })
    const data = JSON.parse(out || '{}') as Record<string, { latest?: string }>
    const map: Record<string, string> = {}
    for (const [name, info] of Object.entries(data)) {
      if (info.latest) map[name] = info.latest
    }
    return map
  },
  async launch(app) {
    openConsole(app.bin?.[0] ?? app.name)
  },
  async uninstall(app) {
    await run('npm', ['uninstall', '-g', app.name], { shim: true })
  },
  async update(app) {
    await run('npm', ['install', '-g', `${app.name}@latest`], { shim: true })
  }
}
