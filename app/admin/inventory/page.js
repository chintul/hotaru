'use client'

import { useQuery } from '@apollo/client/react'
import { ADMIN_INVENTORY } from '@/lib/queries'
import { copy, formatMnt, nodes } from '@/lib/format'
import { Badge, Card, PageHeader, Table, Td, Tr } from '@/components/admin/ui'

export default function InventoryPage() {
  const { data, loading } = useQuery(ADMIN_INVENTORY, { fetchPolicy: 'cache-and-network' })
  const products = nodes(data?.productCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  const lowStock = products.flatMap((p) => nodes(p.variantCollection)).filter((v) => v.quantity <= 3).length

  return (
    <>
      <PageHeader
        title="Бараа"
        description={`${data?.productCollection?.totalCount ?? 0} бүтээгдэхүүн · ${lowStock} сонголтын үлдэгдэл бага`}
      />

      <Card>
        <Table
          head={['Бүтээгдэхүүн', 'SKU', 'Сонголт', { label: 'Үнэ', align: 'right' }, { label: 'Үлдэгдэл', align: 'right' }, 'Төлөв']}
        >
          {products.flatMap((p) => {
            const variants = nodes(p.variantCollection)
            const title = copy(p).title ?? p.slug
            return variants.map((v, idx) => (
              <Tr key={v.id}>
                <Td className={idx === 0 ? 'font-medium' : 'text-a-muted'}>
                  {idx === 0 ? title : ''}
                </Td>
                <Td className="tabular-nums text-a-muted">{v.sku ?? '—'}</Td>
                <Td className="text-a-muted">{v.optionValue ?? '—'}</Td>
                <Td align="right" className="tabular-nums">{formatMnt(v.priceMnt)}</Td>
                <Td align="right" className="tabular-nums">
                  <span className={v.quantity === 0 ? 'text-red-600' : v.quantity <= 3 ? 'text-amber-600' : ''}>
                    {v.quantity}
                  </span>
                </Td>
                <Td>
                  {idx === 0 && (
                    <Badge tone={p.status === 'active' ? 'green' : 'neutral'}>
                      {p.status}{p.isFeatured ? ' · онцлох' : ''}
                    </Badge>
                  )}
                </Td>
              </Tr>
            ))
          })}
        </Table>
      </Card>

      <p className="mt-4 text-[12px] text-a-muted">
        Засварлах боломж удахгүй. Бүх бичих үйлдэл DB функцээр дамжих ёстой тул admin_* функцууд
        бичигдэх хүртэл энэ хүснэгт зөвхөн харах горимд байна — түр Supabase Studio ашиглана уу.
      </p>
    </>
  )
}
