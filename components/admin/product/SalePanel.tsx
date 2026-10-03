'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { formatMnt } from '@/lib/format'
import { variantLabel } from '@/lib/admin/images'
import { Button, Field, Input } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { UPSERT_VARIANT } from './documents'
import { COMPARE_AT_MESSAGE, variantErrorMessage } from './sizeGrid'
import {
  SALE_PCT_CHIPS, SALE_PCT_MAX, SALE_PCT_MIN, changeVars, isValidSalePct, planSale,
} from './saleBatch'
import type { PriceChange } from './saleBatch'
import { PANEL_ACTIONS, TOUCH_INPUT } from './touch'
import type { EditorVariant } from './types'

export interface BatchResult {
  ok: number
  failures: string[]
}

export const batchNotice = ({ ok }: BatchResult): string | null =>
  ok ? `${ok} сонголт шинэчлэгдлээ.` : null

export const batchFailure = ({ failures }: BatchResult): string | null =>
  failures.length ? `${failures.length} сонголт шинэчлэгдсэнгүй: ${failures.join('; ')}` : null

export function usePriceBatch(productId: string) {
  const [save] = useMutation(UPSERT_VARIANT)
  const [running, setRunning] = useState(false)

  const run = async (changes: readonly PriceChange[]): Promise<BatchResult> => {
    setRunning(true)
    let ok = 0
    const failures: string[] = []
    try {
      for (const change of changes) {
        const label = variantLabel(change.variant)
        if (change.compareAtPriceMnt != null && change.priceMnt >= change.compareAtPriceMnt) {
          failures.push(`${label} — ${COMPARE_AT_MESSAGE}`)
          continue
        }
        try {
          await save({ variables: changeVars(productId, change) })
          ok += 1
        } catch (e) {
          failures.push(`${label} — ${variantErrorMessage(e, 'Хадгалахад алдаа гарлаа.')}`)
        }
      }
    } finally {
      setRunning(false)
    }
    return { ok, failures }
  }

  return { run, running }
}

export interface SalePanelProps {
  variants: readonly EditorVariant[]
  running: boolean
  onApply: (changes: PriceChange[]) => void
  onClose: () => void
}

const PREVIEW_COUNT = 3

export default function SalePanel({ variants, running, onApply, onClose }: SalePanelProps) {
  const [pctText, setPctText] = useState('20')
  const pct = Number(pctText)
  const valid = pctText !== '' && isValidSalePct(pct)
  const changes = valid ? planSale(variants, pct) : []

  const seen = new Set<number>()
  const preview = changes.filter((c) => {
    const was = c.compareAtPriceMnt ?? 0
    if (seen.has(was)) return false
    seen.add(was)
    return true
  })

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (valid && changes.length) onApply(changes)
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <div className="grid gap-3 md:flex md:flex-wrap md:items-end">
        <Field label="Хямдрал (%)" hint={`${SALE_PCT_MIN}–${SALE_PCT_MAX}`}>
          <Input
            inputMode="numeric"
            value={pctText}
            onChange={(e) => setPctText(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-invalid={(pctText !== '' && !valid) || undefined}
            className={`${TOUCH_INPUT} w-24 text-right tabular-nums`}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5 md:pb-[22px]">
          {SALE_PCT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setPctText(String(chip))}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[13px] tabular-nums transition-colors md:py-1',
                pct === chip
                  ? 'border-danger-line bg-danger-soft font-medium text-danger-ink'
                  : 'border-a-line text-a-ink hover:bg-a-hover',
              )}
            >
              {chip}%
            </button>
          ))}
        </div>
      </div>

      {valid && changes.length > 0 && (
        <ul className="grid gap-1 text-[13px] tabular-nums">
          {preview.slice(0, PREVIEW_COUNT).map((c) => (
            <li key={c.variant.id}>
              <span className="text-a-muted line-through">{formatMnt(c.compareAtPriceMnt)}</span>
              {' → '}
              <span className="font-medium text-a-ink">{formatMnt(c.priceMnt)}</span>
            </li>
          ))}
          {preview.length > PREVIEW_COUNT && (
            <li className="text-a-muted">…бусад {preview.length - PREVIEW_COUNT} үнэ</li>
          )}
        </ul>
      )}
      {pctText !== '' && !valid && (
        <p className="text-[13px] text-danger-ink">Хямдрал {SALE_PCT_MIN}–{SALE_PCT_MAX}% байна.</p>
      )}
      {valid && changes.length === 0 && (
        <p className="text-[13px] text-a-muted">Идэвхтэй сонголт алга.</p>
      )}
      <p className="text-[12px] text-a-muted">
        Бүх идэвхтэй сонголтод хэрэглэнэ. Хуучин үнэ хадгалагдаж, шинэ үнэ 100₮ хүртэл бөөрөнхийлөгдөнө.
      </p>

      <div className={PANEL_ACTIONS}>
        <Button type="submit" variant="primary" disabled={!valid || changes.length === 0 || running}>
          {running ? 'Шинэчилж байна…' : `${changes.length} сонголтод хэрэглэх`}
        </Button>
        <Button type="button" onClick={onClose} disabled={running}>Болих</Button>
      </div>
    </form>
  )
}
