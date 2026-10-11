import { join } from 'node:path'
import type { AppInfo, Provider } from '../../shared/types'
import { commandAvailable, latestFromRegistry, openConsole, readPkgMeta, run } from './util'

// `bun pm ls -g` → en-tête avec le chemin du dossier global, puis "├── nom@version"
const PKG_LINE_RE = /[├└]─+\s+(\S+)@(\S+)/g
const ROOT_LINE_RE = /^([A-Za-z]:[^\r\n]*|\/[^\r\n]*)\s*\(\d+ packages?\)/

function findGlobalRoot(out: string): string {
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(ROOT_LINE_RE)
    if (m) return m[1].trim()
  }
  return ''
}

async function list(): Promise<AppInfo[]> {
  const out = await run('bun', ['pm', 'ls', '-g'])
  const root = findGlobalRoot(out)
  const apps: AppInfo[] = []
  for (const [, name, version] of out.matchAll(PKG_LINE_RE)) {
    const dir = root ? join(root, name) : undefined
    const meta = await readPkgMeta(dir, name)
    apps.push({
      id: `bun:${name}`,
      provider: 'bun',
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

export const bunProvider: Provider = {
  id: 'bun',
  isAvailable: () => commandAvailable('bun'),
  list,
  async checkOutdated() {
    // Bun n'a pas de commande « outdated » exploitable : les paquets bun étant des
    // paquets npm, on compare directement les versions installées au registre.
    const out = await run('bun', ['pm', 'ls', '-g'])
    const names = [...out.matchAll(PKG_LINE_RE)].map(([, name]) => name)
    return latestFromRegistry(names)
  },
  async launch(app) {
    openConsole(app.bin?.[0] ?? app.name)
  },
  async uninstall(app) {
    await run('bun', ['remove', '-g', app.name])
  },
  async update(app) {
    await run('bun', ['add', '-g', `${app.name}@latest`])
  }
}
