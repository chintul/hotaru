# Admin Variant Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a way to see and set which photograph belongs to which variant, on a single product editor page with no tabs.

**Architecture:** A migration adds `image_id` to `admin_upsert_variant` (dropped and recreated, not overloaded) and a new `admin_set_variant_image` for assigning and clearing. The four editor tabs collapse into one scrolling page holding two cards: a merged details+SEO form over its one mutation, and a variant-led media card where the image is the first column of each variant row and a popover assigns or uploads it. All linkage rules live in a pure `lib/admin/images.js` so `node --test` can reach them.

**Tech Stack:** Next.js 16.3.4 (app router), React 19.2.8, Apollo Client 4, pg_graphql over Supabase Postgres, ImageKit (`@imagekit/next`), Tailwind 4. Tests: `node --test` for pure JS, psql suites against a throwaway Postgres via `scripts/test-db.sh`.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-variant-images-design.md`

## Global Constraints

- **Read the bundled Next.js docs before writing app-router code.** This project pins `next@16.3.4` and `AGENTS.md` states its APIs may differ from training data. The docs live at `node_modules/next/dist/docs/01-app/`.
- **Trunk only.** Commit directly to `main`. Never create a branch, never open a PR, never use a worktree.
- **There is no DOM test harness in this repo.** `tests/unit/*.test.js` are pure `node --test` files; nothing renders React. Push every rule that can live in `lib/admin/` there so it is actually tested. UI tasks verify with `npm run lint`, `npm run build`, and the explicit manual checks written into each task.
- **All UI copy is Mongolian.** Match the existing admin voice: `Хадгалах`, `Устгах`, `Болих`, `Сонголт`, `Зураг`.
- **Money is whole tugrik and arrives as a String.** pg_graphql maps `bigint` to a String scalar, so every `*_mnt` value is `"189000"`, not `189000`. Use `toNumber` from `lib/format.js` before arithmetic. Never divide by 100.
- **Every admin SQL function** is `volatile`, `language plpgsql`, `security definer`, `set search_path = public, pg_temp`, and raises `42501` from an `is_admin()` guard as its first statement. Every new function must be added to a `revoke execute ... from public, anon` **and** a `grant execute ... to authenticated` block — Postgres grants EXECUTE to PUBLIC on creation and anon inherits PUBLIC. `tests/sql/02_guards.sql:78-86` fails otherwise.
- **Admin palette tokens** are `a-bg a-ink a-muted a-line a-hover a-focus` (`app/globals.css:44-52`). The soft tints `--color-mint`, `--color-blush` already exist (`app/globals.css:35-40`); do not add new colour tokens.
- **`AdminShell` has a sticky top bar** of `h-[52px]` at `z-20` (`components/admin/AdminShell.jsx:139`). Anything else that sticks must use `top-[52px]` and a `z` below 20.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260907140000_variant_images.sql` | Create: `admin_upsert_variant` recreated with `image_id`; new `admin_set_variant_image` |
| `tests/sql/08_variant_images.sql` | Create: guards, cross-product rejection, coalesce-vs-clear, delete cascade |
| `lib/admin/images.js` | Create: pure linkage rules — `variantLabel`, `linkage`, `orphansOf` |
| `tests/unit/images.test.js` | Create: unit tests for the above |
| `components/admin/ui.jsx` | Modify: add `Popover` and `Thumb`; `Card` gains `stickyHeader`; `BulkBar` refactored onto `Popover` |
| `lib/queries.js` | Modify: `variant.image` in the detail query, `imageId` on the upsert, new `ADMIN_SET_VARIANT_IMAGE` |
| `components/admin/product/ProductForm.jsx` | Create: details + SEO, one form, one mutation |
| `components/admin/product/ImagePicker.jsx` | Create: the popover — pick, clear, upload-and-assign |
| `components/admin/product/VariantRow.jsx` | Create: one editable variant row with its thumbnail |
| `components/admin/product/MediaVariants.jsx` | Create: the merged card — rows, gallery strip, both add buttons |
| `app/admin/products/[id]/page.js` | Modify: tabs removed, two cards stacked |
| `components/admin/product/DetailsTab.jsx` | Delete (Task 5) |
| `components/admin/product/SeoTab.jsx` | Delete (Task 5) |
| `components/admin/product/VariantsTab.jsx` | Delete (Task 7) |
| `components/admin/product/ImagesTab.jsx` | Delete (Task 7) |

---

### Task 1: The migration and its SQL tests

**Files:**
- Create: `supabase/migrations/20260907140000_variant_images.sql`
- Create: `tests/sql/08_variant_images.sql`

**Interfaces:**
- Consumes: `public.is_admin()`, `public.variants`, `public.product_images`, the `variants_refresh_product` trigger (`20260904120200_functions.sql:89`) which already recalculates derived product fields — neither new function calls `refresh_product_derived` itself, and neither should.
- Produces:
  - `admin_upsert_variant(product_id uuid, price_mnt bigint, quantity int, sku text, option_label text, option_value text, compare_at_price_mnt bigint, allow_backorder boolean, is_active boolean, sort_order int, variant_id uuid, image_id uuid) returns public.variants` — reflected as `adminUpsertVariant`
  - `admin_set_variant_image(variant_id uuid, image_id uuid) returns public.variants` — reflected as `adminSetVariantImage`

- [ ] **Step 1: Write the failing SQL test**

Create `tests/sql/08_variant_images.sql`:

```sql
\set ON_ERROR_STOP on
\echo '── admin: variant images ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

-- The fixtures give every test product one variant but no photographs
-- (tests/helpers/02_fixtures.sql:35-48), so this suite makes its own. Two for
-- test-mug and one for test-bottle: the cross-product guard needs an image that
-- provably belongs somewhere else.
--
-- Positions are literals, not `max(position)+1`. Every row of one INSERT sees
-- the same pre-statement snapshot, so a computed max collides on
-- `unique (product_id, position)` — the bug that cost
-- 20260905100000_variant_featured_images.sql an entire migration.
insert into public.product_images (product_id, imagekit_file_id, file_path, position)
select p.id, 'fid-mug-0', '/test/mug-0.jpg', 0 from public.products p where p.slug = 'test-mug'
union all
select p.id, 'fid-mug-1', '/test/mug-1.jpg', 1 from public.products p where p.slug = 'test-mug'
union all
select p.id, 'fid-bot-0', '/test/bottle-0.jpg', 0 from public.products p where p.slug = 'test-bottle';

create temp table t as
select
  (select v.id from public.variants v
     join public.products p on p.id = v.product_id where p.slug = 'test-mug')     as mug_variant,
  (select p.id from public.products p where p.slug = 'test-mug')                  as mug_product,
  (select id from public.product_images where file_path = '/test/mug-0.jpg')      as mug_img0,
  (select id from public.product_images where file_path = '/test/mug-1.jpg')      as mug_img1,
  (select id from public.product_images where file_path = '/test/bottle-0.jpg')   as bottle_img;

-- ---- admin_set_variant_image --------------------------------------------
select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         (select mug_variant from t), (select bottle_img from t)),
  '22023', 'an image from a different product is rejected');

select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'the rejected call changed nothing');

select public.admin_set_variant_image((select mug_variant from t), (select mug_img0 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img0 from t), 'set_variant_image points the variant at the photo');

select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         '00000000-0000-0000-0000-000000000000', (select mug_img0 from t)),
  'P0002', 'an unknown variant raises');

-- ---- admin_upsert_variant and the coalesce rule --------------------------
-- A null image_id means "this caller did not supply one", never "clear it".
-- The row editor sends price and stock without knowing the photo.
select public.admin_upsert_variant(
  product_id => (select mug_product from t),
  price_mnt  => 128000,
  quantity   => 12,
  variant_id => (select mug_variant from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img0 from t), 'a null image_id on upsert leaves the stored photo alone');

select public.admin_upsert_variant(
  product_id => (select mug_product from t),
  price_mnt  => 128000,
  quantity   => 12,
  variant_id => (select mug_variant from t),
  image_id   => (select mug_img1 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img1 from t), 'a supplied image_id on upsert replaces the photo');

select test.raises(
  format($$select public.admin_upsert_variant(product_id => %L, price_mnt => 1000, quantity => 1, variant_id => %L, image_id => %L)$$,
         (select mug_product from t), (select mug_variant from t), (select bottle_img from t)),
  '22023', 'upsert rejects an image from a different product');

-- Insert path: a brand new variant can arrive with its photo already chosen.
select test.eq(
  (select image_id from public.admin_upsert_variant(
     product_id   => (select mug_product from t),
     price_mnt    => 99000,
     quantity     => 3,
     sku          => 'TEST-MUG-IMG',
     option_value => 'Cherry',
     image_id     => (select mug_img0 from t))),
  (select mug_img0 from t), 'a new variant can be created with an image');

-- ---- clearing, which only set_variant_image can do -----------------------
select public.admin_set_variant_image((select mug_variant from t), null);
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'a null image_id on set_variant_image clears the link');

-- ---- deleting a photo empties the variants pointing at it ----------------
select public.admin_set_variant_image((select mug_variant from t), (select mug_img1 from t));
select public.admin_delete_product_image((select mug_img1 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'deleting an image nulls image_id on the variants using it');
select test.eq(
  (select quantity from public.variants where id = (select mug_variant from t)),
  12, 'and leaves the rest of the variant row intact');

-- ---- the admin guard ------------------------------------------------------
select test.as_user('11111111-1111-1111-1111-111111111111', false);  -- a customer
select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         (select mug_variant from t), (select mug_img0 from t)),
  '42501', 'a non-admin cannot set a variant image');
select test.raises(
  format($$select public.admin_upsert_variant(product_id => %L, price_mnt => 1, quantity => 1)$$,
         (select mug_product from t)),
  '42501', 'a non-admin cannot upsert a variant');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npm run test:db`

Expected: `FAIL  08_variant_images.sql`. The first failure is the named-argument call `image_id => …`, which the current 11-parameter `admin_upsert_variant` does not accept.

Requires Docker. If it is not running, start Docker Desktop first — `scripts/test-db.sh` spins up `postgres:16-alpine` on port 55434 and tears it down on exit.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260907140000_variant_images.sql`:

```sql
-- ============================================================================
-- hotaru — the variant → image link reaches the admin
-- ============================================================================
-- variants.image_id (20260904120100_tables.sql:167) is what the storefront
-- actually renders: ProductCard.jsx:35 reads `variant?.image ?? images[0]` for
-- the card photo, and ProductCard.jsx:41-49 walks the variant list for the
-- hover photo. Nothing in the admin could ever write it — admin_upsert_variant
-- had no image_id parameter — so the column was only ever set by hand-written
-- SQL, which took three migrations (20260905060000, ...100000, ...110000) and
-- two bugfixes to get right.
--
-- The old signature is DROPPED, not replaced. Adding a parameter creates an
-- overload rather than replacing the function, and two overloads of one name
-- make pg_graphql's reflection ambiguous — the lesson of
-- 20260907130000_product_seo_copy.sql:9-12. The drop also discards the
-- function's grants, so both halves are restored at the bottom.
--
-- No refresh_product_derived call in either function: the
-- `variants_refresh_product` trigger (20260904120200_functions.sql:89) already
-- fires on every insert, update and delete.
-- ============================================================================

drop function if exists public.admin_upsert_variant(
  uuid, bigint, int, text, text, text, bigint, boolean, boolean, int, uuid);

create function public.admin_upsert_variant(
  product_id uuid,
  price_mnt bigint,
  quantity int,
  sku text default null,
  option_label text default null,
  option_value text default null,
  compare_at_price_mnt bigint default null,
  allow_backorder boolean default false,
  is_active boolean default true,
  sort_order int default 0,
  variant_id uuid default null,
  image_id uuid default null
) returns public.variants
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_variant public.variants;
  v_product uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if admin_upsert_variant.price_mnt < 0 then
    raise exception 'price cannot be negative' using errcode = '22023';
  end if;

  -- On an update the row's own product is authoritative, not the argument: a
  -- caller editing a variant should not be able to re-parent it by accident.
  select v.product_id into v_product from public.variants v
   where v.id = admin_upsert_variant.variant_id;
  v_product := coalesce(v_product, admin_upsert_variant.product_id);

  -- A photograph from another product would point one product's card at
  -- another's picture, silently, and only the storefront would show it.
  if admin_upsert_variant.image_id is not null and not exists (
    select 1 from public.product_images pi
     where pi.id = admin_upsert_variant.image_id
       and pi.product_id = v_product
  ) then
    raise exception 'image belongs to a different product' using errcode = '22023';
  end if;

  if admin_upsert_variant.variant_id is not null then
    update public.variants v set
      sku = nullif(admin_upsert_variant.sku, '')::citext,
      option_label = nullif(admin_upsert_variant.option_label, ''),
      option_value = nullif(admin_upsert_variant.option_value, ''),
      price_mnt = admin_upsert_variant.price_mnt,
      compare_at_price_mnt = admin_upsert_variant.compare_at_price_mnt,
      quantity = admin_upsert_variant.quantity,
      allow_backorder = admin_upsert_variant.allow_backorder,
      is_active = admin_upsert_variant.is_active,
      position = admin_upsert_variant.sort_order,
      -- null means "not supplied by this caller", never "clear it". The row
      -- editor saves a price without knowing the photo. Clearing is
      -- admin_set_variant_image(id, null), which exists for exactly this.
      image_id = coalesce(admin_upsert_variant.image_id, v.image_id)
    where v.id = admin_upsert_variant.variant_id
    returning * into v_variant;
    if not found then
      raise exception 'variant not found' using errcode = 'P0002';
    end if;
  else
    insert into public.variants
      (product_id, sku, option_label, option_value, price_mnt, compare_at_price_mnt,
       quantity, allow_backorder, is_active, position, image_id)
    values (
      admin_upsert_variant.product_id,
      nullif(admin_upsert_variant.sku, '')::citext,
      nullif(admin_upsert_variant.option_label, ''),
      nullif(admin_upsert_variant.option_value, ''),
      admin_upsert_variant.price_mnt,
      admin_upsert_variant.compare_at_price_mnt,
      admin_upsert_variant.quantity,
      admin_upsert_variant.allow_backorder,
      admin_upsert_variant.is_active,
      admin_upsert_variant.sort_order,
      admin_upsert_variant.image_id
    )
    returning * into v_variant;
  end if;

  return v_variant;
end;
$$;

-- The one-click path, and the only way to CLEAR a link: the upsert coalesces a
-- null image_id to the stored value on purpose, so it can never blank a photo.
create function public.admin_set_variant_image(variant_id uuid, image_id uuid)
returns public.variants
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_variant public.variants;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_variant from public.variants v
   where v.id = admin_set_variant_image.variant_id;
  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;

  if admin_set_variant_image.image_id is not null and not exists (
    select 1 from public.product_images pi
     where pi.id = admin_set_variant_image.image_id
       and pi.product_id = v_variant.product_id
  ) then
    raise exception 'image belongs to a different product' using errcode = '22023';
  end if;

  update public.variants v
     set image_id = admin_set_variant_image.image_id
   where v.id = admin_set_variant_image.variant_id
  returning * into v_variant;

  return v_variant;
end;
$$;

-- Dropping the old signature threw away its grants, and both functions arrive
-- with EXECUTE granted to PUBLIC (which anon inherits). Both halves have to be
-- restored or tests/sql/02_guards.sql:78-86 fails — it asserts that no
-- unreviewed SECURITY DEFINER function is anon-executable.
revoke execute on function
  public.admin_upsert_variant(uuid, bigint, int, text, text, text, bigint, boolean, boolean, int, uuid, uuid),
  public.admin_set_variant_image(uuid, uuid)
from public, anon;

grant execute on function
  public.admin_upsert_variant(uuid, bigint, int, text, text, text, bigint, boolean, boolean, int, uuid, uuid),
  public.admin_set_variant_image(uuid, uuid)
to authenticated;

comment on function public.admin_upsert_variant is
  'Creates or updates a variant. A null image_id leaves the stored photo untouched; clearing one is admin_set_variant_image.';
comment on function public.admin_set_variant_image is
  'Points a variant at one of its own product''s images. A null image_id clears the link.';
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm run test:db`

Expected: `PASS  08_variant_images.sql`, and every other suite still passing — in particular `PASS  02_guards.sql`, which is the test that catches a missing `revoke`, and `PASS  03_admin_catalog.sql`, which calls the old `admin_upsert_variant` signature positionally and must still work now that a twelfth defaulted parameter exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907140000_variant_images.sql tests/sql/08_variant_images.sql
git commit -m "feat(admin): variant image reaches the write path

admin_upsert_variant gains image_id and admin_set_variant_image is added,
so variants.image_id stops being a column only hand-written SQL can set.
Both reject an image belonging to a different product.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 2: Pure linkage rules

**Files:**
- Create: `lib/admin/images.js`
- Create: `tests/unit/images.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `variantLabel(variant) -> string`
  - `linkage(variants) -> { usage: Record<string, string[]>, positionStillRules: boolean }`
  - `orphansOf(imageId, variants) -> string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/images.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linkage, orphansOf, variantLabel } from '../../lib/admin/images.js'

test('variantLabel falls back through optionValue, sku, then a placeholder', () => {
  assert.equal(variantLabel({ optionValue: 'Cherry Jam', sku: 'HTR-1' }), 'Cherry Jam')
  assert.equal(variantLabel({ optionValue: null, sku: 'HTR-1' }), 'HTR-1')
  assert.equal(variantLabel({ optionValue: null, sku: null }), 'Нэргүй сонголт')
  assert.equal(variantLabel(null), 'Нэргүй сонголт')
})

test('linkage maps each image to the variants using it, in variant order', () => {
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i2' } },
  ]
  const { usage } = linkage(variants)
  assert.deepEqual(usage, { i1: ['Cherry'], i2: ['Cream'] })
})

test('linkage reports a shared image under both variants', () => {
  // Two variants on one photo is legal, but ProductCard.jsx:41-49 then hunts
  // for a *different* photo for the hover — and if none differs, hover dies.
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i1' } },
  ]
  const { usage } = linkage(variants)
  assert.deepEqual(usage.i1, ['Cherry', 'Cream'])
})

test('an image no variant points at simply has no usage entry', () => {
  // The gallery strip labels these `галерей`; there is no separate list.
  const { usage } = linkage([{ id: 'v1', optionValue: 'Cherry', image: { id: 'i2' } }])
  assert.equal(usage.i1, undefined)
  assert.equal(usage.i3, undefined)
  assert.deepEqual(usage.i2, ['Cherry'])
})

test('positionStillRules is true only when no variant carries an image', () => {
  assert.equal(linkage([{ id: 'v1', optionValue: 'Cherry', image: null }]).positionStillRules, true)
  assert.equal(linkage([]).positionStillRules, true)
  assert.equal(
    linkage([{ id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } }]).positionStillRules,
    false,
  )
})

test('linkage handles an empty product without throwing', () => {
  assert.deepEqual(linkage(), { usage: {}, positionStillRules: true })
  assert.deepEqual(linkage([]), { usage: {}, positionStillRules: true })
})

test('orphansOf names every variant that would lose its photo', () => {
  const variants = [
    { id: 'v1', optionValue: 'Cherry', image: { id: 'i1' } },
    { id: 'v2', optionValue: 'Cream', image: { id: 'i1' } },
    { id: 'v3', optionValue: 'Berry', image: { id: 'i2' } },
    { id: 'v4', optionValue: 'Plain', image: null },
  ]
  assert.deepEqual(orphansOf('i1', variants), ['Cherry', 'Cream'])
  assert.deepEqual(orphansOf('i2', variants), ['Berry'])
  assert.deepEqual(orphansOf('i9', variants), [])
  assert.deepEqual(orphansOf('i1'), [])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/unit/images.test.js`
Expected: FAIL — `Cannot find module '.../lib/admin/images.js'`

- [ ] **Step 3: Write the implementation**

Create `lib/admin/images.js`:

```js
/**
 * Which variant uses which photograph.
 *
 * Kept free of React so `node --test` can reach it: this repo has no DOM test
 * harness, so every rule that can live here instead of inside a component does.
 *
 * The rule these encode: `variants.image_id` decides the card and hover photos
 * whenever ANY variant carries one (ProductCard.jsx:35 and :41-49). Position
 * decides them only when none does — which is why `ImagesTab.jsx:145`'s
 * `карт / hover / 2 / 3` labels were wrong the moment a variant got a picture.
 */

/** optionValue is nullable, and a product may have one unnamed variant. */
export function variantLabel(variant) {
  return variant?.optionValue || variant?.sku || 'Нэргүй сонголт'
}

export function linkage(variants = []) {
  const usage = {}
  for (const v of variants) {
    const id = v?.image?.id
    if (!id) continue
    if (!usage[id]) usage[id] = []
    usage[id].push(variantLabel(v))
  }
  // An image with no entry in `usage` is a gallery shot. There is no separate
  // list of them: the strip renders every image and labels it from this map.
  return { usage, positionStillRules: Object.keys(usage).length === 0 }
}

/** Labels of the variants that would be left photoless by deleting this image. */
export function orphansOf(imageId, variants = []) {
  return variants.filter((v) => v?.image?.id === imageId).map(variantLabel)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:unit`
Expected: PASS for `images.test.js`, and every pre-existing unit suite still green.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/images.js tests/unit/images.test.js
git commit -m "feat(admin): pure variant-to-image linkage rules

Which variant uses which photo, which photos nothing uses, and whether
position still decides the card and hover slots. Kept out of React so
node --test can reach it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 3: `Popover`, `Thumb`, and a sticky card header

**Files:**
- Modify: `components/admin/ui.jsx:16` (`Card`), `components/admin/ui.jsx:113-126` (`BulkBar`), and append the two new primitives

**Interfaces:**
- Consumes: `ProductImage` from `@/components/ProductImage`, `ImageIcon` from `./icons`.
- Produces:
  - `<Popover open onClose className>{children}</Popover>` — absolutely positioned; the caller supplies a `relative` parent
  - `<Thumb filePath alt count onClick title />` — 44px square button
  - `Card` gains `stickyHeader` (default `false`, output unchanged when omitted)

- [ ] **Step 1: Add `stickyHeader` to `Card`**

Replace the `Card` function at `components/admin/ui.jsx:16-34` with:

```jsx
export function Card({ title, subtitle, actions, children, padded = true, className = '', stickyHeader = false }) {
  return (
    <section className={`rounded-xl border border-a-line bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] ${className}`}>
      {(title || actions) && (
        // AdminShell's own bar is h-[52px] at z-20 (AdminShell.jsx:139), so a
        // sticky card header parks directly under it and stays below it.
        <header
          className={`flex items-start justify-between gap-3 px-6 py-4 ${
            stickyHeader ? 'sticky top-[52px] z-10 rounded-t-xl border-b border-a-line bg-white/95 backdrop-blur' : ''
          }`}
        >
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-a-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-a-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {children != null && (
        <div className={(title || actions) && !stickyHeader ? 'border-t border-a-line' : ''}>
          <div className={padded ? 'px-6 py-4' : ''}>{children}</div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Add `Popover` and `Thumb`**

Add the import at the top of `components/admin/ui.jsx`, next to the existing `./icons` import:

```jsx
import { Copy as CopyIcon, Dots, ImageIcon, Search as SearchIcon } from './icons'
import ProductImage from '@/components/ProductImage'
```

Append both primitives to the end of `components/admin/ui.jsx`:

```jsx
/* -------------------------------- overlays -------------------------------- */

/**
 * Anchored popover with click-outside and Escape dismissal.
 *
 * The caller supplies a `relative` parent; this positions itself under it.
 * `onClose` is held in a ref rather than listed as an effect dependency, so an
 * inline arrow from the caller does not re-subscribe the listeners every render.
 */
export function Popover({ open, onClose, children, className = '' }) {
  const ref = useRef(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close.current() }
    const onEsc = (e) => { if (e.key === 'Escape') close.current() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (!open) return null
  return (
    <div
      ref={ref}
      className={`absolute z-10 mt-1 rounded-xl border border-a-line bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,.10)] ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * A variant's photograph, or a dashed square when it has none.
 *
 * `count` marks a photo more than one variant points at. That is legal, but
 * ProductCard.jsx:41-49 then hunts forward for a *different* picture to show on
 * hover, and if none differs the hover renders dead — so the badge puts the
 * cause where it can be fixed.
 */
export function Thumb({ filePath, alt = '', count = 1, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-a-line bg-a-hover transition-colors hover:border-a-focus"
    >
      {filePath ? (
        <ProductImage filePath={filePath} alt={alt} seed={filePath} width={44} height={44} />
      ) : (
        <span className="grid h-full w-full place-items-center rounded-xl border border-dashed border-a-line text-a-muted">
          <ImageIcon />
        </span>
      )}
      {count > 1 && (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-a-ink text-[10px] font-medium text-white">
          {count}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 3: Refactor `BulkBar` onto `Popover`**

`BulkBar` (`components/admin/ui.jsx:113-126`) holds this dismiss logic inline. Delete its `useEffect` and its outer `ref`, and render its dropdown body inside `<Popover open={open} onClose={() => { setOpen(false); setPopover(null) }}>`. The behaviour must be identical: clicking outside or pressing Escape closes both the menu and any open sub-popover.

This is the reason `Popover` is a shared primitive rather than a second copy — the image picker is the second caller, and a third copy is how two dismissal behaviours drift apart.

- [ ] **Step 4: Verify nothing regressed**

Run: `npm run lint && npm run build`
Expected: both clean.

Then `npm run dev` and check `/admin/products`: select two rows, open `Үйлдэл ▾`, click outside — the menu closes. Reopen it, choose `Ангилал`, press Escape — both the sub-popover and the menu close. Every existing `Card` on `/admin` and `/admin/discounts` renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add components/admin/ui.jsx
git commit -m "refactor(admin): share the popover, add Thumb and a sticky header

BulkBar's click-outside and Escape handling becomes a Popover primitive
the variant image picker also needs. Card gains an opt-in sticky header
that parks under AdminShell's 52px bar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 4: GraphQL wiring

**Files:**
- Modify: `lib/queries.js:570-582` (`ADMIN_UPSERT_VARIANT`), `lib/queries.js:828` (`ADMIN_PRODUCT_DETAIL`), and append `ADMIN_SET_VARIANT_IMAGE`

**Interfaces:**
- Consumes: `adminUpsertVariant` and `adminSetVariantImage` from Task 1.
- Produces:
  - `ADMIN_PRODUCT_DETAIL` variant nodes now carry `allowBackorder`, `position` and `image { id filePath alt }`
  - `ADMIN_UPSERT_VARIANT` accepts `$imageId: UUID`
  - `ADMIN_SET_VARIANT_IMAGE` with variables `{ variantId: UUID!, imageId: UUID }`

- [ ] **Step 1: Add `image` to the detail query**

At `lib/queries.js:828-830`, replace the variant selection with:

```graphql
          variantCollection(first: 50, orderBy: [{ position: AscNullsLast }]) {
            edges { node {
              id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity isActive
              allowBackorder position
              image { id filePath alt }
            } }
          }
```

`position` is **not optional here.** `admin_upsert_variant` assigns
`position = sort_order` on every update, and the query only ever ordered by the
field without selecting it. A row editor that sends `sortOrder: 0` — which
`VariantsTab.jsx:143` does today for creates — would silently collapse every
edited variant to position 0 and scramble the order the storefront renders
swatches in. Task 7's row editor sends `variant.position` back.

`allowBackorder` is missing for the same reason. `admin_upsert_variant` **assigns**
rather than coalesces every column except `image_id`, and `allow_backorder`
defaults to `false` — so a row editor that omits it silently turns backorder off
on any variant it saves. The rule for Task 7: every column the upsert assigns
must be round-tripped, whether or not the row editor lets you change it.

`image` already exists on the `Variant` type — `PRODUCT_CARD` selects `image { filePath alt }` at `lib/queries.js:28`. Only the admin query never asked for it.

- [ ] **Step 2: Add `imageId` to the upsert and add the new mutation**

Replace `ADMIN_UPSERT_VARIANT` at `lib/queries.js:570-582`:

```js
export const ADMIN_UPSERT_VARIANT = gql`
  mutation AdminUpsertVariant(
    $productId: UUID!, $priceMnt: BigInt!, $quantity: Int!, $sku: String,
    $optionLabel: String, $optionValue: String, $compareAtPriceMnt: BigInt,
    $allowBackorder: Boolean, $isActive: Boolean, $sortOrder: Int, $variantId: UUID,
    $imageId: UUID
  ) {
    adminUpsertVariant(
      productId: $productId, priceMnt: $priceMnt, quantity: $quantity, sku: $sku,
      optionLabel: $optionLabel, optionValue: $optionValue, compareAtPriceMnt: $compareAtPriceMnt,
      allowBackorder: $allowBackorder, isActive: $isActive, sortOrder: $sortOrder, variantId: $variantId,
      imageId: $imageId
    ) { id sku optionValue priceMnt quantity isActive image { id filePath alt } }
  }
`

// Separate from the upsert because the upsert coalesces a null imageId to the
// stored value — deliberately, so the row editor cannot blank a photo it never
// sent. This is therefore the only way to CLEAR a link: pass a null imageId.
export const ADMIN_SET_VARIANT_IMAGE = gql`
  mutation AdminSetVariantImage($variantId: UUID!, $imageId: UUID) {
    adminSetVariantImage(variantId: $variantId, imageId: $imageId) {
      id image { id filePath alt }
    }
  }
`
```

- [ ] **Step 3: Verify the queries match the reflected schema**

Run: `npm run lint && npm run build`
Expected: both clean.

Then `npm run dev`, open any product at `/admin/products/<id>`, and confirm in the browser devtools Network tab that the `AdminProductDetail` response carries `image` on each variant node and returns no `errors` array. A field pg_graphql does not reflect fails the whole query — a silent `null` product on the page is the symptom.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.js
git commit -m "feat(admin): fetch and write variant.image over graphql

The admin detail query never selected variant.image, so the editor could
not display the link it is about to let you set.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 5: One form for details and SEO, and a page with no tabs

**Files:**
- Create: `components/admin/product/ProductForm.jsx`
- Modify: `app/admin/products/[id]/page.js` (whole file)
- Modify: `app/admin/products/new/page.js:74`
- Delete: `components/admin/product/DetailsTab.jsx`, `components/admin/product/SeoTab.jsx`

**Interfaces:**
- Consumes: `ADMIN_UPSERT_PRODUCT`, `Card` with `stickyHeader` from Task 3.
- Produces: `<ProductForm product categories refetch />`. The page after this task stacks `ProductForm`, then the still-unmodified `VariantsTab` and `ImagesTab`; Task 7 replaces those two with one card.

- [ ] **Step 1: Read the Next.js docs on the hooks this page uses**

Run: `sed -n '70,80p' node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md`

The finding that matters: **keep the `Suspense` boundary.** It exists today only because of `useSearchParams`, and dropping `?tab=` removes that hook — but `use-params.md:73-76` states that with `cacheComponents` enabled, `useParams` on a route without `generateStaticParams` suspends and the build fails without a boundary. `next.config.mjs` does not enable it today. Keeping the boundary costs one wrapper and removes a trap.

- [ ] **Step 2: Write `ProductForm.jsx`**

Create `components/admin/product/ProductForm.jsx`:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy, firstNode } from '@/lib/format'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/admin/ui'

/**
 * Details and SEO, in one form, over the one mutation they share.
 *
 * They used to be two tabs. `admin_upsert_product` upserts the translation row
 * as a whole, so the SEO tab had to re-send `description` read from the Apollo
 * cache (SeoTab.jsx:23-31) — and saving SEO after editing details clobbered the
 * description with a stale copy. One form has no second copy to go stale.
 *
 * No slug auto-fill here on purpose: an existing product's slug is a live URL,
 * and re-deriving it from an edited title would silently break links. That
 * belongs to the create form alone.
 */
export default function ProductForm({ product, categories, refetch }) {
  const c = copy(product)
  const initial = {
    slug: product.slug ?? '',
    title: c.title ?? '',
    subtitle: c.subtitle ?? '',
    description: c.description ?? '',
    careDetails: c.careDetails ?? '',
    categorySlug: product.category?.slug ?? '',
    status: product.status ?? 'draft',
    isFeatured: product.isFeatured ?? false,
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
  }

  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }

  // This is the only part of the editor that does not apply immediately, so
  // leaving it dirty is the only way to lose work here.
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await save({ variables: {
        productId: product.id,
        slug: f.slug.trim(),
        title: f.title.trim(),
        categorySlug: f.categorySlug || null,
        subtitle: f.subtitle || null,
        description: f.description || null,
        careDetails: f.careDetails || null,
        status: f.status,
        isFeatured: f.isFeatured,
        sortOrder: product.position ?? 0,
        seoTitle: f.seoTitle.trim() || null,
        seoDescription: f.seoDescription.trim() || null,
      } })
      setSaved(true)
      await refetch()
    } catch (err) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  // The preview reads live form state, not the cache, so it tracks what the
  // storefront will actually fall back to once this form is saved.
  const shownTitle = f.seoTitle || f.title || product.slug
  const shownDesc = f.seoDescription || f.description || ''

  return (
    <Card
      title="Мэдээлэл"
      stickyHeader
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-emerald-600">Хадгалсан</span>}
          {dirty && <span className="text-[12px] text-amber-600">Хадгалаагүй өөрчлөлт</span>}
          <Button form="product-form" type="submit" variant="primary" disabled={!dirty || loading}>
            {loading ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form id="product-form" className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
        <Field label="Нэр" required><Input required value={f.title} onChange={set('title')} /></Field>
        <Field label="Slug" required hint="URL дээр харагдана">
          <Input required value={f.slug} onChange={set('slug')} />
        </Field>
        <Field label="Дэд гарчиг"><Input value={f.subtitle} onChange={set('subtitle')} /></Field>
        <Field label="Ангилал">
          <Select value={f.categorySlug} onChange={set('categorySlug')}>
            <option value="">—</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Тайлбар"><Textarea rows={4} value={f.description} onChange={set('description')} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Арчилгаа"><Textarea rows={2} value={f.careDetails} onChange={set('careDetails')} /></Field>
        </div>
        <Field label="Төлөв">
          <Select value={f.status} onChange={set('status')}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input
            type="checkbox"
            checked={f.isFeatured}
            onChange={(e) => { setSaved(false); setF({ ...f, isFeatured: e.target.checked }) }}
            className="h-4 w-4 accent-black"
          />
          Онцлох
        </label>

        <div className="border-t border-a-line pt-4 sm:col-span-2">
          <h3 className="text-[13px] font-semibold text-a-ink">SEO</h3>
          <p className="mt-0.5 text-[12px] text-a-muted">Хоосон бол дээрх нэр, тайлбарыг ашиглана.</p>
        </div>
        <Field label="SEO гарчиг" hint={`${f.seoTitle.length}/60 тэмдэгт`}>
          <Input value={f.seoTitle} onChange={set('seoTitle')} />
        </Field>
        <Field label="SEO тайлбар" hint={`${f.seoDescription.length}/160 тэмдэгт`}>
          <Input value={f.seoDescription} onChange={set('seoDescription')} />
        </Field>
        <div className="rounded-lg border border-a-line bg-a-bg px-4 py-3 sm:col-span-2">
          <p className="mb-2 text-[12px] font-medium text-a-muted">Хайлтад ийм харагдана</p>
          <p className="truncate text-[16px] text-blue-800">{shownTitle}</p>
          <p className="text-[12px] text-emerald-700">hotaru.mn/shop/{product.slug}</p>
          <p className="line-clamp-2 text-[13px] text-a-muted">{shownDesc}</p>
        </div>

        {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Card>
  )
}
```

- [ ] **Step 3: Rewrite the page without tabs**

Replace the whole of `app/admin/products/[id]/page.js`:

```jsx
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_DETAIL } from '@/lib/queries'
import { copy, firstNode, nodes } from '@/lib/format'
import { Card, PageHeader, Status } from '@/components/admin/ui'
import ProductForm from '@/components/admin/product/ProductForm'
import VariantsTab from '@/components/admin/product/VariantsTab'
import ImagesTab from '@/components/admin/product/ImagesTab'

const STATUS_TONE = { active: 'green', draft: 'amber', archived: 'grey' }

export default function ProductEditorPage() {
  // The boundary no longer exists for useSearchParams — `?tab=` is gone — but
  // useParams suspends on a route without generateStaticParams once
  // cacheComponents is enabled (next docs, use-params.md:73-76). Keeping it is
  // one wrapper and removes a future build failure.
  return (
    <Suspense fallback={<p className="text-[13px] text-a-muted">Ачааллаж байна…</p>}>
      <Editor />
    </Suspense>
  )
}

function Editor() {
  const { id } = useParams()

  const { data, loading, refetch } = useQuery(ADMIN_PRODUCT_DETAIL, {
    variables: { productId: id },
    fetchPolicy: 'cache-and-network',
  })

  const product = firstNode(data?.productCollection)
  const categories = nodes(data?.categoryCollection)

  if (loading && !data) return <p className="text-[13px] text-a-muted">Ачааллаж байна…</p>

  if (!product) {
    return (
      <Card title="Бүтээгдэхүүн олдсонгүй">
        <Link href="/admin/products" className="text-[13px] underline">← Бараа руу буцах</Link>
      </Card>
    )
  }

  const shared = { product, refetch }

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-[13px] text-a-muted hover:text-a-ink">
        ← Бараа
      </Link>

      <PageHeader
        title={copy(product).title ?? product.slug}
        subtitle={product.slug}
        actions={<Status tone={STATUS_TONE[product.status] ?? 'grey'}>{product.status}</Status>}
      />

      <div className="space-y-4">
        <ProductForm {...shared} categories={categories} />
        <VariantsTab {...shared} />
        <ImagesTab {...shared} />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Drop the dead redirect target**

`app/admin/products/new/page.js:74` sends a freshly created product to
`/admin/products/${id}?tab=images`. There are no tabs any more, so the param is
noise that implies a feature that no longer exists:

```jsx
      router.replace(`/admin/products/${id}`)
```

- [ ] **Step 5: Delete the two replaced tabs**

```bash
git rm components/admin/product/DetailsTab.jsx components/admin/product/SeoTab.jsx
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run build`
Expected: both clean. A leftover import of `DetailsTab` or `SeoTab` fails the build, which is the check.

Then `npm run dev` and, at `/admin/products/<id>`:
- there are no tabs, and the page scrolls
- the `Мэдээлэл` header sticks below the admin bar while scrolling, and its Save button stays reachable
- **the clobber is gone:** edit the description, type an SEO title, save once, reload — both survive. On the old two-tab build, saving SEO after editing details reverted the description.
- editing a field shows `Хадгалаагүй өөрчлөлт`; navigating away then prompts
- `/admin/products/<id>?tab=images` still loads the page rather than erroring
- creating a product at `/admin/products/new` lands on `/admin/products/<id>` with no query string

- [ ] **Step 7: Commit**

```bash
git add -A components/admin/product app/admin/products
git commit -m "feat(admin): merge details and SEO, drop the editor tabs

Two forms over one adminUpsertProduct meant the SEO tab re-sent a cached
description and clobbered it. One form, one mutation, one scroll.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 6: The image picker

**Files:**
- Create: `components/admin/product/ImagePicker.jsx`

**Interfaces:**
- Consumes: `Popover` (Task 3), `ADMIN_ADD_IMAGE`, `ADMIN_SET_VARIANT_IMAGE` (Task 4).
- Produces: `<ImagePicker open onClose product variant images refetch />`. `variant` must carry `id`, `optionValue` and `image`. Renders nothing when `open` is false. Positions itself absolutely, so the caller supplies a `relative` parent.

- [ ] **Step 1: Write the picker**

Create `components/admin/product/ImagePicker.jsx`:

```jsx
'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_SET_VARIANT_IMAGE } from '@/lib/queries'
import ProductImage from '@/components/ProductImage'
import { Popover } from '@/components/admin/ui'
import { Check, Plus } from '@/components/admin/icons'

/**
 * Give one variant its photograph — pick an existing one, upload a new one, or
 * clear it.
 *
 * Uploading from here is the primary path on purpose: for this shop a variant
 * essentially IS a photo, and the real task is "a new colourway arrived, here
 * is its picture" — not "upload to the gallery, scroll back, then link".
 *
 * The chain is /api/upload-auth -> ImageKit -> adminAddProductImage ->
 * adminSetVariantImage. If that last step fails, the photo is in the gallery
 * and the variant is still empty: both visible, and re-linkable in one click.
 * The same recoverable direction the two-step upload already chose
 * (ImagesTab.jsx:12-19) — never a row pointing at nothing.
 */
export default function ImagePicker({ open, onClose, product, variant, images, refetch }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [setVariantImage] = useMutation(ADMIN_SET_VARIANT_IMAGE)

  const assign = async (imageId) => {
    setError(null)
    setBusy(true)
    try {
      await setVariantImage({ variables: { variantId: variant.id, imageId } })
      await refetch()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Алдаа гарлаа.')
    } finally {
      setBusy(false)
    }
  }

  const uploadAndAssign = async (file) => {
    setError(null)
    setBusy(true)
    try {
      const authRes = await fetch('/api/upload-auth')
      if (!authRes.ok) {
        throw new Error(authRes.status === 403
          ? 'Админ эрх шаардлагатай.'
          : 'Байршуулах эрх авахад алдаа гарлаа.')
      }
      const { token, signature, expire, publicKey } = await authRes.json()

      const result = await upload({
        file,
        fileName: `${product.slug}-${Date.now()}-${file.name}`,
        folder: `/hotaru/${product.slug}`,
        useUniqueFileName: true,
        publicKey,
        token,
        signature,
        expire,
      })

      const added = await addImage({ variables: {
        productId: product.id,
        imagekitFileId: result.fileId,
        filePath: result.filePath,
        // The colourway name is the only alt text anyone has; better than null.
        alt: variant.optionValue ?? null,
        width: result.width ?? null,
        height: result.height ?? null,
      } })

      const newId = added?.data?.adminAddProductImage?.id
      if (!newId) throw new Error('Зураг бүртгэгдсэнгүй.')
      await setVariantImage({ variables: { variantId: variant.id, imageId: newId } })

      await refetch()
      onClose()
    } catch (e) {
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Popover open={open} onClose={onClose} className="left-0 top-11 w-[268px]">
      <p className="px-1 pb-1.5 text-[12px] font-medium text-a-muted">Бүтээгдэхүүний зураг</p>

      {images.length === 0 && (
        <p className="px-1 pb-2 text-[12px] text-a-muted">Энэ бараанд зураг алга.</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {images.map((img) => {
          const chosen = variant.image?.id === img.id
          return (
            <button
              key={img.id}
              type="button"
              disabled={busy}
              onClick={() => assign(img.id)}
              title={img.alt ?? ''}
              className={`relative h-11 w-11 overflow-hidden rounded-lg border transition-colors disabled:opacity-40 ${
                chosen ? 'border-a-ink' : 'border-a-line hover:border-a-focus'
              }`}
            >
              <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} width={44} height={44} />
              {chosen && (
                <span className="absolute inset-0 grid place-items-center bg-a-ink/45 text-white"><Check /></span>
              )}
            </button>
          )
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadAndAssign(e.target.files[0])}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-a-line px-3 py-2 text-[13px] text-a-muted transition-colors hover:border-a-focus hover:text-a-ink disabled:opacity-40"
      >
        <Plus /> {busy ? 'Байршуулж байна…' : 'шинэ зураг'}
      </button>

      {variant.image && (
        <button
          type="button"
          disabled={busy}
          onClick={() => assign(null)}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-[12px] text-a-muted transition-colors hover:bg-a-hover hover:text-a-ink disabled:opacity-40"
        >
          зураг салгах
        </button>
      )}

      {error && <p className="mt-2 px-1 text-[12px] text-red-600">{error}</p>}
    </Popover>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint && npm run build`
Expected: both clean. The component has no call site yet — Task 7 adds it — so there is nothing to click. This step exists to catch a bad import path or a JSX error before it is buried inside a larger task.

- [ ] **Step 3: Commit**

```bash
git add components/admin/product/ImagePicker.jsx
git commit -m "feat(admin): image picker with upload-in-place for a variant

Pick one of the product's photos, clear the link, or upload a new photo
that is recorded and assigned to this variant in one pass.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 7: The merged media and variants card

**Files:**
- Create: `components/admin/product/VariantRow.jsx`
- Create: `components/admin/product/MediaVariants.jsx`
- Modify: `app/admin/products/[id]/page.js`
- Delete: `components/admin/product/VariantsTab.jsx`, `components/admin/product/ImagesTab.jsx`

**Interfaces:**
- Consumes: `linkage`, `orphansOf`, `variantLabel` (Task 2); `Thumb` (Task 3); `ImagePicker` (Task 6); `ADMIN_UPSERT_VARIANT`, `ADMIN_SET_STOCK`, `ADMIN_DELETE_VARIANT`, `ADMIN_ADD_IMAGE`, `ADMIN_DELETE_IMAGE`.
- Produces: `<MediaVariants product refetch />` and `<VariantRow product variant images sharedCount refetch canDelete />`.

**A deviation from the spec's mockup, made deliberately:** the strip below the
rows shows **every** image, each labelled with the variants using it or with
`галерей`, rather than only the unlinked ones. `adminReorderProductImages` takes
the complete ordered id list, so a strip holding a subset could not express a
reorder without reconstructing the whole list from two places. Showing all of
them keeps reorder honest and loses no information — `linkage().usage` supplies
the labels either way.

- [ ] **Step 1: Write `VariantRow.jsx`**

Create `components/admin/product/VariantRow.jsx`:

```jsx
'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_DELETE_VARIANT, ADMIN_SET_STOCK, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { toNumber } from '@/lib/format'
import { variantLabel } from '@/lib/admin/images'
import { Button, IconButton, Input, Popover, Thumb } from '@/components/admin/ui'
import { Dots } from '@/components/admin/icons'
import ImagePicker from './ImagePicker'

/**
 * One variant, editable in place.
 *
 * Everything except stock used to require delete-and-re-add: VariantsTab.jsx:72
 * let you change the quantity and nothing else, so renaming a colourway
 * destroyed the row — and after this change it would destroy its photo too.
 *
 * TWO SAVE PATHS, on purpose. Quantity alone goes through adminSetStock, which
 * exists so the inventory table can move one number without sending a whole
 * variant back. Anything else sends the row through adminUpsertVariant.
 *
 * And when it does, EVERY column has to be round-tripped. admin_upsert_variant
 * assigns rather than coalesces on all of them except image_id — so omitting
 * compareAtPriceMnt nulls a sale price, and omitting allowBackorder silently
 * flips it to false. image_id is the one exception: null there means "not
 * supplied", so the row editor never has to know the photo.
 */
export default function VariantRow({ product, variant, images, sharedCount, refetch, canDelete }) {
  const initial = {
    optionValue: variant.optionValue ?? '',
    sku: variant.sku ?? '',
    priceMnt: String(toNumber(variant.priceMnt)),
    quantity: String(variant.quantity),
  }

  const [f, setF] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [menu, setMenu] = useState(false)
  const [error, setError] = useState(null)

  const [save, { loading: saving }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [setStock, { loading: stocking }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const stockOnly =
    f.quantity !== initial.quantity &&
    f.optionValue === initial.optionValue &&
    f.sku === initial.sku &&
    f.priceMnt === initial.priceMnt

  const set = (k, digits = false) => (e) => {
    setError(null)
    setF({ ...f, [k]: digits ? e.target.value.replace(/\D/g, '') : e.target.value })
  }

  const upsert = async (overrides = {}) => {
    await save({ variables: {
      productId: product.id,
      variantId: variant.id,
      priceMnt: String(toNumber(f.priceMnt)),
      quantity: Number(f.quantity || 0),
      sku: f.sku || null,
      // Both halves or neither — variants_option_pair_ck
      // (20260904120100:173) rejects a label with a null value, which is
      // exactly what clearing a colour name in this row would otherwise send.
      optionLabel: f.optionValue ? (variant.optionLabel || 'Өнгө') : null,
      optionValue: f.optionValue || null,
      compareAtPriceMnt: variant.compareAtPriceMnt ?? null,
      allowBackorder: variant.allowBackorder ?? false,
      isActive: variant.isActive,
      // Not 0. The SQL sets position = sort_order, so a hard-coded 0 would
      // collapse every edited variant to the front of the swatch row.
      sortOrder: variant.position ?? 0,
      // null is "not supplied" and keeps the stored photo. The picker is the
      // only thing that changes it.
      imageId: null,
      ...overrides,
    } })
    await refetch()
  }

  const onSave = async () => {
    setError(null)
    try {
      if (stockOnly) {
        await setStock({ variables: { variantId: variant.id, quantity: Number(f.quantity || 0) } })
        await refetch()
      } else {
        await upsert()
      }
    } catch (e) {
      setError(e?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  const toggleActive = async () => {
    setMenu(false)
    setError(null)
    try { await upsert({ isActive: !variant.isActive }) }
    catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
  }

  const onDelete = async () => {
    setMenu(false)
    if (!window.confirm(`"${variantLabel(variant)}" сонголтыг устгах уу?`)) return
    setError(null)
    try {
      await removeVariant({ variables: { variantId: variant.id } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Устгахад алдаа гарлаа.')
    }
  }

  const outOfStock = Number(f.quantity || 0) === 0

  return (
    <li className="border-b border-a-line px-6 py-2.5 last:border-0">
      <div className="grid min-w-[720px] grid-cols-[44px_minmax(0,1fr)_112px_120px_92px_auto] items-center gap-3">
        <div className="relative">
          <Thumb
            filePath={variant.image?.filePath}
            alt={variant.image?.alt ?? ''}
            count={sharedCount}
            onClick={() => setPicking((v) => !v)}
            title={variant.image ? 'Зураг солих' : 'Зураг сонгох'}
          />
          <ImagePicker
            open={picking}
            onClose={() => setPicking(false)}
            product={product}
            variant={variant}
            images={images}
            refetch={refetch}
          />
        </div>

        <Input value={f.optionValue} onChange={set('optionValue')} placeholder="Өнгө / хэмжээ" />
        <Input value={f.sku} onChange={set('sku')} placeholder="SKU" className="tabular-nums" />
        <Input
          value={f.priceMnt}
          onChange={set('priceMnt', true)}
          className="text-right tabular-nums"
          aria-label="Үнэ"
        />
        <Input
          value={f.quantity}
          onChange={set('quantity', true)}
          aria-label="Үлдэгдэл"
          className={`text-right tabular-nums ${outOfStock ? 'bg-blush text-blush-ink' : 'bg-mint text-mint-ink'}`}
        />

        <div className="relative flex items-center justify-end gap-1.5">
          {dirty && (
            <Button variant="primary" size="sm" disabled={saving || stocking} onClick={onSave}>
              Хадгалах
            </Button>
          )}
          {!variant.isActive && <span className="text-[12px] text-a-muted">идэвхгүй</span>}
          <IconButton onClick={() => setMenu((v) => !v)} aria-label="Цэс"><Dots /></IconButton>
          <Popover open={menu} onClose={() => setMenu(false)} className="right-0 top-8 w-[176px]">
            <button
              type="button"
              onClick={toggleActive}
              className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-a-ink hover:bg-a-hover"
            >
              {variant.isActive ? 'Идэвхгүй болгох' : 'Идэвхтэй болгох'}
            </button>
            {canDelete && (
              <>
                <div className="my-1 border-t border-a-line" />
                <button
                  type="button"
                  onClick={onDelete}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-600 hover:bg-red-50"
                >
                  Устгах
                </button>
              </>
            )}
          </Popover>
        </div>
      </div>

      {!variant.image && (
        <p className="mt-1 pl-[56px] text-[12px] text-a-muted">
          зураггүй — картад эхний зураг харагдана
        </p>
      )}
      {error && <p className="mt-1 pl-[56px] text-[12px] text-red-600">{error}</p>}
    </li>
  )
}
```

- [ ] **Step 2: Write `MediaVariants.jsx`**

Create `components/admin/product/MediaVariants.jsx`:

```jsx
'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_DELETE_IMAGE, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { nodes, toNumber } from '@/lib/format'
import { linkage, orphansOf } from '@/lib/admin/images'
import ProductImage from '@/components/ProductImage'
import { Button, Card, Field, Input } from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'
import VariantRow from './VariantRow'

/**
 * Photographs and variants on one card, because they are one decision.
 *
 * They used to be two tabs, so the editor could never show that a variant had
 * no picture — and variants.image_id is what the storefront actually renders
 * (ProductCard.jsx:35, :41-49). Splitting them is why that column was only ever
 * set by hand-written SQL.
 *
 * Applies immediately: every row already owns its mutation, and a Save button
 * over them would claim a transaction that does not exist.
 */
export default function MediaVariants({ product, refetch }) {
  const images = nodes(product.productImageCollection)
  const variants = nodes(product.variantCollection)
  const { usage } = linkage(variants)

  const inputRef = useRef(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [deleteImage] = useMutation(ADMIN_DELETE_IMAGE)

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  // Gallery upload, for the shots that belong to no single colourway — detail,
  // scale, packaging. A variant's own photo is uploaded from its row instead.
  const onFiles = async (files) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const authRes = await fetch('/api/upload-auth')
        if (!authRes.ok) {
          throw new Error(authRes.status === 403
            ? 'Админ эрх шаардлагатай.'
            : 'Байршуулах эрх авахад алдаа гарлаа.')
        }
        const { token, signature, expire, publicKey } = await authRes.json()
        const result = await upload({
          file,
          fileName: `${product.slug}-${Date.now()}-${file.name}`,
          folder: `/hotaru/${product.slug}`,
          useUniqueFileName: true,
          publicKey,
          token,
          signature,
          expire,
        })
        await addImage({ variables: {
          productId: product.id,
          imagekitFileId: result.fileId,
          filePath: result.filePath,
          alt: null,
          width: result.width ?? null,
          height: result.height ?? null,
        } })
      }
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Байршуулахад алдаа гарлаа.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // variants.image_id is `on delete set null`, so the database stays correct
  // either way — but a photo silently vanishing off two colourways is the kind
  // of thing you notice on the storefront, days later.
  const onDeleteImage = async (img) => {
    const orphans = orphansOf(img.id, variants)
    const warning = orphans.length
      ? `Энэ зургийг ${orphans.length} сонголт ашиглаж байна (${orphans.join(', ')}). Устгавал тэд зураггүй үлдэнэ. Үргэлжлүүлэх үү?`
      : 'Энэ зургийг устгах уу?'
    if (!window.confirm(warning)) return
    setError(null)
    try {
      await deleteImage({ variables: { imageId: img.id } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Устгахад алдаа гарлаа.')
    }
  }

  return (
    <Card
      title="Зураг ба сонголт"
      subtitle="шууд хадгалагдана"
      padded={false}
      actions={
        <>
          <Button disabled={busy} onClick={() => inputRef.current?.click()}>
            <Plus /> {busy ? 'Байршуулж байна…' : 'Зураг'}
          </Button>
          <Button variant="primary" onClick={() => setAdding(true)}><Plus /> Сонголт</Button>
        </>
      }
    >
      {!configured && (
        <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && onFiles(Array.from(e.target.files))}
      />

      <div className="overflow-x-auto">
        <ul>
          {variants.map((v) => (
            <VariantRow
              key={v.id}
              product={product}
              variant={v}
              images={images}
              sharedCount={v.image?.id ? (usage[v.image.id]?.length ?? 1) : 1}
              refetch={refetch}
              canDelete={variants.length > 1}
            />
          ))}
        </ul>
      </div>

      {variants.length === 0 && (
        <p className="px-6 py-8 text-center text-[13px] text-a-muted">Сонголт алга.</p>
      )}

      {adding && (
        <div className="border-t border-a-line px-6 py-4">
          <VariantForm
            product={product}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); refetch() }}
          />
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files ?? []).filter((file) => file.type.startsWith('image/'))
          if (files.length) onFiles(files)
        }}
        className={`border-t px-6 py-4 transition-colors ${dragging ? 'border-a-focus bg-blue-50' : 'border-a-line'}`}
      >
        <p className="mb-2 text-[12px] font-medium text-a-muted">Галерей</p>
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed border-a-line px-4 py-6 text-center text-[13px] text-a-muted">
            Зургаа энд чирж оруулна уу
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {images.map((img) => (
              <li key={img.id} className="w-24">
                <div className="relative aspect-square overflow-hidden rounded-xl border border-a-line bg-a-hover">
                  <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="96px" />
                </div>
                <p className="mt-1 truncate text-[11px] text-a-muted" title={usage[img.id]?.join(', ') ?? 'галерей'}>
                  {usage[img.id]?.join(', ') ?? 'галерей'}
                </p>
                <button
                  onClick={() => onDeleteImage(img)}
                  className="mt-0.5 text-[11px] text-a-muted transition-colors hover:text-red-600"
                >
                  Устгах
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
      </div>
    </Card>
  )
}

function VariantForm({ product, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [f, setF] = useState({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // A new variant goes to the end of the swatch row, not the front.
  const nextPosition = nodes(product.variantCollection).length

  return (
    <form
      className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        try {
          await save({ variables: {
            productId: product.id,
            priceMnt: String(toNumber(f.priceMnt)),
            quantity: Number(f.quantity || 0),
            sku: f.sku || null,
            optionLabel: f.optionValue ? f.optionLabel : null,
            optionValue: f.optionValue || null,
            compareAtPriceMnt: null,
            allowBackorder: false,
            isActive: true,
            sortOrder: nextPosition,
            variantId: null,
            // Assigned from the row's own picker once the variant exists.
            imageId: null,
          } })
          onSaved()
        } catch (err) { setError(err?.message ?? 'Алдаа гарлаа.') }
      }}
    >
      <Field label="SKU"><Input value={f.sku} onChange={set('sku')} /></Field>
      <Field label="Сонголтын нэр"><Input value={f.optionLabel} onChange={set('optionLabel')} /></Field>
      <Field label="Утга"><Input value={f.optionValue} onChange={set('optionValue')} placeholder="Cream" /></Field>
      <Field label="Үнэ (₮)">
        <Input required value={f.priceMnt} onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
      </Field>
      <Field label="Үлдэгдэл">
        <Input value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
      </Field>
      {error && <p className="text-[13px] text-red-600 sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5">
        <Button type="submit" variant="primary" disabled={loading}>Нэмэх</Button>
        <Button type="button" onClick={onClose}>Болих</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Wire it into the page and delete the two old tabs**

In `app/admin/products/[id]/page.js`, replace the two imports

```jsx
import VariantsTab from '@/components/admin/product/VariantsTab'
import ImagesTab from '@/components/admin/product/ImagesTab'
```

with

```jsx
import MediaVariants from '@/components/admin/product/MediaVariants'
```

and replace the two elements in the `space-y-4` block with `<MediaVariants {...shared} />`.

```bash
git rm components/admin/product/VariantsTab.jsx components/admin/product/ImagesTab.jsx
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run build`
Expected: both clean.

Then `npm run dev`, open a product with several variants at `/admin/products/<id>`:
- every variant row shows a thumbnail; a variant with no photo shows a dashed square and the line `зураггүй — картад эхний зураг харагдана`
- clicking a thumbnail opens the picker; picking a photo assigns it and the row updates
- `зураг салгах` clears it back to the dashed square
- `+ шинэ зураг` uploads and assigns in one pass; the photo also appears in the gallery strip below
- two variants pointed at one photo both show a `2` badge
- editing a colour name shows `Хадгалах`; saving it keeps the photo, the sale price and the backorder flag — **check this against the database**, because these are the columns the SQL assigns rather than coalesces
- editing only the quantity also shows `Хадгалах`, and saving it takes the `adminSetStock` path (visible in the Network tab as `AdminSetStock`, not `AdminUpsertVariant`)
- variant order in the storefront swatch row is unchanged after editing a middle variant
- deleting a gallery photo two variants use warns, names both, and empties both on confirm
- deleting a photo nothing uses asks a plain confirm

- [ ] **Step 5: Commit**

```bash
git add -A components/admin/product app/admin/products
git commit -m "feat(admin): one card for photos and variants

The image becomes the first column of the variant row, assigned or
uploaded from a popover on the thumbnail. Rows are editable in place
instead of delete-and-re-add, and deleting a photo names the variants it
will empty.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

### Task 8: Drag to reorder, and stop the position labels lying

**Files:**
- Modify: `lib/admin/images.js` (add `moveItem`)
- Modify: `tests/unit/images.test.js`
- Modify: `components/admin/product/MediaVariants.jsx`

**Interfaces:**
- Consumes: `ADMIN_REORDER_IMAGES`, `linkage().positionStillRules` (Task 2).
- Produces: `moveItem(list, from, to) -> array` — a new array, input untouched.

- [ ] **Step 1: Write the failing test for `moveItem`**

Append to `tests/unit/images.test.js`:

```js
import { moveItem } from '../../lib/admin/images.js'

test('moveItem moves an entry and leaves the input alone', () => {
  const list = ['a', 'b', 'c', 'd']
  assert.deepEqual(moveItem(list, 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveItem(list, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(list, ['a', 'b', 'c', 'd'], 'the input array is untouched')
})

test('moveItem is a no-op for a move that changes nothing', () => {
  const list = ['a', 'b', 'c']
  assert.deepEqual(moveItem(list, 1, 1), ['a', 'b', 'c'])
})

test('moveItem ignores an out-of-range index instead of dropping an entry', () => {
  // A dragend with no drop target reports -1, and splice(-1) would silently
  // move the LAST item.
  const list = ['a', 'b', 'c']
  assert.deepEqual(moveItem(list, -1, 1), ['a', 'b', 'c'])
  assert.deepEqual(moveItem(list, 0, 9), ['a', 'b', 'c'])
  assert.deepEqual(moveItem(list, null, 1), ['a', 'b', 'c'])
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/unit/images.test.js`
Expected: FAIL — `moveItem is not a function`.

- [ ] **Step 3: Implement `moveItem`**

Append to `lib/admin/images.js`:

```js
/**
 * Move one entry of a list, returning a new array.
 *
 * Guards both indices because a dragend with no drop target reports -1, and
 * `splice(-1, 1)` silently removes the LAST element instead of doing nothing.
 */
export function moveItem(list = [], from, to) {
  const n = list.length
  if (!Number.isInteger(from) || !Number.isInteger(to)) return [...list]
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return [...list]
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:unit`
Expected: every unit suite green.

- [ ] **Step 5: Add drag reorder and the conditional position badge**

In `components/admin/product/MediaVariants.jsx`:

Extend the imports:

```jsx
import { ADMIN_ADD_IMAGE, ADMIN_DELETE_IMAGE, ADMIN_REORDER_IMAGES, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { linkage, moveItem, orphansOf } from '@/lib/admin/images'
```

Take `positionStillRules` off the existing `linkage` call, and add the reorder
state and mutation. `onDropAt` takes its `from` **as a parameter** rather than
reading `dragIndex`: the arrow buttons need to move a tile without a drag ever
starting, and `setDragIndex` would not have applied by the time the handler ran.

```jsx
  const { usage, positionStillRules } = linkage(variants)
  const [dragIndex, setDragIndex] = useState(null)
  const [reorder] = useMutation(ADMIN_REORDER_IMAGES)

  const onDropAt = async (from, to) => {
    const next = moveItem(images, from, to)
    setDragIndex(null)
    if (next.every((img, i) => img.id === images[i].id)) return
    setError(null)
    try {
      await reorder({ variables: { productId: product.id, imageIds: next.map((i) => i.id) } })
      await refetch()
    } catch (e) {
      setError(e?.message ?? 'Эрэмбэлэхэд алдаа гарлаа.')
    }
  }
```

Then replace the gallery `<li>` from Task 7 with the draggable version:

```jsx
            {images.map((img, i) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onDropAt(dragIndex, i) }}
                className={`w-24 cursor-grab ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-xl border border-a-line bg-a-hover">
                  <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="96px" />
                  {/* Position decides the card and hover photos ONLY while no
                      variant carries an image of its own — ProductCard.jsx:35
                      consults the variant first. ImagesTab.jsx:145 printed these
                      labels unconditionally, which was false for every product
                      that had been paired up. */}
                  {positionStillRules && i < 2 && (
                    <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 text-[11px] font-medium">
                      {i === 0 ? 'карт' : 'hover'}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-[11px] text-a-muted" title={usage[img.id]?.join(', ') ?? 'галерей'}>
                  {usage[img.id]?.join(', ') ?? 'галерей'}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  {/* The keyboard path. Native HTML5 drag has no equivalent, and
                      dropping these would make reorder mouse-only. */}
                  <button
                    onClick={() => onDropAt(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Урагш"
                    className="text-[13px] text-a-muted disabled:opacity-25"
                  >←</button>
                  <button
                    onClick={() => onDropAt(i, i + 1)}
                    disabled={i === images.length - 1}
                    aria-label="Хойш"
                    className="text-[13px] text-a-muted disabled:opacity-25"
                  >→</button>
                  <button
                    onClick={() => onDeleteImage(img)}
                    className="ml-auto text-[11px] text-a-muted transition-colors hover:text-red-600"
                  >Устгах</button>
                </div>
              </li>
            ))}
```

- [ ] **Step 6: Verify**

Run: `npm run lint && npm run build && npm test`
Expected: lint clean, build clean, every unit and SQL suite green.

Then `npm run dev`:
- on a product where **every** variant has a photo, the gallery shows no `карт` / `hover` badges — that rule no longer applies
- on a product where **no** variant has a photo, the first two tiles do show them
- dragging a tile onto another reorders the strip and the new order survives a reload
- `←` and `→` move a tile one slot and match what dragging does
- dragging a tile and releasing outside the strip changes nothing
- the storefront card for a product with no variant images still uses the first gallery image, and swaps to the second on hover

- [ ] **Step 7: Commit**

```bash
git add lib/admin/images.js tests/unit/images.test.js components/admin/product/MediaVariants.jsx
git commit -m "feat(admin): drag to reorder photos, and honest position labels

The карт/hover badges only appear when no variant carries an image, which
is the only case where position still decides those two slots.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JmFe7amLwkTeHhkZbjWetD"
```

---

## Done when

- `npm test` is green — unit and SQL suites both.
- `npm run lint && npm run build` are clean.
- `components/admin/product/` holds exactly `ProductForm.jsx`, `MediaVariants.jsx`, `VariantRow.jsx`, `ImagePicker.jsx`.
- The full manual pass from the spec: open a product with five variants and three photos, upload a photo from the fourth variant's row, confirm the card in `/shop` swaps on hover for that colourway, then delete that photo from the gallery and confirm the warning names the variant it will empty.
