-- ============================================================================
-- hotaru — 12. Admin write surface
-- ============================================================================
-- Everything the owner needs to run the store, as SECURITY DEFINER functions.
-- Same rule as the rest of the system: `authenticated` keeps SELECT-only on the
-- tables, so pg_graphql reflects no insert/update/delete mutation for anyone,
-- and each function checks is_admin() itself.
--
-- NAMING: parameters are the GraphQL argument names, so they collide with
-- column names. Every column reference below is qualified and every upsert uses
-- `on conflict on constraint` — an inference clause cannot be qualified.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Order fulfilment
-- ---------------------------------------------------------------------------
-- Previously the admin could only confirm payment or cancel. There was no way
-- to mark an order shipped, so `packed`/`shipped`/`delivered` existed in the
-- schema and were unreachable.

create or replace function public.admin_set_order_status(
  order_id uuid,
  status text,
  tracking_number text default null,
  internal_note text default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_new   public.order_status;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  v_new := admin_set_order_status.status::public.order_status;

  select * into v_order from public.orders o
   where o.id = admin_set_order_status.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  -- Fulfilment states require money to have arrived. Shipping an unpaid order
  -- is the mistake this guard exists to prevent.
  if v_new in ('packed', 'shipped', 'delivered')
     and v_order.payment_status is distinct from 'confirmed' then
    raise exception 'cannot mark % before payment is confirmed', v_new
      using errcode = '22023';
  end if;

  -- Cancellation has its own function because it has to return stock.
  if v_new = 'cancelled' then
    raise exception 'use cancel_order() so stock is returned' using errcode = '22023';
  end if;

  update public.orders o set
    status = v_new,
    tracking_number = coalesce(admin_set_order_status.tracking_number, o.tracking_number),
    shipped_at = case when v_new = 'shipped' then coalesce(o.shipped_at, now()) else o.shipped_at end,
    internal_note = case
      when admin_set_order_status.internal_note is null then o.internal_note
      else coalesce(o.internal_note || E'\n', '') || '[' || now()::text || '] ' || admin_set_order_status.internal_note
    end
  where o.id = admin_set_order_status.order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- Marks an oversold order refunded once the money has actually been sent back.
create or replace function public.admin_mark_refunded(order_id uuid, note text default null)
returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.payments p
     set status = 'refunded', updated_at = now()
   where p.order_id = admin_mark_refunded.order_id;

  update public.orders o set
    status = 'refunded',
    payment_status = 'refunded',
    internal_note = coalesce(o.internal_note || E'\n', '') ||
      '[' || now()::text || '] Refunded: ' || coalesce(admin_mark_refunded.note, 'no note')
  where o.id = admin_mark_refunded.order_id
  returning * into v_order;

  if v_order.id is null then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog: products, translations, variants
-- ---------------------------------------------------------------------------

-- Creates or updates a product AND its Mongolian copy in one call, because a
-- product without a title is not a usable row and two round trips can leave it
-- that way.
create or replace function public.admin_upsert_product(
  slug text,
  title text,
  category_slug text default null,
  subtitle text default null,
  description text default null,
  care_details text default null,
  status text default 'draft',
  is_featured boolean default false,
  sort_order int default 0,
  product_id uuid default null
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
    (product_id, locale, title, subtitle, description, care_details)
  values (
    v_product.id, 'mn', admin_upsert_product.title, admin_upsert_product.subtitle,
    admin_upsert_product.description, admin_upsert_product.care_details
  )
  on conflict on constraint product_translations_product_id_locale_key do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    care_details = excluded.care_details;

  perform public.refresh_product_derived(v_product.id);
  return v_product;
end;
$$;

create or replace function public.admin_upsert_variant(
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
  variant_id uuid default null
) returns public.variants
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
  if admin_upsert_variant.price_mnt < 0 then
    raise exception 'price cannot be negative' using errcode = '22023';
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
      position = admin_upsert_variant.sort_order
    where v.id = admin_upsert_variant.variant_id
    returning * into v_variant;
    if not found then
      raise exception 'variant not found' using errcode = 'P0002';
    end if;
  else
    insert into public.variants
      (product_id, sku, option_label, option_value, price_mnt, compare_at_price_mnt,
       quantity, allow_backorder, is_active, position)
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
      admin_upsert_variant.sort_order
    )
    returning * into v_variant;
  end if;

  return v_variant;
end;
$$;

-- Fast path for the inventory table: adjust one number without sending the
-- whole variant back.
create or replace function public.admin_set_stock(variant_id uuid, quantity int)
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
  if admin_set_stock.quantity < 0 then
    raise exception 'stock cannot be negative' using errcode = '22023';
  end if;

  update public.variants v set quantity = admin_set_stock.quantity
   where v.id = admin_set_stock.variant_id
  returning * into v_variant;

  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;
  return v_variant;
end;
$$;

-- Archive rather than delete when a product has been ordered: order_items point
-- at it, and deleting would blank the product from someone's order history.
create or replace function public.admin_archive_product(product_id uuid)
returns public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.products p set status = 'archived'
   where p.id = admin_archive_product.product_id
  returning * into v_product;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  return v_product;
end;
$$;

create or replace function public.admin_delete_variant(variant_id uuid)
returns boolean
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid;
  v_left    int;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select v.product_id into v_product from public.variants v where v.id = admin_delete_variant.variant_id;
  if v_product is null then
    return false;
  end if;

  -- Every product must keep at least one variant; it is the sellable unit.
  select count(*) into v_left from public.variants v where v.product_id = v_product;
  if v_left <= 1 then
    raise exception 'a product must keep at least one variant' using errcode = '22023';
  end if;

  -- An ordered variant is referenced by order_items (on delete set null), which
  -- would silently detach the line from its variant. Deactivate instead.
  if exists (select 1 from public.order_items oi where oi.variant_id = admin_delete_variant.variant_id) then
    update public.variants v set is_active = false where v.id = admin_delete_variant.variant_id;
  else
    delete from public.variants v where v.id = admin_delete_variant.variant_id;
  end if;

  perform public.refresh_product_derived(v_product);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Discounts
-- ---------------------------------------------------------------------------

create or replace function public.admin_upsert_discount(
  code text,
  kind text,
  value numeric,
  min_subtotal_mnt bigint default 0,
  usage_limit int default null,
  is_active boolean default true,
  ends_at timestamptz default null,
  discount_id uuid default null
) returns public.discount_codes
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.discount_codes;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if admin_upsert_discount.kind = 'percentage'
     and (admin_upsert_discount.value < 0 or admin_upsert_discount.value > 100) then
    raise exception 'percentage must be between 0 and 100' using errcode = '22023';
  end if;

  if admin_upsert_discount.discount_id is not null then
    update public.discount_codes d set
      code = admin_upsert_discount.code::citext,
      kind = admin_upsert_discount.kind::public.discount_kind,
      value = admin_upsert_discount.value,
      min_subtotal_mnt = admin_upsert_discount.min_subtotal_mnt,
      usage_limit = admin_upsert_discount.usage_limit,
      is_active = admin_upsert_discount.is_active,
      ends_at = admin_upsert_discount.ends_at
    where d.id = admin_upsert_discount.discount_id
    returning * into v_row;
  else
    insert into public.discount_codes
      (code, kind, value, min_subtotal_mnt, usage_limit, is_active, ends_at)
    values (
      admin_upsert_discount.code::citext,
      admin_upsert_discount.kind::public.discount_kind,
      admin_upsert_discount.value,
      admin_upsert_discount.min_subtotal_mnt,
      admin_upsert_discount.usage_limit,
      admin_upsert_discount.is_active,
      admin_upsert_discount.ends_at
    )
    on conflict on constraint discount_codes_code_key do update set
      kind = excluded.kind,
      value = excluded.value,
      min_subtotal_mnt = excluded.min_subtotal_mnt,
      usage_limit = excluded.usage_limit,
      is_active = excluded.is_active,
      ends_at = excluded.ends_at
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Review moderation
-- ---------------------------------------------------------------------------
-- Without this, reviews land unapproved and can never surface.

create or replace function public.admin_set_review_approval(review_id uuid, approved boolean)
returns public.reviews
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row public.reviews;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.reviews r set is_approved = admin_set_review_approval.approved
   where r.id = admin_set_review_approval.review_id
  returning * into v_row;

  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;
  return v_row;   -- the trigger recomputes products.rating_avg / rating_count
end;
$$;

create or replace function public.admin_delete_review(review_id uuid)
returns boolean
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  delete from public.reviews r where r.id = admin_delete_review.review_id;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Admin-gated inside each function; granted to `authenticated` so the mutation
-- is reflected into a signed-in session's schema. A non-admin gets 42501.

-- Postgres grants EXECUTE on every NEW function to PUBLIC by default, and
-- anon inherits PUBLIC. Migration 08's revoke only covered functions that
-- existed then, so each new admin function silently became callable by
-- anonymous visitors (they hit is_admin() and got 42501, but the mutation was
-- reflected into the anon schema, which the whole grant model says must not
-- happen). Caught by tests/sql/02_guards.sql.
--
-- Fix the default first so this cannot recur, then reset these functions.
alter default privileges in schema public revoke execute on functions from public;

revoke execute on function
  public.admin_set_order_status(uuid, text, text, text),
  public.admin_mark_refunded(uuid, text),
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid),
  public.admin_upsert_variant(uuid, bigint, int, text, text, text, bigint, boolean, boolean, int, uuid),
  public.admin_set_stock(uuid, int),
  public.admin_archive_product(uuid),
  public.admin_delete_variant(uuid),
  public.admin_upsert_discount(text, text, numeric, bigint, int, boolean, timestamptz, uuid),
  public.admin_set_review_approval(uuid, boolean),
  public.admin_delete_review(uuid)
from public, anon;

grant execute on function
  public.admin_set_order_status(uuid, text, text, text),
  public.admin_mark_refunded(uuid, text),
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid),
  public.admin_upsert_variant(uuid, bigint, int, text, text, text, bigint, boolean, boolean, int, uuid),
  public.admin_set_stock(uuid, int),
  public.admin_archive_product(uuid),
  public.admin_delete_variant(uuid),
  public.admin_upsert_discount(text, text, numeric, bigint, int, boolean, timestamptz, uuid),
  public.admin_set_review_approval(uuid, boolean),
  public.admin_delete_review(uuid)
to authenticated;
