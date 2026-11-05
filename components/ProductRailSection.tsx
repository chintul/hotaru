import Link from 'next/link'
import type { ReactNode } from 'react'
import { T } from '@/lib/i18n'
import type { Product } from '@/lib/types'
import ProductCard from './ProductCard'
import ProductRail from './ProductRail'

const RAIL_CARD_SIZES = '(min-width: 1024px) 250px, (min-width: 640px) 220px, 168px'

export default function ProductRailSection({
  id,
  title,
  href,
  products,
}: {
  id: string
  title: ReactNode
  href: string
  products: Product[]
}) {
  if (!products.length) return null

  return (
    <section aria-labelledby={`${id}-title`} className="studio-arrivals pb-8 pt-10 lg:pb-12 lg:pt-14">
      <div className="fashion-section-heading mx-auto max-w-350 px-5 lg:px-8">
        <h2 id={`${id}-title`}>{title}</h2>
        <Link href={href}><T mn="Бүгдийг үзэх" en="See all" /></Link>
      </div>

      <ProductRail>
        {products.map((p) => (
          <li key={p.id ?? p.slug} className="arrival-item w-[168px] shrink-0 sm:w-[220px] lg:w-[250px]">
            <ProductCard product={p} swipe={false} sizes={RAIL_CARD_SIZES} />
          </li>
        ))}
      </ProductRail>
    </section>
  )
}
