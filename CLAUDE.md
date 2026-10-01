# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # next dev — http://localhost:3000
npm run build
npm run lint         # eslint (flat config, eslint-config-next core-web-vitals + typescript)
npm run typecheck    # next typegen && tsc --noEmit

npm test             # unit + database
npm run test:unit    # node --test tests/unit/*.test.ts — fast, no Docker
npm run test:db      # ./scripts/test-db.sh — needs Docker
```

Single unit test file: `node --test tests/unit/qpay-client.test.ts`
(node's built-in runner; `--test-name-pattern '<regex>'` narrows to one case).

`test-db.sh` boots a throwaway `postgres:16-alpine` on port 55434
(`TEST_PG_PORT` overrides), stubs `auth.*` from `tests/helpers/00_supabase_stub.sql`,
applies **every** migration in order, then runs each `tests/sql/*.sql` suite.
`pg_graphql` and `pg_net` lines are stripped — they don't exist in plain
Postgres and aren't needed to exercise the DDL or the write path. The stub
database mirrors Supabase's *permissive* default privileges on purpose: a
stricter test DB cannot find privilege leaks.

Schema changes go to the live project with `supabase db push` (project ref
`ordmeqxctxvhpesbmexi`, ap-northeast-1). Migrations are timestamp-prefixed and
strictly additive — never edit an applied one.

## The two rules that break everything

**Money is whole MNT.** Every amount is a Postgres `bigint` of whole tugrik,
every column suffixed `_mnt`. There is no minor unit. Any `/ 100` or `* 100` is
a bug. Also: `pg_graphql` maps `bigint` to the GraphQL **String** scalar, so
`priceMnt` arrives as `"189000"`. Coerce with `toNumber()` from `lib/format.ts`
before arithmetic or you concatenate instead of add.

**Nothing writes to a table directly.** Storefront roles hold `SELECT` only.
Every mutation is a `SECURITY DEFINER` Postgres function that `pg_graphql`
exposes as an ordinary GraphQL mutation (`addToCart`, `placeOrder`,
`confirmPayment`, `adminUpsertProduct`, …). Prices and totals are computed in
the database from the catalog; the client never supplies an amount. Adding a
write means writing a SQL function in a new migration, a `comment on function`
directive if it needs a GraphQL name, and a document in `lib/queries.ts` — not
an `insertInto*` call.

## Architecture

**No resolver layer, no SDL deploy.** `pg_graphql` reflects the Postgres catalog
at request time. The GraphQL schema is defined by `comment on ...
e'@graphql({...})'` directives in `supabase/migrations/20260904120400_graphql.sql`
(plus later migrations for newer objects). `graphql/schema.graphql` is a
*reference* snapshot, not deployed; `graphql/operations/*.graphql` documents the
operation set; `lib/queries.ts` holds the documents the app actually sends.
Everything comes back as Relay connections — unwrap with `nodes()` /
`firstNode()` from `lib/format.ts`.

**Three ways to reach the data, each with a different identity:**

| Path | File | Identity | Sees |
|---|---|---|---|
| RSC catalog reads | `lib/apollo/rsc.ts` (`registerApolloClient`), wrapped by `safeQuery` | anon key, 60s revalidate | catalog only — customer tables are absent from the anon grants |
| Client reads/writes | `lib/apollo/ApolloWrapper.tsx` | visitor's JWT, read fresh per operation | whatever RLS allows for `auth.uid()` |
| Server routes | `lib/supabase/admin.ts` (`service_role`) | bypasses RLS | everything — only after the route has established who is asking |

`safeQuery` degrades to `{ data: null, error }` rather than 500ing the
storefront when the database is unreachable.

**Cart identity is anonymous auth.** First add-to-cart calls `ensureSession()`
(`lib/supabase/browser.ts`), which anonymously signs the visitor in. At checkout
that same user is upgraded *in place* to a real account keeping the **same
uid**, so the cart never moves and there is no merge code. `ensureSession` also
handles the stale-token case (a validly-signed JWT for a deleted user) by asking
`getUser()`, not `getSession()`. This requires `enable_anonymous_sign_ins` and
`enable_manual_linking` on the Supabase project — without them add-to-cart fails
outright.

**Cart transfer carries authority in a token, not an argument.** A function
taking "the cart belonging to `<uuid>`" would let anyone drain anyone's cart.
The anonymous session mints an unguessable single-use token (15 min, burned on
read) that the signed-in account redeems — `issueCartTransferToken` /
`redeemCartTransfer`. `components/CartHandoff.tsx` sits in the `(shop)` layout
because OAuth can return the shopper to any page.

**Notifications are an outbox, never a direct call.** Triggers write to
`notification_outbox`; `/api/cron/notifications` drains it through Resend as
`service_role`, gated by `NOTIFICATION_WORKER_SECRET` (bearer header, or
`?secret=` for manual runs). Since the notify-without-cron migration, Postgres
itself calls that route via `pg_net` the moment a row is queued — the path is
still `/api/cron/` only because the URL lives in a Vault secret. Failures back
off exponentially and give up at 5. Without `RESEND_API_KEY` rows return to
`pending` rather than burning attempts.

**Route groups own their chrome.** `app/layout.tsx` holds only the document,
Poppins, Apollo and `UIProvider`. `app/(shop)/` adds the storefront header,
footer, cart drawer and search overlay; `app/admin/` opts out entirely and uses
`AdminShell` behind `AdminGate`. `AdminGate` hides UI only — every admin action
is enforced in Postgres by `is_admin()` inside the function and by RLS on reads.

**Images are ImageKit, not `next/image`.** `@imagekit/next` ships its own
`<Image>`; transformations happen at ImageKit (also keeping the project off
Vercel's optimisation quota). `product_images` stores both `file_id` and
`file_path` — transformations build from the path, deletion needs the id.
`components/ProductImage.tsx` renders a deterministic slug-seeded tinted
placeholder when keys or photography are missing. Uploads are signed by
`/api/upload-auth`.

**Payments.** Two rails: QPay QuickQR (`lib/qpay/*`, server-only — `config.ts`
throws on a *partial* credential set and reports off for an empty one) and
manual bank transfer, whose account details live in the `store_settings` row and
are snapshotted into each notification payload. `confirm_payment` is idempotent,
locks every variant on the order, and if any line cannot be covered decrements
nothing and marks the order `oversold` (stock is decremented at confirmation,
not at placement — oversell is possible by design, see decision 9).

**Configuration split.** Owner-editable values (bank details, payment
instructions and deadline, alert address, store contact) live in the
`store_settings` table and are edited at `/admin/settings` — changing an account
number must never need a deploy. Only secrets live in env; see `.env.example`,
which annotates every variable.

## Conventions

- Strict TypeScript; `@/*` maps to the repo root (`tsconfig.json`). Shared domain
  types live in `lib/types.ts`. No `any`. Relative imports inside `lib/` and
  `tests/` keep the explicit `.ts` extension because `node --test` runs them
  with native type stripping — so only erasable syntax there (no enums,
  namespaces or parameter properties). `npm run typecheck` runs `tsc`.
- No code comments in TS/TSX. Explanations belong in `docs/`, commit messages
  or names.
- Function parameters are named after their columns deliberately — those names
  become the GraphQL argument names. That makes them ambiguous to plpgsql, so
  **qualify every column and parameter reference**, and use `on conflict on
  constraint <name>` (an inference clause cannot be qualified).
- Customer-facing copy is Mongolian; status labels live in
  `ORDER_STATUS_LABEL` in `lib/format.ts`. `product_translations` holds `mn`
  rows only, but the table exists so a second locale is an INSERT.
- `jsonb` columns arrive from `pg_graphql` as JSON *strings* — use `parseJson`.
  Address snapshots are `to_jsonb(addresses)`, so their keys are snake_case.
- Design tokens are Tailwind v4 `@theme` variables in `app/globals.css`.
  Storefront and admin palettes are deliberately separate scales (`--color-ink*`
  vs `--color-a-*`); pure `#000` is banned. Contrast pairings are documented
  inline — re-check them when changing a neutral.
- Mongolian search is tokenisation, not stemming: `search_products` combines
  `to_tsvector('simple', …)` with trigram similarity, because Postgres ships no
  `mn` dictionary. Suffixed forms will not match; the fix is an external index,
  not a config change.

## Read before changing behaviour

- `docs/decisions.md` — the 16 numbered decisions and their consequences; a
  change that contradicts one should be a deliberate reversal.
- `PRODUCT.md` — audience, brand personality, anti-references, design
  principles. The storefront's target is a one-handed evening scroll on a
  mid-range Android; the design principles are load-bearing, not decoration.
- `MORNING.md` — operational setup and the current known gaps.
- `docs/superpowers/` — specs and plans for recent feature work.
