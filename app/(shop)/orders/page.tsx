'use client'

import Link from 'next/link'
import { useQuery } from '@apollo/client/react'
import { MY_ORDERS } from '@/lib/queries'
import { nodes } from '@/lib/format'
import { useSession } from '@/components/useSession'
import { useT } from '@/lib/i18n'
import OrderCard from '@/components/OrderCard'
import type { Connection, Order } from '@/lib/types'

interface MyOrdersData {
  orderCollection: Connection<Order> | null
}

export default function OrdersPage() {
  const { isAuthenticated, ready, user } = useSession()
  const t = useT()
  const { data, loading } = useQuery<MyOrdersData>(MY_ORDERS, {
    variables: { profileId: user?.id },
    skip: !isAuthenticated || !user?.id,
  })
  const orders = nodes(data?.orderCollection)

  return (
    <div className="mx-auto max-w-[720px] px-5 py-10 sm:px-8 sm:py-12">
      <h1 className="display text-[clamp(1.8rem,4vw,2.75rem)]">{t('Миний захиалга', 'My orders')}</h1>

      {!ready || loading ? (
        <p className="label mt-10 text-ink-faint">{t('Ачааллаж байна…', 'Loading…')}</p>
      ) : !isAuthenticated ? (
        <div className="mt-8 rounded-2xl border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">{t('Захиалгаа харахын тулд нэвтэрнэ үү.', 'Log in to see your orders.')}</p>
          <Link href="/login?next=/orders" className="label link-underline mt-4 inline-block">{t('Нэвтрэх', 'Log in')}</Link>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-paper-warm px-5 py-16 text-center">
          <p className="text-ink-soft">{t('Одоогоор захиалга алга.', 'No orders yet.')}</p>
          <Link href="/shop" className="label link-underline mt-4 inline-block">{t('Дэлгүүр рүү', 'Go to the shop')}</Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
