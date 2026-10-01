import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { PRODUCT_DETAIL, PRODUCT_SLUGS } from '@/lib/queries'
import { copy as productCopy, firstNode, nodes } from '@/lib/format'
import ProductDetailClient from '@/components/ProductDetailClient'
import ReviewForm, { Stars } from '@/components/ReviewForm'
import { paymentCopy } from '@/lib/payment-copy'
import type { Connection, Product } from '@/lib/types'

interface ProductData {
  productCollection: Connection<Product & { id: string }> | null
}

export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  const { data } = await safeQuery<ProductData>(PRODUCT_SLUGS)
  return nodes(data?.productCollection).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps<'/shop/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const { data } = await safeQuery<ProductData>(PRODUCT_DETAIL, { slug })
  const product = firstNode(data?.productCollection)
  if (!product) return { title: 'Бүтээгдэхүүн' }
  const c = productCopy(product)
  return {
    title: c.seoTitle ?? c.title,
    description: c.seoDescription ?? c.description ?? c.subtitle ?? undefined,
  }
}

export default async function ProductPage({ params }: PageProps<'/shop/[slug]'>) {
  const { slug } = await params
  const [{ data, error }, pay] = await Promise.all([
    safeQuery<ProductData>(PRODUCT_DETAIL, { slug }),
    paymentCopy(),
  ])
  const product = firstNode(data?.productCollection)

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
    <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
      <nav className="mb-6 text-[12px] text-ink-faint">
        <Link href="/" className="tap hover:text-ink">Нүүр</Link>
        <span className="px-2">/</span>
        <Link href="/shop" className="tap hover:text-ink">Дэлгүүр</Link>
        <span className="px-2">/</span>
        <span className="text-ink">{productCopy(product).title}</span>
      </nav>
      <ProductDetailClient product={product} copy={productCopy(product)} payNote={pay.long} />

      <section className="mt-20 border-t border-line pt-12">
        <h2 className="section-title uppercase">
          Сэтгэгдэл{reviews.length > 0 ? ` (${product.reviewCollection?.totalCount})` : ''}
        </h2>

        <div className="mx-auto mt-8 grid max-w-[900px] gap-10 lg:max-w-none lg:grid-cols-[1fr_380px]">
          <div>
            {reviews.length > 0 ? (
              <ul className="grid gap-8 sm:grid-cols-2">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <Stars value={r.rating} />
                    {r.title && <p className="mt-1 font-medium">{r.title}</p>}
                    {r.body && <p className="mt-1 text-ink-soft">{r.body}</p>}
                    {r.isVerifiedPurchase && <p className="label mt-1 text-ink-faint">Баталгаажсан худалдан авалт</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft">
                Одоогоор сэтгэгдэл алга. Хамгийн түрүүнд бичээрэй.
              </p>
            )}
          </div>

          <ReviewForm productId={product.id} slug={slug} />
        </div>
      </section>
    </div>
  )
}
