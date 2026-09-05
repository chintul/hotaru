'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PENDING } from '@/lib/queries'
import { formatDate, formatMnt, nodes } from '@/lib/format'
import { Button, DataTable, PageHeader, Status, TableToolbar } from '@/components/admin/ui'

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

  const { data, loading } = useQuery(ADMIN_ALL_ORDERS, {
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

  return (
    <>
      <PageHeader
        title="Захиалга"
        subtitle="Мөр дээр дарж дэлгэрэнгүйг харна. Дансаар шилжүүлсэн төлбөрийг тэндээс баталгаажуулна."
      />

      <DataTable
        columns={columns}
        rows={orders}
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
