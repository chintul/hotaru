-- Pre-order deposits.
--
-- A line is a pre-order when its variant allows backorder and stock cannot
-- cover the quantity at placement. The shopper pays in-stock lines in full,
-- plus each pre-order line's deposit share, plus delivery, minus discount. The
-- rest is orders.balance_mnt, invoiced by the owner once the goods arrive.
--
-- One order, several payment rows: the upfront row ('full' or 'deposit') is
-- created at placement, the 'balance' row by admin_request_balance. Every path
-- that touched "the" payment by order_id now targets the open row — the newest
-- one still unpaid or submitted — so a confirmed deposit is never rewritten.
--
-- Deposits are non-refundable; that is shopper-facing copy, not a guard here.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists preorder_deposit_pct smallint not null default 50
    check (preorder_deposit_pct between 1 and 100),
  add column if not exists preorder_eta text;

comment on column public.products.preorder_deposit_pct is
  'Share of a pre-order line paid upfront, in percent. The rest is invoiced when the goods arrive.';
comment on column public.products.preorder_eta is
  'Shopper-facing arrival estimate for pre-orders, e.g. "2–3 долоо хоног".';

alter table public.order_items
  add column if not exists is_preorder  boolean not null default false,
  add column if not exists deposit_pct  smallint,
  add column if not exists preorder_eta text;

alter table public.orders
  add column if not exists balance_mnt bigint not null default 0 check (balance_mnt >= 0),
  add column if not exists balance_requested_at timestamptz,
  add column if not exists balance_paid_at timestamptz;

alter table public.orders
  add column if not exists upfront_mnt bigint generated always as (total_mnt - balance_mnt) stored;

alter table public.payments
  add column if not exists kind text not null default 'full'
    check (kind in ('full', 'deposit', 'balance'));

create or replace function public._preorder_deposit(line_total bigint, pct smallint)
returns bigint
language sql
immutable
as $$ select ceil(line_total * pct / 100.0)::bigint $$;

revoke all on function public._preorder_deposit(bigint, smallint) from public, anon, authenticated;

create or replace function public._open_payment(p_order_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id from public.payments p
   where p.order_id = p_order_id and p.status in ('unpaid', 'submitted')
   order by p.created_at desc, p.id desc
   limit 1
$$;

revoke all on function public._open_payment(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. place_order — split the total at placement
-- ---------------------------------------------------------------------------
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

  select coalesce(sum(v.price_mnt * ci.quantity), 0),
         count(*),
         coalesce(sum(
           case when v.allow_backorder and v.quantity < ci.quantity
                then v.price_mnt * ci.quantity
                     - public._preorder_deposit(v.price_mnt * ci.quantity, p.preorder_deposit_pct)
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
    v.price_mnt, ci.quantity,
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

-- ---------------------------------------------------------------------------
-- 3. Confirmation — the open payment row, staged
-- ---------------------------------------------------------------------------
-- Upfront ('full' / 'deposit'): the original stock check and decrement, then
-- paid or deposit_paid. Balance: no stock work (it moved with the upfront
-- payment), straight to paid. No open row means nothing left to confirm, which
-- keeps the old idempotence.
create or replace function public._confirm_payment_core(
  order_id uuid, external_reference text, amount_mnt bigint, actor uuid
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order   public.orders;
  v_payment public.payments;
  v_item    record;
  v_short   boolean := false;
begin
  select * into v_order from public.orders o where o.id = _confirm_payment_core.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  select * into v_payment from public.payments p
   where p.id = public._open_payment(v_order.id)
   for update;
  if not found then
    return v_order;
  end if;

  update public.payments p
     set status = 'confirmed',
         confirmed_by = _confirm_payment_core.actor,
         confirmed_at = now(),
         external_reference = coalesce(_confirm_payment_core.external_reference, p.external_reference),
         amount_mnt = coalesce(_confirm_payment_core.amount_mnt, p.amount_mnt),
         updated_at = now()
   where p.id = v_payment.id;

  if v_payment.kind = 'balance' then
    update public.orders o
       set status = case when o.status = 'awaiting_balance' then 'paid'::public.order_status else o.status end,
           payment_status = 'confirmed',
           balance_paid_at = now()
     where o.id = v_order.id
    returning * into v_order;
    return v_order;
  end if;

  perform 1 from public.variants v
   where v.id in (select oi.variant_id from public.order_items oi
                   where oi.order_id = v_order.id and oi.variant_id is not null)
   order by v.id
   for update;

  for v_item in
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  loop
    if not exists (
      select 1 from public.variants v
      where v.id = v_item.variant_id
        and (v.allow_backorder or v.quantity >= v_item.qty)
    ) then
      v_short := true;
      exit;
    end if;
  end loop;

  if v_short then
    update public.orders o
       set status = 'oversold',
           payment_status = case when o.balance_mnt > 0 then 'partially_paid'::public.payment_status
                                 else 'confirmed'::public.payment_status end,
           paid_at = now(),
           internal_note =
             coalesce(o.internal_note || E'\n', '') ||
             '[' || now()::text || '] Payment confirmed but stock insufficient. Refund or restock.'
     where o.id = v_order.id
    returning * into v_order;
    return v_order;
  end if;

  update public.variants v
     set quantity = v.quantity - agg.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  ) agg
  where v.id = agg.variant_id and not v.allow_backorder;

  update public.orders o
     set status = case when o.balance_mnt > 0 then 'deposit_paid'::public.order_status
                       else 'paid'::public.order_status end,
         payment_status = case when o.balance_mnt > 0 then 'partially_paid'::public.payment_status
                               else 'confirmed'::public.payment_status end,
         paid_at = now()
   where o.id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.confirm_payment_qpay(
  order_id uuid, invoice_id text, amount_mnt bigint, payload jsonb default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  v_order := public._confirm_payment_core(
    confirm_payment_qpay.order_id,
    confirm_payment_qpay.invoice_id,
    confirm_payment_qpay.amount_mnt,
    null);

  update public.payments p
     set provider = 'qpay_quickqr',
         raw_payload = coalesce(confirm_payment_qpay.payload, p.raw_payload),
         updated_at = now()
   where p.order_id = v_order.id
     and p.external_reference = confirm_payment_qpay.invoice_id;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Customer transfer claim — the open row only
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_proof(
  order_id uuid, external_reference text default null, payer_note text default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  update public.payments p
     set status = 'submitted',
         external_reference = coalesce(submit_payment_proof.external_reference, p.external_reference),
         payer_note = coalesce(submit_payment_proof.payer_note, p.payer_note),
         updated_at = now()
   where p.id = public._open_payment(submit_payment_proof.order_id)
     and exists (
       select 1 from public.orders o
       where o.id = p.order_id and o.profile_id = auth.uid()
     );

  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  update public.orders o set payment_status = 'submitted'
   where o.id = submit_payment_proof.order_id
  returning * into v_order;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Cancellation — restock whatever the upfront payment took
-- ---------------------------------------------------------------------------
-- Stock moves with the upfront confirmation, so paid_at is the signal, not
-- payment_status (which may say partially_paid or submitted mid-balance). An
-- oversold order never decremented, so it is never restocked.
create or replace function public.cancel_order(order_id uuid, reason text default null)
returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders o where o.id = cancel_order.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or v_order.profile_id = auth.uid()) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if v_order.status in ('shipped', 'delivered', 'refunded', 'cancelled') then
    raise exception 'order can no longer be cancelled' using errcode = '22023';
  end if;

  if v_order.paid_at is not null and v_order.status <> 'oversold' then
    update public.variants v
       set quantity = v.quantity + agg.qty
    from (
      select oi.variant_id, sum(oi.quantity) as qty
      from public.order_items oi
      where oi.order_id = v_order.id and oi.variant_id is not null
      group by oi.variant_id
    ) agg
    where v.id = agg.variant_id and not v.allow_backorder;
  end if;

  update public.orders o
     set status = 'cancelled',
         cancelled_at = now(),
         internal_note = coalesce(o.internal_note || E'\n', '') ||
           '[' || now()::text || '] Cancelled: ' || coalesce(cancel_order.reason, 'no reason given')
   where o.id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Owner: ask for the balance; set a product's pre-order terms
-- ---------------------------------------------------------------------------
create or replace function public.admin_request_balance(order_id uuid)
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

  select * into v_order from public.orders o where o.id = admin_request_balance.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'deposit_paid' or v_order.balance_mnt = 0 then
    raise exception 'order has no deposit awaiting a balance' using errcode = '22023';
  end if;

  insert into public.payments (order_id, provider, status, amount_mnt, kind)
  values (v_order.id, 'bank_transfer', 'unpaid', v_order.balance_mnt, 'balance');

  update public.orders o
     set status = 'awaiting_balance', balance_requested_at = now()
   where o.id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

create or replace function public.admin_set_product_preorder(
  product_id uuid, deposit_pct int, eta text default null
) returns public.products
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
  if admin_set_product_preorder.deposit_pct not between 1 and 100 then
    raise exception 'deposit_pct must be between 1 and 100' using errcode = '22023';
  end if;

  update public.products p
     set preorder_deposit_pct = admin_set_product_preorder.deposit_pct,
         preorder_eta = nullif(trim(admin_set_product_preorder.eta), '')
   where p.id = admin_set_product_preorder.product_id
  returning * into v_product;
  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  return v_product;
end;
$$;

-- Manual status changes must not skip the balance: the deposit states are
-- entered only through payment confirmation and admin_request_balance, and
-- fulfilment still requires the money to be fully in.
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

  if v_new in ('packed', 'shipped', 'delivered')
     and v_order.payment_status is distinct from 'confirmed' then
    raise exception 'cannot mark % before payment is confirmed', v_new
      using errcode = '22023';
  end if;

  if v_new = 'cancelled' then
    raise exception 'use cancel_order() so stock is returned' using errcode = '22023';
  end if;

  if v_new in ('deposit_paid', 'awaiting_balance') then
    raise exception 'deposit states follow payments; use admin_request_balance()' using errcode = '22023';
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

-- ---------------------------------------------------------------------------
-- 7. Notifications
-- ---------------------------------------------------------------------------
create or replace function public.order_notification_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status',       o.status,
    'total_mnt',    o.total_mnt,
    'upfront_mnt',  o.upfront_mnt,
    'balance_mnt',  o.balance_mnt,
    'subtotal_mnt', o.subtotal_mnt,
    'discount_mnt', o.discount_mnt,
    'delivery_mnt', o.delivery_mnt,
    'placed_at',    o.placed_at,
    'customer_email', o.email,
    'customer_phone', o.phone,
    'shipping_address', o.shipping_address,
    'delivery_method', (select d.name from public.delivery_methods d where d.id = o.delivery_method_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', oi.product_title,
        'variant', oi.variant_label,
        'quantity', oi.quantity,
        'unit_price_mnt', oi.unit_price_mnt,
        'line_total_mnt', oi.line_total_mnt,
        'is_preorder', oi.is_preorder,
        'preorder_eta', oi.preorder_eta
      ) order by oi.product_title)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'bank', (
      select jsonb_build_object(
        'bank_name', s.bank_name,
        'account_number', s.bank_account_number,
        'account_name', s.bank_account_name,
        'instructions', s.payment_instructions,
        'deadline_hours', s.payment_deadline_hours
      ) from public.store_settings s where s.id
    )
  )
  from public.orders o
  where o.id = p_order_id;
$$;

create or replace function public.tg_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner   citext;
  v_payload jsonb;
  v_queued  bigint;
begin
  select s.owner_alert_email into v_owner from public.store_settings s where s.id;
  v_payload := public.order_notification_payload(new.id);

  select count(*) into v_queued from public.notification_outbox n where n.order_id = new.id;

  if tg_op = 'INSERT' then
    perform public.enqueue_notification('order_placed_customer', new.id, new.email, v_payload);
    perform public.enqueue_notification('order_placed_owner',    new.id, v_owner,   v_payload);
    perform public.kick_if_queued(new.id, v_queued);
    return null;
  end if;

  if new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    perform public.enqueue_notification('payment_submitted_owner',    new.id, v_owner,   v_payload);
    perform public.enqueue_notification('payment_submitted_customer', new.id, new.email, v_payload);
  end if;

  if new.payment_status = 'partially_paid'
     and old.payment_status is distinct from 'partially_paid'
     and new.status <> 'oversold' then
    perform public.enqueue_notification('deposit_confirmed_customer', new.id, new.email, v_payload);
  end if;

  if new.status = 'awaiting_balance' and old.status is distinct from 'awaiting_balance' then
    perform public.enqueue_notification('balance_requested_customer', new.id, new.email, v_payload);
  end if;

  if new.payment_status = 'confirmed'
     and old.payment_status is distinct from 'confirmed'
     and new.status <> 'oversold' then
    perform public.enqueue_notification('payment_confirmed_customer', new.id, new.email, v_payload);
  end if;

  if new.status = 'oversold' and old.status is distinct from 'oversold' then
    perform public.enqueue_notification('order_oversold_owner', new.id, v_owner, v_payload);
  end if;

  if new.status = 'shipped' and old.status is distinct from 'shipped' then
    perform public.enqueue_notification('order_shipped_customer', new.id, new.email,
      v_payload || jsonb_build_object('tracking_number', new.tracking_number));
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.enqueue_notification('order_cancelled_customer', new.id, new.email, v_payload);
  end if;

  perform public.kick_if_queued(new.id, v_queued);
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.admin_request_balance(uuid),
  public.admin_set_product_preorder(uuid, int, text)
from public, anon;

grant execute on function
  public.admin_request_balance(uuid),
  public.admin_set_product_preorder(uuid, int, text)
to authenticated;
