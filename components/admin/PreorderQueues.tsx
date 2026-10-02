'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { CONFIRM_PAYMENT } from '@/lib/queries'
import { formatDate, formatMnt, nodes } from '@/lib/format'
import { errorMessage } from '@/lib/errors'
import type { Connection, Order } from '@/lib/types'
import { Button, Card, Status } from './ui'
import { useConfirm } from './confirm'
import { REQUEST_BALANCE_LABEL, upfrontOf, useRequestBalance } from './preorder'

export interface PreorderQueuesProps {
  depositPaid: Connection<Order> | null | undefined
  awaitingBalance: Connection<Order> | null | undefined
  onDone: () => unknown
}

const customerOf = (o: Order) => o.email || o.phone || '—'

function OrderLink({ order }: { order: Order }) {
  return (
    <Link href={`/admin/orders/${order.orderNumber}`} className="font-medium tabular-nums text-a-ink hover:underline">
      {order.orderNumber}
    </Link>
  )
}

export default function PreorderQueues({ depositPaid, awaitingBalance, onDone }: PreorderQueuesProps) {
  const waiting = nodes(depositPaid)
  const balance = nodes(awaitingBalance)
  if (waiting.length === 0 && balance.length === 0) return null

  return (
    <div className="mb-5 grid gap-4 xl:grid-cols-2">
      {waiting.length > 0 && (
        <WaitingForGoods orders={waiting} count={depositPaid?.totalCount ?? waiting.length} onDone={onDone} />
      )}
      {balance.length > 0 && (
        <AwaitingBalance orders={balance} count={awaitingBalance?.totalCount ?? balance.length} onDone={onDone} />
      )}
    </div>
  )
}

interface QueueProps {
  orders: Order[]
  count: number
  onDone: () => unknown
}

function WaitingForGoods({ orders, count, onDone }: QueueProps) {
  const requestBalance = useRequestBalance(onDone)

  return (
    <Card
      title={`Бараа хүлээж буй урьдчилсан захиалга (${count})`}
      subtitle="Урьдчилгаа орсон. Бараа ирмэгц үлдэгдлийг нэхэмжилнэ."
      padded={false}
    >
      <ul>
        {orders.map((o) => {
          const items = nodes(o.orderItemCollection)
          return (
            <li key={o.id} className="grid gap-2 border-b border-a-line px-6 py-3 last:border-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
                <span className="flex min-w-0 items-baseline gap-2">
                  <OrderLink order={o} />
                  <span className="truncate text-a-muted">{customerOf(o)}</span>
                </span>
                <span className="text-[12px] text-a-muted">
                  {o.paidAt ? `Урьдчилгаа ${formatDate(o.paidAt)}` : ''}
                </span>
              </div>
              {items.length > 0 && (
                <ul className="grid gap-0.5 text-[12px] text-a-muted">
                  {items.map((i) => (
                    <li key={i.id}>
                      <span className="text-a-ink">{i.productTitle}</span>
                      {i.variantLabel ? ` · ${i.variantLabel}` : ''} ×{i.quantity}
                      {' — '}{i.preorderEta ? `ирэх: ${i.preorderEta}` : 'ирэх хугацаагүй'}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12px] tabular-nums text-a-muted">
                  Төлсөн <span className="text-a-ink">{formatMnt(upfrontOf(o))}</span>
                  {' · '}үлдэгдэл <span className="font-semibold text-a-ink">{formatMnt(o.balanceMnt)}</span>
                </span>
                <Button size="sm" variant="primary" disabled={requestBalance.loading} onClick={() => requestBalance.run(o)}>
                  {REQUEST_BALANCE_LABEL}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      {requestBalance.error && (
        <p className="border-t border-a-line px-6 py-3 text-[13px] text-danger-ink">{requestBalance.error}</p>
      )}
    </Card>
  )
}

function AwaitingBalance({ orders, count, onDone }: QueueProps) {
  const [confirmPayment, { loading }] = useMutation<unknown, { orderId: string; externalReference: string | null }>(CONFIRM_PAYMENT)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const sorted = [...orders].sort((a, b) =>
    Number(b.paymentStatus === 'submitted') - Number(a.paymentStatus === 'submitted'))

  const onConfirm = async (o: Order) => {
    const ok = await confirm({
      title: `${o.orderNumber}: үлдэгдэл ${formatMnt(o.balanceMnt)} баталгаажуулах уу?`,
      description: 'Дансандаа орсныг шалгасны дараа баталгаажуулна. Үүний дараа захиалгыг бэлтгэж илгээнэ.',
      confirmLabel: 'Үлдэгдэл баталгаажуулах',
    })
    if (!ok) return
    setError(null)
    try {
      await confirmPayment({ variables: { orderId: o.id, externalReference: null } })
      await onDone()
    } catch (e) {
      setError(errorMessage(e, 'Алдаа гарлаа.'))
    }
  }

  return (
    <Card
      title={`Үлдэгдэл хүлээж буй (${count})`}
      subtitle="Нэхэмжилсэн. Төлбөр ормогц баталгаажуулж, бэлтгэж илгээнэ."
      padded={false}
    >
      <ul>
        {sorted.map((o) => {
          const submitted = o.paymentStatus === 'submitted'
          return (
            <li
              key={o.id}
              className={`flex flex-wrap items-center justify-between gap-3 border-b border-a-line px-6 py-3 last:border-0 ${
                submitted ? 'bg-warn-soft' : ''
              }`}
            >
              <div className="grid min-w-0 gap-0.5 text-[13px]">
                <span className="flex min-w-0 items-baseline gap-2">
                  <OrderLink order={o} />
                  <span className="truncate text-a-muted">{customerOf(o)}</span>
                </span>
                <span className="text-[12px] tabular-nums text-a-muted">
                  Үлдэгдэл <span className="font-semibold text-a-ink">{formatMnt(o.balanceMnt)}</span>
                  {o.balanceRequestedAt ? ` · нэхэмжилсэн ${formatDate(o.balanceRequestedAt)}` : ''}
                </span>
              </div>
              {submitted ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Status tone="amber">Төлсөн гэж мэдэгдсэн</Status>
                  <Button size="sm" variant="primary" disabled={loading} onClick={() => onConfirm(o)}>
                    Үлдэгдэл баталгаажуулах
                  </Button>
                </span>
              ) : (
                <span className="text-[12px] text-a-muted">Төлбөр хүлээж байна</span>
              )}
            </li>
          )
        })}
      </ul>
      {error && <p className="border-t border-a-line px-6 py-3 text-[13px] text-danger-ink">{error}</p>}
    </Card>
  )
}
