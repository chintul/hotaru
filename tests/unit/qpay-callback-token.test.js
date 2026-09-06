import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callbackUrlFor, signOrder, verifyOrder } from '../../lib/qpay/callback-token.js'

const ORDER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'

function withSecret(secret, fn) {
  const prev = process.env.QPAY_CALLBACK_SECRET
  Object.assign(process.env, {
    QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_TERMINAL_ID: 't',
    QPAY_MERCHANT_ID: 'm', QPAY_BASE_URL: 'https://x.example',
    QPAY_CALLBACK_SECRET: secret,
  })
  try { return fn() } finally { process.env.QPAY_CALLBACK_SECRET = prev }
}

test('a signature verifies only for the order it was made for', () => {
  withSecret('secret-a', () => {
    const sig = signOrder(ORDER)
    assert.match(sig, /^[0-9a-f]{64}$/)
    assert.equal(verifyOrder(ORDER, sig), true)
    assert.equal(verifyOrder(OTHER, sig), false)
  })
})

test('a signature made under another secret is rejected', () => {
  const sig = withSecret('secret-a', () => signOrder(ORDER))
  withSecret('secret-b', () => {
    assert.equal(verifyOrder(ORDER, sig), false)
  })
})

test('malformed tokens are rejected without throwing', () => {
  withSecret('secret-a', () => {
    for (const bad of [undefined, null, '', 'nope', 'a'.repeat(63), 'z'.repeat(64)]) {
      assert.equal(verifyOrder(ORDER, bad), false, `rejected: ${String(bad)}`)
    }
  })
})

test('the callback URL carries the order and its signature', () => {
  withSecret('secret-a', () => {
    const url = new URL(callbackUrlFor(ORDER, 'https://hotaru.mn/'))
    assert.equal(url.pathname, '/api/payments/qpay/callback')
    assert.equal(url.searchParams.get('order'), ORDER)
    assert.equal(verifyOrder(ORDER, url.searchParams.get('t')), true)
  })
})
