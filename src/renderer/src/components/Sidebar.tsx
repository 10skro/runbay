import { useEffect, useState, type MouseEvent, type ReactElement } from 'react'
import type { ProviderId, ProviderStatus, SelfUpdate } from '../../../shared/types'
import iconUrl from '../assets/icon.png'
import { PROVIDER_META, PROVIDER_ORDER, providerColorVars } from '../lib/providers'
import type { Filter } from '../lib/filters'
import ContextMenu, { type MenuItem, type MenuSection } from './ContextMenu'
import { Icon } from './Icons'
import ProviderLogo from './ProviderLogo'

interface Props {
  filter: Filter
  onFilter: (filter: Filter) => void
  counts: Record<string, number>
  updateCounts: Record<ProviderId, number>
  statuses: Record<ProviderId, ProviderStatus>
  collapsed: boolean
  onToggleCollapsed: () => void
  onCreateSelfShortcut: () => void
  backgroundOnClose: boolean
  onToggleBackgroundMode: () => void
  foregroundOnStart: boolean
  onToggleForegroundOnStart: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  selfUpdate: SelfUpdate | null
  selfUpdating: boolean
  onCheckSelfUpdate: () => void
  onApplySelfUpdate: () => void
  onShowWelcome: () => void
  onQuit: () => void
}

export default function Sidebar({
  filter,
  onFilter,
  counts,
  updateCounts,
  statuses,
  collapsed,
  onToggleCollapsed,
  onCreateSelfShortcut,
  backgroundOnClose,
  onToggleBackgroundMode,
  foregroundOnStart,
  onToggleForegroundOnStart,
  theme,
  onToggleTheme,
  selfUpdate,
  selfUpdating,
  onCheckSelfUpdate,
  onApplySelfUpdate,
  onShowWelcome,
  onQuit
}: Props): ReactElement {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  // Fermeture du menu Options : clic ailleurs ou Échap. Le clic sur le bouton
  // Options est exclu : c'est openOptions qui gère le basculement ouverture/fermeture.
  useEffect(() => {
    if (!menu) return
    const onDown = (e: PointerEvent): void => {
      if (!(e.target as HTMLElement).closest('.ctx-menu, .options-btn')) setMenu(null)
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

  // Le bouton est en bas de l'écran : le menu s'ouvre au-dessus de lui.
  // Un second clic sur le bouton le referme (comportement « interrupteur »).
  const openOptions = (e: MouseEvent<HTMLButtonElement>): void => {
    if (menu) {
      setMenu(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ x: rect.left, y: rect.top })
  }

  // Mise à jour de RunBay lui-même (via npm) : l'entrée « Update » n'apparaît
  // que si une version plus récente existe réellement — jamais de faux signal.
  const runBayItems: MenuItem[] = []
  if (selfUpdate) {
    runBayItems.push({
      label: selfUpdating ? 'Updating RunBay…' : `Update RunBay to v${selfUpdate.latest}`,
      icon: 'update',
      highlight: true,
      tip: `Installed v${selfUpdate.current} → available v${selfUpdate.latest}\nRunBay reinstalls itself through npm`,
      onSelect: onApplySelfUpdate
    })
  }
  runBayItems.push({
    label: 'Check for updates',
    icon: 'rescan',
    tip: 'Ask npm whether a newer RunBay version exists',
    onSelect: onCheckSelfUpdate
  })

  const optionsSections: MenuSection[] = [
    {
      label: 'Sidebar',
      items: [
        {
          label: collapsed ? 'Expand sidebar' : 'Collapse sidebar',
          icon: 'sidebar',
          tip: collapsed
            ? 'Restore the sidebar to full width'
            : 'Shrink the sidebar to a compact icon rail',
          onSelect: onToggleCollapsed
        }
      ]
    },
    {
      label: 'General',
      items: [
        {
          label: 'RunBay shortcut',
          icon: 'monitor',
          tip: 'Create a RunBay shortcut on your Desktop\nso you can launch it from anywhere',
          onSelect: onCreateSelfShortcut
        },
        {
          label: 'Welcome guide',
          icon: 'book',
          tip: 'Reopen the welcome guide',
          onSelect: onShowWelcome
        },
        {
          label: 'Open window in foreground',
          icon: 'front',
          toggle: foregroundOnStart,
          tip: 'Bring RunBay to the front when it starts\nDisable to let it open behind your other apps',
          onSelect: onToggleForegroundOnStart
        },
        {
          label: 'Light theme',
          icon: 'sun',
          toggle: theme === 'light',
          tip: 'Switch between the dark and light appearance\nSame neutral design, just inverted',
          onSelect: onToggleTheme
        }
      ]
    },
    {
      label: 'RunBay',
      items: runBayItems
    },
    {
      label: 'App',
      items: [
        {
          label: 'Keep running in background',
          icon: 'activity',
          toggle: backgroundOnClose,
          tip: 'Closing the window keeps RunBay in the tray\nand checks for updates every 30 minutes',
          onSelect: onToggleBackgroundMode
        },
        {
          label: 'Quit RunBay',
          icon: 'power',
          danger: true,
          tip: 'Quit RunBay and stop background scanning',
          onSelect: onQuit
        }
      ]
    }
  ]

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand">
        <img className="brand-mark" src={iconUrl} alt="" />
        {!collapsed && (
          <div>
            <h1>RunBay</h1>
            <p>App &amp; CLI manager</p>
          </div>
        )}
      </div>
      <nav className="nav">
        <button
          className={`nav-item ${filter === 'all' ? 'active' : ''}`}
          onClick={() => onFilter('all')}
          data-tip={collapsed ? `All (${counts.all ?? 0})` : undefined}
        >
          {collapsed ? (
            <span className="rail-badge neutral">
              <Icon name="layers" size={14} />
            </span>
          ) : (
            <>
              <span className="dot all" />
              All
              <span className="count">{counts.all ?? 0}</span>
            </>
          )}
        </button>
        <button
          className={`nav-item ${filter === 'updates' ? 'active' : ''}`}
          onClick={() => onFilter('updates')}
          data-tip={
            collapsed
              ? `Updates (${counts.updates ?? 0})`
              : counts.updates
                ? 'Applications with an available update'
                : 'No updates right now'
          }
        >
          {collapsed ? (
            <span className={`rail-badge neutral ${counts.updates ? 'glow' : ''}`}>
              <Icon name="update" size={14} />
            </span>
          ) : (
            <>
              <span className={`dot updates ${counts.updates ? 'glow' : ''}`} />
              Updates
              <span className="count">{counts.updates ?? 0}</span>
            </>
          )}
        </button>
        {collapsed ? <div className="nav-rule" /> : <div className="nav-sep">Sources</div>}
        {PROVIDER_ORDER.map((id) => {
          const s = statuses[id]
          const disabled = s.state === 'absent'
          const updates = updateCounts[id] ?? 0
          const label = PROVIDER_META[id].label
          // Infobulle : détails de compte en mode replié, sinon état utile
          // (absent = message clair, erreur = message du provider, updates = rappel).
          const tip = collapsed
            ? `${label}${s.state === 'ok' ? ` (${s.count})` : ''}${
                updates ? ` — ${updates} update(s)` : ''
              }`
            : s.state === 'absent'
              ? `${label} was not detected on this machine`
              : s.error ?? (updates ? `${updates} update(s) available` : undefined)
          return (
            <button
              key={id}
              className={`nav-item ${filter === id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onFilter(id)}
              data-tip={tip}
            >
              {collapsed ? (
                <span
                  className={`rail-badge ${s.state} ${
                    updates && s.state === 'ok' ? 'has-updates' : ''
                  }`}
                  style={providerColorVars(id)}
                >
                  <ProviderLogo id={id} size={18} />
                </span>
              ) : (
                <>
                  <span
                    className={`p-icon ${s.state} ${updates && s.state === 'ok' ? 'has-updates' : ''}`}
                    style={providerColorVars(id)}
                  >
                    <ProviderLogo id={id} size={12} />
                  </span>
                  {label}
                  <span className="count">
                    {s.state === 'scanning'
                      ? '…'
                      : s.state === 'ok'
                        ? s.count
                        : s.state === 'absent'
                          ? '—'
                          : s.state === 'error'
                            ? '!'
                            : ''}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        {collapsed ? (
          <button
            className="rail-badge neutral options-btn"
            onClick={openOptions}
            data-tip={selfUpdate ? 'Options — RunBay update available' : 'Options'}
          >
            <Icon name="settings" size={16} />
            {selfUpdate && !selfUpdating && <span className="self-dot" />}
          </button>
        ) : (
          <button
            className="btn secondary options-btn"
            onClick={openOptions}
            data-tip={selfUpdate ? 'Options — RunBay update available' : 'Configure RunBay'}
          >
            <Icon name="settings" />
            {selfUpdate && !selfUpdating && <span className="self-dot" />}
            &nbsp;Options
          </button>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          placement="top"
          sections={optionsSections}
          onClose={() => setMenu(null)}
        />
      )}
    </aside>
  )
}
