import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { displayFont } from "./display-font";
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
  productImagePath?: string | null;
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
      productImagePath: firstNode(
        firstNode(category.productCollection)?.productImageCollection,
      )?.filePath,
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
  const categories = stockedCategories(heroCategoriesData);
  const covers: HeroSlide[] = categories
    .filter((c) => c.heroImagePath)
    .map((c) => ({
      id: c.id,
      imagePath: c.heroImagePath,
      label: c.label,
      meta: `${c.count} бараа`,
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
            href: hero.heroCtaHref ?? "/shop",
          },
        ]
      : [];
  const tiles = categories.filter((c) => c.productImagePath).slice(0, 4);

  return (
    <div className={displayFont.variable}>
      <h1 className="sr-only">
        {hero.heroHeadline || "hotaru.mn — өдөр бүрийг гэрэлтүүлэх зүйлс"}
      </h1>
      <HeroCarousel slides={slides} />
      <NewArrivalsRail products={nodes(newData?.productCollection)} />

      {tiles.length > 1 && (
        <section
          aria-labelledby="categories-title"
          className="mx-auto max-w-350 px-5 py-10 lg:px-8 lg:py-14"
        >
          <div className="fashion-section-heading">
            <h2 id="categories-title">
              Ангиллаар
              <span className="fashion-heading-dot" aria-hidden="true">.</span>
            </h2>
            <Link href="/shop">Бүх бараа</Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-4">
            {tiles.map((tile) => (
              <li key={tile.id}>
                <Link href={tile.href} className="category-tile block">
                  <span className="category-tile-media">
                    <ProductImage
                      filePath={tile.productImagePath}
                      alt=""
                      seed={tile.id}
                      sizes="(min-width: 1024px) 25vw, 50vw"
                    />
                  </span>
                  <span className="mt-2.5 flex items-baseline justify-between gap-2 px-0.5">
                    <span className="category-tile-name">{tile.label}</span>
                    <span className="text-[12px] tabular-nums text-ink-soft">
                      {tile.count} бараа
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="catalog-title"
        className="mx-auto max-w-350 border-t border-line px-5 py-10 lg:px-8 lg:py-14"
      >
        <div className="fashion-section-heading mb-6">
          <h2 id="catalog-title">
            {featuredOnly.length ? "Онцлох бараа" : "Бүх бараа"}
            <span className="fashion-heading-dot" aria-hidden="true">.</span>
          </h2>
          <Link href="/shop">Бүгдийг үзэх</Link>
        </div>
        {error ? (
          <div className="rounded-2xl border border-line bg-shade px-5 py-14 text-center">
            <p className="text-ink-soft">Бүтээгдэхүүн ачаалж чадсангүй.</p>
            <p className="mt-2 text-[13px] text-ink-faint">Түр хүлээгээд дахин оролдоно уу.</p>
          </div>
        ) : (
          <ProductGrid products={featured} />
        )}
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-350 gap-6 px-5 py-10 sm:grid-cols-3 sm:gap-8 lg:px-8">
          {[
            ["Хурдан хүргэлт", "Улаанбаатар хотод ажлын 1–2 хоногт"],
            pay.tile,
            ["Баталгаат чанар", "Гэмтэлтэй бараа 100% солино"],
          ].map(([title, body]) => (
            <div key={title} className="border-l border-line pl-4">
              <h3 className="category-tile-name">{title}</h3>
              <p className="mt-1 text-[13px] text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
