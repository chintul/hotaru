'use client'

import { useEffect, useRef } from 'react'

const EASE = 0.06
const TRAIL = 22

export default function HeroFirefly({ className = '' }: { className?: string }) {
  const light = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = light.current
    const area = el?.parentElement
    if (!el || !area) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let x = 0
    let y = 0
    let tx = 0
    let ty = 0
    let frame = 0

    const tick = () => {
      x += (tx - x) * EASE
      y += (ty - y) * EASE
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.4 ? requestAnimationFrame(tick) : 0
    }
    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }
    const follow = (e: PointerEvent) => {
      const box = area.getBoundingClientRect()
      const px = Math.min(Math.max(e.clientX - box.left, 12), box.width - 12)
      const py = Math.min(Math.max(e.clientY - box.top, 12), box.height - 12)
      tx = px - el.offsetLeft - TRAIL
      ty = py - el.offsetTop - TRAIL
      run()
    }
    const rest = () => {
      tx = 0
      ty = 0
      run()
    }

    area.addEventListener('pointermove', follow, { passive: true })
    area.addEventListener('pointerdown', follow, { passive: true })
    area.addEventListener('pointerleave', rest)
    return () => {
      cancelAnimationFrame(frame)
      area.removeEventListener('pointermove', follow)
      area.removeEventListener('pointerdown', follow)
      area.removeEventListener('pointerleave', rest)
    }
  }, [])

  return <span ref={light} aria-hidden className={`hero-firefly ${className}`} />
}
