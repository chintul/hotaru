#!/usr/bin/env node
/**
 * One-time: register hotaru as a QuickQR sub-merchant.
 *
 * Run it once, put the merchant id it prints into /admin → QPay QuickQR, and
 * never run it again. It is idempotent anyway: if QPay says the register number
 * is already a merchant, it finds the existing record instead of failing.
 *
 *   node --env-file=.env.local scripts/qpay-register-merchant.mjs
 *
 * WARNING: there is no sandbox host on these credentials. This writes to the
 * live QPay merchant directory.
 */

import { createCompanyMerchant, listMerchants } from '../lib/qpay/client.js'

const REQUIRED = [
  'HOTARU_REGISTER_NUMBER', 'HOTARU_NAME',
  'HOTARU_OWNER_REGISTER_NO', 'HOTARU_OWNER_FIRST_NAME', 'HOTARU_OWNER_LAST_NAME',
  'HOTARU_CITY', 'HOTARU_DISTRICT', 'HOTARU_ADDRESS',
  'HOTARU_PHONE', 'HOTARU_EMAIL',
  'HOTARU_BANK_CODE', 'HOTARU_ACCOUNT_NUMBER', 'HOTARU_ACCOUNT_NAME',
]

const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`missing: ${missing.join(', ')}`)
  process.exit(1)
}

const input = {
  registerNumber: process.env.HOTARU_REGISTER_NUMBER,
  name: process.env.HOTARU_NAME,
  ownerRegisterNo: process.env.HOTARU_OWNER_REGISTER_NO,
  ownerFirstName: process.env.HOTARU_OWNER_FIRST_NAME,
  ownerLastName: process.env.HOTARU_OWNER_LAST_NAME,
  city: process.env.HOTARU_CITY,
  district: process.env.HOTARU_DISTRICT,
  address: process.env.HOTARU_ADDRESS,
  phone: process.env.HOTARU_PHONE,
  email: process.env.HOTARU_EMAIL,
  bankAccount: {
    bankCode: process.env.HOTARU_BANK_CODE,
    accountNumber: process.env.HOTARU_ACCOUNT_NUMBER,
    accountName: process.env.HOTARU_ACCOUNT_NAME,
  },
}

function report(merchantId) {
  console.log(`\nmerchant_id: ${merchantId}\n`)
  console.log('Put it in /admin → QPay QuickQR, or apply directly:\n')
  console.log(`  update public.store_settings set
    qpay_merchant_id = '${merchantId}',
    bank_code        = '${input.bankAccount.bankCode}',
    qpay_enabled     = true
  where id;\n`)
}

async function findExisting(registerNumber) {
  for (let page = 1; page <= 20; page += 1) {
    const { rows } = await listMerchants({ pageNumber: page, pageLimit: 100 })
    const hit = rows.find((r) => String(r.register_number) === String(registerNumber))
    if (hit) return hit
    if (rows.length < 100) return null
  }
  return null
}

try {
  const { merchantId } = await createCompanyMerchant(input)
  report(merchantId)
} catch (e) {
  // A duplicate is a success that happened earlier, not a failure.
  console.warn(`create failed (${e.message}); looking for an existing registration`)
  const existing = await findExisting(input.registerNumber)
  if (!existing) {
    console.error('no existing merchant with that register number either — giving up')
    process.exit(1)
  }
  report(existing.id)
}
