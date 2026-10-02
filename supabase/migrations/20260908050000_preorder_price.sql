-- A pre-order can carry its own price. variants.preorder_price_mnt, when set,
-- is what a pre-order line costs; null means the normal price. A line covered
-- by stock always sells at the normal price. place_order is the only place a
-- price is chosen, so it is the only function that changes.

alter table public.variants
  add column if not exists preorder_price_mnt bigint check (preorder_price_mnt >= 0);

comment on column public.variants.preorder_price_mnt is
  'Price of this variant when sold as a pre-order. Null = the normal price.';

create or replace function public._unit_price(
  price_mnt bigint, preorder_price_mnt bigint, allow_backorder boolean, stock int, wanted int
) returns bigint
language sql
immutable
as $$
  select case when allow_backorder and stock < wanted
              then coalesce(preorder_price_mnt, price_mnt)
              else price_mnt end
$$;

revoke all on function public._unit_price(bigint, bigint, boolean, int, int) from public, anon, authenticated;

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
    case when v.option_label is null then null
         else v.option_label || ': ' || v.option_value end,
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

create or replace function public.admin_set_variant_preorder_price(variant_id uuid, price_mnt bigint default null)
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
  if admin_set_variant_preorder_price.price_mnt < 0 then
    raise exception 'price cannot be negative' using errcode = '22023';
  end if;

  update public.variants v
     set preorder_price_mnt = admin_set_variant_preorder_price.price_mnt
   where v.id = admin_set_variant_preorder_price.variant_id
  returning * into v_variant;
  if not found then
    raise exception 'variant not found' using errcode = 'P0002';
  end if;
  return v_variant;
end;
$$;

revoke execute on function public.admin_set_variant_preorder_price(uuid, bigint) from public, anon;
grant execute on function public.admin_set_variant_preorder_price(uuid, bigint) to authenticated;
