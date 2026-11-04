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

const CATEGORY_SLIDES = 4;

function categorySlides(data: HeroCategoriesData | null): HeroSlide[] {
  return nodes(data?.categoryCollection)
    .map((category) => {
      const newest = firstNode(category.productCollection);
      return {
        category,
        newest: newest?.createdAt ?? "",
        count: category.productCollection?.totalCount ?? 0,
        wide: Boolean(category.heroImagePath),
        imagePath:
          category.heroImagePath ??
          category.imagePath ??
          firstNode(newest?.productImageCollection)?.filePath,
      };
    })
    .filter((c) => c.count > 0 && c.imagePath)
    .sort(
      (a, b) =>
        Number(b.wide) - Number(a.wide) || b.newest.localeCompare(a.newest),
    )
    .slice(0, CATEGORY_SLIDES)
    .map(({ category, count, imagePath, wide }) => {
      const name =
        firstNode(category.categoryTranslationCollection)?.name ??
        category.slug;
      return {
        id: `category-${category.slug}`,
        imagePath,
        wide,
        kicker: `${count} бараа`,
        headline: name,
        ctaLabel: "Бүгдийг үзэх",
        href: `/shop?c=${category.slug}`,
      };
    });
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
  const latest = nodes(newData?.productCollection);
  const slides: HeroSlide[] = [
    {
      id: "store",
      imagePath: hero.heroImagePath,
      kicker: hero.heroSubline,
      headline: hero.heroHeadline ?? "Өдөр бүрийг тань гэрэлтүүлэх зүйлс",
      ctaLabel: hero.heroCtaLabel ?? "Дэлгүүр үзэх",
      href: hero.heroCtaHref ?? "/shop",
    },
    ...categorySlides(heroCategoriesData),
  ];

  return (
    <>
      <HeroCarousel slides={slides} />

      <NewArrivalsRail products={latest} />

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
