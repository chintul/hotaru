import { test } from 'node:test'
import assert from 'node:assert/strict'
import { saleOf, salePrice } from '../../lib/sale.ts'

test('a sale needs an old price above the current one', () => {
  assert.deepEqual(saleOf('80000', '100000'), { price: 80000, was: 100000, pct: 20 })
  assert.equal(saleOf('100000', '100000'), null)
  assert.equal(saleOf('100000', null), null)
})

test('the percentage rounds to a whole number', () => {
  assert.equal(saleOf(66600, 99900)?.pct, 33)
})

test('a sale price is rounded to the nearest hundred tugrik', () => {
  assert.equal(salePrice(128000, 20), 102400)
  assert.equal(salePrice(99900, 15), 84900)
})
