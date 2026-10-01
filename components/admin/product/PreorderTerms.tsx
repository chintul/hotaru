'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { DEFAULT_DEPOSIT_PCT, depositOf } from '@/lib/preorder'
import { errorMessage } from '@/lib/errors'
import { Button, Card, Field, Input } from '@/components/admin/ui'
import { SET_PRODUCT_PREORDER, type PreorderTerms as Terms } from './documents'
import { PreorderBadge } from './PreorderToggle'
import type { EditorProduct, Refetch } from './types'

export interface PreorderTermsProps {
  product: EditorProduct
  refetch: Refetch
}

const TITLE = 'Урьдчилсан захиалгын нөхцөл'
const SAMPLE_PRICE = 100000

const clampPct = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 && n <= 100 ? n : null
}

export default function PreorderTerms({ product, refetch }: PreorderTermsProps) {
  const variants = nodes(product.variantCollection)
  const preorderVariant = variants.find((v) => v.allowBackorder)
  const price = toNumber(preorderVariant?.priceMnt ?? product.minPriceMnt) || SAMPLE_PRICE

  const form = (
    <TermsForm
      key={product.id}
      terms={product}
      price={price}
      refetch={refetch}
    />
  )

  if (preorderVariant) {
    return (
      <Card
        title={TITLE}
        subtitle="Худалдан авагч захиалахдаа хамгийн багадаа энэ хувийг урьдчилж, бараа ирэхэд үлдэгдлийг төлнө."
        actions={<PreorderBadge />}
      >
        {form}
      </Card>
    )
  }

  return (
    <details className="group rounded-xl border border-a-line bg-card px-6 py-3 shadow-xs">
      <summary className="flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden justify-between gap-3 text-[13px]">
        <span>
          <span className="font-medium text-a-ink">{TITLE}</span>
          <span className="ml-2 text-a-muted">
            Аль нэг сонголтод “Урьдчилсан захиалга” асаахад хэрэгжинэ.
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-a-muted group-open:hidden">Харах</span>
      </summary>
      <div className="mt-3 border-t border-a-line pt-4">{form}</div>
    </details>
  )
}

interface TermsFormProps {
  terms: Terms
  price: number
  refetch: Refetch
}

function TermsForm({ terms, price, refetch }: TermsFormProps) {
  const initialPct = String(terms.preorderDepositPct ?? DEFAULT_DEPOSIT_PCT)
  const initialEta = terms.preorderEta ?? ''
  const [pct, setPct] = useState(initialPct)
  const [eta, setEta] = useState(initialEta)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(SET_PRODUCT_PREORDER)

  const validPct = clampPct(pct)
  const dirty = pct !== initialPct || eta.trim() !== initialEta
  const upfront = validPct == null ? null : depositOf(price, validPct)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (validPct == null) return
    setError(null)
    try {
      await save({ variables: { productId: terms.id, depositPct: validPct, eta: eta.trim() || null } })
      await refetch()
      setSaved(true)
    } catch (err) {
      setError(errorMessage(err, 'Хадгалахад алдаа гарлаа.'))
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:items-start" onSubmit={onSubmit}>
      <Field label="Хамгийн бага урьдчилгаа (%)" hint="Худалдан авагч үүнээс багагүй дүнг өөрөө сонгож төлнө">
        <Input
          inputMode="numeric"
          value={pct}
          aria-invalid={validPct == null}
          onChange={(e) => { setSaved(false); setPct(e.target.value.replace(/\D/g, '').slice(0, 3)) }}
        />
      </Field>
      <Field label="Ирэх хугацаа · дэлгүүрт харагдана">
        <Input
          value={eta}
          placeholder="2–3 долоо хоног"
          onChange={(e) => { setSaved(false); setEta(e.target.value) }}
        />
      </Field>
      <div className="flex items-center gap-2 sm:pt-[26px]">
        {saved && !dirty && <span className="text-[12px] text-success-ink">Хадгалсан</span>}
        <Button type="submit" variant="primary" disabled={!dirty || validPct == null || loading}>
          {loading ? 'Хадгалж байна…' : 'Хадгалах'}
        </Button>
      </div>

      <p className="rounded-lg border border-a-line bg-a-bg px-3 py-2 text-[13px] text-a-ink sm:col-span-3">
        {upfront == null
          ? <span className="text-danger-ink">Урьдчилгаа 1–100 хувийн хооронд байна.</span>
          : <>
              {formatMnt(price)} бараанд: хамгийн багадаа <span className="font-semibold tabular-nums">{formatMnt(upfront)}</span> урьдчилж төлнө
              {validPct === 100 && <span className="text-a-muted"> · бүтэн дүнгээр</span>}
            </>}
      </p>

      {error && <p className="text-[13px] text-danger-ink sm:col-span-3">{error}</p>}
    </form>
  )
}
