# Admin variant images and a tabless product editor — design

Date: 2026-09-07
Status: approved, ready for implementation planning
Supersedes decisions 1 and 5 of `2026-09-07-admin-product-ux-design.md`, and
reverses one line of its non-goals.

## Problem

### 1. The variant → image link has no admin surface at all

`variants.image_id` (`supabase/migrations/20260904120100_tables.sql:167`) is what
the storefront actually renders. `ProductCard.jsx:35` reads
`variant?.image ?? images[0]` for the card photo, and `ProductCard.jsx:41-49`
walks the variant list to pick the hover photo. The swatch row, the card image
and the hover swap are all driven by this column.

Nothing in the admin can read it or write it:

- `admin_upsert_variant` (`20260905020000_admin_write_functions.sql:195`) has no
  `image_id` parameter. A variant created in the admin gets `image_id` null,
  falls back to `images[0]`, and its swatch silently does nothing.
- `ADMIN_PRODUCT_DETAIL` (`lib/queries.js:828`) does not select `variant.image`.
  The admin cannot even display the link.
- `VariantsTab.jsx` has no image column.

The column has therefore only ever been set by hand-written SQL, and the history
shows what that costs:

| Migration | What it did |
|---|---|
| `20260905060000_category_hero_variant_images.sql` | Paired variant to image **by position**. Correct only while the two lists happen to line up. |
| `20260905100000_variant_featured_images.sql` | Fix. Computed every new row's `position` as `max(position)+1` in a per-row subquery, so all rows of one product collided on `unique (product_id, position)` and `on conflict do nothing` discarded 11 of 12. |
| `20260905110000_variant_featured_images_fix.sql` | Fix of the fix. |

Three migrations and two bug reports for a link the operator should be able to
make by clicking a photo.

### 2. The tabs hide the relationship, and one of them lies

`app/admin/products/[id]/page.js:15` splits the editor into four tabs. Images
and variants — the two halves of a single decision — are on different screens,
so the editor can never show that a variant has no photo.

`ImagesTab.jsx:145` labels image tiles `карт / hover / 2 / 3`. That contract is
true only when no variant has an image; the moment one does, `ProductCard.jsx`
stops consulting position for the card and hover photos. The admin is asserting
a rule the storefront no longer follows. The card subtitle at
`ImagesTab.jsx:98` states it in prose too.

### 3. Two forms over one mutation

`SeoTab.jsx:23-31` re-sends the entire product — including `c.description` read
from the Apollo cache — because `admin_upsert_product` upserts the translation
row as a whole. Edit the description, then save SEO from stale cache, and the
description is clobbered. Two forms, one mutation, no transaction between them.

## Decisions taken

| # | Decision | Why |
|---|----------|-----|
| 1 | Tabs removed. One scrolling editor page | Owner's call, 2026-09-07 ("no tab"). Images and variants are one decision and must be visible together |
| 2 | Details and SEO merge into one form issuing one `adminUpsertProduct` | Deletes the clobber path in `SeoTab.jsx:23-31` rather than documenting it |
| 3 | Variant-led layout: the image is the first **column of the variant row**, not a separate grid | Owner's call, 2026-09-07. Matches `ProductCard.jsx:35` — the variant is the unit, the image is its attribute |
| 4 | Uploading from the variant row is the primary upload path | For hotaru a variant essentially *is* a photo. The real task is "new colourway arrived, here is its picture" |
| 5 | The orphan warning before deleting an image is computed **client-side**, not by changing the SQL function's return type | The admin already holds every variant and its `image.id` after decision 8. Changing `admin_delete_product_image` from `boolean` needs a drop, a recreate and a re-grant for a warning the client can compute exactly |
| 6 | `admin_upsert_variant` is dropped and recreated with `image_id`, not overloaded | Adding a parameter creates an overload, and two overloads make pg_graphql's reflection ambiguous — learned in `20260907130000_product_seo_copy.sql:9-12` |
| 7 | A separate `admin_set_variant_image` exists alongside the upsert | The upsert coalesces a null `image_id` to the stored value so the row editor never wipes a photo it did not send. That leaves no way to *clear* one, which is what this function is for |
| 8 | The `карт` / `hover` badges render only when **no** variant has an image | That is the only case where position still decides those two slots |
| 9 | Gallery reorder becomes drag, with the arrow buttons kept as the keyboard path | Reverses the "drag-to-reorder images" non-goal of the previous spec. Native HTML5 drag, no dependency |

## Non-goals

Variant matrix generation (size × colour), image cropping, more than one image
per variant, bulk assign across products, undo, and any storefront change —
`ProductCard.jsx` and the PDP already consume `variant.image` correctly and are
not touched.

`/admin/products/new` is unchanged. There is no product id before the first
save, so there is nothing to attach an image to; it still creates and redirects
into the editor.

## Page shape

`app/admin/products/[id]/page.js` becomes one scroll. The `?tab=` parameter is
dropped; an old link with one lands at the top of the page rather than 404ing.

```
← Бараа

Cherry Jam clip                          ● active   [Хадгалах]   ← sticky
metal-floral-hair-clip

┌─ Мэдээлэл ────────────────────────────────────────────────────┐
│ Нэр · Slug · Дэд гарчиг · Ангилал                             │
│ Тайлбар · Арчилгаа                                            │
│ Төлөв · Онцлох                                                │
│ ── SEO ─────────────────────────────────────────────────────  │
│ SEO гарчиг · SEO тайлбар      + хайлтад ийм харагдана preview  │
└───────────────────────────────────────────────────────────────┘

┌─ Зураг ба сонголт ──────────────── [+ Зураг]  [+ Сонголт] ────┐
│ шууд хадгалагдана                                             │
│                                                               │
│  ▦   Cherry Jam       HTR-01   45,000₮   12ш   ●   ⋮          │
│  ▦   Cream Cookies    HTR-02   45,000₮    0ш   ●   ⋮          │
│  ▦²  Berry Stripes    HTR-03   45,000₮    4ш   ○   ⋮          │
│  ⬚   Tortoise Brown   HTR-04   45,000₮    7ш   ●   ⋮          │
│      ↑ зураггүй — картад эхний зураг харагдана                │
│                                                               │
│ Галерей · сонголтод холбоогүй                                 │
│  [▦] [▦] [▦]          ← чирж эрэмбэлнэ                        │
└───────────────────────────────────────────────────────────────┘
```

The sticky bar owns the product form only. Variant and image edits keep their
existing immediate-mutation behaviour (decision 5 of the previous spec still
holds for those two), and the card subtitle says `шууд хадгалагдана` so the two
save models are never ambiguous on one screen.

`▦²` is the shared-image badge. Two variants may point at one photo; that is
legal, but `ProductCard.jsx:41-49` then walks forward looking for a hover photo
that differs, and if none does the hover renders dead. The badge shows the cause
at the point where it can be fixed — the exact symptom
`20260905100000_variant_featured_images.sql:5-8` describes debugging.

## The picker

Clicking a variant's thumbnail opens a popover anchored to it:

```
┌───────────────────────────────┐
│ Бүтээгдэхүүний зураг          │
│  [▦] [▦] [▦] [▦] [▦]         │
│   ✓                           │
│  ┌─────────────────────────┐  │
│  │  +   шинэ зураг         │  │
│  └─────────────────────────┘  │
│  зураг салгах                 │
└───────────────────────────────┘
```

- Picking an existing tile calls `adminSetVariantImage`.
- `зураг салгах` calls it with a null image id.
- `+ шинэ зураг` opens a file picker and runs the full chain below.

### Upload from a variant

1. `GET /api/upload-auth` for a signature — unchanged, the private key never
   reaches the browser.
2. `upload()` to ImageKit under `/hotaru/<slug>`.
3. `adminAddProductImage` records `fileId` + `filePath`, appended at
   `max(position)+1`.
4. `adminSetVariantImage(variant.id, newImage.id)`.
5. One `refetch()`.

A variant photo **is** a product photo: it lands in the gallery and the PDP
shows it with the rest, which is what the reference site does.

If step 4 fails after step 3 succeeded, the image sits in the gallery unlinked
and the variant stays empty — both visible, and re-linkable with one click. That
is the same recoverable direction `ImagesTab.jsx:12-19` already reasons about for
steps 2 and 3.

## Data layer

One migration, `supabase/migrations/20260907140000_variant_images.sql`.

```sql
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
```

On update, `image_id = coalesce(new, stored)` — null means "this caller did not
supply one", never "clear it", so the inline row editor cannot wipe a photo it
never sent. Same rule `admin_upsert_product` already applies to the SEO columns
(`20260907130000_product_seo_copy.sql`).

```sql
create function public.admin_set_variant_image(variant_id uuid, image_id uuid)
returns public.variants
```

`is_admin()` guard raising `42501` first. Then: a non-null `image_id` must name
a row in `product_images` whose `product_id` matches the variant's, or it raises
`22023`. A null `image_id` clears the link — this is the only way to clear one.

Both get the `volatile / plpgsql / security definer / set search_path` shape
used by every other admin write, and both are added to the `revoke ... from
public, anon` and `grant ... to authenticated` blocks. The revoke is not
optional: Postgres grants EXECUTE to PUBLIC on every new function, anon inherits
PUBLIC, and `tests/sql/02_guards.sql:78-86` fails if an unreviewed SECURITY DEFINER
function is anon-executable. The drop in the first statement also discards the
old function's grants, so both halves must be restored.

`admin_delete_product_image` is untouched. `variants.image_id` is already
`on delete set null`, so the database stays consistent; only the warning is new,
and it is client-side (decision 5).

## GraphQL

`lib/queries.js`:

- `ADMIN_PRODUCT_DETAIL` variant node gains `image { id filePath alt }`.
- `ADMIN_UPSERT_VARIANT` gains `$imageId: UUID`.
- new `ADMIN_SET_VARIANT_IMAGE`, reflected as `adminSetVariantImage` by the
  existing `inflect_names` directive
  (`20260904120400_graphql.sql:14`) — no new comment directive needed.

## Components

| Unit | Responsibility | Depends on |
|---|---|---|
| `app/admin/products/[id]/page.js` | Shell: query, header, sticky save bar, two cards. No tab state, no `useSearchParams` | the two sections |
| `components/admin/product/ProductForm.jsx` | Details **and** SEO in one form, one `adminUpsertProduct`, dirty tracking, `beforeunload` guard | `adminUpsertProduct` |
| `components/admin/product/MediaVariants.jsx` | The merged card: variant rows, the gallery strip, both add buttons, upload plumbing | `lib/admin/images.js` |
| `components/admin/product/VariantRow.jsx` | One row: thumbnail, inline edit of option value / SKU / price / qty / active, per-row save, delete with confirm | `adminUpsertVariant`, `adminSetStock`, `adminDeleteVariant` |
| `components/admin/product/ImagePicker.jsx` | The popover. Owns select, clear, and the upload chain | `adminAddProductImage`, `adminSetVariantImage` |
| `lib/admin/images.js` | Pure. `linkage(images, variants)` → per-image variant names, shared-image counts, unlinked list, orphan count for a given image, and `positionStillRules` | — |

Deleted: `DetailsTab.jsx`, `SeoTab.jsx`, `VariantsTab.jsx`, `ImagesTab.jsx`.

`components/admin/ui.jsx` gains two primitives, both of which the picker needs
and neither of which exists: `Thumb` (fixed-size rounded image or dashed empty
state) and `Popover` (anchored, click-outside to close — the dismiss logic in
`BulkBar` at `ui.jsx:118-126` is the same pattern and should be shared rather
than copied a third time).

The linkage rules live in `lib/admin/images.js` and not in the component
precisely so `node --test` can reach them without a DOM — the same split the
previous spec used for `lib/admin/selection.js`.

## Variant rows become editable

Today only stock is editable (`VariantsTab.jsx:72`). Changing a colour name or a
price means deleting the variant and re-adding it, which destroys the row and,
after this change, its image link too.

Each row edits option value, SKU, price, quantity and active state in place. A
dirty row grows a `Хадгалах` button — the interaction `VariantsTab.jsx:90`
already uses for stock, extended to the rest of the row. Quantity alone still
goes through `adminSetStock`; any other field sends the row through
`adminUpsertVariant` with its `variantId`. Delete moves into the `⋮` menu and
takes a confirm naming the variant.

## Cute and simple

The admin palette is a deliberately neutral console, kept separate from the
storefront on purpose (`app/globals.css:44-52`). This does not replace it — it
softens the one screen the owner spends the most time on:

- Thumbnails 44px, `rounded-xl`. Empty state is a dashed square of the same size.
- Stock uses the storefront's existing soft tints — `--color-mint` for in stock,
  `--color-blush` for zero. Already declared (`globals.css:35-40`); no new
  palette, no new tokens.
- One row of controls per variant, not three. Everything beyond save and the
  thumbnail lives behind `⋮`.
- Empty states are one line of plain Mongolian in a dashed box. No banners.
- The gallery strip reorders by dragging. `←` `→` stay as the keyboard path,
  because native HTML5 drag has no keyboard equivalent.

## Testing

`tests/sql/08_variant_images.sql`, run by `scripts/test-db.sh`:

- a non-admin caller of `admin_set_variant_image` raises `42501`
- an image belonging to a **different product** raises `22023` and changes nothing
- a null `image_id` clears the link
- `admin_upsert_variant` with a null `image_id` leaves a stored image untouched
- `admin_upsert_variant` with an `image_id` sets it on both the insert and the
  update path
- deleting a product image nulls the `image_id` of every variant pointing at it
  and leaves the rest of the row intact

`tests/unit/images.test.js`, run by `node --test`:

- `linkage` maps images to the variants using them, including a shared image
- orphan count for an image equals the number of variants pointing at it
- `positionStillRules` is true only when no variant carries an image
- an empty product (no images, no variants) produces no output and does not throw

`tests/sql/02_guards.sql` already asserts that no unreviewed SECURITY DEFINER
function is anon-executable, and will fail if the drop-and-recreate loses its
`revoke`. That is the test protecting decision 6, and it needs no change.

Manual check before calling it done: open a product with five variants and three
photos, upload a photo from the fourth variant's row, confirm the card in
`/shop` swaps on hover for that colourway, then delete that photo from the
gallery and confirm the warning names the variant it will empty.

## Sequencing

1. Migration plus `tests/sql/08_variant_images.sql`. Ships alone; nothing reads
   the new functions yet.
2. `lib/admin/images.js` plus `tests/unit/images.test.js`. Pure, no UI.
3. `ui.jsx` — `Thumb`, `Popover`, and moving `BulkBar`'s dismiss logic onto the
   shared `Popover`.
4. `ProductForm.jsx`, replacing `DetailsTab` and `SeoTab`. Independently
   valuable: it closes the clobber path whether or not the rest lands.
5. `MediaVariants.jsx`, `VariantRow.jsx`, `ImagePicker.jsx`, replacing
   `VariantsTab` and `ImagesTab`.
6. `page.js` loses its tabs; the four old components are deleted in the same
   commit, so no state exists where a tab points at nothing.

## Risks and open items

1. **Dropping `admin_upsert_variant` discards its grants.** If the recreate
   omits the `revoke`/`grant` pair, anon inherits EXECUTE. `tests/sql/02_guards.sql`
   catches it, which is why step 1 ships before any UI.
2. **`?tab=` links stop working.** One operator, one bookmark set, and the nav
   is updated in the same commit. No redirect stub.
3. **The orphan count is client-side and can race** a second admin adding a
   variant between fetch and delete. Single operator; and `on delete set null`
   already keeps the database correct — only the warning would be stale.
4. **Native HTML5 drag is unreliable on touch.** It applies to the gallery strip
   only, the arrows remain, and the admin is a desktop tool.
5. **The merged page is longer than any one tab was.** Mitigated by the sticky
   header and by there being exactly two cards; if it still reads as a wall, the
   product form is the half that collapses, not the variants.
