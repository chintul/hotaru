"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copy, formatMnt, nodes, toNumber } from "@/lib/format";
import type { Product, ProductImage as ProductImageData, Variant } from "@/lib/types";
import ProductImage, { swatchTone } from "./ProductImage";
import { useCanHover } from "./useCanHover";
import { useCart } from "./useCart";
import { useTrack } from "./useTrack";
import { useUI } from "./UIProvider";
import { IconBag, IconCheck } from "./Icons";
import PreorderTag from "./PreorderTag";
import { isPreorder, unitPriceOf } from "@/lib/preorder";
import { hasSizes, uniqueColours } from "@/lib/sizes";
import { saleOf, type Sale } from "@/lib/sale";

const MAX_SWATCHES_PER_ROW = 4;
const ADDED_CONFIRMATION_MS = 1600;
const CARD_SIZES = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

interface ProductCardProps {
  product: Product;
  priority?: boolean;
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

const ACTION_LABEL: Record<CardAction, string> = {
  size: "Хэмжээ сонгох",
  preorder: "Урьдчилан захиалах",
  add: "Сагсанд нэмэх",
};

function cheapestSale(variants: Variant[]): Sale | null {
  const cheapest = variants.reduce<Variant | undefined>(
    (best, v) => (best && toNumber(best.priceMnt) <= toNumber(v.priceMnt) ? best : v),
    undefined,
  );
  return cheapest ? saleOf(cheapest.priceMnt, cheapest.compareAtPriceMnt) : null;
}

function saleBadge(variants: Variant[]): string | null {
  const pcts = variants.flatMap((v) => {
    const sale = saleOf(v.priceMnt, v.compareAtPriceMnt);
    return sale ? [sale.pct] : [];
  });
  if (!pcts.length) return null;
  const top = Math.max(...pcts);
  return pcts.every((p) => p === top) ? `−${top}%` : `−${top}% хүртэл`;
}

function colourFaces(variants: Variant[]): Variant[] {
  return uniqueColours(variants).flatMap((colour) => {
    const ofColour = variants.filter((v) => v.optionValue === colour);
    const face = ofColour.find((v) => v.image?.filePath) ?? ofColour[0];
    return face ? [face] : [];
  });
}

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const c = copy(product);
  const images = nodes(product.productImageCollection);
  const allVariants = nodes(product.variantCollection);
  const sized = hasSizes(allVariants);
  const variants = sized ? colourFaces(allVariants) : allVariants;
  const [active, setActive] = useState(0);
  const canHover = useCanHover();

  const variant: Variant | undefined = variants[active] ?? variants[0];
  const movedOffDefault = active > 0 && variant?.id;
  const href = movedOffDefault && !sized
    ? `/shop/${product.slug}?v=${variant.id}`
    : `/shop/${product.slug}`;

  const primaryImage: ProductImageData | undefined = variant?.image ?? images[0];
  const hoverImage =
    nextVariantWithDifferentImage(variants, active, primaryImage?.filePath)?.image ??
    images.find((i) => i.filePath !== primaryImage?.filePath) ??
    null;

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
      addedTimer.current = window.setTimeout(() => setAdded(false), ADDED_CONFIRMATION_MS);
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
  const preorderPrices = preorderOnly && preorderVariants.some((v) => v.preorderPriceMnt != null)
    ? preorderVariants.map((v) => unitPriceOf(v, 1))
    : [];
  const min = preorderPrices.length ? Math.min(...preorderPrices) : toNumber(product.minPriceMnt);
  const max = preorderPrices.length ? Math.max(...preorderPrices) : toNumber(product.maxPriceMnt);
  const ranged = max > min;
  const priceSale = preorderPrices.length ? null : cheapestSale(allVariants);
  const badge = preorderPrices.length ? null : saleBadge(allVariants);
  const action: CardAction | null = pickSizeFirst
    ? "size"
    : quickAddVariantId
      ? quickIsPreorder ? "preorder" : "add"
      : null;
  const actionLabel = action ? `${c.title ?? product.slug} — ${ACTION_LABEL[action].toLowerCase()}` : undefined;

  return (
    <div className="group flex h-full flex-col">
      <div className="relative">
        <Link href={href} className="block">
          <div className="card-media relative aspect-square overflow-hidden bg-shade">
            <div className="media-primary absolute inset-0">
              <ProductImage
                filePath={primaryImage?.filePath}
                alt={primaryImage?.alt || c.title || product.slug}
                seed={product.slug}
                priority={priority}
                sizes={CARD_SIZES}
              />
            </div>
            {canHover && hoverImage && (
              <div className="media-hover absolute inset-0">
                <ProductImage
                  filePath={hoverImage.filePath}
                  alt={hoverImage.alt || c.title || product.slug}
                  seed={`${product.slug}-2`}
                  sizes={CARD_SIZES}
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

            {preorderOnly && (
              <PreorderTag className="absolute right-2 top-2 max-w-[calc(100%-1rem)]" />
            )}

            {badge && (
              <span className="absolute bottom-2 left-2 rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sale shadow-[var(--t-lift)]">
                {badge}
              </span>
            )}

            {!product.inStock && (
              <span className="absolute right-3 top-3 bg-paper/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.6px]">
                Дууссан
              </span>
            )}
          </div>
        </Link>

        {action && action !== "add" && (
          <Link
            href={href}
            aria-label={actionLabel}
            className="absolute bottom-2 right-2 hidden h-9 items-center rounded-full border border-line bg-paper px-3.5 text-[12px] font-semibold text-ink-strong shadow-[var(--t-lift)] transition-transform active:scale-95 sm:inline-flex"
          >
            {ACTION_LABEL[action]}
          </Link>
        )}

        {action === "add" && (
          <button
            onClick={onQuickAdd}
            disabled={adding}
            aria-label={actionLabel}
            className="absolute bottom-2 right-2 hidden h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink-strong shadow-[var(--t-lift)] transition-[transform,opacity] active:scale-90 disabled:opacity-60 sm:grid"
          >
            {added ? (
              <IconCheck width="18" height="18" />
            ) : (
              <IconBag width="18" height="18" />
            )}
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col text-center">
        <Link href={href} className="block">
          <p className="line-clamp-2 min-h-[2.75em] text-[14px] leading-snug hover:underline underline-offset-4">
            {c.title}
          </p>
        </Link>
        <p className="mt-1.5 text-[15px] font-bold">
          {ranged ? (
            <span className="mr-1 text-[12px] font-normal text-ink-soft">
              эхлэх үнэ
            </span>
          ) : null}
          <span className={priceSale ? "tabular-nums text-sale" : "tabular-nums"}>{formatMnt(min)}</span>
          {priceSale && (
            <s className="ml-1.5 text-[12px] font-normal tabular-nums text-ink-faint">{formatMnt(priceSale.was)}</s>
          )}
        </p>

        {variants.length > 1 && (
          <div className="mt-2.5 flex justify-center gap-1.5">
            {variants.slice(0, MAX_SWATCHES_PER_ROW).map((v, i) => (
              <button
                key={v.id}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                data-active={i === active}
                className="swatch"
                title={v.optionValue ?? ""}
                aria-label={v.optionValue ?? "Сонголт"}
              >
                <span className="block h-[22px] w-[22px] overflow-hidden rounded-full bg-shade">
                  {v.image?.filePath ? (
                    <ProductImage
                      filePath={v.image.filePath}
                      alt=""
                      width={22}
                      height={22}
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
              <span className="grid h-[30px] place-items-center px-1 text-[12px] text-ink-soft">
                +{variants.length - MAX_SWATCHES_PER_ROW}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-3 sm:hidden">
          {action === "add" ? (
            <button
              onClick={onQuickAdd}
              disabled={adding}
              aria-label={actionLabel}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink-strong transition-[transform,opacity] active:scale-[0.97] disabled:opacity-60"
            >
              {added ? <IconCheck width="16" height="16" /> : <IconBag width="16" height="16" />}
              {added ? "Нэмэгдлээ" : ACTION_LABEL.add}
            </button>
          ) : action ? (
            <Link
              href={href}
              aria-label={actionLabel}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink-strong transition-transform active:scale-[0.97]"
            >
              <IconBag width="16" height="16" />
              {ACTION_LABEL[action]}
            </Link>
          ) : (
            <div aria-hidden className="h-11" />
          )}
        </div>
      </div>
    </div>
  );
}
