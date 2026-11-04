'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProductImage from './ProductImage'

export interface HeroSlide {
  id: string
  imagePath?: string | null
  wide?: boolean
  kicker?: string | null
  headline: string
  ctaLabel: string
  href: string
}

const ADVANCE_MS = 6000

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
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

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Онцлох"
      className="relative overflow-hidden bg-[#c98a5b]"
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
        {slides.map((s, i) => {
          const Heading = i === 0 ? 'h1' : 'h2'
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
              aria-hidden={i !== current}
              inert={i !== current}
            >
              {s.imagePath && (
                <div className="absolute inset-0">
                  <ProductImage
                    filePath={s.imagePath}
                    alt=""
                    seed={s.id}
                    priority={i === 0}
                    sizes="100vw"
                    className={s.wide ? 'object-[74%_50%] lg:object-center' : ''}
                  />
                </div>
              )}
              <div className="relative mx-auto flex min-h-110 max-w-350 items-end px-5 pb-16 pt-16 lg:min-h-130 lg:items-center lg:px-8 lg:pb-20">
                <div className={`max-w-130 bg-paper/92 px-6 py-6 backdrop-blur-[2px] sm:px-8 sm:py-9 lg:px-10 lg:py-11 ${i === 0 ? 'fade-up' : ''}`}>
                  {s.kicker && (
                    <p className="text-xs font-semibold uppercase tracking-[1.2px] text-ink-soft">{s.kicker}</p>
                  )}
                  <Heading className="mt-2 text-[clamp(1.8rem,4vw,3rem)] empty:hidden sm:mt-3 font-bold leading-[1.1] tracking-[-.01em] text-ink">
                    {s.headline}
                  </Heading>
                  <Link
                    href={s.href}
                    className="mt-5 inline-block bg-primary-strong sm:mt-7 px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.7px] text-on-primary transition-opacity hover:opacity-85"
                  >
                    {s.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}-р слайд`}
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
