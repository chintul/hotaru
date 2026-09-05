'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { MY_ORDERS } from '@/lib/queries'
import { ORDER_STATUS_LABEL, formatDate, formatMnt, nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'

export default function OrdersPage() {
  const { isAuthenticated, ready, user } = useSession()
  const { data, loading } = useQuery(MY_ORDERS, {
    variables: { profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  })
  const orders = nodes(data?.orderCollection)

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-8">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">Миний захиалга</h1>

      {!ready || loading ? (
        <p className="label mt-10 text-ink-faint">Ачааллаж байна…</p>
      ) : !isAuthenticated ? (
        <div className="mt-10 border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">Захиалгаа харахын тулд нэвтэрнэ үү.</p>
          <Link href="/login?next=/orders" className="label link-underline mt-4 inline-block">Нэвтрэх</Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">Одоогоор захиалга алга.</p>
          <Link href="/shop" className="label link-underline mt-4 inline-block">Дэлгүүр рүү</Link>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.orderNumber}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-5">
                <span className="font-medium tabular-nums">{o.orderNumber}</span>
                <span className="label text-ink-faint">{formatDate(o.placedAt)}</span>
                <span className="label text-ink-soft">{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
                <span className="ml-auto tabular-nums">{formatMnt(o.totalMnt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
