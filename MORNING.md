# Start here

```bash
cd ~/Projects/hotaru
npm run dev        # http://localhost:3000
```

Everything below is already done. This is what is left, in priority order.

## 1. Make yourself admin (2 minutes)

Sign up at http://localhost:3000/login with your real email, then in the
Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

That session has no `auth.uid()`, which is exactly why the role-protection
trigger allows it. Then `/admin` opens.

## 2. Replace the bank details — do this before any real order

`/admin/settings`. Every field currently reads `REPLACE_ME`. The checkout
screen shows them verbatim to the customer, and nothing in the code can tell a
placeholder account number from a real one. The settings page flags them in red
until you change them.

## 3. Keys, when you have them

Put these in `.env.local` (already created, gitignored, Supabase keys filled in):

- `NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT`, `NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY`,
  `IMAGEKIT_PRIVATE_KEY` — until these exist, product images render as
  deterministic tinted placeholders rather than broken images.
- `RESEND_API_KEY` — the outbox already queues every email correctly; nothing is
  lost while this is missing. A worker to drain it is not written yet.

## 4. Two settings I changed on your project

Pushed via `supabase config push`, both required by the architecture:

- `enable_anonymous_sign_ins = true` — the cart identity. Without it add-to-cart
  fails outright.
- `enable_manual_linking = true` — converts that anonymous user into a real
  account at checkout, keeping the same uid so the cart survives.

And one you should reverse before launch:

- `enable_confirmations = false` — email confirmation is off. With it on, signup
  returns no session and checkout dead-ends, and there is no verified sending
  domain yet. **Turn this back on once Resend/SMTP is configured.**

## 5. What the cron endpoints need on Vercel

`vercel.json` schedules two jobs. Both are gated by `NOTIFICATION_WORKER_SECRET`
(set it to something real before deploying — the local value is a placeholder):

- `/api/cron/notifications` every 5 minutes — drains the outbox through Resend.
  Without `RESEND_API_KEY` it returns rows to `pending` rather than burning
  attempts, so nothing is lost until the key exists.
- `/api/cron/maintenance` daily at 03:00 — sweeps anonymous users older than
  7 days that hold no order and no cart, and expires 30-day-old carts.

## 6. Tests

```bash
npm test          # unit + database
npm run test:unit # fast, no Docker
npm run test:db   # migrations + behaviour, needs Docker
```

The database suite spins a throwaway Postgres, applies every migration and
asserts the behaviour that matters: checkout maths, the oversell path, RLS
isolation, cart-transfer tokens, admin guards, and the privilege ledger. It
mirrors Supabase's permissive default privileges on purpose — a test database
stricter than production cannot find privilege leaks, which is how one shipped
earlier.

## 7. Known gaps

- **Product photography does not exist.** The layout is a frame around images;
  it will not look like the reference until real shots go in. This is the single
  biggest visual gap and no amount of CSS closes it.
- **Admin cannot yet create or edit products.** `/admin/inventory` is read-only
  on purpose: like every other write, admin writes must go through
  `SECURITY DEFINER` functions (`admin_upsert_product`, `admin_set_stock`,
  `admin_approve_review`). Use Supabase Studio meanwhile.
- **Notification worker** — the outbox fills, nothing drains it yet.
- **Anonymous users accumulate** in `auth.users` and need a scheduled cleanup.
- **Node is x86-64 under Rosetta.** Next.js warns about it on every build.
  Reinstall an arm64 Node for a noticeable speed-up.

## What was verified against the live project

Anonymous cart → account conversion with the cart intact → Mongolian address →
order at a server-computed 194,000₮ → bank-transfer screen → admin confirms
payment → stock 8 → 7 → three notifications queued. Test data was deleted
afterwards, so the database is clean.
