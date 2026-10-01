import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderNotification } from '../../lib/email/templates.ts'

const PHONE_ONLY = {
  order_number: 'HTR-000101',
  total_mnt: 235400,
  customer_email: null,
  customer_phone: '89286859',
  items: [],
}

test('owner alerts identify a phone-only customer without printing null', () => {
  for (const kind of ['order_placed_owner', 'payment_submitted_owner', 'order_oversold_owner']) {
    const { html, subject } = renderNotification(kind, PHONE_ONLY)
    assert.equal(/\bnull\b|\bundefined\b/.test(html), false, `${kind} html leaks null`)
    assert.equal(/\bnull\b|\bundefined\b/.test(subject), false, `${kind} subject leaks null`)
    assert.match(html, /89286859/, `${kind} must still say who ordered`)
  }
})

test('an email customer is still identified by email', () => {
  const { html } = renderNotification('order_placed_owner', {
    ...PHONE_ONLY, customer_email: 'buyer@example.com',
  })
  assert.match(html, /buyer@example\.com/)
})

test('the transfer-claim receipt acknowledges without confirming', () => {
  const { subject, html } = renderNotification('payment_submitted_customer', {
    ...PHONE_ONLY, customer_email: 'buyer@example.com',
  })
  assert.match(subject, /HTR-000101/)
  assert.equal(/\bnull\b|\bundefined\b/.test(html), false, 'claim receipt html leaks null')
  assert.equal(/\bnull\b|\bundefined\b/.test(subject), false, 'claim receipt subject leaks null')
  assert.match(html, /баталгаажсан\s+гэсэн үг биш/, 'must say it is not a confirmation')
})
