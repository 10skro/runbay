export type ProviderId = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'scoop'

export interface AppInfo {
  id: string // `${provider}:${name}` — identifiant unique global
  provider: ProviderId
  name: string
  version: string
  latestVersion?: string // si une version plus récente est disponible
  ignoredVersion?: string // dernière version connue volontairement ignorée par l'utilisateur
  description?: string
  homepage?: string
  bin?: string[] // binaires exposés (CLI)
  path?: string // emplacement installé
  runnable: boolean // peut être lancée depuis l'app
  uninstallable: boolean
}

export type ProviderState = 'idle' | 'scanning' | 'ok' | 'absent' | 'error'

export interface ProviderStatus {
  id: ProviderId
  state: ProviderState
  count: number
  error?: string
}

export type AppAction = 'launch' | 'uninstall' | 'update'

export interface ActionEvent {
  appId: string
  action: AppAction
  state: 'running' | 'done' | 'error'
  message?: string
}

export interface AppsBatch {
  provider: ProviderId
  apps: AppInfo[]
}

export type AppEventChannel =
  | 'scan:begin'
  | 'scan:end'
  | 'apps:batch'
  | 'provider:status'
  | 'action:event'
  | 'app:removed'
  | 'app:updated'
  | 'update:self'

/** Mise à jour de RunBay lui-même (distribution npm). */
export interface SelfUpdate {
  current: string
  latest: string
}

export interface SelfUpdateApplyResult {
  /** done = installé ; manual = commande à exécuter hors d'une installation globale ; error = échec. */
  state: 'done' | 'manual' | 'error'
  message?: string
}

/** API exposée au renderer via le preload (window.api). */
export interface RunBayApi {
  scan(): Promise<void>
  launch(id: string): Promise<void>
  uninstall(id: string): Promise<void>
  update(id: string): Promise<void>
  ignoreUpdate(id: string): Promise<void>
  unignoreUpdate(id: string): Promise<void>
  /** Icône « best effort » (avatar GitHub / favicon) en data URL, ou null si introuvable. */
  appIcon(id: string): Promise<string | null>
  /** Logo d'un gestionnaire (favicon du site officiel) en data URL, ou null si introuvable. */
  providerIcon(id: ProviderId): Promise<string | null>
  openExternal(url: string): Promise<void>
  showInFolder(path: string): Promise<void>
  createShortcut(id: string): Promise<void>
  createSelfShortcut(): Promise<void>
  /** Sans argument = lit la préférence ; avec booléen = la persiste. */
  sidebarCollapsed(value?: boolean): Promise<boolean>
  /** « Rester actif en arrière-plan à la fermeture » : idem lecture/écriture. */
  backgroundMode(value?: boolean): Promise<boolean>
  /** « Afficher le guide de bienvenue au démarrage » : idem lecture/écriture. */
  welcomeAtStartup(value?: boolean): Promise<boolean>
  /** « Ouvrir la fenêtre au premier plan au démarrage » : idem lecture/écriture. */
  foregroundOnStart(value?: boolean): Promise<boolean>
  /** Thème d'apparence : idem lecture/écriture, renvoie toujours le thème courant. */
  theme(value?: 'dark' | 'light'): Promise<'dark' | 'light'>
  /** Version courante de RunBay, affichée discrètement dans l'interface. */
  appVersion(): Promise<string>
  /** Mise à jour de RunBay via npm : état connu, vérification manuelle, application. */
  selfUpdateStatus(): Promise<SelfUpdate | null>
  checkSelfUpdate(): Promise<SelfUpdate | null>
  applySelfUpdate(): Promise<SelfUpdateApplyResult>
  quit(): Promise<void>
  onEvent(channel: AppEventChannel, cb: (data: unknown) => void): () => void
}

export interface Provider {
  id: ProviderId
  isAvailable(): Promise<boolean>
  list(): Promise<AppInfo[]>
  /**
   * Détection des mises à jour disponibles : sans elle, aucune action « Update »
   * n'est proposée (on ne met à jour que ce qui est réellement périmé).
   * Nom du paquet → dernière version disponible (si > version installée).
   */
  checkOutdated?(): Promise<Record<string, string>>
  launch?(app: AppInfo): Promise<void>
  uninstall?(app: AppInfo): Promise<void>
  update?(app: AppInfo): Promise<void>
}
