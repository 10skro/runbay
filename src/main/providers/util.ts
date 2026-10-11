import { execFile, spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const IS_WIN = process.platform === 'win32'

// Avec shell:true, Node ne fait que concaténer les arguments → on les quote nous-mêmes
// (nos arguments sont des flags et des noms de paquets, jamais de guillemets imbriqués).
function quoteArgs(args: string[]): string[] {
  return args.map((a) => `"${a}"`)
}

// Sur Windows, npm/pnpm/yarn sont des shims .cmd : Node 20+ exige shell:true pour les exécuter.
export async function run(
  name: string,
  args: string[],
  opts: { shim?: boolean; timeout?: number } = {}
): Promise<string> {
  const useShell = IS_WIN && !!opts.shim
  const { stdout } = await execFileAsync(name, useShell ? quoteArgs(args) : args, {
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: opts.timeout ?? 180_000,
    ...(useShell ? { shell: true } : {})
  })
  return stdout
}

// `npm outdated` / `pnpm outdated` sortent avec le code 1 quand des paquets sont périmés :
// il faut donc tolérer un échec et récupérer la sortie quand même.
export async function runAllowFail(
  name: string,
  args: string[],
  opts: { shim?: boolean; timeout?: number } = {}
): Promise<string> {
  try {
    return await run(name, args, opts)
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout
    return stdout ?? ''
  }
}

export async function commandAvailable(name: string, shim = false): Promise<boolean> {
  try {
    const useShell = IS_WIN && shim
    await execFileAsync(name, useShell ? ['"--version"'] : ['--version'], {
      windowsHide: true,
      timeout: 20_000,
      ...(useShell ? { shell: true } : {})
    })
    return true
  } catch {
    return false
  }
}

export async function readJsonSafe<T = unknown>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

async function readPackageJson(dir: string): Promise<Record<string, unknown> | null> {
  return readJsonSafe(join(dir, 'package.json'))
}

/** Métadonnées d'un paquet installées sur le disque (description, homepage, binaires…). */
export interface PkgMeta {
  version?: string
  description?: string
  homepage?: string
  bins: string[]
}

/** Lit le package.json d'un paquet global et en extrait tout ce dont l'UI a besoin. */
export async function readPkgMeta(dir: string | undefined, pkgName: string): Promise<PkgMeta> {
  const pkg = dir ? ((await readPackageJson(dir)) ?? {}) : {}
  const binField = pkg.bin as string | Record<string, string> | undefined
  const bins = binField
    ? typeof binField === 'string'
      ? [pkgName]
      : Object.keys(binField)
    : []
  return {
    version: typeof pkg.version === 'string' ? pkg.version : undefined,
    description: typeof pkg.description === 'string' ? pkg.description : undefined,
    homepage: typeof pkg.homepage === 'string' ? pkg.homepage : undefined,
    bins
  }
}

/** Ouvre une vraie console Windows et y exécute la commande (les apps interactives fonctionnent). */
export function openConsole(command: string): void {
  if (IS_WIN) {
    // windowsVerbatimArguments : on construit la ligne de commande nous-mêmes,
    // car `start` exige le titre entre guillemets ("RunBay"), sinon il le prend comme programme.
    const child = spawn(
      'cmd.exe',
      ['/c', `start "RunBay" cmd /k ${command}`],
      {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: true
      }
    )
    child.unref()
  } else {
    const child = spawn(command, { detached: true, stdio: 'ignore', shell: true })
    child.unref()
  }
}

export function spawnDetached(exe: string, args: string[] = []): void {
  const child = spawn(exe, args, { detached: true, stdio: 'ignore' })
  child.unref()
}

/**
 * Résout le chemin réel d'une commande présente dans le PATH (shim npm/pnpm/yarn/bun…).
 * `where` renvoie parfois d'abord un shim POSIX sans extension (non lançable sous Windows) :
 * on privilégie les vrais exécutables (.exe/.cmd/.bat/.com).
 */
const EXECUTABLE_EXT = ['.exe', '.cmd', '.bat', '.com']

export async function which(cmd: string): Promise<string> {
  const out = await run('where', [cmd], { timeout: 15_000 })
  const lines = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const target =
    lines.find((l) => EXECUTABLE_EXT.includes(extname(l).toLowerCase())) ?? lines[0]
  if (!target) throw new Error(`Executable "${cmd}" was not found on this system`)
  return target
}

/**
 * Crée un raccourci .lnk sur le Bureau via WScript.Shell (PowerShell).
 * GetFolderPath('Desktop') gère le Bureau redirigé par OneDrive.
 */
export async function createDesktopShortcut(opts: {
  name: string
  target: string
  args?: string
  workDir?: string
  icon?: string
}): Promise<void> {
  // Nom de fichier sûr (les paquets scopés @scope/name deviennent name).
  const safeName = opts.name.split('/').pop()!.replace(/[<>:"/\\|?*$`]/g, '_')
  const q = (s: string): string => `'${s.replace(/'/g, "''")}'`
  const script = [
    `$d=[Environment]::GetFolderPath('Desktop')`,
    `$s=(New-Object -ComObject WScript.Shell).CreateShortcut("$d\\${safeName}.lnk")`,
    `$s.TargetPath=${q(opts.target)}`,
    ...(opts.args ? [`$s.Arguments=${q(opts.args)}`] : []),
    ...(opts.workDir ? [`$s.WorkingDirectory=${q(opts.workDir)}`] : []),
    ...(opts.icon ? [`$s.IconLocation=${q(`${opts.icon},0`)}`] : []),
    '$s.Save()'
  ].join(';')
  await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 30_000
  })
}

/**
 * Dernière version publiée sur le registre npm pour chaque paquet (requêtes parallèles,
 * échec toléré paquet par paquet). Sert aux gestionnaires sans commande « outdated ».
 */
export async function latestFromRegistry(names: string[]): Promise<Record<string, string>> {
  const results = await Promise.allSettled(
    names.map(async (name) => {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) throw new Error(`registry returned HTTP ${res.status}`)
      const { version } = (await res.json()) as { version?: string }
      if (!version) throw new Error('registry returned no version')
      return [name, version] as const
    })
  )
  const map: Record<string, string> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') map[r.value[0]] = r.value[1]
  }
  return map
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    const stderr = (err as Error & { stderr?: string }).stderr
    return (stderr || err.message).slice(0, 400)
  }
  return String(err)
}
