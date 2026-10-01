import Link from 'next/link'
import { firstNode, nodes } from '@/lib/format'
import type { Category, Connection } from '@/lib/types'
import ProductImage from './ProductImage'

interface CategoryRailProps {
  categories?: Connection<Category> | null
}

export default function CategoryRail({ categories }: CategoryRailProps) {
  const items = nodes(categories)
  if (!items.length) return null

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-12 lg:px-8">
      <ul className="grid grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((category) => {
          const name = firstNode(category.categoryTranslationCollection)?.name ?? category.slug
          return (
            <li key={category.id} className="text-center">
              <Link href={`/shop?c=${category.slug}`} className="group inline-flex flex-col items-center gap-3">
                <span className="relative block h-[92px] w-[92px] overflow-hidden rounded-full bg-shade transition-transform duration-300 group-hover:scale-105">
                  <ProductImage filePath={category.imagePath} alt="" seed={category.slug} sizes="92px" />
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
