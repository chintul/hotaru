'use client'

import Link from 'next/link'
import { use, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_MARK_REFUNDED, ADMIN_ORDER_DETAIL, ADMIN_SET_ORDER_STATUS, CONFIRM_PAYMENT,
} from '@/lib/queries'
import { formatAddress, formatDate, formatMnt, firstNode, nodes, parseJson, toNumber } from '@/lib/format'
import type { AddressSnapshot, Connection, Order, OrderItem, Payment, PaymentKind, PaymentStatus } from '@/lib/types'
import {
  Activity, Button, Card, EmptyState, Input, Row, Status, type ActivityItem,
} from '@/components/admin/ui'
import { Back, Truck } from '@/components/admin/icons'
import { useConfirm } from '@/components/admin/confirm'
import { PreorderBadge } from '@/components/admin/product/PreorderToggle'
import {
  REQUEST_BALANCE_LABEL, isDepositOrder, upfrontOf, useCancelOrder, useRequestBalance,
} from '@/components/admin/preorder'
import { errorMessage } from '@/lib/errors'
import {
  CONFIRM_PAYMENT_LABEL, PAYMENT_LABEL, paymentKindLabel, paymentLabel, paymentTone, statusLabel, statusTone,
} from '../../_lib/order-status'

const NEXT_STEP: Record<string, readonly [string, string]> = {
  paid: ['packed', 'Бэлтгэсэн гэж тэмдэглэх'],
  packed: ['shipped', 'Илгээсэн гэж тэмдэглэх'],
  shipped: ['delivered', 'Хүргэгдсэн гэж тэмдэглэх'],
}

const MOBILE_ACTION = 'max-sm:min-h-11 max-sm:w-full'

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
    return <EmptyState title="Захиалга олдсонгүй" action={<Button asChild><Link href="/admin">Буцах</Link></Button>} />
  }

  const items = nodes(order.orderItemCollection)
  const address: AddressSnapshot = parseJson(order.shippingAddress)
  const deposit = isDepositOrder(order)

  const activity: ActivityItem[] = [
    ...(order.cancelledAt ? [{ label: 'Цуцлагдсан', at: formatDate(order.cancelledAt) }] : []),
    ...(order.shippedAt ? [{ label: 'Илгээсэн', at: formatDate(order.shippedAt), detail: order.trackingNumber }] : []),
    ...(order.balancePaidAt ? [{ label: 'Үлдэгдэл баталгаажсан', at: formatDate(order.balancePaidAt), detail: formatMnt(order.balanceMnt) }] : []),
    ...(order.balanceRequestedAt ? [{ label: 'Үлдэгдэл нэхэмжилсэн', at: formatDate(order.balanceRequestedAt), detail: formatMnt(order.balanceMnt) }] : []),
    ...(order.paidAt
      ? [deposit
          ? { label: 'Урьдчилгаа баталгаажсан', at: formatDate(order.paidAt), detail: formatMnt(upfrontOf(order)) }
          : { label: 'Төлбөр баталгаажсан', at: formatDate(order.paidAt), detail: formatMnt(order.totalMnt) }]
      : []),
    { label: 'Захиалга үүссэн', at: formatDate(order.placedAt), detail: formatMnt(order.totalMnt) },
  ]

  return (
    <>
      <Link href="/admin" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[13px] text-a-muted hover:text-a-ink sm:mb-4 sm:min-h-0">
        <Back /> Захиалга
      </Link>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_340px]">
        <div className="max-lg:contents lg:space-y-4">
          <Card
            className="max-lg:order-1"
            title={<span className="tabular-nums [overflow-wrap:anywhere]">{order.orderNumber}</span>}
            subtitle={`${formatDate(order.placedAt)} · ${order.deliveryMethod?.name ?? '—'}`}
            actions={
              <>
                {deposit && <PreorderBadge />}
                <Status tone={paymentTone(order.paymentStatus)}>{paymentLabel(order.paymentStatus)}</Status>
                <Status tone={statusTone(order.status)}>{statusLabel(order.status)}</Status>
              </>
            }
          />

          <div className="order-2 lg:hidden">
            <Card padded={false}>
              {order.email
                ? <Row label="Имэйл" copy={order.email}>{order.email}</Row>
                : <Row label="Утас" copy={order.phone}>{order.phone}</Row>}
              {order.email && order.phone && <Row label="Утас" copy={order.phone}>{order.phone}</Row>}
              <Row label={<span className="font-medium text-a-ink">Нийт</span>}>
                <span className="font-semibold tabular-nums">{formatMnt(order.totalMnt)}</span>
              </Row>
            </Card>
          </div>

          <Card title="Захиалга" padded={false} className="max-lg:order-5">
            <ul>
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-3 border-b border-a-line px-4 py-3 last:border-0 sm:items-center sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-a-ink [overflow-wrap:anywhere] sm:truncate">{i.productTitle}</p>
                    <p className="text-[12px] text-a-muted [overflow-wrap:anywhere]">
                      {i.variantLabel ?? '—'}{i.sku ? ` · ${i.sku}` : ''}
                    </p>
                    {i.isPreorder && <PreorderLine item={i} />}
                  </div>
                  <span className="hidden shrink-0 text-[13px] tabular-nums text-a-muted sm:inline">{formatMnt(i.unitPriceMnt)}</span>
                  <span className="hidden w-10 shrink-0 text-right text-[13px] tabular-nums text-a-muted sm:inline">{i.quantity}×</span>
                  <span className="shrink-0 text-right text-[13px] tabular-nums sm:w-24">
                    {formatMnt(i.lineTotalMnt)}
                    <span className="block text-[12px] text-a-muted sm:hidden">{i.quantity} × {formatMnt(i.unitPriceMnt)}</span>
                  </span>
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

          <div className="max-lg:order-3">
            <PaymentCard order={order} onDone={refetch} />
          </div>
          <div className="max-lg:order-4 empty:hidden">
            <FulfilmentCard order={order} onDone={refetch} />
          </div>
        </div>

        <div className="max-lg:contents lg:space-y-4">
          <Card title="Худалдан авагч" padded={false} className="max-lg:order-6">
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

          <Card title="Явц" padded={false} className="max-lg:order-7">
            <Activity items={activity} />
          </Card>

          {order.internalNote && (
            <Card title="Дотоод тэмдэглэл" className="max-lg:order-8">
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

function PreorderLine({ item }: { item: OrderItem }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-a-muted">
      <PreorderBadge />
      <span>
        {item.preorderEta ? `Ирэх: ${item.preorderEta}` : 'Ирэх хугацаа тодорхойгүй'}
        {item.depositPct != null ? ` · хамгийн бага урьдчилгаа ${item.depositPct}%` : ''}
      </span>
    </p>
  )
}

const isPaymentStatus = (s: string | null | undefined): s is PaymentStatus => s != null && s in PAYMENT_LABEL

const isOpen = (p: Payment) => p.status === 'unpaid' || p.status === 'submitted'

function PaymentState({ payment }: { payment: Payment | null | undefined }) {
  const status = payment?.status
  if (!isPaymentStatus(status)) return null
  return <Status tone={paymentTone(status)}>{paymentLabel(status)}</Status>
}

const confirmHint = (kind: PaymentKind, amount: string, balance: string): string => {
  if (kind === 'deposit') return `Урьдчилгаа ${amount} дансанд орсныг шалгаад баталгаажуулна уу. Үлдэгдэл ${balance}-ийг бараа ирэхэд нэхэмжилнэ.`
  if (kind === 'balance') return `Үлдэгдэл ${amount} дансанд орсныг шалгаад баталгаажуулна уу — дараа нь бэлтгэж илгээнэ.`
  return 'Дансаа шалгаад баталгаажуулна уу — үүний дараа нөөц хасагдана.'
}

interface PaymentCardProps {
  order: Order
  onDone: Refetch
}

function PaymentCard({ order, onDone }: PaymentCardProps) {
  const [confirm, { loading }] = useMutation<ConfirmPaymentData, { orderId: string; externalReference: string | null }>(CONFIRM_PAYMENT)
  const [markRefunded, { loading: refunding }] = useMutation<unknown, { orderId: string; note: string }>(ADMIN_MARK_REFUNDED)
  const cancel = useCancelOrder(onDone)
  const requestBalance = useRequestBalance(onDone)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkMessage, setCheckMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const confirmDialog = useConfirm()

  const payments = nodes(order.paymentCollection)
  const deposit = isDepositOrder(order)
  const upfront = upfrontOf(order)
  const open = payments.find(isOpen) ?? null
  const live = order.status !== 'cancelled' && order.status !== 'refunded'
  const legacyUnpaid = payments.length === 0 && (order.paymentStatus === 'unpaid' || order.paymentStatus === 'submitted')
  const awaiting = live && (open !== null || legacyUnpaid)
  const openKind: PaymentKind = open?.kind === 'deposit' && !deposit ? 'full' : (open?.kind ?? 'full')
  const openAmount = formatMnt(open?.amountMnt ?? (openKind === 'balance' ? order.balanceMnt : upfront))
  const depositPayment = payments.find((p) => p.kind === 'deposit')
  const balancePayment = payments.find((p) => p.kind === 'balance')
  const refundAmount = deposit && !order.balancePaidAt ? upfront : toNumber(order.totalMnt)
  const actionError = error ?? cancel.error ?? requestBalance.error

  const confirmThenRun = async (title: string, description: string, mutate: () => Promise<unknown>) => {
    if (!(await confirmDialog({ title, description, destructive: true }))) return
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
      setReference('')
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

  const cancelButton = (
    <Button variant="danger" className={MOBILE_ACTION} disabled={cancel.loading} onClick={() => cancel.run(order)}>
      {cancel.loading ? 'Цуцалж байна…' : 'Цуцлах'}
    </Button>
  )

  return (
    <Card
      title="Төлбөр"
      actions={<Status tone={paymentTone(order.paymentStatus)}>{paymentLabel(order.paymentStatus)}</Status>}
      padded={false}
    >
      <div className="flex flex-col">
        {deposit && (
          <div className="border-b border-a-line">
            <Row label={<span className="font-medium text-a-ink">Нийт</span>}>
              <span className="font-semibold tabular-nums">{formatMnt(order.totalMnt)}</span>
            </Row>
            {order.minUpfrontMnt != null && order.minUpfrontMnt !== '' && (
              <Row label="Хамгийн бага">
                <span className="tabular-nums text-a-muted">{formatMnt(order.minUpfrontMnt)}</span>
              </Row>
            )}
            <Row label="Урьдчилгаа">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums">{formatMnt(upfront)}</span>
                <PaymentState payment={depositPayment} />
              </span>
              {order.paidAt && <span className="block text-[12px] text-a-muted">Баталгаажсан {formatDate(order.paidAt)}</span>}
            </Row>
            <Row label="Үлдэгдэл">
              <span className="inline-flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums">{formatMnt(order.balanceMnt)}</span>
                {balancePayment
                  ? <PaymentState payment={balancePayment} />
                  : <Status tone="grey">Нэхэмжлээгүй</Status>}
              </span>
              <span className="block text-[12px] text-a-muted">
                {order.balancePaidAt
                  ? `Баталгаажсан ${formatDate(order.balancePaidAt)}`
                  : order.balanceRequestedAt
                    ? `Нэхэмжилсэн ${formatDate(order.balanceRequestedAt)}`
                    : 'Бараа ирэхэд нэхэмжилнэ'}
              </span>
            </Row>
          </div>
        )}

        {payments.length === 0 && <Row label="Дүн">{formatMnt(order.totalMnt)}</Row>}
        {payments.map((p) => (
          <div key={p.id} className="border-b border-a-line last:border-0">
            <div className="flex items-center justify-between gap-3 bg-a-hover/40 px-4 py-2 sm:px-6">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-a-muted">
                {paymentKindLabel(p.kind)} · {PAYMENT_PROVIDER_LABEL[p.provider ?? ''] ?? p.provider ?? '—'}
              </span>
              <PaymentState payment={p} />
            </div>
            <Row label="Дүн">{formatMnt(p.amountMnt)}</Row>
            {p.externalReference && <Row label="Гүйлгээний дугаар">{p.externalReference}</Row>}
            {p.payerNote && <Row label="Төлөгчийн тэмдэглэл">{p.payerNote}</Row>}
            {p.confirmedAt && <Row label="Баталгаажсан">{formatDate(p.confirmedAt)}</Row>}
          </div>
        ))}

        {awaiting && (
          <div className="flex flex-wrap items-end gap-3 border-t border-a-line bg-a-hover/50 px-4 py-4 max-sm:order-first max-sm:border-t-0 max-sm:border-b sm:px-6">
            {open?.status === 'submitted' && (
              <p className="w-full rounded-md border border-warn-line bg-warn-soft px-3 py-2 text-[13px] font-medium text-warn-ink">
                Худалдан авагч {paymentKindLabel(openKind).toLowerCase()} {openAmount} төлсөн гэж мэдэгдсэн
              </p>
            )}
            <p className="w-full text-[13px] text-a-muted">
              {confirmHint(openKind, openAmount, formatMnt(order.balanceMnt))}
            </p>
            <div className="w-full sm:w-auto sm:min-w-[180px] sm:flex-1">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Гүйлгээний дугаар (заавал биш)" />
            </div>
            <Button variant="primary" className={MOBILE_ACTION} disabled={loading} onClick={confirmPayment}>
              {CONFIRM_PAYMENT_LABEL[openKind]}
            </Button>
            {cancelButton}
            <Button className={MOBILE_ACTION} disabled={checking} onClick={checkQpay}>
              {checking ? 'Шалгаж байна…' : 'QPay шалгах'}
            </Button>
            {checkMessage && <p className="w-full text-[13px] text-a-muted">{checkMessage}</p>}
          </div>
        )}

        {order.status === 'deposit_paid' && (
          <div className="flex flex-wrap items-center gap-3 border-t border-info-line bg-info-soft px-4 py-4 max-sm:order-first max-sm:border-t-0 max-sm:border-b sm:px-6">
            <p className="w-full text-[13px] text-info-ink">
              Урьдчилгаа орсон. Бараа ирэхэд үлдэгдэл {formatMnt(order.balanceMnt)}-ийг нэхэмжилнэ —
              {order.email ? ' худалдан авагчид имэйл автоматаар очно.' : ` имэйлгүй тул ${order.phone ?? 'утсаар'} мэдэгдээрэй.`}
            </p>
            <Button variant="primary" className={MOBILE_ACTION} disabled={requestBalance.loading} onClick={() => requestBalance.run(order)}>
              {requestBalance.loading ? 'Нэхэмжилж байна…' : REQUEST_BALANCE_LABEL}
            </Button>
            {cancelButton}
          </div>
        )}

        {order.status === 'oversold' && (
          <div className="flex flex-wrap items-center gap-3 border-t border-danger-line bg-danger-soft px-4 py-4 max-sm:order-first max-sm:border-t-0 max-sm:border-b sm:px-6">
            <p className="flex-1 text-[13px] text-danger-ink max-sm:basis-full">
              Төлбөр орсон ч бараа дууссан. Мөнгийг буцаасны дараа тэмдэглэнэ үү.
            </p>
            <Button
              variant="danger"
              className={MOBILE_ACTION}
              disabled={refunding}
              onClick={() => confirmThenRun(
                `${formatMnt(refundAmount)} буцаасныг баталгаажуулах уу?`,
                'Мөнгийг банкаар нь буцаасны ДАРАА тэмдэглэнэ. Захиалга "Буцаагдсан" болно.',
                () => markRefunded({ variables: { orderId: order.id, note: 'refunded from admin' } }),
              )}
            >
              {refunding ? 'Тэмдэглэж байна…' : 'Буцаалт хийсэн'}
            </Button>
          </div>
        )}

        {actionError && <p className="border-t border-a-line px-4 py-3 text-[13px] text-danger-ink max-sm:order-first max-sm:border-t-0 max-sm:border-b sm:px-6">{actionError}</p>}
      </div>
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
  if (!fulfilmentPossible) {
    if (order.status !== 'deposit_paid' && order.status !== 'awaiting_balance') return null
    return (
      <Card title="Хүргэлт">
        <p className="text-[13px] text-a-muted">Үлдэгдэл төлөгдөж баталгаажсаны дараа бэлтгэж илгээнэ.</p>
      </Card>
    )
  }

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
        <div className="flex flex-wrap items-end gap-3 border-t border-a-line bg-a-hover/50 px-4 py-4 sm:px-6">
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:flex-1">
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Хяналтын дугаар (заавал биш)" />
          </div>
          <Button variant="primary" className={MOBILE_ACTION} disabled={loading} onClick={() => advance(next[0])}>
            <Truck /> {next[1]}
          </Button>
        </div>
      )}
      {error && <p className="border-t border-a-line px-4 py-3 text-[13px] text-danger-ink sm:px-6">{error}</p>}
    </Card>
  )
}
