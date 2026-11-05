'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import ProductImage from './ProductImage'

export interface HeroSlide {
  id: string
  imagePath?: string | null
  label: string
  meta?: string | null
  href: string
}

const ADVANCE_MS = 6000
const SWIPE_PX = 40

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipeStart = useRef<number | null>(null)
  const swiped = useRef(false)
  const count = slides.length

  const go = (i: number) => setCurrent(((i % count) + count) % count)

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setTimeout(() => {
      if (!document.hidden) setCurrent((c) => (c + 1) % count)
    }, ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [count, paused, current])

  if (!count) return null
  const active = slides[current] ?? slides[0]

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Онцлох цуглуулгууд"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        className="campaign-stage"
        onPointerDown={(e) => {
          swiped.current = false
          swipeStart.current = e.pointerType === 'mouse' ? null : e.clientX
        }}
        onPointerUp={(e) => {
          if (swipeStart.current === null || count < 2) return
          const dx = e.clientX - swipeStart.current
          swipeStart.current = null
          if (Math.abs(dx) < SWIPE_PX) return
          swiped.current = true
          go(current + (dx < 0 ? 1 : -1))
        }}
        onClickCapture={(e) => {
          if (swiped.current) {
            e.preventDefault()
            swiped.current = false
          }
        }}
      >
        {slides.map((slide, i) => (
          <Link
            key={slide.id}
            href={slide.href}
            aria-label={slide.label}
            aria-hidden={i !== current}
            tabIndex={i === current ? 0 : -1}
            draggable={false}
            className="campaign-frame"
            data-active={i === current}
          >
            <ProductImage
              filePath={slide.imagePath}
              alt=""
              seed={slide.id}
              priority={i === 0}
              sizes="100vw"
              className="object-[74%_50%] sm:object-center"
            />
          </Link>
        ))}
      </div>

      <div className="campaign-controls">
        <Link href={active.href} className="campaign-caption">
          <span className="campaign-caption-name">{active.label}</span>
          {active.meta && <span className="campaign-caption-meta">{active.meta}</span>}
        </Link>
        {count > 1 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`${slide.label} — ${i + 1}-р зураг`}
                  aria-pressed={current === i}
                  className="campaign-dot"
                  onClick={() => go(i)}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="hidden gap-1 sm:flex">
              <button className="round-arrow" type="button" aria-label="Өмнөх зураг" onClick={() => go(current - 1)}>
                <ArrowLeft size={17} />
              </button>
              <button className="round-arrow" type="button" aria-label="Дараах зураг" onClick={() => go(current + 1)}>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
