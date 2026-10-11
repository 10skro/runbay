import { join } from 'node:path'
import type { AppInfo, Provider } from '../../shared/types'
import { commandAvailable, openConsole, readPkgMeta, run, runAllowFail } from './util'

// Yarn v1 : `yarn global list` → lignes "info ├─ nom@version"
const LINE_RE = /[├└]─\s+(\S+)@(\S+)/g

async function list(): Promise<AppInfo[]> {
  const [out, dirOut] = await Promise.all([
    run('yarn', ['global', 'list'], { shim: true }),
    run('yarn', ['global', 'dir'], { shim: true }).catch(() => '')
  ])
  const globalDir = dirOut.trim()
  const root = globalDir ? join(globalDir, 'node_modules') : ''
  const apps: AppInfo[] = []
  for (const [, name, version] of out.matchAll(LINE_RE)) {
    const dir = root ? join(root, name) : undefined
    const meta = await readPkgMeta(dir, name)
    apps.push({
      id: `yarn:${name}`,
      provider: 'yarn',
      name,
      version,
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

export const yarnProvider: Provider = {
  id: 'yarn',
  isAvailable: async () => {
    if (!(await commandAvailable('yarn', true))) return false
    // Yarn Berry (v2+) n'a plus de commande `global` : on ne supporte que v1 ici.
    try {
      const v = await run('yarn', ['--version'], { shim: true })
      return v.trim().startsWith('1.')
    } catch {
      return false
    }
  },
  list,
  async checkOutdated() {
    // Yarn v1 : `yarn global outdated --json` émet une ligne JSON par paquet périmé.
    const out = await runAllowFail('yarn', ['global', 'outdated', '--json'], { shim: true })
    const map: Record<string, string> = {}
    for (const line of out.split(/\r?\n/)) {
      try {
        const entry = JSON.parse(line) as { name?: string; current?: string; latest?: string }
        if (entry.name && entry.latest && entry.latest !== entry.current) {
          map[entry.name] = entry.latest
        }
      } catch {
        // Les avertissements non-JSON se glissent dans la sortie : on les ignore.
      }
    }
    return map
  },
  async launch(app) {
    openConsole(app.bin?.[0] ?? app.name)
  },
  async uninstall(app) {
    await run('yarn', ['global', 'remove', app.name], { shim: true })
  },
  async update(app) {
    await run('yarn', ['global', 'add', `${app.name}@latest`], { shim: true })
  }
}
