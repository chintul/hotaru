'use client'

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_DISCOUNTS, ADMIN_BULK_SET_DISCOUNT_ACTIVE,
  ADMIN_DISCOUNTS, ADMIN_UPSERT_DISCOUNT,
} from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import type { Connection, Discount } from '@/lib/types'
import {
  Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Select, Status,
  type BulkAction, type Column,
} from '@/components/admin/ui'
import { useSelection } from '@/components/admin/selection'
import { Plus } from '@/components/admin/icons'
import { errorMessage } from '@/lib/errors'

const KIND_LABEL: Record<string, string> = {
  percentage: 'Хувиар',
  fixed_amount: 'Тогтмол дүн',
  free_delivery: 'Үнэгүй хүргэлт',
}

interface DiscountDraft {
  code: string
  kind: string
  value: string
  minSubtotalMnt: string
  usageLimit: string
}

const EMPTY_DRAFT: DiscountDraft = { code: '', kind: 'percentage', value: '', minSubtotalMnt: '0', usageLimit: '' }

interface DiscountsData {
  discountCodeCollection: Connection<Discount> | null
}

interface UpsertDiscountVars {
  code: string
  kind: string
  value: string
  minSubtotalMnt: string
  usageLimit: number | null | undefined
  isActive: boolean
  discountId: string | null
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

function formatValue(d: Discount): string {
  if (d.kind === 'percentage') return `${Number(d.value)}%`
  if (d.kind === 'free_delivery') return '—'
  return formatMnt(d.value)
}

export default function DiscountsPage() {
  const { data, loading, refetch } = useQuery<DiscountsData>(ADMIN_DISCOUNTS, { fetchPolicy: 'cache-and-network' })
  const [save, { loading: saving }] = useMutation<unknown, UpsertDiscountVars>(ADMIN_UPSERT_DISCOUNT)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<DiscountDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const codes = nodes(data?.discountCodeCollection)

  const columns: Column<Discount>[] = [
    { key: 'code', header: 'Код', render: (d) => <span className="font-medium">{d.code}</span> },
    { key: 'kind', header: 'Төрөл', render: (d) => <span className="text-a-muted">{KIND_LABEL[d.kind] ?? d.kind}</span> },
    { key: 'value', header: 'Утга', align: 'right', render: (d) => (
      <span className="tabular-nums">{formatValue(d)}</span>) },
    { key: 'min', header: 'Доод дүн', align: 'right', render: (d) => (
      <span className="tabular-nums text-a-muted">{formatMnt(d.minSubtotalMnt)}</span>) },
    { key: 'used', header: 'Ашигласан', align: 'right', render: (d) => (
      <span className="tabular-nums">{d.timesUsed}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</span>) },
    { key: 'status', header: 'Төлөв', render: (d) => (
      <Status tone={d.isActive ? 'green' : 'grey'}>{d.isActive ? 'идэвхтэй' : 'унтраасан'}</Status>) },
    { key: 'action', header: '', align: 'right', render: (d) => <ToggleButton discount={d} onDone={refetch} /> },
  ]

  const sel = useSelection(codes)
  const [setActive] = useMutation<unknown, { discountIds: string[]; isActive: boolean }>(ADMIN_BULK_SET_DISCOUNT_ACTIVE)
  const [bulkDelete] = useMutation<unknown, { discountIds: string[] }>(ADMIN_BULK_DELETE_DISCOUNTS)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const n = sel.count

  const run = async (confirmText: string, fn: (ids: string[]) => Promise<unknown>) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    const ids = sel.ids
    try {
      await fn(ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(errorMessage(e, 'Үйлдэл амжилтгүй боллоо.'))
    }
  }

  const bulkActions: BulkAction[] = [
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

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null)
    try {
      await save({ variables: {
        code: f.code.trim().toUpperCase(), kind: f.kind,
        value: f.kind === 'free_delivery' ? '0' : String(toNumber(f.value)),
        minSubtotalMnt: String(toNumber(f.minSubtotalMnt)),
        usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
        isActive: true, discountId: null } })
      setF(EMPTY_DRAFT)
      setOpen(false); refetch()
    } catch (err) { setError(errorMessage(err, 'Алдаа гарлаа.')) }
  }

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
            <form className="grid gap-3 sm:grid-cols-5" onSubmit={onCreate}>
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
                  onChange={(e) => setF({ ...f, value: digitsOnly(e.target.value) })} />
              </Field>
              <Field label="Доод дүн (₮)">
                <Input value={f.minSubtotalMnt}
                  onChange={(e) => setF({ ...f, minSubtotalMnt: digitsOnly(e.target.value) })} />
              </Field>
              <Field label="Хязгаар" hint="Хоосон = хязгааргүй">
                <Input value={f.usageLimit}
                  onChange={(e) => setF({ ...f, usageLimit: digitsOnly(e.target.value) })} />
              </Field>
              {error && <p className="text-[13px] text-danger-ink sm:col-span-5">{error}</p>}
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
            <p className="mb-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-2.5 text-[13px] text-danger-ink">
              {bulkError}
            </p>
          )}
          <DataTable columns={columns} rows={codes} selection={sel} bulkActions={bulkActions} />
        </>
      )}
    </>
  )
}

interface ToggleButtonProps {
  discount: Discount
  onDone: () => unknown
}

function ToggleButton({ discount, onDone }: ToggleButtonProps) {
  const [save, { loading }] = useMutation<unknown, UpsertDiscountVars>(ADMIN_UPSERT_DISCOUNT)
  const [failed, setFailed] = useState(false)

  const toggle = async () => {
    setFailed(false)
    try {
      await save({ variables: {
        code: discount.code, kind: discount.kind, value: String(discount.value),
        minSubtotalMnt: String(discount.minSubtotalMnt), usageLimit: discount.usageLimit,
        isActive: !discount.isActive, discountId: discount.id } })
      onDone()
    } catch { setFailed(true) }
  }

  return (
    <Button size="sm" disabled={loading}
      title={failed ? 'Хадгалж чадсангүй. Дахин оролдоно уу.' : undefined}
      className={failed ? 'border-danger-line text-danger-ink' : ''}
      onClick={toggle}>
      {discount.isActive ? 'Унтраах' : 'Идэвхжүүлэх'}
    </Button>
  )
}
