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
