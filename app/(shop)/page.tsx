import { safeQuery } from "@/lib/apollo/safeQuery";
import {
  HERO,
  CATEGORY_RAILS,
  HERO_CATEGORIES,
  NEW_ARRIVALS,
} from "@/lib/queries";
import { firstNode, nodes } from "@/lib/format";
import { CategoryName, T } from "@/lib/i18n";
import { categoryName } from "@/lib/category-names";
import { paymentCopy } from "@/lib/payment-copy";
import HeroCarousel, { type HeroSlide } from "@/components/HeroCarousel";
import ProductRailSection from "@/components/ProductRailSection";
import HeroFirefly from "@/components/HeroFirefly";
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

interface CategoryTile {
  id: string;
  label: string;
  count: number;
  href: string;
  heroImagePath?: string | null;
  heroMobileImagePath?: string | null;
}

function stockedCategories(data: HeroCategoriesData | null): CategoryTile[] {
  return nodes(data?.categoryCollection)
    .filter((c) => (c.productCollection?.totalCount ?? 0) > 0)
    .sort((a, b) =>
      (firstNode(b.productCollection)?.createdAt ?? "").localeCompare(
        firstNode(a.productCollection)?.createdAt ?? "",
      ),
    )
    .map((category) => ({
      id: `category-${category.slug}`,
      label:
        firstNode(category.categoryTranslationCollection)?.name ??
        category.slug,
      count: category.productCollection?.totalCount ?? 0,
      href: `/shop?c=${category.slug}`,
      heroImagePath: category.heroImagePath,
      heroMobileImagePath: category.heroMobileImagePath,
    }));
}

export const revalidate = 60;

export default async function HomePage() {
  const [
    { data: newData },
    { data: heroData },
    { data: heroCategoriesData },
    { data: railsData },
  ] = await Promise.all([
    safeQuery<ProductListData>(NEW_ARRIVALS, { first: 12 }),
    safeQuery<HeroData>(HERO),
    safeQuery<HeroCategoriesData>(HERO_CATEGORIES),
    safeQuery<HeroCategoriesData>(CATEGORY_RAILS),
  ]);
  const pay = await paymentCopy();

  const hero: StoreSettings = firstNode(heroData?.storeSettingsCollection) ?? {};

  const categories = stockedCategories(heroCategoriesData);
  const covers: HeroSlide[] = categories
    .filter((c) => c.heroImagePath || c.heroMobileImagePath)
    .map((c) => ({
      id: c.id,
      imagePath: c.heroImagePath,
      mobileImagePath: c.heroMobileImagePath,
      label: c.label,
      labelEn: categoryName(c.id.replace(/^category-/, ""), c.label, "en"),
      meta: `${c.count} бараа`,
      metaEn: `${c.count} ${c.count === 1 ? "item" : "items"}`,
      href: c.href,
    }));
  const slides: HeroSlide[] = covers.length
    ? covers
    : hero.heroImagePath
      ? [
          {
            id: "store",
            imagePath: hero.heroImagePath,
            label: hero.heroHeadline || "Дэлгүүр үзэх",
            labelEn: hero.heroHeadline || "Shop now",
            href: hero.heroCtaHref ?? "/shop",
          },
        ]
      : [];

  return (
    <div className="studio-home">
      <h1 className="sr-only">
        {hero.heroHeadline || <T mn="hotaru.mn — өдөр бүрийг гэрэлтүүлэх зүйлс" en="hotaru.mn — small things that brighten every day" />}
      </h1>
      <div className="relative">
        <HeroCarousel slides={slides} />
        <HeroFirefly className="bottom-[18%] left-[12%]" />
      </div>
      <ProductRailSection
        id="new-arrivals"
        title={<T mn="Шинээр нэмэгдсэн" en="New in" />}
        href="/shop?sort=newest"
        products={nodes(newData?.productCollection)}
      />
      {nodes(railsData?.categoryCollection).map((category) => (
        <ProductRailSection
          key={category.id ?? category.slug}
          id={`rail-${category.slug}`}
          title={<CategoryName slug={category.slug} mn={firstNode(category.categoryTranslationCollection)?.name ?? category.slug} />}
          href={`/shop?c=${category.slug}`}
          products={nodes(category.productCollection)}
        />
      ))}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-350 gap-6 px-5 py-10 sm:grid-cols-3 sm:gap-8 lg:px-8">
          {[
            { mn: ["Хурдан хүргэлт", "Улаанбаатар хотод ажлын 1–2 хоногт"], en: ["Fast delivery", "1–2 working days in Ulaanbaatar"] },
            { mn: pay.tile, en: pay.tileEn },
            { mn: ["Баталгаат чанар", "Гэмтэлтэй бараа 100% солино"], en: ["Quality promise", "Damaged items replaced in full"] },
          ].map(({ mn, en }) => (
            <div key={mn[0]} className="border-l border-line pl-4">
              <h3 className="category-tile-name"><T mn={mn[0]} en={en[0]} /></h3>
              <p className="mt-1 text-[13px] text-ink-soft"><T mn={mn[1]} en={en[1]} /></p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
