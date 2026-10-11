import type { ReactElement, RefObject } from 'react'
import { Icon } from './Icons'

interface Props {
  query: string
  onQuery: (query: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  scanning: boolean
  resultCount: number
  updatesCount: number
  updatePreview: string[]
  updateAllProgress: { done: number; total: number } | null
  onUpdateAll: () => void
  onRescan: () => void
}

export default function TopBar({
  query,
  onQuery,
  inputRef,
  scanning,
  resultCount,
  updatesCount,
  updatePreview,
  updateAllProgress,
  onUpdateAll,
  onRescan
}: Props): ReactElement {
  return (
    <header className="topbar">
      <div className="search">
        <Icon name="search" size={15} />
        <input
          ref={inputRef}
          placeholder="Search applications…   ( / )"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        {query && (
          <button className="clear" onClick={() => onQuery('')} aria-label="Clear" data-tip="Clear search">
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
      <div className="status">
        {updatesCount > 0 && !scanning && (
          <button
            className="btn primary sm"
            onClick={onUpdateAll}
            disabled={!!updateAllProgress}
            data-tip={`Update ${updatesCount} application${updatesCount > 1 ? 's' : ''} to their latest version\n${updatePreview.join('\n')}`}
          >
            {updateAllProgress ? (
              <>
                <span className="spinner" /> Updating {updateAllProgress.done}/
                {updateAllProgress.total}…
              </>
            ) : (
              <>
                <Icon name="update" size={14} /> Update all ({updatesCount})
              </>
            )}
          </button>
        )}
        {/* Rescan à côté de la liste qu'il rafraîchit, pas dans la sidebar. */}
        <button
          className="icon-btn"
          onClick={onRescan}
          disabled={scanning}
          aria-label="Rescan"
          data-tip={scanning ? 'Scanning…' : 'Re-scan all sources'}
        >
          <Icon name="rescan" size={15} />
        </button>
        {scanning ? (
          <>
            <span className="spinner" /> Scanning sources…
          </>
        ) : (
          <span className="muted">
            {resultCount} application{resultCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </header>
  )
}
