# hotaru

Headless e-commerce storefront and backoffice. Mongolian accessories retail.

**Stack:** Next.js (App Router, JavaScript) · Apollo Client 4 ·
Supabase Postgres + Auth + `pg_graphql` · ImageKit · Resend · Vercel

## Status

All three phases built and verified end to end against the live project
(`ordmeqxctxvhpesbmexi`, ap-northeast-1).

**Read [MORNING.md](MORNING.md) first** — it lists the few things still needed.

```
supabase/migrations/   9 migrations, applied to the linked project
graphql/schema.graphql reference SDL (not deployed; pg_graphql reflects live)
graphql/operations/    the documented operation set
lib/queries.js         the documents the app actually sends
app/                   storefront + /admin
docs/decisions.md      why the schema looks like this
```

## Two rules that will bite you

**Money is whole MNT.** Every amount is a `bigint` of whole tugrik and every
column is suffixed `_mnt`. There is no minor unit. If you write `/ 100` or
`* 100` anywhere, it is a bug.

**Nothing writes to a table directly.** The storefront roles hold `SELECT` and
nothing else. Every mutation is a `SECURITY DEFINER` Postgres function, which
`pg_graphql` exposes as a normal GraphQL mutation. Prices and totals are
computed in the database from the catalog; the client never supplies an amount.

## Applying the schema

```bash
supabase link --project-ref <ref>
supabase db push
```

Then create the first admin from the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@hotaru.mn';
```

That session has no `auth.uid()`, which is exactly why the role-protection
trigger permits it.

Enable **manual identity linking** in Auth settings — the anonymous-to-permanent
cart handoff depends on it.

## Verifying locally

The migrations were validated against a real Postgres 16, including the checkout
path, RLS isolation between customers, the oversell path, and cart transfer:

```bash
docker run -d --name hotaru-pg -e POSTGRES_PASSWORD=pw -p 55433:5432 postgres:16-alpine
# supply auth.users / auth.uid() / auth.jwt() stubs, then apply migrations in order
```

`pg_graphql` is absent from plain Postgres; it is not needed to validate the DDL.

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never in the browser bundle
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=
NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=               # server only
RESEND_API_KEY=                     # server only
RESEND_FROM_DOMAIN=                 # verified Resend domain; the only source of the From address
```
