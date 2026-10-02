'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PENDING, ADMIN_SET_ORDER_STATUS } from '@/lib/queries'
import { formatDate, formatMnt, nodes } from '@/lib/format'
import { runBulk, type BulkResult as BulkOutcome } from '@/lib/admin/bulk'
import type { Connection, Order } from '@/lib/types'
import { Button, DataTable, PageHeader, Status, TableToolbar, type BulkAction, type Column } from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import { useConfirm } from '@/components/admin/confirm'
import BulkResult from '@/components/admin/BulkResult'
import PreorderQueues from '@/components/admin/PreorderQueues'
import { isDepositOrder, upfrontOf } from '@/components/admin/preorder'
import { paymentLabel, paymentTone, statusLabel, statusTone } from './_lib/order-status'

type FilterValue = 'all' | 'awaiting_payment' | 'deposit_paid' | 'awaiting_balance' | 'paid' | 'shipped' | 'oversold'

const FILTERS: ReadonlyArray<readonly [FilterValue, string]> = [
  ['all', 'Бүгд'],
  ['awaiting_payment', 'Төлбөр хүлээж буй'],
  ['deposit_paid', 'Бараа хүлээж буй'],
  ['awaiting_balance', 'Үлдэгдэл хүлээж буй'],
  ['paid', 'Бэлтгэх'],
  ['shipped', 'Илгээсэн'],
  ['oversold', 'Нөөцгүй'],
]

const PAGE = 50
const SEARCH_DEBOUNCE_MS = 300

interface OrderFilter {
  status?: { eq: string }
  or?: Array<{ orderNumber: { ilike: string } } | { email: { ilike: string } }>
}

interface AllOrdersData {
  orderCollection: Connection<Order> | null
}

interface AllOrdersVars {
  first: number
  filter: OrderFilter | null
}

interface PendingData {
  awaiting: Connection<Order> | null
  oversold: Connection<Order> | null
  depositPaid: Connection<Order> | null
  awaitingBalance: Connection<Order> | null
}

const PREORDER_BULK_SKIP = 'Урьдчилсан захиалга — төлбөрийг захиалгын хуудаснаас баталгаажуулна.'

interface SetOrderStatusVars {
  orderId: string
  status: string
  trackingNumber: string | null
  internalNote?: string | null
}

const escapeLikeWildcards = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

function buildFilter(status: FilterValue, term: string): OrderFilter | null {
  const filter: OrderFilter = {}
  if (status !== 'all') filter.status = { eq: status }
  const trimmed = term.trim()
  if (trimmed) {
    const like = `%${escapeLikeWildcards(trimmed)}%`
    filter.or = [{ orderNumber: { ilike: like } }, { email: { ilike: like } }]
  }
  return Object.keys(filter).length > 0 ? filter : null
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [limit, setLimit] = useState(PAGE)
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onSearch = (value: string) => {
    setSearch(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setTerm(value); setLimit(PAGE) }, SEARCH_DEBOUNCE_MS)
  }

  const onFilter = (value: FilterValue) => { setFilter(value); setLimit(PAGE) }

  const queryFilter = useMemo(() => buildFilter(filter, term), [term, filter])

  const { data, loading, refetch } = useQuery<AllOrdersData, AllOrdersVars>(ADMIN_ALL_ORDERS, {
    variables: { first: limit, filter: queryFilter },
    fetchPolicy: 'cache-and-network',
  })
  const { data: counts, refetch: refetchPending } = useQuery<PendingData>(ADMIN_PENDING, { fetchPolicy: 'cache-and-network' })

  const orders = nodes(data?.orderCollection)
  const matched = data?.orderCollection?.totalCount ?? 0
  const hasMore = Boolean(data?.orderCollection?.pageInfo?.hasNextPage)

  const columns: Column<Order>[] = [
    {
      key: 'order',
      header: 'Захиалга',
      render: (o) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium tabular-nums">{o.orderNumber}</span>
          {isDepositOrder(o) && (
            <span className="rounded-full border border-info-line bg-info-soft px-1.5 text-[11px] font-medium text-info-ink">
              урьдчилсан
            </span>
          )}
        </span>
      ),
    },
    { key: 'date', header: 'Огноо', render: (o) => <span className="text-a-muted">{formatDate(o.placedAt)}</span> },
    { key: 'customer', header: 'Худалдан авагч', render: (o) => o.email },
    { key: 'payment', header: 'Төлбөр', render: (o) => <Status tone={paymentTone(o.paymentStatus)}>{paymentLabel(o.paymentStatus)}</Status> },
    { key: 'status', header: 'Явц', render: (o) => <Status tone={statusTone(o.status)}>{statusLabel(o.status)}</Status> },
    {
      key: 'total',
      header: 'Дүн',
      align: 'right',
      render: (o) => isDepositOrder(o) && o.status === 'awaiting_payment'
        ? (
          <span className="tabular-nums">
            Хамгийн бага урьдчилгаа <span className="font-medium">{formatMnt(o.minUpfrontMnt ?? upfrontOf(o))}</span>
            <span className="text-a-muted"> / нийт {formatMnt(o.totalMnt)}</span>
          </span>
        )
        : <span className="tabular-nums">{formatMnt(o.totalMnt)}</span>,
    },
  ]

  const sel = useSelection(orders)
  const [setOrderStatus] = useMutation<unknown, SetOrderStatusVars>(ADMIN_SET_ORDER_STATUS)
  const [result, setResult] = useState<BulkOutcome<string> | null>(null)
  const [running, setRunning] = useState(false)
  const confirm = useConfirm()

  const orderNumberById = useMemo(
    () => Object.fromEntries(orders.map((o) => [o.id, o.orderNumber])),
    [orders])

  const unpaidPreorderIds = useMemo(
    () => new Set(orders.filter((o) => isDepositOrder(o) && o.paymentStatus !== 'confirmed').map((o) => o.id)),
    [orders])

  const refetchAll = () => Promise.all([refetch(), refetchPending()])

  const runOrders = async (status: string, label: string) => {
    const ok = await confirm({
      title: `${sel.count} захиалгын төлөвийг "${label}" болгох уу?`,
      description: 'Амжилттай болсон бүрд хэрэглэгчид имэйл илгээнэ.',
    })
    if (!ok) return

    setRunning(true)
    setResult(null)
    const res = await runBulk(sel.ids, (orderId: string) =>
      status === 'paid' && unpaidPreorderIds.has(orderId)
        ? Promise.reject(new Error(PREORDER_BULK_SKIP))
        : setOrderStatus({ variables: { orderId, status, trackingNumber: null, internalNote: null } }))
    setRunning(false)
    setResult(res)
    if (res.ok.length > 0) sel.clear()
    await refetchAll()
  }

  const bulkActions: BulkAction[] = [
    { key: 'paid', label: 'Төлөгдсөн', run: () => runOrders('paid', 'Төлөгдсөн') },
    { key: 'packed', label: 'Бэлтгэсэн', run: () => runOrders('packed', 'Бэлтгэсэн') },
    { key: 'shipped', label: 'Илгээсэн', run: () => runOrders('shipped', 'Илгээсэн') },
    { key: 'delivered', label: 'Хүргэгдсэн', run: () => runOrders('delivered', 'Хүргэгдсэн') },
  ]

  const pendingCount = (value: FilterValue) => {
    switch (value) {
      case 'awaiting_payment': return counts?.awaiting?.totalCount
      case 'deposit_paid': return counts?.depositPaid?.totalCount
      case 'awaiting_balance': return counts?.awaitingBalance?.totalCount
      case 'oversold': return counts?.oversold?.totalCount
      default: return null
    }
  }

  return (
    <>
      <PageHeader
        title="Захиалга"
        subtitle="Мөр дээр дарж дэлгэрэнгүйг харна. Дансаар шилжүүлсэн төлбөрийг тэндээс баталгаажуулна."
      />

      <PreorderQueues
        depositPaid={counts?.depositPaid}
        awaitingBalance={counts?.awaitingBalance}
        onDone={refetchAll}
      />

      <BulkResult result={result} labelFor={(id: string) => orderNumberById[id] ?? id} onDismiss={() => setResult(null)} />
      {running && <p className="mb-3 text-[13px] text-a-muted">Гүйцэтгэж байна…</p>}

      <DataTable
        columns={columns}
        rows={orders}
        selection={sel}
        bulkActions={bulkActions}
        onRowClick={(o: Order) => router.push(`/admin/orders/${o.orderNumber}`)}
        empty={loading ? 'Ачааллаж байна…' : term ? `"${term}" олдсонгүй` : 'Захиалга алга'}
        toolbar={
          <TableToolbar search={search} onSearch={onSearch} placeholder="Дугаар, имэйл">
            {FILTERS.map(([value, label]) => {
              const n = pendingCount(value)
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
