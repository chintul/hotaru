import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linkage, orphansOf, variantLabel } from '../../lib/admin/images.js'

test('variantLabel falls back through optionValue, sku, then a placeholder', () => {
  assert.equal(variantLabel({ optionValue: 'Cherry Jam', sku: 'HTR-1' }), 'Cherry Jam')
  assert.equal(variantLabel({ optionValue: null, sku: 'HTR-1' }), 'HTR-1')
  assert.equal(variantLabel({ optionValue: null, sku: null }), 'Нэргүй сонголт')
  assert.equal(variantLabel(null), 'Нэргүй сонголт')
})

test('linkage maps each image to the variants using it, in variant order', () => {
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i2' } },
  ]
  const { usage } = linkage(variants)
  assert.deepEqual(usage, { i1: ['Cherry'], i2: ['Cream'] })
})

test('linkage reports a shared image under both variants', () => {
  // Two variants on one photo is legal, but ProductCard.jsx:41-49 then hunts
  // for a *different* photo for the hover — and if none differs, hover dies.
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i1' } },
  ]
  const { usage } = linkage(variants)
  assert.deepEqual(usage.i1, ['Cherry', 'Cream'])
})

test('an image no variant points at simply has no usage entry', () => {
  // The gallery strip labels these `галерей`; there is no separate list.
  const { usage } = linkage([{ id: 'v1', optionValue: 'Cherry', image: { id: 'i2' } }])
  assert.equal(usage.i1, undefined)
  assert.equal(usage.i3, undefined)
  assert.deepEqual(usage.i2, ['Cherry'])
})

test('positionStillRules is true only when no variant carries an image', () => {
  assert.equal(linkage([{ id: 'v1', optionValue: 'Cherry', image: null }]).positionStillRules, true)
  assert.equal(linkage([]).positionStillRules, true)
  assert.equal(
    linkage([{ id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } }]).positionStillRules,
    false,
  )
})

test('linkage handles an empty product without throwing', () => {
  assert.deepEqual(linkage(), { usage: {}, positionStillRules: true })
  assert.deepEqual(linkage([]), { usage: {}, positionStillRules: true })
})

test('orphansOf names every variant that would lose its photo', () => {
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i1' } },
    { id: 'v3', optionValue: 'Berry', image: { id: 'i2' } },
    { id: 'v4', optionValue: 'Plain', image: null },
  ]
  assert.deepEqual(orphansOf('i1', variants), ['Cherry', 'Cream'])
  assert.deepEqual(orphansOf('i2', variants), ['Berry'])
  assert.deepEqual(orphansOf('i9', variants), [])
  assert.deepEqual(orphansOf('i1'), [])
})
