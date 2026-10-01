import { QPayError, describe, qpayConfig } from './config.ts'
import { field, readJson, type FetchLike } from '../http.ts'

const TOKEN_REFRESH_MARGIN_MS = 30_000

export interface BankAccount {
  bankCode: string
  accountNumber: string
  accountName: string
}

export interface BankAppUrl {
  name?: string
  description?: string
  logo?: string
  link: string
}

export interface InvoiceInput {
  merchantId: string
  amountMnt: number
  description: string
  callbackUrl: string
  customerName: string
  bankAccount: BankAccount
}

export interface InvoiceResponse {
  id: string
  qr_code?: string | null
  qr_image?: string | null
  urls?: BankAppUrl[] | null
}

export interface Invoice {
  invoiceId: string
  qrText: string | null
  qrImage: string | null
  urls: BankAppUrl[]
  raw: InvoiceResponse
}

export interface PaymentCheckResponse {
  invoice_status?: string | null
  paid_amount?: number | string | null
  amount?: number | string | null
  [key: string]: unknown
}

export interface PaymentCheck {
  status: string
  raw: PaymentCheckResponse | null
}

export interface PersonMerchantInput {
  registerNumber: string
  firstName: string
  lastName: string
  businessName: string
  mccCode?: string
  city: string
  district: string
  address: string
  phone: string
  email: string
  bankAccount: BankAccount
}

export type PersonMerchantUpdate = Partial<
  Omit<PersonMerchantInput, 'registerNumber' | 'firstName' | 'lastName'>
>

export interface QPayMerchant {
  id: string
  type?: string
  name?: string
  register_number?: string
  [key: string]: unknown
}

export interface QPayLocation {
  code: string
  name?: string
}

interface CallOptions {
  fetchImpl?: FetchLike
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  token?: string
  fetchImpl?: FetchLike
}

let cached: { token: string; expiresAt: number } | null = null

export function resetTokenCache(): void {
  cached = null
}

async function request<T>(path: string, { method = 'POST', body, token, fetchImpl = fetch }: RequestOptions): Promise<T> {
  const { baseUrl } = qpayConfig()
  const headers: Record<string, string> = { accept: 'application/json', 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await readJson(res)

  if (!res.ok) {
    const detail = field(payload, 'message') ?? field(payload, 'error') ?? payload ?? res.status
    throw new QPayError(`QPay ${path} failed (${res.status}): ${describe(detail)}`,
      { status: res.status, code: 'API_ERROR', payload })
  }
  return payload as T
}

async function accessToken(fetchImpl: FetchLike): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) return cached.token

  const { baseUrl, username, password, terminalId } = qpayConfig()
  const basic = Buffer.from(`${username}:${password}`).toString('base64')

  const res = await fetchImpl(`${baseUrl}/v2/auth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${basic}`,
    },
    body: JSON.stringify({ terminal_id: terminalId }),
  })

  const payload = await readJson(res)
  const token = field(payload, 'access_token')
  if (!res.ok || !token) {
    throw new QPayError(`QPay auth failed (${res.status}): ${describe(field(payload, 'message') ?? payload ?? res.status)}`,
      { status: res.status, code: 'AUTH_FAILED', payload })
  }

  cached = {
    token: String(token),
    expiresAt: Date.now() + (Number(field(payload, 'expires_in')) || 0) * 1000,
  }
  return cached.token
}

const bankAccountBody = (account: BankAccount) => ({
  account_bank_code: account.bankCode,
  account_number: account.accountNumber,
  account_name: account.accountName,
  is_default: true,
})

const INVOICE_MCC_FROM_TERMINAL = ''

export async function createInvoice(
  { merchantId, amountMnt, description, callbackUrl, customerName, bankAccount }: InvoiceInput,
  { fetchImpl = fetch }: CallOptions = {},
): Promise<Invoice> {
  const token = await accessToken(fetchImpl)
  const payload = await request<InvoiceResponse>('/v2/invoice', {
    token,
    fetchImpl,
    body: {
      merchant_id: merchantId,
      amount: amountMnt,
      currency: 'MNT',
      customer_name: customerName,
      callback_url: callbackUrl,
      description,
      mcc_code: INVOICE_MCC_FROM_TERMINAL,
      bank_accounts: [bankAccountBody(bankAccount)],
    },
  })

  return {
    invoiceId: payload.id,
    qrText: payload.qr_code ?? null,
    qrImage: payload.qr_image ?? null,
    urls: payload.urls ?? [],
    raw: payload,
  }
}

export async function checkPayment(invoiceId: string, { fetchImpl = fetch }: CallOptions = {}): Promise<PaymentCheck> {
  const token = await accessToken(fetchImpl)
  const payload = await request<PaymentCheckResponse | null>('/v2/payment/check', {
    token, fetchImpl, body: { invoice_id: invoiceId },
  })
  return {
    status: String(payload?.invoice_status ?? '').toUpperCase(),
    raw: payload,
  }
}

export async function createPersonMerchant(
  input: PersonMerchantInput,
  { fetchImpl = fetch }: CallOptions = {},
): Promise<{ merchantId: string; raw: QPayMerchant }> {
  const token = await accessToken(fetchImpl)
  const payload = await request<QPayMerchant>('/v2/merchant/person', {
    token,
    fetchImpl,
    body: {
      register_number: input.registerNumber,
      first_name: input.firstName,
      last_name: input.lastName,
      business_name: input.businessName,
      ...(input.mccCode ? { mcc_code: input.mccCode } : {}),
      city: input.city,
      district: input.district,
      address: input.address,
      phone: input.phone,
      email: input.email,
      bank_account: bankAccountBody(input.bankAccount),
    },
  })
  return { merchantId: payload.id, raw: payload }
}

export async function updatePersonMerchant(
  merchantId: string,
  input: PersonMerchantUpdate,
  { fetchImpl = fetch }: CallOptions = {},
): Promise<{ merchantId: string; raw: QPayMerchant | null }> {
  const token = await accessToken(fetchImpl)
  const payload = await request<QPayMerchant | null>(`/v2/merchant/person/${merchantId}`, {
    method: 'PUT',
    token,
    fetchImpl,
    body: {
      ...(input.businessName ? { name: input.businessName } : {}),
      ...(input.mccCode ? { mcc_code: input.mccCode } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.district ? { district: input.district } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.bankAccount ? { bank_account: bankAccountBody(input.bankAccount) } : {}),
    },
  })
  return { merchantId: payload?.id ?? merchantId, raw: payload }
}

export async function getMerchant(merchantId: string, { fetchImpl = fetch }: CallOptions = {}): Promise<QPayMerchant> {
  const token = await accessToken(fetchImpl)
  return request<QPayMerchant>(`/v2/merchant/${merchantId}`, { method: 'GET', token, fetchImpl })
}

export async function listMerchants(
  { pageNumber = 1, pageLimit = 100 }: { pageNumber?: number; pageLimit?: number } = {},
  { fetchImpl = fetch }: CallOptions = {},
): Promise<{ count: number; rows: QPayMerchant[] }> {
  const token = await accessToken(fetchImpl)
  const payload = await request<{ count?: number; rows?: QPayMerchant[] } | null>('/v2/merchant/list', {
    token, fetchImpl, body: { page_number: pageNumber, page_limit: pageLimit },
  })
  return { count: payload?.count ?? 0, rows: payload?.rows ?? [] }
}

type LocationPayload = QPayLocation[] | { rows?: QPayLocation[] } | null

const locationRows = (payload: LocationPayload): QPayLocation[] =>
  Array.isArray(payload) ? payload : (payload?.rows ?? [])

export async function getCities({ fetchImpl = fetch }: CallOptions = {}): Promise<QPayLocation[]> {
  const token = await accessToken(fetchImpl)
  return locationRows(await request<LocationPayload>('/v2/aimaghot', { method: 'GET', token, fetchImpl }))
}

export async function getDistricts(cityCode: string, { fetchImpl = fetch }: CallOptions = {}): Promise<QPayLocation[]> {
  const token = await accessToken(fetchImpl)
  return locationRows(await request<LocationPayload>(`/v2/sumduureg/${cityCode}`, { method: 'GET', token, fetchImpl }))
}
