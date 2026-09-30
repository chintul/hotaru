# Components — shared UI primitives (storefront)

Stack: **Next.js 16.3.4 App Router, React 19, JavaScript (no TypeScript), Tailwind v4**.
There is no `ui/` primitives directory and no component library (no shadcn/MUI/Radix).
Primitives are **CSS component classes** declared in `app/globals.css` under `@layer components`
(`.btn-solid`, `.btn-outline`, `.nav-link`, `.label`, `.icon-btn`, `.swatch`, `.card-media`, `.auth-input`, `.tap`)
plus the React components below. `@/*` maps to the repo root.

## Icons
- Source: `components/Icons.jsx`
- Inline SVG icon set; every icon inherits currentColor. No icon package.

```jsx
/**
 * Inline SVG icon set matching the reference storefront's header and controls.
 * Inline rather than an icon package: eight icons do not justify a dependency,
 * and these inherit currentColor so they work on both the light header and the
 * dark footer without a second variant.
 */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const IconSearch = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </svg>
)

export const IconUser = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
  </svg>
)

export const IconHeart = ({ filled = false, ...p }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} fill={filled ? 'currentColor' : 'none'} {...p}>
    <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z" />
  </svg>
)

export const IconBag = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

export const IconChevronLeft = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="m14 6-6 6 6 6" /></svg>
)
export const IconChevronRight = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="m10 6 6 6-6 6" /></svg>
)
export const IconChevronDown = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconMinus = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="M5 12h14" /></svg>
)
export const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconArrowUp = (p) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...base} {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
)
export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
)
export const IconShare = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" />
    <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
  </svg>
)
export const IconGrid = ({ cols = 3, ...p }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    {Array.from({ length: cols }).map((_, i) => (
      <rect key={i} x={2 + i * (20 / cols)} y="4" width={20 / cols - 2} height="16" rx="1" />
    ))}
  </svg>
)

/* Order pages. Same 1.6px stroke as the rest so they sit next to IconBag
   without looking borrowed. */
export const IconQr = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <path d="M14 14h3v3h-3zM20 14v1M14 20h3M20 19v2" />
  </svg>
)
export const IconBank = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <path d="M3 9.5 12 4l9 5.5M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18" />
  </svg>
)
export const IconCopy = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h8" />
  </svg>
)
export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}><path d="m5 12.5 4.5 4.5L19 7" /></svg>
)
export const IconClock = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" />
  </svg>
)
export const IconTruck = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M3 16V6.5h11V16M14 9.5h3.6L21 13v3h-3" />
    <circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />
  </svg>
)

/* Social marks. Filled rather than stroked, because a brand glyph at 18px
   reads as a smudge in 1.6px outline. */
export const IconFacebook = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6A21 21 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8z" />
  </svg>
)
export const IconInstagram = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.6" />
    <circle cx="16.9" cy="7.1" r="1.05" fill="currentColor" stroke="none" />
  </svg>
)
export const IconMail = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.8 7 8.2 6 8.2-6" />
  </svg>
)
export const IconPhone = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M6.2 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.4 6.4l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2Z" />
  </svg>
)
export const IconPin = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...base} {...p}>
    <path d="M12 21s7-5.2 7-10.4A7 7 0 0 0 5 10.6C5 15.8 12 21 12 21Z" /><circle cx="12" cy="10.5" r="2.6" />
  </svg>
)

/* Theme toggle. Both render at once; .theme-icon in globals.css picks one. */
export const IconSun = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4" />
  </svg>
)

export const IconMoon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...base} {...p}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" />
  </svg>
)
```

## Logo
- Source: `components/Logo.jsx`
- Wordmark. Two <img> tags, CSS shows the one matching the theme.

```jsx
export default function Logo({ className = "" }) {
  return (
    <>
      <img
        src="/logo.png"
        alt="hotaru"
        width={1474}
        height={240}
        className={`logo-light ${className}`}
      />
      <img
        src="/logo-white.png"
        alt="hotaru"
        width={1523}
        height={240}
        className={`logo-dark ${className}`}
      />
    </>
  );
}
```

## ProductImage
- Source: `components/ProductImage.jsx`
- ImageKit <Image> wrapper with a deterministic slug-seeded tinted placeholder.

```jsx
'use client'

import { Image as IKImage } from '@imagekit/next'

const IK_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

/**
 * Product imagery.
 *
 * ImageKit ships its own <Image>, so next/image is not used anywhere in this
 * project (transformations happen at ImageKit, which also keeps us off Vercel's
 * image-optimisation quota).
 *
 * Until real photography and ImageKit keys exist, this renders a deterministic
 * tinted placeholder instead of a broken image. It is derived from the product
 * slug, so a given product always gets the same tone and the grid looks
 * composed rather than accidental.
 */
function placeholderTone(seed = '') {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  // Narrow band of desaturated warm greys — reads as art direction, not error.
  return `hsl(${(h % 40) + 20} 12% ${88 - (h % 7)}%)`
}

export default function ProductImage({
  filePath,
  alt = '',
  seed = '',
  className = '',
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  priority = false,
  // Fixed-size mode. `fill` needs a positioned ancestor and stretches to it,
  // which is wrong for a swatch: those are tiny, numerous, and sit in normal
  // flow. Passing a width asks ImageKit for a thumbnail that small instead of
  // downloading the full 1080px product shot once per swatch.
  width,
  height,
}) {
  const usable = IK_ENDPOINT && filePath
  const fixed = Boolean(width && height)

  if (!usable) {
    const label = (alt || seed || '').trim().charAt(0).toUpperCase()
    return (
      <div
        className={`ph flex items-center justify-center ${fixed ? '' : 'h-full w-full'} ${className}`}
        style={{
          background: placeholderTone(seed || alt),
          ...(fixed ? { width, height } : null),
        }}
        aria-label={alt || undefined}
        role={alt ? 'img' : 'presentation'}
      >
        {!fixed && <span className="label text-ink-faint select-none">{label || '—'}</span>}
      </div>
    )
  }

  if (fixed) {
    return (
      <IKImage
        urlEndpoint={IK_ENDPOINT}
        src={filePath}
        alt={alt}
        width={width}
        height={height}
        // Ask for 2x so the thumbnail stays crisp on retina.
        transformation={[{ width: width * 2, height: height * 2, quality: 80, crop: 'maintain_ratio' }]}
        className={`object-cover ${className}`}
      />
    )
  }

  return (
    <IKImage
      urlEndpoint={IK_ENDPOINT}
      src={filePath}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      transformation={[{ quality: 82 }]}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
```

## ProductCard
- Source: `components/ProductCard.jsx`
- Catalogue card: image, title, price, colourway swatch row.

```jsx
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

  // Carry the chosen colourway to the product page. Tapping Berry on a card
  // and then the photo used to open on Cream White, because the link dropped
  // the choice and the PDP defaults to variants[0] — so the swatch row cost 58
  // tap targets on this grid and recorded nothing. Only added once the shopper
  // has actually moved off the default, so the common URL stays clean and
  // matches the prerendered one.
  const href = active > 0 && variant?.id
    ? `/shop/${product.slug}?v=${variant.id}`
    : `/shop/${product.slug}`

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
      <Link href={href} className="block">
        <div className="card-media relative aspect-square overflow-hidden bg-shade">
          <div className="media-primary absolute inset-0">
            {/* The default sizes claims 100vw below 640px, but the grid is
                grid-cols-2 at EVERY width (ProductGrid.jsx:9), so each card
                fills half the viewport. The browser was told to fetch roughly
                twice the linear dimension it renders: measured 390px natural
                for a 158px slot on a 390px phone. On mobile data, over a
                27-card grid, that is the difference between a grid that paints
                while the impulse lasts and one that does not. */}
            <ProductImage
              filePath={primaryImage?.filePath}
              alt={primaryImage?.alt || c.title || product.slug}
              seed={product.slug}
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
          </div>
          {canHover && hoverImage && (
            <div className="media-hover absolute inset-0">
              <ProductImage
                filePath={hoverImage.filePath}
                alt={hoverImage.alt || c.title || product.slug}
                seed={`${product.slug}-2`}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
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
        <Link href={href} className="block">
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
```

## ProductGrid
- Source: `components/ProductGrid.jsx`
- Responsive product grid; resolves to 2 columns below md.

```jsx
import Link from 'next/link'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, cols = 4, emptyMessage = 'Бүтээгдэхүүн олдсонгүй.' }) {
  if (!products?.length) {
    // Was a grey sentence and nothing else. On a phone the filters that
    // produced the empty result are now behind a sheet, so the way out has to
    // be here rather than 800px up the page.
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{emptyMessage}</p>
        <p className="mt-1 text-[13px] text-ink-faint">Шүүлтүүрээ өөрчилж үзнэ үү.</p>
        <Link href="/shop" className="label link-underline mt-5 inline-block">
          Бүх бүтээгдэхүүн харах
        </Link>
      </div>
    )
  }
  const grid =
    cols === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  return (
    <div className={`grid gap-x-5 gap-y-12 ${grid}`}>
      {products.map((p, i) => (
        <div key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  )
}
```

## SectionHeading
- Source: `components/SectionHeading.jsx`
- Centred uppercase section title with an underlined "view all".

```jsx
import Link from 'next/link'

/** Centred uppercase heading with a small underlined "View all" beneath it. */
export default function SectionHeading({ title, href, cta = 'Бүгдийг үзэх' }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="section-title uppercase">{title}</h2>
      {href && (
        <Link href={href} className="link-underline mt-2 inline-block text-[13px] text-ink">
          {cta}
        </Link>
      )}
    </div>
  )
}
```

## CategoryRail
- Source: `components/CategoryRail.jsx`
- Horizontally scrolling category entry points.

```jsx
import Link from 'next/link'
import { firstNode, nodes } from '@/lib/format'
import ProductImage from './ProductImage'

/**
 * Category shortcuts under the hero. Circular tiles carrying each category's
 * own photograph; the tinted-initial fallback stays for a category that has
 * no image yet, so an empty tile never looks broken.
 */
export default function CategoryRail({ categories }) {
  const items = nodes(categories)
  if (!items.length) return null

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-12 lg:px-8">
      <ul className="grid grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((c) => {
          const name = firstNode(c.categoryTranslationCollection)?.name ?? c.slug
          return (
            <li key={c.id} className="text-center">
              <Link href={`/shop?c=${c.slug}`} className="group inline-flex flex-col items-center gap-3">
                <span className="relative block h-[92px] w-[92px] overflow-hidden rounded-full bg-shade transition-transform duration-300 group-hover:scale-105">
                  <ProductImage filePath={c.imagePath} alt="" seed={c.slug} sizes="92px" />
                </span>
                <span className="text-[13px] font-semibold">{name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

## ThemeToggle
- Source: `components/ThemeToggle.jsx`
- Light/dark icon button; both icons in the DOM, CSS picks one.

```jsx
'use client'

import { useTheme } from './ThemeProvider'
import { IconMoon, IconSun } from './Icons'

/**
 * Both icons sit in the DOM and CSS hides one (`.theme-icon-*` in globals.css),
 * so the right one shows before hydration. `resolved` only drives the label.
 */
export default function ThemeToggle() {
  const { resolved, toggle } = useTheme()

  const label = resolved === 'dark' ? 'Цайвар байдалд шилжих' : 'Бараан байдалд шилжих'

  return (
    <button onClick={toggle} className="icon-btn" aria-label={label} title={label}>
      <IconSun className="theme-icon theme-icon-sun" aria-hidden="true" />
      <IconMoon className="theme-icon theme-icon-moon" aria-hidden="true" />
    </button>
  )
}
```

## NewsletterForm
- Source: `components/NewsletterForm.jsx`
- Footer email capture.

```jsx
'use client'

import { useState } from 'react'

/**
 * Footer newsletter signup.
 *
 * A plain form POST would navigate the visitor away from whatever they were
 * reading to render a bare JSON response. Submitting stays on the page and
 * answers in place.
 */
export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [message, setMessage] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setMessage('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setMessage(body?.error ?? 'Илгээж чадсангүй.')
        return
      }
      setState('done')
      setMessage('Баярлалаа! Бүртгэгдлээ.')
      setEmail('')
    } catch {
      setState('error')
      setMessage('Сүлжээний алдаа. Дахин оролдоно уу.')
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-4 border border-white/25 px-3 py-3 text-[13px] text-white/80" role="status">
        {message}
      </p>
    )
  }

  return (
    <form className="mt-4" onSubmit={onSubmit} noValidate>
      <div className="flex">
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Имэйл хаяг"
          aria-label="Имэйл хаяг"
          aria-invalid={state === 'error' || undefined}
          className="min-w-0 flex-1 border border-white/25 bg-transparent px-3 py-3 text-[13px] placeholder:text-white/40 focus:border-white focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="bg-white px-5 py-3 text-[13px] font-bold uppercase tracking-[0.7px] text-footer transition-opacity disabled:opacity-60"
        >
          {state === 'sending' ? '…' : 'Илгээх'}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-[12px] text-white/70" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}
```

## BackToTop
- Source: `components/BackToTop.jsx`
- Floating scroll-to-top control.

```jsx
'use client'

import { useEffect, useState } from 'react'
import { IconArrowUp } from './Icons'

/** Right-edge utility rail, same placement as the reference. */
export default function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 place-items-center border border-line bg-paper shadow-sm transition-colors hover:bg-shade md:grid"
      aria-label="Дээш"
    >
      <IconArrowUp />
    </button>
  )
}
```

## ShopToolbar
- Source: `components/ShopToolbar.jsx`
- Result count, column switcher (md+), sort select.

```jsx
'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { IconGrid } from './Icons'

const SORTS = [
  ['featured', 'Онцлох'],
  ['price-asc', 'Үнэ: багаас их'],
  ['price-desc', 'Үнэ: ихээс бага'],
  ['newest', 'Шинэ эхэндээ'],
]

export default function ShopToolbar({ total, cols }) {
  const router = useRouter()
  const params = useSearchParams()
  // Sorting is a server round trip. Without a pending state the control looks
  // ignored until the new page streams in, which on a slow connection is long
  // enough to click again.
  const [pending, startTransition] = useTransition()

  const set = (key, value) => {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-4 border-b border-line pb-4 transition-opacity duration-200 ${pending ? 'opacity-60' : ''}`}>
      {/* Hidden below md: ProductGrid resolves to grid-cols-2 at every width
          under md, so all three options produced an identical layout while
          each one cost a full server round trip. */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="text-[12px] uppercase tracking-[0.6px] text-ink-soft">Харах</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => set('cols', String(n))}
            aria-label={`${n} багана`}
            className={`grid h-8 w-8 place-items-center border ${
              cols === n ? 'border-ink text-ink' : 'border-line text-ink-faint hover:text-ink'
            }`}
          >
            <IconGrid cols={n} />
          </button>
        ))}
      </div>

      <span className="text-[13px] text-ink-soft">{total} бүтээгдэхүүн</span>

      <label className="ml-auto flex items-center gap-2">
        <span className="text-[12px] uppercase tracking-[0.6px] text-ink-soft">Эрэмбэлэх</span>
        <select
          value={params.get('sort') ?? 'featured'}
          onChange={(e) => set('sort', e.target.value)}
          className="min-h-11 border border-line px-3 py-2 text-[13px] focus:border-ink focus:outline-none sm:min-h-0"
        >
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    </div>
  )
}
```

## ShopFilters
- Source: `components/ShopFilters.jsx`
- Category / stock / price filter sheet.

```jsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconChevronDown, IconClose } from './Icons'
import { useUI } from './UIProvider'
import { useFocusTrap } from './useFocusTrap'

/**
 * Collection filters. Every control writes to the URL rather than local state,
 * so a filtered view is linkable, back/forward works, and the page stays
 * server-rendered.
 */
export default function ShopFilters({ categories, counts }) {
  const router = useRouter()
  const params = useSearchParams()

  // Same reason as the toolbar: every filter is a navigation, and an
  // unacknowledged checkbox invites a second click that queues a second
  // navigation.
  const [pending, startTransition] = useTransition()

  const setParam = (key, value) => {
    const next = new URLSearchParams(params.toString())
    if (value === null || value === '' || value === undefined) next.delete(key)
    else next.set(key, value)
    startTransition(() => router.push(`/shop?${next.toString()}`))
  }

  const activeCat = params.get('c')
  const stock = params.get('stock')
  // The sheet is an overlay like any other now. It used to keep its own
  // boolean and write document.body.style.overflow itself, which made it the
  // second owner of one global style — closing it released the scroll lock the
  // cart drawer was still relying on — and left it as the one surface Escape
  // could not dismiss, because it was outside UIProvider's set.
  const { isOpen, open: openOverlay, close: closeOverlay } = useUI()
  const sheetOpen = isOpen('filters')
  const sheetRef = useFocusTrap(sheetOpen)
  const [min, setMin] = useState(params.get('min') ?? '')
  const [max, setMax] = useState(params.get('max') ?? '')

  const activeCount = [activeCat, stock, params.get('min'), params.get('max')].filter(Boolean).length

  const body = (
    <>
      <Group title="Ангилал">
        <ul className="space-y-2.5">
          <li>
            <button
              onClick={() => setParam('c', null)}
              className={`text-[13px] ${!activeCat ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              Бүгд
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button
                onClick={() => setParam('c', c.slug)}
                className={`text-[13px] ${activeCat === c.slug ? 'font-semibold text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Нөөц">
        {[
          ['in', `Бэлэн (${counts.inStock})`],
          ['out', `Дууссан (${counts.outOfStock})`],
        ].map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={stock === value}
              onChange={(e) => setParam('stock', e.target.checked ? value : null)}
              className="h-4 w-4 accent-primary-strong"
            />
            {label}
          </label>
        ))}
      </Group>

      <Group title="Үнэ">
        <div className="flex items-center gap-2">
          <input
            value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="0"
            className="w-full border border-line px-2 py-2 text-[13px] focus:border-ink focus:outline-none"
          />
          <span className="text-ink-faint">—</span>
          <input
            value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="500000"
            className="w-full border border-line px-2 py-2 text-[13px] focus:border-ink focus:outline-none"
          />
        </div>
        <button
          onClick={() => {
            const next = new URLSearchParams(params.toString())
            min ? next.set('min', min) : next.delete('min')
            max ? next.set('max', max) : next.delete('max')
            startTransition(() => router.push(`/shop?${next.toString()}`))
          }}
          className="btn-solid mt-3 w-full py-2.5"
        >
          Шүүх
        </button>
      </Group>
    </>
  )

  return (
    <>
      {/* Below lg this entire sidebar used to stack ABOVE the grid, putting
          773px of filter chrome and 1.26 screens of scrolling in front of the
          first product photograph — on a page whose only job is showing
          photographs, for a shopper who arrives with nothing specific in mind.
          On a phone it collapses to this one bar; the filters live in a sheet. */}
      <div className="lg:hidden">
        <button
          onClick={() => openOverlay('filters')}
          className={`flex w-full items-center justify-between border border-line px-4 py-3 transition-opacity ${pending ? 'opacity-60' : ''}`}
        >
          <span className="nav-link text-[13px]">Шүүх</span>
          {activeCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink-strong px-1.5 text-[11px] font-semibold text-paper">
              {activeCount}
            </span>
          ) : (
            <IconChevronDown />
          )}
        </button>
      </div>

      <aside
        className={`hidden w-full shrink-0 transition-opacity duration-200 lg:block lg:w-[230px] ${
          pending ? 'opacity-60' : ''
        }`}
      >
        {body}
      </aside>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Шүүх">
          <button
            className="overlay-in absolute inset-0 bg-ink/25"
            onClick={closeOverlay}
            aria-label="Хаах"
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            className="sheet-in absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-paper outline-none"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="nav-link text-[14px]">Шүүх</span>
              <button onClick={closeOverlay} className="icon-btn -mr-2" aria-label="Хаах">
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5">{body}</div>
            <div className="border-t border-line px-5 py-4">
              <button onClick={closeOverlay} className="btn-solid w-full py-4">
                Үр дүнг харах
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Group({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-line py-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <span className="nav-link text-[13px]">{title}</span>
        <IconChevronDown className={`transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  )
}
```
