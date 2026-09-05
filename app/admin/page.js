'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_ALL_ORDERS, ADMIN_MARK_REFUNDED, ADMIN_PENDING, ADMIN_SET_ORDER_STATUS,
  CANCEL_ORDER, CONFIRM_PAYMENT,
} from '@/lib/queries'
import { ORDER_STATUS_LABEL, formatAddress, formatDate, formatMnt, nodes, parseJson } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Table, Td, Tr } from '@/components/admin/ui'

export default function AdminOrdersPage() {
  const { data, loading, refetch } = useQuery(ADMIN_PENDING, { fetchPolicy: 'cache-and-network' })
  const awaiting = nodes(data?.awaiting)
  const oversold = nodes(data?.oversold)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Захиалга"
        description="Дансаар шилжүүлсэн төлбөрийг гараар баталгаажуулна."
        action={<Button variant="secondary" onClick={() => refetch()}>Шинэчлэх</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Төлбөр хүлээгдэж буй" value={data?.awaiting?.totalCount ?? 0} tone="amber" />
        <Stat label="Нөөц хүрэлцээгүй" value={data?.oversold?.totalCount ?? 0} tone={oversold.length ? 'red' : 'neutral'} />
        <Stat
          label="Нийт дүн (хүлээгдэж буй)"
          value={formatMnt(awaiting.reduce((s, o) => s + Number(o.totalMnt), 0))}
        />
      </div>

      {oversold.length > 0 && (
        <Card title="Нөөц хүрэлцээгүй захиалга" className="mb-6">
          <p className="mb-4 text-[13px] text-a-muted">
            Төлбөр нь баталгаажсан ч бараа дууссан. Буцаалт хийх шаардлагатай.
          </p>
          <Table head={['Дугаар', 'Имэйл', 'Утас', { label: 'Дүн', align: 'right' }, { label: '', align: 'right' }]}>
            {oversold.map((o) => <OversoldRow key={o.id} order={o} onDone={refetch} />)}
          </Table>
        </Card>
      )}

      {awaiting.length === 0 ? (
        <EmptyState title="Хүлээгдэж буй захиалга алга" body="Шинэ захиалга ирэхэд энд харагдана." />
      ) : (
        <div className="space-y-4">
          {awaiting.map((order) => <OrderCard key={order.id} order={order} onDone={refetch} />)}
        </div>
      )}

      <FulfilmentQueue />
    </>
  )
}

/**
 * Paid orders waiting to be packed and shipped. Separate from the payment queue
 * because they are a different job: one is "did the money arrive", the other is
 * "get it out the door".
 */
function FulfilmentQueue() {
  const { data, refetch } = useQuery(ADMIN_ALL_ORDERS, { variables: { first: 50 }, fetchPolicy: 'cache-and-network' })
  const open = nodes(data?.orderCollection).filter((o) => ['paid', 'packed', 'shipped'].includes(o.status))
  if (!open.length) return null

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-[14px] font-semibold text-a-ink">Хүргэлт ({open.length})</h2>
      <Card>
        <Table head={['Дугаар', 'Төлөв', 'Хаяг', 'Хяналтын дугаар', { label: 'Үйлдэл', align: 'right' }]}>
          {open.map((o) => <FulfilRow key={o.id} order={o} onDone={refetch} />)}
        </Table>
      </Card>
    </div>
  )
}

const NEXT_STATUS = { paid: 'packed', packed: 'shipped', shipped: 'delivered' }
const NEXT_LABEL = { paid: 'Бэлтгэсэн', packed: 'Илгээсэн', shipped: 'Хүргэгдсэн' }

function FulfilRow({ order, onDone }) {
  const [setStatus, { loading }] = useMutation(ADMIN_SET_ORDER_STATUS)
  const [tracking, setTracking] = useState(order.trackingNumber ?? '')
  const [error, setError] = useState(null)
  const next = NEXT_STATUS[order.status]

  return (
    <Tr>
      <Td className="font-medium tabular-nums">{order.orderNumber}</Td>
      <Td>
        <Badge tone={order.status === 'shipped' ? 'blue' : order.status === 'paid' ? 'green' : 'neutral'}>
          {ORDER_STATUS_LABEL[order.status] ?? order.status}
        </Badge>
      </Td>
      <Td className="text-a-muted">{order.email}</Td>
      <Td>
        <Input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="Заавал биш"
          className="max-w-[160px]"
        />
      </Td>
      <Td align="right">
        {next && (
          <Button
            disabled={loading}
            onClick={async () => {
              setError(null)
              try {
                await setStatus({
                  variables: {
                    orderId: order.id,
                    status: next,
                    trackingNumber: tracking.trim() || null,
                  },
                })
                onDone()
              } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
            }}
          >
            {NEXT_LABEL[order.status]}
          </Button>
        )}
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </Td>
    </Tr>
  )
}

function OversoldRow({ order, onDone }) {
  const [markRefunded, { loading }] = useMutation(ADMIN_MARK_REFUNDED)
  return (
    <Tr>
      <Td className="font-medium tabular-nums">{order.orderNumber}</Td>
      <Td>{order.email}</Td>
      <Td className="text-a-muted">{order.phone}</Td>
      <Td align="right" className="tabular-nums">{formatMnt(order.totalMnt)}</Td>
      <Td align="right">
        <Button
          variant="secondary"
          disabled={loading}
          onClick={async () => {
            await markRefunded({ variables: { orderId: order.id, note: 'refunded from admin' } })
            onDone()
          }}
        >
          Буцаалт хийсэн
        </Button>
      </Td>
    </Tr>
  )
}

function Stat({ label, value, tone = 'neutral' }) {
  return (
    <div className="rounded-lg border border-a-line bg-white px-5 py-4">
      <p className="text-[12px] text-a-muted">{label}</p>
      <p className={`mt-1 text-[22px] font-semibold tabular-nums ${tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-a-ink'}`}>
        {value}
      </p>
    </div>
  )
}

function OrderCard({ order, onDone }) {
  const [confirm, { loading: confirming }] = useMutation(CONFIRM_PAYMENT)
  const [cancel, { loading: cancelling }] = useMutation(CANCEL_ORDER)
  const [reference, setReference] = useState('')
  const [error, setError] = useState(null)
  const items = nodes(order.orderItemCollection)
  const a = parseJson(order.shippingAddress)

  const onConfirm = async () => {
    setError(null)
    try {
      const res = await confirm({ variables: { orderId: order.id, externalReference: reference.trim() || null } })
      // confirm_payment returns `oversold` instead of throwing when stock is
      // short, so a plain success check would silently mislead.
      if (res.data?.confirmPayment?.status === 'oversold') {
        setError('Төлбөр баталгаажсан ч нөөц хүрэлцэхгүй байна. Буцаалт хийнэ үү.')
      }
      onDone()
    } catch (e) {
      setError(e?.message ?? 'Алдаа гарлаа.')
    }
  }

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="tabular-nums">{order.orderNumber}</span>
          <Badge tone={order.paymentStatus === 'submitted' ? 'blue' : 'amber'}>
            {order.paymentStatus === 'submitted' ? 'Төлсөн гэсэн' : 'Төлбөр хүлээгдэж буй'}
          </Badge>
          <span className="text-[12px] font-normal text-a-muted">{formatDate(order.placedAt)}</span>
        </span>
      }
      action={<span className="text-[15px] font-semibold tabular-nums">{formatMnt(order.totalMnt)}</span>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <Table head={['Бараа', 'Сонголт', { label: 'Тоо', align: 'right' }, { label: 'Дүн', align: 'right' }]}>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td>{i.productTitle}</Td>
                <Td className="text-a-muted">{i.variantLabel ?? '—'}</Td>
                <Td align="right" className="tabular-nums">{i.quantity}</Td>
                <Td align="right" className="tabular-nums">{formatMnt(i.lineTotalMnt)}</Td>
              </Tr>
            ))}
          </Table>
        </div>

        <div className="text-[13px]">
          <p className="font-medium text-a-ink">{a.recipient_name}</p>
          <p className="text-a-muted">{order.phone} · {order.email}</p>
          <p className="mt-1.5 text-a-muted">{formatAddress(a)}</p>
          {a.landmark_note && <p className="text-a-muted">{a.landmark_note}</p>}
          <p className="mt-2 text-a-muted">{order.deliveryMethod?.name}</p>
          {order.customerNote && (
            <p className="mt-2 rounded-md bg-a-hover px-2.5 py-2 text-a-muted">{order.customerNote}</p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-a-line pt-4">
        <div className="min-w-[200px] flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-a-ink">Гүйлгээний дугаар</span>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Заавал биш" />
        </div>
        <Button onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Түр хүлээнэ үү…' : 'Төлбөр баталгаажуулах'}
        </Button>
        <Button
          variant="danger"
          disabled={cancelling}
          onClick={async () => { await cancel({ variables: { orderId: order.id, reason: 'admin cancelled' } }); onDone() }}
        >
          Цуцлах
        </Button>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
    </Card>
  )
}
