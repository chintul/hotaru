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
}) {
  const usable = IK_ENDPOINT && filePath

  if (!usable) {
    const label = (alt || seed || '').trim().charAt(0).toUpperCase()
    return (
      <div
        className={`ph flex h-full w-full items-center justify-center ${className}`}
        style={{ background: placeholderTone(seed || alt) }}
        aria-label={alt || undefined}
        role={alt ? 'img' : 'presentation'}
      >
        <span className="label text-ink-faint select-none">{label || '—'}</span>
      </div>
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
