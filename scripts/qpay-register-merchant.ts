#!/usr/bin/env node

import {
  createPersonMerchant,
  getCities,
  getDistricts,
  listMerchants,
  updatePersonMerchant,
  type PersonMerchantInput,
  type QPayLocation,
  type QPayMerchant,
} from '../lib/qpay/client.ts'

const DEFAULT_MCC_CODE = '5699'
const MERCHANT_PAGE_LIMIT = 100
const MAX_MERCHANT_PAGES = 20

const updateArg = process.argv.find((a) => a === '--update' || a.startsWith('--update='))
const UPDATING = Boolean(updateArg)
const GIVEN_MERCHANT_ID = updateArg?.includes('=') ? updateArg.split('=')[1] : null

const REQUIRED = [
  'HOTARU_REGISTER_NUMBER', 'HOTARU_FIRST_NAME', 'HOTARU_LAST_NAME',
  'HOTARU_BUSINESS_NAME',
  'HOTARU_CITY', 'HOTARU_DISTRICT', 'HOTARU_ADDRESS',
  'HOTARU_PHONE', 'HOTARU_EMAIL',
  'HOTARU_BANK_CODE', 'HOTARU_ACCOUNT_NUMBER', 'HOTARU_ACCOUNT_NAME',
] as const

const env = (key: (typeof REQUIRED)[number]): string => process.env[key] ?? ''

const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`missing: ${missing.join(', ')}`)
  process.exit(1)
}

const input: PersonMerchantInput = {
  registerNumber: env('HOTARU_REGISTER_NUMBER'),
  firstName: env('HOTARU_FIRST_NAME'),
  lastName: env('HOTARU_LAST_NAME'),
  businessName: env('HOTARU_BUSINESS_NAME'),
  mccCode: process.env.HOTARU_MCC_CODE || DEFAULT_MCC_CODE,
  city: env('HOTARU_CITY'),
  district: env('HOTARU_DISTRICT'),
  address: env('HOTARU_ADDRESS'),
  phone: env('HOTARU_PHONE'),
  email: env('HOTARU_EMAIL'),
  bankAccount: {
    bankCode: env('HOTARU_BANK_CODE'),
    accountNumber: env('HOTARU_ACCOUNT_NUMBER'),
    accountName: env('HOTARU_ACCOUNT_NAME'),
  },
}

const isLocationCode = (value: string): boolean => /^\d+$/.test(value)

function findLocation(rows: QPayLocation[], query: string): QPayLocation | undefined {
  return isLocationCode(query)
    ? rows.find((r) => r.code === query)
    : rows.find((r) => r.name?.toLowerCase().startsWith(query.toLowerCase()))
}

const listOptions = (rows: QPayLocation[]): string => rows.map((r) => `${r.code} ${r.name}`).join(', ')

async function resolveLocationCodes(city: string, district: string): Promise<{ city: string; district: string }> {
  if (isLocationCode(city) && isLocationCode(district)) return { city, district }

  const cities = await getCities()
  const cityRow = findLocation(cities, city)
  if (!cityRow) {
    console.error(`city not found: ${city}. Options: ${listOptions(cities)}`)
    process.exit(1)
  }

  const districts = await getDistricts(cityRow.code)
  const districtRow = findLocation(districts, district)
  if (!districtRow) {
    console.error(`district not found: ${district}. Options: ${listOptions(districts)}`)
    process.exit(1)
  }

  console.log(`city ${cityRow.code} (${cityRow.name}), district ${districtRow.code} (${districtRow.name})`)
  return { city: cityRow.code, district: districtRow.code }
}

const located = await resolveLocationCodes(input.city, input.district)
input.city = located.city
input.district = located.district

function report(merchantId: string): void {
  console.log(`\nmerchant_id: ${merchantId}\n`)
  console.log('Put it in /admin → QPay QuickQR, or apply directly:\n')
  console.log(`  update public.store_settings set
    qpay_merchant_id = '${merchantId}',
    bank_code        = '${input.bankAccount.bankCode}',
    qpay_enabled     = true
  where id;\n`)
}

async function findExisting(registerNumber: string): Promise<QPayMerchant | null> {
  for (let page = 1; page <= MAX_MERCHANT_PAGES; page += 1) {
    const { rows } = await listMerchants({ pageNumber: page, pageLimit: MERCHANT_PAGE_LIMIT })
    const hit = rows.find((r) => String(r.register_number) === String(registerNumber))
    if (hit) return hit
    if (rows.length < MERCHANT_PAGE_LIMIT) return null
  }
  return null
}

if (UPDATING) {
  const subMerchantId = GIVEN_MERCHANT_ID || (await findExisting(input.registerNumber))?.id
  if (!subMerchantId) {
    console.error(`no merchant found for register number ${input.registerNumber} — register first`)
    process.exit(1)
  }
  await updatePersonMerchant(subMerchantId, input)
  console.log(`updated merchant ${subMerchantId}: bank ${input.bankAccount.bankCode} / ${input.bankAccount.accountNumber}`)
  console.log('\nThe bank account on an INVOICE comes from store_settings.bank_code, not from')
  console.log('this record — correct it in /admin → QPay QuickQR too, or:\n')
  console.log(`  update public.store_settings set bank_code = '${input.bankAccount.bankCode}';\n`)
  process.exit(0)
}

try {
  const { merchantId } = await createPersonMerchant(input)
  report(merchantId)
} catch (e) {
  console.warn(`create failed (${e instanceof Error ? e.message : String(e)}); looking for an existing registration`)
  const existing = await findExisting(input.registerNumber)
  if (!existing) {
    console.error('no existing merchant with that register number either — giving up')
    process.exit(1)
  }
  report(existing.id)
}
