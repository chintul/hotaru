import Link from 'next/link'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { CATALOG_BY_CATEGORY, CATALOG_PAGE, NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'

export const revalidate = 60

export async function generateMetadata({ searchParams }) {
  const { c } = await searchParams
  if (!c) return { title: 'Дэлгүүр' }
  const { data } = await safeQuery(CATALOG_BY_CATEGORY, { slug: c })
  const cat = nodes(data?.categoryCollection)[0]
  const name = firstNode(cat?.categoryTranslationCollection)?.name
  return { title: name ?? 'Дэлгүүр' }
}

export default async function ShopPage({ searchParams }) {
  // Next 16: searchParams is a Promise.
  const { c: slug } = await searchParams

  const [{ data: navData }, { data, error }] = await Promise.all([
    safeQuery(NAV_CATEGORIES),
    slug
      ? safeQuery(CATALOG_BY_CATEGORY, { slug, first: 24 })
      : safeQuery(CATALOG_PAGE, { first: 24 }),
  ])

  const categories = nodes(navData?.categoryCollection)
  const category = slug ? nodes(data?.categoryCollection)[0] : null
  const connection = slug ? category?.productCollection : data?.productCollection
  const products = nodes(connection)
  const total = connection?.totalCount ?? 0
  const heading = slug
    ? firstNode(category?.categoryTranslationCollection)?.name ?? 'Дэлгүүр'
    : 'Дэлгүүр'
  const blurb = slug ? firstNode(category?.categoryTranslationCollection)?.description : null

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <div className="border-b border-line pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="display text-[clamp(1.8rem,4vw,3rem)]">{heading}</h1>
          {!error && <span className="label shrink-0 text-ink-faint">{total} бүтээгдэхүүн</span>}
        </div>
        {blurb && <p className="mt-2 max-w-lg text-ink-soft">{blurb}</p>}
      </div>

      {/* Category rail. Reads from the database, so it never drifts from the nav. */}
      {categories.length > 0 && (
        <nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href="/shop"
            className={`label link-underline ${slug ? 'text-ink-faint' : 'text-ink'}`}
          >
            Бүгд
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/shop?c=${cat.slug}`}
              className={`label link-underline ${cat.slug === slug ? 'text-ink' : 'text-ink-faint'}`}
            >
              {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-10">
        {error ? (
          <div className="border border-line bg-paper-warm px-5 py-16 text-center">
            <p className="text-ink-soft">Каталог ачаалж чадсангүй.</p>
            <p className="label mt-2 text-ink-faint">Өгөгдлийн сангийн холболтыг шалгана уу.</p>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  )
}
