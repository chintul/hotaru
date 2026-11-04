import { safeQuery } from "@/lib/apollo/safeQuery";
import {
  CATALOG_PAGE,
  FEATURED_PRODUCTS,
  HERO,
  HERO_CATEGORIES,
  NEW_ARRIVALS,
} from "@/lib/queries";
import { firstNode, nodes } from "@/lib/format";
import { paymentCopy } from "@/lib/payment-copy";
import HeroCarousel, { type HeroSlide } from "@/components/HeroCarousel";
import NewArrivalsRail from "@/components/NewArrivalsRail";
import ProductGrid from "@/components/ProductGrid";
import SectionHeading from "@/components/SectionHeading";
import type {
  Category,
  Connection,
  Product,
  StoreSettings,
} from "@/lib/types";

interface ProductListData {
  productCollection: Connection<Product> | null;
}

interface HeroData {
  storeSettingsCollection: Connection<StoreSettings> | null;
}

interface HeroCategoriesData {
  categoryCollection: Connection<Category> | null;
}

function coverSlides(data: HeroCategoriesData | null): HeroSlide[] {
  return nodes(data?.categoryCollection)
    .filter(
      (c) => c.heroImagePath && (c.productCollection?.totalCount ?? 0) > 0,
    )
    .sort((a, b) =>
      (firstNode(b.productCollection)?.createdAt ?? "").localeCompare(
        firstNode(a.productCollection)?.createdAt ?? "",
      ),
    )
    .map((category) => ({
      id: `category-${category.slug}`,
      imagePath: category.heroImagePath,
      label:
        firstNode(category.categoryTranslationCollection)?.name ??
        category.slug,
      href: `/shop?c=${category.slug}`,
    }));
}

export const revalidate = 60;

export default async function HomePage() {
  const [
    { data: featuredData, error },
    { data: newData },
    { data: heroData },
    { data: heroCategoriesData },
    { data: catalogData },
  ] = await Promise.all([
    safeQuery<ProductListData>(FEATURED_PRODUCTS),
    safeQuery<ProductListData>(NEW_ARRIVALS, { first: 12 }),
    safeQuery<HeroData>(HERO),
    safeQuery<HeroCategoriesData>(HERO_CATEGORIES),
    safeQuery<ProductListData>(CATALOG_PAGE, { first: 8 }),
  ]);
  const pay = await paymentCopy();

  const hero: StoreSettings = firstNode(heroData?.storeSettingsCollection) ?? {};

  const featuredOnly = nodes(featuredData?.productCollection);
  const featured = featuredOnly.length
    ? featuredOnly
    : nodes(catalogData?.productCollection);
  const covers = coverSlides(heroCategoriesData);
  const slides: HeroSlide[] = covers.length
    ? covers
    : hero.heroImagePath
      ? [
          {
            id: "store",
            imagePath: hero.heroImagePath,
            label: hero.heroHeadline || "hotaru.mn",
            href: hero.heroCtaHref ?? "/shop",
          },
        ]
      : [];

  return (
    <>
      <h1 className="sr-only">
        {hero.heroHeadline || "hotaru.mn — өдөр бүрийг гэрэлтүүлэх зүйлс"}
      </h1>
      <HeroCarousel slides={slides} className="-mt-14 lg:-mt-[72px]" />

      <NewArrivalsRail products={nodes(newData?.productCollection)} />

      <section className="mx-auto max-w-350 px-5 py-14 lg:px-8">
        <SectionHeading
          title={featuredOnly.length ? "Онцлох бүтээгдэхүүн" : "Бүх бараа"}
          href="/shop"
        />
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

      <section className="border-y border-line bg-shade">
        <div className="mx-auto grid max-w-350 gap-8 px-5 py-12 text-center sm:grid-cols-3 lg:px-8">
          {[
            ["Хурдан хүргэлт", "Улаанбаатар хотод ажлын 1–2 хоногт"],
            pay.tile,
            ["Баталгаат чанар", "Гэмтэлтэй бараа 100% солино"],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="mt-1.5 text-xs text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
