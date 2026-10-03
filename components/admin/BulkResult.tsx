'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BulkResult as BulkOutcome } from '@/lib/admin/bulk'
import { Button } from './ui'

export type { BulkOutcome }

type RowId = string | number

export interface BulkResultProps<Id extends RowId> {
  result: BulkOutcome<Id> | null
  labelFor?: (id: Id) => ReactNode
  onDismiss: () => void
}

const ownId = <Id extends RowId>(id: Id): ReactNode => id

export default function BulkResult<Id extends RowId>({ result, labelFor = ownId, onDismiss }: BulkResultProps<Id>) {
  const [open, setOpen] = useState(true)
  if (!result) return null

  const { ok, failed } = result
  const clean = failed.length === 0

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
        clean
          ? 'border-success-line bg-success-soft text-success-ink'
          : 'border-warn-line bg-warn-soft text-warn-ink'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">
          {ok.length} амжилттай{failed.length > 0 ? ` · ${failed.length} алдаа` : ''}
        </span>
        {failed.length > 0 && (
          <Button variant="link" onClick={() => setOpen((v) => !v)} className="font-normal">
            {open ? 'Нуух' : 'Дэлгэрэнгүй'}
          </Button>
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
              <span className="text-warn-ink">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
