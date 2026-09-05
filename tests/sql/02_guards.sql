\set ON_ERROR_STOP on
\echo '── guards: oversell, isolation, cart transfer, privileges ──'

-- ---- oversell ------------------------------------------------------------
insert into auth.users (id, email, phone) values ('33333333-3333-3333-3333-333333333333','b2@example.com','88112233');
select test.as_user('33333333-3333-3333-3333-333333333333', false);
insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum)
values ('aaaa0000-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333','Болд','88112233','Улаанбаатар','Баянгол');

select public.add_to_cart((select id from public.variants where sku='TEST-BOTTLE-1'), 4);
select test.as_service();
update public.variants set quantity = 1 where sku='TEST-BOTTLE-1';   -- sold in-store meanwhile
select test.as_user('33333333-3333-3333-3333-333333333333', false);

create temp table t_over as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000002',
  (select id from public.delivery_methods where code='pickup'));

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.eq((select status from public.confirm_payment((select id from t_over)))::text,
               'oversold', 'confirmation flags oversold instead of shipping air');
select test.eq((select quantity from public.variants where sku='TEST-BOTTLE-1'), 1,
               'stock is never driven negative');
select test.eq((select payment_status from public.orders where id=(select id from t_over))::text,
               'confirmed', 'the money is still recorded so a refund has a record');
select test.eq((select status from public.admin_mark_refunded((select id from t_over), 'test'))::text,
               'refunded', 'admin can record the refund');

-- Fulfilment must not outrun payment.
select test.as_service();
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444','c3@example.com');
select test.as_user('44444444-4444-4444-4444-444444444444', false);
insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum)
values ('aaaa0000-0000-0000-0000-000000000003','44444444-4444-4444-4444-444444444444','Ц','8800','УБ','ЧД');
select public.add_to_cart((select id from public.variants where sku='TEST-HOLDER-1'), 1);
create temp table t_unpaid as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000003',
  (select id from public.delivery_methods where code='pickup'));
select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.raises(
  format($$select public.admin_set_order_status(%L, 'shipped')$$, (select id from t_unpaid)),
  '22023', 'cannot ship an unpaid order');

-- ---- RLS isolation -------------------------------------------------------
set role authenticated;
select test.as_user('33333333-3333-3333-3333-333333333333', false);
select test.eq((select count(*)::int from public.orders), 1, 'a customer sees only their own orders');
select test.eq((select count(*)::int from public.profiles), 1, 'a customer sees only their own profile');
select test.eq((select count(*)::int from public.discount_codes), 0, 'discount codes are not listable by customers');
reset role;

-- ---- cart transfer token -------------------------------------------------
insert into auth.users (id, is_anonymous) values ('55555555-5555-5555-5555-555555555555', true);
select test.as_user('55555555-5555-5555-5555-555555555555', true);
select public.add_to_cart((select id from public.variants where sku='TEST-CHARM-1'), 1);
create temp table t_tok as select public.issue_cart_transfer_token() as token;

insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666','returning@example.com');
select test.as_user('66666666-6666-6666-6666-666666666666', false);
select test.ok((public.redeem_cart_transfer((select token from t_tok))).id is not null, 'token moves the cart');
select test.eq((select sum(ci.quantity)::int from public.cart_items ci
                join public.carts c on c.id = ci.cart_id
                where c.profile_id='66666666-6666-6666-6666-666666666666' and c.status='open'),
               1, 'the transferred line arrives');
select test.raises(
  format($$select public.redeem_cart_transfer(%L)$$, (select token from t_tok)),
  '22023', 'a token is single use');
select test.raises(
  $$select public.redeem_cart_transfer('00000000-0000-0000-0000-000000000000')$$,
  '22023', 'a guessed token is rejected');

-- ---- privilege ledger ----------------------------------------------------
select test.eq(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema='public' and grantee='anon'
      and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
  0, 'anon holds no write privilege on any table');

select test.eq(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in ('search_products','current_cart_id','add_to_cart',
        'set_cart_item_quantity','clear_cart','issue_cart_transfer_token',
        'is_admin','is_anonymous_user')),
  0, 'anon cannot execute an unreviewed SECURITY DEFINER function');

select test.ok(
  not has_function_privilege('anon', 'public.order_notification_payload(uuid)', 'EXECUTE'),
  'the RLS-bypassing notification payload is not reachable by anon');
