\set ON_ERROR_STOP on
\echo '── pre-order: deposit upfront, balance on arrival ──'

select test.as_service();

do $$
declare v_p uuid;
begin
  insert into public.products (slug, category_id, status, position, published_at, preorder_deposit_pct, preorder_eta)
  values ('test-preorder', (select id from public.categories where slug = 'test-cat'), 'active', 950, now(), 30, '2–3 долоо хоног')
  returning id into v_p;
  insert into public.product_translations (product_id, locale, title) values (v_p, 'mn', 'Test Preorder');
  insert into public.variants (product_id, sku, price_mnt, quantity, position, allow_backorder)
  values (v_p, 'TEST-PRE-1', 100000, 0, 0, true);
end $$;

update public.products set status = 'active' where slug = 'test-holder';
update public.variants set quantity = 10, is_active = true where sku = 'TEST-HOLDER-1';

insert into auth.users (id, email, phone, is_anonymous)
values ('a0a0a0a0-0000-0000-0000-0000000000e0', 'pre@example.com', '99112233', false);
insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum, is_default)
values ('aaaa0000-0000-0000-0000-000000000099', 'a0a0a0a0-0000-0000-0000-0000000000e0',
        'Сараа', '99112233', 'Улаанбаатар', 'Баянзүрх', true);

-- ---- placement: mixed cart splits into upfront + balance -----------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from public.variants where sku = 'TEST-PRE-1'), 1);
select public.add_to_cart((select id from public.variants where sku = 'TEST-HOLDER-1'), 1);

create temp table t_pre as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));

select test.eq((select subtotal_mnt from t_pre), 221000::bigint, 'subtotal covers both lines');
select test.eq((select total_mnt from t_pre), 226000::bigint, 'total adds delivery');
select test.eq((select balance_mnt from t_pre), 70000::bigint, 'balance = 70 percent of the pre-order line');
select test.eq((select upfront_mnt from t_pre), 156000::bigint, 'upfront = in-stock line + 30 percent deposit + delivery');

select test.ok(
  (select bool_and(oi.is_preorder = (oi.sku = 'TEST-PRE-1')) from public.order_items oi where oi.order_id = (select id from t_pre)),
  'only the uncovered backorder line is flagged pre-order');
select test.eq(
  (select deposit_pct from public.order_items where order_id = (select id from t_pre) and sku = 'TEST-PRE-1'),
  30::smallint, 'deposit share is snapshotted on the line');
select test.eq(
  (select preorder_eta from public.order_items where order_id = (select id from t_pre) and sku = 'TEST-PRE-1'),
  '2–3 долоо хоног', 'arrival estimate is snapshotted on the line');

select test.eq((select kind from public.payments where order_id = (select id from t_pre)), 'deposit', 'the upfront row is a deposit');
select test.eq((select amount_mnt from public.payments where order_id = (select id from t_pre)), 156000::bigint, 'the deposit row asks for the upfront amount');

select public.submit_payment_proof((select id from t_pre), 'TXN-DEP');
select test.eq((select status from public.payments where order_id = (select id from t_pre))::text, 'submitted', 'customer claims the deposit transfer');

-- ---- deposit confirmation ------------------------------------------------
select test.as_user('22222222-2222-2222-2222-222222222222', false);

select test.raises(format($$select public.admin_request_balance(%L)$$, (select id from t_pre)),
  '22023', 'balance cannot be requested before the deposit is in');

select test.eq((select status from public.confirm_payment((select id from t_pre)))::text, 'deposit_paid', 'deposit confirmation parks the order');
select test.eq((select payment_status from public.orders where id = (select id from t_pre))::text, 'partially_paid', 'payment status says partial');
select test.eq((select quantity from public.variants where sku = 'TEST-HOLDER-1'), 9, 'in-stock line decrements with the deposit');
select test.eq((select quantity from public.variants where sku = 'TEST-PRE-1'), 0, 'pre-order line does not touch stock');

select public.confirm_payment((select id from t_pre));
select test.eq((select quantity from public.variants where sku = 'TEST-HOLDER-1'), 9, 'second deposit confirmation is a no-op');

select test.raises(format($$select public.admin_set_order_status(%L, 'packed')$$, (select id from t_pre)),
  '22023', 'cannot pack before the balance is paid');
select test.raises(format($$select public.admin_set_order_status(%L, 'awaiting_balance')$$, (select id from t_pre)),
  '22023', 'deposit states cannot be set by hand');

-- ---- balance request -----------------------------------------------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select test.raises(format($$select public.admin_request_balance(%L)$$, (select id from t_pre)),
  '42501', 'a customer cannot request a balance');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.eq((select status from public.admin_request_balance((select id from t_pre)))::text, 'awaiting_balance', 'owner asks for the balance');
select test.eq(
  (select amount_mnt from public.payments where order_id = (select id from t_pre) and kind = 'balance' and status = 'unpaid'),
  70000::bigint, 'a balance row asks for the remainder');
select test.ok(
  exists (select 1 from public.notification_outbox where order_id = (select id from t_pre) and kind = 'balance_requested_customer'),
  'the customer is emailed the balance request');
select test.raises(format($$select public.admin_request_balance(%L)$$, (select id from t_pre)),
  '22023', 'the balance cannot be requested twice');

-- ---- balance payment -----------------------------------------------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.submit_payment_proof((select id from t_pre), 'TXN-BAL');
select test.eq((select status from public.payments where order_id = (select id from t_pre) and kind = 'balance')::text,
  'submitted', 'the transfer claim lands on the balance row');
select test.eq((select external_reference from public.payments where order_id = (select id from t_pre) and kind = 'deposit'),
  'TXN-DEP', 'the confirmed deposit row is not rewritten');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.eq((select status from public.confirm_payment((select id from t_pre)))::text, 'paid', 'balance confirmation completes the order');
select test.eq((select payment_status from public.orders where id = (select id from t_pre))::text, 'confirmed', 'payment status is confirmed');
select test.ok((select balance_paid_at is not null from public.orders where id = (select id from t_pre)), 'balance_paid_at is stamped');
select test.eq((select quantity from public.variants where sku = 'TEST-HOLDER-1'), 9, 'balance confirmation moves no stock');
select test.eq((select count(*)::int from public.payments where order_id = (select id from t_pre) and status = 'confirmed'),
  2, 'both payment rows end confirmed');
select test.ok(
  exists (select 1 from public.notification_outbox where order_id = (select id from t_pre) and kind = 'deposit_confirmed_customer'),
  'the customer heard the deposit landed');
select test.eq((select status from public.admin_set_order_status((select id from t_pre), 'packed'))::text, 'packed', 'a fully paid pre-order can be packed');

-- ---- cancellation after the deposit restocks the in-stock line ------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from public.variants where sku = 'TEST-PRE-1'), 1);
select public.add_to_cart((select id from public.variants where sku = 'TEST-HOLDER-1'), 1);
create temp table t_pre2 as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select public.confirm_payment((select id from t_pre2));
select test.eq((select quantity from public.variants where sku = 'TEST-HOLDER-1'), 8, 'second deposit takes stock');
select public.cancel_order((select id from t_pre2), 'changed mind');
select test.eq((select quantity from public.variants where sku = 'TEST-HOLDER-1'), 9, 'cancelling a deposit-paid order restocks');

-- ---- an in-stock-only order is unchanged ---------------------------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from public.variants where sku = 'TEST-HOLDER-1'), 1);
create temp table t_full as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));
select test.eq((select balance_mnt from t_full), 0::bigint, 'no pre-order line, no balance');
select test.eq((select kind from public.payments where order_id = (select id from t_full)), 'full', 'a plain order has one full payment');

-- ---- the shopper chooses the upfront amount, never below the floor -------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from public.variants where sku = 'TEST-PRE-1'), 1);
create temp table t_flex as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));

select test.eq((select min_upfront_mnt from t_flex), 35000::bigint, 'the floor is the deposit share plus delivery');
select test.raises(format($$select public.set_upfront_amount(%L, 34999)$$, (select id from t_flex)),
  '22023', 'paying below the floor is refused');
select test.raises(format($$select public.set_upfront_amount(%L, 105001)$$, (select id from t_flex)),
  '22023', 'paying above the total is refused');

select test.eq((select balance_mnt from public.set_upfront_amount((select id from t_flex), 60000)), 45000::bigint,
  'a chosen amount sets the balance to the rest');
select test.eq((select amount_mnt from public.payments where order_id = (select id from t_flex)), 60000::bigint,
  'the open payment asks for the chosen amount');
select test.eq((select min_upfront_mnt from public.orders where id = (select id from t_flex)), 35000::bigint,
  'the floor does not move with the choice');

select test.eq((select balance_mnt from public.set_upfront_amount((select id from t_flex), 105000)), 0::bigint,
  'paying everything leaves no balance');
select test.eq((select kind from public.payments where order_id = (select id from t_flex)), 'full',
  'a full upfront payment is a full payment');

select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.raises(format($$select public.set_upfront_amount(%L, 60000)$$, (select id from t_flex)),
  'P0002', 'nobody else can change the amount');

select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.set_upfront_amount((select id from t_flex), 60000);
select public.submit_payment_proof((select id from t_flex), 'TXN-FLEX');
select test.raises(format($$select public.set_upfront_amount(%L, 70000)$$, (select id from t_flex)),
  '22023', 'the amount is fixed once the transfer is claimed');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.eq((select status from public.confirm_payment((select id from t_flex)))::text, 'deposit_paid',
  'the chosen deposit parks the order');
select test.raises(format($$select public.admin_set_order_status(%L, 'paid')$$, (select id from t_flex)),
  '22023', 'paid cannot be set by hand while a balance is owed');

select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
-- ---- product terms -------------------------------------------------------
select test.raises(
  format($$select public.admin_set_product_preorder(%L, 40)$$, (select id from public.products where slug = 'test-preorder')),
  '42501', 'a customer cannot change pre-order terms');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select public.admin_set_product_preorder((select id from public.products where slug = 'test-preorder'), 40, '  1 сар  ');
select test.eq((select preorder_deposit_pct from public.products where slug = 'test-preorder'), 40::smallint, 'owner sets the deposit share');
select test.eq((select preorder_eta from public.products where slug = 'test-preorder'), '1 сар', 'the arrival estimate is trimmed');
select test.raises(
  format($$select public.admin_set_product_preorder(%L, 0)$$, (select id from public.products where slug = 'test-preorder')),
  '22023', 'a zero deposit is rejected');

-- ---- a separate pre-order price ------------------------------------------
select test.as_user('22222222-2222-2222-2222-222222222222', false);
select public.admin_set_product_preorder((select id from public.products where slug = 'test-preorder'), 30);
select test.eq((select preorder_price_mnt from public.admin_set_variant_preorder_price(
  (select id from public.variants where sku = 'TEST-PRE-1'), 90000)), 90000::bigint, 'owner sets a pre-order price');

select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select test.raises(format($$select public.admin_set_variant_preorder_price(%L, 1)$$,
  (select id from public.variants where sku = 'TEST-PRE-1')), '42501', 'a customer cannot set a pre-order price');

select public.add_to_cart((select id from public.variants where sku = 'TEST-PRE-1'), 1);
create temp table t_pp as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));
select test.eq((select unit_price_mnt from public.order_items where order_id = (select id from t_pp)), 90000::bigint,
  'a pre-order line is charged the pre-order price');
select test.eq((select balance_mnt from t_pp), 63000::bigint, 'the deposit split uses the pre-order price');

select test.as_service();
update public.variants set quantity = 5 where sku = 'TEST-PRE-1';
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from public.variants where sku = 'TEST-PRE-1'), 1);
create temp table t_pp2 as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));
select test.eq((select unit_price_mnt from public.order_items where order_id = (select id from t_pp2)), 100000::bigint,
  'a line covered by stock keeps the normal price');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.eq((select preorder_price_mnt from public.admin_set_variant_preorder_price(
  (select id from public.variants where sku = 'TEST-PRE-1'))), null::bigint, 'clearing returns to the normal price');

select test.ok(
  not has_function_privilege('anon', 'public.admin_request_balance(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_set_product_preorder(uuid, int, text)', 'EXECUTE'),
  'pre-order admin functions are not anon-executable');
select test.ok(not has_function_privilege('anon', 'public.admin_set_variant_preorder_price(uuid, bigint)', 'EXECUTE'),
  'admin_set_variant_preorder_price is not anon-executable');
select test.ok(not has_function_privilege('anon', 'public.set_upfront_amount(uuid, bigint)', 'EXECUTE'),
  'set_upfront_amount is not anon-executable');

select test.as_service();
