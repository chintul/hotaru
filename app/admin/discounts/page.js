'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_DISCOUNTS, ADMIN_UPSERT_DISCOUNT } from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import {
  Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Select, Status,
} from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'

const KIND_LABEL = { percentage: 'Хувиар', fixed_amount: 'Тогтмол дүн', free_delivery: 'Үнэгүй хүргэлт' }

export default function DiscountsPage() {
  const { data, loading, refetch } = useQuery(ADMIN_DISCOUNTS, { fetchPolicy: 'cache-and-network' })
  const [save, { loading: saving }] = useMutation(ADMIN_UPSERT_DISCOUNT)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ code: '', kind: 'percentage', value: '', minSubtotalMnt: '0', usageLimit: '' })
  const [error, setError] = useState(null)
  const codes = nodes(data?.discountCodeCollection)

  const columns = [
    { key: 'code', header: 'Код', render: (d) => <span className="font-medium">{d.code}</span> },
    { key: 'kind', header: 'Төрөл', render: (d) => <span className="text-a-muted">{KIND_LABEL[d.kind] ?? d.kind}</span> },
    { key: 'value', header: 'Утга', align: 'right', render: (d) => (
      <span className="tabular-nums">
        {d.kind === 'percentage' ? `${Number(d.value)}%` : d.kind === 'free_delivery' ? '—' : formatMnt(d.value)}
      </span>) },
    { key: 'min', header: 'Доод дүн', align: 'right', render: (d) => (
      <span className="tabular-nums text-a-muted">{formatMnt(d.minSubtotalMnt)}</span>) },
    { key: 'used', header: 'Ашигласан', align: 'right', render: (d) => (
      <span className="tabular-nums">{d.timesUsed}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</span>) },
    { key: 'status', header: 'Төлөв', render: (d) => (
      <Status tone={d.isActive ? 'green' : 'grey'}>{d.isActive ? 'идэвхтэй' : 'унтраасан'}</Status>) },
    { key: 'action', header: '', align: 'right', render: (d) => <ToggleButton discount={d} onDone={refetch} /> },
  ]

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Хөнгөлөлт"
        subtitle="Код нь захиалга үүсэх үед сервер дээр шалгагдаж, дүн нь тэндээ тооцогдоно."
        actions={<Button variant="primary" onClick={() => setOpen(!open)}><Plus /> Шинэ код</Button>}
      />

      {open && (
        <div className="mb-4">
          <Card title="Шинэ код">
            <form className="grid gap-3 sm:grid-cols-5"
              onSubmit={async (e) => {
                e.preventDefault(); setError(null)
                try {
                  await save({ variables: {
                    code: f.code.trim().toUpperCase(), kind: f.kind,
                    value: f.kind === 'free_delivery' ? '0' : String(toNumber(f.value)),
                    minSubtotalMnt: String(toNumber(f.minSubtotalMnt)),
                    usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
                    isActive: true, discountId: null } })
                  setF({ code: '', kind: 'percentage', value: '', minSubtotalMnt: '0', usageLimit: '' })
                  setOpen(false); refetch()
                } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
              }}>
              <Field label="Код" required>
                <Input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="NAMAR10" />
              </Field>
              <Field label="Төрөл">
                <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                  {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </Field>
              <Field label={f.kind === 'percentage' ? 'Хувь (0–100)' : 'Дүн (₮)'}>
                <Input value={f.value} disabled={f.kind === 'free_delivery'}
                  onChange={(e) => setF({ ...f, value: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Доод дүн (₮)">
                <Input value={f.minSubtotalMnt}
                  onChange={(e) => setF({ ...f, minSubtotalMnt: e.target.value.replace(/\D/g, '') })} />
              </Field>
              <Field label="Хязгаар" hint="Хоосон = хязгааргүй">
                <Input value={f.usageLimit}
                  onChange={(e) => setF({ ...f, usageLimit: e.target.value.replace(/\D/g, '') })} />
              </Field>
              {error && <p className="text-[13px] text-red-600 sm:col-span-5">{error}</p>}
              <div className="flex gap-2 sm:col-span-5">
                <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Үүсгэх'}</Button>
                <Button type="button" onClick={() => setOpen(false)}>Болих</Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {codes.length === 0 ? (
        <EmptyState title="Хөнгөлөлтийн код алга" body="Эхний кодоо үүсгэнэ үү."
          action={<Button variant="primary" onClick={() => setOpen(true)}>Үүсгэх</Button>} />
      ) : (
        <DataTable columns={columns} rows={codes} />
      )}
    </>
  )
}

function ToggleButton({ discount, onDone }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_DISCOUNT)
  return (
    <Button size="sm" disabled={loading}
      onClick={async () => {
        await save({ variables: {
          code: discount.code, kind: discount.kind, value: String(discount.value),
          minSubtotalMnt: String(discount.minSubtotalMnt), usageLimit: discount.usageLimit,
          isActive: !discount.isActive, discountId: discount.id } })
        onDone()
      }}>
      {discount.isActive ? 'Унтраах' : 'Идэвхжүүлэх'}
    </Button>
  )
}
