-- ============================================================================
-- hotaru — 06. Seed
-- ============================================================================
-- Safe to re-run. Product rows are placeholders so the storefront has something
-- to render before real photography exists; image paths point at nothing until
-- assets are uploaded to ImageKit.
-- ============================================================================

insert into public.delivery_methods (code, name, kind, fee_mnt, note, position) values
  ('ub_courier',  'Улаанбаатар хот доторх хүргэлт', 'courier',   5000,  'Ажлын 1-2 хоногт', 1),
  ('pickup',      'Дэлгүүрээс өөрөө авах',          'pickup',    0,     'Урьдчилан утсаар холбогдоно уу', 2),
  ('intercity',   'Орон нутгийн хүргэлт',           'intercity', 15000, 'Унаанд тавьж илгээнэ', 3)
on conflict (code) do nothing;

with c as (
  insert into public.categories (slug, position) values
    ('earrings', 1), ('necklaces', 2), ('rings', 3)
  on conflict (slug) do nothing
  returning id, slug
)
insert into public.category_translations (category_id, locale, name)
select c.id, 'mn',
       case c.slug when 'earrings' then 'Ээмэг'
                   when 'necklaces' then 'Зүүлт'
                   else 'Бөгж' end
from c
on conflict (category_id, locale) do nothing;

-- Two placeholder products, each single-SKU (no option axis) — the shape the
-- accessories catalog actually uses.
do $$
declare
  v_cat  uuid;
  v_prod uuid;
begin
  select id into v_cat from public.categories where slug = 'earrings';

  insert into public.products (category_id, slug, status, is_featured, position, published_at)
  values (v_cat, 'aurora-drop', 'active', true, 1, now())
  on conflict (slug) do nothing
  returning id into v_prod;

  if v_prod is not null then
    insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
    values (v_prod, 'mn', 'Aurora Drop', 'Мөнгөн ээмэг',
            'Гар аргаар хийсэн, 925 сорьцын мөнгөн ээмэг.',
            'Усанд норгохоос сэргийлнэ. Зөөлөн даавуугаар арчина.');
    -- No option axis: one default variant, so the PDP shows no selector.
    insert into public.variants (product_id, sku, price_mnt, quantity, position)
    values (v_prod, 'HTR-AUR-001', 189000, 8, 0);
  end if;

  select id into v_cat from public.categories where slug = 'necklaces';

  insert into public.products (category_id, slug, status, position, published_at)
  values (v_cat, 'linea-chain', 'active', 2, now())
  on conflict (slug) do nothing
  returning id into v_prod;

  if v_prod is not null then
    insert into public.product_translations (product_id, locale, title, subtitle, description)
    values (v_prod, 'mn', 'Linea Chain', 'Мөнгөн зүүлт',
            'Энгийн шугаман хэлбэртэй, өдөр тутам зүүхэд тохиромжтой.');
    -- One axis (length), two variants -> the PDP renders a selector.
    insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position) values
      (v_prod, 'HTR-LIN-045', 'Урт', '45cm', 240000, 5, 0),
      (v_prod, 'HTR-LIN-050', 'Урт', '50cm', 260000, 3, 1);
  end if;
end $$;

insert into public.discount_codes (code, kind, value, min_subtotal_mnt, is_active)
values ('NEEELT10', 'percentage', 10, 100000, true)
on conflict (code) do nothing;
