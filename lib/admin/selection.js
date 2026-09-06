/**
 * Selection transitions, kept free of React so `node --test` can reach them.
 *
 * Every function takes a Set of ids and returns a new Set, except `prune`,
 * which returns the original when nothing changed — it feeds a useEffect
 * dependency, and a fresh Set on every render would loop.
 */

export function toggle(selected, id) {
  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

export function toggleAll(selected, ids) {
  const everySelected = ids.length > 0 && ids.every((id) => selected.has(id))
  return everySelected ? new Set() : new Set(ids)
}

/**
 * Drop ids that are no longer on screen. Acting on rows the operator cannot
 * see is the failure mode this exists to prevent: filter to drafts, select
 * them, clear the filter, hit Archive.
 */
export function prune(selected, ids) {
  const visible = new Set(ids)
  let changed = false
  for (const id of selected) {
    if (!visible.has(id)) { changed = true; break }
  }
  if (!changed) return selected

  const next = new Set()
  for (const id of selected) if (visible.has(id)) next.add(id)
  return next
}

export function selectionSummary(selected, ids) {
  const count = selected.size
  return {
    count,
    allSelected: ids.length > 0 && count === ids.length,
    someSelected: count > 0,
  }
}
