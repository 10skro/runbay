import type { Provider, ProviderId } from '../../shared/types'
import { npmProvider } from './npm'
import { pnpmProvider } from './pnpm'
import { yarnProvider } from './yarn'
import { bunProvider } from './bun'
import { scoopProvider } from './scoop'
// Périmètre : uniquement les outils installés en ligne de commande (écosystème JS + scoop).
// Le support des apps Windows (winget) est une extension future optionnelle.

export const providers: Provider[] = [
  npmProvider,
  pnpmProvider,
  yarnProvider,
  bunProvider,
  scoopProvider
]

export const providersById: Record<ProviderId, Provider> = Object.fromEntries(
  providers.map((p) => [p.id, p])
) as Record<ProviderId, Provider>
