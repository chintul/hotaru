#!/usr/bin/env node
/**
 * One-time: register hotaru as a QuickQR sub-merchant (individual, not company).
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

import { createPersonMerchant, getCities, getDistricts, listMerchants } from '../lib/qpay/client.js'

// QPay requires register_number, first_name, last_name and bank_account for a
// person. The rest is asked for because a merchant record with no address or
// contact is a support call waiting to happen.
const REQUIRED = [
  'HOTARU_REGISTER_NUMBER', 'HOTARU_FIRST_NAME', 'HOTARU_LAST_NAME',
  'HOTARU_BUSINESS_NAME',
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
  // The owner's personal register number, not a company one.
  registerNumber: process.env.HOTARU_REGISTER_NUMBER,
  firstName: process.env.HOTARU_FIRST_NAME,
  lastName: process.env.HOTARU_LAST_NAME,
  businessName: process.env.HOTARU_BUSINESS_NAME,
  // Merchant category. 5699 = "Бусад эдлэл хэрэглэл, гоёл чимэглэлийн дэлгүүр",
  // the closest QPay category for bags, accessories, cups and caps.
  mccCode: process.env.HOTARU_MCC_CODE || '5699',
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

/**
 * city and district are QPay location CODES, not names — registration answers
 * "Хот код олдсонгүй" to a name. Accept either: anything non-numeric is looked
 * up against QPay's own tables so nobody has to memorise the code list.
 */
async function resolveLocations(city, district) {
  if (/^\d+$/.test(city) && /^\d+$/.test(district)) return { city, district }

  const cities = await getCities()
  const cityRow = /^\d+$/.test(city)
    ? cities.find((c) => c.code === city)
    : cities.find((c) => c.name?.toLowerCase().startsWith(city.toLowerCase()))
  if (!cityRow) {
    console.error(`city not found: ${city}. Options: ${cities.map((c) => `${c.code} ${c.name}`).join(', ')}`)
    process.exit(1)
  }

  const districts = await getDistricts(cityRow.code)
  const districtRow = /^\d+$/.test(district)
    ? districts.find((d) => d.code === district)
    : districts.find((d) => d.name?.toLowerCase().startsWith(district.toLowerCase()))
  if (!districtRow) {
    console.error(`district not found: ${district}. Options: ${districts.map((d) => `${d.code} ${d.name}`).join(', ')}`)
    process.exit(1)
  }

  console.log(`city ${cityRow.code} (${cityRow.name}), district ${districtRow.code} (${districtRow.name})`)
  return { city: cityRow.code, district: districtRow.code }
}

const located = await resolveLocations(input.city, input.district)
input.city = located.city
input.district = located.district

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
  const { merchantId } = await createPersonMerchant(input)
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
