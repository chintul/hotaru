import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Product } from '@/lib/types'
import ProductCard from './ProductCard'
import { T } from '@/lib/i18n'

interface ProductGridProps {
  products?: Product[] | null
  cols?: number
  emptyMessage?: ReactNode
}

export default function ProductGrid({ products, cols = 4, emptyMessage }: ProductGridProps) {
  if (!products?.length) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">{emptyMessage ?? <T mn="Бүтээгдэхүүн олдсонгүй." en="No products found." />}</p>
        <p className="mt-1 text-[13px] text-ink-faint"><T mn="Шүүлтүүрээ өөрчилж үзнэ үү." en="Try changing your filters." /></p>
        <Link href="/shop" className="label link-underline mt-5 inline-block">
          <T mn="Бүх бүтээгдэхүүн харах" en="See all products" />
        </Link>
      </div>
    )
  }
  const grid =
    cols === 3
      ? 'grid-cols-2 md:grid-cols-3'
      : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  return (
    <div className={`grid gap-x-3 gap-y-9 sm:gap-x-5 sm:gap-y-12 ${grid}`}>
      {products.map((p, i) => (
        <div key={p.id} className="fade-up" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
    </div>
  )
}
