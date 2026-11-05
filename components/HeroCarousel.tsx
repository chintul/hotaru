'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import ProductImage from './ProductImage'
import { useT } from '@/lib/i18n'

export interface HeroSlide {
  id: string
  imagePath?: string | null
  mobileImagePath?: string | null
  label: string
  labelEn?: string
  metaEn?: string | null
  meta?: string | null
  href: string
}

const ADVANCE_MS = 6000
const SWIPE_PX = 40

export default function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0)
  const t = useT()
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
  const name = (slide: HeroSlide) => t(slide.label, slide.labelEn ?? slide.label)

  return (
    <section
      className="studio-hero"
      aria-roledescription="carousel"
      aria-label={t('Онцлох цуглуулгууд', 'Featured collections')}
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
            aria-label={name(slide)}
            aria-hidden={i !== current}
            tabIndex={i === current ? 0 : -1}
            draggable={false}
            className="campaign-frame"
            data-active={i === current}
          >
            {slide.mobileImagePath ? (
              <>
                <span className="absolute inset-0 landscape:hidden">
                  <ProductImage filePath={slide.mobileImagePath} alt="" seed={slide.id} priority={i === 0} sizes="100vw" />
                </span>
                {slide.imagePath ? (
                  <span className="absolute inset-0 hidden landscape:block">
                    <ProductImage filePath={slide.imagePath} alt="" seed={slide.id} sizes="100vw" />
                  </span>
                ) : (
                  <span className="cover-poster absolute inset-0 hidden landscape:block">
                    <span className="cover-poster-backdrop">
                      <ProductImage filePath={slide.mobileImagePath} alt="" seed={slide.id} sizes="320px" />
                    </span>
                    <span className="cover-poster-photo">
                      <ProductImage filePath={slide.mobileImagePath} alt="" seed={slide.id} priority={i === 0} sizes="(min-width: 1024px) 50vw, 70vw" />
                    </span>
                  </span>
                )}
              </>
            ) : (
              <ProductImage
                filePath={slide.imagePath}
                alt=""
                seed={slide.id}
                priority={i === 0}
                sizes="100vw"
                className="object-[74%_50%] sm:object-center"
              />
            )}
          </Link>
        ))}
        {count > 1 && <span key={`${current}-${paused}`} className="campaign-progress" data-paused={paused} aria-hidden />}
      </div>

      <div className="campaign-controls">
        <Link href={active.href} className="campaign-caption">
          <span className="campaign-caption-name">{name(active)}</span>
          {active.meta && <span className="campaign-caption-meta">{t(active.meta, active.metaEn ?? active.meta)}</span>}
        </Link>
        {count > 1 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={t(`${slide.label} — ${i + 1}-р зураг`, `${name(slide)}, image ${i + 1}`)}
                  aria-pressed={current === i}
                  className="campaign-dot"
                  onClick={() => go(i)}
                >
                  <span />
                </button>
              ))}
            </div>
            <div className="hidden gap-1 sm:flex">
              <button className="round-arrow" type="button" aria-label={t('Өмнөх зураг', 'Previous image')} onClick={() => go(current - 1)}>
                <ArrowLeft size={17} />
              </button>
              <button className="round-arrow" type="button" aria-label={t('Дараах зураг', 'Next image')} onClick={() => go(current + 1)}>
                <ArrowRight size={17} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
