import Link from 'next/link'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { CATALOG_PAGE, FEATURED_PRODUCTS, NAV_CATEGORIES } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductGrid from '@/components/ProductGrid'
import SectionHeading from '@/components/SectionHeading'
import CategoryRail from '@/components/CategoryRail'

export const revalidate = 60

export default async function HomePage() {
  const [{ data: featuredData, error }, { data: navData }, { data: allData }] = await Promise.all([
    safeQuery(FEATURED_PRODUCTS),
    safeQuery(NAV_CATEGORIES),
    safeQuery(CATALOG_PAGE, { first: 8 }),
  ])

  const featured = nodes(featuredData?.productCollection)
  const latest = nodes(allData?.productCollection)

  return (
    <>
      {/* Full-bleed hero. The reference runs a photographic carousel here; this
          is the same footprint and type scale, built to work before the
          photography exists and to take an image the moment it does. */}
      <section className="relative overflow-hidden bg-[#c98a5b]">
        <div className="mx-auto flex min-h-[420px] max-w-[1400px] flex-col items-center justify-center px-5 py-24 text-center lg:min-h-[540px] lg:px-8">
          <p className="fade-up text-[13px] font-semibold uppercase tracking-[1.2px] text-white/80">
            2026 намрын цуглуулга
          </p>
          <h1 className="fade-up mt-4 max-w-3xl text-[clamp(2.2rem,6vw,4.5rem)] font-bold leading-[1.05] text-white">
            Өдөр бүрийг<br />гэрэлтүүлэх зүйлс
          </h1>
          <Link
            href="/shop"
            className="fade-up mt-9 bg-white px-9 py-4 text-[13px] font-bold uppercase tracking-[0.7px] text-ink-strong transition-opacity hover:opacity-90"
          >
            Дэлгүүр үзэх
          </Link>
        </div>
      </section>

      <CategoryRail categories={navData?.categoryCollection} />

      <section className="mx-auto max-w-[1400px] px-5 pb-8 lg:px-8">
        <SectionHeading title="Онцлох бүтээгдэхүүн" href="/shop" />
        {error ? (
          <div className="border border-line bg-shade px-5 py-14 text-center">
            <p className="text-ink-soft">Бүтээгдэхүүн ачаалж чадсангүй.</p>
            <p className="mt-2 text-[13px] text-ink-faint">
              Өгөгдлийн сан холбогдоогүй байна — <code>supabase db push</code>.
            </p>
          </div>
        ) : (
          <ProductGrid products={featured} />
        )}
      </section>

      {latest.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-5 py-14 lg:px-8">
          <SectionHeading title="Шинээр нэмэгдсэн" href="/shop" />
          <ProductGrid products={latest} />
        </section>
      )}

      {/* Service strip, the reassurance row the reference runs above the footer. */}
      <section className="border-y border-line bg-shade">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-12 text-center sm:grid-cols-3 lg:px-8">
          {[
            ['Хурдан хүргэлт', 'Улаанбаатар хотод ажлын 1–2 хоногт'],
            ['Дансаар төлөх', 'Захиалга өгсний дараа дансны мэдээлэл'],
            ['Баталгаат чанар', 'Гэмтэлтэй бараа 100% солино'],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="text-[15px] font-bold">{title}</h3>
              <p className="mt-1.5 text-[13px] text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
