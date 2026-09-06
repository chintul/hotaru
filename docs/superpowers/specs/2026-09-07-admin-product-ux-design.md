# Admin product editing and bulk actions — design

Date: 2026-09-07
Status: approved, ready for implementation planning

## Problem

Three complaints, one root cause: the admin has no product editor.

`app/admin/inventory/page.js` is a 315-line page that stacks a product list, an
inline create/edit `Card`, and an expanded variant panel on one screen. Adding a
product means filling a form wedged above the table; editing means finding the
row, expanding it, then clicking through to a second form. Nothing is
deep-linkable — there is no URL for "the Woven Bag product".

Images live somewhere else entirely. `app/admin/images/page.js` renders every
product in the catalog as a card with an uploader attached. Nothing connects
editing a product to its photographs, and a **product created today cannot have
images at all** — the upload path needs a `product_id` that does not exist until
after the first save, and the create form never gets there.

No admin table has a selection concept. `DataTable`
(`components/admin/ui.jsx:107`) spends its only interaction, `onRowClick`, on
navigation or expand/collapse. Publishing eight drafts is eight round trips
through a form.

## Decisions taken

| # | Decision | Why |
|---|----------|-----|
| 1 | Dedicated route `/admin/products/[id]` with tabs, not a drawer or a bigger inline card | Deep-linkable, and images and variants need room a drawer cannot give them. Owner's call, 2026-09-07 |
| 2 | Hybrid bulk execution: SQL functions for the catalog, a client loop for orders | Catalog bulk ops have no per-row business guards, so atomic is correct. `admin_set_order_status` has real guards, so partial success is the honest semantic — see "The orders exception" |
| 3 | Selection lives in its own module, not inside `DataTable` | The reviews page is a card list, not a table, and must share the same selection and the same bulk bar |
| 4 | `/admin/images` is deleted, not kept alongside | Two places to manage one product's photos is the bug, not the fix |
| 5 | Details and SEO save explicitly; variants and images apply immediately | Variants and images already have their own per-row mutations. A Save button over them would claim a transaction that does not exist |
| 6 | Hard delete is offered for products | `order_items` snapshots title, price, sku and image, and its product/variant FKs are `on delete set null` (`supabase/migrations/20260904120100_tables.sql:304`). Order history survives. Owner's call, 2026-09-07 |
| 7 | All four admin tables get selection | Owner's call, 2026-09-07, taken with the orders risk stated |

## Non-goals

Drag-to-reorder images, variant matrix generation (size × colour), image
cropping or editing, undo for bulk actions, order bulk actions beyond status,
pagination or server-side filtering of the product list, a flat cross-product
stock-count view.

The product list keeps its current `first: 100` ceiling. Selection is
client-side over loaded rows; nothing here introduces "select all 4,000
matching" semantics, and the code must not imply it.

## Routes

| Now | After |
|---|---|
| `/admin/inventory` — list + inline form + variant panel | `/admin/products` — list only, with selection and bulk actions |
| — | `/admin/products/[id]` — editor. Tab in `?tab=details\|variants\|images\|seo` |
| — | `/admin/products/new` — same editor, non-details tabs disabled until first save |
| `/admin/images` — every product as a card | deleted |

`NAV` in `components/admin/AdminShell.jsx:17` drops the Зураг entry and points
Бараа at `/admin/products`. `useCrumbs` already renders `Бараа / …` for a child
route; the editor page carries its own back link and product title in a
`PageHeader`, so the crumb stays generic.

`/admin/inventory` and `/admin/images` are deleted outright, with no redirect
stub. One operator, one bookmark set, and the nav updates in the same commit.

`components/admin/CommandPalette.jsx:52` currently sends **every** product search
result to `/admin/inventory` — a placeholder, because until now there was no
product URL to send it to. It becomes `/admin/products/${p.id}`, which turns the
existing ⌘K product search into the fastest way to open an editor.

## Architecture

| Unit | Responsibility | Depends on |
|---|---|---|
| `components/admin/selection.jsx` | `useSelection(rows)` hook, `BulkBar`, `SelectCell`, `SelectAllCell` | — |
| `lib/admin/selection.js` | Pure selection reducer — toggle, toggleAll, prune-to-visible. Unit-testable without React | — |
| `lib/admin/bulk.js` | `runBulk(ids, fn)` sequential runner returning `{ ok, failed }` | — |
| `lib/slug.js` | `slugify(text)` with Cyrillic → Latin transliteration | — |
| `components/admin/BulkResult.jsx` | Renders `{ ok, failed }` as "12 амжилттай · 3 алдаа" plus the failure list | — |
| `components/admin/product/DetailsTab.jsx` | Title, slug, subtitle, category, description, care, status, featured | `adminUpsertProduct` |
| `components/admin/product/VariantsTab.jsx` | Variant rows, add, edit, delete, stock | existing variant mutations |
| `components/admin/product/ImagesTab.jsx` | Upload, drop zone, reorder, make-primary, delete | `ProductImageManager` internals |
| `components/admin/product/SeoTab.jsx` | `seoTitle`, `seoDescription`, live serp preview | `adminUpsertProduct` |
| `app/admin/products/page.js` | List, search, selection, bulk actions | `useSelection`, bulk mutations |
| `app/admin/products/[id]/page.js` | Editor shell, tab routing, dirty guard | the four tabs |

`ProductImageManager` (`components/ProductImageManager.jsx`) moves under
`components/admin/product/ImagesTab.jsx`. It is admin-only and was never used by
the storefront; leaving it at the top of `components/` implied otherwise.

## Selection

```js
const sel = useSelection(rows)
// sel.selected      Set<id>
// sel.isSelected(row)
// sel.toggle(row), sel.toggleAll(), sel.clear()
// sel.count, sel.allSelected, sel.someSelected
```

The hook is a thin React wrapper. The state transitions themselves — toggle,
toggleAll, prune — live as pure functions in `lib/admin/selection.js`, which is
what `node --test` exercises.

Keyed on `row.id`. When `rows` changes — a search term, a status filter — the
selection **prunes to the ids still visible**. Filtering to drafts, selecting
them, then clearing the filter must not leave invisible rows armed for a bulk
action.

`DataTable` gains two optional props, `selection` and `bulkActions`. Present: a
leading checkbox column, a select-all in the header, and `BulkBar` replacing the
toolbar row while `count > 0`. Absent: renders exactly as it does today. Every
existing call site — `app/admin/page.js:57`, `app/admin/discounts/page.js:99` —
is untouched by the change.

`SelectCell` stops click propagation, so row-click still navigates or expands.

The reviews page keeps its cards. Each `ReviewCard` grows a checkbox in its
header and the page renders the same `BulkBar` above the list. This is the
reason selection is a hook and not a `DataTable` internal.

## Bulk actions

| Table | Actions |
|---|---|
| Products | Set status (draft / active / archived), feature, unfeature, assign category, delete |
| Reviews | Approve, unapprove, delete |
| Discounts | Activate, deactivate, delete |
| Orders | Set status — loop path, see below |

`BulkBar` renders the count, a `Үйлдэл ▾` dropdown, and a clear button. Menu
items run straight from the dropdown, except **assign category**, which opens a
small popover holding a category `Select` plus an Apply button — a category
cannot be chosen by picking a menu item.

Delete requires typing `УСТГАХ` to confirm. Every other action takes a plain
confirm naming the count and the effect. Archive sits above delete in the menu;
delete sits last, separated by a rule.

### SQL path

One migration, `supabase/migrations/20260907120000_admin_bulk_actions.sql`:

```sql
admin_bulk_set_product_status(product_ids uuid[], status text)    returns setof products
admin_bulk_set_product_featured(product_ids uuid[], is_featured boolean) returns setof products
admin_bulk_set_product_category(product_ids uuid[], category_slug text)  returns setof products
admin_bulk_delete_products(product_ids uuid[])                    returns integer
admin_bulk_set_review_approval(review_ids uuid[], approved boolean)      returns setof reviews
admin_bulk_delete_reviews(review_ids uuid[])                      returns integer
admin_bulk_set_discount_active(discount_ids uuid[], is_active boolean)   returns setof discount_codes
admin_bulk_delete_discounts(discount_ids uuid[])                  returns integer
```

Every one: `volatile`, `language plpgsql`, `security definer`,
`set search_path = public, pg_temp`, and an `is_admin()` guard raising `42501`
first thing — the shape already established in
`supabase/migrations/20260905020000_admin_write_functions.sql`.

`admin_bulk_set_product_status` validates its `status` against
`public.product_status` by casting, so a bad value raises rather than silently
matching nothing. `admin_bulk_set_product_category` resolves the slug once and
raises `P0002` if no such category exists, rather than nulling the category on
every selected row.

pg_graphql reflects these as `adminBulkSetProductStatus` and so on through the
existing `inflect_names` directive (`supabase/migrations/20260904120400_graphql.sql:15`).
No new comment directives are needed. Functions returning `setof` surface as
connections — the same shape `adminReorderProductImages` already returns.

### The orders exception

`admin_set_order_status` (`supabase/migrations/20260905020000_admin_write_functions.sql:21`)
refuses `packed`, `shipped` and `delivered` unless `payment_status = 'confirmed'`,
and refuses `cancelled` outright because cancellation must return stock through
`cancel_order`. A selection of twenty orders will routinely contain rows that
must fail while the rest succeed.

So orders use `runBulk(ids, fn)` from `lib/admin/bulk.js`: sequential, one
existing single-row mutation per order, collecting
`{ ok: [id], failed: [{ id, message }] }`. Sequential rather than parallel so a
guard failure stays attributable and the database is not hit with twenty
concurrent `for update` locks.

`BulkResult` then reports "17 амжилттай · 3 алдаа" and lists the three by order
number with the message Postgres gave. The `cancelled` option is absent from the
orders bulk menu entirely — offering an action that always fails is worse than
not offering it.

Each successful order status change sends a customer email. The confirm dialog
says so, with the count.

## Product editor

Tab state lives in `?tab=`, so a tab is linkable and the back button works.

**Details and SEO** are form-shaped: local state, dirty tracking, an explicit
Save issuing one `adminUpsertProduct`. Save is disabled while clean. A
`beforeunload` guard and an in-app confirm fire when leaving dirty.

**Variants and images** apply immediately through the mutations they already
have. No Save button — there is no transaction for one to commit.

**Images tab** carries `ProductImageManager`'s current behaviour (ImageKit
signature from `/api/upload-auth`, upload, then record via `adminAddProductImage`)
and adds a drag-and-drop drop zone plus a "make primary" action that reorders the
chosen image to position 0. Reorder stays the existing ← → buttons.

**New product.** `/admin/products/new` renders Details only; the other three
tabs are visible but disabled, labelled `Эхлээд хадгална уу`. Required to
create: title, slug, price. First save runs `adminUpsertProduct` then
`adminUpsertVariant` for the opening variant, exactly as the current form does,
then `router.replace('/admin/products/<id>?tab=images')` — landing the user on
the thing that was previously impossible.

**Slug.** `lib/slug.js` transliterates a Cyrillic title to a Latin slug
(`Цүнх` → `tsunkh`) and fills the slug field while the user has not typed one of
their own. Once the slug field is edited by hand it stops tracking the title.

## Testing

`tests/sql/07_admin_bulk.sql`, run by `scripts/test-db.sh` against a throwaway
Postgres, per function:

- a non-admin caller raises `42501`
- every id in the array is affected, and ids outside it are not
- delete functions return an accurate count
- `admin_bulk_set_product_category` with an unknown slug raises and changes nothing
- **an order line still reads correctly after its product is hard-deleted** —
  the guarantee decision 6 rests on

`tests/unit/`, run by `node --test`:

- `selection.test.js` — toggle, toggleAll, and the prune-to-visible rule
- `bulk.test.js` — `runBulk` aggregates partial failure, keeps order, does not
  abort the batch on a rejection
- `slug.test.js` — Cyrillic transliteration, collision-free ascii output, empty
  and punctuation-only input

The pure logic sits in `lib/admin/` precisely so `node --test` can reach it
without a DOM.

Manual check before calling it done: create a product from empty, land on the
images tab, upload two images, add a second variant, publish it, then select it
plus two others and bulk-archive.

## Sequencing

Two tracks that share only `components/admin/ui.jsx`, and can land in either
order:

- **Track A — selection and bulk actions.** Migration, `lib/admin/*`,
  `components/admin/selection.jsx`, `DataTable` props, then the four consuming
  pages. Ships value with the product editor still unbuilt.
- **Track B — the product editor.** Routes, tabs, image move, slug helper,
  `CommandPalette` href, deletion of `/admin/inventory` and `/admin/images`.

Track A first: it is the smaller surface, and Track B's new `/admin/products`
list wants the selection props to already exist rather than being retrofitted.

Track B carries a second, smaller migration. `product_translations.seo_title`
and `.seo_description` have existed since the first migration and are read by
the storefront, but **no write path reaches them** — `admin_upsert_product` does
not take them, and the only values in the table came from a one-off data fix
(`20260905150000_seo_title_no_brand.sql`). The SEO tab needs `admin_upsert_product`
extended, and because adding parameters creates an overload rather than
replacing the function, the old signature must be dropped explicitly or
pg_graphql's reflection turns ambiguous.

## Risks and open items

1. **Orders bulk-status is the sharp edge.** Guards mean partial failure is
   normal, and each success emails a customer. Mitigated by the count in the
   confirm, the per-row report, and dropping `cancelled` from the menu. Accepted
   by the owner with the risk stated.
2. **Hard delete is irreversible.** Mitigated by the typed confirmation and by
   `order_items` snapshots. Archive remains the default suggestion in the menu
   ordering.
3. **`ProductImageManager` moving file paths** touches an import in the deleted
   `/admin/images` page only. Low risk, but the deletion and the move land in
   the same commit so no state exists where both point at nothing.
4. **Selection prune-on-filter** could surprise someone who expects a selection
   to survive a search. The alternative — acting on rows you cannot see — is
   worse.
