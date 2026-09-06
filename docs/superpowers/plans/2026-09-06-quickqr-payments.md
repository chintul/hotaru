# QuickQR Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a hotaru customer pay an order by scanning a QPay QuickQR code, with the money settling directly into hotaru's own bank account and the order confirming itself.

**Architecture:** A pure QuickQR client (`lib/qpay/*`) that knows nothing about orders, a thin orchestration layer that maps orders to invoices, two API routes, and one migration that splits the existing `confirm_payment` into a shared core plus two authorization wrappers — one for the admin, one for the machine. The callback is treated as a wake-up signal and never as evidence.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, Supabase (Postgres + pg_graphql + Apollo), `node:test` for unit tests, a throwaway Dockerised Postgres for SQL tests, no new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-quickqr-payments-design.md`

## Global Constraints

- **Money is `bigint` whole tugrik.** MNT has no circulating minor unit. Never multiply or divide by 100 anywhere in this feature. `orders.total_mnt` goes to QPay's `amount` field unchanged.
- **`lib/qpay/*` is server-only.** It reads secrets and imports `node:crypto`. It must never be imported from a client component; the browser talks to `/api/payments/qpay/*`.
- **Storefront database roles are SELECT-only** (decision 4). Any write from a route goes through a service-role client or a `SECURITY DEFINER` function, never as the customer.
- **The callback body is never read.** The order id comes from the signed URL; the payment status comes from `POST /v2/payment/check`.
- **No scheduled polling of `/v2/payment/check`.** The QPay docs forbid it. On-demand checks only.
- **Every QPay call is live.** These credentials have no sandbox host. Any invoice created during development is a real invoice.
- **Next 16:** `params` and `cookies()` are async. Follow the existing `await`/`use()` patterns in the files you touch.
- **Field spelling is `register_number`.** `payment-sdks/qpayquick` spells it `register_nubmer`; that is a typo in that SDK.
- **`mcc_code` is sent empty.** The terminal fills it (7372 on this terminal).
- Store settings copy is Mongolian, matching the surrounding UI.

## File Structure

| File | Responsibility |
|---|---|
| `lib/qpay/config.js` | Read + validate `QPAY_*` env. All-or-nothing. |
| `lib/qpay/client.js` | Token cache, `createInvoice`, `checkPayment`, `createPersonMerchant`, `listMerchants`. Injectable `fetchImpl`. |
| `lib/qpay/callback-token.js` | HMAC sign/verify of the order id carried in the callback URL. |
| `lib/supabase/admin.js` | Service-role client, extracted from `lib/verify/store.js` so two features can share it. |
| `lib/qpay/store.js` | The database reads and writes this feature needs, one function each. |
| `lib/qpay/orders.js` | Orchestration: order → invoice, callback → confirmation. Injectable `store` and `fetchImpl`. |
| `app/api/payments/qpay/invoice/route.js` | Thin adapter: auth, ownership, call orchestration. |
| `app/api/payments/qpay/callback/route.js` | Thin adapter: HMAC, call orchestration, always 200. |
| `supabase/migrations/20260906110000_qpay.sql` | Core/wrapper split, `confirm_payment_qpay`, `store_settings` columns, ledger entries. |
| `scripts/qpay-register-merchant.mjs` | One-time sub-merchant registration. |

---

### Task 1: QuickQR config and client

**Files:**
- Create: `lib/qpay/config.js`
- Create: `lib/qpay/client.js`
- Test: `tests/unit/qpay-client.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `QPayError` — `Error` subclass with `.status` and `.code`
  - `isConfigured(): boolean`
  - `qpayConfig(): { baseUrl, username, password, terminalId, merchantId, callbackSecret }` — throws `QPayError` when partially configured
  - `createInvoice({ merchantId, amountMnt, description, callbackUrl, customerName, bankAccount }, { fetchImpl }): Promise<{ invoiceId, qrText, qrImage, urls, raw }>`
  - `checkPayment(invoiceId, { fetchImpl }): Promise<{ status: 'PAID'|'OPEN'|string, raw }>`
  - `resetTokenCache(): void` — test seam

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qpay-client.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm run test:unit -- --test-name-pattern="config is all-or-nothing"`
Or simply: `node --test tests/unit/qpay-client.test.js`
Expected: FAIL — `Cannot find module '.../lib/qpay/config.js'`

- [ ] **Step 3: Write `lib/qpay/config.js`**

```js
/**
 * QPay QuickQR configuration.
 *
 * SERVER ONLY. Reads secrets; never import from a client component.
 *
 * All-or-nothing on purpose. On a previous QPay integration a single missing
 * variable turned the whole payment path into a silent 503 for weeks, because
 * "not configured" and "misconfigured" looked identical. Here they do not:
 * nothing set means off, some set means throw and say which.
 */

export class QPayError extends Error {
  constructor(message, { status, code } = {}) {
    super(message)
    this.name = 'QPayError'
    this.status = status
    this.code = code
  }
}

const KEYS = [
  'QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_TERMINAL_ID',
  'QPAY_MERCHANT_ID', 'QPAY_BASE_URL', 'QPAY_CALLBACK_SECRET',
]

const present = () => KEYS.filter((k) => Boolean(process.env[k]))

/** True only when the whole set is present. A half-set is not "configured". */
export function isConfigured() {
  return present().length === KEYS.length
}

export function qpayConfig() {
  const missing = KEYS.filter((k) => !process.env[k])
  if (missing.length === KEYS.length) {
    throw new QPayError('QPay is not configured', { code: 'NOT_CONFIGURED' })
  }
  if (missing.length) {
    throw new QPayError(`QPay config incomplete, missing: ${missing.join(', ')}`,
      { code: 'PARTIAL_CONFIG' })
  }
  return {
    baseUrl: process.env.QPAY_BASE_URL.replace(/\/+$/, ''),
    username: process.env.QPAY_USERNAME,
    password: process.env.QPAY_PASSWORD,
    terminalId: process.env.QPAY_TERMINAL_ID,
    merchantId: process.env.QPAY_MERCHANT_ID,
    callbackSecret: process.env.QPAY_CALLBACK_SECRET,
  }
}
```

- [ ] **Step 4: Write `lib/qpay/client.js`**

```js
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

import { QPayError, qpayConfig } from './config.js'

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
    const detail = payload?.message ?? payload?.error ?? res.status
    throw new QPayError(`QPay ${path} failed: ${detail}`, { status: res.status, code: 'API_ERROR' })
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

  const { username, password, terminalId } = qpayConfig()
  const basic = Buffer.from(`${username}:${password}`).toString('base64')
  const { baseUrl } = qpayConfig()

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
    throw new QPayError(`QPay auth failed: ${payload?.message ?? res.status}`,
      { status: res.status, code: 'AUTH_FAILED' })
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
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `node --test tests/unit/qpay-client.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/qpay/config.js lib/qpay/client.js tests/unit/qpay-client.test.js
git commit -m "feat: QuickQR client with all-or-nothing config"
```

---

### Task 2: Signed callback URLs

**Files:**
- Create: `lib/qpay/callback-token.js`
- Test: `tests/unit/qpay-callback-token.test.js`

**Interfaces:**
- Consumes: `qpayConfig()` from Task 1.
- Produces:
  - `signOrder(orderId): string` — hex HMAC-SHA256
  - `verifyOrder(orderId, token): boolean` — timing-safe, never throws
  - `callbackUrlFor(orderId, siteUrl): string`

QuickQR has no `sender_invoice_no`, so the order id must travel in the callback URL. That URL is guessable, so it is signed.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qpay-callback-token.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { callbackUrlFor, signOrder, verifyOrder } from '../../lib/qpay/callback-token.js'

const ORDER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'

function withSecret(secret, fn) {
  const prev = process.env.QPAY_CALLBACK_SECRET
  Object.assign(process.env, {
    QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p', QPAY_TERMINAL_ID: 't',
    QPAY_MERCHANT_ID: 'm', QPAY_BASE_URL: 'https://x.example',
    QPAY_CALLBACK_SECRET: secret,
  })
  try { return fn() } finally { process.env.QPAY_CALLBACK_SECRET = prev }
}

test('a signature verifies only for the order it was made for', () => {
  withSecret('secret-a', () => {
    const sig = signOrder(ORDER)
    assert.match(sig, /^[0-9a-f]{64}$/)
    assert.equal(verifyOrder(ORDER, sig), true)
    assert.equal(verifyOrder(OTHER, sig), false)
  })
})

test('a signature made under another secret is rejected', () => {
  const sig = withSecret('secret-a', () => signOrder(ORDER))
  withSecret('secret-b', () => {
    assert.equal(verifyOrder(ORDER, sig), false)
  })
})

test('malformed tokens are rejected without throwing', () => {
  withSecret('secret-a', () => {
    for (const bad of [undefined, null, '', 'nope', 'a'.repeat(63), 'z'.repeat(64)]) {
      assert.equal(verifyOrder(ORDER, bad), false, `rejected: ${String(bad)}`)
    }
  })
})

test('the callback URL carries the order and its signature', () => {
  withSecret('secret-a', () => {
    const url = new URL(callbackUrlFor(ORDER, 'https://hotaru.mn/'))
    assert.equal(url.pathname, '/api/payments/qpay/callback')
    assert.equal(url.searchParams.get('order'), ORDER)
    assert.equal(verifyOrder(ORDER, url.searchParams.get('t')), true)
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/unit/qpay-callback-token.test.js`
Expected: FAIL — `Cannot find module '.../lib/qpay/callback-token.js'`

- [ ] **Step 3: Write `lib/qpay/callback-token.js`**

```js
/**
 * Signed callback URLs. SERVER ONLY.
 *
 * QuickQR echoes nothing of ours back — there is no sender_invoice_no — so the
 * order id has to ride in callback_url. Anyone who sees a QR sees that URL, so
 * the id is signed: a caller cannot swap in another order's id.
 *
 * The signature is not proof of payment. It only proves which order the
 * callback is about; whether money arrived is settled by /v2/payment/check.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { qpayConfig } from './config.js'

export function signOrder(orderId) {
  return createHmac('sha256', qpayConfig().callbackSecret).update(String(orderId)).digest('hex')
}

/** Timing-safe, and false rather than a throw for anything malformed. */
export function verifyOrder(orderId, token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  const expected = Buffer.from(signOrder(orderId), 'hex')
  const given = Buffer.from(token, 'hex')
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}

export function callbackUrlFor(orderId, siteUrl) {
  const base = String(siteUrl).replace(/\/+$/, '')
  return `${base}/api/payments/qpay/callback?order=${orderId}&t=${signOrder(orderId)}`
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/unit/qpay-callback-token.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/qpay/callback-token.js tests/unit/qpay-callback-token.test.js
git commit -m "feat: sign the order id carried in QPay callback URLs"
```

---

### Task 3: Split `confirm_payment`, add the machine path

**Files:**
- Create: `supabase/migrations/20260906110000_qpay.sql`
- Create: `tests/sql/05_qpay.sql`
- Read for context: `supabase/migrations/20260904120200_functions.sql:603-703` (the function being split), `supabase/migrations/20260904120700_privilege_ledger.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SQL).
- Produces, for Tasks 4-6:
  - `public.confirm_payment_qpay(order_id uuid, invoice_id text, amount_mnt bigint, payload jsonb) returns public.orders` — `service_role` only
  - `store_settings.bank_code text`, `store_settings.qpay_merchant_id text`, `store_settings.qpay_enabled boolean not null default false`
  - `public.confirm_payment(uuid, text, bigint)` keeps its exact existing signature and behaviour

- [ ] **Step 1: Write the failing SQL test**

Create `tests/sql/05_qpay.sql`:

```sql
\set ON_ERROR_STOP on
\echo '── qpay: machine confirmation ──'

-- A buyer with an order to pay for. Own uid so this suite cannot collide with
-- 01_checkout.sql, which uses 1111….
insert into auth.users (id, email, is_anonymous)
values ('33333333-3333-3333-3333-333333333333', 'qpay-buyer@example.com', false);
select test.as_user('33333333-3333-3333-3333-333333333333', false);

select public.add_to_cart((select id from public.variants where sku='TEST-BOTTLE-1'), 2);

insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum, is_default)
values ('aaaa0000-0000-0000-0000-000000000005','33333333-3333-3333-3333-333333333333',
        'Бат','99001133','Улаанбаатар','Сүхбаатар', true);

create temp table q_order as
select * from public.place_order(
  'aaaa0000-0000-0000-0000-000000000005',
  (select id from public.delivery_methods where code='ub_courier'));

select test.eq((select provider from public.payments where order_id=(select id from q_order)),
               'bank_transfer', 'place_order still opens a bank_transfer payment row');

-- The customer must not be able to confirm their own payment.
set role authenticated;
select test.raises(
  format($$select public.confirm_payment_qpay(%L, 'inv-1', 172000, null)$$, (select id from q_order)),
  '42501', 'authenticated cannot call the machine confirm path');
reset role;

-- Settings columns exist and default to off.
select test.eq((select qpay_enabled from public.store_settings where id), false,
               'qpay is off until the owner turns it on');
select test.ok((select true from information_schema.columns
                 where table_name='store_settings' and column_name='bank_code'),
               'store_settings has a bank_code for the QuickQR account');

-- The machine path confirms, decrements once, and records provenance.
select test.as_service();
set role service_role;

create temp table q_confirmed as
select * from public.confirm_payment_qpay(
  (select id from q_order), 'inv-1', (select total_mnt from q_order),
  '{"invoice_status":"PAID"}'::jsonb);

select test.eq((select status from q_confirmed)::text, 'paid', 'machine confirmation marks the order paid');
select test.eq((select quantity from public.variants where sku='TEST-BOTTLE-1'), 6,
               'stock decrements by the ordered quantity');
select test.eq((select provider from public.payments where order_id=(select id from q_order)),
               'qpay_quickqr', 'payment records the provider that confirmed it');
select test.eq((select external_reference from public.payments where order_id=(select id from q_order)),
               'inv-1', 'payment records the QuickQR invoice id');
select test.ok((select confirmed_by is null from public.payments where order_id=(select id from q_order)),
               'a machine confirmation has no human confirmer, and does not invent one');
select test.ok((select raw_payload is not null from public.payments where order_id=(select id from q_order)),
               'the checked payload is kept for audit');

-- Idempotent: QPay retries a callback it thinks failed.
select public.confirm_payment_qpay((select id from q_order), 'inv-1', (select total_mnt from q_order), null);
select test.eq((select quantity from public.variants where sku='TEST-BOTTLE-1'), 6,
               'a replayed callback does not decrement twice');

reset role;

-- Oversell still fails loudly on the machine path.
select test.as_user('33333333-3333-3333-3333-333333333333', false);
update public.variants set quantity = 1 where sku='TEST-CHARM-1';
select public.add_to_cart((select id from public.variants where sku='TEST-CHARM-1'), 3);

create temp table q_over as
select * from public.place_order(
  'aaaa0000-0000-0000-0000-000000000005',
  (select id from public.delivery_methods where code='ub_courier'));

select test.as_service();
set role service_role;
select test.eq((select status from public.confirm_payment_qpay(
                  (select id from q_over), 'inv-2', (select total_mnt from q_over), null))::text,
               'oversold', 'a paid order that cannot be filled is flagged, not shipped');
select test.eq((select quantity from public.variants where sku='TEST-CHARM-1'), 1,
               'nothing is decremented when a line cannot be covered');
select test.eq((select status from public.payments where order_id=(select id from q_over))::text,
               'confirmed', 'the money is still recorded as received');
reset role;

-- The admin path is untouched.
select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.ok(has_function_privilege('authenticated', 'public.confirm_payment(uuid, text, bigint)', 'EXECUTE'),
               'admins still reach confirm_payment');
select test.ok(not has_function_privilege('authenticated', 'public._confirm_payment_core(uuid, text, bigint, uuid)', 'EXECUTE'),
               'the shared core is reachable by nobody but its two wrappers');
```

- [ ] **Step 2: Run the DB suite and watch it fail**

Run: `npm run test:db`
Expected: `FAIL 05_qpay.sql` with `function public.confirm_payment_qpay(...) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260906110000_qpay.sql`:

```sql
-- QPay QuickQR.
--
-- Two things happen here.
--
-- 1. confirm_payment is split. Its body — lock every variant, check every line,
--    decrement or flag oversold — is the part that must never be duplicated,
--    because a second copy will drift and one of the two will start shipping
--    phantoms. It moves into _confirm_payment_core, reachable by nobody.
--    confirm_payment keeps its exact signature and its is_admin() gate;
--    confirm_payment_qpay is the machine's door and is granted to service_role
--    alone. Two doors, one room.
--
-- 2. store_settings gains the QuickQR fields the owner controls. Credentials
--    stay in env; what the owner can legitimately change from /admin does not.

-- ---------------------------------------------------------------------------
-- 1. The shared core
-- ---------------------------------------------------------------------------
-- Identical to the previous body of confirm_payment except that the confirmer
-- arrives as a parameter instead of being read from auth.uid(). A machine
-- confirmation passes null, and null is stored as null: unknown provenance must
-- stay unknown rather than be attributed to whoever happens to be nearby.
create or replace function public._confirm_payment_core(
  order_id uuid, external_reference text, amount_mnt bigint, actor uuid
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_item   record;
  v_short  boolean := false;
begin
  select * into v_order from public.orders where id = _confirm_payment_core.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.payment_status = 'confirmed' then
    return v_order;  -- idempotent: never decrement stock twice
  end if;

  -- Lock every variant on the order in id order before checking anything.
  perform 1 from public.variants v
   where v.id in (select oi.variant_id from public.order_items oi
                   where oi.order_id = v_order.id and oi.variant_id is not null)
   order by v.id
   for update;

  for v_item in
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  loop
    if not exists (
      select 1 from public.variants v
      where v.id = v_item.variant_id
        and (v.allow_backorder or v.quantity >= v_item.qty)
    ) then
      v_short := true;
      exit;
    end if;
  end loop;

  if v_short then
    update public.payments
       set status = 'confirmed',
           confirmed_by = _confirm_payment_core.actor,
           confirmed_at = now(),
           external_reference = coalesce(_confirm_payment_core.external_reference, payments.external_reference),
           amount_mnt = coalesce(_confirm_payment_core.amount_mnt, payments.amount_mnt),
           updated_at = now()
     where payments.order_id = v_order.id;

    update public.orders
       set status = 'oversold',
           payment_status = 'confirmed',
           paid_at = now(),
           internal_note =
             coalesce(internal_note || E'\n', '') ||
             '[' || now()::text || '] Payment confirmed but stock insufficient. Refund or restock.'
     where id = v_order.id
    returning * into v_order;
    return v_order;
  end if;

  update public.variants v
     set quantity = v.quantity - agg.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  ) agg
  where v.id = agg.variant_id and not v.allow_backorder;

  update public.payments
     set status = 'confirmed',
         confirmed_by = _confirm_payment_core.actor,
         confirmed_at = now(),
         external_reference = coalesce(_confirm_payment_core.external_reference, payments.external_reference),
         amount_mnt = coalesce(_confirm_payment_core.amount_mnt, payments.amount_mnt),
         updated_at = now()
   where payments.order_id = v_order.id;

  update public.orders
     set status = 'paid', payment_status = 'confirmed', paid_at = now()
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public._confirm_payment_core(uuid, text, bigint, uuid) is
  'Shared body of the payment confirmation paths. Never granted to anyone: call confirm_payment or confirm_payment_qpay.';

-- ---------------------------------------------------------------------------
-- 2. The human door — unchanged signature, unchanged gate
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  order_id uuid, external_reference text default null, amount_mnt bigint default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return public._confirm_payment_core(
    confirm_payment.order_id,
    confirm_payment.external_reference,
    confirm_payment.amount_mnt,
    auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The machine door
-- ---------------------------------------------------------------------------
-- Called only by the QPay callback route, which has already verified the
-- signature on the order id and re-checked the invoice against QPay. This
-- function trusts its caller completely, which is exactly why service_role is
-- the only role that may call it.
create or replace function public.confirm_payment_qpay(
  order_id uuid, invoice_id text, amount_mnt bigint, payload jsonb default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  v_order := public._confirm_payment_core(
    confirm_payment_qpay.order_id,
    confirm_payment_qpay.invoice_id,
    confirm_payment_qpay.amount_mnt,
    null);   -- no human confirmed this

  -- Provenance. provider + a null confirmed_by is what later tells a reader
  -- that the machine confirmed this order, without a third column to go stale.
  update public.payments
     set provider = 'qpay_quickqr',
         raw_payload = coalesce(confirm_payment_qpay.payload, payments.raw_payload),
         updated_at = now()
   where payments.order_id = v_order.id;

  return v_order;
end;
$$;

comment on function public.confirm_payment_qpay(uuid, text, bigint, jsonb) is
  'QPay callback confirmation. service_role only; the route verifies the signature and re-checks the invoice before calling.';

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
revoke all on function public._confirm_payment_core(uuid, text, bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_payment_qpay(uuid, text, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_payment_qpay(uuid, text, bigint, jsonb) to service_role;

-- confirm_payment was re-created above, which resets its grants.
grant execute on function public.confirm_payment(uuid, text, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Owner-editable QuickQR settings
-- ---------------------------------------------------------------------------
-- bank_code is the numeric bank code QuickQR wants in bank_accounts[]; the
-- existing bank_name is display copy and cannot stand in for it.
alter table public.store_settings
  add column if not exists bank_code        text,
  add column if not exists qpay_merchant_id text,
  add column if not exists qpay_enabled     boolean not null default false;

comment on column public.store_settings.bank_code is
  'Numeric bank code for QuickQR bank_accounts[].account_bank_code.';
comment on column public.store_settings.qpay_merchant_id is
  'Merchant id issued by QPay when hotaru was registered as a sub-merchant.';
comment on column public.store_settings.qpay_enabled is
  'Owner kill switch. QPay is also off whenever the QPAY_* env set is absent.';

do $$
begin
  raise notice 'qpay migration applied';
end $$;
```

- [ ] **Step 4: Run the DB suite and watch it pass**

Run: `npm run test:db`
Expected: `PASS 05_qpay.sql`, and `01_checkout.sql` still passing — the admin path must be unaffected.

- [ ] **Step 5: Extend the privilege self-check**

Do **not** edit `20260904120700_privilege_ledger.sql`: it runs before these functions exist, so an assertion about them would fail the migration. Append this block to the bottom of the new `20260906110000_qpay.sql` instead. The ledger's job — one place where a reviewer can read the whole grant surface — is served by the new migration asserting its own grants:

```sql
-- QPay's machine confirmation path. Listed here because the ledger is meant to
-- be the one place a reviewer can read the entire grant surface: service_role
-- reaches confirm_payment_qpay, nothing reaches _confirm_payment_core.
do $$
declare v_bad text;
begin
  if has_function_privilege('authenticated',
       'public.confirm_payment_qpay(uuid, text, bigint, jsonb)', 'EXECUTE') then
    raise exception 'authenticated must not reach confirm_payment_qpay';
  end if;
  if has_function_privilege('authenticated',
       'public._confirm_payment_core(uuid, text, bigint, uuid)', 'EXECUTE') then
    raise exception 'authenticated must not reach _confirm_payment_core';
  end if;
  raise notice 'qpay privilege ledger verified';
end $$;
```


- [ ] **Step 6: Re-run the full DB suite**

Run: `npm run test:db`
Expected: every suite passes, including the new ledger assertions.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260906110000_qpay.sql tests/sql/05_qpay.sql
git commit -m "feat: machine confirmation path for QPay callbacks"
```

---

### Task 4: Order ↔ invoice orchestration

**Files:**
- Create: `lib/supabase/admin.js`
- Modify: `lib/verify/store.js:1-16` (re-point `adminClient` at the shared module, keep the export)
- Create: `lib/qpay/store.js`
- Create: `lib/qpay/orders.js`
- Test: `tests/unit/qpay-orders.test.js`

**Interfaces:**
- Consumes: `createInvoice`, `checkPayment` (Task 1); `callbackUrlFor`, `verifyOrder` (Task 2); `confirm_payment_qpay` (Task 3).
- Produces, for Task 5:
  - `createInvoiceForOrder(orderId, { admin, store, fetchImpl }): Promise<{ invoiceId, qrImage, qrText, urls }>`
  - `confirmOrderFromCallback(orderId, { admin, store, fetchImpl }): Promise<{ outcome: 'confirmed'|'pending'|'mismatch'|'unknown'|'already' }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qpay-orders.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/unit/qpay-orders.test.js`
Expected: FAIL — `Cannot find module '.../lib/qpay/orders.js'`

- [ ] **Step 3: Extract the shared service-role client**

Create `lib/supabase/admin.js`:

```js
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client. Bypasses RLS, so it is only ever constructed inside a
 * route that has already established who is asking and what they may touch.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  })
}
```

Then in `lib/verify/store.js`, replace the `createClient` import and the local `adminClient` definition (lines 1-16) with a re-export, leaving every existing caller working:

```js
import { adminClient } from '@/lib/supabase/admin'

export { adminClient }
```

- [ ] **Step 4: Write `lib/qpay/store.js`**

```js
/**
 * Every database read and write the QPay feature performs, one function each.
 *
 * Kept separate from orders.js so the orchestration can be tested without a
 * database, and so the exact shape of what QPay is allowed to touch is
 * readable in one place.
 */

/** The order, its recorded price, and the settings an invoice needs. */
export async function loadOrderForInvoice(admin, orderId) {
  const { data: order, error } = await admin
    .from('orders')
    .select('id, order_number, total_mnt, payment_status, payments(amount_mnt, external_reference)')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw new Error(`could not load order: ${error.message}`)
  if (!order) return { order: null, settings: null }

  const { data: settings, error: sErr } = await admin
    .from('store_settings')
    .select('qpay_enabled, qpay_merchant_id, bank_code, bank_account_number, bank_account_name')
    .limit(1)
    .maybeSingle()
  if (sErr) throw new Error(`could not load store settings: ${sErr.message}`)

  const payment = order.payments?.[0] ?? null
  return {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      totalMnt: Number(order.total_mnt),
      paymentStatus: order.payment_status,
      paymentAmountMnt: payment ? Number(payment.amount_mnt) : null,
      externalReference: payment?.external_reference ?? null,
    },
    settings: settings && {
      qpayEnabled: settings.qpay_enabled,
      qpayMerchantId: settings.qpay_merchant_id,
      bankCode: settings.bank_code,
      bankAccountNumber: settings.bank_account_number,
      bankAccountName: settings.bank_account_name,
    },
  }
}

/**
 * Record the invoice against the order's existing payment row.
 *
 * amount_mnt is deliberately not written: place_order set it from the order
 * total and it is the price the customer agreed to.
 */
export async function attachInvoice(admin, { orderId, invoiceId, payload }) {
  const { error } = await admin
    .from('payments')
    .update({
      provider: 'qpay_quickqr',
      external_reference: invoiceId,
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
  if (error) throw new Error(`could not attach invoice: ${error.message}`)
}

export async function loadPayment(admin, orderId) {
  const { data, error } = await admin
    .from('payments')
    .select('order_id, amount_mnt, external_reference, status')
    .eq('order_id', orderId)
    .maybeSingle()
  if (error) throw new Error(`could not load payment: ${error.message}`)
  if (!data) return null
  return {
    id: data.order_id,
    paymentAmountMnt: Number(data.amount_mnt),
    externalReference: data.external_reference,
    paymentStatus: data.status,
  }
}

export async function confirmQpay(admin, { orderId, invoiceId, amountMnt, payload }) {
  const { error } = await admin.rpc('confirm_payment_qpay', {
    order_id: orderId, invoice_id: invoiceId, amount_mnt: amountMnt, payload,
  })
  if (error) throw new Error(`could not confirm payment: ${error.message}`)
}

/** A mismatch is the owner's problem to resolve, so it must be visible to them. */
export async function noteMismatch(admin, { orderId, message }) {
  const { data } = await admin.from('orders').select('internal_note').eq('id', orderId).maybeSingle()
  const stamped = `[${new Date().toISOString()}] ${message}`
  const note = data?.internal_note ? `${data.internal_note}\n${stamped}` : stamped
  const { error } = await admin.from('orders').update({ internal_note: note }).eq('id', orderId)
  if (error) throw new Error(`could not record note: ${error.message}`)
}
```

- [ ] **Step 5: Write `lib/qpay/orders.js`**

```js
/**
 * Order ↔ invoice orchestration. SERVER ONLY.
 *
 * The two halves of the payment: turning an order into a QuickQR invoice, and
 * turning a callback into a confirmed order. Neither trusts the caller's word
 * about money — the amount comes from the payment row written at checkout, and
 * the payment status comes from QPay's own answer.
 */

import { QPayError } from './config.js'
import { checkPayment, createInvoice } from './client.js'
import { callbackUrlFor } from './callback-token.js'
import * as realStore from './store.js'

function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) throw new QPayError('NEXT_PUBLIC_SITE_URL is not set', { code: 'NO_SITE_URL' })
  return url
}

export async function createInvoiceForOrder(orderId, { admin, store = realStore, fetchImpl } = {}) {
  const { order, settings } = await store.loadOrderForInvoice(admin, orderId)
  if (!order) throw new QPayError('order not found', { code: 'NO_ORDER', status: 404 })
  if (order.paymentStatus === 'confirmed') {
    throw new QPayError('order is already paid', { code: 'ALREADY_PAID', status: 409 })
  }
  if (!settings?.qpayEnabled) {
    throw new QPayError('QPay is switched off for this store', { code: 'QPAY_DISABLED', status: 503 })
  }
  if (!settings.bankCode || !settings.bankAccountNumber || !settings.bankAccountName) {
    throw new QPayError('store bank account is incomplete', { code: 'NO_BANK_ACCOUNT', status: 503 })
  }

  // The recorded payment amount, not a freshly computed total: the customer
  // agreed to this number at checkout.
  const amountMnt = order.paymentAmountMnt ?? order.totalMnt

  const invoice = await createInvoice({
    merchantId: settings.qpayMerchantId || process.env.QPAY_MERCHANT_ID,
    amountMnt,
    description: order.orderNumber,
    callbackUrl: callbackUrlFor(order.id, siteUrl()),
    customerName: 'hotaru',
    bankAccount: {
      bankCode: settings.bankCode,
      accountNumber: settings.bankAccountNumber,
      accountName: settings.bankAccountName,
    },
  }, { fetchImpl })

  await store.attachInvoice(admin, {
    orderId: order.id, invoiceId: invoice.invoiceId, payload: invoice.raw,
  })

  return {
    invoiceId: invoice.invoiceId,
    qrImage: invoice.qrImage,
    qrText: invoice.qrText,
    urls: invoice.urls,
  }
}

/**
 * Turn a callback into a confirmation, or into nothing.
 *
 * The callback body is never consulted. Whether money arrived is settled by
 * /v2/payment/check, which answers OPEN or PAID and gives no settled total —
 * so the amount is checked against what the invoice was created for.
 */
export async function confirmOrderFromCallback(orderId, { admin, store = realStore, fetchImpl } = {}) {
  const payment = await store.loadPayment(admin, orderId)
  if (!payment || !payment.externalReference) return { outcome: 'unknown' }
  if (payment.paymentStatus === 'confirmed') return { outcome: 'already' }

  const checked = await checkPayment(payment.externalReference, { fetchImpl })
  if (checked.status !== 'PAID') return { outcome: 'pending', status: checked.status }

  const expected = payment.paymentAmountMnt
  const reported = checked.raw?.paid_amount ?? checked.raw?.amount
  if (reported !== undefined && reported !== null && Number(reported) !== expected) {
    await store.noteMismatch(admin, {
      orderId,
      message: `QPay reported ${reported}₮ against an invoice for ${expected}₮. Not confirmed automatically.`,
    })
    return { outcome: 'mismatch' }
  }

  await store.confirmQpay(admin, {
    orderId,
    invoiceId: payment.externalReference,
    amountMnt: expected,
    payload: checked.raw,
  })
  return { outcome: 'confirmed' }
}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `node --test tests/unit/qpay-orders.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 7: Run the whole unit suite so the `adminClient` move is proven safe**

Run: `npm run test:unit`
Expected: PASS, including `verify-mn.test.js`.

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/admin.js lib/verify/store.js lib/qpay/store.js lib/qpay/orders.js tests/unit/qpay-orders.test.js
git commit -m "feat: map hotaru orders onto QuickQR invoices"
```

---

### Task 5: The two API routes

**Files:**
- Create: `app/api/payments/qpay/invoice/route.js`
- Create: `app/api/payments/qpay/callback/route.js`
- Read for the house pattern: `app/api/verify/callback/route.js`

**Interfaces:**
- Consumes: `createInvoiceForOrder`, `confirmOrderFromCallback` (Task 4); `verifyOrder` (Task 2); `adminClient` (Task 4); `supabaseServer` from `lib/supabase/server.js`.
- Produces: `POST /api/payments/qpay/invoice` → `{ invoiceId, qrImage, qrText, urls }`; `GET|POST /api/payments/qpay/callback` → always `200 ok`.

- [ ] **Step 1: Write the invoice route**

Create `app/api/payments/qpay/invoice/route.js`:

```js
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { createInvoiceForOrder } from '@/lib/qpay/orders'
import { isConfigured } from '@/lib/qpay/config'

export const dynamic = 'force-dynamic'

/**
 * Mint a QuickQR invoice for an order the caller owns.
 *
 * Ownership is established with the caller's own session, under RLS. Only then
 * does the service-role client come out, and only to write the invoice id onto
 * a payment row that already exists — storefront roles are SELECT-only.
 */
export async function POST(request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: 'qpay_unavailable' }, { status: 503 })
  }

  let orderId
  try {
    ({ orderId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!orderId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Read as the caller: RLS decides whether this order is theirs to pay for.
  const { data: owned } = await supabase
    .from('orders').select('id').eq('id', orderId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  try {
    const invoice = await createInvoiceForOrder(orderId, { admin: adminClient() })
    return NextResponse.json(invoice)
  } catch (e) {
    // A QPay outage must not look like a broken store: the order stands and the
    // page falls back to the bank-transfer instructions.
    console.error('[qpay] invoice creation failed:', e?.code ?? '', e?.message)
    return NextResponse.json({ error: e?.code ?? 'qpay_error' }, { status: e?.status ?? 502 })
  }
}
```

- [ ] **Step 2: Write the callback route**

Create `app/api/payments/qpay/callback/route.js`:

```js
import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { verifyOrder } from '@/lib/qpay/callback-token'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'

export const dynamic = 'force-dynamic'

/**
 * QPay QuickQR callback.
 *
 * A wake-up signal, never evidence. The body is not read at all: the order id
 * comes from the signed query string, and whether money arrived is settled by
 * POST /v2/payment/check inside confirmOrderFromCallback.
 *
 * Always answers 200. A non-2xx only makes QPay retry a request that will fail
 * the same way, and there is nothing a retry could fix here.
 *
 * Both verbs are handled because QPay's callback method is not pinned by the
 * docs, and a callback that arrives on the wrong verb is a payment that never
 * confirms.
 */
async function handle(request) {
  const url = new URL(request.url)
  const orderId = url.searchParams.get('order')
  const token = url.searchParams.get('t')

  if (!orderId || !verifyOrder(orderId, token)) {
    console.warn('[qpay] callback with a bad or missing signature')
    return new NextResponse('ok', { status: 200 })
  }

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    console.info(`[qpay] callback for ${orderId}: ${outcome}`)
  } catch (e) {
    console.error('[qpay] callback handling failed:', e?.message)
  }

  return new NextResponse('ok', { status: 200 })
}

export const GET = handle
export const POST = handle
```

- [ ] **Step 3: Verify the routes compile and are registered**

Run: `npm run build`
Expected: build succeeds and the route list includes `/api/payments/qpay/invoice` and `/api/payments/qpay/callback`.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add app/api/payments/qpay
git commit -m "feat: QPay invoice and callback routes"
```

---

### Task 6: Storefront QR panel and admin settings

**Files:**
- Modify: `lib/queries.js:279-303` (`ORDER_DETAIL`), `lib/queries.js:408-420` (`ADMIN_SETTINGS`)
- Modify: `app/(shop)/orders/[orderNumber]/page.js:63-113` (payment panel)
- Modify: `app/admin/settings/page.js:9-40` (settings groups)

**Interfaces:**
- Consumes: `POST /api/payments/qpay/invoice` (Task 5); `store_settings.qpay_enabled` (Task 3).
- Produces: no exports other tasks depend on.

- [ ] **Step 1: Add the new settings columns to the queries**

In `lib/queries.js`, `ORDER_DETAIL`'s `storeSettingsCollection` selection becomes:

```js
    storeSettingsCollection(first: 1) {
      edges {
        node {
          bankName bankAccountNumber bankAccountName paymentInstructions paymentDeadlineHours
          qpayEnabled
        }
      }
    }
```

and `ADMIN_SETTINGS`'s node selection becomes:

```js
        node {
          bankName bankAccountNumber bankAccountName bankSwift
          bankCode qpayMerchantId qpayEnabled
          paymentInstructions paymentDeadlineHours
          ownerAlertEmail storeEmail storePhone
          heroImagePath heroHeadline heroSubline heroCtaLabel heroCtaHref
        }
```

- [ ] **Step 2: Add the QPay fields to the admin settings form**

In `app/admin/settings/page.js`, extend the first group and add the toggle. The `fields` entries stay `[name, label]` pairs; a third element marks a checkbox:

```js
  {
    title: 'Дансны мэдээлэл',
    hint: 'Захиалга өгсний дараа худалдан авагчид энэ мэдээлэл харагдана.',
    fields: [
      ['bankName', 'Банк'],
      ['bankAccountNumber', 'Дансны дугаар'],
      ['bankAccountName', 'Данс эзэмшигч'],
      ['bankSwift', 'SWIFT (заавал биш)'],
      ['paymentInstructions', 'Төлбөрийн заавар'],
    ],
  },
  {
    title: 'QPay QuickQR',
    hint: 'QR-аар төлсөн мөнгө шууд энэ данс руу орно. Банкны код нь банкны нэрээс өөр — QPay-д тоон код хэрэгтэй.',
    fields: [
      ['bankCode', 'Банкны код (жишээ нь 150000)'],
      ['qpayMerchantId', 'QPay merchant id'],
      ['qpayEnabled', 'QPay-г идэвхжүүлэх', 'toggle'],
    ],
  },
```

and in the render loop, branch on the third element (find the existing `fields.map` and replace the body):

```jsx
{group.fields.map(([name, label, kind]) => (
  kind === 'toggle' ? (
    <label key={name} className="flex items-center gap-3 py-2">
      <input
        type="checkbox"
        checked={Boolean(form[name])}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.checked }))}
        className="accent-black"
      />
      <span className="text-[13px]">{label}</span>
    </label>
  ) : (
    <Field key={name} label={label}>
      <Input
        value={form[name] ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      />
    </Field>
  )
))}
```

If the existing loop differs, keep its structure and add only the `kind === 'toggle'` branch — do not restructure the page.

- [ ] **Step 3: Add the QR panel to the customer order page**

In `app/(shop)/orders/[orderNumber]/page.js`, add state and a fetch beside the existing hooks:

```js
  const [qpay, setQpay] = useState(null)
  const [qpayError, setQpayError] = useState(false)
```

and, after the `order` and `bank` consts, an effect that mints the invoice once the order is known to be awaiting payment:

```js
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || !bank?.qpayEnabled || qpay || qpayError) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/payments/qpay/invoice', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!cancelled) setQpay(data)
      } catch {
        // QPay being down must not hide the bank details underneath.
        if (!cancelled) setQpayError(true)
      }
    })()
    return () => { cancelled = true }
  }, [order, bank, qpay, qpayError])
```

`useEffect` must be added to the existing `react` import.

Then, inside the `{awaiting && bank && (...)}` section, above the `<dl>` of bank details:

```jsx
{qpay?.qrImage && (
  <div className="mb-6 border-b border-line pb-6">
    <p className="text-[13px] text-ink-soft">
      Банкны аппаараа QR-г уншуулж төлнө үү. Төлбөр орсон даруйд захиалга автоматаар баталгаажна.
    </p>
    {/* eslint-disable-next-line @next/next/no-img-element -- a base64 QR from QPay, not an ImageKit asset */}
    <img
      src={qpay.qrImage.startsWith('data:') ? qpay.qrImage : `data:image/png;base64,${qpay.qrImage}`}
      alt="QPay QR"
      className="mt-4 h-[220px] w-[220px] border border-line bg-paper p-2"
    />
    {qpay.urls?.length > 0 && (
      <div className="mt-4 flex flex-wrap gap-2">
        {qpay.urls.map((u) => (
          <a key={u.link} href={u.link}
            className="label border border-line px-3 py-2 transition-colors hover:border-ink">
            {u.name}
          </a>
        ))}
      </div>
    )}
  </div>
)}
```

The bank-transfer block below it is left exactly as it is. Both ways to pay stay on the page, which is what makes a QPay outage survivable.

- [ ] **Step 4: Poll for confirmation while the page is open**

Add below the invoice effect:

```js
  // The callback confirms server-side; this only keeps the open page honest.
  // It polls our own database, never QPay — their docs forbid polling them.
  useEffect(() => {
    if (!order || order.status !== 'awaiting_payment' || !qpay) return
    const id = setInterval(() => { refetch() }, 5000)
    return () => clearInterval(id)
  }, [order, qpay, refetch])
```

- [ ] **Step 5: Verify by hand**

Run: `npm run dev`, sign in, place an order, open it.
Expected with QPay off (`qpay_enabled = false`): the page looks exactly as it does today, no network call to the invoice route.
Expected with QPay on but env unset: one 503 from the invoice route, bank details still rendered, no crash.

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/queries.js "app/(shop)/orders/[orderNumber]/page.js" app/admin/settings/page.js
git commit -m "feat: show a QuickQR code on the order page"
```

---

### Task 7: One-time sub-merchant registration (individual)

**Files:**
- Modify: `lib/qpay/client.js` (add two functions)
- Create: `scripts/qpay-register-merchant.mjs`
- Test: `tests/unit/qpay-merchant.test.js`
- Modify: `.env.example` (document the new variables)

**Interfaces:**
- Consumes: `qpayConfig`, the token cache, and `request` behaviour from Task 1.
- Produces:
  - `createPersonMerchant(input, { fetchImpl }): Promise<{ merchantId, raw }>` — `POST /v2/merchant/person`; required fields `register_number`, `first_name`, `last_name`, `bank_account`, with the trading name in `business_name`
  - `listMerchants({ pageNumber, pageLimit }, { fetchImpl }): Promise<{ count, rows }>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qpay-merchant.test.js`:

```js
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
  phone: '99001122', email: 'owner@hotaru.mn',
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
  assert.equal(body.mcc_code, '')
  assert.deepEqual(body.bank_account, {
    account_bank_code: '150000', account_number: '2015',
    account_name: 'ДОРЖ БАТ', is_default: true,
  })
  assert.equal(out.merchantId, 'merch-9')
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `node --test tests/unit/qpay-merchant.test.js`
Expected: FAIL — `createPersonMerchant is not a function`.

- [ ] **Step 3: Add the two client functions**

Append to `lib/qpay/client.js`:

```js
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
      mcc_code: '',
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

/** Paginated merchant list. QPay v2 wants 1-based page_number. */
export async function listMerchants({ pageNumber = 1, pageLimit = 100 } = {}, { fetchImpl = fetch } = {}) {
  const token = await accessToken(fetchImpl)
  const payload = await request('/v2/merchant/list', {
    token, fetchImpl, body: { page_number: pageNumber, page_limit: pageLimit },
  })
  return { count: payload?.count ?? 0, rows: payload?.rows ?? [] }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `node --test tests/unit/qpay-merchant.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the registration script**

Create `scripts/qpay-register-merchant.mjs`:

```js
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

import { createPersonMerchant, listMerchants } from '../lib/qpay/client.js'

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
```

- [ ] **Step 6: Document the environment**

Append to `.env.example`:

```bash
# QPay QuickQR. All six or none — a partial set throws rather than silently
# disabling payments. There is no sandbox host for these credentials.
QPAY_BASE_URL=https://quickqr.qpay.mn
QPAY_USERNAME=
QPAY_PASSWORD=
QPAY_TERMINAL_ID=
QPAY_MERCHANT_ID=
# openssl rand -hex 32 — signs the order id carried in the callback URL
QPAY_CALLBACK_SECRET=

# Only for scripts/qpay-register-merchant.mjs, which runs once. Not read at runtime.
# Registered as an individual, so this is the owner's personal register number
# and name; HOTARU_BUSINESS_NAME is the trading name shown on the QR.
HOTARU_REGISTER_NUMBER=
HOTARU_FIRST_NAME=
HOTARU_LAST_NAME=
HOTARU_BUSINESS_NAME=hotaru
HOTARU_CITY=
HOTARU_DISTRICT=
HOTARU_ADDRESS=
HOTARU_PHONE=
HOTARU_EMAIL=
HOTARU_BANK_CODE=
HOTARU_ACCOUNT_NUMBER=
HOTARU_ACCOUNT_NAME=
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: unit tests and database tests all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/qpay/client.js scripts/qpay-register-merchant.mjs tests/unit/qpay-merchant.test.js .env.example
git commit -m "feat: register hotaru as a QuickQR sub-merchant"
```

---

### Task 8: Admin "check now"

**Files:**
- Create: `app/api/payments/qpay/check/route.js`
- Modify: `app/admin/orders/[orderNumber]/page.js` (add the button beside the existing confirm control)
- Modify: `lib/queries.js` (`ADMIN_PENDING` / `ADMIN_ALL_ORDERS` need no change; only the detail page is touched)

**Interfaces:**
- Consumes: `confirmOrderFromCallback` (Task 4), `adminClient` (Task 4), `supabaseServer`.
- Produces: `POST /api/payments/qpay/check` → `{ outcome }`.

The QPay docs forbid polling `/v2/payment/check` on a schedule, so a lost callback needs a human-triggered retry. Without this, a dropped callback can only be resolved by confirming the order by hand, which loses the invoice trail.

- [ ] **Step 1: Write the route**

Create `app/api/payments/qpay/check/route.js`:

```js
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { confirmOrderFromCallback } from '@/lib/qpay/orders'
import { isConfigured } from '@/lib/qpay/config'

export const dynamic = 'force-dynamic'

/**
 * On-demand invoice check, for when a callback never arrived.
 *
 * Admin only, and deliberately manual: QPay's docs forbid polling this endpoint
 * on a schedule, so the retry is a button rather than a cron.
 */
export async function POST(request) {
  if (!isConfigured()) return NextResponse.json({ error: 'qpay_unavailable' }, { status: 503 })

  let orderId
  try {
    ({ orderId } = await request.json())
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (!orderId) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // is_admin() reads the caller's own JWT, so this asks the database rather
  // than trusting anything the client sent.
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  try {
    const { outcome } = await confirmOrderFromCallback(orderId, { admin: adminClient() })
    return NextResponse.json({ outcome })
  } catch (e) {
    console.error('[qpay] manual check failed:', e?.message)
    return NextResponse.json({ error: e?.code ?? 'qpay_error' }, { status: e?.status ?? 502 })
  }
}
```

- [ ] **Step 2: Add the button to the admin order page**

In `app/admin/orders/[orderNumber]/page.js`, beside the existing confirm control (the handler around line 160 that reads `res.data?.confirmPayment?.status === 'oversold'`), add:

```jsx
{order.paymentStatus !== 'confirmed' && (
  <button
    type="button"
    onClick={async () => {
      const res = await fetch('/api/payments/qpay/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const body = await res.json().catch(() => ({}))
      setCheckMessage(
        body.outcome === 'confirmed' ? 'QPay: төлбөр баталгаажлаа'
        : body.outcome === 'pending' ? 'QPay: төлбөр хараахан ороогүй байна'
        : body.outcome === 'mismatch' ? 'QPay: дүн зөрж байна — тэмдэглэл шалгана уу'
        : body.outcome === 'already' ? 'QPay: аль хэдийн баталгаажсан'
        : 'QPay: нэхэмжлэх олдсонгүй',
      )
      refetch()
    }}
    className="label border border-line px-4 py-2 transition-colors hover:border-ink"
  >
    QPay шалгах
  </button>
)}
{checkMessage && <p className="label mt-2 text-ink-faint">{checkMessage}</p>}
```

with `const [checkMessage, setCheckMessage] = useState('')` beside the page's existing state. Match the surrounding button classes if they differ from the ones above — the page's own styling wins.

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`, open an unpaid order in /admin as an admin.
Expected: with QPay env unset, the button returns 503 and the page shows the "нэхэмжлэх олдсонгүй" line without crashing. Signed out or as a non-admin, the route answers 401/403.

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/payments/qpay/check "app/admin/orders/[orderNumber]/page.js"
git commit -m "feat: admin check-now for a QPay invoice whose callback never landed"
```


---

## Go-live checklist (not code)

1. Run `scripts/qpay-register-merchant.mjs` with the owner's real details — it registers an individual, so `HOTARU_REGISTER_NUMBER` is the owner's personal register number and the bank account should be theirs, with `account_name` matching the name on it. Keep the merchant id.
2. Set the six `QPAY_*` variables in the deployment environment. `NEXT_PUBLIC_SITE_URL` must be the public https origin — QPay cannot reach a localhost callback, so local end-to-end testing needs a tunnel.
3. In /admin → QPay QuickQR, fill the bank code and merchant id, then switch QPay on.
4. Place a real order for a small amount, pay it, and confirm the order flips to paid on its own.
5. Ask QPay for settlement timing and commission in writing. Neither is in the API docs, and the owner will ask.
