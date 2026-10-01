'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { copy, firstNode, formatMnt, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { IconClose, IconMinus, IconPlus } from './Icons'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_DEPOSIT_PCT, depositOf, isPreorder } from '@/lib/preorder'
import PreorderTag from './PreorderTag'
import { cartSplit } from './cartSplit'

type StaggerStyle = CSSProperties & { '--i': number }

export default function CartDrawer() {
  const { isOpen, close: closeOverlay } = useUI()
  const cartOpen = isOpen('cart')
  const [confirmClear, setConfirmClear] = useState(false)

  const closeAndDisarmClear = useCallback(() => {
    setConfirmClear(false)
    closeOverlay()
  }, [closeOverlay])

  return (
    <Sheet open={cartOpen} onOpenChange={(next) => { if (!next) closeAndDisarmClear() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-describedby={undefined}
        className="w-full max-w-[420px] gap-0 border-l-0 sm:max-w-[420px]"
      >
        <CartPanel
          confirmClear={confirmClear}
          setConfirmClear={setConfirmClear}
          onClose={closeAndDisarmClear}
        />
      </SheetContent>
    </Sheet>
  )
}

interface CartPanelProps {
  confirmClear: boolean
  setConfirmClear: (value: boolean) => void
  onClose: () => void
}

function CartPanel({ confirmClear, setConfirmClear, onClose }: CartPanelProps) {
  const { addPending, cartStale, setCartStale } = useUI()
  const { items, subtotal, count, loading, setQuantity, clear, refetch } = useCart()
  const listRef = useRef<HTMLUListElement>(null)
  const split = cartSplit(items)

  useEffect(() => {
    if (addPending || !listRef.current) return
    const last = listRef.current.lastElementChild
    if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [addPending, items.length])

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-6 py-4">
        <SheetTitle className="nav-link text-[14px] font-bold text-ink-strong">Сагс{count ? ` (${count})` : ''}</SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-touch" className="-mr-2" aria-label="Хаах">
            <IconClose />
          </Button>
        </SheetClose>
      </div>

      <div className="border-b border-line px-6 py-2">
        <button
          onClick={onClose}
          className="tap label text-ink-soft transition-colors hover:text-ink"
        >
          ← Дэлгүүр рүү буцах
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {loading && !addPending && <p className="label py-10 text-ink-faint">Ачааллаж байна…</p>}

        {cartStale && (
          <div className="mt-4 flex items-center gap-3 border border-line bg-paper-warm px-4 py-3">
            <p className="flex-1 text-[13px] text-ink-soft">
              Сагсыг шинэчилж чадсангүй. Энд харагдаж байгаа нь бүрэн бус байж болно.
            </p>
            <button
              onClick={() => { setCartStale(false); refetch().catch(() => setCartStale(true)) }}
              className="label link-underline shrink-0 text-ink"
            >
              Дахин оролдох
            </button>
          </div>
        )}

        {addPending && (
          <div className="flex gap-4 py-5" aria-busy="true">
            <Skeleton className="aspect-square w-20 shrink-0 rounded-none bg-shade" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-3.5 w-2/3 rounded bg-shade" />
              <Skeleton className="h-3 w-1/3 rounded bg-shade" />
              <Skeleton className="mt-4 h-8 w-24 rounded bg-shade" />
            </div>
          </div>
        )}

        {!loading && !addPending && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-ink-soft">Сагс хоосон байна.</p>
            <Link
              href="/shop"
              className="label link-underline mt-4 inline-block"
            >
              Дэлгүүр рүү
            </Link>
          </div>
        )}

        <ul ref={listRef} className="stagger divide-y divide-line">
          {items.map((item, i) => {
            const variant = item.variant
            const product = variant?.product
            const title = copy(product).title ?? 'Бүтээгдэхүүн'
            const image = firstNode(product?.productImageCollection)
            const line = toNumber(variant?.priceMnt) * item.quantity
            const staggerStyle: StaggerStyle = { '--i': i }
            const preorder = isPreorder(variant, item.quantity)
            const pct = product?.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT
            const setLineQuantity = (quantity: number) => {
              if (variant) setQuantity(variant.id, quantity)
            }
            return (
              <li key={item.id} style={staggerStyle} className="flex gap-4 py-5">
                <Link
                  href={`/shop/${product?.slug ?? ''}`}
                  className="relative aspect-square w-20 shrink-0 overflow-hidden bg-paper-warm"
                >
                  <ProductImage filePath={image?.filePath} alt={title} seed={product?.slug} sizes="80px" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{title}</p>
                  {variant?.optionLabel && (
                    <p className="label mt-0.5 text-ink-faint">
                      {variant.optionLabel}: {variant.optionValue}
                    </p>
                  )}
                  {preorder ? (
                    <>
                      <PreorderTag eta={product?.preorderEta} className="mt-1.5" />
                      <p className="mt-1.5 text-[13px] text-ink-soft">
                        Үндсэн үнэ <span className="tabular-nums">{formatMnt(variant?.priceMnt)}</span>
                      </p>
                      <p className="text-[13px] text-ink-soft">
                        Хамгийн багадаа {pct}% ·{' '}
                        <span className="font-semibold text-ink tabular-nums">{formatMnt(depositOf(line, pct))}</span>
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-ink-soft">{formatMnt(variant?.priceMnt)}</p>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center border border-line">
                      <button
                        className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink sm:h-8 sm:w-8"
                        onClick={() => setLineQuantity(item.quantity - 1)}
                        aria-label="Тоо хасах"
                      >
                        <IconMinus />
                      </button>
                      <span className="min-w-7 text-center tabular-nums">{item.quantity}</span>
                      <button
                        className="grid h-11 w-11 place-items-center text-ink-soft hover:text-ink disabled:opacity-30 sm:h-8 sm:w-8"
                        onClick={() => setLineQuantity(item.quantity + 1)}
                        disabled={!variant?.allowBackorder && item.quantity >= (variant?.quantity ?? 0)}
                        aria-label="Нэмэх"
                      >
                        <IconPlus />
                      </button>
                    </div>
                    <button
                      onClick={() => setLineQuantity(0)}
                      className="label link-underline text-ink-faint"
                    >
                      Хасах
                    </button>
                    <span className="ml-auto tabular-nums">{formatMnt(line)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {items.length > 0 && (
        <div className="border-t border-line px-6 py-5">
          <div className="flex items-baseline justify-between">
            <span className="label text-ink-faint">Дүн</span>
            <span className="text-[15px] tabular-nums">{formatMnt(subtotal)}</span>
          </div>
          {split.hasPreorder && (
            <div className="mt-2 space-y-1 rounded-2xl bg-paper-warm px-4 py-3 text-[13px]">
              <div className="flex items-baseline justify-between text-ink-soft">
                <span>Бүтэн дүн</span>
                <span className="tabular-nums">{formatMnt(split.total)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Одоо хамгийн багадаа</span>
                <span className="font-semibold tabular-nums">{formatMnt(split.upfront)}</span>
              </div>
              <p className="pt-1 text-[12px] leading-relaxed text-ink-soft">
                Хамгийн багадаа {formatMnt(split.upfront)} урьдчилж төлнө, бүтэн дүнгээр ч төлж болно.
              </p>
            </div>
          )}
          <p className="label mt-1 text-ink-faint">Хүргэлтийн төлбөр төлбөрийн хэсэгт нэмэгдэнэ</p>
          <Button asChild variant="solid" size="cta" className="mt-4 w-full">
            <Link href="/checkout">Захиалах</Link>
          </Button>
          {confirmClear ? (
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => { clear(); setConfirmClear(false) }}
                className="label text-sale underline underline-offset-4"
              >
                Тийм, хоослох
              </button>
              <button onClick={() => setConfirmClear(false)} className="label text-ink-soft">
                Болих
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="label link-underline mt-3 text-ink-soft"
            >
              Сагс хоослох
            </button>
          )}
        </div>
      )}
    </>
  )
}
