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
