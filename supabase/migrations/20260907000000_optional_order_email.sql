-- Email becomes optional on an order.
--
-- place_order was written when email was the only way to sign in. Phone sign-in
-- (20260906090000) then made accounts whose profiles.email is deliberately
-- null -- their auth address is a synthesised <phone>@phone.hotaru.invalid that
-- must never be used as a contact address. The two rules met at checkout and a
-- phone customer could not buy anything: "account email required".
--
-- The order now carries whichever contact detail exists. enqueue_notification
-- already returns early on a null recipient, so the customer receipt is simply
-- not queued; the owner alert is unaffected, and the owner-facing templates
-- fall back to the phone.
--
-- Consequence worth stating plainly: a phone-only customer receives NO order
-- confirmation email. Everything they need -- bank details, the QPay QR, order
-- status -- lives on the order page instead. SMS receipts are the follow-up.

alter table public.orders alter column email drop not null;

comment on column public.orders.email is
  'Contact address, null for phone sign-ins. Never a synthesised @phone.hotaru.invalid identity.';

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
  v_order     public.orders;
  v_email     citext;
  v_phone     text;
  v_lines     int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Accounts are required at checkout: an anonymous cart holder must convert
  -- before they can place an order.
  if public.is_anonymous_user() then
    raise exception 'account required to place an order' using errcode = '42501';
  end if;

  select id into v_cart from public.carts
   where profile_id = v_uid and status = 'open';
  if v_cart is null then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  select * into v_addr from public.addresses
   where id = place_order.address_id and profile_id = v_uid;
  if not found then
    raise exception 'address not found' using errcode = 'P0002';
  end if;

  select * into v_delivery from public.delivery_methods
   where id = place_order.delivery_method_id and is_active;
  if not found then
    raise exception 'delivery method unavailable' using errcode = 'P0002';
  end if;

  select email, phone into v_email, v_phone from public.profiles where id = v_uid;
  v_phone := coalesce(v_phone, v_addr.phone);
  -- No email is an ordinary state, not an error. A phone sign-in has only a
  -- synthesised @phone.hotaru.invalid login identity, which is deliberately
  -- never mirrored into profiles.email, so orders.email stays null and the
  -- receipt is simply not queued. The phone is the contact detail that must
  -- exist: addresses.phone is NOT NULL, so this can only fire if that changes.
  if v_email is null and v_phone is null then
    raise exception 'account phone or email required' using errcode = '22023';
  end if;

  -- Lock the variants this order touches, in a stable order, so concurrent
  -- checkouts of the same item serialise rather than deadlock.
  perform 1
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart
  order by v.id
  for update of v;

  select coalesce(sum(v.price_mnt * ci.quantity), 0), count(*)
    into v_subtotal, v_lines
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  if v_lines = 0 then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  if place_order.discount_code is not null then
    select * into v_code from public.discount_codes
     where code = place_order.discount_code::citext
       and is_active
       and (starts_at is null or starts_at <= now())
       and (ends_at   is null or ends_at   >= now())
       and (usage_limit is null or times_used < usage_limit)
       and min_subtotal_mnt <= v_subtotal;
    if not found then
      raise exception 'discount code not valid' using errcode = '22023';
    end if;
    v_discount := public.compute_discount_mnt(v_code.id, v_subtotal, v_delivery.fee_mnt);
  end if;

  insert into public.orders (
    profile_id, email, phone,
    subtotal_mnt, discount_mnt, delivery_mnt, total_mnt,
    discount_code_id, delivery_method_id, shipping_address, customer_note
  ) values (
    v_uid, v_email, v_phone,
    v_subtotal,
    v_discount,
    v_delivery.fee_mnt,
    greatest(v_subtotal - v_discount, 0)
      + case when v_code.kind = 'free_delivery' then 0 else v_delivery.fee_mnt end,
    v_code.id, v_delivery.id, to_jsonb(v_addr), place_order.customer_note
  ) returning * into v_order;

  -- Snapshot every line so the order stays readable after the catalog changes.
  insert into public.order_items (
    order_id, variant_id, product_id, product_title, variant_label,
    sku, image_path, unit_price_mnt, quantity
  )
  select
    v_order.id, v.id, p.id,
    coalesce(pt.title, 'Unknown'),
    case when v.option_label is null then null
         else v.option_label || ': ' || v.option_value end,
    v.sku::text,
    (select pi.file_path from public.product_images pi
      where pi.product_id = p.id order by pi.position limit 1),
    v.price_mnt, ci.quantity
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  left join public.product_translations pt
         on pt.product_id = p.id and pt.locale = 'mn'
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  insert into public.payments (order_id, provider, status, amount_mnt)
  values (v_order.id, 'bank_transfer', 'unpaid', v_order.total_mnt);

  if v_code.id is not null then
    update public.discount_codes set times_used = times_used + 1 where id = v_code.id;
  end if;

  update public.carts set status = 'converted' where id = v_cart;

  return v_order;
end;
$$;
