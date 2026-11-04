'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProductImage from './ProductImage'

export interface HeroSlide {
  id: string
  imagePath?: string | null
  label: string
  href: string
}

const ADVANCE_MS = 6000

export default function HeroCarousel({ slides, className = '' }: { slides: HeroSlide[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [held, setHeld] = useState(false)
  const [hovered, setHovered] = useState(false)

  const goTo = (i: number) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    if (slides.length < 2 || held || hovered) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      const el = track.current
      if (!el || document.hidden) return
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [slides.length, held, hovered])

  if (!slides.length) return null

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Онцлох"
      className={`relative bg-shade ${className}`}
      onPointerDown={() => setHeld(true)}
      onFocusCapture={() => setHeld(true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={track}
        className="snap-track"
        onScroll={(e) => {
          const el = e.currentTarget
          setCurrent(Math.round(el.scrollLeft / el.clientWidth))
        }}
      >
        {slides.map((s, i) => (
          <Link
            key={s.id}
            href={s.href}
            aria-roledescription="slide"
            aria-label={`${s.label} — ${i + 1} / ${slides.length}`}
            aria-hidden={i !== current}
            tabIndex={i === current ? 0 : -1}
            className="block aspect-[2/1] sm:aspect-[3/1]"
          >
            <ProductImage
              filePath={s.imagePath}
              alt=""
              seed={s.id}
              priority={i === 0}
              sizes="100vw"
              className="object-[74%_50%] sm:object-center"
            />
          </Link>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center gap-1 sm:bottom-3">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${s.label} — ${i + 1}-р слайд`}
              aria-current={i === current}
              className="grid h-11 w-8 place-items-center"
            >
              <span
                className={`block h-1.5 rounded-full bg-paper shadow-[0_0_3px_rgb(23_35_46/0.5)] transition-[width,opacity] duration-(--dur) ease-(--ease) ${
                  i === current ? 'w-7 opacity-100' : 'w-1.5 opacity-60'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
