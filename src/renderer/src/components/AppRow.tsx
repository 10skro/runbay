import type { ReactElement } from 'react'
import type { AppAction, AppInfo } from '../../../shared/types'
import { PROVIDER_META, providerColorVars } from '../lib/providers'
import AppIcon from './AppIcon'
import { Icon } from './Icons'

interface Props {
  app: AppInfo
  selected: boolean
  busyAction?: AppAction
  onSelect: () => void
  onMenu: (x: number, y: number) => void
  onLaunch: (app: AppInfo) => void
  onUpdate: (app: AppInfo) => void
  onUninstall: (app: AppInfo) => void
}

export default function AppRow({
  app,
  selected,
  busyAction,
  onSelect,
  onMenu,
  onLaunch,
  onUpdate,
  onUninstall
}: Props): ReactElement {
  const meta = PROVIDER_META[app.provider]
  const busyTitle: Record<AppAction, string> = {
    launch: 'Launching…',
    update: app.latestVersion ? `Updating to ${app.latestVersion}…` : 'Updating…',
    uninstall: 'Uninstalling…'
  }
  return (
    <div
      className={`row ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu(e.clientX, e.clientY)
      }}
    >
      <span className="badge" style={providerColorVars(app.provider)}>
        {meta.label}
      </span>
      <AppIcon app={app} size={28} />
      <div className="row-main">
        <div className="row-title">
          {app.name}
          {app.version && <span className="version">{app.version}</span>}
          {app.latestVersion && (
            <span className="outdated" data-tip={`A newer version exists: ${app.latestVersion}`}>
              ⬆ {app.latestVersion}
            </span>
          )}
          {app.ignoredVersion && (
            <span
              className="ignored"
              data-tip={`Update to ${app.ignoredVersion} is ignored\nRight-click this row to restore it`}
            >
              ⬆ {app.ignoredVersion} ignored
            </span>
          )}
        </div>
        {app.description && <div className="row-desc">{app.description}</div>}
      </div>
      <div
        className={`row-actions ${busyAction ? 'always' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {busyAction ? (
          /* L'opération en cours remplace les boutons par le spinner :
             même emplacement, aligné, jamais superposé. */
          <span className={`row-busy ${busyAction}`} data-tip={busyTitle[busyAction]}>
            <span className="spinner" />
          </span>
        ) : (
          <>
            {app.runnable && (
              <button
                className="icon-btn launch"
                data-tip="Launch in a terminal"
                disabled={!!busyAction}
                onClick={() => onLaunch(app)}
              >
                <Icon name="play" />
              </button>
            )}
            {app.latestVersion && (
              <button
                className="icon-btn update"
                data-tip={`Update to ${app.latestVersion}`}
                disabled={!!busyAction}
                onClick={() => onUpdate(app)}
              >
                <Icon name="update" />
              </button>
            )}
            {app.uninstallable && (
              <button
                className="icon-btn uninstall"
                data-tip="Uninstall"
                disabled={!!busyAction}
                onClick={() => onUninstall(app)}
              >
                <Icon name="trash" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
