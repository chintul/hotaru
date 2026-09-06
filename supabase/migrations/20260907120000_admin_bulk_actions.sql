-- ============================================================================
-- hotaru — admin bulk actions
-- ============================================================================
-- One statement per action instead of N round trips.
--
-- Every function here is all-or-nothing on purpose: these catalog operations
-- have no per-row business guard to trip, so a partial result could only ever
-- mean a bug. Orders are deliberately ABSENT — admin_set_order_status refuses
-- fulfilment before payment is confirmed and refuses cancellation outright, so
-- bulk order work runs row by row in the client where each failure is
-- reportable against its own order. See lib/admin/bulk.js.
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

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Admin-gated inside each function; granted to `authenticated` so the mutation
-- is reflected into a signed-in session's schema. A non-admin gets 42501.
--
-- The revoke is not optional. Postgres grants EXECUTE to PUBLIC on every new
-- function and anon inherits PUBLIC, so without this each of these arrives
-- callable by anonymous visitors — they would hit is_admin() and get 42501,
-- but the mutation would still be reflected into the anon schema, which the
-- grant model says must not happen. tests/sql/02_guards.sql fails loudly when
-- this block is forgotten; that is how it was caught here.

revoke execute on function
  public.admin_bulk_set_product_status(uuid[], text),
  public.admin_bulk_set_product_featured(uuid[], boolean),
  public.admin_bulk_set_product_category(uuid[], text),
  public.admin_bulk_delete_products(uuid[]),
  public.admin_bulk_set_review_approval(uuid[], boolean),
  public.admin_bulk_delete_reviews(uuid[]),
  public.admin_bulk_set_discount_active(uuid[], boolean),
  public.admin_bulk_delete_discounts(uuid[])
from public, anon;

grant execute on function
  public.admin_bulk_set_product_status(uuid[], text),
  public.admin_bulk_set_product_featured(uuid[], boolean),
  public.admin_bulk_set_product_category(uuid[], text),
  public.admin_bulk_delete_products(uuid[]),
  public.admin_bulk_set_review_approval(uuid[], boolean),
  public.admin_bulk_delete_reviews(uuid[]),
  public.admin_bulk_set_discount_active(uuid[], boolean),
  public.admin_bulk_delete_discounts(uuid[])
to authenticated;

comment on function public.admin_bulk_set_product_status is
  'Set status on many products at once. Atomic: these rows have no per-row guard, so partial success would mean a bug.';
comment on function public.admin_bulk_delete_products is
  'Hard delete. Order history survives because order_items snapshots its own copy of title, price and image.';
