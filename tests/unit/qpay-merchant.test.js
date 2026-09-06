import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPersonMerchant, listMerchants, resetTokenCache } from '../../lib/qpay/client.js'

function setEnv() {
  Object.assign(process.env, {
    QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_TERMINAL_ID: 't',
    QPAY_MERCHANT_ID: 'm', QPAY_BASE_URL: 'https://quickqr.example',
    QPAY_CALLBACK_SECRET: 's',
  })
  resetTokenCache()
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body })
const TOKEN = { access_token: 'tok', expires_in: 3600 }

const INPUT = {
  registerNumber: 'УБ99887766', firstName: 'Бат', lastName: 'Дорж',
  businessName: 'hotaru',
  city: 'Улаанбаатар', district: 'Сүхбаатар', address: '1-р хороо',
  phone: '99001122', email: 'owner@hotaru.mn', mccCode: '5699',
  bankAccount: { bankCode: '150000', accountNumber: '2015', accountName: 'ДОРЖ БАТ' },
}

test('a person merchant posts to /v2/merchant/person with register_number', async () => {
  setEnv()
  let url
  let body
  const fetchImpl = async (u, init) => {
    if (u.endsWith('/v2/auth/token')) return ok(TOKEN)
    url = u
    body = JSON.parse(init.body)
    return ok({ id: 'merch-9', register_number: 'УБ99887766' })
  }

  const out = await createPersonMerchant(INPUT, { fetchImpl })

  assert.equal(url, 'https://quickqr.example/v2/merchant/person')
  // payment-sdks/qpayquick spells this register_nubmer. That is a typo in that
  // SDK; qpay-go and instasell both send register_number and both work.
  assert.equal(body.register_number, 'УБ99887766')
  assert.equal('register_nubmer' in body, false)
  assert.equal(body.first_name, 'Бат')
  assert.equal(body.last_name, 'Дорж')
  // A person merchant has no company name; the storefront name goes here.
  assert.equal(body.business_name, 'hotaru')
  assert.equal('name' in body, false)
  assert.equal('owner_register_no' in body, false)
  assert.equal(body.mcc_code, '5699')
  assert.deepEqual(body.bank_account, {
    account_bank_code: '150000', account_number: '2015',
    account_name: 'ДОРЖ БАТ', is_default: true,
  })
  assert.equal(out.merchantId, 'merch-9')
})

test('mcc_code is omitted rather than sent empty', async () => {
  setEnv()
  let body
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = JSON.parse(init.body)
    return ok({ id: 'merch-9' })
  }

  // Merchant creation rejects an empty mcc_code with
  // {"mcc_code":{"type":"INVALID"}} — unlike invoice creation, where an empty
  // string means "fill it from the terminal".
  await createPersonMerchant({ ...INPUT, mccCode: '' }, { fetchImpl })
  assert.equal('mcc_code' in body, false)
})

test('listMerchants pages with 1-based page_number', async () => {
  setEnv()
  let body
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = JSON.parse(init.body)
    return ok({ count: 1, rows: [{ id: 'merch-9', register_number: 'УБ99887766' }] })
  }

  const out = await listMerchants({ pageNumber: 1, pageLimit: 100 }, { fetchImpl })
  assert.deepEqual(body, { page_number: 1, page_limit: 100 })
  assert.equal(out.rows[0].register_number, 'УБ99887766')
})
