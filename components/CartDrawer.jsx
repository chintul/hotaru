'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { copy, firstNode, formatMnt, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { IconClose, IconMinus, IconPlus } from './Icons'

export default function CartDrawer() {
  const { cartOpen, setCartOpen, addPending } = useUI()
  const { items, subtotal, count, loading, setQuantity, clear } = useCart()
  // Two taps to empty a cart. The button sat 12px under the checkout CTA, at
  // the bottom of a full-height drawer, exactly in the one-handed thumb arc,
  // with no confirm and no undo. One slip there is a whole lost order from a
  // shopper who will not come back to rebuild it.
  const [confirmClear, setConfirmClear] = useState(false)
  const listRef = useRef(null)

  // Every dismissal goes through here, so an armed "empty the cart" confirm can
  // never survive a close and be waiting on the next open. Resetting it in an
  // effect keyed on cartOpen would be setState-in-effect, which this repo's
  // react-hooks config rejects.
  const close = useCallback(() => {
    setConfirmClear(false)
    setCartOpen(false)
  }, [setCartOpen])

  // The drawer opens on the click, and the line that was just added arrives
  // LAST — below the fold on any cart past three items. All the optimistic work
  // bought a confirmation the shopper never saw. Scroll to it.
  useEffect(() => {
    if (!cartOpen || addPending || !listRef.current) return
    const last = listRef.current.lastElementChild
    if (last) last.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cartOpen, addPending, items.length])

  // Android's back button should close the drawer, not leave the product page.
  useEffect(() => {
    if (!cartOpen) return undefined
    window.history.pushState({ hotaruCart: true }, '')
    const onPop = () => close()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Only unwind the entry we added, and only if it is still the current one.
      if (window.history.state?.hotaruCart) window.history.back()
    }
  }, [cartOpen, close])

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Сагс">
      <button
        className="overlay-in absolute inset-0 bg-ink/25"
        onClick={close}
        aria-label="Хаах"
      />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-paper">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          {/* Same total as the header badge: units, not line items. The two
              disagreed when a single line held more than one of something. */}
          <p className="nav-link text-[14px]">Сагс{count ? ` (${count})` : ''}</p>
          <button onClick={close} className="icon-btn -mr-2" aria-label="Хаах">
            <IconClose />
          </button>
        </div>

        {/* The drawer measures 390px on a 390px viewport, so the overlay
            dismiss behind it is completely covered and the only exit was a
            40x40 target in the far top corner. This one is reachable one-handed. */}
        <div className="border-b border-line px-6 py-2">
          <button
            onClick={close}
            className="label text-ink-soft transition-colors hover:text-ink"
          >
            ← Дэлгүүр рүү буцах
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {loading && !addPending && <p className="label py-10 text-ink-faint">Ачааллаж байна…</p>}

          {/* The drawer now opens on the click, not on the server's answer, so
              for the length of one round trip there is a line on its way that
              nothing can show yet. A skeleton says "this is arriving" where an
              empty basket would say "that did nothing" — which is exactly the
              wrong answer to a tap that just worked. */}
          {addPending && (
            <div className="flex animate-pulse gap-4 py-5">
              <div className="aspect-square w-20 shrink-0 bg-shade" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-2/3 rounded bg-shade" />
                <div className="h-3 w-1/3 rounded bg-shade" />
                <div className="mt-4 h-8 w-24 rounded bg-shade" />
              </div>
            </div>
          )}

          {!loading && !addPending && items.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-ink-soft">Сагс хоосон байна.</p>
              <Link
                href="/shop"
                onClick={close}
                className="label link-underline mt-4 inline-block"
              >
                Дэлгүүр рүү
              </Link>
            </div>
          )}

          {/* Lines arrive staggered rather than all at once, so a full basket
              reads as a list being dealt out instead of a block appearing. The
              index feeds the delay; globals.css caps it so a long cart does not
              leave the last line waiting. */}
          <ul ref={listRef} className="stagger divide-y divide-line">
            {items.map((item, i) => {
              const variant = item.variant
              const product = variant?.product
              const title = copy(product).title ?? 'Бүтээгдэхүүн'
              const image = firstNode(product?.productImageCollection)
              const line = toNumber(variant?.priceMnt) * item.quantity
              return (
                <li key={item.id} style={{ '--i': i }} className="flex gap-4 py-5">
                  <Link
                    href={`/shop/${product?.slug ?? ''}`}
                    onClick={close}
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
                    <p className="mt-1 text-ink-soft">{formatMnt(variant?.priceMnt)}</p>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-line">
                        {/* "Тоо хасах", not "Хасах": the remove-line control
                            further down is also labelled Хасах, so a screen
                            reader heard the same word for "one fewer" and for
                            "delete this line". */}
                        <button
                          className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink"
                          onClick={() => setQuantity(variant.id, item.quantity - 1)}
                          aria-label="Тоо хасах"
                        >
                          <IconMinus />
                        </button>
                        <span className="min-w-7 text-center tabular-nums">{item.quantity}</span>
                        <button
                          className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-30"
                          onClick={() => setQuantity(variant.id, item.quantity + 1)}
                          disabled={!variant?.allowBackorder && item.quantity >= variant?.quantity}
                          aria-label="Нэмэх"
                        >
                          <IconPlus />
                        </button>
                      </div>
                      <button
                        onClick={() => setQuantity(variant.id, 0)}
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
            <p className="label mt-1 text-ink-faint">Хүргэлтийн төлбөр төлбөрийн хэсэгт нэмэгдэнэ</p>
            <Link
              href="/checkout"
              onClick={close}
              className="btn-solid mt-4 block py-4 text-center"
            >
              Захиалах
            </Link>
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
      </aside>
    </div>
  )
}
