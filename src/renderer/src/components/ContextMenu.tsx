import { useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { Icon, type IconName } from './Icons'

export interface MenuItem {
  label: string
  icon?: IconName
  danger?: boolean
  /** Entrée d'action notable (ex. mise à jour dispo) : texte et icône au jaune d'alerte. */
  highlight?: boolean
  /** Affiche un interrupteur on/off à droite de l'entrée (état courant d'un réglage). */
  toggle?: boolean
  /** Infobulle explicative au survol (même moteur que le reste de l'UI). */
  tip?: string
  onSelect: () => void
}

export interface MenuSection {
  label?: string
  items: MenuItem[]
}

interface Props {
  x: number
  y: number
  /** 'top' = le menu s'ouvre au-dessus du point d'ancrage (bouton en bas d'écran). */
  placement?: 'bottom' | 'top'
  sections: MenuSection[]
  onClose: () => void
}

/**
 * Menu contextuel (clic droit sur une ligne) : toutes les actions possibles
 * pour l'app, groupées par catégorie (Run / Update / Manage).
 */
export default function ContextMenu({
  x,
  y,
  placement = 'bottom',
  sections,
  onClose
}: Props): ReactElement | null {
  const groups = sections.filter((s) => s.items.length > 0)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  // Le menu ne doit jamais être tronqué : on mesure sa taille réelle après
  // rendu (avant peinture) et on le recale à l'intérieur du viewport.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const rawTop = placement === 'top' ? y - height - 4 : y
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(rawTop, window.innerHeight - height - 8))
    })
  }, [x, y, placement])
  if (groups.length === 0) return null
  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {groups.map((section, i) => (
        <div key={section.label ?? i} className="ctx-group">
          {section.label && <div className="ctx-label">{section.label}</div>}
          {section.items.map((item) => (
            <button
              key={item.label}
              className={item.danger ? 'danger' : item.highlight ? 'highlight' : ''}
              data-tip={item.tip}
              onClick={() => {
                // Un réglage « interrupteur » ne ferme pas le menu : on peut
                // enchaîner plusieurs changements. Une action, elle, le ferme.
                if (item.toggle === undefined) onClose()
                item.onSelect()
              }}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              {item.label}
              {item.toggle !== undefined && (
                <span className={`ctx-switch ${item.toggle ? 'on' : ''}`} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
