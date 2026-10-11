import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import iconUrl from '../assets/icon.png'
import { PROVIDER_META } from '../lib/providers'
import { Icon } from './Icons'

/* Illustrations : mini-maquettes de la vraie interface, dessinées en SVG
   avec les couleurs du design system — jamais de capture d'écran figée. */

function Frame({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg viewBox="0 0 220 140" role="img" aria-hidden="true">
      <rect x="1" y="1" width="218" height="138" rx="8" fill="var(--bg)" stroke="var(--border-strong)" />
      {children}
    </svg>
  )
}

function MockRow({ y, highlight }: { y: number; highlight?: 'play' | 'update' }): ReactElement {
  const npm = PROVIDER_META.npm.color
  return (
    <>
      <rect x="12" y={y} width="196" height="30" rx="5" fill="var(--bg-hover)" />
      <rect x="20" y={y + 8} width="34" height="14" rx="3" fill="none" stroke={npm} />
      <text x="37" y={y + 18.5} textAnchor="middle" fontSize="8" fill={npm} fontWeight="600">
        npm
      </text>
      <rect x="62" y={y + 8} width="14" height="14" rx="3" fill={`color-mix(in srgb, ${npm} 25%, transparent)`} />
      <text x="69" y={y + 19} textAnchor="middle" fontSize="9" fill={npm} fontWeight="700">
        L
      </text>
      <rect x="84" y={y + 9} width="52" height="5" rx="2.5" fill="var(--text-dim)" />
      <rect x="84" y={y + 18} width="34" height="4" rx="2" fill="var(--border-strong)" />
      {highlight && (
        <g>
          <rect
            x="182"
            y={y + 7}
            width="16"
            height="16"
            rx="4"
            fill="color-mix(in srgb, var(--accent) 22%, transparent)"
            stroke="var(--accent)"
          />
          {highlight === 'play' ? (
            <path d={`M188 ${y + 11} l6 4 -6 4 z`} fill="var(--accent)" />
          ) : (
            <path
              d="M186 0h8l-4 5z"
              fill="var(--warning)"
              transform={`translate(0 ${y + 17}) scale(1 -1)`}
            />
          )}
        </g>
      )}
    </>
  )
}

const artWelcome = (
  <div className="wizard-logo">
    <img src={iconUrl} alt="" width={96} height={96} />
    <strong>RunBay</strong>
    <span>App &amp; CLI manager</span>
  </div>
)

const artLaunch = (
  <Frame>
    <MockRow y={22} highlight="play" />
    <MockRow y={62} />
    <text x="110" y="122" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      ▶ one click — or a desktop shortcut
    </text>
  </Frame>
)

const artUpdate = (
  <Frame>
    <MockRow y={18} highlight="update" />
    <text x="142" y="31" fontSize="8" fill="var(--warning)" fontWeight="600">
      ⬆ 0.9.4
    </text>
    <rect x="12" y="60" width="70" height="20" rx="4" fill="color-mix(in srgb, var(--accent) 22%, transparent)" stroke="var(--accent)" />
    <text x="47" y="73" textAnchor="middle" fontSize="9" fill="var(--accent)" fontWeight="600">
      Update all
    </text>
    <rect x="92" y="60" width="86" height="20" rx="4" fill="none" stroke="var(--border-strong)" />
    <text x="135" y="73" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      Ignore this version
    </text>
    <text x="110" y="112" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      updates only when they exist — pinned if you say so
    </text>
  </Frame>
)

const artManage = (
  <Frame>
    <rect x="40" y="14" width="140" height="112" rx="6" fill="var(--bg-card)" stroke="var(--border-strong)" />
    <text x="52" y="32" fontSize="7" fill="var(--text-dim)" letterSpacing="1">RUN</text>
    <rect x="52" y="38" width="60" height="6" rx="3" fill="var(--border-strong)" />
    <text x="52" y="58" fontSize="7" fill="var(--text-dim)" letterSpacing="1">UPDATE</text>
    <rect x="52" y="64" width="74" height="6" rx="3" fill="var(--border-strong)" />
    <text x="52" y="84" fontSize="7" fill="var(--text-dim)" letterSpacing="1">MANAGE</text>
    <rect x="52" y="90" width="66" height="6" rx="3" fill="var(--border-strong)" />
    <rect x="52" y="102" width="52" height="6" rx="3" fill="color-mix(in srgb, var(--danger) 55%, transparent)" />
    <text x="110" y="128" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      right-click — every action, grouped
    </text>
  </Frame>
)

const artSources = (
  <Frame>
    {/* La sidebar : chaque source avec sa couleur et son compteur. */}
    <rect x="14" y="12" width="46" height="116" rx="6" fill="var(--bg-side)" stroke="var(--border-strong)" />
    {(['npm', 'pnpm', 'yarn', 'bun', 'scoop'] as const).map((id, i) => {
      const c = PROVIDER_META[id].color
      const y = 24 + i * 20
      return (
        <g key={id}>
          <rect x="20" y={y} width="16" height="16" rx="4" fill={`color-mix(in srgb, ${c} 20%, transparent)`} stroke={`color-mix(in srgb, ${c} 45%, transparent)`} />
          <text x="28" y={y + 11.5} textAnchor="middle" fontSize="9" fill={c} fontWeight="700">
            {id[0].toUpperCase()}
          </text>
          <rect x="41" y={y + 6} width={14 - i * 2} height="4" rx="2" fill={`color-mix(in srgb, ${c} 55%, transparent)`} />
        </g>
      )
    })}
    {/* Badge d'update sur la source concernée. */}
    <circle cx="38" cy="22" r="4.5" fill="var(--warning)" />
    <text x="38" y="24.5" textAnchor="middle" fontSize="6" fill="var(--bg)" fontWeight="700">
      1
    </text>
    {/* Le lien visuel : les lignes héritent de la couleur de leur source. */}
    {(['npm', 'pnpm', 'scoop'] as const).map((id, i) => {
      const c = PROVIDER_META[id].color
      const y = 20 + i * 28
      return (
        <g key={id}>
          <rect x="72" y={y} width="134" height="22" rx="4" fill="var(--bg-hover)" />
          <rect x="72" y={y} width="3" height="22" rx="1.5" fill={c} />
          <rect x="82" y={y + 5} width="12" height="12" rx="3" fill={`color-mix(in srgb, ${c} 25%, transparent)`} stroke={`color-mix(in srgb, ${c} 45%, transparent)`} />
          <rect x="102" y={y + 6} width={54 - i * 12} height="4.5" rx="2" fill="var(--text-dim)" />
          <rect x="102" y={y + 13} width={36 - i * 8} height="3.5" rx="1.75" fill="var(--border-strong)" />
        </g>
      )
    })}
    <text x="139" y="112" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      every source keeps its color
    </text>
  </Frame>
)

const artBackground = (
  <Frame>
    {/* La fenêtre qu'on ferme : le X est mis en avant. */}
    <rect x="16" y="14" width="96" height="66" rx="6" fill="var(--bg-card)" stroke="var(--border-strong)" />
    <line x1="16" y1="27" x2="112" y2="27" stroke="var(--border)" />
    <rect x="98" y="17" width="10" height="8" rx="2" fill="color-mix(in srgb, var(--accent) 20%, transparent)" stroke="var(--accent)" />
    <path d="M100.5 19 l5 4 M105.5 19 l-5 4" stroke="var(--accent)" strokeWidth="1.2" />
    {/* Le relais : du bouton fermer jusqu'à l'icône dans la barre des tâches. */}
    <path d="M103 28 C 118 60, 138 88, 176 106" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="4 3" />
    <path d="M170 100 l8 7 -9 1 z" fill="var(--accent)" />
    {/* Notification silencieuse, au-dessus de la barre des tâches. */}
    <rect x="120" y="46" width="88" height="32" rx="5" fill="var(--bg-card)" stroke="var(--border-strong)" />
    <circle cx="134" cy="62" r="6" fill="color-mix(in srgb, var(--warning) 25%, transparent)" stroke="var(--warning)" />
    <text x="146" y="59" fontSize="7.5" fill="var(--text)" fontWeight="600">
      2 updates found
    </text>
    <text x="146" y="70" fontSize="6.5" fill="var(--text-dim)">
      silent — no focus stolen
    </text>
    {/* La barre des tâches avec l'icône RunBay dans la zone de notification. */}
    <rect x="10" y="106" width="200" height="14" rx="4" fill="var(--bg-side)" stroke="var(--border-strong)" />
    <circle cx="186" cy="113" r="6" fill="color-mix(in srgb, var(--accent) 30%, transparent)" stroke="var(--accent)" />
    <text x="186" y="115.5" textAnchor="middle" fontSize="7" fill="var(--accent)" fontWeight="700">
      R
    </text>
    <text x="110" y="132" textAnchor="middle" fontSize="9" fill="var(--text-dim)">
      close the window — the watch goes on
    </text>
  </Frame>
)

interface Step {
  title: string
  body: ReactNode
  art: ReactNode
}

const STEPS: Step[] = [
  {
    title: 'Welcome to RunBay',
    art: artWelcome,
    body: (
      <>
        <p>
          Thanks for trying RunBay. You install apps from the command line — this app gives
          them a home: everything installed with <b>npm, pnpm, yarn, bun or scoop</b>,
          detected automatically in one fast launcher.
        </p>
        <p>
          <b>Not an installer — a launcher.</b> It never installs anything for you; it runs,
          updates and manages what you already have. Here is a quick 30-second tour — press{' '}
          <b>Next</b> whenever you&apos;re ready.
        </p>
      </>
    )
  },
  {
    title: 'Launch in one click',
    art: artLaunch,
    body: (
      <>
        <p>
          Every app that exposes a command gets a <b>▶ Run</b> button — in the row, in the
          right-click menu, or in the detail panel. The app starts in its own terminal.
        </p>
        <p>
          Want it on the desktop? <b>Create desktop shortcut</b> builds a real .lnk with the
          RunBay icon, ready to double-click.
        </p>
      </>
    )
  },
  {
    title: 'Updates, your way',
    art: artUpdate,
    body: (
      <>
        <p>
          RunBay checks every source for newer versions. A <b>pulsing amber badge</b> shows where
          updates live, and <b>Update all</b> applies them in one batch.
        </p>
        <p>
          Not ready to move? <b>Ignore this version</b> pins the app — the update disappears until
          an even newer one ships. Restore it any time.
        </p>
      </>
    )
  },
  {
    title: 'Every action, everywhere',
    art: artManage,
    body: (
      <>
        <p>
          <b>Right-click any row</b> for the full menu — Run, Update, Manage — and the detail
          panel exposes the same actions plus the install location and homepage.
        </p>
        <p>
          Uninstalling always asks first with a clear confirmation. Press <kbd>/</kbd> to search,
          <kbd>Esc</kbd> to step back.
        </p>
      </>
    )
  },
  {
    title: 'Sources, color-coded',
    art: artSources,
    body: (
      <>
        <p>
          Each package manager has <b>its own color</b>, filter and count in the sidebar. Absent
          managers stay grey; sources with updates glow.
        </p>
        <p>
          Collapse the sidebar from <b>Options</b> — it becomes a compact rail of badges, and
          every color stays readable.
        </p>
      </>
    )
  },
  {
    title: 'Quiet when you need it',
    art: artBackground,
    body: (
      <>
        <p>
          Closing the window can keep RunBay in the <b>system tray</b>: it re-checks for updates
          every 30 minutes and notifies you silently. Toggle this any time in{' '}
          <b>Options → Keep running in background</b>.
        </p>
        <p>
          You can reopen this guide any time from <b>Options → Welcome guide</b>. That&apos;s
          everything — happy launching.
        </p>
      </>
    )
  }
]

interface Props {
  atStartup: boolean
  onToggleStartup: () => void
  onClose: () => void
}

/** Guide de bienvenue en étapes : présente toutes les fonctions de l'app. */
export default function WelcomeWizard({ atStartup, onToggleStartup, onClose }: Props): ReactElement {
  const [step, setStep] = useState(0)
  const last = STEPS.length - 1

  // Échap ferme le wizard (les raccourcis globaux sont déjà neutralisés par l'overlay).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal wizard" role="dialog" aria-modal="true">
        <div className="wizard-progress" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`wdot ${i === step ? 'on' : i < step ? 'done' : ''}`} />
          ))}
        </div>
        <button
          className="icon-btn wizard-x"
          onClick={onClose}
          data-tip="Close"
          data-key="Esc"
          aria-label="Close"
        >
          <Icon name="x" />
        </button>

        {/* key={step} relance l'animation d'apparition à chaque étape. */}
        <div className="wizard-body" key={step}>
          <div className="wizard-art">{STEPS[step].art}</div>
          <div className="wizard-text">
            <h3>{STEPS[step].title}</h3>
            {STEPS[step].body}
          </div>
        </div>

        <div className="wizard-foot">
          <label className="wizard-check">
            <input type="checkbox" checked={atStartup} onChange={onToggleStartup} />
            Show at startup
          </label>
          <div className="wizard-nav">
            {step > 0 && (
              <button className="btn ghost" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <button
              className="btn primary"
              autoFocus
              onClick={() => (step === last ? onClose() : setStep(step + 1))}
            >
              {step === last ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
