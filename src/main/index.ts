import { app, BrowserWindow, Menu, Notification, Tray, nativeImage, screen, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { registerIpc, startScan, broadcast } from './ipc'
import { loadCache } from './cache'
import { loadSettings, saveSettings, settings, type WindowBounds } from './settings'
import { store } from './store'
import { checkSelfUpdate } from './updater'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let closeHintShown = false

const BACKGROUND_SCAN_MS = 30 * 60 * 1000

// Identité d'application Windows (barre des tâches, notifications). Volontairement
// neuve (« com.skrodu10... », notre pseudo) : l'ancienne collait depuis les
// versions sans icône et Windows garde l'icône en cache par identifiant.
const APP_ID = 'com.skrodu10.runbay'

/** La fenêtre enregistrée touche-t-elle encore un écran branché ? (anti-fantôme multi-moniteur) */
function isOnScreen(b: WindowBounds): boolean {
  return screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return (
      b.x < wa.x + wa.width - 60 &&
      b.x + b.width > wa.x + 60 &&
      b.y < wa.y + wa.height - 60 &&
      b.y + b.height > wa.y + 60
    )
  })
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  // Géométrie mémorisée si elle est encore valable, sinon dimensions par défaut.
  const saved = settings.window
  const bounds = saved && isOnScreen(saved) ? saved : undefined
  mainWindow = new BrowserWindow({
    ...(bounds
      ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
      : { width: 1240, height: 800 }),
    minWidth: 940,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    // Fond peint dans la couleur du thème : pas de flash clair/sombre avant le 1er rendu.
    backgroundColor: settings.theme === 'light' ? '#f5f6f7' : '#111214',
    title: 'RunBay',
    // Fichier d'icône embarqué dans le paquet (barre de titre + barre des tâches).
    // L'app est lancée depuis npm comme un simple dossier : l'exe est Electron,
    // qui n'a pas de visage à lui — on lui donne le nôtre. Windows préfère le
    // .ico (plusieurs tailles), les autres plateformes le .png du tray.
    icon: appIconPath(process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (saved?.maximized) mainWindow.maximize()

  // Bouton de barre des tâches : Windows le dessine à partir des propriétés
  // d'application de la fenêtre, pas de l'option icon ci-dessus (qui habille la
  // barre de titre). Sans ceci, l'icône affichée reste celle d'Electron.
  // API officielle BrowserWindow.setAppDetails (Windows uniquement).
  if (process.platform === 'win32') {
    mainWindow.setAppDetails({
      appId: APP_ID,
      appIconPath: appIconPath('icon.ico'),
      appIconIndex: 0
    })
  }

  // Ouverture : l'option « Open window in foreground » (activée par défaut) force le
  // premier plan. Windows le refuse aux processus lancés par un processus d'arrière-plan
  // (verrou de premier plan) — l'astuce alwaysOnTop l'impose quand même.
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return
    if (settings.foregroundOnStart === false) {
      mainWindow.show()
      return
    }
    mainWindow.setAlwaysOnTop(true)
    mainWindow.show()
    mainWindow.setAlwaysOnTop(false)
    mainWindow.focus()
  })

  // Mémoire de la géométrie : sauvegarde amortie sur move/resize, restaurée au prochain lancement.
  let persistTimer: NodeJS.Timeout | undefined
  const persistGeometry = (): void => {
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      if (!mainWindow) return
      const [x, y] = mainWindow.getPosition()
      const [width, height] = mainWindow.getSize()
      settings.window = { x, y, width, height, maximized: mainWindow.isMaximized() }
      saveSettings()
    }, 400)
  }
  mainWindow.on('moved', persistGeometry)
  mainWindow.on('resized', persistGeometry)

  // Mode fond discret (réglable dans Options) : la croix masque la fenêtre,
  // l'app reste joignable depuis le tray. Désactivé : la croix quitte l'app.
  mainWindow.on('close', (e) => {
    if (quitting || settings.backgroundOnClose === false) return
    e.preventDefault()
    mainWindow?.hide()
    if (!closeHintShown) {
      closeHintShown = true
      new Notification({
        title: 'RunBay is still running',
        body: 'Find it in the system tray — Quit from the tray menu.'
      }).show()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Fichier d'icône de l'app elle-même : à côté des ressources quand elle est
 * paquée (electron-builder), sinon dans build/ du paquet npm. Sert à la fenêtre
 * (barre de titre + barre des tâches) et au tray — une seule et même image.
 */
function appIconPath(fileName: string): string {
  return app.isPackaged
    ? join(process.resourcesPath, fileName)
    : join(__dirname, '../../build', fileName)
}

function createTray(): void {
  const iconPath = appIconPath('icon.png')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  refreshTrayTip()
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open RunBay', click: showWindow },
      { label: 'Check for updates', click: () => void startScan(backgroundReport) },
      { type: 'separator' },
      {
        label: 'Quit RunBay',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
}

/** Le tray n'existe que si le mode fond est activé (réglable dans Options). */
function setTrayVisible(visible: boolean): void {
  if (visible && !tray) createTray()
  if (!visible && tray) {
    tray.destroy()
    tray = null
  }
}

/** Infobulle du tray : le nom de l'app, plus le compte des mises à jour en attente. */
function refreshTrayTip(): void {
  if (!tray) return
  const n = store.countUpdatable()
  tray.setToolTip(n ? `RunBay — ${n} update${n > 1 ? 's' : ''} available` : 'RunBay')
}

/** Après un scan de fond : notification silencieuse (jamais de focus volé) si des mises à jour sont là. */
function backgroundReport(): void {
  const n = store.countUpdatable()
  if (!n) return
  if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) return
  new Notification({
    title: `${n} update${n > 1 ? 's' : ''} available`,
    body: 'Open RunBay to review them.'
  }).show()
}

// Instance unique : lancer le raccourci alors que RunBay tourne déjà (par exemple
// caché dans le tray) ramène la fenêtre existante au lieu d'ouvrir une seconde
// instance — qui de plus se disputerait le cache avec la première.
const isSecondInstance = !app.requestSingleInstanceLock()
if (isSecondInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Même astuce qu'à l'ouverture : Windows refuse le premier plan aux processus d'arrière-plan.
    mainWindow?.setAlwaysOnTop(settings.foregroundOnStart !== false)
    showWindow()
    mainWindow?.setAlwaysOnTop(false)
  })
}

app.whenReady().then(() => {
  // Seconde instance : rien à initialiser, l'app se quitte juste après le ready.
  if (isSecondInstance) return
  electronApp.setAppUserModelId(APP_ID)
  loadSettings()
  // Cache de démarrage : le store repart avec le dernier état connu (apps +
  // statuts), restauré avant la fenêtre. Le premier scan déclenché par la
  // fenêtre ne fait que le corriger en arrière-plan ; sans cache exploitable,
  // le comportement reste celui d'un premier lancement.
  loadCache()
  // Pas de menu par défaut (il serait traduit dans la langue du système et jure avec l'app).
  // Les raccourcis F5 / Ctrl+R / F12 restent actifs via optimizer.watchWindowShortcuts.
  Menu.setApplicationMenu(null)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc({ setTrayVisible, onStoreChange: refreshTrayTip })
  createWindow()
  setTrayVisible(settings.backgroundOnClose !== false)

  // Mise à jour de RunBay lui-même : vérifiée quelques secondes après l'ouverture
  // (ne retarde pas l'affichage), puis avec chaque cycle de fond. Une seule
  // notification par nouvelle version ; le point jaune du menu Options persiste.
  let selfUpdateNotified: string | null = null
  const checkSelf = async (): Promise<void> => {
    const update = await checkSelfUpdate()
    if (!update) return
    broadcast('update:self', update)
    if (update.latest === selfUpdateNotified) return
    selfUpdateNotified = update.latest
    new Notification({
      title: `RunBay ${update.latest} is available`,
      body: 'Update it from the Options menu.'
    }).show()
  }
  setTimeout(() => void checkSelf(), 4000)

  // Scan périodique uniquement quand la fenêtre est masquée :
  // jamais de refresh visible pendant que l'utilisateur est dans l'app.
  setInterval(() => {
    if (!mainWindow || !mainWindow.isVisible()) {
      void startScan(backgroundReport)
      void checkSelf()
    }
  }, BACKGROUND_SCAN_MS)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  quitting = true
  tray?.destroy()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
