'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { TOGGLE_WISHLIST } from '@/lib/queries'
import { ensureSession } from '@/lib/supabase/browser'
import type { Product, ProductTranslation, Variant } from '@/lib/types'
import { useCart } from './useCart'
import { useTrack } from './useTrack'
import { useUI } from './UIProvider'
import ProductImage, { swatchTone } from './ProductImage'
import { IconCheck, IconHeart, IconMinus, IconPlus, IconShare } from './Icons'
import { errorMessage } from '@/lib/errors'
import { DEFAULT_DEPOSIT_PCT, depositOf, isPreorder, unitPriceOf } from '@/lib/preorder'
import PreorderTag from './PreorderTag'
import { saleOf } from '@/lib/sale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasSizes, uniqueColours } from '@/lib/sizes'

interface ProductDetailClientProps {
  product: Product
  copy: ProductTranslation
  payNote: string
}

interface ToggleWishlistData {
  toggleWishlist: boolean | null
}

interface ToggleWishlistVars {
  productId?: string
}

interface SizedPick {
  colour: string | null
  size: string | null
}

const CONFIRMATION_MS = 1600
const SIZE_NUDGE_MS = 1400
const FALLBACK_BUY_BAR_SCROLL_Y = 620
const LOW_STOCK_THRESHOLD = 3

const neverChanges = () => () => {}
const readVariantIdFromUrl = () => new URLSearchParams(window.location.search).get('v')
const noVariantIdOnServer = () => null

const ignoreDismissal = () => undefined

const variantAvailable = (v: Variant) => (v.quantity ?? 0) > 0 || Boolean(v.allowBackorder)
const preorderOnly = (v: Variant) => (v.quantity ?? 0) <= 0 && Boolean(v.allowBackorder)

const uniqueBySize = (list: readonly Variant[]): Variant[] => {
  const seen = new Set<string>()
  return list.filter((v) => {
    if (!v.size || seen.has(v.size)) return false
    seen.add(v.size)
    return true
  })
}

const syncUrlVariant = (id: string | null) => {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('v', id)
  else url.searchParams.delete('v')
  window.history.replaceState(null, '', url)
}

export default function ProductDetailClient({ product, copy, payNote }: ProductDetailClientProps) {
  const variants = nodes(product.variantCollection)
  const images = nodes(product.productImageCollection)
  const { add, adding } = useCart()
  const track = useTrack()
  const viewedSlug = useRef<string | null>(null)

  useEffect(() => {
    if (viewedSlug.current === product.slug) return
    viewedSlug.current = product.slug
    track('product_view', { productSlug: product.slug })
  }, [product.slug, track])
  const { open: openOverlay, close: closeOverlay, setAddPending } = useUI()

  const imageIndexOf = (v: Variant): number | null => {
    const idx = images.findIndex((img) => img.filePath === v.image?.filePath)
    return idx >= 0 ? idx : null
  }

  const urlVariantId = useSyncExternalStore(neverChanges, readVariantIdFromUrl, noVariantIdOnServer)
  const urlVariant = urlVariantId ? variants.find((x) => x.id === urlVariantId) : undefined

  const [chosenId, setChosenId] = useState<string | null>(null)
  const [chosenImage, setChosenImage] = useState<number | null>(null)
  const selectedId = chosenId ?? urlVariant?.id ?? variants[0]?.id ?? null
  const activeImage = chosenImage ?? (urlVariant ? imageIndexOf(urlVariant) : null) ?? 0

  const sized = hasSizes(variants)
  const colours = sized ? uniqueColours(variants) : []
  const optionLabel = variants.find((v) => v.optionLabel)?.optionLabel ?? null
  const [pick, setPick] = useState<SizedPick | null>(null)
  const colour = pick ? pick.colour : (urlVariant?.optionValue ?? colours[0] ?? null)
  const ofColour = (c: string | null) => (colours.length ? variants.filter((v) => v.optionValue === c) : variants)
  const colourFace = (c: string | null) => {
    const list = ofColour(c)
    return list.find((v) => v.image?.filePath) ?? list[0]
  }
  const sizeOptions = sized ? uniqueBySize(ofColour(colour)) : []
  const wantedSize = pick ? pick.size : (urlVariant?.size ?? null)
  const sizedVariant =
    sizeOptions.find((v) => v.size === wantedSize) ?? (sizeOptions.length === 1 ? sizeOptions[0] : undefined)

  const showImageOf = (v: Variant | undefined) => {
    const idx = v ? imageIndexOf(v) : null
    if (idx !== null) setChosenImage(idx)
  }

  const selectVariant = (v: Variant) => {
    setChosenId(v.id)
    showImageOf(v)
    syncUrlVariant(v.id)
  }

  const pickColour = (c: string) => {
    const keep = sizedVariant ? ofColour(c).find((v) => v.size === sizedVariant.size) : undefined
    setPick({ colour: c, size: keep?.size ?? null })
    showImageOf(keep?.image?.filePath ? keep : colourFace(c))
    syncUrlVariant(keep?.id ?? null)
  }

  const pickSize = (v: Variant) => {
    setPick({ colour, size: v.size ?? null })
    if (v.image?.filePath) showImageOf(v)
    syncUrlVariant(v.id)
  }

  const sizeRowRef = useRef<HTMLDivElement>(null)
  const [nudged, setNudged] = useState(false)
  const nudgeTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(nudgeTimer.current), [])
  const promptSize = () => {
    const row = sizeRowRef.current
    if (!row) return
    row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    row.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    setNudged(true)
    window.clearTimeout(nudgeTimer.current)
    nudgeTimer.current = window.setTimeout(() => setNudged(false), SIZE_NUDGE_MS)
  }

  const [qty, setQty] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const addedTimer = useRef<number | undefined>(undefined)
  const buyRef = useRef<HTMLButtonElement>(null)
  useEffect(() => () => window.clearTimeout(addedTimer.current), [])
  const [shared, setShared] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBar, setShowBar] = useState(false)

  const [toggleWishlist] = useMutation<ToggleWishlistData, ToggleWishlistVars>(TOGGLE_WISHLIST)
  const selected: Variant | undefined = sized
    ? sizedVariant
    : (variants.find((v) => v.id === selectedId) ?? variants[0])
  const needsSize = sized && !selected
  const shown: Variant | undefined = selected ?? colourFace(colour) ?? variants[0]
  const purchasable = Boolean(selected && variantAvailable(selected))
  const hasOptions = sized ? colours.length > 1 : variants.length > 1 && variants.some((v) => v.optionLabel)
  const normalPrice = toNumber(shown?.priceMnt)
  const unitPrice = selected ? unitPriceOf(selected, qty) : normalPrice
  const preorderPriced = unitPrice !== normalPrice
  const sale = preorderPriced ? null : saleOf(shown?.priceMnt, shown?.compareAtPriceMnt)
  const subtotal = unitPrice * qty
  const lowStock = (selected?.quantity ?? 0) <= LOW_STOCK_THRESHOLD && !selected?.allowBackorder
  const preorder = purchasable && isPreorder(selected, qty)
  const depositPct = product.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT
  const depositNow = depositOf(subtotal, depositPct)
  const addLabel = needsSize
    ? 'Хэмжээ сонгоно уу'
    : purchasable ? (preorder ? 'Урьдчилан захиалах' : 'Сагсанд нэмэх') : 'Дууссан'
  const onBuy = needsSize ? promptSize : onAddSelected
  const buyDisabled = needsSize ? false : !purchasable || adding
  const swatches = sized
    ? colours.map((c) => ({ key: c, value: c, face: colourFace(c), active: c === colour, out: !ofColour(c).some(variantAvailable) }))
    : variants.map((v) => ({ key: v.id, value: v.optionValue ?? null, face: v, active: v.id === selectedId, out: !variantAvailable(v) }))
  const onSwatch = (value: string | null, face: Variant | undefined) => {
    if (sized) {
      if (value) pickColour(value)
    } else if (face) {
      selectVariant(face)
    }
  }
  const barOptions = sized ? sizeOptions : variants
  const showBarSelect = sized ? sizeOptions.length > 1 : hasOptions

  useEffect(() => {
    const onScroll = () => {
      const buyButton = buyRef.current
      if (!buyButton) {
        setShowBar(window.scrollY > FALLBACK_BUY_BAR_SCROLL_Y)
        return
      }
      setShowBar(buyButton.getBoundingClientRect().bottom < 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: copy.title ?? product.slug, url }).catch(ignoreDismissal)
      return
    }
    const copied = await navigator.clipboard.writeText(url).then(() => true, () => false)
    if (!copied) return
    setShared(true)
    window.setTimeout(() => setShared(false), CONFIRMATION_MS)
  }

  async function onAddSelected() {
    if (!selected) return
    setError(null)
    openOverlay('cart')
    setAddPending(true)
    try {
      await add(selected.id, qty)
      track('add_to_cart', { productSlug: product.slug })
      setJustAdded(true)
      window.clearTimeout(addedTimer.current)
      addedTimer.current = window.setTimeout(() => setJustAdded(false), CONFIRMATION_MS)
    } catch (e) {
      closeOverlay()
      setError(errorMessage(e, 'Сагсанд нэмэхэд алдаа гарлаа.'))
    } finally {
      setAddPending(false)
    }
  }

  const onSave = async () => {
    try {
      await ensureSession()
      const res = await toggleWishlist({ variables: { productId: product.id } })
      setSaved(Boolean(res.data?.toggleWishlist))
    } catch (e) {
      setError(errorMessage(e, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  return (
    <>
      <div className="grid gap-8 md:grid-cols-2 md:gap-8 lg:gap-14">
        <div>
          <div className="relative aspect-square overflow-hidden bg-shade">
            <div key={activeImage} className="fade-in absolute inset-0">
              <ProductImage
                filePath={images[activeImage]?.filePath}
                alt={images[activeImage]?.alt || copy.title}
                seed={`${product.slug}-${activeImage}`}
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
            {shown?.optionValue && !images[activeImage]?.filePath && (
              <span
                className="badge-pill absolute left-4 top-4 text-[15px]"
                style={{ background: swatchTone(shown.optionValue) }}
              >
                <span className="badge-knob">◍</span>
                {shown.optionValue}
              </span>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {images.map((img, i) => (
                <button
                  key={img.filePath + i}
                  onClick={() => setChosenImage(i)}
                  className={`relative aspect-square overflow-hidden bg-shade transition-all duration-200 ${
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
            <button
              onClick={onShare}
              className="tap flex shrink-0 items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
              aria-label="Хуваалцах"
            >
              <IconShare />
              <span className="link-underline">{shared ? 'Холбоос хуулсан' : 'Хуваалцах'}</span>
            </button>
          </div>

          {copy.subtitle && <p className="mt-1.5 text-[13px] text-ink-soft">{copy.subtitle}</p>}

          {sale ? (
            <>
              <p className="mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-[24px] font-bold tabular-nums text-sale">{formatMnt(sale.price)}</span>
                <s className="text-[15px] tabular-nums text-ink-faint">{formatMnt(sale.was)}</s>
                <span className="self-center rounded-full border border-sale/40 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-sale">
                  −{sale.pct}%
                </span>
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">
                <span className="tabular-nums">{formatMnt(sale.was - sale.price)}</span> хэмнэнэ
              </p>
            </>
          ) : (
            <p className="mt-5 text-[24px] font-bold">{formatMnt(unitPrice)}</p>
          )}
          {preorderPriced && (
            <p className="text-[13px] text-ink-soft">
              Урьдчилсан захиалгын үнэ · Үндсэн үнэ <span className="tabular-nums">{formatMnt(normalPrice)}</span>
            </p>
          )}

          {hasOptions && (
            <div className="mt-7">
              <p className="text-[13px]">
                <span className="font-semibold">{optionLabel}:</span>{' '}
                <span className="text-ink-soft">{shown?.optionValue}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {swatches.map(({ key, value, face, active, out }) => {
                  return (
                    <button
                      key={key}
                      onClick={() => onSwatch(value, face)}
                      disabled={out}
                      aria-pressed={active}
                      aria-label={value ?? ''}
                      className={`group flex w-[74px] flex-col items-center gap-1.5 ${
                        out ? 'cursor-not-allowed opacity-40' : ''
                      }`}
                    >
                      <span
                        className={`block h-[52px] w-[52px] overflow-hidden rounded-full border transition-all ${
                          active
                            ? 'border-ink-strong ring-2 ring-ink-strong ring-offset-2'
                            : 'border-line group-hover:border-ink'
                        }`}
                      >
                        {face?.image?.filePath ? (
                          <ProductImage
                            filePath={face.image.filePath}
                            alt=""
                            seed={key}
                            width={52}
                            height={52}
                            className="h-full w-full"
                          />
                        ) : (
                          <span
                            className="block h-full w-full"
                            style={{ background: swatchTone(value) }}
                          />
                        )}
                      </span>
                      <span
                        className={`text-center text-[12px] leading-tight ${
                          active ? 'font-medium text-ink' : 'text-ink-soft'
                        }`}
                      >
                        {value}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {sized && sizeOptions.length > 0 && (
            <div
              ref={sizeRowRef}
              className={`-mx-3 mt-6 scroll-mt-24 rounded-2xl px-3 py-2 transition-colors duration-500 ${
                nudged ? 'bg-primary-soft' : 'bg-transparent'
              }`}
            >
              <p className="text-[13px]">
                <span className="font-semibold">Хэмжээ:</span>{' '}
                {selected?.size ? (
                  <span className="text-ink-soft">{selected.size}</span>
                ) : (
                  <span className={nudged ? 'text-primary-soft-ink' : 'text-ink-faint'}>сонгоно уу</span>
                )}
              </p>
              <div role="group" aria-label="Хэмжээ" className="mt-3 flex flex-wrap gap-2">
                {sizeOptions.map((v) => {
                  const out = !variantAvailable(v)
                  const active = v.id === selected?.id
                  const early = preorderOnly(v)
                  return (
                    <button
                      key={v.id}
                      onClick={() => pickSize(v)}
                      disabled={out}
                      aria-pressed={active}
                      aria-label={early ? `${v.size} — урьдчилсан захиалга` : out ? `${v.size} — дууссан` : (v.size ?? '')}
                      className={`flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl border px-3 text-[14px] tabular-nums transition-[border-color,background-color,transform] duration-150 active:scale-95 ${
                        active
                          ? 'border-ink-strong bg-ink-strong font-semibold text-on-ink'
                          : out
                            ? 'cursor-not-allowed border-line text-ink-faint line-through'
                            : 'border-line-strong text-ink hover:border-ink'
                      }`}
                    >
                      <span className="leading-none">{v.size}</span>
                      {early && (
                        <span className={`mt-1 text-[10px] leading-none ${active ? 'text-on-ink' : 'text-ink-soft'}`}>
                          урьдчилсан
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {preorder && (
            <div className="mt-6 rounded-2xl bg-paper-warm p-4 text-[13px]">
              <PreorderTag />
              {product.preorderEta && (
                <p className="mt-2.5 text-ink-soft">
                  Ирэх хугацаа: <span className="font-semibold text-ink">{product.preorderEta}</span>
                </p>
              )}
              <div className="mt-3 space-y-1 border-t border-line pt-3">
                <p className="text-ink-soft">
                  Урьдчилгаа: <span className="font-semibold text-ink">хамгийн багадаа {depositPct}%</span>
                </p>
                <p className="font-semibold tabular-nums">
                  Хамгийн багадаа {formatMnt(depositNow)} урьдчилж төлнө, бүтэн дүнгээр ч төлж болно.
                </p>
                <p className="text-ink-soft">Төлөх дүнгээ төлбөр хийхдээ өөрөө сонгоно. Үлдэгдлийг бараа ирэхэд төлнө.</p>
              </div>
              <p className="mt-3 leading-relaxed text-ink-soft">
                Урьдчилгаа төлбөр буцаагдахгүй тул итгэлтэй байвал захиалаарай. Бараа ирмэгц үлдэгдлийн нэхэмжлэл илгээж, бүрэн төлөгдсөний дараа хүргэнэ.
              </p>
            </div>
          )}

          {qty > 1 && (
            <p className="mt-6 text-[13px]">
              <span className="font-semibold">Нийт дүн:</span>{' '}
              <span className="font-bold">{formatMnt(subtotal)}</span>
            </p>
          )}

          <p className="mt-4 text-[13px] font-semibold">Тоо ширхэг:</p>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-3 sm:flex sm:flex-wrap">
            <div className="flex items-center border border-line">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink" aria-label="Тоо хасах">
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

            <Button
              ref={buyRef}
              variant="solid"
              size="touch"
              onClick={onBuy}
              disabled={buyDisabled}
              className="order-last col-span-2 w-full px-8 active:scale-[.98] sm:order-none sm:col-auto sm:w-auto sm:min-w-[160px] sm:flex-1"
            >
              {justAdded ? (
                <span className="tick-in inline-flex items-center gap-2"><IconCheck /> Нэмэгдлээ</span>
              ) : adding ? 'Нэмж байна…' : addLabel}
            </Button>

            <button
              onClick={onSave}
              className={`grid h-11 w-11 shrink-0 place-items-center justify-self-end rounded-full border sm:justify-self-auto ${
                saved ? 'border-sale text-sale' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
              aria-label="Хадгалах"
            >
              <IconHeart filled={saved} />
            </button>
          </div>

          {!preorder && !needsSize && (
            <p className="mt-3 text-[13px] text-ink-soft">
              {purchasable
                ? lowStock
                  ? `Үлдэгдэл ${selected?.quantity} ширхэг`
                  : 'Бэлэн байгаа'
                : 'Түр дууссан'}
            </p>
          )}

          {error && <p className="mt-3 text-[13px] text-sale">{error}</p>}

          <div className="mt-8 border-t border-line pt-6 text-[13px] text-ink-soft">
            <p className="font-semibold text-ink">Хүргэлт ба төлбөр</p>
            <p className="mt-2">{`Улаанбаатар хотод ажлын 1–2 хоногт. ${payNote}`}</p>
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

      {showBar && (
        <div className="fixed inset-x-0 bottom-(--bottom-nav-h) z-30 border-t border-line bg-paper/97 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3 lg:px-8">
            <div className="relative hidden h-12 w-12 shrink-0 overflow-hidden bg-shade sm:block">
              <ProductImage filePath={images[0]?.filePath} alt="" seed={product.slug} sizes="48px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{copy.title}</p>
              <p className="text-[13px] font-bold">{formatMnt(unitPrice)}</p>
            </div>
            {showBarSelect && (
              <Select
                value={(sized ? selected?.id : selectedId) ?? ''}
                onValueChange={(id) => {
                  const v = barOptions.find((x) => x.id === id)
                  if (!v) return
                  if (sized) pickSize(v)
                  else selectVariant(v)
                }}
              >
                <SelectTrigger
                  aria-label={sized ? 'Хэмжээ' : (optionLabel ?? undefined)}
                  className="hidden rounded-none px-3 text-[13px] sm:flex"
                >
                  <SelectValue placeholder={sized ? 'Хэмжээ' : undefined} />
                </SelectTrigger>
                <SelectContent position="popper" side="top" align="end" className="rounded-none border-line bg-paper">
                  {barOptions.map((v) => (
                    <SelectItem
                      key={v.id}
                      value={v.id}
                      disabled={sized && !variantAvailable(v)}
                      className="rounded-none text-[13px]"
                    >
                      {sized ? v.size : v.optionValue}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="solid" size="touch" onClick={onBuy} disabled={buyDisabled} className="px-7">
              {addLabel}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
