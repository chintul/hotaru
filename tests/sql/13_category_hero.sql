\set ON_ERROR_STOP on
\echo '── admin: category hero images ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

create temp table t_tile as
select coalesce(image_path, '') as before from public.categories where slug = 'test-cat';

select public.admin_set_category_hero_image(
  (select id from public.categories where slug = 'test-cat'), '  /hotaru/category-hero/test.png  ');
select test.eq(
  (select hero_image_path from public.categories where slug = 'test-cat'),
  '/hotaru/category-hero/test.png', 'an admin sets the hero path, trimmed');
select test.eq(
  (select coalesce(image_path, '') from public.categories where slug = 'test-cat'),
  (select before from t_tile),
  'the round tile image is left alone');

select public.admin_set_category_hero_image((select id from public.categories where slug = 'test-cat'), '   ');
select test.ok(
  (select hero_image_path is null from public.categories where slug = 'test-cat'),
  'a blank path clears the hero');

select test.raises(
  $$select public.admin_set_category_hero_image(gen_random_uuid(), '/x.png')$$,
  'P0002', 'a missing category raises');

select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.raises(
  $$select public.admin_set_category_hero_image((select id from public.categories where slug = 'test-cat'), '/x.png')$$,
  '42501', 'a customer cannot set a hero image');

select test.ok(
  not has_function_privilege('anon', 'public.admin_set_category_hero_image(uuid, text)', 'EXECUTE'),
  'admin_set_category_hero_image is not anon-executable');

select test.as_service();

\echo '── admin: category phone hero images ──'
select test.as_user('22222222-2222-2222-2222-222222222222', false);

select public.admin_set_category_mobile_hero_image(
  (select id from public.categories where slug = 'test-cat'), ' /hotaru/category-hero/test-mobile.png ');
select test.eq(
  (select hero_mobile_image_path from public.categories where slug = 'test-cat'),
  '/hotaru/category-hero/test-mobile.png', 'an admin sets the phone hero path, trimmed');
select test.ok(
  (select hero_image_path is null from public.categories where slug = 'test-cat'),
  'the wide hero is left alone');

select public.admin_set_category_mobile_hero_image((select id from public.categories where slug = 'test-cat'), null);
select test.ok(
  (select hero_mobile_image_path is null from public.categories where slug = 'test-cat'),
  'a null path clears the phone hero');

select test.raises(
  $$select public.admin_set_category_mobile_hero_image(gen_random_uuid(), '/x.png')$$,
  'P0002', 'a missing category raises');

select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.raises(
  $$select public.admin_set_category_mobile_hero_image((select id from public.categories where slug = 'test-cat'), '/x.png')$$,
  '42501', 'a customer cannot set a phone hero');

select test.ok(
  not has_function_privilege('anon', 'public.admin_set_category_mobile_hero_image(uuid, text)', 'EXECUTE'),
  'admin_set_category_mobile_hero_image is not anon-executable');

select test.as_service();
