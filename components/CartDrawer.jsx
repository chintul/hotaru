'use client'

import Link from 'next/link'
import { useUI } from './UIProvider'
import { useCart } from './useCart'
import { copy, firstNode, formatMnt, toNumber } from '@/lib/format'
import ProductImage from './ProductImage'
import { IconClose, IconMinus, IconPlus } from './Icons'

export default function CartDrawer() {
  const { cartOpen, setCartOpen } = useUI()
  const { items, subtotal, loading, setQuantity, clear } = useCart()

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Сагс">
      <button
        className="overlay-in absolute inset-0 bg-ink/25"
        onClick={() => setCartOpen(false)}
        aria-label="Хаах"
      />
      <aside className="drawer-in absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-paper">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="nav-link text-[14px]">Сагс{items.length ? ` (${items.length})` : ''}</p>
          <button onClick={() => setCartOpen(false)} className="icon-btn -mr-2" aria-label="Хаах">
            <IconClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {loading && <p className="label py-10 text-ink-faint">Ачааллаж байна…</p>}

          {!loading && items.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-ink-soft">Сагс хоосон байна.</p>
              <Link
                href="/shop"
                onClick={() => setCartOpen(false)}
                className="label link-underline mt-4 inline-block"
              >
                Дэлгүүр рүү
              </Link>
            </div>
          )}

          <ul className="divide-y divide-line">
            {items.map((item) => {
              const variant = item.variant
              const product = variant?.product
              const title = copy(product).title ?? 'Бүтээгдэхүүн'
              const image = firstNode(product?.productImageCollection)
              const line = toNumber(variant?.priceMnt) * item.quantity
              return (
                <li key={item.id} className="flex gap-4 py-5">
                  <Link
                    href={`/shop/${product?.slug ?? ''}`}
                    onClick={() => setCartOpen(false)}
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
                        <button
                          className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink"
                          onClick={() => setQuantity(variant.id, item.quantity - 1)}
                          aria-label="Хасах"
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
              onClick={() => setCartOpen(false)}
              className="btn-solid mt-4 block py-4 text-center"
            >
              Захиалах
            </Link>
            <button onClick={clear} className="label link-underline mt-3 text-ink-faint">
              Сагс хоослох
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
