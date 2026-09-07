import { Suspense } from 'react'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { CATALOG_FILTERED, NAV_CATEGORIES } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'
import ShopFilters from '@/components/ShopFilters'
import ShopToolbar from '@/components/ShopToolbar'

export const revalidate = 60

const ORDER_BY = {
  featured: [{ position: 'AscNullsLast' }],
  'price-asc': [{ minPriceMnt: 'AscNullsLast' }],
  'price-desc': [{ minPriceMnt: 'DescNullsLast' }],
  newest: [{ publishedAt: 'DescNullsLast' }],
}

export async function generateMetadata({ searchParams }) {
  const { c } = await searchParams
  if (!c) return { title: 'Дэлгүүр' }
  const { data } = await safeQuery(NAV_CATEGORIES)
  const cat = nodes(data?.categoryCollection).find((x) => x.slug === c)
  return { title: firstNode(cat?.categoryTranslationCollection)?.name ?? 'Дэлгүүр' }
}

export default async function ShopPage({ searchParams }) {
  const sp = await searchParams
  const { data: navData } = await safeQuery(NAV_CATEGORIES)
  const categoryNodes = nodes(navData?.categoryCollection)
  const categories = categoryNodes.map((c) => ({
    slug: c.slug,
    label: firstNode(c.categoryTranslationCollection)?.name ?? c.slug,
  }))

  // Build the pg_graphql filter from URL params. Only `active` is unconditional
  // — the storefront must never surface a draft.
  const filter = { status: { eq: 'active' } }

  const category = categoryNodes.find((c) => c.slug === sp.c)
  if (category) filter.categoryId = { eq: category.id }
  if (sp.stock === 'in') filter.inStock = { eq: true }
  if (sp.stock === 'out') filter.inStock = { eq: false }
  const min = Number(sp.min)
  const max = Number(sp.max)
  if (sp.min && !Number.isNaN(min)) filter.minPriceMnt = { ...filter.minPriceMnt, gte: String(min) }
  if (sp.max && !Number.isNaN(max)) filter.minPriceMnt = { ...filter.minPriceMnt, lte: String(max) }

  const orderBy = ORDER_BY[sp.sort] ?? ORDER_BY.featured
  const cols = [2, 3, 4].includes(Number(sp.cols)) ? Number(sp.cols) : 4

  const [{ data, error }, { data: countsData }] = await Promise.all([
    safeQuery(CATALOG_FILTERED, { first: 48, filter, orderBy }),
    safeQuery(CATALOG_FILTERED, { first: 1, filter: { status: { eq: 'active' }, inStock: { eq: true } } }),
  ])

  const products = nodes(data?.productCollection)
  const total = data?.productCollection?.totalCount ?? 0
  const inStock = countsData?.productCollection?.totalCount ?? 0

  const heading = category
    ? firstNode(category.categoryTranslationCollection)?.name ?? 'Дэлгүүр'
    : 'Бүх бүтээгдэхүүн'
  const blurb = category ? firstNode(category.categoryTranslationCollection)?.description : null

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="section-title uppercase">{heading}</h1>
        {blurb && <p className="mx-auto mt-2 max-w-xl text-[13px] text-ink-soft">{blurb}</p>}
      </div>

      {/* gap-4 below lg, not gap-10: on a phone the sidebar is now a single
          filter bar, and 40px of air between it and the grid was pushing the
          photographs down again. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-12">
        <Suspense fallback={<div className="w-full lg:w-[230px]" />}>
          <ShopFilters
            categories={categories}
            counts={{ inStock, outOfStock: Math.max(total - inStock, 0) }}
          />
        </Suspense>

        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <ShopToolbar total={total} cols={cols} />
          </Suspense>

          {error ? (
            <div className="border border-line bg-shade px-5 py-16 text-center">
              <p className="text-ink-soft">Каталог ачаалж чадсангүй.</p>
            </div>
          ) : (
            <ProductGrid products={products} cols={cols} />
          )}
        </div>
      </div>
    </div>
  )
}
