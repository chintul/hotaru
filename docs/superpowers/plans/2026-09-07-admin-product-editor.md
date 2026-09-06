# Admin Product Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline product form with a dedicated `/admin/products/[id]` editor that has tabs for details, variants, images and SEO — so a product created today can have photographs.

**Architecture:** A list at `/admin/products` and an editor at `/admin/products/[id]`, tab held in `?tab=`. Details and SEO are form-shaped with an explicit Save; variants and images apply immediately through mutations they already have. `/admin/inventory` and `/admin/images` are deleted.

**Tech Stack:** Next.js 16.3.4 (App Router, JS not TS), React 19.2, Apollo Client 4, Supabase Postgres + pg_graphql, ImageKit (`@imagekit/next`), Tailwind 4, `node --test`, psql + Docker.

**Spec:** `docs/superpowers/specs/2026-09-07-admin-product-ux-design.md`

**Depends on:** `docs/superpowers/plans/2026-09-07-admin-bulk-actions.md` (Track A) must be complete. The `/admin/products` list in Task 3 carries the selection props Track A added to `DataTable`.

## Global Constraints

- **JavaScript, not TypeScript.** No `.ts`/`.tsx`.
- **`next/image` is not used in this project.** See `components/ProductImage.jsx:8`. Product imagery goes through `@imagekit/next`'s `<Image>` via `components/ProductImage.jsx`; the logo is a plain `<img>`. Do not introduce `next/image`.
- **Unit tests import by relative path**, not `@/` — `node --test` does not resolve `jsconfig.json` paths.
- **Money is whole tugrik.** Never divide by 100. `pg_graphql` returns bigint as a **String**; coerce with `toNumber` from `lib/format.js`.
- **Admin SQL functions:** `volatile`, `language plpgsql`, `security definer`, `set search_path = public, pg_temp`, `is_admin()` guard raising `42501` first.
- **UI copy is Mongolian.** Match existing strings.
- **Commit after every task.** Trunk only: `main`, never branch.
- **Test commands:** `npm run test:unit`, `npm run test:db`, `npx eslint <paths>`, `npx next build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260907130000_product_seo_copy.sql` | Teach `admin_upsert_product` the SEO columns |
| `lib/slug.js` | Cyrillic → Latin slug |
| `tests/unit/slug.test.js` | Its tests |
| `lib/queries.js` | `ADMIN_PRODUCT_DETAIL`, extended `ADMIN_UPSERT_PRODUCT` |
| `app/admin/products/page.js` | List — moved from `app/admin/inventory/page.js` |
| `app/admin/products/[id]/page.js` | Editor shell, tab routing, dirty guard |
| `app/admin/products/new/page.js` | Create form, redirects into the editor |
| `components/admin/product/DetailsTab.jsx` | Title, slug, category, copy, status, featured |
| `components/admin/product/VariantsTab.jsx` | Variant rows + add form |
| `components/admin/product/ImagesTab.jsx` | Upload, drop zone, reorder, make primary |
| `components/admin/product/SeoTab.jsx` | SEO fields + serp preview |
| `components/admin/AdminShell.jsx` | `NAV` loses Зураг, Бараа points at `/admin/products` |
| `components/admin/CommandPalette.jsx` | Product results deep-link into the editor |

---

### Task 1: Teach `admin_upsert_product` the SEO columns

**Files:**
- Create: `supabase/migrations/20260907130000_product_seo_copy.sql`
- Modify: `tests/sql/03_admin_catalog.sql` (append)

**Interfaces:**
- Consumes: `public.product_translations.seo_title`, `.seo_description` (`supabase/migrations/20260904120100_tables.sql:112`).
- Produces: `admin_upsert_product(...)` with two extra trailing params — `seo_title text default null`, `seo_description text default null`.

**Why this task exists:** the columns have existed since the first migration and are read by `ADMIN_PRODUCTS` (`lib/queries.js:628`), but **nothing writes them**. Only a data-fix migration (`20260905150000_seo_title_no_brand.sql`) ever set a value. Without this, the SEO tab in Task 8 has nowhere to save.

**The overload trap:** adding parameters to an existing function via `create or replace` does not replace it — it creates a *second* function with a different signature. Two overloads make pg_graphql's reflection ambiguous and break every existing call. The old signature must be dropped explicitly.

- [ ] **Step 1: Write the failing test**

Append to `tests/sql/03_admin_catalog.sql`, immediately after the existing product block (after the `test.raises` for a missing title):

```sql
-- SEO copy travels with the rest of the product copy, in the same call.
create temp table t_seo as
select * from public.admin_upsert_product(
  slug => 'test-seo', title => 'Test Seo', status => 'draft',
  seo_title => 'Seo Title', seo_description => 'Seo Description');

select test.eq((select seo_title from public.product_translations
                 where product_id = (select id from t_seo) and locale = 'mn'),
               'Seo Title', 'seo_title is written by admin_upsert_product');
select test.eq((select seo_description from public.product_translations
                 where product_id = (select id from t_seo) and locale = 'mn'),
               'Seo Description', 'seo_description is written too');

-- Only one function of this name may exist, or pg_graphql cannot reflect it.
select test.eq(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_upsert_product'),
  1, 'admin_upsert_product has exactly one signature');
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `npm run test:db`
Expected: `FAIL  03_admin_catalog.sql` — `function public.admin_upsert_product(slug => unknown, title => unknown, status => unknown, seo_title => unknown, seo_description => unknown) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260907130000_product_seo_copy.sql`:

```sql
-- ============================================================================
-- hotaru — 21. SEO copy reaches the write path
-- ============================================================================
-- product_translations.seo_title / .seo_description have existed since the
-- first migration and are read by the storefront, but admin_upsert_product
-- never wrote them — the only values in the table came from a one-off data fix
-- (20260905150000_seo_title_no_brand.sql). The admin SEO tab needs a way in.
--
-- The old signature is DROPPED, not replaced. Adding parameters to a function
-- creates an overload rather than replacing it, and two overloads of the same
-- name make pg_graphql's reflection ambiguous.
-- ============================================================================

drop function if exists public.admin_upsert_product(
  text, text, text, text, text, text, text, boolean, int, uuid);

create function public.admin_upsert_product(
  slug text,
  title text,
  category_slug text default null,
  subtitle text default null,
  description text default null,
  care_details text default null,
  status text default 'draft',
  is_featured boolean default false,
  sort_order int default 0,
  product_id uuid default null,
  seo_title text default null,
  seo_description text default null
) returns public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category uuid;
  v_product  public.products;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if coalesce(trim(admin_upsert_product.title), '') = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  select c.id into v_category from public.categories c
   where c.slug = admin_upsert_product.category_slug::citext;

  if admin_upsert_product.product_id is not null then
    update public.products p set
      slug = admin_upsert_product.slug::citext,
      category_id = v_category,
      status = admin_upsert_product.status::public.product_status,
      is_featured = admin_upsert_product.is_featured,
      position = admin_upsert_product.sort_order,
      published_at = case
        when admin_upsert_product.status = 'active' then coalesce(p.published_at, now())
        else p.published_at end
    where p.id = admin_upsert_product.product_id
    returning * into v_product;
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  else
    insert into public.products (slug, category_id, status, is_featured, position, published_at)
    values (
      admin_upsert_product.slug::citext, v_category,
      admin_upsert_product.status::public.product_status,
      admin_upsert_product.is_featured, admin_upsert_product.sort_order,
      case when admin_upsert_product.status = 'active' then now() end
    )
    on conflict on constraint products_slug_key do update set
      category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position
    returning * into v_product;
  end if;

  insert into public.product_translations
    (product_id, locale, title, subtitle, description, care_details, seo_title, seo_description)
  values (
    v_product.id, 'mn', admin_upsert_product.title, admin_upsert_product.subtitle,
    admin_upsert_product.description, admin_upsert_product.care_details,
    admin_upsert_product.seo_title, admin_upsert_product.seo_description
  )
  on conflict on constraint product_translations_product_id_locale_key do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    care_details = excluded.care_details,
    -- Null means "not supplied by this caller", not "clear it". The details
    -- tab saves without SEO fields and must not wipe them.
    seo_title = coalesce(excluded.seo_title, product_translations.seo_title),
    seo_description = coalesce(excluded.seo_description, product_translations.seo_description);

  perform public.refresh_product_derived(v_product.id);
  return v_product;
end;
$$;

-- Dropping the old signature threw away its grants, and the new function
-- arrives with EXECUTE granted to PUBLIC (which anon inherits). Both halves
-- have to be restored or tests/sql/02_guards.sql fails — it asserts that no
-- unreviewed SECURITY DEFINER function is anon-executable.
revoke execute on function
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid, text, text)
from public, anon;

grant execute on function
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid, text, text)
to authenticated;
```

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npm run test:db`
Expected: `PASS  03_admin_catalog.sql`, `all database tests passed`. The pre-existing assertions in that file must still pass — they call the function without the new params, which is what the defaults are for.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907130000_product_seo_copy.sql tests/sql/03_admin_catalog.sql
git commit -m "feat(db): admin_upsert_product writes SEO copy"
```

---

### Task 2: Slug helper

**Files:**
- Create: `lib/slug.js`
- Test: `tests/unit/slug.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `slugify(text) -> string` — lowercase ASCII, hyphen-separated, no leading/trailing hyphens, `''` for input with no usable characters.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/slug.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from '../../lib/slug.js'

test('Mongolian Cyrillic transliterates to readable ascii', () => {
  assert.equal(slugify('Цүнх'), 'tsunkh')
  assert.equal(slugify('Аяга сав'), 'ayaga-sav')
  assert.equal(slugify('Ноосон малгай'), 'nooson-malgai')
})

test('latin input is left recognisable', () => {
  assert.equal(slugify('Woven Shoulder Bag'), 'woven-shoulder-bag')
  assert.equal(slugify('Café Crème'), 'cafe-creme')
})

test('punctuation and spacing collapse to single hyphens', () => {
  assert.equal(slugify('  Bag —  "Cream" / 2026!  '), 'bag-cream-2026')
  assert.equal(slugify('a---b'), 'a-b')
})

test('digits survive', () => {
  assert.equal(slugify('Аяга 500ml'), 'ayaga-500ml')
})

test('unusable input yields an empty string, never a bare hyphen', () => {
  assert.equal(slugify(''), '')
  assert.equal(slugify('   '), '')
  assert.equal(slugify('!!!'), '')
  assert.equal(slugify(null), '')
  assert.equal(slugify(undefined), '')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module '.../lib/slug.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/slug.js`:

```js
/**
 * Title → URL slug, for the admin product form.
 *
 * Mongolian Cyrillic has no useful Unicode normalisation path to ASCII, so the
 * mapping is explicit. It follows the MNS 5217:2012 romanisation loosely —
 * the goal is a readable, stable, typeable slug, not a reversible transliteration.
 */
const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'u', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(text) {
  if (!text) return ''

  const lowered = String(text).toLowerCase()

  let out = ''
  for (const ch of lowered) {
    if (Object.hasOwn(CYRILLIC, ch)) out += CYRILLIC[ch]
    else out += ch
  }

  return out
    // Strip Latin diacritics: café → cafe.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit`
Expected: all `slug.test.js` assertions pass.

If `slugify('Цүнх')` returns `tsunh` rather than `tsunkh`, the `х → kh` entry is being shadowed — check that `х` in the map is Cyrillic U+0445, not Latin `x`.

- [ ] **Step 5: Commit**

```bash
git add lib/slug.js tests/unit/slug.test.js
git commit -m "feat(admin): Cyrillic-aware slug helper"
```

---

### Task 3: Single-product query and extended upsert

**Files:**
- Modify: `lib/queries.js:562` (`ADMIN_UPSERT_PRODUCT`), and append `ADMIN_PRODUCT_DETAIL`

**Interfaces:**
- Consumes: the migration from Task 1.
- Produces:
  - `ADMIN_UPSERT_PRODUCT` gaining `$seoTitle: String, $seoDescription: String`.
  - `ADMIN_PRODUCT_DETAIL` — one product by id with translations, variants, images, plus the category list the editor's select needs.

- [ ] **Step 1: Extend `ADMIN_UPSERT_PRODUCT`**

Replace it at `lib/queries.js:562` with:

```js
export const ADMIN_UPSERT_PRODUCT = gql`
  mutation AdminUpsertProduct(
    $slug: String!, $title: String!, $categorySlug: String, $subtitle: String,
    $description: String, $careDetails: String, $status: String, $isFeatured: Boolean,
    $sortOrder: Int, $productId: UUID, $seoTitle: String, $seoDescription: String
  ) {
    adminUpsertProduct(
      slug: $slug, title: $title, categorySlug: $categorySlug, subtitle: $subtitle,
      description: $description, careDetails: $careDetails, status: $status,
      isFeatured: $isFeatured, sortOrder: $sortOrder, productId: $productId,
      seoTitle: $seoTitle, seoDescription: $seoDescription
    ) { id slug status isFeatured }
  }
`
```

- [ ] **Step 2: Append `ADMIN_PRODUCT_DETAIL`**

Add at the end of `lib/queries.js`:

```js
export const ADMIN_PRODUCT_DETAIL = gql`
  query AdminProductDetail($productId: UUID!) {
    productCollection(filter: { id: { eq: $productId } }, first: 1) {
      edges {
        node {
          id slug status isFeatured position minPriceMnt inStock
          category { slug }
          productTranslationCollection(first: 1, filter: { locale: { eq: "mn" } }) {
            edges { node { title subtitle description careDetails seoTitle seoDescription } }
          }
          variantCollection(first: 50, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id sku optionLabel optionValue priceMnt compareAtPriceMnt quantity isActive } }
          }
          productImageCollection(first: 24, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id filePath alt position width height } }
          }
        }
      }
    }
    categoryCollection(first: 30, orderBy: [{ position: AscNullsLast }]) {
      edges { node { id slug categoryTranslationCollection(first: 1) { edges { node { name } } } } }
    }
  }
`
```

- [ ] **Step 3: Verify against the live schema**

With the Task 1 migration applied to the dev database, load any admin page and confirm no GraphQL validation error appears in the console for `AdminUpsertProduct`. An `Unknown argument "seoTitle"` means the migration has not been applied.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.js
git commit -m "feat(admin): single-product query and SEO-aware upsert"
```

---

### Task 4: Product list at its new home

**Files:**
- Create: `app/admin/products/page.js` (moved from `app/admin/inventory/page.js`)
- Delete: `app/admin/inventory/page.js`

**Interfaces:**
- Consumes: `useSelection` and the bulk actions built in Track A Task 8 — they move across **unchanged**.
- Produces: a list whose rows navigate to `/admin/products/<id>`.

- [ ] **Step 1: Move the file**

```bash
mkdir -p app/admin/products
git mv app/admin/inventory/page.js app/admin/products/page.js
rmdir app/admin/inventory
```

- [ ] **Step 2: Strip the editing machinery out of it**

Delete these from `app/admin/products/page.js` entirely — they are replaced by the editor in Tasks 5–8: the `ProductForm` function, the `VariantPanel` function, the `VariantRow` function, the `VariantForm` function, the `editing` and `expanded` state, and the JSX blocks that render them.

Keep: the query, `search`, `rows`, `columns`, `useSelection`, every bulk action, `CategoryPicker`, `PageHeader`, `EmptyState`, `DataTable`.

- [ ] **Step 3: Point the page at the editor**

Add `import { useRouter } from 'next/navigation'` and `const router = useRouter()`, then:

```jsx
      <PageHeader
        title="Бараа"
        subtitle={`${products.length} бүтээгдэхүүн`}
        actions={
          <Button variant="primary" onClick={() => router.push('/admin/products/new')}>
            <Plus /> Шинэ бүтээгдэхүүн
          </Button>
        }
      />
```

and change the table's row click:

```jsx
            onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
```

and the empty state's action:

```jsx
          action={<Button variant="primary" onClick={() => router.push('/admin/products/new')}>Нэмэх</Button>}
```

Add a first column showing the primary image, so the list is scannable:

```jsx
    { key: 'image', header: '', render: (p) => {
      const img = nodes(p.productImageCollection)[0]
      return (
        <span className="block h-9 w-9 overflow-hidden rounded-md bg-a-hover">
          {img && <ProductImage filePath={img.filePath} alt="" seed={p.id} width={36} height={36} />}
        </span>
      )
    } },
```

This needs `import ProductImage from '@/components/ProductImage'` and `productImageCollection` on `ADMIN_PRODUCTS`. Add to that query at `lib/queries.js:628`, inside the product node:

```graphql
          productImageCollection(first: 1, orderBy: [{ position: AscNullsLast }]) {
            edges { node { id filePath } }
          }
```

- [ ] **Step 4: Verify**

Run `npm run dev`, open `/admin/products`. The list renders with thumbnails, search works, bulk actions still work (Track A behaviour must be intact), and clicking a row 404s — the editor does not exist yet. `/admin/inventory` now 404s, and the sidebar link is broken; Task 10 fixes both.

- [ ] **Step 5: Commit**

```bash
git add -A app/admin lib/queries.js
git commit -m "refactor(admin): move the product list to /admin/products"
```

---

### Task 5: Editor shell

**Files:**
- Create: `app/admin/products/[id]/page.js`

**Interfaces:**
- Consumes: `ADMIN_PRODUCT_DETAIL` (Task 3).
- Produces: a shell that fetches one product, renders four tabs from `?tab=`, and passes `{ product, categories, refetch }` to each. Tab components arrive in Tasks 6–9; **stub them in this task** so the shell is testable alone.

- [ ] **Step 1: Write the shell**

Create `app/admin/products/[id]/page.js`:

```jsx
'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCT_DETAIL } from '@/lib/queries'
import { copy, firstNode, nodes } from '@/lib/format'
import { Card, PageHeader, Status } from '@/components/admin/ui'
import DetailsTab from '@/components/admin/product/DetailsTab'
import VariantsTab from '@/components/admin/product/VariantsTab'
import ImagesTab from '@/components/admin/product/ImagesTab'
import SeoTab from '@/components/admin/product/SeoTab'

const TABS = [
  ['details', 'Мэдээлэл'],
  ['variants', 'Сонголт'],
  ['images', 'Зураг'],
  ['seo', 'SEO'],
]

export default function ProductEditorPage() {
  const { id } = useParams()
  const router = useRouter()
  const params = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'details'

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

  // Tab lives in the URL so a tab is linkable and the back button works.
  const go = (key) => router.replace(`/admin/products/${id}?tab=${key}`, { scroll: false })
  const shared = { product, categories, refetch }

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-[13px] text-a-muted hover:text-a-ink">
        ← Бараа
      </Link>

      <PageHeader
        title={copy(product).title ?? product.slug}
        subtitle={product.slug}
        actions={
          <Status tone={product.status === 'active' ? 'green' : product.status === 'draft' ? 'amber' : 'grey'}>
            {product.status}
          </Status>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-a-line">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => go(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
              tab === key
                ? 'border-a-ink text-a-ink'
                : 'border-transparent text-a-muted hover:text-a-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'details' && <DetailsTab {...shared} />}
      {tab === 'variants' && <VariantsTab {...shared} />}
      {tab === 'images' && <ImagesTab {...shared} />}
      {tab === 'seo' && <SeoTab {...shared} />}
    </>
  )
}
```

- [ ] **Step 2: Stub the four tabs so the shell runs**

Create each of `components/admin/product/DetailsTab.jsx`, `VariantsTab.jsx`, `ImagesTab.jsx`, `SeoTab.jsx` with this body, changing only the component name and the string:

```jsx
'use client'

export default function DetailsTab() {
  return <p className="text-[13px] text-a-muted">Мэдээлэл — удахгүй</p>
}
```

- [ ] **Step 3: Verify**

Open `/admin/products/<a real id>`. Four tabs render, clicking swaps the panel, the URL gains `?tab=variants`, browser Back returns to the previous tab, and a bad id shows "Бүтээгдэхүүн олдсонгүй" rather than crashing.

- [ ] **Step 4: Commit**

```bash
git add app/admin/products/\[id\]/page.js components/admin/product/
git commit -m "feat(admin): product editor shell with URL-held tabs"
```

---

### Task 6: Details tab

**Files:**
- Modify: `components/admin/product/DetailsTab.jsx`

**Interfaces:**
- Consumes: `{ product, categories, refetch }`; `ADMIN_UPSERT_PRODUCT` (Task 3). Slug auto-fill is **not** here — an existing product's slug is a live URL, so it must never re-derive itself from an edited title. `slugify` belongs to the create form in Task 9 only.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the tab**

Replace `components/admin/product/DetailsTab.jsx`:

```jsx
'use client'

import { useEffect, useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy, firstNode } from '@/lib/format'
import { Button, Card, Field, Input, Select, Textarea } from '@/components/admin/ui'

export default function DetailsTab({ product, categories, refetch }) {
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
  }

  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = Object.keys(initial).some((k) => f[k] !== initial[k])
  const set = (k) => (e) => { setSaved(false); setF({ ...f, [k]: e.target.value }) }

  // Leaving with unsaved edits loses them. Variants and images apply
  // immediately; this tab does not, so it has to say so.
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
        // Omitted on purpose — the SQL coalesces null to the stored value, so
        // saving details never wipes SEO copy written on the other tab.
        seoTitle: null,
        seoDescription: null,
      } })
      setSaved(true)
      await refetch()
    } catch (err) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  return (
    <Card
      title="Мэдээлэл"
      actions={
        <>
          {saved && !dirty && <span className="text-[12px] text-emerald-600">Хадгалсан</span>}
          {dirty && <span className="text-[12px] text-amber-600">Хадгалаагүй өөрчлөлт</span>}
          <Button form="details-form" type="submit" variant="primary" disabled={!dirty || loading}>
            {loading ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </>
      }
    >
      <form id="details-form" className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
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
          <input type="checkbox" checked={f.isFeatured}
            onChange={(e) => { setSaved(false); setF({ ...f, isFeatured: e.target.checked }) }}
            className="h-4 w-4 accent-black" />
          Онцлох
        </label>
        {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
      </form>
    </Card>
  )
}
```

- [ ] **Step 2: Verify**

Edit a title, watch `Хадгалаагүй өөрчлөлт` appear and Save enable. Save; the header title updates via `refetch`. Edit again and try to close the tab — the browser warns. **Then go to the SEO tab, save something there, come back and save details — the SEO copy must survive.** That is what `seoTitle: null` plus the SQL `coalesce` buys.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint components/admin/product/DetailsTab.jsx
git add components/admin/product/DetailsTab.jsx
git commit -m "feat(admin): product details tab"
```

---

### Task 7: Variants tab

**Files:**
- Modify: `components/admin/product/VariantsTab.jsx`

**Interfaces:**
- Consumes: `{ product, refetch }`; `ADMIN_UPSERT_VARIANT`, `ADMIN_SET_STOCK`, `ADMIN_DELETE_VARIANT`, `ADMIN_ARCHIVE_PRODUCT` from `lib/queries.js`.
- Produces: nothing later tasks depend on.

**Source:** lift `VariantPanel`, `VariantRow` and `VariantForm` from git history — they were deleted from the product list in Task 4 Step 2. Recover with `git show HEAD~1:app/admin/inventory/page.js` if needed. Applies immediately; no Save button.

- [ ] **Step 1: Write the tab**

Replace `components/admin/product/VariantsTab.jsx`:

```jsx
'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_DELETE_VARIANT, ADMIN_SET_STOCK, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { formatMnt, nodes, toNumber } from '@/lib/format'
import { Button, Card, Field, Input, Status } from '@/components/admin/ui'
import { Plus } from '@/components/admin/icons'

export default function VariantsTab({ product, refetch }) {
  const [adding, setAdding] = useState(false)
  const variants = nodes(product.variantCollection)

  return (
    <Card
      title="Сонголт"
      subtitle={`${variants.length} сонголт · өөрчлөлт шууд хадгалагдана`}
      actions={<Button onClick={() => setAdding(true)}><Plus /> Сонголт</Button>}
      padded={false}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-a-line">
            {['SKU', 'Сонголт', 'Үнэ', 'Үлдэгдэл', 'Төлөв', ''].map((h, i) => (
              <th key={h + i}
                className={`px-6 py-2.5 text-[13px] font-normal text-a-muted ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} onDone={refetch} canDelete={variants.length > 1} />
          ))}
        </tbody>
      </table>

      {adding && (
        <div className="border-t border-a-line px-6 py-4">
          <VariantForm productId={product.id} onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); refetch() }} />
        </div>
      )}
    </Card>
  )
}

function VariantRow({ variant, onDone, canDelete }) {
  const [setStock, { loading }] = useMutation(ADMIN_SET_STOCK)
  const [removeVariant] = useMutation(ADMIN_DELETE_VARIANT)
  const [qty, setQty] = useState(String(variant.quantity))
  const [error, setError] = useState(null)
  const dirty = String(variant.quantity) !== qty

  return (
    <tr className="border-b border-a-line last:border-0">
      <td className="px-6 py-3 text-[13px] tabular-nums text-a-muted">{variant.sku ?? '—'}</td>
      <td className="px-6 py-3 text-[13px]">{variant.optionValue ?? '—'}</td>
      <td className="px-6 py-3 text-right text-[13px] tabular-nums">{formatMnt(variant.priceMnt)}</td>
      <td className="px-6 py-3 text-right">
        <span className="flex items-center justify-end gap-2">
          <Input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            className={`w-[72px] text-right tabular-nums ${variant.quantity === 0 ? 'text-red-600' : ''}`} />
          {dirty && (
            <Button variant="primary" size="sm" disabled={loading}
              onClick={async () => {
                setError(null)
                try { await setStock({ variables: { variantId: variant.id, quantity: Number(qty) } }); onDone() }
                catch (e) { setError(e?.message ?? 'Алдаа') }
              }}>
              Хадгалах
            </Button>
          )}
        </span>
        {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}
      </td>
      <td className="px-6 py-3">
        <Status tone={variant.isActive ? 'green' : 'grey'}>{variant.isActive ? 'идэвхтэй' : 'идэвхгүй'}</Status>
      </td>
      <td className="px-6 py-3 text-right">
        {canDelete && (
          <Button variant="ghost" size="sm"
            onClick={async () => { await removeVariant({ variables: { variantId: variant.id } }); onDone() }}>
            Устгах
          </Button>
        )}
      </td>
    </tr>
  )
}

function VariantForm({ productId, onClose, onSaved }) {
  const [save, { loading }] = useMutation(ADMIN_UPSERT_VARIANT)
  const [f, setF] = useState({ sku: '', optionLabel: 'Өнгө', optionValue: '', priceMnt: '', quantity: '0' })
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <form className="grid gap-3 sm:grid-cols-5"
      onSubmit={async (e) => {
        e.preventDefault(); setError(null)
        try {
          await save({ variables: {
            productId, priceMnt: String(toNumber(f.priceMnt)), quantity: Number(f.quantity || 0),
            sku: f.sku || null, optionLabel: f.optionValue ? f.optionLabel : null,
            optionValue: f.optionValue || null, compareAtPriceMnt: null,
            allowBackorder: false, isActive: true, sortOrder: 0, variantId: null } })
          onSaved()
        } catch (e) { setError(e?.message ?? 'Алдаа гарлаа.') }
      }}>
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

- [ ] **Step 2: Verify**

Add a variant, change a stock number and save it, delete the spare. Deleting the **last** variant must fail with the guard message from `03_admin_catalog.sql` — "the last variant cannot be deleted".

- [ ] **Step 3: Lint and commit**

```bash
npx eslint components/admin/product/VariantsTab.jsx
git add components/admin/product/VariantsTab.jsx
git commit -m "feat(admin): product variants tab"
```

---

### Task 8: Images tab and SEO tab

**Files:**
- Modify: `components/admin/product/ImagesTab.jsx`, `components/admin/product/SeoTab.jsx`
- Delete: `components/ProductImageManager.jsx`

**Interfaces:**
- Consumes: `{ product, refetch }`; `ADMIN_ADD_IMAGE`, `ADMIN_DELETE_IMAGE`, `ADMIN_REORDER_IMAGES`, `ADMIN_UPSERT_PRODUCT`; `upload` from `@imagekit/next`; `/api/upload-auth`.
- Produces: nothing later tasks depend on.

**Note:** `ProductImageManager` refetches `ADMIN_PRODUCT_IMAGES`, the query behind the page being deleted. The tab must refetch through the `refetch` prop instead.

- [ ] **Step 1: Write the images tab**

Replace `components/admin/product/ImagesTab.jsx`:

```jsx
'use client'

import { useRef, useState } from 'react'
import { upload } from '@imagekit/next'
import { useMutation } from '@apollo/client/react'
import { ADMIN_ADD_IMAGE, ADMIN_DELETE_IMAGE, ADMIN_REORDER_IMAGES } from '@/lib/queries'
import { nodes } from '@/lib/format'
import ProductImage from '@/components/ProductImage'
import { Button, Card } from '@/components/admin/ui'

/**
 * Upload and order one product's images.
 *
 * Two-step by necessity: the browser uploads straight to ImageKit using a
 * signature minted server-side (the private key never reaches the client),
 * then records fileId + filePath in Postgres. If the second step fails the
 * asset is orphaned at ImageKit rather than the row pointing at nothing — the
 * recoverable direction.
 */
export default function ImagesTab({ product, refetch }) {
  const images = nodes(product.productImageCollection)
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)

  const [addImage] = useMutation(ADMIN_ADD_IMAGE)
  const [deleteImage] = useMutation(ADMIN_DELETE_IMAGE)
  const [reorder] = useMutation(ADMIN_REORDER_IMAGES)

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)

  const onFiles = async (files) => {
    setError(null)
    setBusy(true)
    try {
      for (const file of files) {
        const authRes = await fetch('/api/upload-auth')
        if (!authRes.ok) {
          throw new Error(authRes.status === 403
            ? 'Админ эрх шаардлагатай.' : 'Байршуулах эрх авахад алдаа гарлаа.')
        }
        const { token, signature, expire, publicKey } = await authRes.json()

        const result = await upload({
          file,
          fileName: `${product.slug}-${Date.now()}-${file.name}`,
          folder: `/hotaru/${product.slug}`,
          useUniqueFileName: true,
          publicKey, token, signature, expire,
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

  const applyOrder = async (next) => {
    await reorder({ variables: { productId: product.id, imageIds: next.map((i) => i.id) } })
    await refetch()
  }

  const move = async (index, delta) => {
    const next = [...images]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    await applyOrder(next)
  }

  const makePrimary = async (index) => {
    if (index === 0) return
    const next = [...images]
    const [picked] = next.splice(index, 1)
    await applyOrder([picked, ...next])
  }

  return (
    <Card
      title="Зураг"
      subtitle="Эхний зураг карт дээр, хоёр дахь нь hover дээр гарна."
      actions={
        <Button variant="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Байршуулж байна…' : 'Зураг нэмэх'}
        </Button>
      }
    >
      {!configured && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-700">
          ImageKit тохируулагдаагүй байна — .env.local доторх түлхүүрүүдийг шалгана уу.
        </p>
      )}

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => e.target.files?.length && onFiles(Array.from(e.target.files))} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const files = Array.from(e.dataTransfer.files ?? []).filter((f) => f.type.startsWith('image/'))
          if (files.length) onFiles(files)
        }}
        className={`rounded-lg border-2 border-dashed px-4 py-8 text-center text-[13px] transition-colors ${
          dragging ? 'border-a-focus bg-blue-50 text-a-ink' : 'border-a-line text-a-muted'
        }`}
      >
        Зургаа энд чирж оруулна уу
      </div>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

      {images.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={img.id} className="w-28">
              <div className="relative aspect-square overflow-hidden rounded-md bg-a-hover">
                <ProductImage filePath={img.filePath} alt={img.alt ?? ''} seed={img.id} sizes="112px" />
                <span className="absolute left-1 top-1 rounded bg-white/90 px-1.5 text-[11px] font-medium">
                  {i === 0 ? 'карт' : i === 1 ? 'hover' : i}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <button onClick={() => move(i, -1)} disabled={i === 0}
                  className="text-[13px] text-a-muted disabled:opacity-25" aria-label="Урагш">←</button>
                <button onClick={() => move(i, 1)} disabled={i === images.length - 1}
                  className="text-[13px] text-a-muted disabled:opacity-25" aria-label="Хойш">→</button>
                <button onClick={() => deleteImage({ variables: { imageId: img.id } }).then(refetch)}
                  className="ml-auto text-[12px] text-a-muted hover:text-red-600">
                  Устгах
                </button>
              </div>
              {i !== 0 && (
                <button onClick={() => makePrimary(i)}
                  className="mt-1 w-full text-[12px] text-a-muted hover:text-a-ink">
                  Үндсэн болгох
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Write the SEO tab**

Replace `components/admin/product/SeoTab.jsx`:

```jsx
'use client'

import { useState } from 'react'
import { useMutation } from '@apollo/client/react'
import { ADMIN_UPSERT_PRODUCT } from '@/lib/queries'
import { copy } from '@/lib/format'
import { Button, Card, Field, Input, Textarea } from '@/components/admin/ui'

export default function SeoTab({ product, refetch }) {
  const c = copy(product)
  const initial = { seoTitle: c.seoTitle ?? '', seoDescription: c.seoDescription ?? '' }
  const [f, setF] = useState(initial)
  const [error, setError] = useState(null)
  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)

  const dirty = f.seoTitle !== initial.seoTitle || f.seoDescription !== initial.seoDescription

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      // The whole product goes back, because admin_upsert_product is an upsert
      // over the translation row — sending only SEO would blank the copy.
      await save({ variables: {
        productId: product.id,
        slug: product.slug,
        title: c.title ?? product.slug,
        categorySlug: product.category?.slug ?? null,
        subtitle: c.subtitle ?? null,
        description: c.description ?? null,
        careDetails: c.careDetails ?? null,
        status: product.status,
        isFeatured: product.isFeatured,
        sortOrder: product.position ?? 0,
        seoTitle: f.seoTitle.trim() || null,
        seoDescription: f.seoDescription.trim() || null,
      } })
      await refetch()
    } catch (err) {
      setError(err?.message ?? 'Хадгалахад алдаа гарлаа.')
    }
  }

  const shownTitle = f.seoTitle || c.title || product.slug
  const shownDesc = f.seoDescription || c.description || ''

  return (
    <Card
      title="SEO"
      subtitle="Хоосон бол бүтээгдэхүүний нэр, тайлбарыг ашиглана."
      actions={
        <Button form="seo-form" type="submit" variant="primary" disabled={!dirty || loading}>
          {loading ? 'Хадгалж байна…' : 'Хадгалах'}
        </Button>
      }
    >
      <form id="seo-form" className="grid gap-4" onSubmit={onSubmit}>
        <Field label="SEO гарчиг" hint={`${f.seoTitle.length}/60 тэмдэгт`}>
          <Input value={f.seoTitle} onChange={(e) => setF({ ...f, seoTitle: e.target.value })} />
        </Field>
        <Field label="SEO тайлбар" hint={`${f.seoDescription.length}/160 тэмдэгт`}>
          <Textarea rows={3} value={f.seoDescription}
            onChange={(e) => setF({ ...f, seoDescription: e.target.value })} />
        </Field>

        <div className="rounded-lg border border-a-line bg-a-bg px-4 py-3">
          <p className="mb-2 text-[12px] font-medium text-a-muted">Хайлтад ийм харагдана</p>
          <p className="truncate text-[16px] text-blue-800">{shownTitle}</p>
          <p className="text-[12px] text-emerald-700">hotaru.mn/shop/{product.slug}</p>
          <p className="line-clamp-2 text-[13px] text-a-muted">{shownDesc}</p>
        </div>

        {error && <p className="text-[13px] text-red-600">{error}</p>}
      </form>
    </Card>
  )
}
```

- [ ] **Step 3: Delete the old manager**

```bash
git rm components/ProductImageManager.jsx
```

- [ ] **Step 4: Verify**

On the Зураг tab: drag two files onto the drop zone; both upload and appear labelled `карт` and `hover`. Click `Үндсэн болгох` on the second — the labels swap. Delete one. Then open the storefront product page and confirm the card image matches.

On the SEO tab: type a title, save, reload, confirm it persisted. Go to Мэдээлэл, change the subtitle, save, return to SEO — **the SEO title must still be there.**

- [ ] **Step 5: Lint and commit**

```bash
npx eslint components/admin/product/
git add -A components/
git commit -m "feat(admin): images and SEO tabs, retiring ProductImageManager"
```

---

### Task 9: New product flow

**Files:**
- Create: `app/admin/products/new/page.js`

**Interfaces:**
- Consumes: `ADMIN_PRODUCTS` (for the category list), `ADMIN_UPSERT_PRODUCT`, `ADMIN_UPSERT_VARIANT`, `slugify` (Task 2).
- Produces: nothing later tasks depend on.

**Why a separate route rather than the editor with disabled tabs:** images need a `product_id`, and a product needs a price to be sellable. A short create form that then lands the user *inside* the editor is more honest than four tabs where three are inert.

- [ ] **Step 1: Write the page**

Create `app/admin/products/new/page.js`:

```jsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { ADMIN_PRODUCTS, ADMIN_UPSERT_PRODUCT, ADMIN_UPSERT_VARIANT } from '@/lib/queries'
import { firstNode, nodes, toNumber } from '@/lib/format'
import { slugify } from '@/lib/slug'
import { Button, Card, Field, Input, PageHeader, Select } from '@/components/admin/ui'

export default function NewProductPage() {
  const router = useRouter()
  const { data } = useQuery(ADMIN_PRODUCTS, { fetchPolicy: 'cache-first' })
  const categories = nodes(data?.categoryCollection)

  const [f, setF] = useState({
    title: '', slug: '', categorySlug: '', priceMnt: '', quantity: '0', status: 'draft',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState(null)

  const [save, { loading }] = useMutation(ADMIN_UPSERT_PRODUCT)
  const [addVariant] = useMutation(ADMIN_UPSERT_VARIANT)

  // Slug tracks the title until the operator takes it over.
  const onTitle = (e) => {
    const title = e.target.value
    setF((cur) => ({ ...cur, title, slug: slugTouched ? cur.slug : slugify(title) }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      const res = await save({ variables: {
        slug: f.slug.trim(),
        title: f.title.trim(),
        categorySlug: f.categorySlug || null,
        subtitle: null, description: null, careDetails: null,
        status: f.status, isFeatured: false, sortOrder: 0, productId: null,
        seoTitle: null, seoDescription: null,
      } })

      const id = res.data.adminUpsertProduct.id

      await addVariant({ variables: {
        productId: id,
        priceMnt: String(toNumber(f.priceMnt)),
        quantity: Number(f.quantity || 0),
        sku: null, optionLabel: null, optionValue: null, compareAtPriceMnt: null,
        allowBackorder: false, isActive: true, sortOrder: 0, variantId: null,
      } })

      // Straight to images — the step that was impossible before.
      router.replace(`/admin/products/${id}?tab=images`)
    } catch (err) {
      setError(err?.message ?? 'Үүсгэхэд алдаа гарлаа.')
    }
  }

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-block text-[13px] text-a-muted hover:text-a-ink">
        ← Бараа
      </Link>
      <PageHeader title="Шинэ бүтээгдэхүүн"
        subtitle="Үүсгэсний дараа зураг, сонголт, SEO-г нэмнэ." />

      <Card title="Үндсэн мэдээлэл">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <Field label="Нэр" required>
            <Input required value={f.title} onChange={onTitle} placeholder="Нэхмэл мөрний цүнх" />
          </Field>
          <Field label="Slug" required hint="Нэрнээс автоматаар үүснэ">
            <Input required value={f.slug}
              onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value }) }} />
          </Field>
          <Field label="Ангилал">
            <Select value={f.categorySlug} onChange={(e) => setF({ ...f, categorySlug: e.target.value })}>
              <option value="">—</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {firstNode(cat.categoryTranslationCollection)?.name ?? cat.slug}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Төлөв">
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="active">active</option>
            </Select>
          </Field>
          <Field label="Үнэ (₮)" required hint="Эхний сонголт үүснэ">
            <Input required value={f.priceMnt}
              onChange={(e) => setF({ ...f, priceMnt: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="Үлдэгдэл">
            <Input value={f.quantity}
              onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} />
          </Field>

          {error && <p className="text-[13px] text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Үүсгэж байна…' : 'Үүсгээд зураг нэмэх'}
            </Button>
            <Button type="button" onClick={() => router.push('/admin/products')}>Болих</Button>
          </div>
        </form>
      </Card>
    </>
  )
}
```

- [ ] **Step 2: Verify the whole reason this project exists**

From `/admin/products`, click `Шинэ бүтээгдэхүүн`. Type `Ноосон малгай` — the slug fills in as `nooson-malgai` on its own. Enter a price. Submit. You land on `/admin/products/<id>?tab=images`. Upload a photo. Open the storefront and see it.

Then create a second product and **type your own slug** — confirm it stops tracking the title.

- [ ] **Step 3: Lint and commit**

```bash
npx eslint app/admin/products/new/page.js
git add app/admin/products/new/page.js
git commit -m "feat(admin): create a product and land on its images"
```

---

### Task 10: Retire the old routes

**Files:**
- Delete: `app/admin/images/page.js`
- Modify: `components/admin/AdminShell.jsx:17-24`, `components/admin/CommandPalette.jsx:52`
- Modify: `lib/queries.js` (remove `ADMIN_PRODUCT_IMAGES`)

**Interfaces:**
- Consumes: everything above.
- Produces: a navigation with no dead links.

- [ ] **Step 1: Delete the images page**

```bash
git rm app/admin/images/page.js
rmdir app/admin/images 2>/dev/null || true
```

- [ ] **Step 2: Fix the nav**

In `components/admin/AdminShell.jsx`, replace `NAV`:

```js
const NAV = [
  { href: '/admin', label: 'Захиалга', icon: Orders, exact: true, badge: 'pending' },
  { href: '/admin/products', label: 'Бараа', icon: Products },
  { href: '/admin/discounts', label: 'Хөнгөлөлт', icon: Tag },
  { href: '/admin/reviews', label: 'Сэтгэгдэл', icon: Star },
  { href: '/admin/settings', label: 'Тохиргоо', icon: Settings },
]
```

Then remove `ImageIcon` and `Inventory` from the `./icons` import if they are now unused — eslint will flag them.

- [ ] **Step 3: Deep-link the command palette**

In `components/admin/CommandPalette.jsx:52`, change the product result href:

```js
        href: `/admin/products/${p.id}`,
```

This is the payoff the editor unlocks — until now every ⌘K product result dumped the operator on the inventory list with no idea which row they wanted.

- [ ] **Step 4: Remove the orphaned query**

Delete the `ADMIN_PRODUCT_IMAGES` export from `lib/queries.js:514`. Confirm nothing references it:

```bash
grep -rn "ADMIN_PRODUCT_IMAGES" app components lib
```

Expected: no output.

- [ ] **Step 5: Full verification**

```bash
grep -rn "admin/inventory\|admin/images" app components lib
```

Expected: no output — no dead links anywhere.

```bash
npx eslint .
npx next build
npm run test:unit
npm run test:db
```

Expected: all clean.

Then walk the sidebar: Захиалга, Бараа, Хөнгөлөлт, Сэтгэгдэл, Тохиргоо all load. ⌘K, type a product name, hit Enter — the editor opens on that product.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(admin): retire /admin/inventory and /admin/images"
```

---

## Done when

- A product can be created from empty and given photographs without leaving the flow.
- `/admin/products/<id>?tab=images` is a real, linkable address.
- ⌘K product search opens the right editor.
- SEO copy has a write path for the first time.
- No reference to `/admin/inventory` or `/admin/images` survives.
- `npm run test:unit`, `npm run test:db`, `npx next build`, `npx eslint .` all pass.
