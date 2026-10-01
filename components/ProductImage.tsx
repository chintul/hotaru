'use client'

import { Image as IKImage } from '@imagekit/next'

const IK_ENDPOINT = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT

const hueOf = (text: string) => {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

function placeholderTone(seed = '') {
  const h = hueOf(seed)
  return `hsl(${(h % 40) + 20} 12% ${88 - (h % 7)}%)`
}

export function swatchTone(name: string | null | undefined): string {
  return `hsl(${hueOf(name ?? '')} 38% 72%)`
}

export interface ProductImageProps {
  filePath?: string | null
  alt?: string | null
  seed?: string
  className?: string
  sizes?: string
  priority?: boolean
  width?: number
  height?: number
}

export default function ProductImage({
  filePath,
  alt = '',
  seed = '',
  className = '',
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  priority = false,
  width,
  height,
}: ProductImageProps) {
  const fixed = Boolean(width && height)

  if (!IK_ENDPOINT || !filePath) {
    const label = (alt || seed || '').trim().charAt(0).toUpperCase()
    return (
      <div
        className={`ph flex items-center justify-center ${fixed ? '' : 'h-full w-full'} ${className}`}
        style={{
          background: placeholderTone(seed || alt || ''),
          ...(fixed ? { width, height } : null),
        }}
        aria-label={alt || undefined}
        role={alt ? 'img' : 'presentation'}
      >
        {!fixed && <span className="label text-ink-faint select-none">{label || '—'}</span>}
      </div>
    )
  }

  if (width && height) {
    const retinaScale = 2
    return (
      <IKImage
        urlEndpoint={IK_ENDPOINT}
        src={filePath}
        alt={alt ?? ''}
        width={width}
        height={height}
        transformation={[{ width: width * retinaScale, height: height * retinaScale, quality: 80, crop: 'maintain_ratio' }]}
        className={`object-cover ${className}`}
      />
    )
  }

  return (
    <IKImage
      urlEndpoint={IK_ENDPOINT}
      src={filePath}
      alt={alt ?? ''}
      fill
      sizes={sizes}
      priority={priority}
      transformation={[{ quality: 82 }]}
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
