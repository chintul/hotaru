'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n'

const PX_PER_SECOND = 22
const RESUME_AFTER_MS = 2500

export default function ProductRail({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLUListElement>(null)
  const copy = useRef<HTMLUListElement>(null)
  const heldUntil = useRef(0)
  const t = useT()

  const loopWidth = () => (copy.current?.offsetLeft ?? 0) - (first.current?.offsetLeft ?? 0)

  useEffect(() => {
    const el = track.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let last = performance.now()
    let pos = el.scrollLeft
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const loop = loopWidth()
      if (now < heldUntil.current || document.hidden || loop <= el.clientWidth / 2) {
        pos = el.scrollLeft
      } else {
        pos += (PX_PER_SECOND * dt) / 1000
        if (pos >= loop) pos -= loop
        el.scrollLeft = pos
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const hold = (ms: number) => () => {
    heldUntil.current = performance.now() + ms
  }

  const move = (direction: number) => {
    const el = track.current
    if (!el) return
    hold(RESUME_AFTER_MS)()
    const loop = loopWidth()
    if (direction < 0 && el.scrollLeft < el.clientWidth && loop > 0) el.scrollLeft += loop
    if (direction > 0 && el.scrollLeft + el.clientWidth * 1.8 > el.scrollWidth && loop > 0) el.scrollLeft -= loop
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: instant ? 'instant' : 'smooth' })
  }

  return (
    <div className="mx-auto mt-6 max-w-350 px-5 lg:px-8">
      <div
        ref={track}
        className="product-rail-track"
        onPointerEnter={hold(Number.POSITIVE_INFINITY)}
        onPointerDown={hold(Number.POSITIVE_INFINITY)}
        onPointerLeave={hold(RESUME_AFTER_MS)}
        onPointerUp={hold(RESUME_AFTER_MS)}
        onPointerCancel={hold(RESUME_AFTER_MS)}
        onWheel={hold(RESUME_AFTER_MS)}
        onFocusCapture={hold(Number.POSITIVE_INFINITY)}
        onBlurCapture={hold(RESUME_AFTER_MS)}
      >
        <ul ref={first} className="product-rail-list">{children}</ul>
        <ul ref={copy} aria-hidden inert className="product-rail-list">{children}</ul>
      </div>
      <div className="mt-4 hidden justify-end gap-2 sm:flex">
        <button type="button" className="round-arrow" onClick={() => move(-1)} aria-label={t('Өмнөх бараанууд', 'Previous products')}>
          <ArrowLeft size={18} />
        </button>
        <button type="button" className="round-arrow" onClick={() => move(1)} aria-label={t('Дараагийн бараанууд', 'Next products')}>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
