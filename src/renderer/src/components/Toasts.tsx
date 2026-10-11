export interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

export default function Toasts({
  toasts,
  dismiss
}: {
  toasts: Toast[]
  dismiss: (id: number) => void
}): React.JSX.Element {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Close">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
