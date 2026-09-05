-- Shared fixtures.
--
-- The suites deliberately create their OWN catalog rather than leaning on the
-- seed migration. Tests that assert against seed slugs break every time the
-- catalog is re-merchandised, which says nothing about the code under test.
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222','owner@hotaru.mn')
on conflict (id) do nothing;

-- No auth.uid() here, so the role-protection trigger stands aside — the same
-- escape hatch the Supabase SQL editor uses to make the first admin.
update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';

insert into public.categories (slug, position, is_visible) values ('test-cat', 900, true)
on conflict (slug) do nothing;
insert into public.category_translations (category_id, locale, name)
select id, 'mn', 'Тест ангилал' from public.categories where slug = 'test-cat'
on conflict on constraint category_translations_category_id_locale_key do nothing;

do $$
declare
  v_cat uuid;
  v_p   uuid;
  r     record;
begin
  select id into v_cat from public.categories where slug = 'test-cat';

  for r in
    select * from (values
      ('test-mug',    'Test Mug',    128000::bigint, 12),
      ('test-bottle', 'Test Bottle', 172000::bigint,  8),
      ('test-holder', 'Test Holder', 121000::bigint, 10),
      ('test-charm',  'Test Charm',  128000::bigint, 14)
    ) as t(slug, title, price, qty)
  loop
    insert into public.products (slug, category_id, status, position, published_at)
    values (r.slug, v_cat, 'active', 900, now())
    on conflict on constraint products_slug_key do update set status = 'active'
    returning id into v_p;

    insert into public.product_translations (product_id, locale, title)
    values (v_p, 'mn', r.title)
    on conflict on constraint product_translations_product_id_locale_key
    do update set title = excluded.title;

    insert into public.variants (product_id, sku, price_mnt, quantity, position)
    values (v_p, upper(replace(r.slug, 'test-', 'TEST-')) || '-1', r.price, r.qty, 0)
    on conflict on constraint variants_sku_key
    do update set price_mnt = excluded.price_mnt, quantity = excluded.quantity;
  end loop;
end $$;
