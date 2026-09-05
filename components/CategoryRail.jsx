import Link from 'next/link'
import { firstNode, nodes } from '@/lib/format'
import ProductImage from './ProductImage'

/**
 * Category shortcuts under the hero. Circular tiles carrying each category's
 * own photograph; the tinted-initial fallback stays for a category that has
 * no image yet, so an empty tile never looks broken.
 */
export default function CategoryRail({ categories }) {
  const items = nodes(categories)
  if (!items.length) return null

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-12 lg:px-8">
      <ul className="grid grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-8">
        {items.map((c) => {
          const name = firstNode(c.categoryTranslationCollection)?.name ?? c.slug
          return (
            <li key={c.id} className="text-center">
              <Link href={`/shop?c=${c.slug}`} className="group inline-flex flex-col items-center gap-3">
                <span className="relative block h-[92px] w-[92px] overflow-hidden rounded-full bg-shade transition-transform duration-300 group-hover:scale-105">
                  <ProductImage filePath={c.imagePath} alt="" seed={c.slug} sizes="92px" />
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
