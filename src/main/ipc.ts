import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { dirname, isAbsolute, join } from 'node:path'
import type { ActionEvent, AppAction, ProviderId } from '../shared/types'
import { appIcon, providerIcon } from './icons'
import { providersById } from './providers'
import { createDesktopShortcut, errorMessage, which } from './providers/util'
import { listProvider, scanAll } from './scanner'
import { saveSettings, settings } from './settings'
import { store } from './store'
import { applySelfUpdate, checkSelfUpdate, selfUpdateStatus } from './updater'

let scanning = false
let mainHooks: MainHooks | null = null

/** Scan complet, avec callback optionnel une fois le store à jour (utilisé par le mode fond). */
export async function startScan(onDone?: () => void): Promise<void> {
  if (scanning) return
  scanning = true
  store.clear()
  broadcast('scan:begin', null)
  try {
    await scanAll(
      (batch) => {
        store.replaceAllFor(batch.provider, batch.apps)
        broadcast('apps:batch', batch)
      },
      (status) => broadcast('provider:status', status)
    )
  } finally {
    scanning = false
    broadcast('scan:end', null)
    mainHooks?.onStoreChange()
    onDone?.()
  }
}

// Diffuse un événement à toutes les fenêtres (exporté : index.ts pousse les
// détections de mise à jour de RunBay lui-même).
export function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

function handleAction(action: AppAction): (id: string) => Promise<void> {
  return async (id: string) => {
    const app = store.get(id)
    if (!app) return
    const provider = providersById[app.provider]
    const fn = provider?.[action]
    const event = (state: ActionEvent['state'], message?: string): void =>
      broadcast('action:event', { appId: id, action, state, message } satisfies ActionEvent)

    if (!fn) {
      event('error', `Action "${action}" is not supported by ${app.provider}`)
      return
    }
    event('running')
    try {
      await fn(app)
      if (action === 'uninstall') {
        store.remove(id)
        broadcast('app:removed', id)
      } else if (action === 'update') {
        // Rafraîchit la liste du provider (avec les stats de mise à jour) pour afficher la nouvelle version.
        const apps = await listProvider(provider)
        store.replaceAllFor(app.provider, apps)
        broadcast('apps:batch', { provider: app.provider, apps })
      }
      event('done')
      mainHooks?.onStoreChange()
    } catch (err) {
      event('error', errorMessage(err))
    }
  }
}

interface MainHooks {
  /** Active/désactive le tray (mode fond) — le main process gère l'objet Tray. */
  setTrayVisible: (visible: boolean) => void
  /** Le store vient de changer : rafraîchir l'infobulle du tray (compte des mises à jour). */
  onStoreChange: () => void
}

export function registerIpc(hooks: MainHooks): void {
  mainHooks = hooks
  ipcMain.handle('scan:start', () => startScan())

  const onLaunch = handleAction('launch')
  const onUninstall = handleAction('uninstall')
  const onUpdate = handleAction('update')
  ipcMain.handle('app:launch', (_e, id: string) => onLaunch(id))
  ipcMain.handle('app:uninstall', (_e, id: string) => onUninstall(id))
  ipcMain.handle('app:update', (_e, id: string) => onUpdate(id))

  // « Ignorer cette version » : la mise à jour n'est plus proposée jusqu'à ce
  // qu'une version encore plus récente sorte. Choix persisté sur disque.
  ipcMain.handle('app:ignore', (_e, id: string) => {
    const app = store.get(id)
    if (!app?.latestVersion) return
    settings.ignored[app.id] = app.latestVersion
    saveSettings()
    app.ignoredVersion = app.latestVersion
    app.latestVersion = undefined
    broadcast('app:updated', app)
    mainHooks?.onStoreChange()
  })

  ipcMain.handle('app:unignore', (_e, id: string) => {
    const app = store.get(id)
    if (!app) return
    const ignored = settings.ignored[app.id]
    if (!ignored) return
    delete settings.ignored[app.id]
    saveSettings()
    app.ignoredVersion = undefined
    if (ignored !== app.version) app.latestVersion = ignored
    broadcast('app:updated', app)
    mainHooks?.onStoreChange()
  })

  // Icône « best effort » (avatar GitHub / favicon), déjà mise en cache sur disque.
  ipcMain.handle('app:icon', (_e, id: string) => appIcon(id))

  // Logo d'un gestionnaire (favicon de son site officiel), même cache.
  ipcMain.handle('provider:icon', (_e, id: ProviderId) => providerIcon(id))

  ipcMain.handle('shell:open', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) return shell.openExternal(url)
  })

  // Préférence UI « sidebar repliée » : sans argument = lecture, avec booléen = écriture.
  ipcMain.handle('settings:sidebar', (_e, value?: boolean) => {
    if (typeof value === 'boolean') {
      settings.sidebarCollapsed = value
      saveSettings()
    }
    return settings.sidebarCollapsed === true
  })

  // « Rester actif en arrière-plan à la fermeture » : même pattern lecture/écriture.
  // Le tray suit ce réglage (désactivé = la croix quitte l'app directement).
  ipcMain.handle('settings:background', (_e, value?: boolean) => {
    if (typeof value === 'boolean') {
      settings.backgroundOnClose = value
      saveSettings()
      hooks.setTrayVisible(value)
    }
    return settings.backgroundOnClose !== false
  })

  // « Afficher le guide de bienvenue au démarrage » : même pattern lecture/écriture.
  ipcMain.handle('settings:welcome', (_e, value?: boolean) => {
    if (typeof value === 'boolean') {
      settings.showWelcome = value
      saveSettings()
    }
    return settings.showWelcome !== false
  })

  // « Ouvrir la fenêtre au premier plan au démarrage » : même pattern lecture/écriture.
  ipcMain.handle('settings:foreground', (_e, value?: boolean) => {
    if (typeof value === 'boolean') {
      settings.foregroundOnStart = value
      saveSettings()
    }
    return settings.foregroundOnStart !== false
  })

  // « Thème clair » : même pattern lecture/écriture, renvoie le thème courant.
  // Le fond de la fenêtre est peint dans la même couleur que le thème (index.ts).
  ipcMain.handle('settings:theme', (_e, value?: 'dark' | 'light') => {
    if (value === 'dark' || value === 'light') {
      settings.theme = value
      saveSettings()
    }
    return settings.theme === 'light' ? 'light' : 'dark'
  })

  // Mise à jour de RunBay lui-même (via npm) : état connu, vérification à la demande,
  // application. Le résultat de l'application revient au renderer (toast + redémarrage).
  ipcMain.handle('update:self:status', () => selfUpdateStatus())
  ipcMain.handle('update:self:check', () => checkSelfUpdate())
  ipcMain.handle('update:self:apply', () => applySelfUpdate())

  // Fermeture depuis le menu Options (le flag 'quitting' évite le renvoi en tray).
  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  // Ouvre l'Explorateur avec l'élément sélectionné (accès à l'emplacement installé).
  ipcMain.handle('shell:show-item', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  // Crée un raccourci .lnk sur le Bureau pointant vers l'exécutable de l'app.
  // L'erreur est propagée au renderer (invoke rejeté) pour afficher un toast explicite.
  ipcMain.handle('app:shortcut', async (_e, id: string) => {
    const app = store.get(id)
    if (!app) return
    const bin = app.bin?.[0] ?? app.name
    const target = isAbsolute(bin) ? bin : await which(bin)
    await createDesktopShortcut({ name: app.name, target, workDir: dirname(target) })
  })

  // Raccourci vers RunBay lui-même. En dev, l'exécutable est Electron :
  // on lui passe le projet en argument, et l'icône .ico du projet (Electron a la sienne).
  // En paqué, l'icône est déjà embarquée dans l'exe : pas besoin d'IconLocation.
  ipcMain.handle('app:self-shortcut', async () => {
    if (app.isPackaged) {
      await createDesktopShortcut({ name: 'RunBay', target: process.execPath })
    } else {
      const project = app.getAppPath()
      await createDesktopShortcut({
        name: 'RunBay',
        target: process.execPath,
        args: `"${project}"`,
        workDir: project,
        icon: join(project, 'build', 'icon.ico')
      })
    }
  })
}
