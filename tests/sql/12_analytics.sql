\set ON_ERROR_STOP on
\echo '── analytics: stock baseline and the admin report ──'

select test.as_service();
update public.variants set quantity = 20 where sku = 'TEST-CHARM-1';
select test.eq((select stock_baseline from public.variants where sku = 'TEST-CHARM-1'), 20, 'raising stock sets the baseline');
update public.variants set quantity = 8 where sku = 'TEST-CHARM-1';
select test.eq((select stock_baseline from public.variants where sku = 'TEST-CHARM-1'), 20, 'selling down keeps the baseline');

select test.as_user('11111111-1111-1111-1111-111111111111', false);
select test.raises($$select public.admin_analytics(now() - interval '7 days')$$, '42501', 'only an admin sees analytics');

select test.as_user('22222222-2222-2222-2222-222222222222', false);
create temp table t_report as select public.admin_analytics(now() - interval '7 days', now() + interval '1 minute') as r;

select test.ok((select r -> 'stock_low' @> '[{"variant": null, "quantity": 8, "baseline": 20}]' from t_report),
  'a variant under half its restock level is listed as low');
select test.ok((select r -> 'stock_out' @> '[{"variant": "Өнгө: Хар · Хэмжээ: 40"}]' from t_report),
  'a sold-out variant is listed with its colour and size');
select test.ok((select (r -> 'totals' ->> 'orders')::int > 0 from t_report), 'orders placed this week are counted');
select test.ok((select jsonb_array_length(r -> 'by_day') between 7 and 9 from t_report), 'one row per day in the window');
select test.ok((select r ? 'top_products' and r ? 'categories' and r ? 'carts' and r ? 'order_stages' from t_report),
  'products, categories, carts and order stages are reported');

select test.ok(not has_function_privilege('anon', 'public.admin_analytics(timestamptz, timestamptz)', 'EXECUTE'),
  'anon cannot run the report');

select test.as_service();
