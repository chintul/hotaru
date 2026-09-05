-- ============================================================================
-- hotaru — 10. Catalog seed
-- ============================================================================
-- Nine products across six categories, modelled on the structure of the
-- reference store (tagiofficial.com): a lifestyle range — bags, drinkware,
-- daily-carry, hats, phone accessories and a little jewellery — rather than the
-- jewellery-only assumption in the original seed.
--
-- What was taken and what was NOT:
--   * TAKEN: the catalog SHAPE — category tree, product types, how many colour
--     options a line carries, and the price bands (their USD prices converted
--     at ~3,450 MNT and rounded to retail-looking figures).
--   * NOT TAKEN: their brand name, their character/sub-brand names
--     ("Pony Magi", "Haha&Popcorn", "Blackie"), their product copy, and their
--     photography. Those are theirs, and per decision #15 this store ships its
--     own assets. Colour options keep only the plain colour word.
--
-- NOTE ON VARIANTS: the reference sells its phone case as Colour x Model
-- (20 variants). This schema deliberately supports ONE axis (decision #8), so
-- that product is seeded by colour only. If you want to sell device-specific
-- models, the option matrix from the original design has to come back.
--
-- Replaces the two placeholder products. Safe to re-run.
-- ============================================================================

-- Remove the original placeholder seed. Guarded: never touch a product that a
-- real order already references.
delete from public.products p
 where p.slug in ('aurora-drop', 'linea-chain')
   and not exists (select 1 from public.order_items oi where oi.product_id = p.id);

delete from public.categories where slug in ('earrings', 'necklaces', 'rings');


-- Categories -----------------------------------------------------------------

insert into public.categories (slug, position, is_visible)
values ('bags', 1, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Цүнх', 'Өдөр тутмын болон онцгой үеийн цүнх.' from public.categories where slug = 'bags'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible)
values ('drinkware', 2, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Аяга сав', 'Гар аргаар хийсэн аяга, термос.' from public.categories where slug = 'drinkware'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible)
values ('accessories', 3, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Өдөр тутмын хэрэглэл', 'Аяллын болон өдөр тутмын жижиг хэрэглэл.' from public.categories where slug = 'accessories'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible)
values ('hats', 4, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Малгай', 'Улирлын малгай, кепка.' from public.categories where slug = 'hats'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible)
values ('tech', 5, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Утасны хэрэгсэл', 'Утас, төхөөрөмжийн гоёл, хамгаалалт.' from public.categories where slug = 'tech'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible)
values ('jewelry', 6, true)
on conflict (slug) do update set position = excluded.position;

insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Гоёл чимэглэл', 'Сувд, мөнгөн эдлэл.' from public.categories where slug = 'jewelry'
on conflict (category_id, locale) do update
  set name = excluded.name, description = excluded.description;


-- Products -------------------------------------------------------------------

-- Woven Shoulder Bag — 469,000 MNT (~$135.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'woven-shoulder-bag', c.id, 'active', true, 1, now(), '{}'::text[]
from public.categories c where c.slug = 'bags'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Woven Shoulder Bag', 'Сүлжмэл мөрний цүнх', 'PU арьсан сүлжмэл гадаргуутай мөрний цүнх. Дотор нь салангид халаастай, өдөр тутмын хэрэглээнд тохиромжтой багтаамжтай.', 'Чийгнээс хамгаална. Зөөлөн даавуугаар арчина.'
from public.products where slug = 'woven-shoulder-bag'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WSB-01', 'Өнгө', 'Galaxy', 469000, 4, 0
from public.products where slug = 'woven-shoulder-bag'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WSB-02', 'Өнгө', 'Matcha', 469000, 6, 1
from public.products where slug = 'woven-shoulder-bag'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WSB-03', 'Өнгө', 'Hazelnut', 469000, 5, 2
from public.products where slug = 'woven-shoulder-bag'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Cosmetic Storage Bag — 179,000 MNT (~$51.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'cosmetic-storage-bag', c.id, 'active', false, 2, now(), '{}'::text[]
from public.categories c where c.slug = 'bags'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Cosmetic Storage Bag', 'Гоо сайхны цүнх', 'Гоо сайхны хэрэгсэл хадгалах зөөврийн цүнх. Усанд тэсвэртэй дотортой, аялалд авахад хөнгөн.', 'Дотор талыг чийгтэй даавуугаар арчина.'
from public.products where slug = 'cosmetic-storage-bag'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CSB-01', 'Өнгө', 'Taro', 179000, 8, 0
from public.products where slug = 'cosmetic-storage-bag'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CSB-02', 'Өнгө', 'Dark Chocolate', 179000, 7, 1
from public.products where slug = 'cosmetic-storage-bag'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Hand-Painted Ceramic Mug — 128,000 MNT (~$36.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'ceramic-mug', c.id, 'active', true, 3, now(), '{}'::text[]
from public.categories c where c.slug = 'drinkware'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Hand-Painted Ceramic Mug', 'Гар зурагт шаазан аяга', 'Гар аргаар зурсан шаазан аяга, 350мл. Аяга бүр өөрийн гэсэн өнгөний ялгаатай.', 'Гараар угаахыг зөвлөнө. Богино хугацаанд микро долгионд хэрэглэж болно.'
from public.products where slug = 'ceramic-mug'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CM-01', 'Өнгө', 'Berry', 128000, 12, 0
from public.products where slug = 'ceramic-mug'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CM-02', 'Өнгө', 'Citrus', 128000, 10, 1
from public.products where slug = 'ceramic-mug'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CM-03', 'Өнгө', 'Cream', 128000, 9, 2
from public.products where slug = 'ceramic-mug'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Strawberry Vacuum Bottle 620ml — 172,000 MNT (~$49.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'vacuum-bottle-620', c.id, 'active', false, 4, now(), '{}'::text[]
from public.categories c where c.slug = 'drinkware'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Strawberry Vacuum Bottle 620ml', 'Термос сав 620мл', 'Хоёр давхар вакуум ханатай термос. Халуун 12 цаг, хүйтэн 24 цаг хадгална.', 'Угсрахаас өмнө бүрэн хатаана. Аяганы тагийг задалж угаана.'
from public.products where slug = 'vacuum-bottle-620'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-VB6-01', 'Өнгө', 'Berry', 172000, 6, 0
from public.products where slug = 'vacuum-bottle-620'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-VB6-02', 'Өнгө', 'Taro', 172000, 6, 1
from public.products where slug = 'vacuum-bottle-620'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Passport Holder — 121,000 MNT (~$34.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'passport-holder', c.id, 'active', false, 5, now(), '{}'::text[]
from public.categories c where c.slug = 'accessories'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Passport Holder', 'Пасспортны гэр', 'Аяллын пасспорт, картны гэр. Нимгэн бөгөөд гадуур цүнхэнд амархан багтана.', 'Шууд нарны гэрэлд удаан байлгахаас зайлсхийнэ.'
from public.products where slug = 'passport-holder'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PH-01', 'Өнгө', 'Dots', 121000, 10, 0
from public.products where slug = 'passport-holder'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PH-02', 'Өнгө', 'Orange', 121000, 8, 1
from public.products where slug = 'passport-holder'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PH-03', 'Өнгө', 'Seasalt', 121000, 9, 2
from public.products where slug = 'passport-holder'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Bag Charm Pendant — 128,000 MNT (~$36.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'bag-charm-pendant', c.id, 'active', true, 6, now(), '{}'::text[]
from public.categories c where c.slug = 'accessories'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Bag Charm Pendant', 'Цүнхний зүүлт', 'Цүнх, түлхүүрт зүүх чимэглэл. Металл цагирагтай, амархан салгаж зүүнэ.', 'Хүчтэй татахаас зайлсхийнэ.'
from public.products where slug = 'bag-charm-pendant'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-BCP-01', 'Өнгө', 'Mermaid', 128000, 14, 0
from public.products where slug = 'bag-charm-pendant'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-BCP-02', 'Өнгө', 'Strawberry', 128000, 11, 1
from public.products where slug = 'bag-charm-pendant'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-BCP-03', 'Өнгө', 'Floatie', 128000, 9, 2
from public.products where slug = 'bag-charm-pendant'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-BCP-04', 'Өнгө', 'Skateboard', 128000, 7, 3
from public.products where slug = 'bag-charm-pendant'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Sunflower Baseball Cap — 162,000 MNT (~$46.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'sunflower-baseball-cap', c.id, 'active', false, 7, now(), '{}'::text[]
from public.categories c where c.slug = 'hats'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Sunflower Baseball Cap', 'Наранцэцэг кепка', 'Хөвөн даавуун кепка, ар талдаа тохируулгатай. Толгойн хэмжээ 54–60см.', '30°C-аас доош температурт гараар угаана.'
from public.products where slug = 'sunflower-baseball-cap'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SBC-01', 'Өнгө', 'Denim', 162000, 9, 0
from public.products where slug = 'sunflower-baseball-cap'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SBC-02', 'Өнгө', 'Plaid', 162000, 8, 1
from public.products where slug = 'sunflower-baseball-cap'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SBC-03', 'Өнгө', 'Cream', 162000, 10, 2
from public.products where slug = 'sunflower-baseball-cap'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SBC-04', 'Өнгө', 'Sesame', 162000, 6, 3
from public.products where slug = 'sunflower-baseball-cap'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Spiral Magnetic Phone Case — 110,000 MNT (~$31.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'spiral-magnetic-phone-case', c.id, 'active', true, 8, now(), '{}'::text[]
from public.categories c where c.slug = 'tech'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Spiral Magnetic Phone Case', 'Соронзон утасны гэр', 'MagSafe соронзонтой утасны гэр. Мушгиа хээтэй, унахаас хамгаалах өндөр ирмэгтэй.', 'Гэрийг цэвэрлэхдээ хуурай даавуу ашиглана.'
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMPC-01', 'Өнгө', 'Seasalt', 110000, 7, 0
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMPC-02', 'Өнгө', 'Butter', 110000, 7, 1
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMPC-03', 'Өнгө', 'Berry', 110000, 5, 2
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMPC-04', 'Өнгө', 'Galaxy', 110000, 4, 3
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMPC-05', 'Өнгө', 'Cream', 110000, 6, 4
from public.products where slug = 'spiral-magnetic-phone-case'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;

-- Cherry Pearl Necklace — 279,000 MNT (~$80.99)
insert into public.products (slug, category_id, status, is_featured, position, published_at, tags)
select 'cherry-pearl-necklace', c.id, 'active', true, 9, now(), '{}'::text[]
from public.categories c where c.slug = 'jewelry'
on conflict (slug) do update
  set category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Cherry Pearl Necklace', 'Сувдан зүүлт', 'Хиймэл сувд, цутгамал чимэглэл бүхий зүүлт. Урт 42см, сунгах гинжтэй.', 'Үнэртэй ус, усанд норгохоос сэргийлнэ.'
from public.products where slug = 'cherry-pearl-necklace'
on conflict (product_id, locale) do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;

insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CPN-01', 'Өнгө', 'Cream', 279000, 5, 0
from public.products where slug = 'cherry-pearl-necklace'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CPN-02', 'Өнгө', 'Gray Pearl', 279000, 4, 1
from public.products where slug = 'cherry-pearl-necklace'
on conflict (sku) do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_value = excluded.option_value, position = excluded.position;


-- Keep the derived columns (min/max price, in_stock) in step with the rows we
-- just wrote. The trigger fires per variant, but a re-run that only updates
-- prices should still leave products correct.
select public.refresh_product_derived(id) from public.products;
