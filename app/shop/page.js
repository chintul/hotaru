import { safeQuery } from '@/lib/apollo/safeQuery'
import { CATALOG_PAGE } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'

export const revalidate = 60
export const metadata = { title: 'Дэлгүүр' }

export default async function ShopPage() {
  const { data, error } = await safeQuery(CATALOG_PAGE, { first: 24 })
  const products = nodes(data?.productCollection)
  const total = data?.productCollection?.totalCount ?? 0

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
      <div className="mb-10 flex items-baseline justify-between border-b border-line pb-5">
        <h1 className="display text-[clamp(1.8rem,4vw,3rem)]">Дэлгүүр</h1>
        {!error && <span className="label text-ink-faint">{total} бүтээгдэхүүн</span>}
      </div>

      {error ? (
        <div className="border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">Каталог ачаалж чадсангүй.</p>
          <p className="label mt-2 text-ink-faint">Өгөгдлийн сангийн холболтыг шалгана уу.</p>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  )
}
