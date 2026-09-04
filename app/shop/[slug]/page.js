import { notFound } from 'next/navigation'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { PRODUCT_DETAIL } from '@/lib/queries'
import { copy as productCopy, nodes } from '@/lib/format'
import ProductDetailClient from '@/components/ProductDetailClient'

export const revalidate = 60

// Next 16: params is a Promise and must be awaited.
export async function generateMetadata({ params }) {
  const { slug } = await params
  const { data } = await safeQuery(PRODUCT_DETAIL, { slug })
  const product = nodes(data?.productCollection)[0]
  if (!product) return { title: 'Бүтээгдэхүүн' }
  const c = productCopy(product)
  return { title: c.title, description: c.subtitle ?? undefined }
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  const { data, error } = await safeQuery(PRODUCT_DETAIL, { slug })
  const product = nodes(data?.productCollection)[0]

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] px-5 py-20 text-center sm:px-8">
        <p className="text-ink-soft">Бүтээгдэхүүн ачаалж чадсангүй.</p>
      </div>
    )
  }
  if (!product) notFound()

  const reviews = nodes(product.reviewCollection)

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8">
      <ProductDetailClient product={product} copy={productCopy(product)} />

      {/* Reviews section stays hidden until a product actually has one — an
          empty review block on a new store reads worse than none at all. */}
      {reviews.length > 0 && (
        <section className="mt-20 border-t border-line pt-10">
          <h2 className="label">Сэтгэгдэл ({product.reviewCollection.totalCount})</h2>
          <ul className="mt-6 grid gap-8 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id}>
                <p className="tabular-nums">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 text-ink-soft">{r.body}</p>}
                {r.isVerifiedPurchase && <p className="label mt-1 text-ink-faint">Баталгаажсан худалдан авалт</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
