import Link from 'next/link'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { FEATURED_PRODUCTS } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'

export const revalidate = 60

export default async function HomePage() {
  const { data, error } = await safeQuery(FEATURED_PRODUCTS)
  const products = nodes(data?.productCollection)

  return (
    <>
      {/* Editorial opener: type-led rather than a stock hero image, which is
          the honest choice until real photography exists. */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1400px] px-5 py-24 sm:px-8 sm:py-32">
          <p className="label fade-up text-ink-faint">Шинэ цуглуулга</p>
          <h1 className="display fade-up mt-5 max-w-3xl text-[clamp(2.4rem,7vw,5.5rem)]">
            Энгийн хэлбэр,<br />өдөр бүрийн гоёл.
          </h1>
          <p className="fade-up mt-6 max-w-md text-ink-soft">
            Гар аргаар хийсэн мөнгөн эдлэл. Хязгаарлагдмал тоогоор.
          </p>
          <Link
            href="/shop"
            className="label fade-up mt-10 inline-block border-b border-ink pb-1 transition-opacity hover:opacity-60"
          >
            Дэлгүүр үзэх
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="label">Онцлох</h2>
          <Link href="/shop" className="label link-underline text-ink-soft">Бүгдийг үзэх</Link>
        </div>

        {error ? (
          <div className="border border-line bg-paper-warm px-5 py-10 text-center">
            <p className="text-ink-soft">Бүтээгдэхүүн ачаалж чадсангүй.</p>
            <p className="label mt-2 text-ink-faint">
              Өгөгдлийн сан холбогдоогүй байна — `supabase db push` ажиллуулна уу.
            </p>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </section>
    </>
  )
}
