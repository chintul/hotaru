import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confirmOrderFromCallback, createInvoiceForOrder } from '../../lib/qpay/orders.js'
import { resetTokenCache } from '../../lib/qpay/client.js'

const ORDER = '11111111-1111-1111-1111-111111111111'

function setEnv() {
  Object.assign(process.env, {
    QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_TERMINAL_ID: 't',
    QPAY_MERCHANT_ID: 'env-merch', QPAY_BASE_URL: 'https://quickqr.example',
    QPAY_CALLBACK_SECRET: 'secret', NEXT_PUBLIC_SITE_URL: 'https://hotaru.mn',
  })
  resetTokenCache()
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const TOKEN = { access_token: 'tok', expires_in: 3600 }

const ORDER_ROW = {
  id: ORDER, orderNumber: 'HTR-000042', totalMnt: 235400,
  paymentAmountMnt: 235400, paymentStatus: 'unpaid', externalReference: null,
}
const SETTINGS = {
  qpayEnabled: true, qpayMerchantId: 'merch-1',
  bankCode: '150000', bankAccountNumber: '2015', bankAccountName: 'HOTARU LLC',
}

function fakeStore(overrides = {}) {
  const calls = []
  return {
    calls,
    loadOrderForInvoice: async () => ({ order: ORDER_ROW, settings: SETTINGS }),
    attachInvoice: async (_a, args) => { calls.push(['attachInvoice', args]) },
    loadPayment: async () => ({ ...ORDER_ROW, externalReference: 'inv-1' }),
    confirmQpay: async (_a, args) => { calls.push(['confirmQpay', args]) },
    noteMismatch: async (_a, args) => { calls.push(['noteMismatch', args]) },
    ...overrides,
  }
}

test('an invoice is created for the recorded amount and stashed on the payment', async () => {
  setEnv()
  const store = fakeStore()
  const seen = []
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: init.body ? JSON.parse(init.body) : null })
    return ok(url.endsWith('/v2/auth/token')
      ? TOKEN
      : { id: 'inv-9', qr_code: 'QR', qr_image: 'IMG', urls: [{ name: 'Khan', link: 'k://' }] })
  }

  const out = await createInvoiceForOrder(ORDER, { admin: null, store, fetchImpl })

  const invoice = seen.find((s) => s.url.endsWith('/v2/invoice')).body
  // The price the customer agreed to, not one recomputed at pay time.
  assert.equal(invoice.amount, 235400)
  assert.equal(invoice.merchant_id, 'merch-1', 'settings merchant wins over the env default')
  assert.equal(invoice.description, 'HTR-000042')
  assert.equal(invoice.bank_accounts[0].account_bank_code, '150000')
  assert.match(invoice.callback_url, /^https:\/\/hotaru\.mn\/api\/payments\/qpay\/callback\?order=/)

  const [name, args] = store.calls[0]
  assert.equal(name, 'attachInvoice')
  assert.equal(args.orderId, ORDER)
  assert.equal(args.invoiceId, 'inv-9')
  assert.equal(args.payload.id, 'inv-9', 'the create response is kept for audit')
  assert.equal(out.invoiceId, 'inv-9')
  assert.equal(out.qrImage, 'IMG')
})

test('a disabled or unconfigured store never reaches QPay', async () => {
  setEnv()
  const store = fakeStore({
    loadOrderForInvoice: async () => ({ order: ORDER_ROW, settings: { ...SETTINGS, qpayEnabled: false } }),
  })
  let called = false
  const fetchImpl = async () => { called = true; return ok(TOKEN) }

  await assert.rejects(() => createInvoiceForOrder(ORDER, { admin: null, store, fetchImpl }),
    (e) => e.code === 'QPAY_DISABLED')
  assert.equal(called, false)
})

test('a PAID invoice for the expected amount confirms the order', async () => {
  setEnv()
  const store = fakeStore()
  const fetchImpl = async (url) => ok(url.endsWith('/v2/auth/token')
    ? TOKEN : { invoice_status: 'PAID' })

  const res = await confirmOrderFromCallback(ORDER, { admin: null, store, fetchImpl })

  assert.equal(res.outcome, 'confirmed')
  const [name, args] = store.calls[0]
  assert.equal(name, 'confirmQpay')
  assert.equal(args.orderId, ORDER)
  assert.equal(args.invoiceId, 'inv-1')
  assert.equal(args.amountMnt, 235400)
})

test('an OPEN invoice confirms nothing', async () => {
  setEnv()
  const store = fakeStore()
  const fetchImpl = async (url) => ok(url.endsWith('/v2/auth/token')
    ? TOKEN : { invoice_status: 'OPEN' })

  const res = await confirmOrderFromCallback(ORDER, { admin: null, store, fetchImpl })
  assert.equal(res.outcome, 'pending')
  assert.equal(store.calls.length, 0)
})

test('an amount QPay does not agree with is never auto-confirmed', async () => {
  setEnv()
  const store = fakeStore()
  // QuickQR usually reports no total at all, but when it does report one it
  // must match the invoice we created. Confirming a short payment would mark an
  // order paid that is not.
  const fetchImpl = async (url) => ok(url.endsWith('/v2/auth/token')
    ? TOKEN : { invoice_status: 'PAID', paid_amount: 1000 })

  const res = await confirmOrderFromCallback(ORDER, { admin: null, store, fetchImpl })

  assert.equal(res.outcome, 'mismatch')
  assert.equal(store.calls.length, 1)
  const [name, args] = store.calls[0]
  assert.equal(name, 'noteMismatch')
  assert.match(args.message, /1000/)
  assert.match(args.message, /235400/)
})

test('a callback for an order with no invoice is ignored, not confirmed', async () => {
  setEnv()
  const store = fakeStore({ loadPayment: async () => null })
  const fetchImpl = async () => ok(TOKEN)

  const res = await confirmOrderFromCallback(ORDER, { admin: null, store, fetchImpl })
  assert.equal(res.outcome, 'unknown')
  assert.equal(store.calls.length, 0)
})

test('an already-confirmed order is a no-op', async () => {
  setEnv()
  const store = fakeStore({
    loadPayment: async () => ({ ...ORDER_ROW, externalReference: 'inv-1', paymentStatus: 'confirmed' }),
  })
  const fetchImpl = async () => ok(TOKEN)

  const res = await confirmOrderFromCallback(ORDER, { admin: null, store, fetchImpl })
  assert.equal(res.outcome, 'already')
  assert.equal(store.calls.length, 0)
})
