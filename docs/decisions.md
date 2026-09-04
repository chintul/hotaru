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

## Still open

- Brand wordmark and photography — the editorial look is mostly photography
- Supabase project + `supabase` CLI (not installed locally)
- ImageKit keys, Resend account + verified sending domain
- Bank account details for the transfer instructions screen
- Admin write functions (`admin_upsert_product`, `admin_set_stock`,
  `admin_approve_review`) — Phase 3
- Scheduled cleanup for accumulated anonymous `auth.users` rows
