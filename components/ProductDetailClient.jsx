'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { TOGGLE_WISHLIST } from '@/lib/queries'
import { ensureSession } from '@/lib/supabase/browser'
import { useCart } from './useCart'
import { useUI } from './UIProvider'
import ProductImage from './ProductImage'

export default function ProductDetailClient({ product, copy }) {
  const variants = nodes(product.variantCollection)
  const images = nodes(product.productImageCollection)
  const { add, adding } = useCart()
  const { setCartOpen } = useUI()

  // Single-SKU products have exactly one option-less variant, so no selector is
  // rendered at all — that is the accessories case this catalog is built for.
  const hasAxis = variants.length > 1 && variants.some((v) => v.optionLabel)
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? null)
  const [activeImage, setActiveImage] = useState(0)
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState(null)

  const [toggleWishlist] = useMutation(TOGGLE_WISHLIST)
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const purchasable = selected && (selected.quantity > 0 || selected.allowBackorder)

  const onAdd = async () => {
    if (!selected) return
    setError(null)
    try {
      await add(selected.id, 1)
      setCartOpen(true)
    } catch (e) {
      setError(e?.message ?? 'Сагсанд нэмэхэд алдаа гарлаа.')
    }
  }

  const onSave = async () => {
    try {
      await ensureSession()
      const res = await toggleWishlist({ variables: { productId: product.id } })
      setSaved(Boolean(res.data?.toggleWishlist))
    } catch (e) {
      setError(e?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <div className="relative aspect-[3/4] overflow-hidden bg-paper-warm">
          <ProductImage
            filePath={images[activeImage]?.filePath}
            alt={images[activeImage]?.alt || copy.title}
            seed={`${product.slug}-${activeImage}`}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>
        {images.length > 1 && (
          <div className="mt-3 grid grid-cols-5 gap-3">
            {images.map((img, i) => (
              <button
                key={img.filePath + i}
                onClick={() => setActiveImage(i)}
                className={`relative aspect-square overflow-hidden bg-paper-warm transition-opacity ${
                  i === activeImage ? 'ring-1 ring-ink' : 'opacity-70 hover:opacity-100'
                }`}
                aria-label={`Зураг ${i + 1}`}
              >
                <ProductImage filePath={img.filePath} alt="" seed={`${product.slug}-${i}`} sizes="120px" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">{copy.title}</h1>
        {copy.subtitle && <p className="mt-2 text-ink-soft">{copy.subtitle}</p>}

        <div className="mt-5 flex items-baseline gap-3">
          <span className="text-[17px] tabular-nums">{formatMnt(selected?.priceMnt)}</span>
          {selected?.compareAtPriceMnt && (
            <span className="text-ink-faint line-through tabular-nums">
              {formatMnt(selected.compareAtPriceMnt)}
            </span>
          )}
        </div>

        {hasAxis && (
          <div className="mt-8">
            <p className="label text-ink-faint">{variants[0]?.optionLabel}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {variants.map((v) => {
                const out = v.quantity <= 0 && !v.allowBackorder
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    disabled={out}
                    className={`label border px-4 py-2.5 transition-colors ${
                      v.id === selectedId
                        ? 'border-ink bg-ink text-paper'
                        : 'border-line hover:border-ink'
                    } ${out ? 'cursor-not-allowed text-ink-faint line-through opacity-50' : ''}`}
                  >
                    {v.optionValue}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <p className="label mt-5 text-ink-faint">
          {purchasable
            ? selected?.quantity <= 3 && !selected?.allowBackorder
              ? `Үлдэгдэл ${selected.quantity}`
              : 'Бэлэн байгаа'
            : 'Дууссан'}
        </p>

        <button
          onClick={onAdd}
          disabled={!purchasable || adding}
          className="label mt-6 w-full bg-ink py-4 text-paper transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {adding ? 'Нэмж байна…' : purchasable ? 'Сагсанд нэмэх' : 'Дууссан'}
        </button>

        <button onClick={onSave} className="label link-underline mt-4 text-ink-soft">
          {saved === null ? 'Хадгалах' : saved ? 'Хадгалсан ✓' : 'Хадгалахаас хассан'}
        </button>

        {error && <p className="mt-4 text-sale">{error}</p>}

        {copy.description && (
          <div className="mt-10 border-t border-line pt-6">
            <p className="label text-ink-faint">Тайлбар</p>
            <p className="mt-3 whitespace-pre-line text-ink-soft">{copy.description}</p>
          </div>
        )}
        {copy.careDetails && (
          <div className="mt-6 border-t border-line pt-6">
            <p className="label text-ink-faint">Арчилгаа</p>
            <p className="mt-3 whitespace-pre-line text-ink-soft">{copy.careDetails}</p>
          </div>
        )}
        {selected?.sku && (
          <p className="label mt-6 text-ink-faint">SKU {selected.sku}</p>
        )}
      </div>
    </div>
  )
}
