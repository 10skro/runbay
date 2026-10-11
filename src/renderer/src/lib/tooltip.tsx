import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'

/*
 * Moteur d'infobulles global — remplace le title natif (lent, non stylé,
 * mono-ligne, absent au clavier). Les éléments déclarent leur infobulle via
 * data-tip (multi-ligne avec \n) et, s'il y a un raccourci clavier, data-key.
 * Une seule couche, positionnée et bornée comme le menu contextuel.
 * Survol : apparition après un court délai (survol voulu, pas un passage de
 * souris). Focus clavier : apparition immédiate.
 */

const SHOW_DELAY_MS = 300
const GAP = 8
const EDGE = 6

interface Tip {
  text: string
  shortcut?: string
  target: HTMLElement
}

export default function TooltipLayer(): ReactElement | null {
  const [tip, setTip] = useState<Tip | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let hovered: HTMLElement | null = null
    const dismiss = (): void => {
      clearTimeout(timer)
      hovered = null
      setTip(null)
    }
    const show = (el: HTMLElement, immediate: boolean): void => {
      const text = el.dataset.tip
      if (!text) return
      if (immediate) setTip({ text, shortcut: el.dataset.key, target: el })
      else timer = setTimeout(() => setTip({ text, shortcut: el.dataset.key, target: el }), SHOW_DELAY_MS)
    }
    const onOver = (e: PointerEvent): void => {
      const el = (e.target as Element | null)?.closest('[data-tip]') as HTMLElement | null
      if (!el || el === hovered) return
      hovered = el
      clearTimeout(timer)
      show(el, false)
    }
    const onOut = (e: PointerEvent): void => {
      const el = (e.target as Element | null)?.closest('[data-tip]')
      if (!el) return
      const to = e.relatedTarget as Element | null
      if (to && el.contains(to)) return // déplacement entre enfants du même élément
      dismiss()
    }
    const onFocus = (e: FocusEvent): void => {
      const el = (e.target as Element | null)?.closest('[data-tip]') as HTMLElement | null
      if (!el?.matches(':focus-visible')) return // clic souris : pas d'infobulle
      dismiss()
      show(el, true)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('pointerover', onOver)
    window.addEventListener('pointerout', onOut)
    window.addEventListener('focusin', onFocus)
    window.addEventListener('focusout', dismiss)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerout', onOut)
      window.removeEventListener('focusin', onFocus)
      window.removeEventListener('focusout', dismiss)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // Position mesurée après rendu (comme le menu contextuel) : jamais coupée,
  // jamais au-dessus de sa cible si la place manque au-dessus.
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    if (!tip || !tip.target.isConnected) {
      setTip(null)
      return
    }
    const r = tip.target.getBoundingClientRect()
    const w = box.offsetWidth
    const h = box.offsetHeight
    const above = r.top - GAP - h >= EDGE
    const y = above ? r.top - GAP - h : Math.min(r.bottom + GAP, window.innerHeight - h - EDGE)
    const x = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - EDGE))
    box.style.left = `${x}px`
    box.style.top = `${y}px`
  }, [tip])

  if (!tip) return null
  return (
    <div ref={boxRef} className="tip" role="tooltip" style={{ left: -9999, top: 0 }}>
      <span className="tip-text">{tip.text}</span>
      {tip.shortcut && <kbd className="tip-key">{tip.shortcut}</kbd>}
    </div>
  )
}
