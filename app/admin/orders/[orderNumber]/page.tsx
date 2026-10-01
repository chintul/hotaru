'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_MARK_REFUNDED, ADMIN_ORDER_DETAIL, ADMIN_SET_ORDER_STATUS,
  CANCEL_ORDER, CONFIRM_PAYMENT,
} from '@/lib/queries'
import { formatAddress, formatDate, formatMnt, firstNode, nodes, parseJson } from '@/lib/format'
import type { AddressSnapshot, Connection, Order, Payment } from '@/lib/types'
import {
  Activity, Button, Card, EmptyState, Input, Row, Status, type ActivityItem,
} from '@/components/admin/ui'
import { Back, Truck } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'
import { paymentLabel, paymentTone, statusLabel, statusTone } from '../../_lib/order-status'

const NEXT_STEP: Record<string, readonly [string, string]> = {
  paid: ['packed', 'Бэлтгэсэн гэж тэмдэглэх'],
  packed: ['shipped', 'Илгээсэн гэж тэмдэглэх'],
  shipped: ['delivered', 'Хүргэгдсэн гэж тэмдэглэх'],
}

const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  bank_transfer: 'Дансаар шилжүүлэг',
  qpay_quickqr: 'QPay',
}

interface OrderDetailData {
  orderCollection: Connection<Order> | null
}

interface ConfirmPaymentData {
  confirmPayment: { status?: string | null } | null
}

interface QpayCheckResponse {
  error?: string
  outcome?: string
}

type Refetch = () => unknown

export default function AdminOrderPage({ params }: PageProps<'/admin/orders/[orderNumber]'>) {
  const { orderNumber } = use(params)
  const { data, loading, refetch } = useQuery<OrderDetailData, { orderNumber: string }>(ADMIN_ORDER_DETAIL, {
    variables: { orderNumber },
    fetchPolicy: 'cache-and-network',
  })

  const order = firstNode(data?.orderCollection)
  if (loading && !order) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>
  if (!order) {
    return <EmptyState title="Захиалга олдсонгүй" action={<Link href="/admin"><Button>Буцах</Button></Link>} />
  }

  const items = nodes(order.orderItemCollection)
  const payment = firstNode(order.paymentCollection)
  const address: AddressSnapshot = parseJson(order.shippingAddress)

  const activity: ActivityItem[] = [
    ...(order.cancelledAt ? [{ label: 'Цуцлагдсан', at: formatDate(order.cancelledAt) }] : []),
    ...(order.shippedAt ? [{ label: 'Илгээсэн', at: formatDate(order.shippedAt), detail: order.trackingNumber }] : []),
    ...(order.paidAt ? [{ label: 'Төлбөр баталгаажсан', at: formatDate(order.paidAt), detail: formatMnt(order.totalMnt) }] : []),
    { label: 'Захиалга үүссэн', at: formatDate(order.placedAt), detail: formatMnt(order.totalMnt) },
  ]

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
                <Status tone={paymentTone(order.paymentStatus)}>{paymentLabel(order.paymentStatus)}</Status>
                <Status tone={statusTone(order.status)}>{statusLabel(order.status)}</Status>
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

function qpayCheckFailureMessage(error: string | undefined, status: number): string {
  if (error === 'qpay_unavailable') return 'QPay тохируулагдаагүй байна.'
  if (error === 'forbidden') return 'Админ эрх шаардлагатай.'
  return `QPay-тай холбогдож чадсангүй (${status}). Дахин оролдоно уу.`
}

function qpayOutcomeMessage(outcome: string | undefined): string {
  switch (outcome) {
    case 'confirmed': return 'QPay: төлбөр баталгаажлаа'
    case 'pending': return 'QPay: төлбөр хараахан ороогүй байна'
    case 'mismatch': return 'QPay: дүн зөрж байна — дотоод тэмдэглэлийг шалгана уу'
    case 'already': return 'QPay: аль хэдийн баталгаажсан'
    default: return 'QPay: нэхэмжлэх олдсонгүй'
  }
}

interface PaymentCardProps {
  order: Order
  payment: Payment | null
  onDone: Refetch
}

function PaymentCard({ order, payment, onDone }: PaymentCardProps) {
  const [confirm, { loading }] = useMutation<ConfirmPaymentData, { orderId: string; externalReference: string | null }>(CONFIRM_PAYMENT)
  const [markRefunded, { loading: refunding }] = useMutation<unknown, { orderId: string; note: string }>(ADMIN_MARK_REFUNDED)
  const [cancel, { loading: cancelling }] = useMutation<unknown, { orderId: string; reason: string }>(CANCEL_ORDER)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkMessage, setCheckMessage] = useState('')
  const [checking, setChecking] = useState(false)

  const awaiting = order.paymentStatus !== 'confirmed' && order.paymentStatus !== 'refunded'

  const confirmThenRun = async (question: string, mutate: () => Promise<unknown>) => {
    if (!window.confirm(question)) return
    setError(null)
    try {
      await mutate()
      onDone()
    } catch (e) {
      setError(errorMessage(e, 'Алдаа гарлаа.'))
    }
  }

  const confirmPayment = async () => {
    setError(null)
    try {
      const res = await confirm({ variables: { orderId: order.id, externalReference: reference.trim() || null } })
      if (res.data?.confirmPayment?.status === 'oversold') {
        setError('Төлбөр баталгаажсан ч нөөц хүрэлцэхгүй байна. Буцаалт хийнэ үү.')
      }
      onDone()
    } catch (e) { setError(errorMessage(e, 'Алдаа гарлаа.')) }
  }

  const checkQpay = async () => {
    setChecking(true)
    setCheckMessage('')
    try {
      const res = await fetch('/api/payments/qpay/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const body: QpayCheckResponse = await res.json().catch(() => ({}))

      if (!res.ok) {
        setCheckMessage(qpayCheckFailureMessage(body.error, res.status))
        return
      }

      setCheckMessage(qpayOutcomeMessage(body.outcome))
      onDone()
    } catch {
      setCheckMessage('Сүлжээний алдаа. Дахин оролдоно уу.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card
      title="Төлбөр"
      actions={<Status tone={paymentTone(order.paymentStatus)}>{paymentLabel(order.paymentStatus)}</Status>}
      padded={false}
    >
      <Row label="Хэлбэр">{PAYMENT_PROVIDER_LABEL[payment?.provider ?? ''] ?? payment?.provider ?? '—'}</Row>
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
          <Button variant="primary" disabled={loading} onClick={confirmPayment}>
            Төлбөр баталгаажуулах
          </Button>
          <Button
            variant="danger"
            disabled={cancelling}
            onClick={() => confirmThenRun(
              `${order.orderNumber} захиалгыг цуцлах уу?\n\n`
              + 'Нөөц агуулах руу буцаж, энэ үйлдлийг буцаах боломжгүй.',
              () => cancel({ variables: { orderId: order.id, reason: 'admin cancelled' } }),
            )}
          >
            {cancelling ? 'Цуцалж байна…' : 'Цуцлах'}
          </Button>
          <Button disabled={checking} onClick={checkQpay}>
            {checking ? 'Шалгаж байна…' : 'QPay шалгах'}
          </Button>
          {checkMessage && <p className="w-full text-[13px] text-a-muted">{checkMessage}</p>}
        </div>
      )}

      {order.status === 'oversold' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-danger-line bg-danger-soft px-6 py-4">
          <p className="flex-1 text-[13px] text-danger-ink">
            Төлбөр орсон ч бараа дууссан. Мөнгийг буцаасны дараа тэмдэглэнэ үү.
          </p>
          <Button
            variant="danger"
            disabled={refunding}
            onClick={() => confirmThenRun(
              `${formatMnt(order.totalMnt)} буцаасныг баталгаажуулах уу?\n\n`
              + 'Мөнгийг банкаар нь буцаасны ДАРАА тэмдэглэнэ. Захиалга "Буцаагдсан" болно.',
              () => markRefunded({ variables: { orderId: order.id, note: 'refunded from admin' } }),
            )}
          >
            {refunding ? 'Тэмдэглэж байна…' : 'Буцаалт хийсэн'}
          </Button>
        </div>
      )}

      {error && <p className="border-t border-a-line px-6 py-3 text-[13px] text-danger-ink">{error}</p>}
    </Card>
  )
}

interface FulfilmentCardProps {
  order: Order
  onDone: Refetch
}

function FulfilmentCard({ order, onDone }: FulfilmentCardProps) {
  const [setStatus, { loading }] = useMutation<unknown, { orderId: string; status: string; trackingNumber: string | null }>(ADMIN_SET_ORDER_STATUS)
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const [error, setError] = useState<string | null>(null)
  const next = NEXT_STEP[order.status ?? '']

  const fulfilmentPossible = order.paymentStatus === 'confirmed' && order.status !== 'oversold'
  if (!fulfilmentPossible) return null

  const advance = async (status: string) => {
    setError(null)
    try {
      await setStatus({ variables: { orderId: order.id, status, trackingNumber: tracking.trim() || null } })
      onDone()
    } catch (e) { setError(errorMessage(e, 'Алдаа гарлаа.')) }
  }

  return (
    <Card
      title="Хүргэлт"
      actions={<Status tone={statusTone(order.status)}>{statusLabel(order.status)}</Status>}
      padded={false}
    >
      <Row label="Хэлбэр">{order.deliveryMethod?.name ?? '—'}</Row>
      <Row label="Хяналтын дугаар">{order.trackingNumber ?? '—'}</Row>

      {next && (
        <div className="flex flex-wrap items-end gap-3 border-t border-a-line bg-a-hover/50 px-6 py-4">
          <div className="min-w-[180px] flex-1">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Хяналтын дугаар (заавал биш)" />
          </div>
          <Button variant="primary" disabled={loading} onClick={() => advance(next[0])}>
            <Truck /> {next[1]}
          </Button>
        </div>
      )}
      {error && <p className="border-t border-a-line px-6 py-3 text-[13px] text-danger-ink">{error}</p>}
    </Card>
  )
}
