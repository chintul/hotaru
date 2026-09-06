\set ON_ERROR_STOP on
\echo '── qpay: machine confirmation ──'

-- This suite sets its own stock rather than trusting what earlier suites left
-- behind: 02_guards deliberately drains TEST-BOTTLE-1 to prove the oversell
-- path, and a test that silently depends on that ordering is a test that will
-- fail for the wrong reason later.
update public.variants set quantity = 20 where sku='TEST-BOTTLE-1';

insert into auth.users (id, email, is_anonymous)
values ('cafe0000-0000-0000-0000-0000000000b1', 'qpay-buyer@example.com', false);
select test.as_user('cafe0000-0000-0000-0000-0000000000b1', false);

select public.add_to_cart((select id from public.variants where sku='TEST-BOTTLE-1'), 2);

insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum, is_default)
values ('cafe0000-0000-0000-0000-0000000000a1','cafe0000-0000-0000-0000-0000000000b1',
        'Бат','99001133','Улаанбаатар','Сүхбаатар', true);

create temp table q_order as
select * from public.place_order(
  'cafe0000-0000-0000-0000-0000000000a1',
  (select id from public.delivery_methods where code='ub_courier'));

-- Temp tables are owned by postgres; the role-switched blocks below have to be
-- let in explicitly.
grant select on q_order to authenticated, service_role;

select test.eq((select provider from public.payments where order_id=(select id from q_order)),
               'bank_transfer', 'place_order still opens a bank_transfer payment row');

-- The customer must not be able to confirm their own payment.
set role authenticated;
select test.raises(
  format($$select public.confirm_payment_qpay(%L, 'inv-1', 172000, null)$$, (select id from q_order)),
  '42501', 'authenticated cannot call the machine confirm path');
reset role;

-- Settings the owner controls.
select test.eq((select qpay_enabled from public.store_settings where id), false,
               'qpay is off until the owner turns it on');
select test.ok((select true from information_schema.columns
                 where table_name='store_settings' and column_name='bank_code'),
               'store_settings has a bank_code for the QuickQR account');

-- The machine path. Assertions run after `reset role`, because schema test is
-- granted to anon and authenticated only — service_role cannot see the helpers.
select test.as_service();
set role service_role;
create temp table q_confirmed as
select * from public.confirm_payment_qpay(
  (select id from q_order), 'inv-1', (select total_mnt from q_order),
  '{"invoice_status":"PAID"}'::jsonb);
reset role;

select test.eq((select status from q_confirmed)::text, 'paid', 'machine confirmation marks the order paid');
select test.eq((select quantity from public.variants where sku='TEST-BOTTLE-1'), 18,
               'stock decrements by the ordered quantity');
select test.eq((select provider from public.payments where order_id=(select id from q_order)),
               'qpay_quickqr', 'payment records the provider that confirmed it');
select test.eq((select external_reference from public.payments where order_id=(select id from q_order)),
               'inv-1', 'payment records the QuickQR invoice id');
select test.ok((select confirmed_by is null from public.payments where order_id=(select id from q_order)),
               'a machine confirmation has no human confirmer, and does not invent one');
select test.ok((select raw_payload is not null from public.payments where order_id=(select id from q_order)),
               'the checked payload is kept for audit');

-- Idempotent: QPay retries a callback it thinks failed.
set role service_role;
select public.confirm_payment_qpay((select id from q_order), 'inv-1', (select total_mnt from q_order), null);
reset role;
select test.eq((select quantity from public.variants where sku='TEST-BOTTLE-1'), 18,
               'a replayed callback does not decrement twice');

-- Oversell still fails loudly on the machine path.
select test.as_user('cafe0000-0000-0000-0000-0000000000b1', false);
-- Stock first, cart second, then the shelf empties: add_to_cart clamps to what
-- is available, so dropping the stock first would quietly order one unit and
-- test nothing.
update public.variants set quantity = 10 where sku='TEST-CHARM-1';
select public.add_to_cart((select id from public.variants where sku='TEST-CHARM-1'), 3);
update public.variants set quantity = 1 where sku='TEST-CHARM-1';   -- sold in-store meanwhile

create temp table q_over as
select * from public.place_order(
  'cafe0000-0000-0000-0000-0000000000a1',
  (select id from public.delivery_methods where code='ub_courier'));

grant select on q_over to service_role;

select test.as_service();
set role service_role;
create temp table q_oversold as
select * from public.confirm_payment_qpay(
  (select id from q_over), 'inv-2', (select total_mnt from q_over), null);
reset role;

select test.eq((select status from q_oversold)::text, 'oversold',
               'a paid order that cannot be filled is flagged, not shipped');
select test.eq((select quantity from public.variants where sku='TEST-CHARM-1'), 1,
               'nothing is decremented when a line cannot be covered');
select test.eq((select status from public.payments where order_id=(select id from q_over))::text,
               'confirmed', 'the money is still recorded as received');

-- The admin path is untouched.
select test.ok(has_function_privilege('authenticated', 'public.confirm_payment(uuid, text, bigint)', 'EXECUTE'),
               'admins still reach confirm_payment');
select test.ok(not has_function_privilege('authenticated', 'public._confirm_payment_core(uuid, text, bigint, uuid)', 'EXECUTE'),
               'the shared core is reachable by nobody but its two wrappers');
