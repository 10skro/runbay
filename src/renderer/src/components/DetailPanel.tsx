import type { AppAction, AppInfo } from '../../../shared/types'
import { PROVIDER_META, providerColorVars } from '../lib/providers'
import AppIcon from './AppIcon'
import { Icon } from './Icons'

export default function DetailPanel({
  app,
  busyAction,
  onClose,
  onLaunch,
  onUpdate,
  onUninstall,
  onCreateShortcut
}: {
  app: AppInfo
  busyAction?: AppAction
  onClose: () => void
  onLaunch: (app: AppInfo) => void
  onUpdate: (app: AppInfo) => void
  onUninstall: (app: AppInfo) => void
  onCreateShortcut: (app: AppInfo) => void
}): React.JSX.Element {
  const meta = PROVIDER_META[app.provider]
  return (
    <aside className="detail">
      <div className="detail-head">
        <div className="detail-head-left">
          <span className="badge big" style={providerColorVars(app.provider)}>
            {meta.label}
          </span>
          <AppIcon app={app} size={44} />
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close panel"
          data-tip="Close panel"
          data-key="Esc"
        >
          <Icon name="x" />
        </button>
      </div>
      <h2 className="detail-name">{app.name}</h2>
      {app.version && <div className="detail-version">version {app.version}</div>}
      {app.description && <p className="detail-desc">{app.description}</p>}
      <dl className="detail-meta">
        <dt>Source</dt>
        <dd>{meta.label}</dd>
        {app.latestVersion && (
          <>
            <dt>Latest version</dt>
            <dd className="latest">{app.latestVersion}</dd>
          </>
        )}
        {app.ignoredVersion && (
          <>
            <dt>Ignored update</dt>
            <dd className="ignored-note">
              {app.ignoredVersion} — use “Restore” below to bring it back
            </dd>
          </>
        )}
        {app.path && (
          <>
            <dt>Location</dt>
            <dd>
              {/* Le chemin affiché est tronqué par le CSS : l'infobulle le donne en entier. */}
              <button
                className="path-link"
                data-tip={`Open the install folder in Explorer\n${app.path}`}
                onClick={() => void window.api.showInFolder(app.path!)}
              >
                <Icon name="folder" size={13} />
                <span className="path">{app.path}</span>
              </button>
            </dd>
          </>
        )}
        {app.bin && app.bin.length > 0 && (
          <>
            <dt>Binaries</dt>
            <dd>{app.bin.join(', ')}</dd>
          </>
        )}
      </dl>
      {app.homepage && (
        <button
          className="btn link"
          data-tip="Open the project website in your default browser"
          onClick={() => window.api.openExternal(app.homepage!)}
        >
          Homepage <Icon name="external" />
        </button>
      )}
      <div className="detail-actions">
        {app.runnable && (
          <button
            className="btn primary"
            data-tip={`Open a terminal window and run "${app.bin?.[0] ?? app.name}"`}
            onClick={() => onLaunch(app)}
            disabled={!!busyAction}
          >
            {busyAction === 'launch' ? <span className="spinner" /> : <Icon name="play" />}
            {busyAction === 'launch' ? 'Launching…' : 'Launch'}
          </button>
        )}
        {app.runnable && (
          <button
            className="btn"
            data-tip="Create a .lnk on your Desktop that launches this app\nwith RunBay’s icon"
            onClick={() => onCreateShortcut(app)}
          >
            <Icon name="monitor" /> Desktop shortcut
          </button>
        )}
        {app.latestVersion && (
          <button
            className="btn"
            data-tip={`Update ${app.name} through the ${app.provider} manager`}
            onClick={() => onUpdate(app)}
            disabled={!!busyAction}
          >
            {busyAction === 'update' ? <span className="spinner" /> : <Icon name="update" />}
            {busyAction === 'update' ? 'Updating…' : `Update to ${app.latestVersion}`}
          </button>
        )}
        {app.latestVersion && (
          <button
            className="btn"
            data-tip={`Hide the update to ${app.latestVersion} until an even newer version is released`}
            onClick={() => void window.api.ignoreUpdate(app.id)}
          >
            <Icon name="ignore" /> Ignore this update
          </button>
        )}
        {app.ignoredVersion && (
          <button
            className="btn"
            data-tip="Stop ignoring this version — the update badge comes back"
            onClick={() => void window.api.unignoreUpdate(app.id)}
          >
            <Icon name="check" /> Restore ignored update {app.ignoredVersion}
          </button>
        )}
        {app.uninstallable && (
          <button
            className="btn danger"
            data-tip={`Remove ${app.name} through the ${app.provider} manager\nYou’ll be asked to confirm`}
            onClick={() => onUninstall(app)}
            disabled={!!busyAction}
          >
            {busyAction === 'uninstall' ? <span className="spinner" /> : <Icon name="trash" />}
            {busyAction === 'uninstall' ? 'Uninstalling…' : 'Uninstall'}
          </button>
        )}
      </div>
    </aside>
  )
}
