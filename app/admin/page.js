'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_PENDING, CANCEL_ORDER, CONFIRM_PAYMENT } from '@/lib/queries'
import { formatAddress, formatDate, formatMnt, nodes, parseJson } from '@/lib/format'
import AdminGate from '@/components/AdminGate'

export default function AdminOrdersPage() {
  return (
    <AdminGate>
      <PendingQueue />
    </AdminGate>
  )
}

function PendingQueue() {
  const { data, loading, refetch } = useQuery(ADMIN_PENDING, { fetchPolicy: 'cache-and-network' })
  const awaiting = nodes(data?.awaiting)
  const oversold = nodes(data?.oversold)

  if (loading && !data) return <p className="label text-ink-faint">Ачааллаж байна…</p>

  return (
    <div className="space-y-12">
      {oversold.length > 0 && (
        <section>
          <h2 className="label text-sale">Нөөц хүрэлцээгүй ({data.oversold.totalCount})</h2>
          <p className="mt-2 text-ink-soft">
            Төлбөр орсон боловч бараа дууссан. Буцаалт хийх шаардлагатай.
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {oversold.map((o) => (
              <li key={o.id} className="flex flex-wrap gap-x-6 gap-y-1 py-4">
                <span className="font-medium tabular-nums">{o.orderNumber}</span>
                <span className="text-ink-soft">{o.email}</span>
                <span className="label text-ink-faint">{o.phone}</span>
                <span className="ml-auto tabular-nums">{formatMnt(o.totalMnt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="label">Төлбөр хүлээгдэж буй ({data?.awaiting?.totalCount ?? 0})</h2>
          <button onClick={() => refetch()} className="label link-underline text-ink-faint">Шинэчлэх</button>
        </div>
        {awaiting.length === 0 ? (
          <p className="mt-6 text-ink-soft">Хүлээгдэж буй захиалга алга.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {awaiting.map((order) => <OrderRow key={order.id} order={order} onDone={refetch} />)}
          </ul>
        )}
      </section>
    </div>
  )
}

function OrderRow({ order, onDone }) {
  const [confirm, { loading: confirming }] = useMutation(CONFIRM_PAYMENT)
  const [cancel, { loading: cancelling }] = useMutation(CANCEL_ORDER)
  const [reference, setReference] = useState('')
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const items = nodes(order.orderItemCollection)
  const a = parseJson(order.shippingAddress)

  const onConfirm = async () => {
    setError(null)
    try {
      const res = await confirm({
        variables: { orderId: order.id, externalReference: reference.trim() || null },
      })
      // confirm_payment returns `oversold` rather than throwing when stock is
      // short — surface that instead of showing a success.
      if (res.data?.confirmPayment?.status === 'oversold') {
        setError('Төлбөр баталгаажсан ч нөөц хүрэлцэхгүй байна. Буцаалт хийнэ үү.')
      }
      onDone()
    } catch (e) {
      setError(e?.message ?? 'Алдаа гарлаа.')
    }
  }

  return (
    <li className="border border-line">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-4">
        <button onClick={() => setOpen(!open)} className="font-medium tabular-nums link-underline">
          {order.orderNumber}
        </button>
        <span className="label text-ink-faint">{formatDate(order.placedAt)}</span>
        <span className="text-ink-soft">{order.email}</span>
        <span className="label text-ink-faint">{order.phone}</span>
        {order.paymentStatus === 'submitted' && (
          <span className="label border border-ink px-2 py-0.5">Төлсөн гэсэн</span>
        )}
        <span className="ml-auto text-[15px] tabular-nums">{formatMnt(order.totalMnt)}</span>
      </div>

      {open && (
        <div className="border-t border-line px-5 py-4">
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id} className="flex gap-3 text-ink-soft">
                <span>{i.productTitle}</span>
                {i.variantLabel && <span className="label text-ink-faint">{i.variantLabel}</span>}
                <span className="label text-ink-faint">×{i.quantity}</span>
                <span className="ml-auto tabular-nums">{formatMnt(i.lineTotalMnt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-ink-soft">
            {[a.recipient_name, a.phone, formatAddress(a), a.landmark_note].filter(Boolean).join(' · ')}
          </p>
          {order.customerNote && <p className="label mt-2 text-ink-faint">Тэмдэглэл: {order.customerNote}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-line px-5 py-4">
        <label className="flex-1 min-w-[200px]">
          <span className="label text-ink-faint">Гүйлгээний дугаар</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full border-b border-line bg-transparent py-1.5 outline-none focus:border-ink" />
        </label>
        <button onClick={onConfirm} disabled={confirming}
          className="label bg-ink px-5 py-2.5 text-paper transition-opacity hover:opacity-85 disabled:opacity-40">
          {confirming ? '…' : 'Төлбөр баталгаажуулах'}
        </button>
        <button
          onClick={async () => { await cancel({ variables: { orderId: order.id, reason: 'admin cancelled' } }); onDone() }}
          disabled={cancelling}
          className="label link-underline text-ink-faint">
          Цуцлах
        </button>
      </div>
      {error && <p className="border-t border-line px-5 py-3 text-sale">{error}</p>}
    </li>
  )
}
