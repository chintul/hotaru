import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeVariant, hasSizes, parseSizes, uniqueColours } from '../../lib/sizes.ts'

test('custom sizes are split, trimmed and deduplicated in order', () => {
  assert.deepEqual(parseSizes(' 36, 37;37\n 38 ,, '), ['36', '37', '38'])
})

test('a variant reads as colour and size', () => {
  assert.equal(describeVariant({ optionValue: 'Хар', size: '38' }), 'Хар · Хэмжээ 38')
  assert.equal(describeVariant({ optionValue: 'Хар' }), 'Хар')
  assert.equal(describeVariant({ size: 'M' }), 'Хэмжээ M')
  assert.equal(describeVariant(null), '')
})

test('colours come out once each in first-seen order', () => {
  assert.deepEqual(uniqueColours([{ optionValue: 'Хар' }, { optionValue: 'Цагаан' }, { optionValue: 'Хар' }, {}]), ['Хар', 'Цагаан'])
  assert.equal(hasSizes([{ optionValue: 'Хар' }]), false)
  assert.equal(hasSizes([{ size: '38' }]), true)
})
