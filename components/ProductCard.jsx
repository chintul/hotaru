'use client'

import Link from 'next/link'
import { useState } from 'react'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { useCanHover } from './useCanHover'

/**
 * Deterministic swatch colour from the option name.
 *
 * Only a fallback now. Every variant carries its own photo, so a swatch shows
 * the actual colourway as the reference does; this hue is what a variant with
 * no image of its own gets, and it stays stable across renders.
 */
function swatchTone(name) {
  // `= ''` only covers undefined. option_value is nullable — a product with one
  // option-less variant stores null — and null sailed past the default straight
  // into null.length. The call sites already wrote `v.optionValue ?? ''` for
  // title and aria-label; this one was missed, and it crashed the whole page.
  const text = String(name ?? '')
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return `hsl(${h} 38% 72%)`
}

// Four fit one row at the narrowest card we render (2-up at 390px). A fifth
// wrapped, which pushed the swatch row onto two lines and made neighbouring
// cards different heights.
const MAX_SWATCHES = 4

export default function ProductCard({ product, priority = false }) {
  const c = copy(product)
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const [active, setActive] = useState(0)
  // On a phone the preview can never be seen, and it was half of every card's
  // image payload: 27 cards were downloading 53 pictures at 390px wide.
  const canHover = useCanHover()

  const variant = variants[active] ?? variants[0]

  // Each variant carries its own photo (variants.image_id).
  const primaryImage = variant?.image ?? images[0]

  // Hovering the card previews the NEXT variant, cycling from whichever swatch
  // is currently active — not a fixed second photo. Variants can share an image
  // (a product with five colourways but three photos reuses the last), so walk
  // forward until the picture actually differs; otherwise the hover looks dead.
  const nextVariant = (() => {
    for (let step = 1; step < variants.length; step++) {
      const candidate = variants[(active + step) % variants.length]
      if (candidate?.image?.filePath && candidate.image.filePath !== primaryImage?.filePath) {
        return candidate
      }
    }
    return null
  })()

  // No label on the preview: the reference's photography already has the
  // variant name burned into the image, so ours would just print it twice.
  const hoverImage =
    nextVariant?.image ?? images.find((i) => i.filePath !== primaryImage?.filePath) ?? null
  const min = toNumber(product.minPriceMnt)
  const max = toNumber(product.maxPriceMnt)
  const ranged = max > min

  return (
    <div className="group">
      <Link href={`/shop/${product.slug}`} className="block">
        <div className="card-media relative aspect-square overflow-hidden bg-shade">
          <div className="media-primary absolute inset-0">
            <ProductImage
              filePath={primaryImage?.filePath}
              alt={primaryImage?.alt || c.title || product.slug}
              seed={product.slug}
              priority={priority}
            />
          </div>
          {canHover && hoverImage && (
            <div className="media-hover absolute inset-0">
              <ProductImage
                filePath={hoverImage.filePath}
                alt={hoverImage.alt || c.title || product.slug}
                seed={`${product.slug}-2`}
              />
            </div>
          )}

          {/* Variant pill. Suppressed when real photography exists: the
              reference's own images already have this badge baked in, and two
              stacked pills read as a bug. */}
          {variant?.optionValue && !primaryImage?.filePath && (
            <span
              className="badge-pill absolute left-3 top-3"
              style={{ background: swatchTone(variant.optionValue) }}
            >
              <span className="badge-knob">◍</span>
              {variant.optionValue}
            </span>
          )}

          {!product.inStock && (
            <span className="absolute right-3 top-3 bg-paper/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.6px]">
              Дууссан
            </span>
          )}
        </div>
      </Link>

      <div className="mt-3 text-center">
        <Link href={`/shop/${product.slug}`} className="block">
          {/* Reserve both lines whether or not the title needs them, so the
              price and swatch rows line up across a row of cards instead of
              stepping up and down with title length. */}
          <p className="line-clamp-2 min-h-[2.75em] text-[14px] leading-snug hover:underline underline-offset-4">
            {c.title}
          </p>
        </Link>
        <p className="mt-1.5 text-[15px] font-bold">
          {ranged ? <span className="mr-1 text-[12px] font-normal text-ink-soft">эхлэх үнэ</span> : null}
          {formatMnt(min)}
        </p>

        {variants.length > 1 && (
          <div className="mt-2.5 flex justify-center gap-1.5">
            {variants.slice(0, MAX_SWATCHES).map((v, i) => (
              <button
                key={v.id}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                data-active={i === active}
                className="swatch"
                title={v.optionValue ?? ''}
                aria-label={v.optionValue ?? 'Сонголт'}
              >
                {/* The reference shows the colourway itself, not an abstract
                    dot — which is the only way to tell "Cream White" from
                    "Cream Pink" at a glance. */}
                <span className="block h-[22px] w-[22px] overflow-hidden rounded-full bg-shade">
                  {v.image?.filePath ? (
                    <ProductImage
                      filePath={v.image.filePath}
                      alt=""
                      width={22}
                      height={22}
                      className="h-full w-full"
                    />
                  ) : (
                    <span
                      className="block h-full w-full"
                      style={{ background: swatchTone(v.optionValue) }}
                    />
                  )}
                </span>
              </button>
            ))}
            {variants.length > MAX_SWATCHES && (
              <span className="grid h-[30px] place-items-center px-1 text-[12px] text-ink-soft">
                +{variants.length - MAX_SWATCHES}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
