'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { copy, firstNode, formatMnt, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { IconClose, IconMinus, IconPlus, IconTrash } from './Icons'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_DEPOSIT_PCT, PREORDER_ARRIVAL_DAYS, depositOf, isPreorder, unitPriceOf } from '@/lib/preorder'
import { saleOf } from '@/lib/sale'
import { describeVariant } from '@/lib/sizes'
import { cartSplit } from './cartSplit'
import { useT } from '@/lib/i18n'

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
        />
      </SheetContent>
    </Sheet>
  )
}

interface CartPanelProps {
  confirmClear: boolean
  setConfirmClear: (value: boolean) => void
}

function CartPanel({ confirmClear, setConfirmClear }: CartPanelProps) {
  const { addPending, cartStale, setCartStale } = useUI()
  const { items, subtotal, count, loading, setQuantity, clear, refetch } = useCart()
  const listRef = useRef<HTMLUListElement>(null)
  const split = cartSplit(items)
  const t = useT()
  const sizeWord = t('Хэмжээ', 'Size')

  useEffect(() => {
    if (addPending || !listRef.current) return
    const last = listRef.current.lastElementChild
    if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [addPending, items.length])

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
        <SheetTitle className="text-[17px] font-semibold text-ink-strong">
          {t('Сагс', 'Cart')}
          {count > 0 && <span className="ml-1.5 font-normal text-ink-faint">{count}</span>}
        </SheetTitle>
        <SheetClose asChild>
          <Button variant="ghost" size="icon-touch" className="-mr-2" aria-label={t('Хаах', 'Close')}>
            <IconClose />
          </Button>
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        {loading && !addPending && <p className="label py-10 text-ink-faint">{t('Ачааллаж байна…', 'Loading…')}</p>}

        {cartStale && (
          <div className="mt-4 flex items-center gap-3 border border-line bg-paper-warm px-4 py-3">
            <p className="flex-1 text-[13px] text-ink-soft">
              {t(
                'Сагсыг шинэчилж чадсангүй. Энд харагдаж байгаа нь бүрэн бус байж болно.',
                'Could not refresh your cart. What you see here may be incomplete.',
              )}
            </p>
            <button
              onClick={() => { setCartStale(false); refetch().catch(() => setCartStale(true)) }}
              className="label link-underline shrink-0 text-ink"
            >
              {t('Дахин оролдох', 'Try again')}
            </button>
          </div>
        )}

        {addPending && (
          <div className="flex gap-4 py-5" aria-busy="true">
            <Skeleton className="aspect-square w-20 shrink-0 rounded-xl bg-shade" />
            <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-3.5 w-2/3 rounded bg-shade" />
              <Skeleton className="h-3 w-1/3 rounded bg-shade" />
              <Skeleton className="mt-4 h-8 w-24 rounded bg-shade" />
            </div>
          </div>
        )}

        {!loading && !addPending && items.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-ink-soft">{t('Сагс хоосон байна.', 'Your cart is empty.')}</p>
            <Link
              href="/shop"
              className="label link-underline mt-4 inline-block"
            >
              {t('Дэлгүүр рүү', 'Go to shop')}
            </Link>
          </div>
        )}

        <ul ref={listRef} className="stagger divide-y divide-line">
          {items.map((item, i) => {
            const variant = item.variant
            const product = variant?.product
            const title = copy(product).title ?? t('Бүтээгдэхүүн', 'Product')
            const image = firstNode(product?.productImageCollection)
            const normalPrice = toNumber(variant?.priceMnt)
            const unitPrice = unitPriceOf(variant, item.quantity)
            const line = unitPrice * item.quantity
            const sale = unitPrice === normalPrice ? saleOf(variant?.priceMnt, variant?.compareAtPriceMnt) : null
            const staggerStyle: StaggerStyle = { '--i': i }
            const preorder = isPreorder(variant, item.quantity)
            const variantLabel = describeVariant(variant, sizeWord)
            const pct = product?.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT
            const setLineQuantity = (quantity: number) => {
              if (variant) setQuantity(variant.id, quantity)
            }
            return (
              <li key={item.id} style={staggerStyle} className="flex gap-3.5 py-4">
                <Link
                  href={`/shop/${product?.slug ?? ''}`}
                  className="relative aspect-[4/5] w-[72px] shrink-0 overflow-hidden rounded-lg bg-shade"
                >
                  <ProductImage filePath={image?.filePath} alt={title} seed={product?.slug} sizes="72px" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-[14px] font-medium leading-snug text-ink-strong">{title}</p>
                    <span className="flex shrink-0 flex-col items-end text-[14px] font-semibold tabular-nums">
                      <span className={sale ? 'text-sale' : undefined}>{formatMnt(line)}</span>
                      {(sale || unitPrice !== normalPrice) && (
                        <s className="text-[12px] font-normal text-ink-faint">
                          {formatMnt((sale ? sale.was : normalPrice) * item.quantity)}
                        </s>
                      )}
                    </span>
                  </div>
                  {(variantLabel || item.quantity > 1) && (
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-ink-faint">
                      {variantLabel && <span>{variantLabel}</span>}
                      {item.quantity > 1 && <span className="tabular-nums">{item.quantity} × {formatMnt(unitPrice)}</span>}
                    </p>
                  )}
                  {preorder && (
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-soft">
                      <span aria-hidden className="preorder-dot" />
                      <span>
                        {t('Урьдчилгаа', 'Deposit')} <span className="font-semibold tabular-nums text-ink">{formatMnt(depositOf(line, pct))}</span>
                      </span>
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2.5">
                    <div className="flex items-center rounded-full border border-line">
                      <button
                        className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:text-ink sm:h-8 sm:w-8"
                        onClick={() => setLineQuantity(item.quantity - 1)}
                        aria-label={t('Тоо хасах', 'Decrease quantity')}
                      >
                        <IconMinus width="16" height="16" />
                      </button>
                      <span className="min-w-6 text-center text-[13px] tabular-nums">{item.quantity}</span>
                      <button
                        className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:text-ink disabled:opacity-30 sm:h-8 sm:w-8"
                        onClick={() => setLineQuantity(item.quantity + 1)}
                        disabled={!variant?.allowBackorder && item.quantity >= (variant?.quantity ?? 0)}
                        aria-label={t('Нэмэх', 'Increase quantity')}
                      >
                        <IconPlus width="16" height="16" />
                      </button>
                    </div>
                    <button
                      onClick={() => setLineQuantity(0)}
                      className="grid h-10 w-10 place-items-center rounded-full text-ink-faint transition-colors hover:bg-line-soft hover:text-ink sm:h-8 sm:w-8"
                      aria-label={t(`${title}-г сагснаас хасах`, `Remove ${title}`)}
                      title={t('Хасах', 'Remove')}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {items.length > 0 && (
        <div className="border-t border-line px-6 pb-5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-ink-soft">{t('Барааны дүн', 'Subtotal')}</span>
            <span className="text-[17px] font-semibold tabular-nums text-ink-strong">{formatMnt(subtotal)}</span>
          </div>
          {split.hasPreorder && (
            <div className="mt-3 rounded-xl bg-note-soft px-3.5 py-2.5">
              <div className="flex items-baseline justify-between text-[14px]">
                <span className="font-semibold text-ink-strong">{t('Одоо төлөх', 'Due now')}</span>
                <span className="font-semibold tabular-nums text-ink-strong">{formatMnt(split.upfront)}</span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">
                {t(
                  `Энэ бол хамгийн бага урьдчилгаа. Бараа захиалга баталгаажсанаас хойш ${PREORDER_ARRIVAL_DAYS} хоногт ирэх бөгөөд үлдэгдлийг тэр үед төлнө.`,
                  `The minimum deposit. Items arrive ${PREORDER_ARRIVAL_DAYS} days after your order is confirmed; you pay the rest then.`,
                )}
              </p>
            </div>
          )}
          <p className="mt-2.5 text-[12px] text-ink-faint">
            {t('Хүргэлтийн төлбөр дараагийн алхамд нэмэгдэнэ.', 'Delivery is added in the next step.')}
          </p>
          <Button asChild variant="solid" size="cta" className="mt-4 w-full">
            <Link href="/checkout">{t('Захиалах', 'Checkout')}</Link>
          </Button>
          {confirmClear ? (
            <div className="mt-3 flex items-center justify-center gap-4">
              <span className="text-[13px] text-ink-soft">{t('Бүгдийг хасах уу?', 'Remove everything?')}</span>
              <button
                onClick={() => { clear(); setConfirmClear(false) }}
                className="label text-sale underline underline-offset-4"
              >
                {t('Тийм, хоослох', 'Yes, empty it')}
              </button>
              <button onClick={() => setConfirmClear(false)} className="label text-ink-soft">
                {t('Болих', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="mx-auto mt-3 block text-[13px] text-ink-faint underline-offset-4 hover:text-ink hover:underline"
            >
              {t('Сагс хоослох', 'Empty cart')}
            </button>
          )}
        </div>
      )}
    </>
  )
}
