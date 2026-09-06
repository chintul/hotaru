# QuickQR (QPay) payments for hotaru — design

Date: 2026-09-06
Status: approved, ready for implementation planning

## Problem

hotaru takes money by manual bank transfer. The customer places an order, reads
the store's account details, transfers, and the owner confirms by hand in
/admin. Decision 3 in `docs/decisions.md` planned for this: `payments` carries
`provider` + `external_reference` + `raw_payload` so a real rail drops in with
no schema change.

QPay's QuickQR is that rail. It is the right product specifically because the
destination bank account travels **per invoice** in `bank_accounts[]`, so
payments land in hotaru's own account rather than sitting in a processor's
balance.

## Decisions taken

| # | Decision | Why |
|---|----------|-----|
| 1 | QuickQR, not QPay merchant v2 | The credentials in hand (`terminal_id` + `merchant_id` + `account_number`, host `quickqr.qpay.mn`, no `invoice_code`) name QuickQR. The two APIs are not interchangeable |
| 2 | hotaru registered as a sub-merchant under the existing Codify terminal | `POST /v2/merchant/company` exists for exactly this. hotaru gets its own `merchant_id` and its own `bank_account`; Codify's terminal only routes. Money never passes through a Codify account |
| 3 | Registration is a one-time script, not app runtime code | It runs once in the store's life. An admin form would be more code, more validation, more error surfacing, for a single use |
| 4 | Machine confirmation via a split core + two wrappers | One copy of the oversell logic, two explicit authorization stories. The admin path is not widened |
| 5 | Callback is a wake-up signal, never evidence | Mirrors `app/api/verify/callback/route.js`, already in this repo. The authoritative answer comes from `POST /v2/payment/check` |
| 6 | Bank transfer stays | QPay unreachable must not close the store |

## Non-goals

Refunds (`/v2/payment/cancel`, `/v2/payment/refund`), eBarimt receipts, card
terminals, multiple merchants per deployment, partial payments. The adapter seam
stays open for the first three. Partial payments are not merely deferred — see
"Constraints imposed by the API".

## Constraints imposed by the API

Three properties of QuickQR shape the design and are not negotiable:

1. **Nothing of ours round-trips.** There is no `sender_invoice_no`. The only
   field that comes back to us is `callback_url`, so the order id must be
   carried in that URL.
2. **`/v2/payment/check` answers `invoice_status: OPEN | PAID`**, not a settled
   total. There is no partial payment to compare against, so the amount must be
   verified against what we asked for at invoice creation.
3. **Polling is forbidden by the docs.** `/v2/payment/check` is to be called
   after a callback, not on a schedule.

## Architecture

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/qpay/config.js` | Read and validate env. A partial `QPAY_*` set throws | — |
| `lib/qpay/client.js` | Token cache, `createInvoice`, `checkPayment`, `createCompanyMerchant`, `listMerchants`. Injectable `fetchImpl`. No domain knowledge | config |
| `lib/qpay/callback-token.js` | HMAC sign/verify for the order id in the callback URL | `QPAY_CALLBACK_SECRET` |
| `app/api/payments/qpay/invoice/route.js` | POST `{orderId}`; caller must own the order; creates the invoice and stashes it on `payments` | client, supabase |
| `app/api/payments/qpay/callback/route.js` | Verify HMAC, re-check with QPay, confirm. Always answers 200 | client, service_role |
| `scripts/qpay-register-merchant.mjs` | One-time, idempotent sub-merchant registration | client |
| Order page payment panel | QR image, bank deeplinks, status poll | — |

Each unit is testable alone: the client through `fetchImpl`, the token module
through pure functions, the routes through fixtures, the SQL through pgTAP.

## Flow

1. `place_order` is unchanged. Order is `awaiting_payment`; the `payments` row is
   `unpaid`; `orders.total_mnt` is fixed at this point.
2. The order page requests an invoice. The server verifies the caller owns the
   order, then calls `POST /v2/invoice` with
   `callback_url = {NEXT_PUBLIC_SITE_URL}/api/payments/qpay/callback?order=<uuid>&t=<hmac>`.
   `place_order` has already inserted the `payments` row with
   `provider='bank_transfer'` and `amount_mnt = orders.total_mnt`
   (`20260904120200_functions.sql:547`), so this step **updates** that row:
   `provider='qpay_quickqr'`, `external_reference=<invoice id>`,
   `raw_payload=<create response>`. `amount_mnt` is read, not rewritten — it is
   the price the customer agreed to, and the invoice is created for exactly it.
   Status stays `unpaid`.

   The write goes through a service_role client obtained the way
   `lib/verify/store.js` obtains one, after the route has verified ownership
   against the caller's own session. Storefront roles are SELECT-only by
   decision 4, so the route cannot and must not write as the customer.
3. The customer scans the QR or taps a bank deeplink and pays.
4. QPay calls the callback URL. The route verifies the HMAC, loads the payment
   row by order id, calls `POST /v2/payment/check { invoice_id }`, and on `PAID`
   with a matching amount calls `confirm_payment_qpay`.
5. The order becomes `paid`, stock is decremented, and the existing
   `notification_outbox` sends the receipt. The order page poll flips to paid.

## API details

Host `https://quickqr.qpay.mn` (`QPAY_BASE_URL`). No sandbox host is available
on these credentials; every call is live.

    POST /v2/auth/token
      Authorization: Basic base64(username:password)
      body: { "terminal_id": "..." }        # required in the body as well
      -> { access_token, expires_in, refresh_token }

    POST /v2/invoice
      { merchant_id, amount, currency: "MNT", customer_name, callback_url,
        description, mcc_code: "", bank_accounts: [
          { account_bank_code, account_number, account_name, is_default: true }
        ] }
      -> { id, qr_code, qr_image, urls: [{ name, description, logo, link }] }

    POST /v2/payment/check
      { invoice_id }
      -> { invoice_status: "OPEN" | "PAID", ... }

    POST /v2/merchant/company
      { owner_register_no, owner_first_name, owner_last_name, register_number,
        name, mcc_code, city, district, address, phone, email,
        bank_account: { account_bank_code, account_number, account_name, is_default } }
      -> { id, vendor_id, register_number, ... }

`amount` is a number in whole tugrik, which matches `orders.total_mnt` directly —
MNT has no circulating minor unit, so no scaling is applied anywhere.

`mcc_code` is sent empty and the terminal fills it (7372 on this terminal,
verified live on 2026-09-03 during the fitbie integration).

The field is `register_number`. The `payment-sdks/qpayquick` SDK spells it
`register_nubmer`; that is a typo in that SDK and must not be copied.
`codify-org/qpay-go` and instasell both send `register_number` and both work.

## Database

Migration `supabase/migrations/20260906110000_qpay.sql`:

- `_confirm_payment_core(order_id uuid, external_reference text, amount_mnt bigint, actor uuid)`
  — the existing lock / oversell / decrement body of `confirm_payment`, moved
  verbatim, with `confirmed_by` set from `actor` instead of `auth.uid()`.
  `revoke all on function ... from public`.
- `confirm_payment(order_id, external_reference, amount_mnt)` — same signature,
  same `is_admin()` gate, now a wrapper passing `auth.uid()` as the actor. The
  admin UI (`app/admin/orders/[orderNumber]/page.js`), the GraphQL comment, the
  privilege ledger entry, and `tests/sql/*` are unaffected.
- `confirm_payment_qpay(order_id uuid, invoice_id text, amount_mnt bigint, payload jsonb)`
  — `security definer`, granted to `service_role` only, passes `actor := null`,
  and additionally writes `provider` and `raw_payload` on the payment row.
- `store_settings` gains `bank_code text`, `qpay_merchant_id text`,
  `qpay_enabled boolean not null default false`.
- The privilege ledger (`20260904120700_privilege_ledger.sql`) gains the two new
  functions so the grant surface stays enumerated.

No new table. `payments` already carries everything an invoice needs.

Provenance stays derivable rather than duplicated: `provider = 'qpay_quickqr'`
with `confirmed_by is null` means the machine confirmed it, and a null actor is
recorded as unknown rather than guessed at.

## Trust and failure rules

- The callback body is never read. The order id comes from the signed URL; the
  payment status comes from `/v2/payment/check`.
- `t` is an HMAC-SHA256 of the order id under `QPAY_CALLBACK_SECRET`, compared
  with a timing-safe equality check.
- The amount is compared against `payments.amount_mnt` recorded at invoice
  creation, because the check response carries no settled total.
- Amount mismatch: do not confirm. Append a timestamped `internal_note` and
  alert the owner through the existing outbox.
- Unknown order, bad HMAC, or an already-confirmed order: answer 200, write
  nothing, log. A non-2xx only makes QPay retry a request that will fail again.
- Idempotency is inherited from `_confirm_payment_core`, which returns early on
  an already-confirmed order, so retries never double-decrement stock.
- The oversell path is unchanged and still applies: money confirmed, order
  flagged `oversold`, stock untouched.
- Invoice creation failure does not fail the order. The order is already placed;
  the page falls back to the bank-transfer instructions.
- No scheduled polling. The owner gets a "Check now" button in /admin that calls
  `/v2/payment/check` on demand.

## Configuration

Env, secret, never in the database:
`QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_TERMINAL_ID`, `QPAY_MERCHANT_ID`,
`QPAY_BASE_URL`, `QPAY_CALLBACK_SECRET`.

`lib/qpay/config.js` treats these as all-or-nothing. If none are set, QPay is
off and `store_settings.qpay_enabled` cannot be turned on. If some are set, it
throws at first use naming the missing keys. A required variable that is simply
absent must never turn the integration off quietly.

Database, owner-editable in /admin: `bank_code`, `bank_account_number`,
`bank_account_name`, `qpay_merchant_id`, `qpay_enabled`.

## Merchant registration

`scripts/qpay-register-merchant.mjs` reads the business data from env
(`HOTARU_REGISTER_NUMBER`, `HOTARU_NAME`, `HOTARU_OWNER_REGISTER_NO`,
`HOTARU_OWNER_FIRST_NAME`, `HOTARU_OWNER_LAST_NAME`, `HOTARU_CITY`,
`HOTARU_DISTRICT`, `HOTARU_ADDRESS`, `HOTARU_PHONE`, `HOTARU_EMAIL`,
`HOTARU_BANK_CODE`, `HOTARU_ACCOUNT_NUMBER`, `HOTARU_ACCOUNT_NAME`), calls
`POST /v2/merchant/company`, and prints the resulting `merchant_id` and the SQL
to store it.

It is idempotent: on a duplicate-registration error it calls
`POST /v2/merchant/list` and looks the merchant up by `register_number` rather
than failing, the same recovery instasell uses
(`internal/api/handlers/qpay.go:189`).

## Testing

`tests/unit/qpay.test.js`, following `tests/unit/verify-mn.test.js` — fake
`fetchImpl`, no network:

- the token is cached and reused until `expires_in`, and refreshed after it
- `terminal_id` appears in the auth request body as well as in Basic auth
- the invoice body carries `bank_accounts[]`, `currency: "MNT"`, and an integer
  `amount` equal to `total_mnt`
- the merchant body spells the field `register_number`
- a partial `QPAY_*` env throws and names what is missing
- credentials never appear in a request body that is not the auth call

`tests/unit/qpay-callback.test.js`:

- a forged or absent HMAC is rejected and confirms nothing
- an amount mismatch does not confirm and records a note
- a replayed callback is a no-op
- every path answers 200

`tests/sql/05_qpay.sql`, following the existing pgTAP-style helpers:

- `confirm_payment_qpay` decrements stock exactly once and is idempotent
- it reaches the `oversold` path when stock is short, leaving stock untouched
- it is not executable by `authenticated` or `anon`
- `confirm_payment` still behaves exactly as `tests/sql/01_checkout.sql` expects

## Risks and open items

- **Settlement timing and commission are not in the API docs.** How long funds
  take to reach hotaru's account, and what QPay deducts, are contract terms.
  Confirm with QPay before promising the owner same-day money.
- **Every call is live.** These credentials have no sandbox host. End-to-end
  verification means a real invoice for a small amount.
- **Sub-merchant registration under another entity's terminal** is the documented
  reseller pattern, but the commercial side of it belongs in the Codify–QPay
  contract, not in this code.

## Prior art consulted

- `https://developer.qpay.mn/mn/docs/quick-qr?version=2.0.0`
- `codify-org/qpay-go` — types, paths, and the merchant update path shape
- `codify-org/instasell/internal/infrastructure/qpay` — duplicate-registration recovery
- `codify-org/payment-sdks/qpayquick` — read for comparison; its `register_nubmer` is a typo
- `app/api/verify/callback/route.js` — the callback-as-wake-up-signal pattern reused here
