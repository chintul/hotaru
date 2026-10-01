\set ON_ERROR_STOP on
\echo '── admin: categories ──'

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin

create temp table t_cat as
select * from public.admin_upsert_category(
  slug => 'test-new-cat', name => '  Шинэ ангилал  ', description => 'Тайлбар', sort_order => 5);

select test.eq((select slug::text from t_cat), 'test-new-cat', 'a new category is created');
select test.eq((select position from t_cat), 5, 'sort_order lands in position');
select test.eq(
  (select name from public.category_translations where category_id = (select id from t_cat) and locale = 'mn'),
  'Шинэ ангилал', 'the mn name is written trimmed');

select test.raises(
  $$select public.admin_upsert_category(slug => 'test-cat', name => 'Давхар')$$,
  '23505', 'creating a slug that already exists raises instead of overwriting');
select test.eq(
  (select name from public.category_translations ct join public.categories c on c.id = ct.category_id
    where c.slug = 'test-cat' and ct.locale = 'mn'),
  'Тест ангилал', 'the existing category keeps its name');

select test.raises($$select public.admin_upsert_category(slug => 'x', name => '   ')$$,
  '22023', 'a blank name is rejected');
select test.raises($$select public.admin_upsert_category(slug => '', name => 'Нэр')$$,
  '22023', 'a blank slug is rejected');
select test.raises($$select public.admin_upsert_category(slug => 'y', name => 'Нэр', parent_slug => 'no-such')$$,
  'P0002', 'an unknown parent raises');

select public.admin_upsert_category(
  slug => 'test-new-cat', name => 'Засварласан', parent_slug => 'test-cat',
  is_visible => false, category_id => (select id from t_cat));
select test.ok(
  (select not c.is_visible and c.parent_id = (select id from public.categories where slug = 'test-cat')
     from public.categories c where c.id = (select id from t_cat)),
  'editing updates visibility and parent');
select test.eq(
  (select name from public.category_translations where category_id = (select id from t_cat) and locale = 'mn'),
  'Засварласан', 'editing updates the name');

select test.raises(
  format($$select public.admin_upsert_category(slug => 'test-new-cat', name => 'x', parent_slug => 'test-new-cat', category_id => %L)$$,
         (select id from t_cat)),
  '22023', 'a category cannot be its own parent');
select test.raises(
  $$select public.admin_upsert_category(slug => 'ghost', name => 'x', category_id => gen_random_uuid())$$,
  'P0002', 'editing a missing category raises');

select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.raises($$select public.admin_upsert_category(slug => 'z', name => 'z')$$,
  '42501', 'a customer cannot create categories');

select test.ok(
  not has_function_privilege('anon', 'public.admin_upsert_category(text, text, text, text, boolean, int, uuid)', 'EXECUTE'),
  'admin_upsert_category is not anon-executable');

select test.as_service();
