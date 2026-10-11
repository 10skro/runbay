import { useEffect, useState, type ReactElement } from 'react'
import type { ProviderId } from '../../../shared/types'

/* Cache module : un logo de gestionnaire n'est demandé qu'une fois. */
const logoCache = new Map<ProviderId, string | null>()

interface Props {
  id: ProviderId
  size: number
}

/**
 * Logo d'un gestionnaire (npm, pnpm…) : favicon de son site officiel,
 * récupéré et mis en cache par le main process. Fallback : l'initiale,
 * que le conteneur parent colore déjà à la couleur de la source.
 */
export default function ProviderLogo({ id, size }: Props): ReactElement {
  const [src, setSrc] = useState<string | null | undefined>(logoCache.get(id))

  useEffect(() => {
    if (src !== undefined) return
    let alive = true
    void window.api.providerIcon(id).then((url) => {
      logoCache.set(id, url)
      if (alive) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [id, src])

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    )
  }
  // null = pas de logo trouvé → initiale ; undefined = encore en cours → vide.
  return <>{src === null ? id[0].toUpperCase() : ''}</>
}
