-- ============================================================================
-- hotaru — 11. Admin image management
-- ============================================================================
-- The first admin WRITE functions. Same rule as every other write in this
-- system: the client never touches the table, it calls a SECURITY DEFINER
-- function that checks is_admin() itself. `authenticated` keeps SELECT-only on
-- product_images, so there is no insert/update/delete mutation in the reflected
-- schema for anyone.
--
-- Position is the whole contract of this table: 0 is the card image, 1 is the
-- hover-swap image, 2+ is the gallery. A unique index enforces it, which is why
-- appending and reordering need functions rather than naive updates.
-- ============================================================================

create or replace function public.admin_add_product_image(
  product_id       uuid,
  imagekit_file_id text,
  file_path        text,
  alt              text default null,
  width            int  default null,
  height           int  default null
) returns public.product_images
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next int;
  v_row  public.product_images;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  -- Append. coalesce handles the first image, where max() is null.
  select coalesce(max(pi.position) + 1, 0) into v_next
  from public.product_images pi
  where pi.product_id = admin_add_product_image.product_id;

  insert into public.product_images (
    product_id, imagekit_file_id, file_path, alt, width, height, position
  ) values (
    admin_add_product_image.product_id,
    admin_add_product_image.imagekit_file_id,
    admin_add_product_image.file_path,
    admin_add_product_image.alt,
    admin_add_product_image.width,
    admin_add_product_image.height,
    v_next
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_delete_product_image(image_id uuid)
returns boolean
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  delete from public.product_images pi
   where pi.id = admin_delete_product_image.image_id
  returning pi.product_id into v_product;

  if v_product is null then
    return false;
  end if;

  -- Close the gap. Without this a delete leaves position 0 empty and the grid
  -- loses its card image while the gallery still has pictures.
  with ordered as (
    select pi.id, row_number() over (order by pi.position) - 1 as new_pos
    from public.product_images pi where pi.product_id = v_product
  )
  update public.product_images pi
     set position = -1 - o.new_pos          -- park negative to dodge the unique index
  from ordered o where pi.id = o.id;

  update public.product_images pi
     set position = -1 - pi.position
   where pi.product_id = v_product and pi.position < 0;

  return true;
end;
$$;

-- Reorder by passing the ids in the order you want. The two-pass negative
-- parking is required: a straight update would collide with the
-- (product_id, position) unique index halfway through.
create or replace function public.admin_reorder_product_images(
  product_id uuid,
  image_ids  uuid[]
) returns setof public.product_images
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.product_images pi
     set position = -1 - a.ord
  from (
    select unnest(image_ids) as id, generate_subscripts(image_ids, 1) - 1 as ord
  ) a
  where pi.id = a.id and pi.product_id = admin_reorder_product_images.product_id;

  update public.product_images pi
     set position = -1 - pi.position
   where pi.product_id = admin_reorder_product_images.product_id and pi.position < 0;

  return query
    select pi.* from public.product_images pi
    where pi.product_id = admin_reorder_product_images.product_id
    order by pi.position;
end;
$$;

-- Admin-gated inside the function; granted so the mutation is reflected into an
-- authenticated session's schema. A non-admin calling it gets 42501.
grant execute on function
  public.admin_add_product_image(uuid, text, text, text, int, int),
  public.admin_delete_product_image(uuid),
  public.admin_reorder_product_images(uuid, uuid[])
to authenticated;

comment on function public.admin_add_product_image is
  e'@graphql({"description": "Admin only. Appends an ImageKit asset to a product; position is assigned automatically."})';
