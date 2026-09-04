'use client'

import { useQuery } from '@apollo/client/react'
import { ADMIN_INVENTORY } from '@/lib/queries'
import { copy, formatMnt, nodes } from '@/lib/format'
import AdminGate from '@/components/AdminGate'

export default function InventoryPage() {
  return <AdminGate><InventoryList /></AdminGate>
}

function InventoryList() {
  const { data, loading } = useQuery(ADMIN_INVENTORY, { fetchPolicy: 'cache-and-network' })
  const products = nodes(data?.productCollection)

  if (loading && !data) return <p className="label text-ink-faint">Ачааллаж байна…</p>

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="label">Бараа ({data?.productCollection?.totalCount ?? 0})</h2>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-line text-left">
              <Th>Бүтээгдэхүүн</Th><Th>SKU</Th><Th>Сонголт</Th>
              <Th className="text-right">Үнэ</Th><Th className="text-right">Үлдэгдэл</Th><Th>Төлөв</Th>
            </tr>
          </thead>
          <tbody>
            {products.flatMap((p) => {
              const variants = nodes(p.variantCollection)
              const title = copy(p).title ?? p.slug
              return variants.map((v, idx) => (
                <tr key={v.id} className="border-b border-line">
                  <Td>{idx === 0 ? title : ''}</Td>
                  <Td className="tabular-nums text-ink-soft">{v.sku ?? '—'}</Td>
                  <Td className="text-ink-soft">{v.optionValue ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{formatMnt(v.priceMnt)}</Td>
                  <Td className={`text-right tabular-nums ${v.quantity === 0 ? 'text-sale' : ''}`}>{v.quantity}</Td>
                  <Td>
                    {idx === 0 && (
                      <span className="label text-ink-faint">
                        {p.status}{p.isFeatured ? ' · онцлох' : ''}
                      </span>
                    )}
                  </Td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>

      {/* Honest about scope rather than shipping a half-working editor: admin
          writes must go through SECURITY DEFINER functions like every other
          write, and those functions are not built yet. */}
      <p className="label mt-8 text-ink-faint">
        Засварлах боломж удахгүй. Одоогоор Supabase Studio ашиглана уу — бүх бичих үйлдэл
        DB функцээр дамжих ёстой тул admin_* функцууд бичигдэх хүртэл энэ хүснэгт зөвхөн харах горимд байна.
      </p>
    </div>
  )
}

const Th = ({ children, className = '' }) => (
  <th className={`label py-2.5 pr-4 font-medium text-ink-faint ${className}`}>{children}</th>
)
const Td = ({ children, className = '' }) => (
  <td className={`py-3 pr-4 ${className}`}>{children}</td>
)
