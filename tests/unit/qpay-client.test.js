import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QPayError, isConfigured, qpayConfig } from '../../lib/qpay/config.js'
import { checkPayment, createInvoice, resetTokenCache } from '../../lib/qpay/client.js'

const ENV = {
  QPAY_USERNAME: 'user', QPAY_PASSWORD: 'pass', QPAY_TERMINAL_ID: 'term-1',
  QPAY_MERCHANT_ID: 'merch-1', QPAY_BASE_URL: 'https://quickqr.example',
  QPAY_CALLBACK_SECRET: 'secret',
}
const KEYS = Object.keys(ENV)

function setEnv(overrides = {}) {
  for (const k of KEYS) delete process.env[k]
  Object.assign(process.env, { ...ENV, ...overrides })
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k]
  resetTokenCache()
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const TOKEN = { access_token: 'tok-1', expires_in: 3600, refresh_token: 'r' }
const INVOICE = {
  id: 'inv-1', qr_code: 'QR-TEXT', qr_image: 'BASE64',
  urls: [{ name: 'Khan', link: 'khan://pay' }],
}

test('config is all-or-nothing and names what is missing', () => {
  setEnv()
  assert.equal(isConfigured(), true)
  assert.equal(qpayConfig().terminalId, 'term-1')

  setEnv({ QPAY_PASSWORD: undefined })
  assert.equal(isConfigured(), false)
  // Partial config must throw, not quietly disable. A required var that is
  // simply absent turned QPay off for weeks on a previous integration.
  assert.throws(() => qpayConfig(), (e) => e instanceof QPayError
    && e.code === 'PARTIAL_CONFIG' && e.message.includes('QPAY_PASSWORD'))

  for (const k of KEYS) delete process.env[k]
  assert.equal(isConfigured(), false)
  assert.throws(() => qpayConfig(), (e) => e.code === 'NOT_CONFIGURED')
})

test('auth sends terminal_id in the body as well as Basic auth', async () => {
  setEnv()
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return ok(url.endsWith('/v2/auth/token') ? TOKEN : INVOICE)
  }

  await createInvoice({
    merchantId: 'merch-1', amountMnt: 235400, description: 'HTR-000001',
    callbackUrl: 'https://hotaru.mn/api/payments/qpay/callback?order=o1&t=sig',
    customerName: 'hotaru',
    bankAccount: { bankCode: '150000', accountNumber: '2015', accountName: 'HOTARU LLC' },
  }, { fetchImpl })

  const auth = calls[0]
  assert.equal(auth.url, 'https://quickqr.example/v2/auth/token')
  assert.equal(auth.init.headers.authorization, `Basic ${Buffer.from('user:pass').toString('base64')}`)
  assert.deepEqual(JSON.parse(auth.init.body), { terminal_id: 'term-1' })
})

test('invoice body carries whole-tugrik amount and bank_accounts', async () => {
  setEnv()
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, init })
    return ok(url.endsWith('/v2/auth/token') ? TOKEN : INVOICE)
  }

  const out = await createInvoice({
    merchantId: 'merch-1', amountMnt: 235400, description: 'HTR-000001',
    callbackUrl: 'https://hotaru.mn/cb', customerName: 'hotaru',
    bankAccount: { bankCode: '150000', accountNumber: '2015', accountName: 'HOTARU LLC' },
  }, { fetchImpl })

  const body = JSON.parse(calls[1].init.body)
  assert.equal(calls[1].init.headers.authorization, 'Bearer tok-1')
  assert.equal(body.amount, 235400)          // whole tugrik, never scaled
  assert.equal(body.currency, 'MNT')
  assert.equal(body.merchant_id, 'merch-1')
  assert.equal(body.mcc_code, '')            // the terminal fills it
  assert.deepEqual(body.bank_accounts, [{
    account_bank_code: '150000', account_number: '2015',
    account_name: 'HOTARU LLC', is_default: true,
  }])
  assert.equal(out.invoiceId, 'inv-1')
  assert.equal(out.qrImage, 'BASE64')
  assert.deepEqual(out.urls, INVOICE.urls)
})

test('the token is cached across calls and refreshed when it expires', async () => {
  setEnv()
  let tokens = 0
  const fetchImpl = async (url) => {
    if (url.endsWith('/v2/auth/token')) { tokens += 1; return ok({ ...TOKEN, expires_in: 3600 }) }
    return ok(INVOICE)
  }
  const args = {
    merchantId: 'm', amountMnt: 1000, description: 'd', callbackUrl: 'c', customerName: 'n',
    bankAccount: { bankCode: '1', accountNumber: '2', accountName: '3' },
  }

  await createInvoice(args, { fetchImpl })
  await createInvoice(args, { fetchImpl })
  assert.equal(tokens, 1, 'second call reuses the cached token')

  resetTokenCache()
  await createInvoice(args, { fetchImpl })
  assert.equal(tokens, 2, 'an expired cache fetches a fresh token')
})

test('checkPayment posts invoice_id and normalises the status', async () => {
  setEnv()
  let seen
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    seen = { url, body: JSON.parse(init.body) }
    return ok({ invoice_status: 'paid' })
  }

  const res = await checkPayment('inv-1', { fetchImpl })
  assert.equal(seen.url, 'https://quickqr.example/v2/payment/check')
  assert.deepEqual(seen.body, { invoice_id: 'inv-1' })
  assert.equal(res.status, 'PAID')
})

test('a structured error body is rendered readably, not [object Object]', async () => {
  setEnv()
  // QPay answers some failures with an object in `error` rather than a string.
  // Interpolating that straight into a message loses the only diagnostic there
  // is, and the caller is left with "[object Object]".
  const fetchImpl = async (url) => url.endsWith('/v2/auth/token')
    ? ok(TOKEN)
    : ({ ok: false, status: 400, json: async () => ({ error: { code: 'MERCHANT_EXISTS', detail: 'duplicate' } }) })

  await assert.rejects(
    () => createInvoice({
      merchantId: 'm', amountMnt: 1, description: 'd', callbackUrl: 'c', customerName: 'n',
      bankAccount: { bankCode: '1', accountNumber: '2', accountName: '3' },
    }, { fetchImpl }),
    (e) => {
      assert.equal(e.message.includes('[object Object]'), false, 'must not stringify to [object Object]')
      assert.match(e.message, /MERCHANT_EXISTS/)
      assert.equal(e.payload.error.detail, 'duplicate', 'the whole body is kept for diagnosis')
      return true
    },
  )
})

test('an API error is raised with its status, not swallowed', async () => {
  setEnv()
  const fetchImpl = async (url) => url.endsWith('/v2/auth/token')
    ? ok(TOKEN)
    : ({ ok: false, status: 422, json: async () => ({ message: 'bad merchant' }) })

  await assert.rejects(
    () => createInvoice({
      merchantId: 'm', amountMnt: 1, description: 'd', callbackUrl: 'c', customerName: 'n',
      bankAccount: { bankCode: '1', accountNumber: '2', accountName: '3' },
    }, { fetchImpl }),
    (e) => e instanceof QPayError && e.status === 422 && e.message.includes('bad merchant'),
  )
})
