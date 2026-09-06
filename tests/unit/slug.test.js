import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from '../../lib/slug.js'

test('Mongolian Cyrillic transliterates to readable ascii', () => {
  assert.equal(slugify('Цүнх'), 'tsunkh')
  assert.equal(slugify('Аяга сав'), 'ayaga-sav')
  assert.equal(slugify('Ноосон малгай'), 'nooson-malgai')
})

test('latin input is left recognisable', () => {
  assert.equal(slugify('Woven Shoulder Bag'), 'woven-shoulder-bag')
  assert.equal(slugify('Café Crème'), 'cafe-creme')
})

test('punctuation and spacing collapse to single hyphens', () => {
  assert.equal(slugify('  Bag —  "Cream" / 2026!  '), 'bag-cream-2026')
  assert.equal(slugify('a---b'), 'a-b')
})

test('digits survive', () => {
  assert.equal(slugify('Аяга 500ml'), 'ayaga-500ml')
})

test('unusable input yields an empty string, never a bare hyphen', () => {
  assert.equal(slugify(''), '')
  assert.equal(slugify('   '), '')
  assert.equal(slugify('!!!'), '')
  assert.equal(slugify(null), '')
  assert.equal(slugify(undefined), '')
})
