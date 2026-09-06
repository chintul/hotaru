import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prune, selectionSummary, toggle, toggleAll } from '../../lib/admin/selection.js'

test('toggle adds and removes without mutating the input', () => {
  const before = new Set(['a'])
  const after = toggle(before, 'b')
  assert.deepEqual([...after].sort(), ['a', 'b'])
  assert.deepEqual([...before], ['a'], 'the input set is left alone')
  assert.deepEqual([...toggle(after, 'a')], ['b'])
})

test('toggleAll selects every id, and clears when all are already selected', () => {
  const ids = ['a', 'b', 'c']
  const all = toggleAll(new Set(['a']), ids)
  assert.deepEqual([...all].sort(), ['a', 'b', 'c'], 'a partial selection fills in')
  assert.equal(toggleAll(all, ids).size, 0, 'a full selection clears')
})

test('prune drops ids that are no longer visible', () => {
  // The bug this guards: filter to drafts, select them, clear the filter, then
  // hit Archive — and rows you cannot see get archived.
  const selected = new Set(['a', 'b', 'c'])
  assert.deepEqual([...prune(selected, ['a', 'c'])].sort(), ['a', 'c'])
  assert.equal(prune(selected, []).size, 0)
})

test('prune returns the same Set when nothing changed', () => {
  // Referential stability matters: this feeds a useEffect dependency.
  const selected = new Set(['a', 'b'])
  assert.equal(prune(selected, ['a', 'b', 'c']), selected)
})

test('summary reports counts and the all/some distinction', () => {
  assert.deepEqual(selectionSummary(new Set(), ['a', 'b']),
    { count: 0, allSelected: false, someSelected: false })
  assert.deepEqual(selectionSummary(new Set(['a']), ['a', 'b']),
    { count: 1, allSelected: false, someSelected: true })
  assert.deepEqual(selectionSummary(new Set(['a', 'b']), ['a', 'b']),
    { count: 2, allSelected: true, someSelected: true })
  assert.deepEqual(selectionSummary(new Set(), []),
    { count: 0, allSelected: false, someSelected: false },
    'an empty table is not "all selected"')
})
