'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const RESUME_AFTER_MS = 2500

export default function AutoScroller({
  children,
  pxPerSecond = 28,
  className = '',
}: {
  children: ReactNode
  pxPerSecond?: number
  className?: string
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const first = useRef<HTMLUListElement>(null)
  const copy = useRef<HTMLUListElement>(null)
  const heldUntil = useRef(0)

  useEffect(() => {
    const el = viewport.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let last = performance.now()
    let pos = el.scrollLeft
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const loop = (copy.current?.offsetLeft ?? 0) - (first.current?.offsetLeft ?? 0)
      if (now < heldUntil.current || document.hidden || loop <= el.clientWidth / 2) {
        pos = el.scrollLeft
      } else {
        pos += (pxPerSecond * dt) / 1000
        if (pos >= loop) pos -= loop
        el.scrollLeft = pos
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [pxPerSecond])

  const hold = (ms: number) => () => {
    heldUntil.current = performance.now() + ms
  }

  return (
    <div
      ref={viewport}
      className={`snap-none overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      onPointerEnter={hold(Number.POSITIVE_INFINITY)}
      onPointerDown={hold(Number.POSITIVE_INFINITY)}
      onPointerLeave={hold(RESUME_AFTER_MS)}
      onPointerUp={hold(RESUME_AFTER_MS)}
      onWheel={hold(RESUME_AFTER_MS)}
      onFocusCapture={hold(Number.POSITIVE_INFINITY)}
      onBlurCapture={hold(RESUME_AFTER_MS)}
    >
      <div className="flex w-max gap-3 lg:gap-4">
        <ul ref={first} className="flex gap-3 lg:gap-4">{children}</ul>
        <ul ref={copy} aria-hidden inert className="flex gap-3 lg:gap-4">{children}</ul>
      </div>
    </div>
  )
}
