/**
 * QPay QuickQR client. SERVER ONLY.
 *
 * QuickQR is not QPay merchant v2 and their credentials are not
 * interchangeable: QuickQR authenticates a terminal (terminal_id in the auth
 * BODY as well as Basic auth) and carries the destination bank account per
 * invoice in bank_accounts[]. There is no invoice_code and no
 * sender_invoice_no, so nothing of ours round-trips — the callback URL is the
 * only link back to an order.
 *
 * This module knows nothing about orders. It takes values and returns values.
 */

import { QPayError, describe, qpayConfig } from './config.js'

let cached = null   // { token, expiresAt }

/** Test seam, and the way to force a fresh token after a credential change. */
export function resetTokenCache() {
  cached = null
}

async function request(path, { method = 'POST', body, token, fetchImpl = fetch }) {
  const { baseUrl } = qpayConfig()
  const headers = { accept: 'application/json', 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let payload = null
  try { payload = await res.json() } catch { payload = null }

  if (!res.ok) {
    const detail = payload?.message ?? payload?.error ?? payload ?? res.status
    throw new QPayError(`QPay ${path} failed (${res.status}): ${describe(detail)}`,
      { status: res.status, code: 'API_ERROR', payload })
  }
  return payload
}

/**
 * Bearer token, cached until it expires.
 *
 * Refreshed 30s early so a token cannot expire between the check and the call
 * it is used for.
 */
async function accessToken(fetchImpl) {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

  const { baseUrl, username, password, terminalId } = qpayConfig()
  const basic = Buffer.from(`${username}:${password}`).toString('base64')

  const res = await fetchImpl(`${baseUrl}/v2/auth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      // QuickQR wants the terminal in both places. Basic auth alone is rejected.
      authorization: `Basic ${basic}`,
    },
    body: JSON.stringify({ terminal_id: terminalId }),
  })

  let payload = null
  try { payload = await res.json() } catch { payload = null }
  if (!res.ok || !payload?.access_token) {
    throw new QPayError(`QPay auth failed (${res.status}): ${describe(payload?.message ?? payload ?? res.status)}`,
      { status: res.status, code: 'AUTH_FAILED', payload })
  }

  cached = {
    token: payload.access_token,
    expiresAt: Date.now() + (Number(payload.expires_in) || 0) * 1000,
  }
  return cached.token
}

/**
 * Create an invoice.
 *
 * `amountMnt` is whole tugrik and is sent unchanged — MNT has no circulating
 * minor unit, so scaling it would inflate every price a hundredfold.
 */
export async function createInvoice(
  { merchantId, amountMnt, description, callbackUrl, customerName, bankAccount },
  { fetchImpl = fetch } = {},
) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/invoice', {
    token,
    fetchImpl,
    body: {
      merchant_id: merchantId,
      amount: amountMnt,
      currency: 'MNT',
      customer_name: customerName,
      callback_url: callbackUrl,
      description,
      // Sent empty on purpose: the terminal fills it (7372 on this terminal).
      mcc_code: '',
      bank_accounts: [{
        account_bank_code: bankAccount.bankCode,
        account_number: bankAccount.accountNumber,
        account_name: bankAccount.accountName,
        is_default: true,
      }],
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

/**
 * Ask QPay whether an invoice is paid.
 *
 * Answers OPEN or PAID — not a settled total, so there is no partial payment to
 * reconcile. The amount must be checked against what the invoice was created
 * for. Do not call this on a schedule; the QPay docs forbid polling.
 */
export async function checkPayment(invoiceId, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/payment/check', {
    token, fetchImpl, body: { invoice_id: invoiceId },
  })
  return {
    status: String(payload?.invoice_status ?? '').toUpperCase(),
    raw: payload,
  }
}

/**
 * Register an individual as a sub-merchant under this terminal.
 *
 * This is what makes payments land in hotaru's own account rather than the
 * terminal holder's: the merchant carries its own bank_account, and invoices
 * created against its merchant_id credit that account.
 *
 * The person and company endpoints are not interchangeable. A person has a
 * personal register_number and first/last name where a company has a company
 * register number plus owner_*, and the trading name lives in business_name
 * rather than name. QPay required fields: register_number, first_name,
 * last_name, bank_account.
 *
 * mcc_code is required here when present at all: unlike an invoice, where an
 * empty string tells QPay to take the code from the terminal, merchant
 * creation answers {"mcc_code":{"type":"INVALID"}} to an empty string. So it is
 * omitted entirely when we have none.
 */
export async function createPersonMerchant(input, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/merchant/person', {
    token,
    fetchImpl,
    body: {
      // register_number, not register_nubmer. The qpayquick SDK misspells it.
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
      bank_account: {
        account_bank_code: input.bankAccount.bankCode,
        account_number: input.bankAccount.accountNumber,
        account_name: input.bankAccount.accountName,
        is_default: true,
      },
    },
  })
  return { merchantId: payload.id, raw: payload }
}

/**
 * Patch an existing individual merchant — the way a wrong bank account is
 * corrected.
 *
 * Update is namespaced by merchant type exactly as create is:
 * PUT /v2/merchant/person/{id}. There is no PUT /v2/merchant/{id} — that path
 * is GET and DELETE only and answers an Express 404 ("Cannot PUT ...") with an
 * HTML body rather than a QPay error object.
 *
 * register_number, merchant type and the person's names are fixed at
 * registration and are not sent here; changing those does mean de-registering
 * and registering again. A bank account is not one of them.
 */
export async function updatePersonMerchant(merchantId, input, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request(`/v2/merchant/person/${merchantId}`, {
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
      ...(input.bankAccount ? {
        bank_account: {
          account_bank_code: input.bankAccount.bankCode,
          account_number: input.bankAccount.accountNumber,
          account_name: input.bankAccount.accountName,
          is_default: true,
        },
      } : {}),
    },
  })
  return { merchantId: payload?.id ?? merchantId, raw: payload }
}

/**
 * One merchant by id: type, names, mcc_code, city, district, address, phone,
 * email.
 *
 * NOT the bank account. bank_account is write-only on QuickQR — neither
 * /v2/merchant/list nor this endpoint returns it, verified against the live
 * host on 2026-09-07. So a merchant's payout account cannot be audited, only
 * overwritten: to be sure what it holds, PUT the account you want.
 *
 * GET is NOT namespaced by merchant type the way create and update are:
 * /v2/merchant/{id} serves both person and company.
 */
export async function getMerchant(merchantId, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  return request(`/v2/merchant/${merchantId}`, { method: 'GET', token, fetchImpl })
}

/** Paginated merchant list. QPay v2 wants 1-based page_number. */
export async function listMerchants({ pageNumber = 1, pageLimit = 100 } = {}, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/merchant/list', {
    token, fetchImpl, body: { page_number: pageNumber, page_limit: pageLimit },
  })
  return { count: payload?.count ?? 0, rows: payload?.rows ?? [] }
}

/** QPay cities (aimags), as { code, name }. */
export async function getCities({ fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/aimaghot', { method: 'GET', token, fetchImpl })
  return Array.isArray(payload) ? payload : (payload?.rows ?? [])
}

/** Districts (sums) for a city code, as { code, name }. */
export async function getDistricts(cityCode, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request(`/v2/sumduureg/${cityCode}`, { method: 'GET', token, fetchImpl })
  return Array.isArray(payload) ? payload : (payload?.rows ?? [])
}
