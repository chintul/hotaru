import { test } from 'node:test'
import assert from 'node:assert/strict'
import { depositOf, isPreorder, splitPayment } from '../../lib/preorder.ts'

test('a backorder variant is a pre-order only when stock cannot cover the quantity', () => {
  assert.equal(isPreorder({ quantity: 0, allowBackorder: true }), true)
  assert.equal(isPreorder({ quantity: 3, allowBackorder: true }, 2), false)
  assert.equal(isPreorder({ quantity: 1, allowBackorder: true }, 2), true)
  assert.equal(isPreorder({ quantity: 0, allowBackorder: false }), false)
})

test('deposits round up like the database', () => {
  assert.equal(depositOf(100000, 30), 30000)
  assert.equal(depositOf(99999, 30), 30000)
})

test('the split matches the server for a mixed cart with delivery', () => {
  const split = splitPayment([
    { quantity: 1, priceMnt: '100000', variant: { quantity: 0, allowBackorder: true }, depositPct: 30 },
    { quantity: 1, priceMnt: '121000', variant: { quantity: 10, allowBackorder: false } },
  ], 5000)
  assert.deepEqual(split, { total: 226000, balance: 70000, upfront: 156000, hasPreorder: true })
})

test('a discount never pushes the balance above the total', () => {
  const split = splitPayment([
    { quantity: 1, priceMnt: 100000, variant: { quantity: 0, allowBackorder: true }, depositPct: 10 },
  ], -95000)
  assert.equal(split.total, 5000)
  assert.equal(split.balance, 5000)
  assert.equal(split.upfront, 0)
})
