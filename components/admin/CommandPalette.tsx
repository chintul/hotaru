'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TypedDocumentNode } from '@apollo/client'
import { useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PRODUCTS } from '@/lib/queries'
import { copy, formatMnt, nodes } from '@/lib/format'
import type { Connection, Order, Product } from '@/lib/types'
import { Search as SearchIcon } from './icons'

export interface PaletteNavItem {
  href: string
  label: string
}

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  nav: readonly PaletteNavItem[]
}

interface PaletteResult {
  id: string
  group: string
  label: string
  hint?: string
  href: string
}

interface IlikeFilter {
  ilike: string
}

interface OrderFilter {
  or: ({ orderNumber: IlikeFilter } | { email: IlikeFilter })[]
}

type PaletteProduct = Product & { id: string }

const ordersQuery: TypedDocumentNode<
  { orderCollection: Connection<Order> | null },
  { first: number; filter: OrderFilter | null }
> = ADMIN_ALL_ORDERS

const productsQuery: TypedDocumentNode<
  { productCollection: Connection<PaletteProduct> | null },
  { first: number }
> = ADMIN_PRODUCTS

const ORDER_RESULT_LIMIT = 6
const PRODUCT_RESULT_LIMIT = 6
const CATALOG_WINDOW = 100

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`)

export default function CommandPalette({ open, onClose, nav }: CommandPaletteProps) {
  if (!open) return null
  return <Palette onClose={onClose} nav={nav} />
}

function Palette({ onClose, nav }: Omit<CommandPaletteProps, 'open'>) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [rawCursor, setCursor] = useState(0)

  const term = q.trim()

  const orderFilter = useMemo<OrderFilter | null>(() => {
    if (!term) return null
    const like = `%${escapeLike(term)}%`
    return { or: [{ orderNumber: { ilike: like } }, { email: { ilike: like } }] }
  }, [term])

  const { data: orderData } = useQuery(ordersQuery, {
    variables: { first: ORDER_RESULT_LIMIT, filter: orderFilter },
    skip: !term,
  })
  const { data: productData } = useQuery(productsQuery, { variables: { first: CATALOG_WINDOW } })

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }) }, [])

  const results = useMemo<PaletteResult[]>(() => {
    const lower = term.toLowerCase()
    const pages: PaletteResult[] = nav
      .filter((n) => !lower || n.label.toLowerCase().includes(lower))
      .map((n) => ({ id: `nav-${n.href}`, group: 'Хуудас', label: n.label, href: n.href }))

    if (!lower) return pages

    const orders: PaletteResult[] = nodes(orderData?.orderCollection)
      .map((o) => ({
        id: `o-${o.id}`, group: 'Захиалга',
        label: `${o.orderNumber} · ${o.email}`, hint: formatMnt(o.totalMnt),
        href: `/admin/orders/${o.orderNumber}`,
      }))

    const titleOf = (p: PaletteProduct) => copy(p).title ?? p.slug

    const products: PaletteResult[] = nodes(productData?.productCollection)
      .filter((p) => titleOf(p).toLowerCase().includes(lower) || p.slug.includes(lower))
      .slice(0, PRODUCT_RESULT_LIMIT)
      .map((p) => ({
        id: `p-${p.id}`, group: 'Бараа',
        label: titleOf(p), hint: formatMnt(p.minPriceMnt),
        href: `/admin/products/${p.id}`,
      }))

    return [...pages, ...orders, ...products]
  }, [term, nav, orderData, productData])

  const cursor = Math.min(rawCursor, Math.max(0, results.length - 1))

  const go = (item: PaletteResult | undefined) => { if (item) { router.push(item.href); onClose() } }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/25" onClick={onClose} aria-label="Хаах" />
      <div className="absolute left-1/2 top-[15vh] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-a-line bg-a-surface shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-a-line px-4 py-3">
          <span className="text-a-muted"><SearchIcon /></span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
              if (e.key === 'Enter') { e.preventDefault(); go(results[cursor]) }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="Захиалгын дугаар, бараа, хуудас…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-a-muted"
          />
          <kbd className="rounded border border-a-line px-1.5 text-[11px] text-a-muted">esc</kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-a-muted">Илэрц алга</li>}
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === cursor ? 'bg-a-hover' : ''}`}
              >
                <span className="w-[64px] shrink-0 text-[11px] uppercase tracking-wide text-a-muted">{r.group}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-a-ink">{r.label}</span>
                {r.hint && <span className="shrink-0 text-[12px] tabular-nums text-a-muted">{r.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
