import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type {
  ActionEvent,
  AppAction,
  AppInfo,
  AppsBatch,
  ProviderId,
  ProviderStatus,
  SelfUpdate
} from '../../shared/types'
import { PROVIDER_META, PROVIDER_ORDER } from './lib/providers'
import type { Filter } from './lib/filters'
import AppRow from './components/AppRow'
import ConfirmDialog from './components/ConfirmDialog'
import WelcomeWizard from './components/WelcomeWizard'
import ContextMenu, { type MenuItem, type MenuSection } from './components/ContextMenu'
import DetailPanel from './components/DetailPanel'
import Sidebar from './components/Sidebar'
import Toasts, { type Toast } from './components/Toasts'
import TopBar from './components/TopBar'
import TooltipLayer from './lib/tooltip'

const INITIAL_STATUSES = Object.fromEntries(
  PROVIDER_ORDER.map((id) => [id, { id, state: 'idle', count: 0 } satisfies ProviderStatus])
) as Record<ProviderId, ProviderStatus>

export default function App(): ReactElement {
  const [apps, setApps] = useState<Record<string, AppInfo>>({})
  const [statuses, setStatuses] = useState<Record<ProviderId, ProviderStatus>>(INITIAL_STATUSES)
  const [scanning, setScanning] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<Record<string, AppAction>>({})
  const [confirmUninstall, setConfirmUninstall] = useState<AppInfo | null>(null)
  const [updateAllProgress, setUpdateAllProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [menu, setMenu] = useState<{ x: number; y: number; app: AppInfo } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [backgroundOnClose, setBackgroundOnClose] = useState(true)
  const [welcome, setWelcome] = useState(false)
  const [welcomeAtStartup, setWelcomeAtStartup] = useState(true)
  const [foregroundOnStart, setForegroundOnStart] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [selfUpdate, setSelfUpdate] = useState<SelfUpdate | null>(null)
  const [selfUpdating, setSelfUpdating] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // Suivi d'une mise à jour groupée : les échecs sont comptés via les action events.
  const batchRef = useRef<{ errors: number } | null>(null)

  // Restaurer la préférence « sidebar repliée » dès le premier rendu.
  useEffect(() => {
    void window.api.sidebarCollapsed().then(setCollapsed)
    void window.api.backgroundMode().then(setBackgroundOnClose)
    void window.api.foregroundOnStart().then(setForegroundOnStart)
    // Le thème a déjà été appliqué par main.tsx avant le rendu : on synchronise l'état du menu.
    void window.api.theme().then(setTheme)
    // Mise à jour de RunBay : l'état déjà détecté par le main process au démarrage.
    void window.api.selfUpdateStatus().then(setSelfUpdate)
    // Guide de bienvenue : affiché au démarrage tant que l'option est cochée.
    void window.api.welcomeAtStartup().then((v) => {
      setWelcomeAtStartup(v)
      if (v) setWelcome(true)
    })
  }, [])

  const toggleCollapsed = useCallback((): void => {
    setCollapsed((c) => {
      void window.api.sidebarCollapsed(!c)
      return !c
    })
  }, [])

  // « Rester actif en arrière-plan à la fermeture » : persiste côté main process.
  const toggleBackgroundMode = useCallback((): void => {
    setBackgroundOnClose((on) => {
      void window.api.backgroundMode(!on)
      return !on
    })
  }, [])

  // « Ouvrir la fenêtre au premier plan au démarrage » : même pattern.
  const toggleForegroundOnStart = useCallback((): void => {
    setForegroundOnStart((on) => {
      void window.api.foregroundOnStart(!on)
      return !on
    })
  }, [])

  // « Thème clair » : persiste et bascule data-theme sur <html> immédiatement.
  const toggleTheme = useCallback((): void => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      void window.api.theme(next)
      if (next === 'light') document.documentElement.dataset.theme = 'light'
      else delete document.documentElement.dataset.theme
      return next
    })
  }, [])

  // « Afficher le guide de bienvenue au démarrage » : même pattern.
  const toggleWelcomeAtStartup = useCallback((): void => {
    setWelcomeAtStartup((v) => {
      void window.api.welcomeAtStartup(!v)
      return !v
    })
  }, [])

  const pushToast = useCallback((kind: Toast['kind'], text: string): void => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000)
  }, [])

  // Mise à jour de RunBay (via npm) : vérification à la demande depuis le menu Options.
  const checkSelfUpdate = useCallback((): void => {
    void window.api.checkSelfUpdate().then((u) => {
      setSelfUpdate(u)
      pushToast(
        u ? 'info' : 'success',
        u ? `RunBay ${u.latest} is available — update it from the Options menu` : 'RunBay is up to date'
      )
    })
  }, [pushToast])

  // Application : la réinstallation npm se fait côté main process ; ici on affiche le résultat.
  const applySelfUpdate = useCallback((): void => {
    if (selfUpdating) return
    setSelfUpdating(true)
    void window.api.applySelfUpdate().then((r) => {
      setSelfUpdating(false)
      if (r.state === 'done') {
        setSelfUpdate(null)
        pushToast('success', r.message ?? 'RunBay updated')
      } else if (r.state === 'manual') {
        // Pas installé en global (dev, npx) : on remet la commande à l'utilisateur, déjà copiée.
        void navigator.clipboard.writeText(r.message ?? '')
        pushToast('info', `Not installed via npm global — command copied: ${r.message}`)
      } else {
        pushToast('error', `Update failed: ${r.message ?? 'unknown error'}`)
      }
    })
  }, [selfUpdating, pushToast])

  // Flux d'événements venant du main process (scan, lots d'apps, actions…).
  useEffect(() => {
    const offs = [
      // La revalidation ne vide plus rien : l'état affiché (éventuellement issu
      // du cache de démarrage) reste à l'écran ; seuls les lots le corrigeront.
      window.api.onEvent('scan:begin', () => setScanning(true)),
      window.api.onEvent('scan:end', () => setScanning(false)),
      window.api.onEvent('apps:batch', (data) => {
        const batch = data as AppsBatch
        setApps((prev) => {
          // Remplacement par provider (miroir de store.replaceAllFor côté main) :
          // les entrées disparues hors de RunBay (désinstallées à la main pendant
          // que l'app était fermée) sortent de la liste dès le lot de leur provider.
          const next: Record<string, AppInfo> = {}
          for (const [id, app] of Object.entries(prev))
            if (app.provider !== batch.provider) next[id] = app
          for (const app of batch.apps) next[app.id] = app
          return next
        })
      }),
      window.api.onEvent('provider:status', (data) => {
        const status = data as ProviderStatus
        setStatuses((prev) => ({ ...prev, [status.id]: status }))
      }),
      window.api.onEvent('action:event', (data) => {
        const e = data as ActionEvent
        setBusy((prev) => {
          const next = { ...prev }
          if (e.state === 'running') next[e.appId] = e.action
          else delete next[e.appId]
          return next
        })
        // En groupement : pas de toast par app, on compte les échecs pour le bilan final.
        if (batchRef.current && e.action === 'update') {
          if (e.state === 'error') batchRef.current.errors += 1
          return
        }
        if (e.state === 'error') {
          pushToast('error', e.message || 'The operation failed')
        } else if (e.state === 'done' && e.action === 'update') {
          pushToast('success', 'Update completed')
        }
      }),
      window.api.onEvent('app:removed', (data) => {
        const id = String(data)
        setApps((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setSelectedId((sel) => (sel === id ? null : sel))
        pushToast('success', 'Application uninstalled')
      }),
      window.api.onEvent('app:updated', (data) => {
        // Le main process pousse l'app modifiée (ignore/unignore d'une version).
        const app = data as AppInfo
        setApps((prev) => ({ ...prev, [app.id]: app }))
      }),
      window.api.onEvent('update:self', (data) => {
        // Détection d'une mise à jour de RunBay (démarrage ou cycle de fond).
        setSelfUpdate(data as SelfUpdate)
      })
    ]
    void window.api.scan()
    return () => offs.forEach((off) => off())
  }, [pushToast])

  // Raccourcis : / pour la recherche, Échap pour fermer sélection/recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Un modal ouvert capte le clavier : les raccourcis globaux se mettent en retrait.
      if (document.querySelector('.modal-overlay')) return
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'Escape') {
        setSelectedId(null)
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fermeture du menu contextuel : clic ailleurs ou Échap.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('.ctx-menu')) setMenu(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const doLaunch = useCallback((app: AppInfo): void => void window.api.launch(app.id), [])
  const doUpdate = useCallback((app: AppInfo): void => void window.api.update(app.id), [])
  const requestUninstall = useCallback((app: AppInfo): void => setConfirmUninstall(app), [])

  // Mise à jour groupée : séquentielle (les gestionnaires de paquets se verrouillent mal entre eux).
  const doUpdateAll = useCallback(async (): Promise<void> => {
    const targets = Object.values(apps).filter((a) => a.latestVersion)
    if (!targets.length) return
    batchRef.current = { errors: 0 }
    setUpdateAllProgress({ done: 0, total: targets.length })
    for (const app of targets) {
      await window.api.update(app.id)
      setUpdateAllProgress((p) => (p ? { done: p.done + 1, total: p.total } : p))
    }
    const { errors } = batchRef.current
    batchRef.current = null
    setUpdateAllProgress(null)
    if (errors > 0) {
      pushToast('error', `${targets.length - errors} update(s) succeeded, ${errors} failed`)
    } else {
      pushToast('success', `All updates completed (${targets.length})`)
    }
  }, [apps, pushToast])

  // Raccourci Bureau : le main process rejette la promesse en cas d'échec → toast explicite.
  const reportShortcut = useCallback(
    (create: Promise<void>): void => {
      create
        .then(() => pushToast('success', 'Shortcut created on your Desktop'))
        .catch((err: unknown) =>
          pushToast('error', err instanceof Error ? err.message : 'Could not create the shortcut')
        )
    },
    [pushToast]
  )

  const doShortcut = useCallback(
    (app: AppInfo): void => reportShortcut(window.api.createShortcut(app.id)),
    [reportShortcut]
  )

  const doSelfShortcut = useCallback(
    (): void => reportShortcut(window.api.createSelfShortcut()),
    [reportShortcut]
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(apps)
      .filter((a) =>
        filter === 'all'
          ? true
          : filter === 'updates'
            ? Boolean(a.latestVersion)
            : a.provider === filter
      )
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.description ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [apps, filter, query])

  const counts = useMemo(() => {
    const all = Object.values(apps)
    const c: Record<string, number> = {
      all: all.length,
      updates: all.filter((a) => a.latestVersion).length
    }
    for (const a of all) c[a.provider] = (c[a.provider] ?? 0) + 1
    return c
  }, [apps])

  // Mises à jour par source : déclenche la pastille pulsante dans la sidebar.
  const updateCounts = useMemo(() => {
    const c = Object.fromEntries(PROVIDER_ORDER.map((id) => [id, 0])) as Record<ProviderId, number>
    for (const a of Object.values(apps)) if (a.latestVersion) c[a.provider] += 1
    return c
  }, [apps])

  // Aperçu « Update all » : la liste de ce qui sera mis à jour, dans l'infobulle
  // du bouton. Données déjà dans le store — aucun appel réseau.
  const updatePreview = useMemo(
    () =>
      Object.values(apps)
        .filter((a) => a.latestVersion)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => `${a.name}   ${a.version} → ${a.latestVersion}`),
    [apps]
  )

  // Toutes les actions possibles pour une app, groupées par catégorie
  // dans le menu contextuel de la ligne.
  const menuSections = useCallback(
    (app: AppInfo): MenuSection[] => {
      const run: MenuItem[] = []
      if (app.runnable) {
        run.push({
          label: 'Launch',
          icon: 'play',
          tip: `Open a terminal window and run "${app.bin?.[0] ?? app.name}"`,
          onSelect: () => doLaunch(app)
        })
        run.push({
          label: 'Create desktop shortcut',
          icon: 'monitor',
          tip: 'Create a .lnk on your Desktop that launches this app\nwith RunBay’s icon',
          onSelect: () => doShortcut(app)
        })
      }
      if (app.homepage)
        run.push({
          label: 'Open homepage',
          icon: 'external',
          tip: 'Open the project website in your default browser',
          onSelect: () => void window.api.openExternal(app.homepage!)
        })
      const update: MenuItem[] = []
      if (app.latestVersion) {
        update.push({
          label: `Update to ${app.latestVersion}`,
          icon: 'update',
          tip: `Update ${app.name} through the ${app.provider} manager`,
          onSelect: () => doUpdate(app)
        })
        update.push({
          label: 'Ignore this update',
          icon: 'ignore',
          tip: `Hide the update to ${app.latestVersion} until an even newer version ships`,
          onSelect: () => void window.api.ignoreUpdate(app.id)
        })
      }
      if (app.ignoredVersion)
        update.push({
          label: `Restore ignored update ${app.ignoredVersion}`,
          icon: 'check',
          tip: 'Stop ignoring this version — the update badge comes back',
          onSelect: () => void window.api.unignoreUpdate(app.id)
        })
      const manage: MenuItem[] = []
      if (app.path)
        manage.push({
          label: 'Show in Explorer',
          icon: 'folder',
          tip: `Open the install folder in Explorer\n${app.path}`,
          onSelect: () => void window.api.showInFolder(app.path!)
        })
      if (app.uninstallable)
        manage.push({
          label: 'Uninstall',
          icon: 'trash',
          danger: true,
          tip: `Remove ${app.name} through the ${app.provider} manager\nYou’ll be asked to confirm`,
          // Même confirmation en deux temps que sur la ligne : rien de destructeur sans clic de contrôle.
          onSelect: () => requestUninstall(app)
        })
      return [
        { label: 'Run', items: run },
        { label: 'Update', items: update },
        { label: 'Manage', items: manage }
      ]
    },
    [doLaunch, doUpdate, doShortcut]
  )

  const selected = selectedId ? apps[selectedId] : undefined
  const menuGroups = menu ? menuSections(menu.app) : null

  return (
    <div className={`layout ${collapsed ? 'nav-collapsed' : ''}`}>
      <Sidebar
        filter={filter}
        onFilter={setFilter}
        counts={counts}
        updateCounts={updateCounts}
        statuses={statuses}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onCreateSelfShortcut={doSelfShortcut}
        backgroundOnClose={backgroundOnClose}
        onToggleBackgroundMode={toggleBackgroundMode}
        foregroundOnStart={foregroundOnStart}
        onToggleForegroundOnStart={toggleForegroundOnStart}
        theme={theme}
        onToggleTheme={toggleTheme}
        selfUpdate={selfUpdate}
        selfUpdating={selfUpdating}
        onCheckSelfUpdate={checkSelfUpdate}
        onApplySelfUpdate={applySelfUpdate}
        onShowWelcome={() => setWelcome(true)}
        onQuit={() => void window.api.quit()}
      />

      <main className="main">
        <TopBar
          query={query}
          onQuery={setQuery}
          inputRef={searchRef}
          scanning={scanning}
          resultCount={list.length}
          updatesCount={counts.updates}
          updatePreview={updatePreview}
          updateAllProgress={updateAllProgress}
          onUpdateAll={() => void doUpdateAll()}
          onRescan={() => void window.api.scan()}
        />

        <section className="list">
          {list.length === 0 && !scanning && (
            <div className="empty">
              <div className="empty-mark">▚</div>
              <h2>No applications found</h2>
              <p>
                {query
                  ? 'No results for this search.'
                  : 'No tools detected on this machine. Install npm, pnpm, yarn, bun or scoop, then rescan.'}
              </p>
            </div>
          )}
          {list.map((app) => (
            <AppRow
              key={app.id}
              app={app}
              selected={selectedId === app.id}
              busyAction={busy[app.id]}
              onSelect={() => setSelectedId(app.id)}
              onMenu={(x, y) => setMenu({ x, y, app })}
              onLaunch={doLaunch}
              onUpdate={doUpdate}
              onUninstall={requestUninstall}
            />
          ))}
        </section>
      </main>

      {selected && (
        <DetailPanel
          app={selected}
          busyAction={busy[selected.id]}
          onClose={() => setSelectedId(null)}
          onLaunch={doLaunch}
          onUpdate={doUpdate}
          onUninstall={requestUninstall}
          onCreateShortcut={doShortcut}
        />
      )}

      <Toasts toasts={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Couche d'infobulles unique, alimentée par les data-tip de toute l'UI. */}
      <TooltipLayer />

      {menu && menuGroups && (
        <ContextMenu x={menu.x} y={menu.y} sections={menuGroups} onClose={() => setMenu(null)} />
      )}

      {confirmUninstall && (
        <ConfirmDialog
          title={`Uninstall ${confirmUninstall.name}?`}
          body={`This removes ${confirmUninstall.name} ${confirmUninstall.version}, installed via ${PROVIDER_META[confirmUninstall.provider].label}. This can't be undone.`}
          confirmLabel="Uninstall"
          danger
          onConfirm={() => {
            void window.api.uninstall(confirmUninstall.id)
            setConfirmUninstall(null)
          }}
          onCancel={() => setConfirmUninstall(null)}
        />
      )}

      {welcome && (
        <WelcomeWizard
          atStartup={welcomeAtStartup}
          onToggleStartup={toggleWelcomeAtStartup}
          onClose={() => setWelcome(false)}
        />
      )}
    </div>
  )
}
