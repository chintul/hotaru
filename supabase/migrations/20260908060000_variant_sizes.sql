-- Colour and size together (decision 19, reversing decision 8). The existing
-- option_label/option_value pair stays the colour-style axis; variants.size is
-- the second one. Each colour × size is its own variant with its own stock.
-- admin_create_size_grid creates a grid in one call; place_order snapshots the
-- size into the line label.

alter table public.variants
  add column if not exists size text check (size is null or btrim(size) <> '');

comment on column public.variants.size is
  'Second option axis: shoe or clothing size. Null when the product has no sizes.';

alter table public.variants drop constraint if exists variants_product_id_option_value_key;

create unique index if not exists variants_product_option_unsized_key
  on public.variants (product_id, option_value)
  where size is null;

create unique index if not exists variants_product_option_size_key
  on public.variants (product_id, coalesce(option_value, ''), size)
  where size is not null;

create or replace function public._variant_label(option_label text, option_value text, size text)
returns text
language sql
immutable
as $$
  select nullif(concat_ws(' · ',
    case when option_label is not null and option_value is not null then option_label || ': ' || option_value end,
    case when size is not null then 'Хэмжээ: ' || size end), '')
$$;

revoke all on function public._variant_label(text, text, text) from public, anon, authenticated;

create or replace function public.place_order(
  address_id         uuid,
  delivery_method_id uuid,
  discount_code      text default null,
  customer_note      text default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_cart      uuid;
  v_addr      public.addresses;
  v_delivery  public.delivery_methods;
  v_code      public.discount_codes;
  v_subtotal  bigint := 0;
  v_discount  bigint := 0;
  v_balance   bigint := 0;
  v_total     bigint;
  v_order     public.orders;
  v_email     citext;
  v_phone     text;
  v_lines     int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if public.is_anonymous_user() then
    raise exception 'account required to place an order' using errcode = '42501';
  end if;

  select c.id into v_cart from public.carts c
   where c.profile_id = v_uid and c.status = 'open';
  if v_cart is null then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  select * into v_addr from public.addresses a
   where a.id = place_order.address_id and a.profile_id = v_uid;
  if not found then
    raise exception 'address not found' using errcode = 'P0002';
  end if;

  select * into v_delivery from public.delivery_methods d
   where d.id = place_order.delivery_method_id and d.is_active;
  if not found then
    raise exception 'delivery method unavailable' using errcode = 'P0002';
  end if;

  select pr.email, pr.phone into v_email, v_phone from public.profiles pr where pr.id = v_uid;
  v_phone := coalesce(v_phone, v_addr.phone);
  if v_email is null and v_phone is null then
    raise exception 'account phone or email required' using errcode = '22023';
  end if;

  perform 1
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart
  order by v.id
  for update of v;

  select coalesce(sum(public._unit_price(v.price_mnt, v.preorder_price_mnt, v.allow_backorder, v.quantity, ci.quantity) * ci.quantity), 0),
         count(*),
         coalesce(sum(
           case when v.allow_backorder and v.quantity < ci.quantity
                then public._unit_price(v.price_mnt, v.preorder_price_mnt, v.allow_backorder, v.quantity, ci.quantity) * ci.quantity
                     - public._preorder_deposit(public._unit_price(v.price_mnt, v.preorder_price_mnt, v.allow_backorder, v.quantity, ci.quantity) * ci.quantity, p.preorder_deposit_pct)
                else 0 end), 0)
    into v_subtotal, v_lines, v_balance
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  if v_lines = 0 then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  if place_order.discount_code is not null then
    select * into v_code from public.discount_codes dc
     where dc.code = place_order.discount_code::citext
       and dc.is_active
       and (dc.starts_at is null or dc.starts_at <= now())
       and (dc.ends_at   is null or dc.ends_at   >= now())
       and (dc.usage_limit is null or dc.times_used < dc.usage_limit)
       and dc.min_subtotal_mnt <= v_subtotal;
    if not found then
      raise exception 'discount code not valid' using errcode = '22023';
    end if;
    v_discount := public.compute_discount_mnt(v_code.id, v_subtotal, v_delivery.fee_mnt);
  end if;

  v_total := greatest(v_subtotal - v_discount, 0)
    + case when v_code.kind = 'free_delivery' then 0 else v_delivery.fee_mnt end;
  v_balance := least(v_balance, v_total);

  insert into public.orders (
    profile_id, email, phone,
    subtotal_mnt, discount_mnt, delivery_mnt, total_mnt, balance_mnt,
    discount_code_id, delivery_method_id, shipping_address, customer_note
  ) values (
    v_uid, v_email, v_phone,
    v_subtotal, v_discount, v_delivery.fee_mnt, v_total, v_balance,
    v_code.id, v_delivery.id, to_jsonb(v_addr), place_order.customer_note
  ) returning * into v_order;

  insert into public.order_items (
    order_id, variant_id, product_id, product_title, variant_label,
    sku, image_path, unit_price_mnt, quantity,
    is_preorder, deposit_pct, preorder_eta
  )
  select
    v_order.id, v.id, p.id,
    coalesce(pt.title, 'Unknown'),
    public._variant_label(v.option_label, v.option_value, v.size),
    v.sku::text,
    (select pi.file_path from public.product_images pi
      where pi.product_id = p.id order by pi.position limit 1),
    public._unit_price(v.price_mnt, v.preorder_price_mnt, v.allow_backorder, v.quantity, ci.quantity), ci.quantity,
    v.allow_backorder and v.quantity < ci.quantity,
    case when v.allow_backorder and v.quantity < ci.quantity then p.preorder_deposit_pct end,
    case when v.allow_backorder and v.quantity < ci.quantity then p.preorder_eta end
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  left join public.product_translations pt
         on pt.product_id = p.id and pt.locale = 'mn'
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  insert into public.payments (order_id, provider, status, amount_mnt, kind)
  values (v_order.id, 'bank_transfer', 'unpaid', v_order.upfront_mnt,
          case when v_balance > 0 then 'deposit' else 'full' end);

  if v_code.id is not null then
    update public.discount_codes dc set times_used = dc.times_used + 1 where dc.id = v_code.id;
  end if;

  update public.carts c set status = 'converted' where c.id = v_cart;

  return v_order;
end;
$$;

create or replace function public.admin_set_variant_size(variant_id uuid, size text default null)
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

  update public.variants v
     set size = nullif(btrim(admin_set_variant_size.size), '')
   where v.id = admin_set_variant_size.variant_id
  returning * into v_variant;
  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;
  return v_variant;
end;
$$;

-- Every colour × size that does not exist yet becomes an active variant at the
-- given price and stock, appended after the existing ones in grid order. A
-- product's blank variant (no colour, no size) is deactivated, not deleted,
-- so order history that points at it stays intact.
create or replace function public.admin_create_size_grid(
  product_id uuid,
  sizes text[],
  price_mnt bigint,
  colours text[] default null,
  quantity int default 0,
  allow_backorder boolean default false
) returns setof public.variants
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sizes   text[];
  v_colours text[];
  v_pos     int;
  v_colour  text;
  v_size    text;
  v_row     public.variants;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products p where p.id = admin_create_size_grid.product_id) then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if admin_create_size_grid.price_mnt < 0 or admin_create_size_grid.quantity < 0 then
    raise exception 'price and stock cannot be negative' using errcode = '22023';
  end if;

  select coalesce(array_agg(s order by ord), '{}') into v_sizes
    from (select distinct on (btrim(x)) btrim(x) as s, ord
            from unnest(admin_create_size_grid.sizes) with ordinality as t(x, ord)
           where btrim(coalesce(x, '')) <> ''
           order by btrim(x), ord) d;
  if cardinality(v_sizes) = 0 then
    raise exception 'at least one size is required' using errcode = '22023';
  end if;

  select array_agg(c order by ord) into v_colours
    from (select distinct on (btrim(x)) btrim(x) as c, ord
            from unnest(admin_create_size_grid.colours) with ordinality as t(x, ord)
           where btrim(coalesce(x, '')) <> ''
           order by btrim(x), ord) d;
  v_colours := coalesce(v_colours, array[null::text]);

  select coalesce(max(v.position) + 1, 0) into v_pos
    from public.variants v where v.product_id = admin_create_size_grid.product_id;

  update public.variants v set is_active = false
   where v.product_id = admin_create_size_grid.product_id
     and v.option_value is null and v.size is null;

  foreach v_colour in array v_colours loop
    foreach v_size in array v_sizes loop
      if not exists (
        select 1 from public.variants v
         where v.product_id = admin_create_size_grid.product_id
           and coalesce(v.option_value, '') = coalesce(v_colour, '')
           and v.size = v_size
      ) then
        insert into public.variants
          (product_id, option_label, option_value, size, price_mnt, quantity, allow_backorder, position, is_active)
        values (
          admin_create_size_grid.product_id,
          case when v_colour is not null then 'Өнгө' end, v_colour, v_size,
          admin_create_size_grid.price_mnt, admin_create_size_grid.quantity,
          admin_create_size_grid.allow_backorder, v_pos, true)
        returning * into v_row;
        v_pos := v_pos + 1;
        return next v_row;
      end if;
    end loop;
  end loop;
end;
$$;

revoke execute on function
  public.admin_set_variant_size(uuid, text),
  public.admin_create_size_grid(uuid, text[], bigint, text[], int, boolean)
from public, anon;

grant execute on function
  public.admin_set_variant_size(uuid, text),
  public.admin_create_size_grid(uuid, text[], bigint, text[], int, boolean)
to authenticated;
