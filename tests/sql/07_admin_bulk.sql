\set ON_ERROR_STOP on
\echo '── admin: bulk actions ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

-- Two of the four fixture products; the other two are the control group that
-- proves a bulk action touches only what was selected.
create temp table t_ids as
select array_agg(id) as ids from public.products where slug in ('test-mug', 'test-bottle');

-- ---- status --------------------------------------------------------------
select test.eq(
  (select count(*)::int from public.admin_bulk_set_product_status((select ids from t_ids), 'draft')),
  2, 'bulk status returns one row per id');
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and status = 'draft'),
  2, 'both selected products are drafted');
select test.eq(
  (select count(*)::int from public.products where slug in ('test-holder','test-charm') and status = 'active'),
  2, 'unselected products are untouched');

select public.admin_bulk_set_product_status((select ids from t_ids), 'active');
select test.ok(
  (select bool_and(published_at is not null) from public.products where slug in ('test-mug','test-bottle')),
  'published_at is stamped when a bulk status goes active');

select test.raises(
  format($$select public.admin_bulk_set_product_status(%L, 'nonsense')$$, (select ids from t_ids)),
  '22P02', 'an invalid status raises rather than matching nothing');

-- ---- featured ------------------------------------------------------------
select public.admin_bulk_set_product_featured((select ids from t_ids), true);
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and is_featured),
  2, 'bulk feature sets the flag');
select public.admin_bulk_set_product_featured((select ids from t_ids), false);
select test.eq(
  (select count(*)::int from public.products where slug in ('test-mug','test-bottle') and is_featured),
  0, 'bulk unfeature clears it');

-- ---- category ------------------------------------------------------------
insert into public.categories (slug, position, is_visible) values ('bulk-cat', 901, true)
on conflict (slug) do nothing;

select public.admin_bulk_set_product_category((select ids from t_ids), 'bulk-cat');
select test.eq(
  (select count(*)::int from public.products p join public.categories c on c.id = p.category_id
    where p.slug in ('test-mug','test-bottle') and c.slug = 'bulk-cat'),
  2, 'bulk category moves the selection');

select test.raises(
  format($$select public.admin_bulk_set_product_category(%L, 'no-such-cat')$$, (select ids from t_ids)),
  'P0002', 'an unknown category slug raises');
select test.eq(
  (select count(*)::int from public.products p join public.categories c on c.id = p.category_id
    where p.slug in ('test-mug','test-bottle') and c.slug = 'bulk-cat'),
  2, 'the failed category call changed nothing');

-- ---- delete, and the order-history guarantee ------------------------------
-- A throwaway product, not a shared fixture: deleting test-mug here would be a
-- trap for whoever adds suite 08.
create temp table t_doomed as
select id from public.admin_upsert_product(
  slug => 'bulk-doomed', title => 'Bulk Doomed', category_slug => 'test-cat', status => 'active');

create temp table t_doomed_v as
select id from public.admin_upsert_variant(
  product_id => (select id from t_doomed), price_mnt => 55000, quantity => 3, sku => 'BULK-DOOM-1');

-- An order line must stay readable after its product is hard-deleted. This is
-- the assertion the whole "offer delete" decision rests on.
create temp table t_order as
with ins as (
  insert into public.orders
    (order_number, email, phone, status, payment_status, subtotal_mnt, total_mnt, shipping_address)
  values ('BULK-1', 'buyer@hotaru.mn', '99001122', 'awaiting_payment', 'unpaid',
          55000, 55000, '{"line1":"test"}'::jsonb)
  returning id
)
select id from ins;

insert into public.order_items
  (order_id, variant_id, product_id, product_title, sku, unit_price_mnt, quantity)
values ((select id from t_order), (select id from t_doomed_v), (select id from t_doomed),
        'Bulk Doomed', 'BULK-DOOM-1', 55000, 1);

select test.eq(public.admin_bulk_delete_products(array[(select id from t_doomed)]), 1,
  'bulk delete reports how many rows went');
select test.eq(
  (select count(*)::int from public.products where slug = 'bulk-doomed'),
  0, 'the product is gone');
select test.eq(
  (select product_title from public.order_items where order_id = (select id from t_order)),
  'Bulk Doomed', 'the order line still reads after its product is deleted');
select test.eq(
  (select unit_price_mnt from public.order_items where order_id = (select id from t_order)),
  55000::bigint, 'the snapshot price survives too');
select test.ok(
  (select product_id is null from public.order_items where order_id = (select id from t_order)),
  'the deleted product reference is nulled, not dangling');

-- ---- reviews -------------------------------------------------------------
-- One review per (product, profile), so two products are needed for two rows.
create temp table t_rev as
with ins as (
  insert into public.reviews (product_id, profile_id, rating, body, is_approved)
  select p.id, '22222222-2222-2222-2222-222222222222', 5, 'Сайхан', false
    from public.products p where p.slug in ('test-bottle','test-holder')
  returning id
)
select id from ins;

select test.eq(
  (select count(*)::int from public.admin_bulk_set_review_approval(
     (select array_agg(id) from t_rev), true)),
  2, 'bulk approval returns one row per review');
select test.eq(
  (select count(*)::int from public.reviews r where r.id in (select id from t_rev) and r.is_approved),
  2, 'both reviews are approved');
select test.eq(public.admin_bulk_delete_reviews((select array_agg(id) from t_rev)), 2,
  'bulk delete reports the review count');

-- ---- discounts -----------------------------------------------------------
create temp table t_disc as
with ins as (
  insert into public.discount_codes (code, kind, value, is_active)
  values ('BULKA', 'percentage', 5, true), ('BULKB', 'percentage', 5, true)
  returning id
)
select id from ins;

select public.admin_bulk_set_discount_active((select array_agg(id) from t_disc), false);
select test.eq(
  (select count(*)::int from public.discount_codes where id in (select id from t_disc) and not is_active),
  2, 'bulk deactivate clears is_active');
select test.eq(public.admin_bulk_delete_discounts((select array_agg(id) from t_disc)), 2,
  'bulk delete reports the discount count');

-- ---- the admin guard, on every one of them --------------------------------
-- A permission check that silently passes is worse than no check, so each
-- function is asserted separately rather than by sampling one of them.
select test.as_user(null);   -- anonymous

select test.raises($$select public.admin_bulk_set_product_status(array[gen_random_uuid()], 'draft')$$,
  '42501', 'bulk status is admin-only');
select test.raises($$select public.admin_bulk_set_product_featured(array[gen_random_uuid()], true)$$,
  '42501', 'bulk feature is admin-only');
select test.raises($$select public.admin_bulk_set_product_category(array[gen_random_uuid()], 'test-cat')$$,
  '42501', 'bulk category is admin-only');
select test.raises($$select public.admin_bulk_delete_products(array[gen_random_uuid()])$$,
  '42501', 'bulk product delete is admin-only');
select test.raises($$select public.admin_bulk_set_review_approval(array[gen_random_uuid()], true)$$,
  '42501', 'bulk review approval is admin-only');
select test.raises($$select public.admin_bulk_delete_reviews(array[gen_random_uuid()])$$,
  '42501', 'bulk review delete is admin-only');
select test.raises($$select public.admin_bulk_set_discount_active(array[gen_random_uuid()], true)$$,
  '42501', 'bulk discount toggle is admin-only');
select test.raises($$select public.admin_bulk_delete_discounts(array[gen_random_uuid()])$$,
  '42501', 'bulk discount delete is admin-only');

select test.as_service();
