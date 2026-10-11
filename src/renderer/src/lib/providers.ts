import type { CSSProperties } from 'react'
import type { ProviderId } from '../../../shared/types'

// Couleur par source (teintes sobres, fidèles aux marques, séparées par teinte) :
// les badges et pastilles la consomment via la variable CSS --pc.
// Les valeurs vivent dans main.css (--pc-*) pour que le thème clair puisse
// les assombrir sans toucher ce fichier.
export const PROVIDER_META: Record<ProviderId, { label: string; color: string }> = {
  npm: { label: 'npm', color: 'var(--pc-npm)' },
  pnpm: { label: 'pnpm', color: 'var(--pc-pnpm)' },
  yarn: { label: 'yarn', color: 'var(--pc-yarn)' },
  bun: { label: 'bun', color: 'var(--pc-bun)' },
  scoop: { label: 'scoop', color: 'var(--pc-scoop)' }
}

/** Variable CSS de couleur d'une source, à poser sur un badge ou une pastille. */
export const providerColorVars = (id: ProviderId): CSSProperties =>
  ({ '--pc': PROVIDER_META[id].color }) as CSSProperties

export const PROVIDER_ORDER: ProviderId[] = ['npm', 'pnpm', 'yarn', 'bun', 'scoop']
