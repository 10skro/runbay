import type { ProviderId } from '../../../shared/types'

/** Filtre actif de la liste : tout, uniquement les mises à jour, ou une source précise. */
export type Filter = 'all' | 'updates' | ProviderId
