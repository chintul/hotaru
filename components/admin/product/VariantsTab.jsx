'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_DELETE_VARIANT, ADMIN_SET_STOCK, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { Button, Card, Field, Input, Status } from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'

/**
 * Applies immediately — no Save button. Each row already has its own mutation,
 * so there is no transaction for a Save to commit.
 */
export default function VariantsTab({ product, refetch }) {
  const [adding, setAdding] = useState(false)
  const variants = nodes(product.variantCollection)

  return (
    <Card
      title="Сонголт"
      subtitle={`${variants.length} сонголт · өөрчлөлт шууд хадгалагдана`}
      actions={<Button onClick={() => setAdding(true)}><Plus /> Сонголт</Button>}
      padded={false}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-a-line">
            {['SKU', 'Сонголт', 'Үнэ', 'Үлдэгдэл', 'Төлөв', ''].map((h, i) => (
              <th
                key={h + i}
                className={`px-6 py-2.5 text-[13px] font-normal text-a-muted ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onDone={refetch} canDelete={variants.length > 1} />
          ))}
        </tbody>
      </table>

      {adding && (
        <div className="border-t border-a-line px-6 py-4">
          <VariantForm
            productId={product.id}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); refetch() }}
          />
        </div>
      )}
    </Card>
  )
}

function VariantRow({ variant, onDone, canDelete }) {
  const [setStock, { loading }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)
  const [qty, setQty] = useState(String(variant.quantity))
  const [error, setError] = useState(null)
  const dirty = String(variant.quantity) !== qty

  return (
    <tr className="border-b border-a-line last:border-0">
      <td className="px-6 py-3 text-[13px] tabular-nums text-a-muted">{variant.sku ?? '—'}</td>
      <td className="px-6 py-3 text-[13px]">{variant.optionValue ?? '—'}</td>
      <td className="px-6 py-3 text-right text-[13px] tabular-nums">{formatMnt(variant.priceMnt)}</td>
      <td className="px-6 py-3 text-right">
        <span className="flex items-center justify-end gap-2">
          <Input
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            className={`w-[72px] text-right tabular-nums ${variant.quantity === 0 ? 'text-red-600' : ''}`}
          />
          {dirty && (
            <Button
              variant="primary"
              size="sm"
              disabled={loading}
              onClick={async () => {
                setError(null)
                try {
                  await setStock({ variables: { variantId: variant.id, quantity: Number(qty) } })
                  onDone()
                } catch (e) { setError(e?.message ?? 'Алдаа') }
              }}
            >
              Хадгалах
            </Button>
          )}
        </span>
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </td>
      <td className="px-6 py-3">
        <Status tone={variant.isActive ? 'green' : 'grey'}>
          {variant.isActive ? 'идэвхтэй' : 'идэвхгүй'}
        </Status>
      </td>
      <td className="px-6 py-3 text-right">
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await removeVariant({ variables: { variantId: variant.id } })
              onDone()
            }}
          >
            Устгах
          </Button>
        )}
      </td>
    </tr>
  )
}

function VariantForm({ productId, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [f, setF] = useState({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <form
      className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        try {
          await save({ variables: {
            productId,
            priceMnt: String(toNumber(f.priceMnt)),
            quantity: Number(f.quantity || 0),
            sku: f.sku || null,
            optionLabel: f.optionValue ? f.optionLabel : null,
            optionValue: f.optionValue || null,
            compareAtPriceMnt: null,
            allowBackorder: false,
            isActive: true,
            sortOrder: 0,
            variantId: null,
          } })
          onSaved()
        } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
      }}
    >
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Cream" /></Field>
      <Field label="Үнэ (₮)">
        <Input required value={f.priceMnt} onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label="Үлдэгдэл">
        <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
      </Field>
      {error && <p className="text-[13px] text-red-600 sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" variant="primary" disabled={loading}>Нэмэх</Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}
