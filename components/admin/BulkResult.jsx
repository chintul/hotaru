'use client'

import { useState } from 'react'
import { Button } from './ui'

/**
 * Reports the outcome of a partial-failure batch.
 *
 * Orders are the reason this exists: admin_set_order_status refuses fulfilment
 * before payment is confirmed, so "17 succeeded, 3 refused, here is which and
 * why" is the honest answer — not a single red toast that hides which ones.
 */
export default function BulkResult({ result, labelFor = (id) => id, onDismiss }) {
  const [open, setOpen] = useState(true)
  if (!result) return null

  const { ok, failed } = result
  const clean = failed.length === 0

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
        clean
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">
          {ok.length} амжилттай{failed.length > 0 ? ` · ${failed.length} алдаа` : ''}
        </span>
        {failed.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="underline underline-offset-2">
            {open ? 'Нуух' : 'Дэлгэрэнгүй'}
          </button>
        )}
        <span className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onDismiss}>Хаах</Button>
        </span>
      </div>

      {open && failed.length > 0 && (
        <ul className="mt-2 space-y-1">
          {failed.map((f) => (
            <li key={f.id} className="flex flex-wrap gap-2">
              <span className="font-medium tabular-nums">{labelFor(f.id)}</span>
              <span className="text-amber-800">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
