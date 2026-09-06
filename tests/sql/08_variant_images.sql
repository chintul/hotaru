\set ON_ERROR_STOP on
\echo '── admin: variant images ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

-- The fixtures give every test product one variant but no photographs
-- (tests/helpers/02_fixtures.sql:35-48), so this suite makes its own. Two for
-- test-mug and one for test-bottle: the cross-product guard needs an image that
-- provably belongs somewhere else.
--
-- Positions are literals, not `max(position)+1`. Every row of one INSERT sees
-- the same pre-statement snapshot, so a computed max collides on
-- `unique (product_id, position)` — the bug that cost
-- 20260905100000_variant_featured_images.sql an entire migration.
insert into public.product_images (product_id, imagekit_file_id, file_path, position)
select p.id, 'fid-mug-0', '/test/mug-0.jpg', 0 from public.products p where p.slug = 'test-mug'
union all
select p.id, 'fid-mug-1', '/test/mug-1.jpg', 1 from public.products p where p.slug = 'test-mug'
union all
select p.id, 'fid-bot-0', '/test/bottle-0.jpg', 0 from public.products p where p.slug = 'test-bottle';

create temp table t as
select
  (select v.id from public.variants v
     join public.products p on p.id = v.product_id where p.slug = 'test-mug')     as mug_variant,
  (select p.id from public.products p where p.slug = 'test-mug')                  as mug_product,
  (select id from public.product_images where file_path = '/test/mug-0.jpg')      as mug_img0,
  (select id from public.product_images where file_path = '/test/mug-1.jpg')      as mug_img1,
  (select id from public.product_images where file_path = '/test/bottle-0.jpg')   as bottle_img;

-- ---- admin_set_variant_image --------------------------------------------
select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         (select mug_variant from t), (select bottle_img from t)),
  '22023', 'an image from a different product is rejected');

select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'the rejected call changed nothing');

select public.admin_set_variant_image((select mug_variant from t), (select mug_img0 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img0 from t), 'set_variant_image points the variant at the photo');

select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         '00000000-0000-0000-0000-000000000000', (select mug_img0 from t)),
  'P0002', 'an unknown variant raises');

-- ---- admin_upsert_variant and the coalesce rule --------------------------
-- A null image_id means "this caller did not supply one", never "clear it".
-- The row editor sends price and stock without knowing the photo.
select public.admin_upsert_variant(
  product_id => (select mug_product from t),
  price_mnt  => 128000,
  quantity   => 12,
  variant_id => (select mug_variant from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img0 from t), 'a null image_id on upsert leaves the stored photo alone');

select public.admin_upsert_variant(
  product_id => (select mug_product from t),
  price_mnt  => 128000,
  quantity   => 12,
  variant_id => (select mug_variant from t),
  image_id   => (select mug_img1 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  (select mug_img1 from t), 'a supplied image_id on upsert replaces the photo');

select test.raises(
  format($$select public.admin_upsert_variant(product_id => %L, price_mnt => 1000, quantity => 1, variant_id => %L, image_id => %L)$$,
         (select mug_product from t), (select mug_variant from t), (select bottle_img from t)),
  '22023', 'upsert rejects an image from a different product');

-- Insert path: a brand new variant can arrive with its photo already chosen.
select test.eq(
  (select image_id from public.admin_upsert_variant(
     product_id   => (select mug_product from t),
     price_mnt    => 99000,
     quantity     => 3,
     sku          => 'TEST-MUG-IMG',
     -- Both halves or neither: variants_option_pair_ck (20260904120100:173).
     option_label => 'Өнгө',
     option_value => 'Cherry',
     image_id     => (select mug_img0 from t))),
  (select mug_img0 from t), 'a new variant can be created with an image');

-- ---- the option pair is all-or-nothing ------------------------------------
-- variants_option_pair_ck (20260904120100:173). The row editor lets you clear a
-- colour name, and sending a label with a null value raises here rather than
-- saving a half-set axis — so the editor has to null BOTH or neither.
select test.raises(
  format($$select public.admin_upsert_variant(product_id => %L, price_mnt => 1000, quantity => 1, variant_id => %L, option_label => 'Өнгө', option_value => null)$$,
         (select mug_product from t), (select mug_variant from t)),
  '23514', 'a label without a value is rejected');

select public.admin_upsert_variant(
  product_id   => (select mug_product from t),
  price_mnt    => 128000,
  quantity     => 12,
  variant_id   => (select mug_variant from t),
  option_label => 'Өнгө',
  option_value => 'Cream');
select test.eq(
  (select option_value from public.variants where id = (select mug_variant from t)),
  'Cream', 'both halves together are accepted');

-- ---- clearing, which only set_variant_image can do -----------------------
select public.admin_set_variant_image((select mug_variant from t), null);
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'a null image_id on set_variant_image clears the link');

-- ---- deleting a photo empties the variants pointing at it ----------------
select public.admin_set_variant_image((select mug_variant from t), (select mug_img1 from t));
select public.admin_delete_product_image((select mug_img1 from t));
select test.eq(
  (select image_id from public.variants where id = (select mug_variant from t)),
  null::uuid, 'deleting an image nulls image_id on the variants using it');
select test.eq(
  (select quantity from public.variants where id = (select mug_variant from t)),
  12, 'and leaves the rest of the variant row intact');

-- ---- the admin guard ------------------------------------------------------
select test.as_user('11111111-1111-1111-1111-111111111111', false);  -- a customer
select test.raises(
  format($$select public.admin_set_variant_image(%L, %L)$$,
         (select mug_variant from t), (select mug_img0 from t)),
  '42501', 'a non-admin cannot set a variant image');
select test.raises(
  format($$select public.admin_upsert_variant(product_id => %L, price_mnt => 1, quantity => 1)$$,
         (select mug_product from t)),
  '42501', 'a non-admin cannot upsert a variant');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
