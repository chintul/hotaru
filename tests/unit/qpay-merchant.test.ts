import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPersonMerchant, getMerchant, listMerchants, resetTokenCache, updatePersonMerchant,
} from '../../lib/qpay/client.ts'
import type { FetchInit, FetchLike, FetchResponse } from '../../lib/http.ts'

function setEnv() {
  Object.assign(process.env, {
    QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_TERMINAL_ID: 't',
    QPAY_MERCHANT_ID: 'm', QPAY_BASE_URL: 'https://quickqr.example',
    QPAY_CALLBACK_SECRET: 's',
  })
  resetTokenCache()
}

const ok = (body: unknown): FetchResponse => ({ ok: true, status: 200, json: async () => body })
const bodyOf = <T = Record<string, unknown>>(init: FetchInit): T => JSON.parse(init.body ?? '') as T

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
  let url: string | undefined
  let body: Record<string, unknown> = {}
  const fetchImpl: FetchLike = async (u, init) => {
    if (u.endsWith('/v2/auth/token')) return ok(TOKEN)
    url = u
    body = bodyOf(init)
    return ok({ id: 'merch-9', register_number: 'УБ99887766' })
  }

  const out = await createPersonMerchant(INPUT, { fetchImpl })

  assert.equal(url, 'https://quickqr.example/v2/merchant/person')
  assert.equal(body.register_number, 'УБ99887766')
  assert.equal('register_nubmer' in body, false)
  assert.equal(body.first_name, 'Бат')
  assert.equal(body.last_name, 'Дорж')
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
  let body: Record<string, unknown> = {}
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = bodyOf(init)
    return ok({ id: 'merch-9' })
  }

  await createPersonMerchant({ ...INPUT, mccCode: '' }, { fetchImpl })
  assert.equal('mcc_code' in body, false)
})

test('listMerchants pages with 1-based page_number', async () => {
  setEnv()
  let body: Record<string, unknown> = {}
  const fetchImpl: FetchLike = async (url, init) => {
    if (url.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = bodyOf(init)
    return ok({ count: 1, rows: [{ id: 'merch-9', register_number: 'УБ99887766' }] })
  }

  const out = await listMerchants({ pageNumber: 1, pageLimit: 100 }, { fetchImpl })
  assert.deepEqual(body, { page_number: 1, page_limit: 100 })
  assert.equal(out.rows[0].register_number, 'УБ99887766')
})

test('a wrong bank account is patched in place, not re-registered', async () => {
  setEnv()
  let url: string | undefined
  let method: string | undefined
  let body: Record<string, unknown> = {}
  const fetchImpl: FetchLike = async (u, init) => {
    if (u.endsWith('/v2/auth/token')) return ok(TOKEN)
    url = u
    method = init.method
    body = bodyOf(init)
    return ok({ id: 'merch-9' })
  }

  const out = await updatePersonMerchant('merch-9', {
    bankAccount: { bankCode: '050000', accountNumber: '2015', accountName: 'ДОРЖ БАТ' },
  }, { fetchImpl })

  assert.equal(url, 'https://quickqr.example/v2/merchant/person/merch-9')
  assert.equal(method, 'PUT')
  assert.deepEqual(body.bank_account, {
    account_bank_code: '050000', account_number: '2015',
    account_name: 'ДОРЖ БАТ', is_default: true,
  })
  assert.equal('register_number' in body, false)
  assert.equal('first_name' in body, false)
  assert.equal(out.merchantId, 'merch-9')
})

test('an update sends only the fields it was given', async () => {
  setEnv()
  let body: Record<string, unknown> = {}
  const fetchImpl: FetchLike = async (u, init) => {
    if (u.endsWith('/v2/auth/token')) return ok(TOKEN)
    body = bodyOf(init)
    return ok({ id: 'merch-9' })
  }

  await updatePersonMerchant('merch-9', { phone: '99001122' }, { fetchImpl })

  assert.deepEqual(body, { phone: '99001122' })
})

test('fetching one merchant is not namespaced by type', async () => {
  setEnv()
  let url: string | undefined
  let method: string | undefined
  const fetchImpl: FetchLike = async (u, init) => {
    if (u.endsWith('/v2/auth/token')) return ok(TOKEN)
    url = u
    method = init.method
    return ok({ id: 'merch-9', type: 'PERSON', name: 'hotaru' })
  }

  const m = await getMerchant('merch-9', { fetchImpl })

  assert.equal(url, 'https://quickqr.example/v2/merchant/merch-9')
  assert.equal(method, 'GET')
  assert.equal(m.id, 'merch-9')
  assert.equal('bank_account' in m, false)
})
