-- QPay QuickQR.
--
-- Two things happen here.
--
-- 1. confirm_payment is split. Its body — lock every variant, check every line,
--    decrement or flag oversold — is the part that must never be duplicated,
--    because a second copy will drift and one of the two will start shipping
--    phantoms. It moves into _confirm_payment_core, reachable by nobody.
--    confirm_payment keeps its exact signature and its is_admin() gate;
--    confirm_payment_qpay is the machine's door and is granted to service_role
--    alone. Two doors, one room.
--
-- 2. store_settings gains the QuickQR fields the owner controls. Credentials
--    stay in env; what the owner can legitimately change from /admin does not.

-- ---------------------------------------------------------------------------
-- 1. The shared core
-- ---------------------------------------------------------------------------
-- Identical to the previous body of confirm_payment except that the confirmer
-- arrives as a parameter instead of being read from auth.uid(). A machine
-- confirmation passes null, and null is stored as null: unknown provenance must
-- stay unknown rather than be attributed to whoever happens to be nearby.
create or replace function public._confirm_payment_core(
  order_id uuid, external_reference text, amount_mnt bigint, actor uuid
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_item   record;
  v_short  boolean := false;
begin
  select * into v_order from public.orders where id = _confirm_payment_core.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.payment_status = 'confirmed' then
    return v_order;  -- idempotent: never decrement stock twice
  end if;

  -- Lock every variant on the order in id order before checking anything.
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
    -- The money genuinely arrived. Record the payment as confirmed so the
    -- refund has a record to work from, and flag the ORDER as unfulfillable.
    update public.payments
       set status = 'confirmed',
           confirmed_by = _confirm_payment_core.actor,
           confirmed_at = now(),
           external_reference = coalesce(_confirm_payment_core.external_reference, payments.external_reference),
           amount_mnt = coalesce(_confirm_payment_core.amount_mnt, payments.amount_mnt),
           updated_at = now()
     where payments.order_id = v_order.id;

    update public.orders
       set status = 'oversold',
           payment_status = 'confirmed',
           paid_at = now(),
           internal_note =
             coalesce(internal_note || E'\n', '') ||
             '[' || now()::text || '] Payment confirmed but stock insufficient. Refund or restock.'
     where id = v_order.id
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

  update public.payments
     set status = 'confirmed',
         confirmed_by = _confirm_payment_core.actor,
         confirmed_at = now(),
         external_reference = coalesce(_confirm_payment_core.external_reference, payments.external_reference),
         amount_mnt = coalesce(_confirm_payment_core.amount_mnt, payments.amount_mnt),
         updated_at = now()
   where payments.order_id = v_order.id;

  update public.orders
     set status = 'paid', payment_status = 'confirmed', paid_at = now()
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public._confirm_payment_core(uuid, text, bigint, uuid) is
  'Shared body of the payment confirmation paths. Never granted to anyone: call confirm_payment or confirm_payment_qpay.';

-- ---------------------------------------------------------------------------
-- 2. The human door — unchanged signature, unchanged gate
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  order_id uuid, external_reference text default null, amount_mnt bigint default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return public._confirm_payment_core(
    confirm_payment.order_id,
    confirm_payment.external_reference,
    confirm_payment.amount_mnt,
    auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The machine door
-- ---------------------------------------------------------------------------
-- Called only by the QPay callback route, which has already verified the
-- signature on the order id and re-checked the invoice against QPay. This
-- function trusts its caller completely, which is exactly why service_role is
-- the only role that may call it.
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
    null);   -- no human confirmed this

  -- Provenance. provider plus a null confirmed_by is what later tells a reader
  -- that the machine confirmed this order, without a third column to go stale.
  update public.payments
     set provider = 'qpay_quickqr',
         raw_payload = coalesce(confirm_payment_qpay.payload, payments.raw_payload),
         updated_at = now()
   where payments.order_id = v_order.id;

  return v_order;
end;
$$;

comment on function public.confirm_payment_qpay(uuid, text, bigint, jsonb) is
  'QPay callback confirmation. service_role only; the route verifies the signature and re-checks the invoice before calling.';

-- ---------------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------------
revoke all on function public._confirm_payment_core(uuid, text, bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.confirm_payment_qpay(uuid, text, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.confirm_payment_qpay(uuid, text, bigint, jsonb) to service_role;

-- confirm_payment was re-created above, which resets its grants.
grant execute on function public.confirm_payment(uuid, text, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Owner-editable QuickQR settings
-- ---------------------------------------------------------------------------
-- bank_code is the numeric bank code QuickQR wants in bank_accounts[]; the
-- existing bank_name is display copy and cannot stand in for it.
alter table public.store_settings
  add column if not exists bank_code        text,
  add column if not exists qpay_merchant_id text,
  add column if not exists qpay_enabled     boolean not null default false;

comment on column public.store_settings.bank_code is
  'Numeric bank code for QuickQR bank_accounts[].account_bank_code.';
comment on column public.store_settings.qpay_merchant_id is
  'Merchant id issued by QPay when hotaru was registered as a sub-merchant.';
comment on column public.store_settings.qpay_enabled is
  'Owner kill switch. QPay is also off whenever the QPAY_* env set is absent.';

-- ---------------------------------------------------------------------------
-- 6. Privilege self-check
-- ---------------------------------------------------------------------------
-- The privilege ledger migration runs before these functions exist, so the
-- assertions about them live here instead. The point stands either way: the
-- grant surface is asserted, not assumed.
do $$
begin
  if has_function_privilege('authenticated',
       'public.confirm_payment_qpay(uuid, text, bigint, jsonb)', 'EXECUTE') then
    raise exception 'authenticated must not reach confirm_payment_qpay';
  end if;
  if has_function_privilege('authenticated',
       'public._confirm_payment_core(uuid, text, bigint, uuid)', 'EXECUTE') then
    raise exception 'authenticated must not reach _confirm_payment_core';
  end if;
  if has_function_privilege('anon',
       'public.confirm_payment_qpay(uuid, text, bigint, jsonb)', 'EXECUTE') then
    raise exception 'anon must not reach confirm_payment_qpay';
  end if;
  raise notice 'qpay privilege ledger verified';
end $$;
