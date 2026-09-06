# Admin Selection and Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every admin table checkbox selection and a bulk-action menu, backed by set-based SQL for the catalog and a per-row loop for orders.

**Architecture:** Selection state is a pure reducer in `lib/admin/selection.js`, wrapped by a `useSelection` hook in `components/admin/selection.jsx` so both `DataTable` and the reviews **card** list can use it. Catalog bulk actions are single atomic SQL functions (`security definer`, `is_admin()` guarded). Orders run through `runBulk`, a sequential client loop that collects per-row failures, because `admin_set_order_status` has business guards that make partial failure normal.

**Tech Stack:** Next.js 16.3.4 (App Router, JS not TS), React 19.2, Apollo Client 4, Supabase Postgres + pg_graphql, Tailwind 4, `node --test`, psql + Docker for SQL suites.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-product-ux-design.md`

## Global Constraints

- **This is Track A of two.** Track B (the product editor) is a separate plan. Do not create `/admin/products` routes here — the product list wired in Task 8 is still `app/admin/inventory/page.js`.
- **JavaScript, not TypeScript.** No `.ts`/`.tsx`. JSDoc comments where a type matters.
- **`next/image` is not used in this project.** See `components/ProductImage.jsx:8`. Not relevant to this plan, but do not introduce it.
- **Unit tests import by relative path**, not the `@/` alias — `node --test` does not resolve `jsconfig.json` paths. See `tests/unit/format.test.js:3`.
- **Money is whole tugrik.** Never divide by 100.
- **Admin SQL functions follow one shape:** `volatile`, `language plpgsql`, `security definer`, `set search_path = public, pg_temp`, and `if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;` as the first statement. Copy it from `supabase/migrations/20260905020000_admin_write_functions.sql`.
- **UI copy is Mongolian.** Match the existing strings in `components/admin/`.
- **`categories.slug` is `citext`** — compare with `::citext`, never `lower()`.
- **Commit after every task.** Trunk only: work on `main`, never branch.
- **Test commands:** `npm run test:unit` (fast, no Docker), `npm run test:db` (Docker required), `npx eslint <paths>`, `npx next build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260907120000_admin_bulk_actions.sql` | The eight set-based catalog functions |
| `tests/sql/07_admin_bulk.sql` | SQL suite for those functions |
| `lib/admin/selection.js` | Pure selection transitions — no React |
| `lib/admin/bulk.js` | `runBulk` sequential runner with partial-failure aggregation |
| `tests/unit/selection.test.js` | Unit tests for the reducer |
| `tests/unit/bulk.test.js` | Unit tests for `runBulk` |
| `components/admin/selection.jsx` | `useSelection`, `BulkBar`, `SelectCell`, `SelectAllCell` |
| `components/admin/BulkResult.jsx` | Renders `{ ok, failed }` |
| `components/admin/ui.jsx` | `DataTable` gains `selection` + `bulkActions` props |
| `lib/queries.js` | The eight new bulk GraphQL mutations |
| `app/admin/inventory/page.js` | Product bulk actions |
| `app/admin/reviews/page.js` | Card checkboxes + bulk bar |
| `app/admin/discounts/page.js` | Discount bulk actions |
| `app/admin/page.js` | Order bulk status via the loop path |

---

### Task 1: SQL bulk functions

**Files:**
- Create: `supabase/migrations/20260907120000_admin_bulk_actions.sql`
- Create: `tests/sql/07_admin_bulk.sql`

**Interfaces:**
- Consumes: `public.is_admin()`, `public.product_status`, fixtures from `tests/helpers/02_fixtures.sql` (admin uid `22222222-2222-2222-2222-222222222222`; products `test-mug`, `test-bottle`, `test-holder`, `test-charm`; category `test-cat`).
- Produces: `admin_bulk_set_product_status(uuid[], text)`, `admin_bulk_set_product_featured(uuid[], boolean)`, `admin_bulk_set_product_category(uuid[], text)`, `admin_bulk_delete_products(uuid[]) -> integer`, `admin_bulk_set_review_approval(uuid[], boolean)`, `admin_bulk_delete_reviews(uuid[]) -> integer`, `admin_bulk_set_discount_active(uuid[], boolean)`, `admin_bulk_delete_discounts(uuid[]) -> integer`.

- [ ] **Step 1: Write the failing SQL test**

Create `tests/sql/07_admin_bulk.sql`:

```sql
\set ON_ERROR_STOP on
\echo '── admin: bulk actions ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

-- Two of the four fixture products; the other two are the control group.
create temp table t_ids as
select array_agg(id) as ids from public.products where slug in ('test-mug', 'test-bottle');

-- ---- status --------------------------------------------------------------
select test.eq(
  (select count(*)::int from public.admin_bulk_set_product_status((select ids from t_ids), 'draft')),
  2, 'bulk status returns one row per id');
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and status = 'draft'),
  2, 'both selected products are drafted');
select test.eq(
  (select count(*)::int from public.products where slug in ('test-holder','test-charm') and status = 'active'),
  2, 'unselected products are untouched');

select public.admin_bulk_set_product_status((select ids from t_ids), 'active');
select test.ok(
  (select bool_and(published_at is not null) from public.products where slug in ('test-mug','test-bottle')),
  'published_at is stamped when a bulk status goes active');

select test.raises(
  format($$select public.admin_bulk_set_product_status(%L, 'nonsense')$$, (select ids from t_ids)),
  '22P02', 'an invalid status raises rather than matching nothing');

-- ---- featured ------------------------------------------------------------
select public.admin_bulk_set_product_featured((select ids from t_ids), true);
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and is_featured),
  2, 'bulk feature sets the flag');
select public.admin_bulk_set_product_featured((select ids from t_ids), false);
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and is_featured),
  0, 'bulk unfeature clears it');

-- ---- category ------------------------------------------------------------
insert into public.categories (slug, position, is_visible) values ('bulk-cat', 901, true)
on conflict (slug) do nothing;

select public.admin_bulk_set_product_category((select ids from t_ids), 'bulk-cat');
select test.eq(
  (select count(*)::int from public.products p join public.categories c on c.id = p.category_id
    where p.slug in ('test-mug','test-bottle') and c.slug = 'bulk-cat'),
  2, 'bulk category moves the selection');

select test.raises(
  format($$select public.admin_bulk_set_product_category(%L, 'no-such-cat')$$, (select ids from t_ids)),
  'P0002', 'an unknown category slug raises');
select test.eq(
  (select count(*)::int from public.products p join public.categories c on c.id = p.category_id
    where p.slug in ('test-mug','test-bottle') and c.slug = 'bulk-cat'),
  2, 'the failed category call changed nothing');

-- ---- delete, and the order-history guarantee ------------------------------
-- An order line must stay readable after its product is hard-deleted. This is
-- the assertion the whole "offer delete" decision rests on.
create temp table t_order as
insert into public.orders (order_number, email, status, payment_status, subtotal_mnt, total_mnt)
values ('BULK-1', 'buyer@hotaru.mn', 'awaiting_payment', 'unpaid', 128000, 128000)
returning id;

insert into public.order_items
  (order_id, variant_id, product_id, product_title, unit_price_mnt, quantity)
select (select id from t_order), v.id, p.id, 'Test Mug', 128000, 1
  from public.products p join public.variants v on v.product_id = p.id
 where p.slug = 'test-mug' limit 1;

select test.eq(public.admin_bulk_delete_products(
  (select array_agg(id) from public.products where slug = 'test-mug')),
  1, 'bulk delete reports how many rows went');
select test.eq(
  (select count(*)::int from public.products where slug = 'test-mug'),
  0, 'the product is gone');
select test.eq(
  (select product_title from public.order_items where order_id = (select id from t_order)),
  'Test Mug', 'the order line still reads after its product is deleted');
select test.ok(
  (select product_id is null from public.order_items where order_id = (select id from t_order)),
  'the deleted product reference is nulled, not dangling');

-- ---- reviews -------------------------------------------------------------
create temp table t_rev as
insert into public.reviews (product_id, profile_id, rating, body, is_approved)
select p.id, '22222222-2222-2222-2222-222222222222', 5, 'Сайхан', false
  from public.products p where p.slug in ('test-bottle','test-holder')
returning id;

select test.eq(
  (select count(*)::int from public.admin_bulk_set_review_approval(
     (select array_agg(id) from t_rev), true)),
  2, 'bulk approval returns one row per review');
select test.eq(
  (select count(*)::int from public.reviews r where r.id in (select id from t_rev) and r.is_approved),
  2, 'both reviews are approved');
select test.eq(public.admin_bulk_delete_reviews((select array_agg(id) from t_rev)), 2,
  'bulk delete reports the review count');

-- ---- discounts -----------------------------------------------------------
create temp table t_disc as
insert into public.discount_codes (code, kind, value, is_active)
values ('BULKA', 'percentage', 5, true), ('BULKB', 'percentage', 5, true)
returning id;

select public.admin_bulk_set_discount_active((select array_agg(id) from t_disc), false);
select test.eq(
  (select count(*)::int from public.discount_codes where id in (select id from t_disc) and not is_active),
  2, 'bulk deactivate clears is_active');
select test.eq(public.admin_bulk_delete_discounts((select array_agg(id) from t_disc)), 2,
  'bulk delete reports the discount count');

-- ---- the admin guard, on every one of them --------------------------------
select test.as_user(null);   -- anonymous

select test.raises($$select public.admin_bulk_set_product_status(array[gen_random_uuid()], 'draft')$$,
  '42501', 'bulk status is admin-only');
select test.raises($$select public.admin_bulk_set_product_featured(array[gen_random_uuid()], true)$$,
  '42501', 'bulk feature is admin-only');
select test.raises($$select public.admin_bulk_set_product_category(array[gen_random_uuid()], 'test-cat')$$,
  '42501', 'bulk category is admin-only');
select test.raises($$select public.admin_bulk_delete_products(array[gen_random_uuid()])$$,
  '42501', 'bulk product delete is admin-only');
select test.raises($$select public.admin_bulk_set_review_approval(array[gen_random_uuid()], true)$$,
  '42501', 'bulk review approval is admin-only');
select test.raises($$select public.admin_bulk_delete_reviews(array[gen_random_uuid()])$$,
  '42501', 'bulk review delete is admin-only');
select test.raises($$select public.admin_bulk_set_discount_active(array[gen_random_uuid()], true)$$,
  '42501', 'bulk discount toggle is admin-only');
select test.raises($$select public.admin_bulk_delete_discounts(array[gen_random_uuid()])$$,
  '42501', 'bulk discount delete is admin-only');

select test.as_service();
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npm run test:db`
Expected: `FAIL  07_admin_bulk.sql` with `ERROR: function public.admin_bulk_set_product_status(uuid[], unknown) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260907120000_admin_bulk_actions.sql`:

```sql
-- ============================================================================
-- hotaru — 20. admin bulk actions
-- ============================================================================
-- One statement per action instead of N round trips.
--
-- Every function here is all-or-nothing on purpose: these catalog operations
-- have no per-row business guard to trip, so a partial result could only ever
-- mean a bug. Orders are deliberately ABSENT — admin_set_order_status refuses
-- fulfilment before payment and refuses cancellation outright, so bulk order
-- work runs row by row in the client where each failure is reportable against
-- its own order. See lib/admin/bulk.js.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create or replace function public.admin_bulk_set_product_status(
  product_ids uuid[],
  status text
) returns setof public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.product_status;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  -- Cast first: a bad value must raise, not quietly match nothing.
  v_status := admin_bulk_set_product_status.status::public.product_status;

  return query
  update public.products p set
    status = v_status,
    published_at = case
      when v_status = 'active' then coalesce(p.published_at, now())
      else p.published_at end
  where p.id = any(admin_bulk_set_product_status.product_ids)
  returning p.*;
end;
$$;

create or replace function public.admin_bulk_set_product_featured(
  product_ids uuid[],
  is_featured boolean
) returns setof public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  update public.products p set is_featured = admin_bulk_set_product_featured.is_featured
   where p.id = any(admin_bulk_set_product_featured.product_ids)
  returning p.*;
end;
$$;

create or replace function public.admin_bulk_set_product_category(
  product_ids uuid[],
  category_slug text
) returns setof public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  -- Resolve once and insist it exists. Letting a typo through would null the
  -- category on every selected row, which is the opposite of what was asked.
  select c.id into v_category from public.categories c
   where c.slug = admin_bulk_set_product_category.category_slug::citext;
  if v_category is null then
    raise exception 'category % not found', admin_bulk_set_product_category.category_slug
      using errcode = 'P0002';
  end if;

  return query
  update public.products p set category_id = v_category
   where p.id = any(admin_bulk_set_product_category.product_ids)
  returning p.*;
end;
$$;

-- Hard delete. Safe because order_items snapshots product_title, unit_price_mnt,
-- sku and image_path, and its product_id/variant_id FKs are ON DELETE SET NULL.
-- Order history stays readable; only the live catalog row goes.
create or replace function public.admin_bulk_delete_products(product_ids uuid[])
returns integer
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  delete from public.products p
   where p.id = any(admin_bulk_delete_products.product_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create or replace function public.admin_bulk_set_review_approval(
  review_ids uuid[],
  approved boolean
) returns setof public.reviews
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  update public.reviews r set is_approved = admin_bulk_set_review_approval.approved
   where r.id = any(admin_bulk_set_review_approval.review_ids)
  returning r.*;
end;
$$;

create or replace function public.admin_bulk_delete_reviews(review_ids uuid[])
returns integer
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  delete from public.reviews r where r.id = any(admin_bulk_delete_reviews.review_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Discount codes
-- ---------------------------------------------------------------------------

create or replace function public.admin_bulk_set_discount_active(
  discount_ids uuid[],
  is_active boolean
) returns setof public.discount_codes
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  update public.discount_codes d set is_active = admin_bulk_set_discount_active.is_active
   where d.id = any(admin_bulk_set_discount_active.discount_ids)
  returning d.*;
end;
$$;

create or replace function public.admin_bulk_delete_discounts(discount_ids uuid[])
returns integer
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  delete from public.discount_codes d
   where d.id = any(admin_bulk_delete_discounts.discount_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.admin_bulk_set_product_status is
  'Set status on many products at once. Atomic: these rows have no per-row guard, so partial success would mean a bug.';
comment on function public.admin_bulk_delete_products is
  'Hard delete. Order history survives because order_items snapshots its own copy of title, price and image.';
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm run test:db`
Expected: `PASS  07_admin_bulk.sql`, and `all database tests passed` at the end. Every other suite must still pass — a migration that breaks `03_admin_catalog.sql` is a failure.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907120000_admin_bulk_actions.sql tests/sql/07_admin_bulk.sql
git commit -m "feat(db): set-based admin bulk actions for catalog, reviews, discounts"
```

---

### Task 2: Selection reducer

**Files:**
- Create: `lib/admin/selection.js`
- Test: `tests/unit/selection.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `toggle(selected, id) -> Set`, `toggleAll(selected, ids) -> Set`, `prune(selected, ids) -> Set`, `selectionSummary(selected, ids) -> { count, allSelected, someSelected }`. All take and return a `Set` of string ids and never mutate their input.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/selection.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prune, selectionSummary, toggle, toggleAll } from '../../lib/admin/selection.js'

test('toggle adds and removes without mutating the input', () => {
  const before = new Set(['a'])
  const after = toggle(before, 'b')
  assert.deepEqual([...after].sort(), ['a', 'b'])
  assert.deepEqual([...before], ['a'], 'the input set is left alone')
  assert.deepEqual([...toggle(after, 'a')], ['b'])
})

test('toggleAll selects every id, and clears when all are already selected', () => {
  const ids = ['a', 'b', 'c']
  const all = toggleAll(new Set(['a']), ids)
  assert.deepEqual([...all].sort(), ['a', 'b', 'c'], 'a partial selection fills in')
  assert.equal(toggleAll(all, ids).size, 0, 'a full selection clears')
})

test('prune drops ids that are no longer visible', () => {
  // The bug this guards: filter to drafts, select them, clear the filter, then
  // hit Archive — and rows you cannot see get archived.
  const selected = new Set(['a', 'b', 'c'])
  assert.deepEqual([...prune(selected, ['a', 'c'])].sort(), ['a', 'c'])
  assert.equal(prune(selected, []).size, 0)
})

test('prune returns the same Set when nothing changed', () => {
  // Referential stability matters: this feeds a useEffect dependency.
  const selected = new Set(['a', 'b'])
  assert.equal(prune(selected, ['a', 'b', 'c']), selected)
})

test('summary reports counts and the all/some distinction', () => {
  assert.deepEqual(selectionSummary(new Set(), ['a', 'b']),
    { count: 0, allSelected: false, someSelected: false })
  assert.deepEqual(selectionSummary(new Set(['a']), ['a', 'b']),
    { count: 1, allSelected: false, someSelected: true })
  assert.deepEqual(selectionSummary(new Set(['a', 'b']), ['a', 'b']),
    { count: 2, allSelected: true, someSelected: true })
  assert.deepEqual(selectionSummary(new Set(), []),
    { count: 0, allSelected: false, someSelected: false },
    'an empty table is not "all selected"')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '.../lib/admin/selection.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/selection.js`:

```js
/**
 * Selection transitions, kept free of React so `node --test` can reach them.
 *
 * Every function takes a Set of ids and returns a new Set, except `prune`,
 * which returns the original when nothing changed — it feeds a useEffect
 * dependency, and a fresh Set on every render would loop.
 */

export function toggle(selected, id) {
  const next = new Set(selected)
  if (!next.delete(id)) next.add(id)
  return next
}

export function toggleAll(selected, ids) {
  const everySelected = ids.length > 0 && ids.every((id) => selected.has(id))
  return everySelected ? new Set() : new Set(ids)
}

/**
 * Drop ids that are no longer on screen. Acting on rows the operator cannot
 * see is the failure mode this exists to prevent.
 */
export function prune(selected, ids) {
  const visible = new Set(ids)
  let changed = false
  for (const id of selected) if (!visible.has(id)) { changed = true; break }
  if (!changed) return selected

  const next = new Set()
  for (const id of selected) if (visible.has(id)) next.add(id)
  return next
}

export function selectionSummary(selected, ids) {
  const count = selected.size
  return {
    count,
    allSelected: ids.length > 0 && count === ids.length,
    someSelected: count > 0,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: all `selection.test.js` assertions pass; existing suites unchanged.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/selection.js tests/unit/selection.test.js
git commit -m "feat(admin): pure selection reducer"
```

---

### Task 3: Sequential bulk runner

**Files:**
- Create: `lib/admin/bulk.js`
- Test: `tests/unit/bulk.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `async runBulk(ids, fn) -> { ok: string[], failed: Array<{ id, message }> }`. `fn(id)` is awaited once per id, **sequentially, in the given order**. A rejection is recorded and the loop continues.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/bulk.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBulk } from '../../lib/admin/bulk.js'

test('every id is attempted and the successes are reported', async () => {
  const seen = []
  const res = await runBulk(['a', 'b', 'c'], async (id) => { seen.push(id) })
  assert.deepEqual(seen, ['a', 'b', 'c'])
  assert.deepEqual(res.ok, ['a', 'b', 'c'])
  assert.deepEqual(res.failed, [])
})

test('a rejection is recorded and does NOT abort the batch', async () => {
  // The orders case: one unpaid order must not stop the other nineteen.
  const res = await runBulk(['a', 'b', 'c'], async (id) => {
    if (id === 'b') throw new Error('cannot mark shipped before payment is confirmed')
  })
  assert.deepEqual(res.ok, ['a', 'c'])
  assert.deepEqual(res.failed, [
    { id: 'b', message: 'cannot mark shipped before payment is confirmed' },
  ])
})

test('runs strictly in sequence, never in parallel', async () => {
  // Parallel would stack `for update` locks and scramble attribution.
  let inFlight = 0
  let maxInFlight = 0
  await runBulk(['a', 'b', 'c'], async () => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 1))
    inFlight -= 1
  })
  assert.equal(maxInFlight, 1)
})

test('a thrown non-Error still yields a readable message', async () => {
  const res = await runBulk(['a'], async () => { throw 'plain string' })
  assert.equal(res.failed[0].message, 'plain string')

  const res2 = await runBulk(['a'], async () => { throw { nope: true } })
  assert.equal(typeof res2.failed[0].message, 'string')
  assert.ok(res2.failed[0].message.length > 0, 'never an empty message')
})

test('an empty selection is a no-op, not a crash', async () => {
  const res = await runBulk([], async () => { throw new Error('should not run') })
  assert.deepEqual(res, { ok: [], failed: [] })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '.../lib/admin/bulk.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/admin/bulk.js`:

```js
/**
 * Runs one mutation per id, sequentially, collecting failures instead of
 * throwing on the first one.
 *
 * This exists for orders. `admin_set_order_status` refuses fulfilment states
 * before payment is confirmed and refuses cancellation outright, so a
 * selection of twenty will routinely contain rows that must fail while the
 * rest succeed — partial success is the correct answer, not an error.
 *
 * Sequential rather than parallel on purpose: a guard failure stays
 * attributable to its own row, and the database is not hit with twenty
 * concurrent `select ... for update` locks.
 */
export async function runBulk(ids, fn) {
  const ok = []
  const failed = []

  for (const id of ids) {
    try {
      await fn(id)
      ok.push(id)
    } catch (e) {
      failed.push({ id, message: messageOf(e) })
    }
  }

  return { ok, failed }
}

function messageOf(e) {
  if (typeof e === 'string' && e) return e
  if (e?.message) return String(e.message)
  return 'Тодорхойгүй алдаа'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: all `bulk.test.js` assertions pass.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/bulk.js tests/unit/bulk.test.js
git commit -m "feat(admin): sequential bulk runner with partial-failure reporting"
```

---

### Task 4: Selection hook and bulk bar

**Files:**
- Create: `components/admin/selection.jsx`
- Modify: `components/admin/icons.jsx` (add `Check`, `Minus`)

**Interfaces:**
- Consumes: `toggle`, `toggleAll`, `prune`, `selectionSummary` from `lib/admin/selection.js`; `Button`, `IconButton` from `components/admin/ui.jsx`.
- Produces:
  - `useSelection(rows) -> { selected, isSelected(row), toggleRow(row), toggleAllRows(), clear(), count, allSelected, someSelected, ids }` where `ids` is `[...selected]`.
  - `<BulkBar count actions onClear />` — `actions` is `Array<{ key, label, tone?: 'danger', separatorBefore?: boolean, render?: (close) => ReactNode, run?: () => void }>`. An action with `render` opens a popover instead of running (used for category assignment); `separatorBefore` draws a rule above the item, which is how destructive actions get held apart from routine ones.
  - `<SelectCell checked onChange />` and `<SelectAllCell checked indeterminate onChange />`.

**Note on `icons.jsx`:** it currently exports single-path stroke icons at 16px. Match that style exactly — `viewBox="0 0 16 16"`, `stroke="currentColor"`, `fill="none"`, `strokeWidth="1.5"`.

- [ ] **Step 1: Add the two icons**

In `components/admin/icons.jsx`, append:

```jsx
export const Check = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Minus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 8h8" strokeLinecap="round" />
  </svg>
)
```

- [ ] **Step 2: Write the selection module**

Create `components/admin/selection.jsx`:

```jsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { prune, selectionSummary, toggle, toggleAll } from '@/lib/admin/selection'
import { Check, Minus } from './icons'
import { Button } from './ui'

/**
 * Row selection for any admin list — table or cards.
 *
 * Deliberately not folded into DataTable: the reviews page is a card list that
 * needs the same checkboxes and the same bulk bar, and a table-only hook would
 * have forced it to become a table it should not be.
 */
export function useSelection(rows) {
  const [selected, setSelected] = useState(() => new Set())
  const ids = useMemo(() => rows.map((r) => r.id), [rows])

  // Searching or filtering must not leave off-screen rows armed.
  const idsKey = ids.join(',')
  useEffect(() => {
    setSelected((cur) => prune(cur, ids))
    // idsKey is the value dependency; ids is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const summary = selectionSummary(selected, ids)

  return {
    selected,
    ids: [...selected],
    isSelected: (row) => selected.has(row.id),
    toggleRow: (row) => setSelected((cur) => toggle(cur, row.id)),
    toggleAllRows: () => setSelected((cur) => toggleAll(cur, ids)),
    clear: () => setSelected(new Set()),
    ...summary,
  }
}

function Box({ checked, indeterminate, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange() }}
      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
        checked || indeterminate
          ? 'border-a-ink bg-a-ink text-white'
          : 'border-a-line bg-white text-transparent hover:border-a-muted'
      }`}
    >
      <span className="scale-[.7]">{indeterminate ? <Minus /> : <Check />}</span>
    </button>
  )
}

/** Cell wrapper that swallows the click so row-click still navigates. */
export const SelectCell = ({ checked, onChange }) => (
  <Box checked={checked} onChange={onChange} label="Мөр сонгох" />
)

export const SelectAllCell = ({ checked, indeterminate, onChange }) => (
  <Box checked={checked} indeterminate={indeterminate} onChange={onChange} label="Бүгдийг сонгох" />
)

/**
 * The strip that replaces a table toolbar while rows are selected.
 * An action either runs (`run`) or opens a popover (`render`) — assigning a
 * category needs a value, so it cannot be a plain menu item.
 */
export function BulkBar({ count, actions, onClear }) {
  const [open, setOpen] = useState(false)
  const [popover, setPopover] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPopover(null) } }
    const onEsc = (e) => { if (e.key === 'Escape') { setOpen(false); setPopover(null) } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc) }
  }, [])

  const close = () => { setOpen(false); setPopover(null) }
  const active = actions.find((a) => a.key === popover)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-a-line bg-a-hover px-4 py-2.5">
      <span className="text-[13px] font-medium text-a-ink">{count} сонгосон</span>

      <div className="relative ml-auto" ref={ref}>
        <Button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Үйлдэл ▾
        </Button>

        {open && !popover && (
          <div className="absolute right-0 top-full z-20 mt-1 w-[220px] overflow-hidden rounded-lg border border-a-line bg-white py-1 shadow-lg">
            {actions.map((a) => (
              <div key={a.key}>
                {a.separatorBefore && <div className="my-1 border-t border-a-line" />}
                <button
                  onClick={() => (a.render ? setPopover(a.key) : (close(), a.run()))}
                  className={`block w-full px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-a-hover ${
                    a.tone === 'danger' ? 'text-red-600' : 'text-a-ink'
                  }`}
                >
                  {a.label}
                </button>
              </div>
            ))}
          </div>
        )}

        {popover && active && (
          <div className="absolute right-0 top-full z-20 mt-1 w-[260px] rounded-lg border border-a-line bg-white p-3 shadow-lg">
            {active.render(close)}
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={onClear}>Цуцлах</Button>
    </div>
  )
}
```

- [ ] **Step 3: Lint it**

Run: `npx eslint components/admin/selection.jsx components/admin/icons.jsx lib/admin/selection.js`
Expected: no errors. (No test here — this is React glue over Task 2's already-tested reducer; the behaviour is verified end to end in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add components/admin/selection.jsx components/admin/icons.jsx
git commit -m "feat(admin): useSelection hook and bulk action bar"
```

---

### Task 5: DataTable selection props

**Files:**
- Modify: `components/admin/ui.jsx:107-160` (the `DataTable` export)

**Interfaces:**
- Consumes: `SelectCell`, `SelectAllCell`, `BulkBar` from `components/admin/selection.jsx`.
- Produces: `DataTable` accepting two new **optional** props — `selection` (a `useSelection` return) and `bulkActions` (the `BulkBar` actions array). Behaviour with both absent is byte-identical to today.

- [ ] **Step 1: Replace the DataTable export**

In `components/admin/ui.jsx`, replace the whole `export function DataTable(...)` with:

```jsx
export function DataTable({ columns, rows, empty, onRowClick, toolbar, selection, bulkActions }) {
  const selectable = Boolean(selection)
  const span = columns.length + (selectable ? 1 : 0)

  return (
    <div className="rounded-xl border border-a-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      {selectable && selection.count > 0
        ? <BulkBar count={selection.count} actions={bulkActions ?? []} onClear={selection.clear} />
        : toolbar}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-y border-a-line">
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <SelectAllCell
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    onChange={selection.toggleAllRows}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap px-4 py-2.5 text-[13px] font-normal text-a-muted ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={span} className="px-4 py-16 text-center text-[13px] text-a-muted">
                  {empty ?? 'Мэдээлэл алга'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-a-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-a-hover' : ''} ${
                    selectable && selection.isSelected(row) ? 'bg-a-hover' : ''
                  }`}
                >
                  {selectable && (
                    <td className="w-10 px-4 py-3">
                      <SelectCell
                        checked={selection.isSelected(row)}
                        onChange={() => selection.toggleRow(row)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-3 text-[13px] text-a-ink ${c.align === 'right' ? 'text-right' : ''}`}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the import**

At the top of `components/admin/ui.jsx`, after the existing `./icons` import, add:

```jsx
import { BulkBar, SelectAllCell, SelectCell } from './selection'
```

- [ ] **Step 3: Verify the untouched call sites still render**

Run: `npx next build`
Expected: build succeeds. Then start `npm run dev` and load `/admin` and `/admin/discounts` — both call `DataTable` **without** `selection` (`app/admin/page.js:57`, `app/admin/discounts/page.js:99`) and must look exactly as before: no checkbox column, no bulk bar.

- [ ] **Step 4: Commit**

```bash
git add components/admin/ui.jsx
git commit -m "feat(admin): optional selection column on DataTable"
```

---

### Task 6: Bulk result report

**Files:**
- Create: `components/admin/BulkResult.jsx`

**Interfaces:**
- Consumes: `runBulk`'s return shape `{ ok: string[], failed: Array<{ id, message }> }`.
- Produces: `<BulkResult result labelFor onDismiss />` where `labelFor(id) -> string` turns an id into something human (an order number), and `result` may be `null` (renders nothing).

- [ ] **Step 1: Write the component**

Create `components/admin/BulkResult.jsx`:

```jsx
'use client'

import { useState } from 'react'
import { Button } from './ui'

/**
 * Reports the outcome of a partial-failure batch.
 *
 * Orders are the reason this exists: admin_set_order_status refuses fulfilment
 * before payment is confirmed, so "17 succeeded, 3 refused, here is which and
 * why" is the honest answer — not a single red toast.
 */
export default function BulkResult({ result, labelFor = (id) => id, onDismiss }) {
  const [open, setOpen] = useState(true)
  if (!result) return null

  const { ok, failed } = result
  const clean = failed.length === 0

  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-3 text-[13px] ${
        clean ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="font-medium">
          {ok.length} амжилттай{failed.length > 0 ? ` · ${failed.length} алдаа` : ''}
        </span>
        {failed.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="underline underline-offset-2">
            {open ? 'Нуух' : 'Дэлгэрэнгүй'}
          </button>
        )}
        <span className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onDismiss}>Хаах</Button>
        </span>
      </div>

      {open && failed.length > 0 && (
        <ul className="mt-2 space-y-1">
          {failed.map((f) => (
            <li key={f.id} className="flex gap-2">
              <span className="font-medium tabular-nums">{labelFor(f.id)}</span>
              <span className="text-amber-800">{f.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/admin/BulkResult.jsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/BulkResult.jsx
git commit -m "feat(admin): partial-failure result report"
```

---

### Task 7: Bulk GraphQL operations

**Files:**
- Modify: `lib/queries.js` (append at the end)

**Interfaces:**
- Consumes: the SQL functions from Task 1. pg_graphql camelCases them through the `inflect_names` directive at `supabase/migrations/20260904120400_graphql.sql:15`; `setof` returns surface as connections, matching `ADMIN_REORDER_IMAGES` at `lib/queries.js:506`.
- Produces: `ADMIN_BULK_SET_PRODUCT_STATUS`, `ADMIN_BULK_SET_PRODUCT_FEATURED`, `ADMIN_BULK_SET_PRODUCT_CATEGORY`, `ADMIN_BULK_DELETE_PRODUCTS`, `ADMIN_BULK_SET_REVIEW_APPROVAL`, `ADMIN_BULK_DELETE_REVIEWS`, `ADMIN_BULK_SET_DISCOUNT_ACTIVE`, `ADMIN_BULK_DELETE_DISCOUNTS`.

- [ ] **Step 1: Append the operations**

Add to the end of `lib/queries.js`:

```js
/* ------------------------------ bulk actions ------------------------------ */
// One round trip per action instead of one per row. Orders are absent on
// purpose — their guards make partial failure normal, so they run row by row
// through lib/admin/bulk.js against the existing single-row mutations.

export const ADMIN_BULK_SET_PRODUCT_STATUS = gql`
  mutation AdminBulkSetProductStatus($productIds: [UUID!]!, $status: String!) {
    adminBulkSetProductStatus(productIds: $productIds, status: $status) {
      edges { node { id status isFeatured } }
    }
  }
`

export const ADMIN_BULK_SET_PRODUCT_FEATURED = gql`
  mutation AdminBulkSetProductFeatured($productIds: [UUID!]!, $isFeatured: Boolean!) {
    adminBulkSetProductFeatured(productIds: $productIds, isFeatured: $isFeatured) {
      edges { node { id isFeatured } }
    }
  }
`

export const ADMIN_BULK_SET_PRODUCT_CATEGORY = gql`
  mutation AdminBulkSetProductCategory($productIds: [UUID!]!, $categorySlug: String!) {
    adminBulkSetProductCategory(productIds: $productIds, categorySlug: $categorySlug) {
      edges { node { id category { slug } } }
    }
  }
`

export const ADMIN_BULK_DELETE_PRODUCTS = gql`
  mutation AdminBulkDeleteProducts($productIds: [UUID!]!) {
    adminBulkDeleteProducts(productIds: $productIds)
  }
`

export const ADMIN_BULK_SET_REVIEW_APPROVAL = gql`
  mutation AdminBulkSetReviewApproval($reviewIds: [UUID!]!, $approved: Boolean!) {
    adminBulkSetReviewApproval(reviewIds: $reviewIds, approved: $approved) {
      edges { node { id isApproved } }
    }
  }
`

export const ADMIN_BULK_DELETE_REVIEWS = gql`
  mutation AdminBulkDeleteReviews($reviewIds: [UUID!]!) {
    adminBulkDeleteReviews(reviewIds: $reviewIds)
  }
`

export const ADMIN_BULK_SET_DISCOUNT_ACTIVE = gql`
  mutation AdminBulkSetDiscountActive($discountIds: [UUID!]!, $isActive: Boolean!) {
    adminBulkSetDiscountActive(discountIds: $discountIds, isActive: $isActive) {
      edges { node { id isActive } }
    }
  }
`

export const ADMIN_BULK_DELETE_DISCOUNTS = gql`
  mutation AdminBulkDeleteDiscounts($discountIds: [UUID!]!) {
    adminBulkDeleteDiscounts(discountIds: $discountIds)
  }
`
```

- [ ] **Step 2: Verify the schema actually reflects these names**

The migration must be applied to the dev database first (`npx supabase db push`, or however this project applies migrations). Then in the browser console on any admin page, or via curl against the Supabase GraphQL endpoint, run:

```graphql
{ __type(name: "Mutation") { fields { name } } }
```

Expected: `adminBulkSetProductStatus`, `adminBulkDeleteProducts` and the other six appear. If a name differs (pg_graphql inflection surprises), fix the operation to match the reflected name rather than renaming the SQL function.

- [ ] **Step 3: Commit**

```bash
git add lib/queries.js
git commit -m "feat(admin): bulk action GraphQL operations"
```

---

### Task 8: Product list bulk actions

**Files:**
- Modify: `app/admin/inventory/page.js:16-95` (the `InventoryPage` component only — leave `ProductForm`, `VariantPanel`, `VariantRow`, `VariantForm` alone)

**Interfaces:**
- Consumes: `useSelection` (Task 4), `DataTable` selection props (Task 5), the four product mutations (Task 7).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the imports**

At the top of `app/admin/inventory/page.js`, extend the existing imports:

```js
import {
  ADMIN_ARCHIVE_PRODUCT, ADMIN_BULK_DELETE_PRODUCTS, ADMIN_BULK_SET_PRODUCT_CATEGORY,
  ADMIN_BULK_SET_PRODUCT_FEATURED, ADMIN_BULK_SET_PRODUCT_STATUS, ADMIN_DELETE_VARIANT,
  ADMIN_PRODUCTS, ADMIN_SET_STOCK, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT,
} from '@/lib/queries'
import { useSelection } from '@/components/admin/selection'
```

- [ ] **Step 2: Wire selection and the action list into `InventoryPage`**

Inside `InventoryPage`, after `const rows = useMemo(...)`, add:

```js
  const sel = useSelection(rows)
  const [setStatus] = useMutation(ADMIN_BULK_SET_PRODUCT_STATUS)
  const [setFeatured] = useMutation(ADMIN_BULK_SET_PRODUCT_FEATURED)
  const [setCategory] = useMutation(ADMIN_BULK_SET_PRODUCT_CATEGORY)
  const [bulkDelete] = useMutation(ADMIN_BULK_DELETE_PRODUCTS)
  const [bulkError, setBulkError] = useState(null)

  // Every bulk action funnels through here so the confirm, the error surface
  // and the post-action cleanup are written once.
  const run = async (confirmText, fn) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    try {
      await fn(sel.ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(e?.message ?? 'Үйлдэл амжилтгүй боллоо.')
    }
  }

  const n = sel.count
  const bulkActions = [
    { key: 'active', label: 'Нийтлэх (active)',
      run: () => run(`${n} бүтээгдэхүүнийг нийтлэх үү?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'active' } })) },
    { key: 'draft', label: 'Ноорог болгох (draft)',
      run: () => run(`${n} бүтээгдэхүүнийг ноорог болгох уу?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'draft' } })) },
    { key: 'feature', label: 'Онцлох',
      run: () => run(`${n} бүтээгдэхүүнийг онцлох уу?`,
        (ids) => setFeatured({ variables: { productIds: ids, isFeatured: true } })) },
    { key: 'unfeature', label: 'Онцлохоо болих',
      run: () => run(`${n} бүтээгдэхүүний онцлохыг болих уу?`,
        (ids) => setFeatured({ variables: { productIds: ids, isFeatured: false } })) },
    { key: 'category', label: 'Ангилал солих',
      render: (close) => (
        <CategoryPicker
          categories={categories}
          onApply={async (slug) => {
            close()
            await run(`${n} бүтээгдэхүүнийг шилжүүлэх үү?`,
              (ids) => setCategory({ variables: { productIds: ids, categorySlug: slug } }))
          }}
        />
      ) },
    { key: 'archive', label: 'Архивлах', separatorBefore: true,
      run: () => run(`${n} бүтээгдэхүүнийг архивлах уу?`,
        (ids) => setStatus({ variables: { productIds: ids, status: 'archived' } })) },
    { key: 'delete', label: 'Бүрмөсөн устгах', tone: 'danger',
      run: async () => {
        // Typed confirmation: archive is one click, deletion should not be.
        const typed = window.prompt(
          `${n} бүтээгдэхүүнийг бүрмөсөн устгана. Захиалгын түүх хэвээр үлдэнэ.\n\nБаталгаажуулахын тулд УСТГАХ гэж бичнэ үү:`)
        if (typed !== 'УСТГАХ') return
        setBulkError(null)
        try {
          await bulkDelete({ variables: { productIds: sel.ids } })
          sel.clear()
          await refetch()
        } catch (e) {
          setBulkError(e?.message ?? 'Устгах үед алдаа гарлаа.')
        }
      } },
  ]
```

- [ ] **Step 3: Pass them to the table and surface errors**

Replace the `<DataTable ... />` call in `InventoryPage` with:

```jsx
          <DataTable
            columns={columns}
            rows={rows}
            selection={sel}
            bulkActions={bulkActions}
            onRowClick={(p) => setExpanded(expanded === p.id ? null : p.id)}
            toolbar={<TableToolbar search={search} onSearch={setSearch} placeholder="Нэр, slug" />}
          />
```

And immediately before it, add the error surface:

```jsx
          {bulkError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
              {bulkError}
            </p>
          )}
```

- [ ] **Step 4: Add the category picker**

At the bottom of `app/admin/inventory/page.js`, add:

```jsx
function CategoryPicker({ categories, onApply }) {
  const [slug, setSlug] = useState(categories[0]?.slug ?? '')
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-medium text-a-ink">Ангилал сонгох</p>
      <Select value={slug} onChange={(e) => setSlug(e.target.value)}>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>
            {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
          </option>
        ))}
      </Select>
      <Button variant="primary" className="w-full" disabled={!slug} onClick={() => onApply(slug)}>
        Шилжүүлэх
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Verify by hand**

Run `npm run dev`, sign in as an allowlisted admin, open `/admin/inventory`:

1. Checkbox column appears; header checkbox selects all, then clears.
2. Selecting two rows swaps the toolbar for `2 сонгосон  [Үйлдэл ▾] [Цуцлах]`.
3. `Нийтлэх` → confirm → both rows show `active`.
4. **Type a search term that hides a selected row** → the count drops. This is the prune rule from Task 2 doing its job.
5. `Ангилал солих` opens the popover, not an action.
6. `Бүрмөсөн устгах` on a throwaway draft: typing anything but `УСТГАХ` cancels.
7. Clicking a row still expands the variant panel — the checkbox must not trigger it.

- [ ] **Step 6: Lint and build**

Run: `npx eslint app/admin/inventory/page.js && npx next build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/admin/inventory/page.js
git commit -m "feat(admin): bulk actions on the product list"
```

---

### Task 9: Review bulk actions

**Files:**
- Modify: `app/admin/reviews/page.js`

**Interfaces:**
- Consumes: `useSelection`, `BulkBar` (Task 4), review bulk mutations (Task 7).
- Produces: nothing later tasks depend on.

**Why cards, not a table:** the review body is the thing being moderated. Truncating it into a table cell would make the page worse to use, so selection comes to the cards instead — which is exactly why `useSelection` is a standalone hook.

- [ ] **Step 1: Extend imports**

```js
import { useMutation, useQuery } from '@apollo/client/react'
import {
  ADMIN_BULK_DELETE_REVIEWS, ADMIN_BULK_SET_REVIEW_APPROVAL,
  ADMIN_DELETE_REVIEW, ADMIN_REVIEWS, ADMIN_SET_REVIEW_APPROVAL,
} from '@/lib/queries'
import { BulkBar, SelectCell, useSelection } from '@/components/admin/selection'
```

- [ ] **Step 2: Wire selection into `ReviewsPage`**

After `const shown = filter === 'pending' ? pending : all`, add:

```js
  const sel = useSelection(shown)
  const [bulkApproval] = useMutation(ADMIN_BULK_SET_REVIEW_APPROVAL)
  const [bulkDelete] = useMutation(ADMIN_BULK_DELETE_REVIEWS)
  const [bulkError, setBulkError] = useState(null)

  const run = async (confirmText, fn) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    try {
      await fn(sel.ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(e?.message ?? 'Үйлдэл амжилтгүй боллоо.')
    }
  }

  const n = sel.count
  const bulkActions = [
    { key: 'approve', label: 'Зөвшөөрөх',
      run: () => run(`${n} сэтгэгдлийг нийтлэх үү?`,
        (ids) => bulkApproval({ variables: { reviewIds: ids, approved: true } })) },
    { key: 'hide', label: 'Нуух',
      run: () => run(`${n} сэтгэгдлийг нуух уу?`,
        (ids) => bulkApproval({ variables: { reviewIds: ids, approved: false } })) },
    { key: 'delete', label: 'Устгах', tone: 'danger', separatorBefore: true,
      run: () => run(`${n} сэтгэгдлийг устгах уу? Буцаах боломжгүй.`,
        (ids) => bulkDelete({ variables: { reviewIds: ids } })) },
  ]
```

- [ ] **Step 3: Render the bar and pass selection into each card**

Replace the `<div className="space-y-3">` block with:

```jsx
        <>
          {bulkError && (
            <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
              {bulkError}
            </p>
          )}
          {sel.count > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-a-line bg-white">
              <BulkBar count={sel.count} actions={bulkActions} onClear={sel.clear} />
            </div>
          )}
          <div className="space-y-3">
            {shown.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                selected={sel.isSelected(r)}
                onToggle={() => sel.toggleRow(r)}
                onDone={refetch}
              />
            ))}
          </div>
        </>
```

- [ ] **Step 4: Add the checkbox to `ReviewCard`**

Change the signature to `function ReviewCard({ review, selected, onToggle, onDone })` and put the checkbox at the front of the existing `title` element:

```jsx
      title={
        <span className="flex flex-wrap items-center gap-2">
          <SelectCell checked={selected} onChange={onToggle} />
          <span className="tabular-nums text-[15px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
          <span>{title}</span>
        </span>
      }
```

- [ ] **Step 5: Verify by hand**

Open `/admin/reviews`. Select two pending reviews, `Зөвшөөрөх`, confirm — both flip to `нийтлэгдсэн`. Then switch the filter from Хүлээгдэж буй to Бүгд while rows are selected and confirm the count adjusts rather than keeping hidden rows armed.

- [ ] **Step 6: Lint and commit**

```bash
npx eslint app/admin/reviews/page.js
git add app/admin/reviews/page.js
git commit -m "feat(admin): bulk moderation on the reviews list"
```

---

### Task 10: Discount bulk actions

**Files:**
- Modify: `app/admin/discounts/page.js:99` and the component around it

**Interfaces:**
- Consumes: `useSelection` (Task 4), `DataTable` selection props (Task 5), discount bulk mutations (Task 7).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Extend imports**

```js
import { ADMIN_BULK_DELETE_DISCOUNTS, ADMIN_BULK_SET_DISCOUNT_ACTIVE, ADMIN_DISCOUNTS, ADMIN_UPSERT_DISCOUNT } from '@/lib/queries'
import { useSelection } from '@/components/admin/selection'
```

- [ ] **Step 2: Wire selection**

Inside the page component, after `codes` is derived, add:

```js
  const sel = useSelection(codes)
  const [setActive] = useMutation(ADMIN_BULK_SET_DISCOUNT_ACTIVE)
  const [bulkDelete] = useMutation(ADMIN_BULK_DELETE_DISCOUNTS)
  const [bulkError, setBulkError] = useState(null)

  const run = async (confirmText, fn) => {
    if (!window.confirm(confirmText)) return
    setBulkError(null)
    try {
      await fn(sel.ids)
      sel.clear()
      await refetch()
    } catch (e) {
      setBulkError(e?.message ?? 'Үйлдэл амжилтгүй боллоо.')
    }
  }

  const n = sel.count
  const bulkActions = [
    { key: 'on', label: 'Идэвхжүүлэх',
      run: () => run(`${n} кодыг идэвхжүүлэх үү?`,
        (ids) => setActive({ variables: { discountIds: ids, isActive: true } })) },
    { key: 'off', label: 'Идэвхгүй болгох',
      run: () => run(`${n} кодыг идэвхгүй болгох уу?`,
        (ids) => setActive({ variables: { discountIds: ids, isActive: false } })) },
    { key: 'delete', label: 'Устгах', tone: 'danger', separatorBefore: true,
      run: () => run(`${n} кодыг устгах уу? Буцаах боломжгүй.`,
        (ids) => bulkDelete({ variables: { discountIds: ids } })) },
  ]
```

If the page's `useQuery` result does not already destructure `refetch`, add it.

- [ ] **Step 3: Pass to the table**

```jsx
        <DataTable columns={columns} rows={codes} selection={sel} bulkActions={bulkActions} />
```

Add the same `bulkError` paragraph above it as in Task 8 Step 3.

- [ ] **Step 4: Verify, lint, commit**

Open `/admin/discounts`, select two codes, deactivate, confirm both flip.

```bash
npx eslint app/admin/discounts/page.js
git add app/admin/discounts/page.js
git commit -m "feat(admin): bulk actions on discount codes"
```

---

### Task 11: Order bulk status via the loop path

**Files:**
- Modify: `app/admin/page.js`

**Interfaces:**
- Consumes: `runBulk` (Task 3), `BulkResult` (Task 6), `useSelection` (Task 4), `DataTable` selection props (Task 5), the **existing** `ADMIN_SET_ORDER_STATUS` mutation at `lib/queries.js:548`.
- Produces: nothing later tasks depend on.

**Why this one is different:** `admin_set_order_status` refuses `packed`/`shipped`/`delivered` unless payment is confirmed, and refuses `cancelled` outright. There is no bulk SQL function for orders on purpose. `cancelled` is absent from the menu because it can only ever fail.

- [ ] **Step 1: Extend imports**

```js
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_ALL_ORDERS, ADMIN_PENDING, ADMIN_SET_ORDER_STATUS } from '@/lib/queries'
import { useSelection } from '@/components/admin/selection'
import BulkResult from '@/components/admin/BulkResult'
import { runBulk } from '@/lib/admin/bulk'
```

- [ ] **Step 2: Wire the loop**

First add `refetch` to the page's existing orders query — it currently
destructures only `data` and `loading`:

```js
  const { data, loading, refetch } = useQuery(ADMIN_ALL_ORDERS, {
    variables: { first: 100 },
    fetchPolicy: 'cache-and-network',
  })
```

Do **not** add a second `useQuery` for the same document — that would fire a
duplicate request and hold a separate cache entry. Then, after
`const orders = useMemo(...)`, add:

```js
  const sel = useSelection(orders)
  const [setOrderStatus] = useMutation(ADMIN_SET_ORDER_STATUS)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  // Orders cannot use a set-based SQL function: admin_set_order_status has
  // per-row guards, so some rows must fail while the rest succeed. Each
  // success also emails the customer — hence the count in the confirm.
  const runOrders = async (status, label) => {
    if (!window.confirm(
      `${sel.count} захиалгын төлөвийг "${label}" болгох уу?\n\nАмжилттай болсон бүрд хэрэглэгчид имэйл илгээнэ.`
    )) return

    setRunning(true)
    setResult(null)
    const ids = sel.ids
    const res = await runBulk(ids, (orderId) =>
      setOrderStatus({ variables: { orderId, status, trackingNumber: null, internalNote: null } }))
    setRunning(false)
    setResult(res)
    if (res.ok.length > 0) sel.clear()
    await refetch()
  }

  const byId = useMemo(
    () => Object.fromEntries(orders.map((o) => [o.id, o.orderNumber])),
    [orders])

  const bulkActions = [
    { key: 'paid', label: 'Төлөгдсөн', run: () => runOrders('paid', 'Төлөгдсөн') },
    { key: 'packed', label: 'Бэлтгэсэн', run: () => runOrders('packed', 'Бэлтгэсэн') },
    { key: 'shipped', label: 'Илгээсэн', run: () => runOrders('shipped', 'Илгээсэн') },
    { key: 'delivered', label: 'Хүргэгдсэн', run: () => runOrders('delivered', 'Хүргэгдсэн') },
  ]
```

**Check the variable names** against `ADMIN_SET_ORDER_STATUS` in `lib/queries.js:548` before running — if it declares fewer variables than `orderId`/`status`/`trackingNumber`/`internalNote`, pass only what it declares.

- [ ] **Step 3: Render the result and pass selection**

Above `<DataTable`, add:

```jsx
      <BulkResult result={result} labelFor={(id) => byId[id] ?? id} onDismiss={() => setResult(null)} />
      {running && <p className="mb-3 text-[13px] text-a-muted">Гүйцэтгэж байна…</p>}
```

And extend the table call with `selection={sel}` and `bulkActions={bulkActions}`.

- [ ] **Step 4: Verify the partial-failure path by hand**

This is the assertion that matters most in the whole plan. On `/admin`:

1. Select a mix — at least one order with payment `Төлөгдөөгүй` and one `Баталгаажсан`.
2. Choose `Илгээсэн`, confirm.
3. Expected: the report reads `1 амжилттай · 1 алдаа`, and expanding it names the unpaid order by **order number** with the message `cannot mark shipped before payment is confirmed`.
4. The paid order's row shows `Илгээсэн`; the unpaid one is unchanged.

If the batch aborts on the first failure instead, `runBulk` is not being awaited correctly — go back to Task 3.

- [ ] **Step 5: Lint, build, full test run**

```bash
npx eslint app/admin/page.js
npx next build
npm run test:unit
npm run test:db
```

Expected: all clean, `all database tests passed`.

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.js
git commit -m "feat(admin): bulk order status with per-row failure reporting"
```

---

## Done when

- Every admin table has checkboxes; the product, review and discount actions apply in one round trip.
- Orders report partial success by order number.
- Filtering a list drops hidden rows from the selection.
- `npm run test:unit` and `npm run test:db` pass; `npx next build` succeeds; `npx eslint .` is clean.
- Track B (`docs/superpowers/plans/2026-09-07-admin-product-editor.md`) can start on top of this.
