import Link from 'next/link'
import { Unbounded } from 'next/font/google'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import { unitPriceOf } from '@/lib/preorder'
import type { Product } from '@/lib/types'
import AutoScroller from './AutoScroller'
import ProductImage from './ProductImage'

const display = Unbounded({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  display: 'swap',
})

const TAGS = [
  'bg-blush text-blush-ink',
  'bg-cream text-cream-ink',
  'bg-mint text-mint-ink',
  'bg-sky text-sky-ink',
]

function fromPrice(product: Product): number {
  const prices = nodes(product.variantCollection).map((v) => unitPriceOf(v, 1))
  return prices.length ? Math.min(...prices) : toNumber(product.minPriceMnt)
}

export default function NewArrivalsRail({ products }: { products: Product[] }) {
  if (!products.length) return null

  return (
    <section aria-labelledby="new-arrivals-title" className="bg-primary py-7 text-primary-on lg:py-9">
      <div className="mx-auto flex max-w-350 items-baseline justify-between gap-6 px-5 lg:px-8">
        <h2
          id="new-arrivals-title"
          className={`${display.className} text-[clamp(1.3rem,4.5vw,2rem)] font-extrabold lowercase leading-none tracking-[-0.03em]`}
        >
          шинээр ирсэн
        </h2>
        <Link href="/shop?sort=newest" className="link-underline tap shrink-0 text-[13px] font-semibold">
          Бүгдийг үзэх
        </Link>
      </div>

      <AutoScroller className="mt-5 px-5 py-1 lg:px-8">
        {products.map((p, i) => {
          const c = copy(p)
          const image = nodes(p.productImageCollection)[0]
          return (
            <li key={p.id ?? p.slug} className="w-[148px] shrink-0 sm:w-[172px] lg:w-[196px]">
              <Link
                href={`/shop/${p.slug}`}
                className="block rounded-2xl bg-paper p-1 text-ink transition-transform duration-(--dur) ease-(--ease) hover:-translate-y-1"
              >
                <span className="relative block aspect-square overflow-hidden rounded-xl bg-shade">
                  <ProductImage
                    filePath={image?.filePath}
                    alt={image?.alt || c.title || p.slug}
                    seed={p.slug}
                    sizes="196px"
                  />
                </span>
                <span className="flex flex-col gap-1 px-1.5 pb-1.5 pt-2">
                  <span className="line-clamp-1 text-[12px] font-semibold">{c.title ?? p.slug}</span>
                  <span
                    className={`self-start rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${TAGS[i % TAGS.length]}`}
                  >
                    {formatMnt(fromPrice(p))}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </AutoScroller>
    </section>
  )
}
