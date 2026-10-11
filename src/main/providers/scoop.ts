import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AppInfo, Provider } from '../../shared/types'
import { readJsonSafe, run, spawnDetached } from './util'

interface ScoopManifest {
  name?: string
  version?: string
  description?: string
  homepage?: string
  shortcuts?: string[][] // [ [nom, "app\\exe", ...], ... ]
}

function scoopRoot(): string {
  return join(homedir(), 'scoop')
}

/** Scoop est une fonction PowerShell : on charge le module pour la rendre disponible. */
function scoopCommand(inner: string): string {
  return (
    `if (Get-Command scoop -ErrorAction SilentlyContinue) { ${inner} } ` +
    `else { . "$env:USERPROFILE\\scoop\\modules\\pscoop\\src\\pscoop.psd1"; ${inner} }`
  )
}

async function readManifest(appDir: string): Promise<ScoopManifest | null> {
  // Selon les versions de Scoop : scoop-installed.json ou scoop-manifest.json
  for (const file of ['scoop-installed.json', 'scoop-manifest.json']) {
    const manifest = await readJsonSafe<ScoopManifest>(join(appDir, file))
    if (manifest) return manifest
  }
  return null
}

async function list(): Promise<AppInfo[]> {
  const appsDir = join(scoopRoot(), 'apps')
  if (!existsSync(appsDir)) return []
  const entries = await readdir(appsDir, { withFileTypes: true })
  const apps: AppInfo[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const appDir = join(appsDir, entry.name)
    const manifest = await readManifest(appDir)
    if (!manifest) continue
    const exe = manifest.shortcuts?.[0]?.[1]
    const exePath = exe ? join(appDir, 'current', exe.replace(/\\/g, '/')) : undefined
    apps.push({
      id: `scoop:${entry.name}`,
      provider: 'scoop',
      name: entry.name,
      version: String(manifest.version ?? ''),
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
      homepage: typeof manifest.homepage === 'string' ? manifest.homepage : undefined,
      path: appDir,
      runnable: Boolean(exePath && existsSync(exePath)),
      uninstallable: true,
      bin: exePath ? [exePath] : undefined
    })
  }
  return apps
}

export const scoopProvider: Provider = {
  id: 'scoop',
  isAvailable: () => Promise.resolve(existsSync(scoopRoot())),
  list,
  async checkOutdated() {
    // `scoop outdated` affiche un tableau "Name Current Available Source" (avec codes ANSI).
    const out = await run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      scoopCommand('scoop outdated')
    ])
    const map: Record<string, string> = {}
    for (const line of out.replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/)) {
      const m = line.trim().match(/^(\S+)\s+(\S+)\s+(\S+)\s+\S+$/)
      if (!m || m[1].toLowerCase() === 'name' || m[2] === m[3]) continue
      map[m[1]] = m[3]
    }
    return map
  },
  async launch(app) {
    const exe = app.bin?.[0]
    if (!exe) throw new Error('No executable found for this application')
    spawnDetached(exe)
  },
  async uninstall(app) {
    await run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      scoopCommand(`scoop uninstall ${app.name}`)
    ])
  },
  async update(app) {
    await run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      scoopCommand(`scoop update ${app.name}`)
    ])
  }
}
