import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCompanyMerchant, listMerchants, resetTokenCache } from '../../lib/qpay/client.js'

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
  registerNumber: '1234567', name: 'HOTARU LLC',
  ownerRegisterNo: 'УБ99887766', ownerFirstName: 'Бат', ownerLastName: 'Дорж',
  city: 'Улаанбаатар', district: 'Сүхбаатар', address: '1-р хороо',
  phone: '99001122', email: 'owner@hotaru.mn',
  bankAccount: { bankCode: '150000', accountNumber: '2015', accountName: 'HOTARU LLC' },
}

test('the register field is spelled register_number', async () => {
  setEnv()
  let body
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = JSON.parse(init.body)
    return ok({ id: 'merch-9', register_number: '1234567' })
  }

  const out = await createCompanyMerchant(INPUT, { fetchImpl })

  // payment-sdks/qpayquick spells this register_nubmer. That is a typo in that
  // SDK; qpay-go and instasell both send register_number and both work.
  assert.equal(body.register_number, '1234567')
  assert.equal('register_nubmer' in body, false)
  assert.equal(body.owner_register_no, 'УБ99887766')
  assert.equal(body.mcc_code, '')
  assert.deepEqual(body.bank_account, {
    account_bank_code: '150000', account_number: '2015',
    account_name: 'HOTARU LLC', is_default: true,
  })
  assert.equal(out.merchantId, 'merch-9')
})

test('listMerchants pages with 1-based page_number', async () => {
  setEnv()
  let body
  const fetchImpl = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = JSON.parse(init.body)
    return ok({ count: 1, rows: [{ id: 'merch-9', register_number: '1234567' }] })
  }

  const out = await listMerchants({ pageNumber: 1, pageLimit: 100 }, { fetchImpl })
  assert.deepEqual(body, { page_number: 1, page_limit: 100 })
  assert.equal(out.rows[0].register_number, '1234567')
})
