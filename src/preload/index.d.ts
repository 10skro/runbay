import type { RunBayApi } from '../shared/types'

declare global {
  interface Window {
    api: RunBayApi
  }
}

export {}
