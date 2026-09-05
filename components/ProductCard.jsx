'use client'

import Link from 'next/link'
import { useState } from 'react'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'

/**
 * Deterministic swatch colour from the option name.
 *
 * The reference puts a tiny product photo inside each swatch. We do not have
 * per-variant photography yet, so the name is hashed into a stable hue — the
 * same colour every render, and distinct enough to tell options apart.
 */
function swatchTone(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 38% 72%)`
}

export default function ProductCard({ product, priority = false }) {
  const c = copy(product)
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const [active, setActive] = useState(0)

  const variant = variants[active] ?? variants[0]
  // Each variant carries its own photo (variants.image_id), so hovering a
  // swatch shows that colourway rather than a generic second shot. Falls back
  // to the product gallery for products whose variants have no image.
  const primaryImage = variant?.image ?? images[0]
  const hoverImage = images.find((i) => i.filePath !== primaryImage?.filePath) ?? images[1]
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
          {hoverImage && (
            <div className="media-hover absolute inset-0 opacity-0">
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
          <p className="line-clamp-2 text-[14px] leading-snug hover:underline underline-offset-4">
            {c.title}
          </p>
        </Link>
        <p className="mt-1.5 text-[15px] font-bold">
          {ranged ? <span className="mr-1 text-[12px] font-normal text-ink-soft">эхлэх үнэ</span> : null}
          {formatMnt(min)}
        </p>

        {variants.length > 1 && (
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {variants.slice(0, 5).map((v, i) => (
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
                <span
                  className="block h-[22px] w-[22px] rounded-full"
                  style={{ background: swatchTone(v.optionValue) }}
                />
              </button>
            ))}
            {variants.length > 5 && (
              <span className="grid h-[30px] place-items-center px-1 text-[12px] text-ink-soft">
                +{variants.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
