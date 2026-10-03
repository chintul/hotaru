# hotaru — architecture decisions

Decisions taken during the Phase 1 grilling session, with the reasoning that
produced them. Recorded so that a later change is a deliberate reversal rather
than an accident.

| # | Decision | Why |
|---|----------|-----|
| 1 | Real store, real money | Order state must be auditable; payment record is the source of truth |
| 2 | Mongolia, MNT | Money is `bigint` **whole tugrik**. MNT has no circulating minor unit, so the usual "store cents" advice would inflate every price 100× |
| 3 | Payment adapter; v1 = manual bank transfer | MN rails (QPay, bank gateways) require a signed merchant contract that lands after the code does. `payments` carries provider + external ref + raw payload, so QPay drops in with no schema change |
| 4 | Apollo reads, DB-function writes | pg_graphql's generated `insertInto*`/`update*` mutations let a client choose its own totals and let a mis-scoped filter rewrite rows. Storefront roles get SELECT only; writes are SECURITY DEFINER functions, which pg_graphql still exposes as ordinary GraphQL mutations |
| 5 | Account required at checkout | Owner's call over my recommendation. Consequence: the auth wall must be late and light, or it becomes the drop-off point |
| 6 | Server cart + anonymous auth behind it | Anonymous sign-in on first add-to-cart; the user is upgraded in place at checkout keeping the same uid, so the cart never moves and no merge code is needed |
| 7 | Accessories, single-SKU | No option matrix |
| 8 | One optional variant axis | `products` + `variants`. Every product has ≥1 variant; the PDP renders a selector only when there is more than one. Adding a second size later is an INSERT, not a migration |
| 9 | No stock reservation | Decrement happens at payment confirmation, not order placement. Accepted trade-off: two buyers can pay for the last unit. Mitigated by making it loud — see below |
| 10 | Resend for email | Owner alert on order placement, receipts on status change |
| 11 | MN-structured address book | district → khoroo → building → entrance → apartment, plus landmark and phone. Orders snapshot the address as JSON so editing a saved address never rewrites history |
| 12 | Mongolian content, translation-ready | `product_translations` holds `mn` rows only today |
| 13 | ImageKit | `@imagekit/next` ships its own `<Image>`; `next/image` is not used. Store `file_id` **and** `file_path` — transformations build from the path, deletion needs the id |
| 14 | Solo-owner admin | Single `admin` role; the pending-payment queue is the primary screen |
| 15 | Close visual match, own assets | Reference uses Poppins (Google Fonts, OFL) at 12px body / 16px headings |
| 16 | v1 = discounts, search, wishlist, reviews | All four have schema from day one |
| 17 | Pre-orders pay a deposit, then a balance | Owner's call. A backorder line the stock can't cover is a pre-order: the shopper pays in-stock lines in full plus each pre-order line's deposit share (per product, default 50%), the owner invoices the balance when the goods arrive. One order even for a mixed cart; it ships when fully paid. Deposits are non-refundable and the shopper is told before paying |
| 18 | Reviews publish on submit | Owner's call, reversing pre-moderation. Moderation becomes "hide"; editing a hidden review does not republish it |
| 19 | Colour and size together | Owner's call, reversing decision 8's single axis for shoes and clothing. `option_label`/`option_value` stays the colour axis and `variants.size` is the second; each colour × size is a variant with its own stock. A colour may repeat only across sizes. Admin creates sizes from presets in one call |
| 20 | PostHog for traffic, the database for stock and sales | Owner's call. PostHog records page views (automatic), product views, add to cart, checkout start and order placed; signed-in shoppers are identified by account id only, admin pages are never sent. Stock, sales, carts and order stages come from `admin_analytics`, because only the database knows them. "Low stock" is below half of `variants.stock_baseline`, the level the stock was last raised to |

## Consequences worth remembering

**Oversell is possible by design (decision 9).** `confirm_payment` locks every
variant on the order, checks all lines, and only then decrements. If any line
cannot be covered it decrements nothing and sets the order to `oversold` with a
timestamped internal note. The owner refunds; the store never ships a phantom.
Verified: order for 4 units against 1 in stock leaves stock at 1 and the order
flagged, not negative.

**`confirm_payment` is idempotent.** Calling it on an already-confirmed order
returns early. Verified: stock 8 → 6 on first call, still 6 on the second.

**Cart transfer never takes a profile id.** A `SECURITY DEFINER` function that
merged "the cart belonging to `<uuid>`" would let any authenticated user drain
another user's cart. Instead the anonymous session mints an unguessable
single-use token (15-minute expiry, burned on read) which the signed-in account
redeems. Authority travels with the token, not with an argument.

**Admin bootstrap needs the escape hatch.** The role-protection trigger stands
aside when `auth.uid()` is null — service_role, the Supabase SQL editor, psql.
Without that there is no way to create the first admin on a fresh database,
because `is_admin()` is false for everyone.

**Function parameters are named after their columns on purpose**, because those
names become the GraphQL argument names. That makes them ambiguous to plpgsql,
so: qualify every column and parameter reference, and use
`on conflict on constraint <name>` — an inference clause cannot be qualified.

**Mongolian search is tokenisation, not stemming.** Postgres ships no `mn`
dictionary, so `search_products` combines `to_tsvector('simple', …)` with
trigram similarity. Verified: `ээмэг` matches, the suffixed `ээмгийг` does not.
If that becomes a problem the answer is an external index, not a config change.

## Configuration split

**Owner-editable settings live in the database** (`store_settings`, a single
row): bank name, account number, account holder, payment instructions, payment
deadline, owner alert address, store contact details. The owner changes an
account number from /admin; no deploy, no developer.

**Only secrets live in env**: Supabase keys, the ImageKit private key, the
Resend API key, the worker secret. The owner never touches these.

Bank details are also **snapshotted into each notification payload**, so an
email shows the account that was current when the order was placed even if the
owner edits it afterwards.

## Notifications are an outbox, not a direct call

Postgres does not call Resend. Triggers write to `notification_outbox`; a
service_role worker drains it. Reasons, in order of importance:

1. A missed owner alert means an unfulfilled paid order, so a failed send must
   be *retried*, not lost. Failures back off exponentially and give up at 5.
2. The Resend key never has to be stored in the database.
3. The whole path is testable today with no credentials — verified: 7 events
   queued across two orders, batch claim under `for update skip locked` hands
   disjoint rows to concurrent workers.
4. An email is never sent for a transaction that later rolls back, because the
   outbox row commits with the order.

A confirmed payment on an `oversold` order deliberately does **not** email the
customer: telling someone their payment succeeded when you cannot ship is worse
than silence. The owner's oversold alert drives that refund conversation.

**A pre-order order has several payment rows (decision 17).** The upfront row
(`full` or `deposit`) is created by `place_order`; `admin_request_balance` adds
the `balance` row. Every path that confirms, claims or invoices a payment acts
on the *open* row — the newest one still `unpaid` or `submitted` — so a
confirmed deposit is never rewritten. Stock moves with the upfront
confirmation only, and `cancel_order` restocks on `paid_at`, not on
`payment_status`. Packing and shipping stay blocked until the balance is in.

## Still open

- Brand wordmark and photography — the editorial look is mostly photography
- Supabase project + `supabase` CLI (not installed locally)
- ImageKit keys, Resend account + verified sending domain
- Bank account details for the transfer instructions screen
- Admin write functions (`admin_upsert_product`, `admin_set_stock`,
  `admin_approve_review`) — Phase 3
- Scheduled cleanup for accumulated anonymous `auth.users` rows
