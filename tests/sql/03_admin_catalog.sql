\set ON_ERROR_STOP on
\echo '── admin: catalog CRUD, discounts, moderation, maintenance ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

-- ---- products ------------------------------------------------------------
create temp table t_p as
select * from public.admin_upsert_product(
  slug => 'test-lamp', title => 'Test Lamp', category_slug => 'accessories',
  subtitle => 'Туршилт', status => 'active', sort_order => 99);

select test.eq((select status from t_p)::text, 'active', 'product is created active');
select test.eq((select title from public.product_translations
                 where product_id=(select id from t_p) and locale='mn'),
               'Test Lamp', 'the mn translation is written in the same call');
select test.ok((select published_at is not null from public.products where id=(select id from t_p)),
               'published_at is stamped when a product goes active');

select test.raises(
  $$select public.admin_upsert_product(slug => 'x', title => '  ')$$,
  '22023', 'a product cannot be saved without a title');

-- ---- variants ------------------------------------------------------------
create temp table t_v as
select * from public.admin_upsert_variant(
  product_id => (select id from t_p), price_mnt => 90000, quantity => 5,
  sku => 'HTR-TL-01', option_label => 'Өнгө', option_value => 'Cream');

select test.eq((select price_mnt from t_v), 90000::bigint, 'variant price is stored');
select test.eq((select min_price_mnt from public.products where id=(select id from t_p)),
               90000::bigint, 'the derived min price follows the variant');
select test.ok((select in_stock from public.products where id=(select id from t_p)),
               'in_stock follows the variant');

select test.eq((select quantity from public.admin_set_stock((select id from t_v), 0)), 0,
               'stock can be set directly');
select test.ok(not (select in_stock from public.products where id=(select id from t_p)),
               'zeroing stock clears in_stock');
select test.raises(
  format($$select public.admin_set_stock(%L, -1)$$, (select id from t_v)),
  '22023', 'stock cannot go negative');

-- A product must always keep one sellable unit.
select test.raises(
  format($$select public.admin_delete_variant(%L)$$, (select id from t_v)),
  '22023', 'the last variant cannot be deleted');

select public.admin_upsert_variant(product_id => (select id from t_p), price_mnt => 95000,
  quantity => 3, sku => 'HTR-TL-02', option_label => 'Өнгө', option_value => 'Sand');
select test.ok(public.admin_delete_variant((select id from t_v)), 'a spare variant can be deleted');

-- Ordered products are archived, never deleted, so order history stays readable.
select test.eq((select status from public.admin_archive_product((select id from t_p)))::text,
               'archived', 'a product can be archived');

-- ---- discounts -----------------------------------------------------------
select test.ok((public.admin_upsert_discount(code => 'TEST20', kind => 'percentage', value => 20)).id is not null,
               'a discount code can be created');
select test.raises(
  $$select public.admin_upsert_discount(code => 'BAD', kind => 'percentage', value => 250)$$,
  '22023', 'a percentage over 100 is rejected');

-- ---- review moderation ---------------------------------------------------
select test.as_user('11111111-1111-1111-1111-111111111111', false);  -- bought the mug
create temp table t_r as
select * from public.submit_review(
  product_id => (select id from public.products where slug='ceramic-mug'),
  rating => 5, title => 'Сайхан', body => 'Гоё');

select test.ok(not (select is_approved from t_r), 'a new review starts unapproved');
select test.ok((select is_verified_purchase from t_r), 'the purchase is verified from order history');
select test.eq((select rating_count from public.products where slug='ceramic-mug'), 0,
               'an unapproved review does not count toward the rating');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
select test.ok((select is_approved from public.admin_set_review_approval((select id from t_r), true)),
               'admin can approve a review');
select test.eq((select rating_count from public.products where slug='ceramic-mug'), 1,
               'approval feeds the derived rating');
select test.eq((select rating_avg from public.products where slug='ceramic-mug'), 5.0::numeric(2,1),
               'the average rating is computed');

select test.as_user('44444444-4444-4444-4444-444444444444', false);
select test.raises(
  format($$select public.admin_set_review_approval(%L, true)$$, (select id from t_r)),
  '42501', 'a customer cannot moderate reviews');

-- ---- maintenance ---------------------------------------------------------
select test.as_service();
insert into auth.users (id, is_anonymous, created_at)
values ('77777777-7777-7777-7777-777777777777', true, now() - interval '30 days');

select test.eq(public.cleanup_anonymous_users('7 days'), 1, 'a stale empty anonymous user is swept');
select test.eq((select count(*)::int from auth.users where id='55555555-5555-5555-5555-555555555555'), 1,
               'an anonymous user with a cart is kept');
select test.ok(public.expire_stale_carts('30 days') >= 0, 'stale carts can be expired');
