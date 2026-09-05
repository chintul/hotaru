'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PRODUCTS } from '@/lib/queries'
import { copy, formatMnt, nodes } from '@/lib/format'
import { Search as SearchIcon } from './icons'

/**
 * ⌘K palette. The point is not novelty: with one owner running the store from a
 * phone or a laptop, jumping straight to an order number is the single most
 * common action, and it is otherwise three clicks and a scan of a table.
 */
export default function CommandPalette({ open, onClose, nav }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const [cursor, setCursor] = useState(0)

  const { data: orderData } = useQuery(ADMIN_ALL_ORDERS, { variables: { first: 50 }, skip: !open })
  const { data: productData } = useQuery(ADMIN_PRODUCTS, { variables: { first: 100 }, skip: !open })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40)
    else { setQ(''); setCursor(0) }
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    const pages = nav
      .filter((n) => !term || n.label.toLowerCase().includes(term))
      .map((n) => ({ id: `nav-${n.href}`, group: 'Хуудас', label: n.label, href: n.href }))

    if (!term) return pages

    const orders = nodes(orderData?.orderCollection)
      .filter((o) => o.orderNumber.toLowerCase().includes(term) || (o.email ?? '').toLowerCase().includes(term))
      .slice(0, 6)
      .map((o) => ({
        id: `o-${o.id}`, group: 'Захиалга',
        label: `${o.orderNumber} · ${o.email}`, hint: formatMnt(o.totalMnt),
        href: `/admin/orders/${o.orderNumber}`,
      }))

    const products = nodes(productData?.productCollection)
      .filter((p) => (copy(p).title ?? p.slug).toLowerCase().includes(term) || p.slug.includes(term))
      .slice(0, 6)
      .map((p) => ({
        id: `p-${p.id}`, group: 'Бараа',
        label: copy(p).title ?? p.slug, hint: formatMnt(p.minPriceMnt),
        href: '/admin/inventory',
      }))

    return [...pages, ...orders, ...products]
  }, [q, nav, orderData, productData])

  useEffect(() => { setCursor(0) }, [q])
  if (!open) return null

  const go = (item) => { if (item) { router.push(item.href); onClose() } }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/25" onClick={onClose} aria-label="Хаах" />
      <div className="absolute left-1/2 top-[15vh] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border border-a-line bg-white shadow-xl">
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
