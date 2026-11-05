'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { MY_ORDERS } from '@/lib/queries'
import { orderStatusLabel, formatDate, formatMnt, nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useLang, useT } from '@/lib/i18n'
import type { Connection, Order } from '@/lib/types'

interface MyOrdersData {
  orderCollection: Connection<Order> | null
}

export default function OrdersPage() {
  const { isAuthenticated, ready, user } = useSession()
  const t = useT()
  const lang = useLang()
  const { data, loading } = useQuery<MyOrdersData>(MY_ORDERS, {
    variables: { profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  })
  const orders = nodes(data?.orderCollection)

  return (
    <div className="mx-auto max-w-[900px] px-5 py-12 sm:px-8">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">{t('Миний захиалга', 'My orders')}</h1>

      {!ready || loading ? (
        <p className="label mt-10 text-ink-faint">{t('Ачааллаж байна…', 'Loading…')}</p>
      ) : !isAuthenticated ? (
        <div className="mt-10 border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">{t('Захиалгаа харахын тулд нэвтэрнэ үү.', 'Log in to see your orders.')}</p>
          <Link href="/login?next=/orders" className="label link-underline mt-4 inline-block">{t('Нэвтрэх', 'Log in')}</Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">{t('Одоогоор захиалга алга.', 'No orders yet.')}</p>
          <Link href="/shop" className="label link-underline mt-4 inline-block">{t('Дэлгүүр рүү', 'Go to the shop')}</Link>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.orderNumber}`} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-5">
                <span className="font-medium tabular-nums">{o.orderNumber}</span>
                <span className="label text-ink-faint">{formatDate(o.placedAt)}</span>
                <span className="label text-ink-soft">{orderStatusLabel(o.status, lang)}</span>
                <span className="ml-auto tabular-nums">{formatMnt(o.totalMnt)}</span>
                {o.status === 'awaiting_balance' && (
                  <span className="mt-2 flex w-full items-center justify-between gap-3 rounded-full bg-ink-strong px-4 py-2.5 text-[13px] font-semibold text-paper">
                    <span>{t('Үлдэгдэл төлөх', 'Pay the balance')}</span>
                    <span className="tabular-nums">{formatMnt(o.balanceMnt)}</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
