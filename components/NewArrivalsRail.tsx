import Link from 'next/link'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import { unitPriceOf } from '@/lib/preorder'
import type { Product } from '@/lib/types'
import ProductRail from './ProductRail'
import ProductImage from './ProductImage'

function fromPrice(product: Product): number {
  const prices = nodes(product.variantCollection).map((v) => unitPriceOf(v, 1))
  return prices.length ? Math.min(...prices) : toNumber(product.minPriceMnt)
}

export default function NewArrivalsRail({ products }: { products: Product[] }) {
  if (!products.length) return null

  return (
    <section aria-labelledby="new-arrivals-title" className="pb-4 pt-10 lg:pb-6 lg:pt-14">
      <div className="fashion-section-heading mx-auto max-w-350 px-5 lg:px-8">
        <h2 id="new-arrivals-title">Шинэ ирэлт<span className="fashion-heading-dot" aria-hidden="true">.</span></h2>
        <Link href="/shop?sort=newest">Бүгдийг үзэх</Link>
      </div>

      <ProductRail>
        {products.map((p) => {
          const c = copy(p)
          const image = nodes(p.productImageCollection)[0]
          return (
            <li key={p.id ?? p.slug} className="arrival-item w-[165px] shrink-0 sm:w-[220px] lg:w-[250px]">
              <Link
                href={`/shop/${p.slug}`}
                className="arrival-card block text-ink"
              >
                <span className="arrival-media relative block aspect-square overflow-hidden rounded-2xl bg-shade">
                  <ProductImage
                    filePath={image?.filePath}
                    alt={image?.alt || c.title || p.slug}
                    seed={p.slug}
                    sizes="(min-width: 1024px) 250px, (min-width: 640px) 220px, 165px"
                  />
                </span>
                <span className="flex flex-col gap-1.5 px-1 pb-2 pt-2.5">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug sm:text-[14px]">{c.title ?? p.slug}</span>
                  <span
                    className="arrival-price text-[14px] font-semibold tabular-nums"
                  >
                    {formatMnt(fromPrice(p))}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ProductRail>
    </section>
  )
}
