'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
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

const PAGE = 50

// What the admin types goes into an ilike pattern, so % and _ have to stop
// being wildcards — otherwise typing "%" matches every order and reads as a
// broken filter.
const escapeLike = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`)

export default function AdminOrdersPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')   // what is in the box
  const [term, setTerm] = useState('')       // what has been sent to Postgres
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE)
  const debounce = useRef(null)

  // Debounced in the event handler rather than in an effect: the repo's lint
  // rejects setState inside useEffect, and a keystroke is already an event.
  const onSearch = (value) => {
    setSearch(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setTerm(value); setLimit(PAGE) }, 300)
  }

  const onFilter = (value) => { setFilter(value); setLimit(PAGE) }

  // Postgres does the filtering. Anything done here would only ever see the
  // rows already fetched, which is what made the old search unreliable.
  const queryFilter = useMemo(() => {
    const f = {}
    if (filter !== 'all') f.status = { eq: filter }
    const t = term.trim()
    if (t) {
      const like = `%${escapeLike(t)}%`
      f.or = [{ orderNumber: { ilike: like } }, { email: { ilike: like } }]
    }
    return Object.keys(f).length > 0 ? f : null
  }, [term, filter])

  const { data, loading, refetch } = useQuery(ADMIN_ALL_ORDERS, {
    variables: { first: limit, filter: queryFilter },
    fetchPolicy: 'cache-and-network',
  })
  const { data: counts } = useQuery(ADMIN_PENDING, { fetchPolicy: 'cache-and-network' })

  const orders = nodes(data?.orderCollection)
  const matched = data?.orderCollection?.totalCount ?? 0
  // Widening `first` rather than walking cursors: one variable, no cache
  // merging to get wrong, and an admin list is hundreds of rows, not millions.
  const hasMore = Boolean(data?.orderCollection?.pageInfo?.hasNextPage)

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
        empty={loading ? 'Ачааллаж байна…' : term ? `"${term}" олдсонгүй` : 'Захиалга алга'}
        toolbar={
          <TableToolbar search={search} onSearch={onSearch} placeholder="Дугаар, имэйл">
            {FILTERS.map(([value, label]) => {
              const n = value === 'awaiting_payment' ? counts?.awaiting?.totalCount
                : value === 'oversold' ? counts?.oversold?.totalCount : null
              return (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? 'primary' : 'secondary'}
                  onClick={() => onFilter(value)}
                >
                  {label}{n ? ` (${n})` : ''}
                </Button>
              )
            })}
          </TableToolbar>
        }
      />

      {orders.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-a-muted">
            {term || filter !== 'all'
              ? `${matched} илэрцээс ${orders.length}`
              : `${matched} захиалгаас ${orders.length}`}
          </p>
          {hasMore && (
            <Button size="sm" disabled={loading} onClick={() => setLimit((n) => n + PAGE)}>
              {loading ? 'Ачааллаж байна…' : `Дараагийн ${PAGE}`}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
