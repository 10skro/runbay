import { contextBridge, ipcRenderer } from 'electron'
import type { RunBayApi, AppEventChannel } from '../shared/types'

const api: RunBayApi = {
  scan: () => ipcRenderer.invoke('scan:start'),
  launch: (id) => ipcRenderer.invoke('app:launch', id),
  uninstall: (id) => ipcRenderer.invoke('app:uninstall', id),
  update: (id) => ipcRenderer.invoke('app:update', id),
  ignoreUpdate: (id) => ipcRenderer.invoke('app:ignore', id),
  unignoreUpdate: (id) => ipcRenderer.invoke('app:unignore', id),
  appIcon: (id) => ipcRenderer.invoke('app:icon', id),
  providerIcon: (id) => ipcRenderer.invoke('provider:icon', id),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  showInFolder: (path) => ipcRenderer.invoke('shell:show-item', path),
  createShortcut: (id) => ipcRenderer.invoke('app:shortcut', id),
  createSelfShortcut: () => ipcRenderer.invoke('app:self-shortcut'),
  sidebarCollapsed: (value) => ipcRenderer.invoke('settings:sidebar', value),
  backgroundMode: (value) => ipcRenderer.invoke('settings:background', value),
  welcomeAtStartup: (value) => ipcRenderer.invoke('settings:welcome', value),
  foregroundOnStart: (value) => ipcRenderer.invoke('settings:foreground', value),
  theme: (value) => ipcRenderer.invoke('settings:theme', value),
  appVersion: () => ipcRenderer.invoke('app:version'),
  selfUpdateStatus: () => ipcRenderer.invoke('update:self:status'),
  checkSelfUpdate: () => ipcRenderer.invoke('update:self:check'),
  applySelfUpdate: () => ipcRenderer.invoke('update:self:apply'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onEvent: (channel: AppEventChannel, cb: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown): void => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
