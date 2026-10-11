import { useEffect, useState, type ReactElement } from 'react'
import type { AppInfo } from '../../../shared/types'
import { providerColorVars } from '../lib/providers'

/* Cache module : chaque app n'est demandée qu'une fois, quel que soit
   le nombre de composants qui l'affichent (ligne, panneau de détail). */
const iconCache = new Map<string, string | null>()

interface Props {
  app: AppInfo
  size: number
}

/**
 * Icône d'application : logo réel si le main process en trouve un
 * (avatar GitHub / favicon du homepage), sinon monogramme coloré par
 * la source — jamais d'image cassée.
 */
export default function AppIcon({ app, size }: Props): ReactElement {
  const [src, setSrc] = useState<string | null | undefined>(iconCache.get(app.id))

  useEffect(() => {
    if (src !== undefined) return
    let alive = true
    void window.api.appIcon(app.id).then((url) => {
      iconCache.set(app.id, url)
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [app.id, src])

  if (src) {
    return <img className="app-icon" src={src} width={size} height={size} alt="" />
  }

  const initial = (app.name.replace(/[^a-z0-9]/gi, ' ').trim()[0] ?? '?').toUpperCase()
  return (
    <span
      className={`app-monogram ${src === undefined ? 'loading' : ''}`}
      style={{
        ...providerColorVars(app.provider),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.48)
      }}
    >
      {src === null ? initial : ''}
    </span>
  )
}
