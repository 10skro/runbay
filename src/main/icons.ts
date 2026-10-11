import { app } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ProviderId } from '../shared/types'
import { store } from './store'

/**
 * Icônes d'applications — approche « best effort » :
 * les gestionnaires de paquets CLI n'embarquent pas d'icône, mais beaucoup
 * de paquets exposent un `homepage`. On en déduit le logo réel (avatar du
 * dépôt GitHub ou favicon du site), téléchargé une seule fois puis servi
 * depuis le cache disque. Sans homepage ni logo trouvable : null, et le
 * renderer affiche son monogramme en fallback.
 */

// Logos des gestionnaires eux-mêmes : favicon du site officiel de chaque source.
const PROVIDER_SITES: Record<ProviderId, string> = {
  npm: 'https://www.npmjs.com',
  pnpm: 'https://pnpm.io',
  yarn: 'https://yarnpkg.com',
  bun: 'https://bun.sh',
  scoop: 'https://scoop.sh'
}

const inflight = new Map<string, Promise<string | null>>()

/** Icône d'une app (data URL) — dédupliquée, mise en cache sur disque. */
export function appIcon(id: string): Promise<string | null> {
  const homepage = store.get(id)?.homepage
  if (!homepage) return Promise.resolve(null)
  return cachedIcon(id, () => iconCandidates(homepage))
}

/** Logo d'un gestionnaire (npm, pnpm…) — même pipeline, clé de cache dédiée. */
export function providerIcon(id: ProviderId): Promise<string | null> {
  const site = PROVIDER_SITES[id]
  if (!site) return Promise.resolve(null)
  return cachedIcon(`provider:${id}`, () => iconCandidates(site))
}

function cachedIcon(key: string, candidates: () => Promise<string[]>): Promise<string | null> {
  const pending = inflight.get(key)
  if (pending) return pending
  const work = resolve(key, candidates).finally(() => inflight.delete(key))
  inflight.set(key, work)
  return work
}

async function resolve(key: string, candidates: () => Promise<string[]>): Promise<string | null> {
  const cacheDir = join(app.getPath('userData'), 'icon-cache')
  const cacheFile = join(cacheDir, createHash('sha1').update(key).digest('hex'))
  if (existsSync(cacheFile)) return toDataUrl(readFileSync(cacheFile))

  for (const url of await candidates()) {
    const buf = await download(url)
    if (buf) {
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(cacheFile, buf)
      return toDataUrl(buf)
    }
  }
  return null
}

/** URLs à essayer, dans l'ordre de fiabilité. */
async function iconCandidates(homepage: string): Promise<string[]> {
  let url: URL
  try {
    url = new URL(homepage)
  } catch {
    return []
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return []
  const host = url.hostname.toLowerCase()

  // GitHub : l'avatar de l'owner du dépôt est le logo le plus proche du projet.
  if (host === 'github.com' || host === 'www.github.com') {
    const repo = url.pathname.match(/^\/([^/]+)\/([^/]+)/)
    if (!repo) return []
    try {
      const res = await fetch(`https://api.github.com/repos/${repo[1]}/${repo[2]}`, {
        headers: { 'user-agent': 'runbay' },
        signal: AbortSignal.timeout(8000)
      })
      if (res.ok) {
        const json = (await res.json()) as { owner?: { avatar_url?: string } }
        if (json.owner?.avatar_url) return [json.owner.avatar_url]
      }
    } catch {
      /* hors ligne / rate limit → fallback monogramme */
    }
    return []
  }

  // Site classique : favicon direct d'abord, service Google en secours.
  return [`https://${host}/favicon.ico`, `https://www.google.com/s2/favicons?domain=${host}&sz=64`]
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'RunBay' }, // certains CDN (npm) bloquent le fetch sans UA
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Garde-fou : on ne cache que de vraies images, pas des pages d'erreur.
    if (buf.length < 100 || buf.length > 2_000_000 || !looksLikeImage(buf)) return null
    return buf
  } catch {
    return null
  }
}

function looksLikeImage(buf: Buffer): boolean {
  return (
    (buf[0] === 0x89 && buf[1] === 0x50) || // PNG
    (buf[0] === 0xff && buf[1] === 0xd8) || // JPEG
    (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) || // ICO
    (buf[0] === 0x3c && buf.subarray(0, 64).toString().includes('svg')) // SVG
  )
}

function toDataUrl(buf: Buffer): string | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return `data:image/png;base64,${buf.toString('base64')}`
  if (buf[0] === 0xff && buf[1] === 0xd8) return `data:image/jpeg;base64,${buf.toString('base64')}`
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00)
    return `data:image/x-icon;base64,${buf.toString('base64')}`
  if (buf[0] === 0x3c) return `data:image/svg+xml;base64,${buf.toString('base64')}`
  return null
}
