import Link from 'next/link'
import { firstNode, nodes } from '@/lib/format'

// Stable tint per category so the rail looks designed rather than random.
const TONES = ['#e8c9a0', '#c9d8c5', '#d8c3d9', '#f0c9c2', '#c5d3e8', '#e8dfc0', '#d5cdc2']

/**
 * Row of category shortcuts under the hero, mirroring the reference's icon
 * strip. Their version uses illustrated silhouettes; until we have artwork,
 * each tile is a tinted circle carrying the category initial.
 */
export default function CategoryRail({ categories }) {
  const items = nodes(categories)
  if (!items.length) return null

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-12 lg:px-8">
      <ul className="grid grid-cols-3 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((c, i) => {
          const name = firstNode(c.categoryTranslationCollection)?.name ?? c.slug
          return (
            <li key={c.id} className="text-center">
              <Link href={`/shop?c=${c.slug}`} className="group inline-flex flex-col items-center gap-3">
                <span
                  className="grid h-[86px] w-[86px] place-items-center rounded-full text-[30px] font-bold text-white/90 transition-transform duration-300 group-hover:scale-105"
                  style={{ background: TONES[i % TONES.length] }}
                >
                  {name.charAt(0)}
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
