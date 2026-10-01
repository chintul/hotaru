'use client'

import { useMemo, useState } from 'react'
import { prune, selectionSummary, toggle, toggleAll } from '@/lib/admin/selection'
import { Check, Minus } from './icons'

export interface SelectableRow {
  id: string
}

export interface Selection<T extends SelectableRow> {
  selected: Set<string>
  ids: string[]
  isSelected: (row: T) => boolean
  toggleRow: (row: T) => void
  toggleAllRows: () => void
  clear: () => void
  count: number
  allSelected: boolean
  someSelected: boolean
}

export function useSelection<T extends SelectableRow>(rows: readonly T[]): Selection<T> {
  const [raw, setRaw] = useState<Set<string>>(() => new Set())
  const ids = useMemo(() => rows.map((r) => r.id), [rows])

  const visibleSelection = prune(raw, ids)
  const summary = selectionSummary(visibleSelection, ids)

  return {
    selected: visibleSelection,
    ids: [...visibleSelection],
    isSelected: (row) => visibleSelection.has(row.id),
    toggleRow: (row) => setRaw(toggle(visibleSelection, row.id)),
    toggleAllRows: () => setRaw(toggleAll(visibleSelection, ids)),
    clear: () => setRaw(new Set()),
    ...summary,
  }
}

interface BoxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
}

function Box({ checked, indeterminate, onChange, label }: BoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
        checked || indeterminate
          ? 'border-a-ink bg-a-ink text-a-on-ink'
          : 'border-a-line bg-a-surface text-transparent hover:border-a-muted'
      }`}
    >
      <span className="scale-[.6]">{indeterminate ? <Minus /> : <Check />}</span>
    </button>
  )
}

export interface SelectCellProps {
  checked: boolean
  onChange: () => void
}

export const SelectCell = ({ checked, onChange }: SelectCellProps) => (
  <Box checked={checked} onChange={onChange} label="Мөр сонгох" />
)

export interface SelectAllCellProps extends SelectCellProps {
  indeterminate: boolean
}

export const SelectAllCell = ({ checked, indeterminate, onChange }: SelectAllCellProps) => (
  <Box checked={checked} indeterminate={indeterminate} onChange={onChange} label="Бүгдийг сонгох" />
)
