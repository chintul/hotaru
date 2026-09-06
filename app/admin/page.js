'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PENDING, ADMIN_SET_ORDER_STATUS } from '@/lib/queries'
import { formatDate, formatMnt, nodes } from '@/lib/format'
import { runBulk } from '@/lib/admin/bulk'
import { Button, DataTable, PageHeader, Status, TableToolbar } from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import BulkResult from '@/components/admin/BulkResult'

const PAYMENT_TONE = { unpaid: 'grey', submitted: 'amber', confirmed: 'green', failed: 'red', refunded: 'purple' }
const PAYMENT_LABEL = { unpaid: 'Төлөгдөөгүй', submitted: 'Төлсөн гэсэн', confirmed: 'Баталгаажсан', failed: 'Амжилтгүй', refunded: 'Буцаасан' }
const STATUS_TONE = { awaiting_payment: 'amber', paid: 'green', packed: 'blue', shipped: 'blue', delivered: 'green', cancelled: 'grey', refunded: 'purple', oversold: 'red' }
const STATUS_LABEL = { awaiting_payment: 'Төлбөр хүлээж буй', paid: 'Төлөгдсөн', packed: 'Бэлтгэсэн', shipped: 'Илгээсэн', delivered: 'Хүргэгдсэн', cancelled: 'Цуцлагдсан', refunded: 'Буцаагдсан', oversold: 'Нөөцгүй' }

const FILTERS = [
  ['all', 'Бүгд'],
  ['awaiting_payment', 'Төлбөр хүлээж буй'],
  ['paid', 'Бэлтгэх'],
  ['shipped', 'Илгээсэн'],
  ['oversold', 'Нөөцгүй'],
]

export default function AdminOrdersPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const { data, loading, refetch } = useQuery(ADMIN_ALL_ORDERS, {
    variables: { first: 100 },
    fetchPolicy: 'cache-and-network',
  })
  const { data: counts } = useQuery(ADMIN_PENDING, { fetchPolicy: 'cache-and-network' })

  const orders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return nodes(data?.orderCollection)
      .filter((o) => (filter === 'all' ? true : o.status === filter))
      .filter((o) => !term || o.orderNumber.toLowerCase().includes(term) || (o.email ?? '').toLowerCase().includes(term))
  }, [data, search, filter])

  const columns = [
    { key: 'order', header: 'Захиалга', render: (o) => <span className="font-medium tabular-nums">{o.orderNumber}</span> },
    { key: 'date', header: 'Огноо', render: (o) => <span className="text-a-muted">{formatDate(o.placedAt)}</span> },
    { key: 'customer', header: 'Худалдан авагч', render: (o) => o.email },
    { key: 'payment', header: 'Төлбөр', render: (o) => <Status tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus}</Status> },
    { key: 'status', header: 'Явц', render: (o) => <Status tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status] ?? o.status}</Status> },
    { key: 'total', header: 'Дүн', align: 'right', render: (o) => <span className="tabular-nums">{formatMnt(o.totalMnt)}</span> },
  ]

  const sel = useSelection(orders)
  const [setOrderStatus] = useMutation(ADMIN_SET_ORDER_STATUS)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  const byId = useMemo(
    () => Object.fromEntries(orders.map((o) => [o.id, o.orderNumber])),
    [orders])

  // Orders cannot use a set-based SQL function. admin_set_order_status refuses
  // fulfilment before payment is confirmed, so some rows must fail while the
  // rest succeed — partial success is the correct answer here, not an error.
  // Each success also emails the customer, hence the count in the confirm.
  const runOrders = async (status, label) => {
    if (!window.confirm(
      `${sel.count} захиалгын төлөвийг "${label}" болгох уу?\n\n`
      + 'Амжилттай болсон бүрд хэрэглэгчид имэйл илгээнэ.')) return

    setRunning(true)
    setResult(null)
    const res = await runBulk(sel.ids, (orderId) =>
      setOrderStatus({ variables: { orderId, status, trackingNumber: null, internalNote: null } }))
    setRunning(false)
    setResult(res)
    if (res.ok.length > 0) sel.clear()
    await refetch()
  }

  // `cancelled` is absent on purpose: admin_set_order_status refuses it
  // outright so stock is returned through cancel_order. Offering an action
  // that can only fail is worse than not offering it.
  const bulkActions = [
    { key: 'paid', label: 'Төлөгдсөн', run: () => runOrders('paid', 'Төлөгдсөн') },
    { key: 'packed', label: 'Бэлтгэсэн', run: () => runOrders('packed', 'Бэлтгэсэн') },
    { key: 'shipped', label: 'Илгээсэн', run: () => runOrders('shipped', 'Илгээсэн') },
    { key: 'delivered', label: 'Хүргэгдсэн', run: () => runOrders('delivered', 'Хүргэгдсэн') },
  ]

  return (
    <>
      <PageHeader
        title="Захиалга"
        subtitle="Мөр дээр дарж дэлгэрэнгүйг харна. Дансаар шилжүүлсэн төлбөрийг тэндээс баталгаажуулна."
      />

      <BulkResult result={result} labelFor={(id) => byId[id] ?? id} onDismiss={() => setResult(null)} />
      {running && <p className="mb-3 text-[13px] text-a-muted">Гүйцэтгэж байна…</p>}

      <DataTable
        columns={columns}
        rows={orders}
        selection={sel}
        bulkActions={bulkActions}
        onRowClick={(o) => router.push(`/admin/orders/${o.orderNumber}`)}
        empty={loading ? 'Ачааллаж байна…' : 'Захиалга алга'}
        toolbar={
          <TableToolbar search={search} onSearch={setSearch} placeholder="Дугаар, имэйл">
            {FILTERS.map(([value, label]) => {
              const n = value === 'awaiting_payment' ? counts?.awaiting?.totalCount
                : value === 'oversold' ? counts?.oversold?.totalCount : null
              return (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? 'primary' : 'secondary'}
                  onClick={() => setFilter(value)}
                >
                  {label}{n ? ` (${n})` : ''}
                </Button>
              )
            })}
          </TableToolbar>
        }
      />
    </>
  )
}
