-- The deposit share becomes a floor. place_order still computes the smallest
-- upfront amount (now kept as orders.min_upfront_mnt); the shopper may raise
-- it up to the full total with set_upfront_amount before paying. Paying the
-- total leaves no balance, so the order goes straight to paid.

alter table public.orders
  add column if not exists min_upfront_mnt bigint not null default 0 check (min_upfront_mnt >= 0);

update public.orders o set min_upfront_mnt = o.total_mnt - o.balance_mnt where o.min_upfront_mnt = 0;

create or replace function public.tg_orders_min_upfront()
returns trigger
language plpgsql
as $$
begin
  new.min_upfront_mnt := new.total_mnt - new.balance_mnt;
  return new;
end;
$$;

drop trigger if exists orders_min_upfront on public.orders;
create trigger orders_min_upfront
  before insert on public.orders
  for each row execute function public.tg_orders_min_upfront();

-- The shopper's choice. Only before anything is paid or claimed, only on their
-- own order. A QPay invoice for the old amount is dropped so the next one is
-- minted for the new amount.
create or replace function public.set_upfront_amount(order_id uuid, amount_mnt bigint)
returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order   public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders o
   where o.id = set_upfront_amount.order_id and o.profile_id = auth.uid()
   for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'the upfront amount can only change before payment' using errcode = '22023';
  end if;

  select * into v_payment from public.payments p
   where p.id = public._open_payment(v_order.id)
   for update;
  if not found or v_payment.status <> 'unpaid' then
    raise exception 'the upfront amount can only change before payment' using errcode = '22023';
  end if;

  if set_upfront_amount.amount_mnt < v_order.min_upfront_mnt
     or set_upfront_amount.amount_mnt > v_order.total_mnt then
    raise exception 'amount must be between % and %', v_order.min_upfront_mnt, v_order.total_mnt
      using errcode = '22023';
  end if;

  update public.payments p
     set amount_mnt = set_upfront_amount.amount_mnt,
         kind = case when set_upfront_amount.amount_mnt = v_order.total_mnt then 'full' else 'deposit' end,
         provider = 'bank_transfer',
         external_reference = null,
         raw_payload = null,
         updated_at = now()
   where p.id = v_payment.id;

  update public.orders o
     set balance_mnt = o.total_mnt - set_upfront_amount.amount_mnt
   where o.id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

revoke execute on function public.set_upfront_amount(uuid, bigint) from public, anon;
grant execute on function public.set_upfront_amount(uuid, bigint) to authenticated;

-- 'paid' by hand must not skip a balance that is still owed.
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

  if v_new = 'paid' and v_order.status in ('deposit_paid', 'awaiting_balance') then
    raise exception 'confirm the balance payment instead' using errcode = '22023';
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
    'min_upfront_mnt', o.min_upfront_mnt,
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
