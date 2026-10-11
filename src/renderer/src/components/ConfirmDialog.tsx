import { useEffect, type ReactElement } from 'react'

interface Props {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modal de confirmation : les actions destructives passent par un seul et même
 * dialogue, qu'elles soient déclenchées depuis une ligne, un menu ou le panneau.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel
}: Props): ReactElement {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
          {/* Focus initial sur l'action principale : Entrée = confirmer, Échap = annuler. */}
          <button className={`btn ${danger ? 'danger' : 'primary'}`} autoFocus onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
