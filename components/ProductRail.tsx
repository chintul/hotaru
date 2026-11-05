'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n'

export default function ProductRail({ children }: { children: ReactNode }) {
  const track = useRef<HTMLUListElement>(null)
  const t = useT()
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const move = (direction: number) => {
    const el = track.current
    if (!el) return
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: instant ? 'instant' : 'smooth' })
  }
  return (
    <div className="mx-auto mt-6 max-w-350 px-5 lg:px-8">
      <ul
        ref={track}
        className="product-rail-track"
        onScroll={(event) => {
          const el = event.currentTarget
          setAtStart(el.scrollLeft < 2)
          setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
        }}
      >
        {children}
      </ul>
      <div className="mt-4 hidden justify-end gap-2 sm:flex">
        <button type="button" className="round-arrow" onClick={() => move(-1)} disabled={atStart} aria-label={t('Өмнөх бараанууд', 'Previous products')}>
          <ArrowLeft size={18} />
        </button>
        <button type="button" className="round-arrow" onClick={() => move(1)} disabled={atEnd} aria-label={t('Дараагийн бараанууд', 'Next products')}>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
