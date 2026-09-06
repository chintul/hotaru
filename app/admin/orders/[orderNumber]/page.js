'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_MARK_REFUNDED, ADMIN_ORDER_DETAIL, ADMIN_SET_ORDER_STATUS,
  CANCEL_ORDER, CONFIRM_PAYMENT,
} from '@/lib/queries'
import { formatAddress, formatDate, formatMnt, nodes, parseJson } from '@/lib/format'
import {
  Activity, Button, Card, EmptyState, Input, Row, Status,
} from '@/components/admin/ui'
import { Back, Truck } from '@/components/admin/icons'

const STATUS_TONE = { awaiting_payment: 'amber', paid: 'green', packed: 'blue', shipped: 'blue', delivered: 'green', cancelled: 'grey', refunded: 'purple', oversold: 'red' }
const STATUS_LABEL = { awaiting_payment: 'Төлбөр хүлээж буй', paid: 'Төлөгдсөн', packed: 'Бэлтгэсэн', shipped: 'Илгээсэн', delivered: 'Хүргэгдсэн', cancelled: 'Цуцлагдсан', refunded: 'Буцаагдсан', oversold: 'Нөөцгүй' }
const PAYMENT_TONE = { unpaid: 'grey', submitted: 'amber', confirmed: 'green', failed: 'red', refunded: 'purple' }
const PAYMENT_LABEL = { unpaid: 'Төлөгдөөгүй', submitted: 'Төлсөн гэсэн', confirmed: 'Баталгаажсан', failed: 'Амжилтгүй', refunded: 'Буцаасан' }

const NEXT = { paid: ['packed', 'Бэлтгэсэн гэж тэмдэглэх'], packed: ['shipped', 'Илгээсэн гэж тэмдэглэх'], shipped: ['delivered', 'Хүргэгдсэн гэж тэмдэглэх'] }

export default function AdminOrderPage({ params }) {
  const { orderNumber } = use(params)
  const { data, loading, refetch } = useQuery(ADMIN_ORDER_DETAIL, {
    variables: { orderNumber },
    fetchPolicy: 'cache-and-network',
  })

  const order = nodes(data?.orderCollection)[0]
  if (loading && !order) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>
  if (!order) {
    return <EmptyState title="Захиалга олдсонгүй" action={<Link href="/admin"><Button>Буцах</Button></Link>} />
  }

  const items = nodes(order.orderItemCollection)
  const payment = nodes(order.paymentCollection)[0]
  const address = parseJson(order.shippingAddress)

  const activity = [
    order.cancelledAt && { label: 'Цуцлагдсан', at: formatDate(order.cancelledAt) },
    order.shippedAt && { label: 'Илгээсэн', at: formatDate(order.shippedAt), detail: order.trackingNumber },
    order.paidAt && { label: 'Төлбөр баталгаажсан', at: formatDate(order.paidAt), detail: formatMnt(order.totalMnt) },
    { label: 'Захиалга үүссэн', at: formatDate(order.placedAt), detail: formatMnt(order.totalMnt) },
  ].filter(Boolean)

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-[13px] text-a-muted hover:text-a-ink">
        <Back /> Захиалга
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card
            title={<span className="tabular-nums">{order.orderNumber}</span>}
            subtitle={`${formatDate(order.placedAt)} · ${order.deliveryMethod?.name ?? '—'}`}
            actions={
              <>
                <Status tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</Status>
                <Status tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Status>
              </>
            }
          />

          <Card title="Захиалга" padded={false}>
            <ul>
              {items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 border-b border-a-line px-6 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-a-ink">{i.productTitle}</p>
                    <p className="text-[12px] text-a-muted">
                      {i.variantLabel ?? '—'}{i.sku ? ` · ${i.sku}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-a-muted">{formatMnt(i.unitPriceMnt)}</span>
                  <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-a-muted">{i.quantity}×</span>
                  <span className="w-24 shrink-0 text-right text-[13px] tabular-nums">{formatMnt(i.lineTotalMnt)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-a-line">
              <Row label="Барааны дүн">{formatMnt(order.subtotalMnt)}</Row>
              {Number(order.discountMnt) > 0 && <Row label="Хөнгөлөлт">−{formatMnt(order.discountMnt)}</Row>}
              <Row label="Хүргэлт">{formatMnt(order.deliveryMnt)}</Row>
              <Row label={<span className="font-medium text-a-ink">Нийт</span>}>
                <span className="font-semibold">{formatMnt(order.totalMnt)}</span>
              </Row>
            </div>
          </Card>

          <PaymentCard order={order} payment={payment} onDone={refetch} />
          <FulfilmentCard order={order} onDone={refetch} />
        </div>

        <div className="space-y-4">
          <Card title="Худалдан авагч" padded={false}>
            {/* Phone sign-ins have no email at all; an empty row reads as
                missing data rather than as a customer who reaches you by phone. */}
            {order.email
              ? <Row label="Имэйл" copy={order.email}>{order.email}</Row>
              : <Row label="Имэйл">
                  <span className="text-a-muted">Утсаар бүртгүүлсэн — имэйлгүй</span>
                </Row>}
            <Row label="Утас" copy={order.phone}>{order.phone}</Row>
            <Row label="Хүргэх хаяг" copy={`${address.recipient_name}, ${formatAddress(address)}`}>
              {address.recipient_name}<br />
              {formatAddress(address)}
              {address.landmark_note && <><br /><span className="text-a-muted">{address.landmark_note}</span></>}
            </Row>
            <Row label="Хүргэлт">{order.deliveryMethod?.name ?? '—'}</Row>
            {order.customerNote && <Row label="Тэмдэглэл">{order.customerNote}</Row>}
          </Card>

          <Card title="Явц" padded={false}>
            <Activity items={activity} />
          </Card>

          {order.internalNote && (
            <Card title="Дотоод тэмдэглэл">
              <p className="whitespace-pre-line text-[12px] text-a-muted">{order.internalNote}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function PaymentCard({ order, payment, onDone }) {
  const [confirm, { loading }] = useMutation(CONFIRM_PAYMENT)
  const [markRefunded, { loading: refunding }] = useMutation(ADMIN_MARK_REFUNDED)
  const [cancel] = useMutation(CANCEL_ORDER)
  const [reference, setReference] = useState('')
  const [error, setError] = useState(null)
  const [checkMessage, setCheckMessage] = useState('')

  const awaiting = order.paymentStatus !== 'confirmed' && order.paymentStatus !== 'refunded'

  return (
    <Card
      title="Төлбөр"
      actions={<Status tone={PAYMENT_TONE[order.paymentStatus]}>{PAYMENT_LABEL[order.paymentStatus]}</Status>}
      padded={false}
    >
      <Row label="Хэлбэр">{payment?.provider === 'bank_transfer' ? 'Дансаар шилжүүлэг' : payment?.provider ?? '—'}</Row>
      <Row label="Дүн">{formatMnt(payment?.amountMnt ?? order.totalMnt)}</Row>
      {payment?.externalReference && <Row label="Гүйлгээний дугаар">{payment.externalReference}</Row>}
      {payment?.payerNote && <Row label="Төлөгчийн тэмдэглэл">{payment.payerNote}</Row>}
      {payment?.confirmedAt && <Row label="Баталгаажсан">{formatDate(payment.confirmedAt)}</Row>}

      {awaiting && (
        <div className="flex flex-wrap items-end gap-3 border-t border-a-line bg-a-hover/50 px-6 py-4">
          <p className="w-full text-[13px] text-a-muted">
            Дансаа шалгаад баталгаажуулна уу — үүний дараа нөөц хасагдана.
          </p>
          <div className="min-w-[180px] flex-1">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Гүйлгээний дугаар (заавал биш)" />
          </div>
          <Button
            variant="primary"
            disabled={loading}
            onClick={async () => {
              setError(null)
              try {
                const res = await confirm({ variables: { orderId: order.id, externalReference: reference.trim() || null } })
                if (res.data?.confirmPayment?.status === 'oversold') {
                  setError('Төлбөр баталгаажсан ч нөөц хүрэлцэхгүй байна. Буцаалт хийнэ үү.')
                }
                onDone()
              } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
            }}
          >
            Төлбөр баталгаажуулах
          </Button>
          <Button
            variant="danger"
            onClick={async () => { await cancel({ variables: { orderId: order.id, reason: 'admin cancelled' } }); onDone() }}
          >
            Цуцлах
          </Button>
          {/* For a callback that never landed. QPay forbids polling their check
              endpoint on a schedule, so the retry is a button, not a cron. */}
          <Button
            onClick={async () => {
              setCheckMessage('')
              const res = await fetch('/api/payments/qpay/check', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ orderId: order.id }),
              })
              const body = await res.json().catch(() => ({}))
              setCheckMessage(
                body.outcome === 'confirmed' ? 'QPay: төлбөр баталгаажлаа'
                  : body.outcome === 'pending' ? 'QPay: төлбөр хараахан ороогүй байна'
                    : body.outcome === 'mismatch' ? 'QPay: дүн зөрж байна — дотоод тэмдэглэлийг шалгана уу'
                      : body.outcome === 'already' ? 'QPay: аль хэдийн баталгаажсан'
                        : 'QPay: нэхэмжлэх олдсонгүй',
              )
              onDone()
            }}
          >
            QPay шалгах
          </Button>
          {checkMessage && <p className="w-full text-[13px] text-a-muted">{checkMessage}</p>}
        </div>
      )}

      {order.status === 'oversold' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-red-200 bg-red-50 px-6 py-4">
          <p className="flex-1 text-[13px] text-red-700">
            Төлбөр орсон ч бараа дууссан. Мөнгийг буцаасны дараа тэмдэглэнэ үү.
          </p>
          <Button
            variant="danger"
            disabled={refunding}
            onClick={async () => { await markRefunded({ variables: { orderId: order.id, note: 'refunded from admin' } }); onDone() }}
          >
            Буцаалт хийсэн
          </Button>
        </div>
      )}

      {error && <p className="border-t border-a-line px-6 py-3 text-[13px] text-red-600">{error}</p>}
    </Card>
  )
}

function FulfilmentCard({ order, onDone }) {
  const [setStatus, { loading }] = useMutation(ADMIN_SET_ORDER_STATUS)
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const [error, setError] = useState(null)
  const next = NEXT[order.status]

  // Fulfilment only exists once money has arrived; before that the card would
  // offer actions the database will refuse.
  if (order.paymentStatus !== 'confirmed' || order.status === 'oversold') return null

  return (
    <Card
      title="Хүргэлт"
      actions={<Status tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Status>}
      padded={false}
    >
      <Row label="Хэлбэр">{order.deliveryMethod?.name ?? '—'}</Row>
      <Row label="Хяналтын дугаар">{order.trackingNumber ?? '—'}</Row>

      {next && (
        <div className="flex flex-wrap items-end gap-3 border-t border-a-line bg-a-hover/50 px-6 py-4">
          <div className="min-w-[180px] flex-1">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Хяналтын дугаар (заавал биш)" />
          </div>
          <Button
            variant="primary"
            disabled={loading}
            onClick={async () => {
              setError(null)
              try {
                await setStatus({
                  variables: { orderId: order.id, status: next[0], trackingNumber: tracking.trim() || null },
                })
                onDone()
              } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
            }}
          >
            <Truck /> {next[1]}
          </Button>
        </div>
      )}
      {error && <p className="border-t border-a-line px-6 py-3 text-[13px] text-red-600">{error}</p>}
    </Card>
  )
}
