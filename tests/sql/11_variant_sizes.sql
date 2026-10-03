\set ON_ERROR_STOP on
\echo '── variants: colour × size ──'

select test.as_service();

do $$
declare v_p uuid;
begin
  insert into public.products (slug, category_id, status, position, published_at)
  values ('test-shoe', (select id from public.categories where slug = 'test-cat'), 'active', 960, now())
  returning id into v_p;
  insert into public.product_translations (product_id, locale, title) values (v_p, 'mn', 'Test Shoe');
  insert into public.variants (product_id, sku, price_mnt, quantity, position)
  values (v_p, 'TEST-SHOE-BASE', 150000, 3, 0);
end $$;

select test.as_user('22222222-2222-2222-2222-222222222222', false);

create temp table t_grid as
select * from public.admin_create_size_grid(
  (select id from public.products where slug = 'test-shoe'),
  array['37', ' 38 ', '', '38', '39'], 150000, array['Хар', 'Цагаан', 'Хар'], 2);

select test.eq((select count(*)::int from t_grid), 6, 'two colours × three sizes, blanks and duplicates dropped');
select test.eq(
  (select string_agg(option_value || '/' || size, ',' order by position) from t_grid),
  'Хар/37,Хар/38,Хар/39,Цагаан/37,Цагаан/38,Цагаан/39', 'variants follow the grid order');
select test.ok((select bool_and(option_label = 'Өнгө' and quantity = 2 and is_active) from t_grid),
  'each new variant is an active colour option with the given stock');
select test.ok(not (select is_active from public.variants where sku = 'TEST-SHOE-BASE'),
  'the blank base variant is deactivated, not deleted');

select test.eq((select count(*)::int from public.admin_create_size_grid(
  (select id from public.products where slug = 'test-shoe'), array['39', '40'], 150000, array['Хар'])),
  1, 'running the grid again only adds the missing combination');

select test.raises(format($$select public.admin_create_size_grid(%L, array['', ' '], 1000)$$,
  (select id from public.products where slug = 'test-shoe')), '22023', 'a grid needs at least one size');

select test.eq((select size from public.admin_set_variant_size(
  (select id from t_grid where option_value = 'Цагаан' and size = '39'), ' 39.5 ')), '39.5', 'a size can be edited and is trimmed');

select test.raises(format($$update public.variants set size = '37' where id = %L$$,
  (select id from t_grid where option_value = 'Хар' and size = '38')), '23505', 'a colour cannot repeat a size');

-- ---- the size reaches the order line --------------------------------------
select test.as_user('a0a0a0a0-0000-0000-0000-0000000000e0', false);
select public.add_to_cart((select id from t_grid where option_value = 'Хар' and size = '38'), 1);
create temp table t_shoe_order as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000099',
  (select id from public.delivery_methods where code = 'ub_courier'));
select test.eq((select variant_label from public.order_items where order_id = (select id from t_shoe_order)),
  'Өнгө: Хар · Хэмжээ: 38', 'the order line records colour and size');

select test.raises(format($$select public.admin_set_variant_size(%L, '41')$$, (select id from t_grid limit 1)),
  '42501', 'a customer cannot edit sizes');
select test.raises(format($$select public.admin_create_size_grid(%L, array['41'], 1000)$$,
  (select id from public.products where slug = 'test-shoe')), '42501', 'a customer cannot create a size grid');

select test.ok(
  not has_function_privilege('anon', 'public.admin_set_variant_size(uuid, text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.admin_create_size_grid(uuid, text[], bigint, text[], int, boolean)', 'EXECUTE'),
  'size admin functions are not anon-executable');

select test.as_service();
