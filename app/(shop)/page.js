import Link from 'next/link'
import { safeQuery } from '@/lib/apollo/safeQuery'
import { FEATURED_PRODUCTS, HERO, NAV_CATEGORIES, NEW_ARRIVALS } from '@/lib/queries'
import { firstNode, nodes } from '@/lib/format'
import { paymentCopy } from '@/lib/payment-copy'
import ProductImage from '@/components/ProductImage'
import ProductGrid from '@/components/ProductGrid'
import SectionHeading from '@/components/SectionHeading'
import CategoryRail from '@/components/CategoryRail'

export const revalidate = 60

export default async function HomePage() {
  const [{ data: featuredData, error }, { data: navData }, { data: newData }, { data: heroData }] =
    await Promise.all([
      safeQuery(FEATURED_PRODUCTS),
      safeQuery(NAV_CATEGORIES),
      safeQuery(NEW_ARRIVALS, { first: 8 }),
      safeQuery(HERO),
    ])
  const pay = await paymentCopy()

  const hero = firstNode(heroData?.storeSettingsCollection) ?? {}

  const featured = nodes(featuredData?.productCollection)
  const latest = nodes(newData?.productCollection)

  return (
    <>
      {/* Full-bleed hero. Image and copy come from store_settings so the owner
          runs a campaign from /admin rather than a deploy.

          The copy sits in its own translucent panel rather than free-floating
          over the photograph: a hero image gets swapped often, and text laid
          directly on an unknown picture is legible only by luck. The panel
          keeps contrast guaranteed whatever image lands here next. */}
      <section className="relative overflow-hidden bg-[#c98a5b]">
        {hero.heroImagePath && (
          <div className="absolute inset-0">
            <ProductImage
              filePath={hero.heroImagePath}
              alt={hero.heroHeadline ?? ''}
              seed="hero"
              priority
              sizes="100vw"
            />
          </div>
        )}

        <div className="relative mx-auto flex min-h-[380px] max-w-[1400px] items-center px-5 py-16 lg:min-h-[520px] lg:px-8">
          <div className="fade-up max-w-[520px] bg-paper/92 px-8 py-9 backdrop-blur-[2px] lg:px-10 lg:py-11">
            {hero.heroSubline && (
              <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-ink-soft">
                {hero.heroSubline}
              </p>
            )}
            <h1 className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-bold leading-[1.1] tracking-[-.01em] text-ink">
              {hero.heroHeadline ?? 'Өдөр бүрийг гэрэлтүүлэх зүйлс'}
            </h1>
            <Link
              href={hero.heroCtaHref ?? '/shop'}
              className="mt-7 inline-block bg-ink-strong px-8 py-3.5 text-[13px] font-bold uppercase tracking-[0.7px] text-white transition-opacity hover:opacity-85"
            >
              {hero.heroCtaLabel ?? 'Дэлгүүр үзэх'}
            </Link>
          </div>
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
            pay.tile,
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
