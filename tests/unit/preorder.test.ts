import { test } from 'node:test'
import assert from 'node:assert/strict'
import { depositOf, isPreorder, splitPayment, unitPriceOf } from '../../lib/preorder.ts'

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

test('a pre-order line uses the pre-order price, a stocked line the normal one', () => {
  const variant = { quantity: 0, allowBackorder: true, priceMnt: '100000', preorderPriceMnt: '90000' }
  assert.equal(unitPriceOf(variant), 90000)
  assert.equal(unitPriceOf({ ...variant, quantity: 5 }), 100000)
  assert.equal(unitPriceOf({ ...variant, preorderPriceMnt: null }), 100000)
})

test('the split matches the server with a pre-order price', () => {
  const split = splitPayment([
    { quantity: 1, priceMnt: '100000', variant: { quantity: 0, allowBackorder: true, preorderPriceMnt: '90000' }, depositPct: 30 },
  ], 5000)
  assert.deepEqual(split, { total: 95000, balance: 63000, upfront: 32000, hasPreorder: true })
})
