import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderNotification } from '../../lib/email/templates.js'

// A phone sign-in has no email at all: place_order leaves orders.email null
// rather than write the synthesised @phone.hotaru.invalid address. The owner
// alerts identify the customer, so they must fall back to the phone instead of
// printing the word "null" at the person reading them.
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
