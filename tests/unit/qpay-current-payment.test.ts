import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentPayment } from '../../lib/qpay/store.ts'
import { createInvoiceForOrder } from '../../lib/qpay/orders.ts'
import type { QpayStore } from '../../lib/qpay/orders.ts'
import { QPayError } from '../../lib/qpay/config.ts'

const row = (id: string, status: string, created_at: string) =>
  ({ id, amount_mnt: 1000, external_reference: null, status, created_at })

test('the open payment wins over a newer confirmed one', () => {
  const picked = currentPayment([
    row('deposit', 'confirmed', '2026-10-01T10:00:00Z'),
    row('balance', 'unpaid', '2026-10-05T10:00:00Z'),
  ])
  assert.equal(picked?.id, 'balance')
})

test('with nothing open, the newest row is current', () => {
  const picked = currentPayment([
    row('deposit', 'confirmed', '2026-10-01T10:00:00Z'),
    row('balance', 'confirmed', '2026-10-05T10:00:00Z'),
  ])
  assert.equal(picked?.id, 'balance')
})

test('no payments, no current payment', () => {
  assert.equal(currentPayment([]), null)
  assert.equal(currentPayment(null), null)
})

test('an invoice is refused when nothing is due between deposit and balance', async () => {
  const store: QpayStore<null> = {
    loadOrderForInvoice: async () => ({
      order: {
        id: 'o', orderNumber: 'HTR-000099', totalMnt: 226000,
        paymentAmountMnt: null, paymentStatus: 'partially_paid', externalReference: null,
      },
      settings: {
        qpayEnabled: true, qpayMerchantId: 'm', bankCode: '150000',
        bankAccountNumber: '2015', bankAccountName: 'HOTARU LLC',
      },
    }),
    attachInvoice: async () => { throw new Error('must not attach') },
    loadPayment: async () => null,
    confirmQpay: async () => {},
    noteMismatch: async () => {},
  }
  await assert.rejects(
    createInvoiceForOrder('o', { admin: null, store }),
    (e: unknown) => e instanceof QPayError && e.code === 'NOTHING_DUE' && e.status === 409,
  )
})
