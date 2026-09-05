'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_DISCOUNTS, ADMIN_UPSERT_DISCOUNT } from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Table, Td, Tr } from '@/components/admin/ui'

const KIND_LABEL = { percentage: 'Хувиар', fixed_amount: 'Тогтмол дүн', free_delivery: 'Үнэгүй хүргэлт' }

export default function DiscountsPage() {
  const { data, loading, refetch } = useQuery(ADMIN_DISCOUNTS, { fetchPolicy: 'cache-and-network' })
  const [save, { loading: saving }] = useMutation(ADMIN_UPSERT_DISCOUNT)
  const [form, setForm] = useState({ code: '', kind: 'percentage', value: '', minSubtotalMnt: '0', usageLimit: '' })
  const [error, setError] = useState(null)
  const codes = nodes(data?.discountCodeCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  return (
    <>
      <PageHeader
        title="Хөнгөлөлт"
        description="Код нь захиалга үүсэх үед сервер дээр шалгагдаж, дүн нь тэндээ тооцогдоно."
      />

      <Card title="Шинэ код" className="mb-6">
        <form
          className="grid gap-3 sm:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            try {
              await save({
                variables: {
                  code: form.code.trim().toUpperCase(),
                  kind: form.kind,
                  value: form.kind === 'free_delivery' ? '0' : String(toNumber(form.value)),
                  minSubtotalMnt: String(toNumber(form.minSubtotalMnt)),
                  usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
                  isActive: true,
                  discountId: null,
                },
              })
              setForm({ code: '', kind: 'percentage', value: '', minSubtotalMnt: '0', usageLimit: '' })
              refetch()
            } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
          }}
        >
          <Field label="Код *">
            <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="NAMAR10" />
          </Field>
          <Field label="Төрөл">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full rounded-md border border-a-line bg-white px-3 py-2 text-[13px]">
              {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label={form.kind === 'percentage' ? 'Хувь (0–100)' : 'Дүн (₮)'}>
            <Input value={form.value} disabled={form.kind === 'free_delivery'}
              onChange={(e) => setForm({ ...form, value: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Доод дүн (₮)">
            <Input value={form.minSubtotalMnt}
              onChange={(e) => setForm({ ...form, minSubtotalMnt: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Хязгаар" hint="Хоосон = хязгааргүй">
            <Input value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value.replace(/\D/g, '') })} />
          </Field>
          {error && <p className="sm:col-span-5 text-[13px] text-red-600">{error}</p>}
          <div className="sm:col-span-5">
            <Button type="submit" disabled={saving}>{saving ? 'Хадгалж байна…' : 'Үүсгэх'}</Button>
          </div>
        </form>
      </Card>

      {codes.length === 0 ? (
        <EmptyState title="Хөнгөлөлтийн код алга" body="Дээрх формоор эхний кодоо үүсгэнэ үү." />
      ) : (
        <Card>
          <Table head={['Код', 'Төрөл', { label: 'Утга', align: 'right' }, { label: 'Доод дүн', align: 'right' },
                        { label: 'Ашигласан', align: 'right' }, 'Идэвхтэй', { label: '', align: 'right' }]}>
            {codes.map((d) => <DiscountRow key={d.id} discount={d} onDone={refetch} />)}
          </Table>
        </Card>
      )}
    </>
  )
}

function DiscountRow({ discount, onDone }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_DISCOUNT)
  const toggle = async () => {
    await save({
      variables: {
        code: discount.code, kind: discount.kind, value: String(discount.value),
        minSubtotalMnt: String(discount.minSubtotalMnt), usageLimit: discount.usageLimit,
        isActive: !discount.isActive, discountId: discount.id,
      },
    })
    onDone()
  }
  return (
    <Tr>
      <Td className="font-medium">{discount.code}</Td>
      <Td className="text-a-muted">{KIND_LABEL[discount.kind] ?? discount.kind}</Td>
      <Td align="right" className="tabular-nums">
        {discount.kind === 'percentage' ? `${Number(discount.value)}%`
          : discount.kind === 'free_delivery' ? '—' : formatMnt(discount.value)}
      </Td>
      <Td align="right" className="tabular-nums">{formatMnt(discount.minSubtotalMnt)}</Td>
      <Td align="right" className="tabular-nums">
        {discount.timesUsed}{discount.usageLimit ? ` / ${discount.usageLimit}` : ''}
      </Td>
      <Td>{discount.isActive ? <Badge tone="green">идэвхтэй</Badge> : <Badge>унтраасан</Badge>}</Td>
      <Td align="right">
        <Button variant="secondary" disabled={loading} onClick={toggle}>
          {discount.isActive ? 'Унтраах' : 'Идэвхжүүлэх'}
        </Button>
      </Td>
    </Tr>
  )
}
