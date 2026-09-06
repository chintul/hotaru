'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { TOGGLE_WISHLIST } from '@/lib/queries'
import { ensureSession } from '@/lib/supabase/browser'
import { useCart } from './useCart'
import { useUI } from './UIProvider'
import ProductImage from './ProductImage'
import { IconHeart, IconMinus, IconPlus, IconShare } from './Icons'

function swatchTone(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return `hsl(${h} 38% 72%)`
}

export default function ProductDetailClient({ product, copy }) {
  const variants = nodes(product.variantCollection)
  const images = nodes(product.productImageCollection)
  const { add, adding } = useCart()
  const { setCartOpen } = useUI()

  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? null)
  const [activeImage, setActiveImage] = useState(0)
  // Picking a colour should show that colour. Jump the gallery to the variant's
  // own image when it has one.
  const selectVariant = (v) => {
    setSelectedId(v.id)
    const idx = images.findIndex((img) => img.filePath === v.image?.filePath)
    if (idx >= 0) setActiveImage(idx)
  }
  const [qty, setQty] = useState(1)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [showBar, setShowBar] = useState(false)

  const [toggleWishlist] = useMutation(TOGGLE_WISHLIST)
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const purchasable = selected && (selected.quantity > 0 || selected.allowBackorder)
  const hasOptions = variants.length > 1 && variants.some((v) => v.optionLabel)
  const subtotal = toNumber(selected?.priceMnt) * qty

  // The sticky buy bar appears once the main add-to-cart scrolls away, which is
  // the only time it earns the space it takes.
  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 620)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onAdd = async () => {
    if (!selected) return
    setError(null)
    try {
      await add(selected.id, qty)
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
    <>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="relative aspect-square overflow-hidden bg-shade">
            <ProductImage
              filePath={images[activeImage]?.filePath}
              alt={images[activeImage]?.alt || copy.title}
              seed={`${product.slug}-${activeImage}`}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
            {selected?.optionValue && !images[activeImage]?.filePath && (
              <span
                className="badge-pill absolute left-4 top-4 text-[15px]"
                style={{ background: swatchTone(selected.optionValue) }}
              >
                <span className="badge-knob">◍</span>
                {selected.optionValue}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {images.map((img, i) => (
                <button
                  key={img.filePath + i}
                  onClick={() => setActiveImage(i)}
                  className={`relative aspect-square overflow-hidden bg-shade ${
                    i === activeImage ? 'ring-1 ring-ink-strong' : 'opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Зураг ${i + 1}`}
                >
                  <ProductImage filePath={img.filePath} alt="" seed={`${product.slug}-${i}`} sizes="120px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[96px] lg:self-start">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-[24px] font-bold leading-tight tracking-[0.4px]">{copy.title}</h1>
            <button className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink" aria-label="Хуваалцах">
              <IconShare /> <span className="link-underline">Хуваалцах</span>
            </button>
          </div>

          {copy.subtitle && <p className="mt-1.5 text-[13px] text-ink-soft">{copy.subtitle}</p>}

          <p className="mt-5 text-[24px] font-bold">{formatMnt(selected?.priceMnt)}</p>
          {selected?.compareAtPriceMnt && (
            <p className="text-[14px] text-ink-faint line-through">{formatMnt(selected.compareAtPriceMnt)}</p>
          )}

          {hasOptions && (
            <div className="mt-7">
              <p className="text-[13px]">
                <span className="font-semibold">{variants[0]?.optionLabel}:</span>{' '}
                <span className="text-ink-soft">{selected?.optionValue}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {variants.map((v) => {
                  const out = v.quantity <= 0 && !v.allowBackorder
                  return (
                    <button
                      key={v.id}
                      onClick={() => selectVariant(v)}
                      disabled={out}
                      data-active={v.id === selectedId}
                      className={`swatch h-[46px] w-[46px] ${out ? 'cursor-not-allowed opacity-40' : ''}`}
                      title={v.optionValue ?? ''}
                      aria-label={v.optionValue ?? ''}
                    >
                      <span
                        className="block h-[34px] w-[34px] rounded-full"
                        style={{ background: swatchTone(v.optionValue) }}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <p className="mt-6 text-[13px]">
            <span className="font-semibold">Нийт дүн:</span>{' '}
            <span className="font-bold">{formatMnt(subtotal)}</span>
          </p>

          <p className="mt-4 text-[13px] font-semibold">Тоо ширхэг:</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink" aria-label="Хасах">
                <IconMinus />
              </button>
              <span className="min-w-[46px] text-center text-[14px] tabular-nums">{qty}</span>
              <button
                onClick={() => setQty(qty + 1)}
                disabled={!selected?.allowBackorder && qty >= (selected?.quantity ?? 0)}
                className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30"
                aria-label="Нэмэх"
              >
                <IconPlus />
              </button>
            </div>

            <button onClick={onAdd} disabled={!purchasable || adding} className="btn-solid h-11 flex-1 px-8 min-w-[200px]">
              {adding ? 'Нэмж байна…' : purchasable ? 'Сагсанд нэмэх' : 'Дууссан'}
            </button>

            <button
              onClick={onSave}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${
                saved ? 'border-sale text-sale' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
              aria-label="Хадгалах"
            >
              <IconHeart filled={saved} />
            </button>
          </div>

          <p className="mt-3 text-[13px] text-ink-soft">
            {purchasable
              ? selected?.quantity <= 3 && !selected?.allowBackorder
                ? `Үлдэгдэл ${selected.quantity} ширхэг`
                : 'Бэлэн байгаа'
              : 'Түр дууссан'}
          </p>

          {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}

          <div className="mt-8 border-t border-line pt-6 text-[13px] text-ink-soft">
            <p className="font-semibold text-ink">Хүргэлт ба төлбөр</p>
            <p className="mt-2">Улаанбаатар хотод ажлын 1–2 хоногт. QPay QR эсвэл дансаар төлнө — захиалга өгсний дараа QR код харагдана.</p>
          </div>

          {copy.description && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-[13px] font-semibold">Тайлбар</p>
              <p className="mt-2 whitespace-pre-line text-[13px] text-ink-soft">{copy.description}</p>
            </div>
          )}
          {copy.careDetails && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="text-[13px] font-semibold">Арчилгаа</p>
              <p className="mt-2 whitespace-pre-line text-[13px] text-ink-soft">{copy.careDetails}</p>
            </div>
          )}
          {selected?.sku && <p className="mt-6 text-[12px] text-ink-faint">SKU {selected.sku}</p>}
        </div>
      </div>

      {/* Sticky buy bar, same as the reference once the page scrolls. */}
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/97 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3 lg:px-8">
            <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden bg-shade sm:block">
              <ProductImage filePath={images[0]?.filePath} alt="" seed={product.slug} sizes="48px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{copy.title}</p>
              <p className="text-[13px] font-bold">{formatMnt(selected?.priceMnt)}</p>
            </div>
            {hasOptions && (
              <select
                value={selectedId ?? ''}
                onChange={(e) => {
                  const v = variants.find((x) => x.id === e.target.value)
                  if (v) selectVariant(v)
                }}
                className="hidden border border-line px-3 py-2 text-[13px] sm:block"
              >
                {variants.map((v) => <option key={v.id} value={v.id}>{v.optionValue}</option>)}
              </select>
            )}
            <button onClick={onAdd} disabled={!purchasable || adding} className="btn-solid px-7 py-3">
              {purchasable ? 'Сагсанд нэмэх' : 'Дууссан'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
