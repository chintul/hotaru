'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_DISCOUNTS, ADMIN_BULK_SET_DISCOUNT_ACTIVE,
  ADMIN_DISCOUNTS, ADMIN_UPSERT_DISCOUNT,
} from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import {
  Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Select, Status,
} from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
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

  const sel = useSelection(codes)
  const [setActive] = useMutation(ADMIN_BULK_SET_DISCOUNT_ACTIVE)
  const [bulkDelete] = useMutation(ADMIN_BULK_DELETE_DISCOUNTS)
  const [bulkError, setBulkError] = useState(null)

  const run = async (confirmText, fn) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    const ids = sel.ids
    try {
      await fn(ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(e?.message ?? 'Үйлдэл амжилтгүй боллоо.')
    }
  }

  const n = sel.count
  const bulkActions = [
    { key: 'on', label: 'Идэвхжүүлэх',
      run: () => run(`${n} кодыг идэвхжүүлэх үү?`,
        (ids) => setActive({ variables: { discountIds: ids, isActive: true } })) },
    { key: 'off', label: 'Идэвхгүй болгох',
      run: () => run(`${n} кодыг идэвхгүй болгох уу?`,
        (ids) => setActive({ variables: { discountIds: ids, isActive: false } })) },
    { key: 'delete', label: 'Устгах', tone: 'danger', separatorBefore: true,
      run: () => run(`${n} кодыг устгах уу? Буцаах боломжгүй.`,
        (ids) => bulkDelete({ variables: { discountIds: ids } })) },
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
        <>
          {bulkError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
              {bulkError}
            </p>
          )}
          <DataTable columns={columns} rows={codes} selection={sel} bulkActions={bulkActions} />
        </>
      )}
    </>
  )
}

function ToggleButton({ discount, onDone }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_DISCOUNT)
  const [failed, setFailed] = useState(false)
  return (
    <Button size="sm" disabled={loading}
      // Not destructive, so no confirm — but a refused write used to leave the
      // row looking unchanged with nothing said. The title carries the reason.
      title={failed ? 'Хадгалж чадсангүй. Дахин оролдоно уу.' : undefined}
      className={failed ? 'border-red-200 text-red-600' : ''}
      onClick={async () => {
        setFailed(false)
        try {
          await save({ variables: {
            code: discount.code, kind: discount.kind, value: String(discount.value),
            minSubtotalMnt: String(discount.minSubtotalMnt), usageLimit: discount.usageLimit,
            isActive: !discount.isActive, discountId: discount.id } })
          onDone()
        } catch { setFailed(true) }
      }}>
      {discount.isActive ? 'Унтраах' : 'Идэвхжүүлэх'}
    </Button>
  )
}
