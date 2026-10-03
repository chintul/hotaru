import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EVENT_NAME, eventProperties, isAdminUrl } from '../../lib/analytics.ts'

test('admin pages are kept out of PostHog', () => {
  assert.equal(isAdminUrl('https://hotaru.mn/admin/orders/HTR-1'), true)
  assert.equal(isAdminUrl('https://hotaru.mn/shop/mug'), false)
  assert.equal(isAdminUrl(undefined), false)
})

test('events carry only the slug or order number, never personal data', () => {
  assert.deepEqual(eventProperties({ productSlug: 'mug' }), { product_slug: 'mug' })
  assert.deepEqual(eventProperties({}), {})
  assert.equal(EVENT_NAME.add_to_cart, 'added_to_cart')
})
