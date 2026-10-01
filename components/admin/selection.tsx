'use client'

import { useMemo, useState } from 'react'
import { prune, selectionSummary, toggle, toggleAll } from '@/lib/admin/selection'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

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

const INDETERMINATE = [
  'data-[state=indeterminate]:grid data-[state=indeterminate]:place-items-center',
  'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
  '[&[data-state=indeterminate]>span]:hidden',
  'data-[state=indeterminate]:after:h-0.5 data-[state=indeterminate]:after:w-2 data-[state=indeterminate]:after:rounded-full data-[state=indeterminate]:after:bg-current',
].join(' ')

interface BoxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
}

function Box({ checked, indeterminate, onChange, label }: BoxProps) {
  return (
    <Checkbox
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={() => onChange()}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={cn('bg-card align-middle dark:bg-card', INDETERMINATE)}
    />
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
