import Link from 'next/link'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'

/**
 * Catalog card. The hover swap is the signature interaction of this layout:
 * image at position 0 is the card, position 1 is the alternate. When a product
 * only has one image the card simply does not swap, which is why the second
 * layer is conditional rather than a duplicate.
 */
export default function ProductCard({ product, priority = false }) {
  const c = copy(product)
  const images = nodes(product.productImageCollection)
  const primary = images[0]
  const hover = images[1]
  const min = toNumber(product.minPriceMnt)
  const max = toNumber(product.maxPriceMnt)
  const ranged = max > min

  return (
    <Link href={`/shop/${product.slug}`} className="group block">
      <div className="card-media relative aspect-[3/4] overflow-hidden bg-paper-warm">
        <div className="media-primary absolute inset-0">
          <ProductImage
            filePath={primary?.filePath}
            alt={primary?.alt || c.title || product.slug}
            seed={product.slug}
            priority={priority}
          />
        </div>
        {hover && (
          <div className="media-hover absolute inset-0 opacity-0">
            <ProductImage
              filePath={hover.filePath}
              alt={hover.alt || c.title || product.slug}
              seed={`${product.slug}-2`}
            />
          </div>
        )}
        {!product.inStock && (
          <span className="label absolute left-3 top-3 bg-paper/95 px-2 py-1 text-ink-soft">
            Дууссан
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="truncate font-medium group-hover:underline underline-offset-4">{c.title}</p>
        {c.subtitle && <p className="label mt-0.5 truncate text-ink-faint">{c.subtitle}</p>}
        <p className="mt-1 tabular-nums text-ink-soft">
          {ranged ? `${formatMnt(min)} – ${formatMnt(max)}` : formatMnt(min)}
        </p>
      </div>
    </Link>
  )
}
