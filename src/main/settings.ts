import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

export interface Settings {
  /** appId → version volontairement ignorée (plus de badge ni d'action Update). */
  ignored: Record<string, string>
  /** Géométrie de la fenêtre, restaurée au prochain lancement. */
  window?: WindowBounds
  /** Sidebar réduite en rail d'icônes, restaurée au prochain lancement. */
  sidebarCollapsed?: boolean
  /** Fermer la fenêtre garde l'app active en fond (tray). Défaut : true. */
  backgroundOnClose?: boolean
  /** Afficher le guide de bienvenue au démarrage. Défaut : true. */
  showWelcome?: boolean
  /** Forcer la fenêtre au premier plan au démarrage. Défaut : true. */
  foregroundOnStart?: boolean
  /** Thème d'apparence : 'light' ou absent = sombre (défaut). */
  theme?: 'dark' | 'light'
}

const settings: Settings = { ignored: {} }

function file(): string {
  return join(app.getPath('userData'), 'runbay-settings.json')
}

export function loadSettings(): void {
  try {
    const f = file()
    if (existsSync(f)) Object.assign(settings, JSON.parse(readFileSync(f, 'utf8')) as Settings)
  } catch {
    // Un fichier corrompu ne doit pas empêcher l'app de démarrer : on garde les défauts.
  }
}

export function saveSettings(): void {
  try {
    writeFileSync(file(), JSON.stringify(settings, null, 2))
  } catch {
    // Persistance non critique (disque, droits) : l'app continue de fonctionner.
  }
}

export { settings }
