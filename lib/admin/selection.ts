export function toggle<Id>(selected: ReadonlySet<Id>, id: Id): Set<Id> {
  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

export function toggleAll<Id>(selected: ReadonlySet<Id>, ids: readonly Id[]): Set<Id> {
  const everySelected = ids.length > 0 && ids.every((id) => selected.has(id))
  return everySelected ? new Set() : new Set(ids)
}

export function prune<Id>(selected: Set<Id>, ids: readonly Id[]): Set<Id> {
  const visible = new Set(ids)
  const stillVisible = [...selected].filter((id) => visible.has(id))
  return stillVisible.length === selected.size ? selected : new Set(stillVisible)
}

export function selectionSummary<Id>(
  selected: ReadonlySet<Id>,
  ids: readonly Id[],
): { count: number; allSelected: boolean; someSelected: boolean } {
  const count = selected.size
  return {
    count,
    allSelected: ids.length > 0 && count === ids.length,
    someSelected: count > 0,
  }
}
