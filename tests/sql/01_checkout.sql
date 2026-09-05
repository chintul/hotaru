\set ON_ERROR_STOP on
\echo '── checkout: anonymous cart → account → order → payment ──'

insert into auth.users (id, is_anonymous) values ('11111111-1111-1111-1111-111111111111', true);
select test.as_user('11111111-1111-1111-1111-111111111111', true);

select test.eq((select count(*)::int from public.profiles where id='11111111-1111-1111-1111-111111111111'),
               1, 'profile is created by the auth trigger');
select test.ok(public.is_anonymous_user(), 'anonymous flag reads from the JWT');

-- Cart
select test.ok((public.add_to_cart((select id from public.variants where sku='TEST-MUG-1'), 2)).id is not null,
               'anonymous visitor can build a cart');
select test.eq((select sum(quantity)::int from public.cart_items), 2, 'cart holds the added quantity');

-- Accounts are required at checkout.
select test.raises(
  $$select public.place_order(gen_random_uuid(), gen_random_uuid())$$,
  '42501', 'anonymous user cannot place an order');

-- Convert in place: same uid, so the cart survives with no merge step.
update auth.users set email='buyer@example.com', phone='99001122', is_anonymous=false
 where id='11111111-1111-1111-1111-111111111111';
select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.eq((select email::text from public.profiles where id='11111111-1111-1111-1111-111111111111'),
               'buyer@example.com', 'profile email syncs on conversion');
select test.eq((select count(*)::int from public.cart_items), 1, 'cart survives the conversion');

-- Order: every amount is computed server-side from the catalog.
insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum, is_default)
values ('aaaa0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
        'Бат','99001122','Улаанбаатар','Сүхбаатар', true);

create temp table t_order as
select * from public.place_order(
  'aaaa0000-0000-0000-0000-000000000001',
  (select id from public.delivery_methods where code='ub_courier'),
  'NEEELT10');

select test.eq((select subtotal_mnt from t_order), 256000::bigint, 'subtotal = 128000 x 2');
select test.eq((select discount_mnt from t_order), 25600::bigint,  'discount = 10 percent');
select test.eq((select delivery_mnt from t_order), 5000::bigint,   'delivery fee applied');
select test.eq((select total_mnt from t_order), 235400::bigint,    'total = subtotal - discount + delivery');
select test.eq((select status from t_order)::text, 'awaiting_payment', 'order starts awaiting payment');

-- Stock is NOT reserved at order time.
select test.eq((select quantity from public.variants where sku='TEST-MUG-1'), 12, 'stock untouched before payment');

-- Only an admin may confirm.
select test.raises(
  format($$select public.confirm_payment(%L)$$, (select id from t_order)),
  '42501', 'non-admin cannot confirm payment');

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin, from fixtures

select test.eq((select status from public.confirm_payment((select id from t_order)))::text,
               'paid', 'admin confirmation marks the order paid');
select test.eq((select quantity from public.variants where sku='TEST-MUG-1'), 10, 'stock decrements on confirmation');

-- Idempotent: a double click must not decrement twice.
select public.confirm_payment((select id from t_order));
select test.eq((select quantity from public.variants where sku='TEST-MUG-1'), 10, 'second confirmation is a no-op');

-- Fulfilment
select test.eq((select status from public.admin_set_order_status((select id from t_order), 'shipped', 'TRACK-1'))::text,
               'shipped', 'admin can mark an order shipped');
select test.ok((select shipped_at is not null from public.orders where id=(select id from t_order)),
               'shipped_at is stamped');
select test.eq((select tracking_number from public.orders where id=(select id from t_order)),
               'TRACK-1', 'tracking number is stored');
