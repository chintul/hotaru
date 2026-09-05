import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cartTotals, firstNode, formatMnt, nodes, parseJson, toNumber } from '../../lib/format.js'

test('money is whole tugrik — never divided by 100', () => {
  // pg_graphql returns bigint as a String; coercing is not optional.
  assert.equal(toNumber('189000'), 189000)
  assert.equal(toNumber(null), 0)
  assert.equal(toNumber(''), 0)
  assert.match(formatMnt('189000'), /189[\s, ]?000₮/)
  assert.equal(formatMnt(null), '')
})

test('cart totals coerce string prices before summing', () => {
  // The bug this guards: '240000' + '5000' concatenates instead of adding.
  const items = [
    { quantity: 2, variant: { priceMnt: '128000' } },
    { quantity: 1, variant: { priceMnt: '5000' } },
  ]
  const { subtotal, count } = cartTotals(items)
  assert.equal(subtotal, 261000)
  assert.equal(count, 3)
})

test('relay connections unwrap safely', () => {
  assert.deepEqual(nodes({ edges: [{ node: 1 }, { node: 2 }] }), [1, 2])
  assert.deepEqual(nodes(undefined), [])
  assert.equal(firstNode(undefined), null)
})

test('jsonb arrives as a string and must be parsed', () => {
  // pg_graphql serialises jsonb as a JSON string; reading fields off the raw
  // value silently yields undefined.
  assert.deepEqual(parseJson('{"city_aimag":"УБ"}'), { city_aimag: 'УБ' })
  assert.deepEqual(parseJson({ city_aimag: 'УБ' }), { city_aimag: 'УБ' })
  assert.deepEqual(parseJson('not json'), {})
  assert.deepEqual(parseJson(null), {})
})
