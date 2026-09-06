'use client'

import { useMemo, useState } from 'react'
import { prune, selectionSummary, toggle, toggleAll } from '@/lib/admin/selection'
import { Check, Minus } from './icons'

/**
 * Row selection for any admin list — table or cards.
 *
 * Deliberately not folded into DataTable: the reviews page is a card list that
 * needs the same checkboxes and the same bulk bar, and a table-only hook would
 * have forced it to become a table it should not be.
 *
 * This module imports nothing from ./ui, because ./ui imports from here. The
 * dependency runs one way: ui is the primitive layer, this sits above it.
 * BulkBar lives in ./ui for the same reason — it needs Button.
 */
export function useSelection(rows) {
  const [raw, setRaw] = useState(() => new Set())
  const ids = useMemo(() => rows.map((r) => r.id), [rows])

  // Pruned during render rather than synced in an effect. Searching or
  // filtering must never leave off-screen rows armed for a bulk action, and
  // deriving the intersection here makes that structurally true instead of
  // true-one-render-later. prune() returns the identical Set when nothing was
  // dropped, so this does not churn identity on every render.
  const selected = prune(raw, ids)
  const summary = selectionSummary(selected, ids)

  return {
    selected,
    ids: [...selected],
    isSelected: (row) => selected.has(row.id),
    // Each writes back the pruned set, so hidden ids never accumulate.
    toggleRow: (row) => setRaw(toggle(selected, row.id)),
    toggleAllRows: () => setRaw(toggleAll(selected, ids)),
    clear: () => setRaw(new Set()),
    ...summary,
  }
}

function Box({ checked, indeterminate, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
        checked || indeterminate
          ? 'border-a-ink bg-a-ink text-white'
          : 'border-a-line bg-white text-transparent hover:border-a-muted'
      }`}
    >
      <span className="scale-[.6]">{indeterminate ? <Minus /> : <Check />}</span>
    </button>
  )
}

/** Row checkbox. Swallows the click so row-click still navigates or expands. */
export const SelectCell = ({ checked, onChange }) => (
  <Box checked={checked} onChange={onChange} label="Мөр сонгох" />
)

export const SelectAllCell = ({ checked, indeterminate, onChange }) => (
  <Box checked={checked} indeterminate={indeterminate} onChange={onChange} label="Бүгдийг сонгох" />
)
