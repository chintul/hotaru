import Link from 'next/link'
import { Unbounded } from 'next/font/google'
import { copy, formatMnt, nodes, toNumber } from '@/lib/format'
import { unitPriceOf } from '@/lib/preorder'
import type { Product } from '@/lib/types'
import ProductImage from './ProductImage'

const display = Unbounded({
  subsets: ['cyrillic', 'cyrillic-ext', 'latin'],
  display: 'swap',
})

const TILTS = ['-3deg', '2deg', '-1.5deg', '2.5deg', '-2deg']
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
    <section aria-labelledby="new-arrivals-title" className="overflow-hidden bg-primary text-primary-on">
      <div className="mx-auto flex max-w-350 items-baseline justify-between gap-6 px-5 pt-8 lg:px-8 lg:pt-10">
        <h2
          id="new-arrivals-title"
          className={`${display.className} text-[clamp(1.6rem,6vw,2.75rem)] font-extrabold lowercase leading-none tracking-[-0.03em]`}
        >
          шинээр ирсэн
        </h2>
        <Link href="/shop?sort=newest" className="link-underline tap shrink-0 text-[13px] font-semibold">
          Бүгдийг үзэх
        </Link>
      </div>

      <ul className="snap-track mx-auto max-w-350 scroll-px-5 gap-3 px-5 pb-9 pt-6 lg:scroll-px-8 lg:gap-4 lg:px-8 [&>*]:basis-[42%] sm:[&>*]:basis-[24%] lg:[&>*]:basis-[15%]">
        {products.map((p, i) => {
          const c = copy(p)
          const image = nodes(p.productImageCollection)[0]
          return (
            <li key={p.id ?? p.slug}>
              <Link
                href={`/shop/${p.slug}`}
                style={{ rotate: TILTS[i % TILTS.length] }}
                className="block rounded-[18px] bg-paper p-1 text-ink shadow-[0_14px_28px_-16px_rgb(0_0_0/0.55)] transition-[rotate,translate] duration-(--dur) ease-(--ease) hover:-translate-y-1 hover:rotate-0! focus-visible:rotate-0!"
              >
                <span className="relative block aspect-square overflow-hidden rounded-[14px] bg-shade">
                  <ProductImage
                    filePath={image?.filePath}
                    alt={image?.alt || c.title || p.slug}
                    seed={p.slug}
                    sizes="(min-width: 1024px) 15vw, (min-width: 640px) 24vw, 42vw"
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
      </ul>
    </section>
  )
}
