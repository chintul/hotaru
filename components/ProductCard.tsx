"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copy, formatMnt, nodes, toNumber } from "@/lib/format";
import type {
  Product,
  ProductImage as ProductImageData,
  Variant,
} from "@/lib/types";
import ProductImage, { swatchTone } from "./ProductImage";
import { useCanHover } from "./useCanHover";
import { useCart } from "./useCart";
import { useTrack } from "./useTrack";
import { useUI } from "./UIProvider";
import { IconBag, IconCheck } from "./Icons";
import { DEFAULT_DEPOSIT_PCT, depositOf, isPreorder, unitPriceOf } from "@/lib/preorder";
import { hasSizes, uniqueColours } from "@/lib/sizes";
import { saleOf, type Sale } from "@/lib/sale";
import { useT, type Translate } from "@/lib/i18n";

const MAX_SWATCHES_PER_ROW = 4;
const MAX_CARD_SLIDES = 5;
const ADDED_CONFIRMATION_MS = 1600;
const CARD_SIZES = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
  swipe?: boolean;
  sizes?: string;
}

function nextVariantWithDifferentImage(
  variants: Variant[],
  active: number,
  shownPath: string | undefined,
): Variant | null {
  for (let step = 1; step < variants.length; step++) {
    const candidate = variants[(active + step) % variants.length];
    if (candidate?.image?.filePath && candidate.image.filePath !== shownPath) {
      return candidate;
    }
  }
  return null;
}

type CardAction = "size" | "preorder" | "add";

const ACTION_LABEL: Record<CardAction, readonly [mn: string, en: string]> = {
  size: ["Сагслах", "Add to cart"],
  preorder: ["Сагслах", "Add to cart"],
  add: ["Сагслах", "Add to cart"],
};

function cheapestSale(variants: Variant[]): Sale | null {
  const cheapest = variants.reduce<Variant | undefined>(
    (best, v) =>
      best && toNumber(best.priceMnt) <= toNumber(v.priceMnt) ? best : v,
    undefined,
  );
  return cheapest
    ? saleOf(cheapest.priceMnt, cheapest.compareAtPriceMnt)
    : null;
}

function saleBadge(variants: Variant[], t: Translate): string | null {
  const pcts = variants.flatMap((v) => {
    const sale = saleOf(v.priceMnt, v.compareAtPriceMnt);
    return sale ? [sale.pct] : [];
  });
  if (!pcts.length) return null;
  const top = Math.max(...pcts);
  return pcts.every((p) => p === top) ? `−${top}%` : t(`−${top}% хүртэл`, `up to −${top}%`);
}

function colourFaces(variants: Variant[]): Variant[] {
  return uniqueColours(variants).flatMap((colour) => {
    const ofColour = variants.filter((v) => v.optionValue === colour);
    const face = ofColour.find((v) => v.image?.filePath) ?? ofColour[0];
    return face ? [face] : [];
  });
}

export default function ProductCard({
  product,
  priority = false,
  swipe = true,
  sizes = CARD_SIZES,
}: ProductCardProps) {
  const c = copy(product);
  const t = useT();
  const images = nodes(product.productImageCollection);
  const allVariants = nodes(product.variantCollection);
  const sized = hasSizes(allVariants);
  const variants = sized ? colourFaces(allVariants) : allVariants;
  const [active, setActive] = useState(0);
  const canHover = useCanHover();

  const variant: Variant | undefined = variants[active] ?? variants[0];
  const movedOffDefault = active > 0 && variant?.id;
  const href =
    movedOffDefault && !sized
      ? `/shop/${product.slug}?v=${variant.id}`
      : `/shop/${product.slug}`;

  const primaryImage: ProductImageData | undefined =
    variant?.image ?? images[0];
  const hoverImage =
    nextVariantWithDifferentImage(variants, active, primaryImage?.filePath)
      ?.image ??
    images.find((i) => i.filePath !== primaryImage?.filePath) ??
    null;
  const slides = [
    primaryImage,
    ...images.filter((i) => i.filePath !== primaryImage?.filePath),
  ].slice(0, swipe ? MAX_CARD_SLIDES : 1);
  const [slidesArmed, setSlidesArmed] = useState(false);
  const pickVariant = (i: number) => setActive(i);

  const { add } = useCart();
  const track = useTrack();
  const { open: openOverlay, close: closeOverlay, setAddPending } = useUI();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const quickAddVariantId = product.inStock ? variant?.id : undefined;
  const quickIsPreorder = Boolean(quickAddVariantId) && isPreorder(variant, 1);
  const pickSizeFirst = sized && product.inStock;
  const onQuickAdd = async () => {
    if (!quickAddVariantId || adding) return;
    openOverlay("cart");
    setAddPending(true);
    setAdding(true);
    try {
      await add(quickAddVariantId, 1);
      track("add_to_cart", { productSlug: product.slug });
      setAdded(true);
      window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(
        () => setAdded(false),
        ADDED_CONFIRMATION_MS,
      );
    } catch {
      closeOverlay();
    } finally {
      setAdding(false);
      setAddPending(false);
    }
  };

  const showVariantPill = variant?.optionValue && !primaryImage?.filePath;
  const preorderOnly =
    allVariants.length > 0 &&
    !allVariants.some((v) => (v.quantity ?? 0) > 0) &&
    allVariants.some((v) => v.allowBackorder);
  const preorderVariants = allVariants.filter((v) => v.allowBackorder);
  const preorderPrices =
    preorderOnly && preorderVariants.some((v) => v.preorderPriceMnt != null)
      ? preorderVariants.map((v) => unitPriceOf(v, 1))
      : [];
  const min = preorderPrices.length
    ? Math.min(...preorderPrices)
    : toNumber(product.minPriceMnt);
  const max = preorderPrices.length
    ? Math.max(...preorderPrices)
    : toNumber(product.maxPriceMnt);
  const ranged = max > min;
  const priceSale = preorderPrices.length ? null : cheapestSale(allVariants);
  const badge = preorderPrices.length ? null : saleBadge(allVariants, t);
  const depositFrom = preorderOnly
    ? depositOf(min, product.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT)
    : null;
  const action: CardAction | null = pickSizeFirst
    ? "size"
    : quickAddVariantId
      ? quickIsPreorder
        ? "preorder"
        : "add"
      : null;
  const actionLabel = action
    ? `${c.title ?? product.slug} — ${t(...ACTION_LABEL[action]).toLowerCase()}`
    : undefined;

  return (
    <div className="product-card group flex h-full flex-col">
      <div className="relative">
        <Link href={href} className="block">
          <div className="card-media relative aspect-[4/5] overflow-hidden rounded-xl bg-shade" data-swap={Boolean(canHover && hoverImage)}>
            <div className="media-primary absolute inset-0">
              <div
                key={active}
                className="snap-track card-track"
                onTouchStart={() => setSlidesArmed(true)}
              >
                {slides.map((image, i) => (
                  <div key={image?.filePath ?? i}>
                    {(i === 0 || slidesArmed) && (
                      <ProductImage
                        filePath={image?.filePath}
                        alt={image?.alt || c.title || product.slug}
                        seed={i === 0 ? product.slug : `${product.slug}-${i}`}
                        priority={priority && i === 0}
                        sizes={sizes}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {canHover && hoverImage && (
              <div className="media-hover absolute inset-0">
                <ProductImage
                  filePath={hoverImage.filePath}
                  alt={hoverImage.alt || c.title || product.slug}
                  seed={`${product.slug}-2`}
                  sizes={sizes}
                />
              </div>
            )}
            {showVariantPill && (
              <span
                className="badge-pill absolute left-3 top-3"
                style={{ background: swatchTone(variant.optionValue) }}
              >
                <span className="badge-knob">◍</span>
                {variant.optionValue}
              </span>
            )}

            {badge && (
              <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sale">
                {badge}
              </span>
            )}

            {!product.inStock && (
              <span className="absolute right-2.5 top-2.5 rounded-full bg-paper/95 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                {t("Дууссан", "Sold out")}
              </span>
            )}
          </div>
        </Link>

        {action && action !== "add" && (
          <Link
            href={href}
            aria-label={actionLabel}
            className="card-action absolute bottom-2.5 right-2.5 inline-flex h-10 items-center gap-1.5 rounded-full bg-paper px-3.5 text-[12px] font-semibold text-ink-strong shadow-(--t-lift) transition-transform active:scale-95"
          >
            <IconBag width="16" height="16" />
            {t(...ACTION_LABEL[action])}
          </Link>
        )}

        {action === "add" && (
          <button
            onClick={onQuickAdd}
            disabled={adding}
            aria-label={actionLabel}
            className="card-action absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full bg-paper text-ink-strong shadow-(--t-lift) transition-transform active:scale-90 disabled:opacity-60"
          >
            {added ? (
              <IconCheck width="18" height="18" />
            ) : (
              <IconBag width="18" height="18" />
            )}
          </button>
        )}
      </div>

      <div className="product-card-info mt-3 flex flex-1 flex-col gap-0.5 text-left">
        <Link href={href} className="block">
          <p className="truncate text-[14px] leading-snug text-ink-strong hover:underline underline-offset-4">
            {c.title}
          </p>
        </Link>
        <p className="text-[14px] font-semibold tabular-nums text-ink-strong">
          {ranged ? (
            <span className="mr-1 text-[12px] font-normal text-ink-soft">
              {t("эхлэх үнэ", "from")}
            </span>
          ) : null}
          <span
            className={priceSale ? "tabular-nums text-sale" : "tabular-nums"}
          >
            {formatMnt(min)}
          </span>
          {priceSale && (
            <s className="ml-1.5 text-[12px] font-normal tabular-nums text-ink-faint">
              {formatMnt(priceSale.was)}
            </s>
          )}
        </p>

        {depositFrom !== null && (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-soft">
            <span aria-hidden className="preorder-dot" />
            <span>
              {t("Урьдчилгаа", "Deposit")} <span className="tabular-nums">{formatMnt(depositFrom)}</span>
            </span>
          </p>
        )}

        {variants.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center justify-start gap-1">
            {variants.slice(0, MAX_SWATCHES_PER_ROW).map((v, i) => (
              <button
                key={v.id}
                onMouseEnter={() => pickVariant(i)}
                onFocus={() => pickVariant(i)}
                onClick={() => pickVariant(i)}
                data-active={i === active}
                className="swatch"
                title={v.optionValue ?? ""}
                aria-label={v.optionValue ?? t("Сонголт", "Option")}
              >
                <span className="block h-4 w-4 overflow-hidden rounded-full bg-shade">
                  {v.image?.filePath ? (
                    <ProductImage
                      filePath={v.image.filePath}
                      alt=""
                      width={16}
                      height={16}
                      className="h-full w-full"
                    />
                  ) : (
                    <span
                      className="block h-full w-full"
                      style={{ background: swatchTone(v.optionValue) }}
                    />
                  )}
                </span>
              </button>
            ))}
            {variants.length > MAX_SWATCHES_PER_ROW && (
              <span className="px-1 text-[12px] text-ink-soft">
                +{variants.length - MAX_SWATCHES_PER_ROW}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
