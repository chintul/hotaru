import Link from 'next/link'
import { notFound } from 'next/navigation'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { PRODUCT_DETAIL, PRODUCT_SLUGS } from '@/lib/queries'
import { copy as productCopy, nodes } from '@/lib/format'
import ProductDetailClient from '@/components/ProductDetailClient'
import ReviewForm, { Stars } from '@/components/ReviewForm'
import { paymentCopy } from '@/lib/payment-copy'

export const revalidate = 60

/**
 * Prerender the catalog at build time.
 *
 * Without this the route is rendered per request, and a product page cannot
 * answer faster than the round trip to Supabase in Tokyo — measured at 856ms
 * TTFB against a local production build, all of it spent before the shopper
 * sees anything. With it the HTML is already on disk and ISR keeps it fresh on
 * the same 60s window the fetch cache already used.
 *
 * dynamicParams stays at its default (true), so a product added after the build
 * still renders on demand and is cached from then on — nothing 404s.
 */
export async function generateStaticParams() {
  const { data } = await safeQuery(PRODUCT_SLUGS)
  return nodes(data?.productCollection).map((p) => ({ slug: p.slug }))
}

// Next 16: params is a Promise and must be awaited.
export async function generateMetadata({ params }) {
  const { slug } = await params
  const { data } = await safeQuery(PRODUCT_DETAIL, { slug })
  const product = nodes(data?.productCollection)[0]
  if (!product) return { title: 'Бүтээгдэхүүн' }
  const c = productCopy(product)
  // seo_* are the fields written for search results; title/subtitle are what
  // the page itself shows. Fall back so a product with no SEO copy still gets
  // a sensible tag rather than nothing.
  return {
    title: c.seoTitle ?? c.title,
    description: c.seoDescription ?? c.description ?? c.subtitle ?? undefined,
  }
}

export default async function ProductPage({ params }) {
  const { slug } = await params
  // Independent reads, so they go together. Awaiting one then the other put a
  // second round trip on the critical path for no reason.
  const [{ data, error }, pay] = await Promise.all([
    safeQuery(PRODUCT_DETAIL, { slug }),
    paymentCopy(),
  ])
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
    <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
      <nav className="mb-6 text-[12px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Нүүр</Link>
        <span className="px-2">/</span>
        <Link href="/shop" className="hover:text-ink">Дэлгүүр</Link>
        <span className="px-2">/</span>
        <span className="text-ink">{productCopy(product).title}</span>
      </nav>
      <ProductDetailClient product={product} copy={productCopy(product)} payNote={pay.long} />

      {/* The whole section used to be hidden until a product already had a
          review, which also hid the only way to write one — nobody could leave
          the first. The list still collapses when empty; the form does not.

          This page is server-rendered with the anon key and revalidates, so a
          just-submitted review will not appear in the list below: it is
          unapproved, and only its author may read it. The form says so itself
          rather than leaving the customer to wonder. */}
      <section className="mt-20 border-t border-line pt-12">
        <h2 className="section-title uppercase">
          Сэтгэгдэл{reviews.length > 0 ? ` (${product.reviewCollection.totalCount})` : ''}
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
