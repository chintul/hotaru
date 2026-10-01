"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { copy, formatMnt, nodes, toNumber } from "@/lib/format";
import type { Product, ProductImage as ProductImageData, Variant } from "@/lib/types";
import ProductImage, { swatchTone } from "./ProductImage";
import { useCanHover } from "./useCanHover";
import { useCart } from "./useCart";
import { useUI } from "./UIProvider";
import { IconBag, IconCheck } from "./Icons";
import PreorderTag from "./PreorderTag";
import { isPreorder } from "@/lib/preorder";

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

export default function ProductCard({ product, priority = false }: ProductCardProps) {
  const c = copy(product);
  const images = nodes(product.productImageCollection);
  const variants = nodes(product.variantCollection);
  const [active, setActive] = useState(0);
  const canHover = useCanHover();

  const variant: Variant | undefined = variants[active] ?? variants[0];
  const movedOffDefault = active > 0 && variant?.id;
  const href = movedOffDefault
    ? `/shop/${product.slug}?v=${variant.id}`
    : `/shop/${product.slug}`;

  const primaryImage: ProductImageData | undefined = variant?.image ?? images[0];
  const hoverImage =
    nextVariantWithDifferentImage(variants, active, primaryImage?.filePath)?.image ??
    images.find((i) => i.filePath !== primaryImage?.filePath) ??
    null;

  const { add } = useCart();
  const { open: openOverlay, close: closeOverlay, setAddPending } = useUI();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(addedTimer.current), []);

  const quickAddVariantId = product.inStock ? variant?.id : undefined;
  const quickIsPreorder = Boolean(quickAddVariantId) && isPreorder(variant, 1);
  const onQuickAdd = async () => {
    if (!quickAddVariantId || adding) return;
    openOverlay("cart");
    setAddPending(true);
    setAdding(true);
    try {
      await add(quickAddVariantId, 1);
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

  const min = toNumber(product.minPriceMnt);
  const max = toNumber(product.maxPriceMnt);
  const ranged = max > min;
  const showVariantPill = variant?.optionValue && !primaryImage?.filePath;
  const preorderOnly =
    variants.length > 0 &&
    !variants.some((v) => (v.quantity ?? 0) > 0) &&
    variants.some((v) => v.allowBackorder);

  return (
    <div className="group">
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

            {!product.inStock && (
              <span className="absolute right-3 top-3 bg-paper/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.6px]">
                Дууссан
              </span>
            )}
          </div>
        </Link>

        {quickAddVariantId && quickIsPreorder && (
          <Link
            href={href}
            aria-label={`${c.title ?? product.slug} — урьдчилан захиалах`}
            className="absolute bottom-2 right-2 inline-flex h-10 items-center rounded-full bg-paper/90 px-3.5 text-[12px] font-semibold text-ink-strong shadow-[var(--t-lift)] backdrop-blur transition-transform active:scale-95 sm:h-9"
          >
            Урьдчилан захиалах
          </Link>
        )}

        {quickAddVariantId && !quickIsPreorder && (
          <button
            onClick={onQuickAdd}
            disabled={adding}
            aria-label={`${c.title ?? product.slug} — сагсанд нэмэх`}
            className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-paper/90 text-ink-strong shadow-[var(--t-lift)] backdrop-blur transition-[transform,opacity] active:scale-90 disabled:opacity-60 sm:h-9 sm:w-9"
          >
            {added ? (
              <IconCheck width="18" height="18" />
            ) : (
              <IconBag width="18" height="18" />
            )}
          </button>
        )}
      </div>

      <div className="mt-3 text-center">
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
          {formatMnt(min)}
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
      </div>
    </div>
  );
}
