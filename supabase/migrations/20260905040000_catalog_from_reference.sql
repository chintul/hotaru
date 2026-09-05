-- ============================================================================
-- hotaru — 14. Catalog seed from the reference store's structure and imagery
-- ============================================================================
-- 24 products across the 8 categories the reference actually merchandises,
-- with their real price bands (USD at ~3,450 MNT, rounded) and their product
-- photography — re-hosted in this project's own ImageKit account rather than
-- hot-linked, so delivery is ours and the URLs do not break.
--
-- Brand and character names are still stripped from titles and colour options:
-- a live store carrying another brand's name would confuse buyers regardless of
-- where the pixels are served from.
--
-- Replaces the previous placeholder catalog. Guarded: a product referenced by
-- an order is never deleted.
-- ============================================================================

delete from public.products p
 where not exists (select 1 from public.order_items oi where oi.product_id = p.id);

delete from public.categories c
 where not exists (select 1 from public.products p where p.category_id = c.id);


-- Categories -----------------------------------------------------------------

insert into public.categories (slug, position, is_visible) values ('bags', 1, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Цүнх', 'Өдөр тутам болон аялалд.' from public.categories where slug = 'bags'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('accessories', 2, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Гоёл чимэглэл', 'Жижиг чимэглэл, зүүлт.' from public.categories where slug = 'accessories'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('cups', 3, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Аяга сав', 'Аяга, термос, сав.' from public.categories where slug = 'cups'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('cap', 4, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Малгай', 'Улирлын малгай, кепка.' from public.categories where slug = 'cap'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('clothing', 5, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Хувцас', 'Өдөр тутмын хувцас.' from public.categories where slug = 'clothing'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('pet', 6, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Тэжээвэр амьтан', 'Амьтны хэрэглэл.' from public.categories where slug = 'pet'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('hair-accessories', 7, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Үсний хэрэгсэл', 'Үс боох, чимэглэх.' from public.categories where slug = 'hair-accessories'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;

insert into public.categories (slug, position, is_visible) values ('electronics', 8, true)
on conflict (slug) do update set position = excluded.position, is_visible = true;
insert into public.category_translations (category_id, locale, name, description)
select id, 'mn', 'Утасны хэрэгсэл', 'Утас, төхөөрөмжийн хэрэгсэл.' from public.categories where slug = 'electronics'
on conflict on constraint category_translations_category_id_locale_key
do update set name = excluded.name, description = excluded.description;


-- Products -------------------------------------------------------------------

-- Metal Floral Hair Clip · accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'metal-floral-hair-clip', c.id, 'active', true, 1, now()
from public.categories c where c.slug = 'accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Metal Floral Hair Clip', 'Гоёл чимэглэл', 'Өдөр бүр зүүхэд тохиромжтой хөнгөн чимэглэл.', 'Үнэртэй ус, усанд норгохоос сэргийлнэ.'
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MET-011', 'Color', 'Berry Stripes', 62000, 3, 0
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MET-012', 'Color', 'Cream Cookies', 62000, 5, 1
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MET-013', 'Color', 'Tortoiseshell Cocoa', 62000, 7, 2
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MET-014', 'Color', 'Cherry Jam', 62000, 9, 3
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MET-015', 'Color', 'Standard', 62000, 11, 4
from public.products where slug = 'metal-floral-hair-clip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2aead997d09af8c00c', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-0_669ADuiI_.jpg', 'Metal Floral Hair Clip', 1080, 1080, 0
from public.products where slug = 'metal-floral-hair-clip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2aead997d09af8c02a', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-1_1DhYrLSzq.jpg', 'Metal Floral Hair Clip', 1080, 1080, 1
from public.products where slug = 'metal-floral-hair-clip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2aead997d09af8c027', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-2_AHaFHI--Q.jpg', 'Metal Floral Hair Clip', 1080, 1080, 2
from public.products where slug = 'metal-floral-hair-clip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Star Hairclip · accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'star-hairclip', c.id, 'active', false, 2, now()
from public.categories c where c.slug = 'accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Star Hairclip', 'Гоёл чимэглэл', 'Өдөр бүр зүүхэд тохиромжтой хөнгөн чимэглэл.', 'Үнэртэй ус, усанд норгохоос сэргийлнэ.'
from public.products where slug = 'star-hairclip'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-STA-021', 'Color', 'Cream White', 38000, 3, 0
from public.products where slug = 'star-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-STA-022', 'Color', 'Cream Pink', 38000, 5, 1
from public.products where slug = 'star-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-STA-023', 'Color', 'Cold Tomato', 38000, 7, 2
from public.products where slug = 'star-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-STA-024', 'Color', 'Tortoise Brown', 38000, 9, 3
from public.products where slug = 'star-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-STA-025', 'Color', 'Forest Seasalt', 38000, 11, 4
from public.products where slug = 'star-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2aead997d09af8c06b', '/hotaru/star-hairclip/star-hairclip-0_PJS6YRe1i.jpg', 'Star Hairclip', 1080, 1080, 0
from public.products where slug = 'star-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2aead997d09af8c060', '/hotaru/star-hairclip/star-hairclip-1_Kxjf023GpE.jpg', 'Star Hairclip', 1080, 1080, 1
from public.products where slug = 'star-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2bead997d09af8c06e', '/hotaru/star-hairclip/star-hairclip-2_znppYxYUM.jpg', 'Star Hairclip', 1080, 1080, 2
from public.products where slug = 'star-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Lucky Coin Phone Chain · accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'lucky-coin-phone-chain', c.id, 'active', false, 3, now()
from public.categories c where c.slug = 'accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Lucky Coin Phone Chain', 'Гоёл чимэглэл', 'Өдөр бүр зүүхэд тохиромжтой хөнгөн чимэглэл.', 'Үнэртэй ус, усанд норгохоос сэргийлнэ.'
from public.products where slug = 'lucky-coin-phone-chain'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LUC-031', 'Color', 'Berry', 103000, 3, 0
from public.products where slug = 'lucky-coin-phone-chain'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LUC-032', 'Color', 'Butter', 103000, 5, 1
from public.products where slug = 'lucky-coin-phone-chain'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LUC-033', 'Color', 'Seasalt', 103000, 7, 2
from public.products where slug = 'lucky-coin-phone-chain'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d178', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-0_-yH-ObUsi.jpg', 'Lucky Coin Phone Chain', 1080, 1080, 0
from public.products where slug = 'lucky-coin-phone-chain'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d260', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-1_gMOMpUMho.jpg', 'Lucky Coin Phone Chain', 1080, 1080, 1
from public.products where slug = 'lucky-coin-phone-chain'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d497', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-2_lIiFUZHgt.jpg', 'Lucky Coin Phone Chain', 1080, 1080, 2
from public.products where slug = 'lucky-coin-phone-chain'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Small Woven-pilow Laptop Bag · bags
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'small-woven-pilow-laptop-bag', c.id, 'active', false, 4, now()
from public.categories c where c.slug = 'bags'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Small Woven-pilow Laptop Bag', 'Цүнх', 'Өдөр тутмын хэрэглээнд тохирсон багтаамжтай цүнх. Дотор нь салангид халаастай.', 'Чийгнээс сэргийлж, зөөлөн даавуугаар арчина.'
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMA-041', 'Color', 'Blueberry Cookies', 183000, 3, 0
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMA-042', 'Color', 'Citrus Cookies', 183000, 5, 1
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMA-043', 'Color', 'Blueberry Rainboots Pendant', 93000, 7, 2
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SMA-044', 'Color', 'Butter Rainboots Pendant', 93000, 9, 3
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d370', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-0_F-nYiYfQR0.jpg', 'Small Woven-pilow Laptop Bag', 1080, 1080, 0
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d41a', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-1_RCZCLsHFy.jpg', 'Small Woven-pilow Laptop Bag', 1080, 1080, 1
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2dead997d09af8d840', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-2_77BcRPKzUt.jpg', 'Small Woven-pilow Laptop Bag', 1000, 1000, 2
from public.products where slug = 'small-woven-pilow-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Denim Patchwork Laptop Bag Corduroy Floral Patchwork Laptop Bag · bags
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'denim-patchwork-laptop-bag', c.id, 'active', true, 5, now()
from public.categories c where c.slug = 'bags'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Denim Patchwork Laptop Bag Corduroy Floral Patchwork Laptop Bag', 'Цүнх', 'Өдөр тутмын хэрэглээнд тохирсон багтаамжтай цүнх. Дотор нь салангид халаастай.', 'Чийгнээс сэргийлж, зөөлөн даавуугаар арчина.'
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-DEN-051', 'Color', 'Colorful Floral', 204000, 3, 0
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-DEN-052', 'Color', 'Imagine Denim', 204000, 5, 1
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2fead997d09af8e956', '/hotaru/denim-patchwork-laptop-bag/denim-patchwork-laptop-bag-0_hEPep5lH5.jpg', 'Denim Patchwork Laptop Bag Corduroy Floral Patchwork Laptop Bag', 1080, 1080, 0
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2fead997d09af8e881', '/hotaru/denim-patchwork-laptop-bag/denim-patchwork-laptop-bag-1_2qvr4KoSO.jpg', 'Denim Patchwork Laptop Bag Corduroy Floral Patchwork Laptop Bag', 1080, 1080, 1
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda2fead997d09af8e93f', '/hotaru/denim-patchwork-laptop-bag/denim-patchwork-laptop-bag-2_ZNslQ_yI2.jpg', 'Denim Patchwork Laptop Bag Corduroy Floral Patchwork Laptop Bag', 320, 320, 2
from public.products where slug = 'denim-patchwork-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- OK Laptop Bag · bags
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'ok-laptop-bag', c.id, 'active', false, 6, now()
from public.categories c where c.slug = 'bags'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'OK Laptop Bag', 'Цүнх', 'Өдөр тутмын хэрэглээнд тохирсон багтаамжтай цүнх. Дотор нь салангид халаастай.', 'Чийгнээс сэргийлж, зөөлөн даавуугаар арчина.'
from public.products where slug = 'ok-laptop-bag'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-OKL-061', 'Color', 'Grid', 183000, 3, 0
from public.products where slug = 'ok-laptop-bag'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda30ead997d09af8eaf6', '/hotaru/ok-laptop-bag/ok-laptop-bag-0_4hqna-E7A.jpg', 'OK Laptop Bag', 1080, 1080, 0
from public.products where slug = 'ok-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda30ead997d09af8eed9', '/hotaru/ok-laptop-bag/ok-laptop-bag-1_D6sIQWYQa.jpg', 'OK Laptop Bag', 1200, 1640, 1
from public.products where slug = 'ok-laptop-bag'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Vintage Patchwork Baseball Cap · cap
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'vintage-patchwork-baseball-cap', c.id, 'active', false, 7, now()
from public.categories c where c.slug = 'cap'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Vintage Patchwork Baseball Cap', 'Малгай', 'Толгойн хэмжээ тохируулгатай, өдөр тутам өмсөхөд тохиромжтой.', '30°C-аас доош температурт гараар угаана.'
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-VIN-071', 'Color', 'Cocoa Hazelnut', 138000, 3, 0
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-VIN-072', 'Color', 'Forest Brownie', 138000, 5, 1
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-VIN-073', 'Color', 'Berry Plaid', 138000, 7, 2
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda30ead997d09af8ec37', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-0_kL5zvdJay.jpg', 'Vintage Patchwork Baseball Cap', 1080, 1080, 0
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda32ead997d09af8fc4a', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-1_wldxcwJ6gw.jpg', 'Vintage Patchwork Baseball Cap', 1080, 1080, 1
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda32ead997d09af8faea', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-2_DPIZwsm97.jpg', 'Vintage Patchwork Baseball Cap', 1080, 1080, 2
from public.products where slug = 'vintage-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Tritan Sports Portable Bottle · cap
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'tritan-sports-portable-bottle', c.id, 'active', false, 8, now()
from public.categories c where c.slug = 'cap'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Tritan Sports Portable Bottle', 'Малгай', 'Толгойн хэмжээ тохируулгатай, өдөр тутам өмсөхөд тохиромжтой.', '30°C-аас доош температурт гараар угаана.'
from public.products where slug = 'tritan-sports-portable-bottle'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-TRI-081', 'Color', 'Strawberry Garden', 138000, 3, 0
from public.products where slug = 'tritan-sports-portable-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-TRI-082', 'Color', 'Blueberry Garden', 138000, 5, 1
from public.products where slug = 'tritan-sports-portable-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda32ead997d09af8faab', '/hotaru/tritan-sports-portable-bottle/tritan-sports-portable-bottle-0_skYbuD_vh.jpg', 'Tritan Sports Portable Bottle', 1080, 1080, 0
from public.products where slug = 'tritan-sports-portable-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda32ead997d09af8fc70', '/hotaru/tritan-sports-portable-bottle/tritan-sports-portable-bottle-1_iohU6PWo9.jpg', 'Tritan Sports Portable Bottle', 1080, 1080, 1
from public.products where slug = 'tritan-sports-portable-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Love Patchwork Baseball Cap · cap
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'love-patchwork-baseball-cap', c.id, 'active', true, 9, now()
from public.categories c where c.slug = 'cap'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Love Patchwork Baseball Cap', 'Малгай', 'Толгойн хэмжээ тохируулгатай, өдөр тутам өмсөхөд тохиромжтой.', '30°C-аас доош температурт гараар угаана.'
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LOV-091', 'Color', 'Citrus Biscuit', 131000, 3, 0
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LOV-092', 'Color', 'Imagine Leopard', 131000, 5, 1
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda32ead997d09af8fea4', '/hotaru/love-patchwork-baseball-cap/love-patchwork-baseball-cap-0_qRFtOXZT3h.jpg', 'Love Patchwork Baseball Cap', 1080, 1080, 0
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda33ead997d09af90080', '/hotaru/love-patchwork-baseball-cap/love-patchwork-baseball-cap-1_gd0us_HIo.jpg', 'Love Patchwork Baseball Cap', 1080, 1080, 1
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda34ead997d09af90b77', '/hotaru/love-patchwork-baseball-cap/love-patchwork-baseball-cap-2_E3NoAit6M.jpg', 'Love Patchwork Baseball Cap', 800, 800, 2
from public.products where slug = 'love-patchwork-baseball-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Dress-up Game Knit Gloves · clothing
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'dress-up-game-knit-gloves', c.id, 'active', false, 10, now()
from public.categories c where c.slug = 'clothing'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Dress-up Game Knit Gloves', 'Хувцас', 'Зөөлөн даавуу, өдөр тутмын хэрэглээнд ээлтэй хэлбэр.', 'Ижил өнгөтэй нь тусад нь угаана.'
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-DRE-101', 'Color', 'Berry Cherry', 145000, 3, 0
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-DRE-102', 'Color', 'Blueberry Matcha', 145000, 5, 1
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-DRE-103', 'Color', 'Cherry Hazelnut', 145000, 7, 2
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda34ead997d09af90dd5', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-0_aJZugo5kJ.jpg', 'Dress-up Game Knit Gloves', 1080, 1080, 0
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda35ead997d09af90e89', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-1_u1S5JKK3N.jpg', 'Dress-up Game Knit Gloves', 1080, 1080, 1
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda35ead997d09af90ea2', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-2_7-zMJqQb4.jpg', 'Dress-up Game Knit Gloves', 1080, 1080, 2
from public.products where slug = 'dress-up-game-knit-gloves'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Soft Home Slippers · clothing
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'soft-home-slippers', c.id, 'active', false, 11, now()
from public.categories c where c.slug = 'clothing'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Soft Home Slippers', 'Хувцас', 'Зөөлөн даавуу, өдөр тутмын хэрэглээнд ээлтэй хэлбэр.', 'Ижил өнгөтэй нь тусад нь угаана.'
from public.products where slug = 'soft-home-slippers'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SOF-111', 'Color', 'Taro Apple S', 131000, 3, 0
from public.products where slug = 'soft-home-slippers'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SOF-112', 'Color', 'Taro Apple M', 131000, 5, 1
from public.products where slug = 'soft-home-slippers'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SOF-113', 'Color', 'Denim Apple S', 131000, 7, 2
from public.products where slug = 'soft-home-slippers'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SOF-114', 'Color', 'Denim Apple M', 131000, 9, 3
from public.products where slug = 'soft-home-slippers'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-SOF-115', 'Color', 'Citrus S', 131000, 11, 4
from public.products where slug = 'soft-home-slippers'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda35ead997d09af910be', '/hotaru/soft-home-slippers/soft-home-slippers-0_-pPdQVVOS.jpg', 'Soft Home Slippers', 1080, 1080, 0
from public.products where slug = 'soft-home-slippers'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda35ead997d09af91298', '/hotaru/soft-home-slippers/soft-home-slippers-1_q9zd33qh4.jpg', 'Soft Home Slippers', 1080, 1080, 1
from public.products where slug = 'soft-home-slippers'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda37ead997d09af91e26', '/hotaru/soft-home-slippers/soft-home-slippers-2_4yDRKdIJx.jpg', 'Soft Home Slippers', 1080, 1080, 2
from public.products where slug = 'soft-home-slippers'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Wonderful Backyard Colorful Woven Cap · clothing
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'wonderful-backyard-colorful-woven-cap', c.id, 'active', false, 12, now()
from public.categories c where c.slug = 'clothing'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Wonderful Backyard Colorful Woven Cap', 'Хувцас', 'Зөөлөн даавуу, өдөр тутмын хэрэглээнд ээлтэй хэлбэр.', 'Ижил өнгөтэй нь тусад нь угаана.'
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WON-121', 'Color', 'Strawberry Stripes', 138000, 3, 0
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WON-122', 'Color', 'Strawberry Waffles', 138000, 5, 1
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-WON-123', 'Color', 'Apple Blueberry Waffles', 138000, 7, 2
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda37ead997d09af920c6', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-0_YDJKyijhCX.jpg', 'Wonderful Backyard Colorful Woven Cap', 1080, 1080, 0
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda38ead997d09af92486', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-1_AWfzDJASN.jpg', 'Wonderful Backyard Colorful Woven Cap', 1080, 1080, 1
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda37ead997d09af92194', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-2_hnSmIDuZL.jpg', 'Wonderful Backyard Colorful Woven Cap', 1080, 1080, 2
from public.products where slug = 'wonderful-backyard-colorful-woven-cap'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Flower Vacuum Bottle · cups
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'flower-vacuum-bottle', c.id, 'active', true, 13, now()
from public.categories c where c.slug = 'cups'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Flower Vacuum Bottle', 'Аяга сав', 'Гэр, оффис, аялалд тохиромжтой аяга сав.', 'Гараар угаахыг зөвлөнө.'
from public.products where slug = 'flower-vacuum-bottle'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-FLO-131', 'Color', 'Plaid Flower', 162000, 3, 0
from public.products where slug = 'flower-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-FLO-132', 'Color', 'Crayon Flower', 162000, 5, 1
from public.products where slug = 'flower-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-FLO-133', 'Color', 'Puppy TonTon', 162000, 7, 2
from public.products where slug = 'flower-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-FLO-134', 'Color', 'Fruit TonTon', 162000, 9, 3
from public.products where slug = 'flower-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda37ead997d09af922d6', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-0_VFDpT_BLZm.jpg', 'Flower Vacuum Bottle', 1080, 1080, 0
from public.products where slug = 'flower-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda37ead997d09af923f4', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-1_jU1ur7z8l.jpg', 'Flower Vacuum Bottle', 1080, 1080, 1
from public.products where slug = 'flower-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda39ead997d09af931c6', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-2_vE3ox1_1B.jpg', 'Flower Vacuum Bottle', 1080, 1080, 2
from public.products where slug = 'flower-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Portable Vacuum Bottle · cups
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'portable-vacuum-bottle', c.id, 'active', false, 14, now()
from public.categories c where c.slug = 'cups'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Portable Vacuum Bottle', 'Аяга сав', 'Гэр, оффис, аялалд тохиромжтой аяга сав.', 'Гараар угаахыг зөвлөнө.'
from public.products where slug = 'portable-vacuum-bottle'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-POR-141', 'Color', 'Cream Stripe', 155000, 3, 0
from public.products where slug = 'portable-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-POR-142', 'Color', 'Sea Salt Stripe', 155000, 5, 1
from public.products where slug = 'portable-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-POR-143', 'Color', 'Hazelnut Stripe', 155000, 7, 2
from public.products where slug = 'portable-vacuum-bottle'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda39ead997d09af93545', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-0_jWh6yt5pu.jpg', 'Portable Vacuum Bottle', 1080, 1080, 0
from public.products where slug = 'portable-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3aead997d09af93635', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-1_DObNpLblWl.jpg', 'Portable Vacuum Bottle', 1080, 1080, 1
from public.products where slug = 'portable-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3aead997d09af9375d', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-2_r7I5BN2skG.jpg', 'Portable Vacuum Bottle', 1080, 1080, 2
from public.products where slug = 'portable-vacuum-bottle'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Apple Sippy Cup · cups
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'apple-sippy-cup', c.id, 'active', false, 15, now()
from public.categories c where c.slug = 'cups'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Apple Sippy Cup', 'Аяга сав', 'Гэр, оффис, аялалд тохиромжтой аяга сав.', 'Гараар угаахыг зөвлөнө.'
from public.products where slug = 'apple-sippy-cup'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-APP-151', 'Color', 'Green Apple', 110000, 3, 0
from public.products where slug = 'apple-sippy-cup'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-APP-152', 'Color', 'Apple Dots', 110000, 5, 1
from public.products where slug = 'apple-sippy-cup'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3aead997d09af93919', '/hotaru/apple-sippy-cup/apple-sippy-cup-0_Pz1qwK5C_.jpg', 'Apple Sippy Cup', 1080, 1080, 0
from public.products where slug = 'apple-sippy-cup'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3aead997d09af93910', '/hotaru/apple-sippy-cup/apple-sippy-cup-1_I9RdD6j-Ql.jpg', 'Apple Sippy Cup', 1080, 1080, 1
from public.products where slug = 'apple-sippy-cup'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af94797', '/hotaru/apple-sippy-cup/apple-sippy-cup-2_KrbwEJaKJ.jpg', 'Apple Sippy Cup', 1200, 1200, 2
from public.products where slug = 'apple-sippy-cup'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Little Tail Phone Case · electronics
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'little-tail-phone-case', c.id, 'active', false, 16, now()
from public.categories c where c.slug = 'electronics'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Little Tail Phone Case', 'Утасны хэрэгсэл', 'Утас, төхөөрөмжөө хамгаалах, гоёх хэрэгсэл.', 'Хуурай даавуугаар цэвэрлэнэ.'
from public.products where slug = 'little-tail-phone-case'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LIT-161', 'Color', 'Butter', 90000, 3, 0
from public.products where slug = 'little-tail-phone-case'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af948f0', '/hotaru/little-tail-phone-case/little-tail-phone-case-0_IQPxcf0dW.jpg', 'Little Tail Phone Case', 1080, 1080, 0
from public.products where slug = 'little-tail-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af94b25', '/hotaru/little-tail-phone-case/little-tail-phone-case-1_0G9Ix_MEB.jpg', 'Little Tail Phone Case', 1080, 1080, 1
from public.products where slug = 'little-tail-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af94b7c', '/hotaru/little-tail-phone-case/little-tail-phone-case-2_YGQTYo6rem.jpg', 'Little Tail Phone Case', 1080, 1080, 2
from public.products where slug = 'little-tail-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Make You Happy Phone Case with Metal Heart Bracket · electronics
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'make-you-happy-phone-case-with-metal-heart-bracket', c.id, 'active', true, 17, now()
from public.categories c where c.slug = 'electronics'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Make You Happy Phone Case with Metal Heart Bracket', 'Утасны хэрэгсэл', 'Утас, төхөөрөмжөө хамгаалах, гоёх хэрэгсэл.', 'Хуурай даавуугаар цэвэрлэнэ.'
from public.products where slug = 'make-you-happy-phone-case-with-metal-heart-bracket'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-MAK-171', 'Color', 'Happy Galaxy', 135000, 3, 0
from public.products where slug = 'make-you-happy-phone-case-with-metal-heart-bracket'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af94e03', '/hotaru/make-you-happy-phone-case-with-metal-heart-bracket/make-you-happy-phone-case-with-metal-heart-bracket-0_Z--AIo_0Eo.jpg', 'Make You Happy Phone Case with Metal Heart Bracket', 1000, 1000, 0
from public.products where slug = 'make-you-happy-phone-case-with-metal-heart-bracket'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3cead997d09af94cd4', '/hotaru/make-you-happy-phone-case-with-metal-heart-bracket/make-you-happy-phone-case-with-metal-heart-bracket-1_RiWfTge3f.jpg', 'Make You Happy Phone Case with Metal Heart Bracket', 1080, 1080, 1
from public.products where slug = 'make-you-happy-phone-case-with-metal-heart-bracket'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3eead997d09af9611e', '/hotaru/make-you-happy-phone-case-with-metal-heart-bracket/make-you-happy-phone-case-with-metal-heart-bracket-2_hIrAuyJlf.jpg', 'Make You Happy Phone Case with Metal Heart Bracket', 1080, 1080, 2
from public.products where slug = 'make-you-happy-phone-case-with-metal-heart-bracket'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Get Rich Magnetic Phone Case · electronics
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'get-rich-magnetic-phone-case', c.id, 'active', false, 18, now()
from public.categories c where c.slug = 'electronics'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Get Rich Magnetic Phone Case', 'Утасны хэрэгсэл', 'Утас, төхөөрөмжөө хамгаалах, гоёх хэрэгсэл.', 'Хуурай даавуугаар цэвэрлэнэ.'
from public.products where slug = 'get-rich-magnetic-phone-case'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-GET-181', 'Color', 'Hazelnut', 69000, 3, 0
from public.products where slug = 'get-rich-magnetic-phone-case'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3eead997d09af96183', '/hotaru/get-rich-magnetic-phone-case/get-rich-magnetic-phone-case-0_-XR25e_lZ.jpg', 'Get Rich Magnetic Phone Case', 1080, 1080, 0
from public.products where slug = 'get-rich-magnetic-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3eead997d09af96282', '/hotaru/get-rich-magnetic-phone-case/get-rich-magnetic-phone-case-1_GHHlcp2MH.jpg', 'Get Rich Magnetic Phone Case', 1080, 1080, 1
from public.products where slug = 'get-rich-magnetic-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3eead997d09af96279', '/hotaru/get-rich-magnetic-phone-case/get-rich-magnetic-phone-case-2_Iy4CqB93R.jpg', 'Get Rich Magnetic Phone Case', 1080, 1080, 2
from public.products where slug = 'get-rich-magnetic-phone-case'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Call Me Texure Gem Hair Grab · hair-accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'call-me-texure-gem-hair-grab', c.id, 'active', false, 19, now()
from public.categories c where c.slug = 'hair-accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Call Me Texure Gem Hair Grab', 'Үсний хэрэгсэл', 'Үс гэмтээхгүй зөөлөн бэхэлгээ.', 'Хүчтэй татахаас зайлсхийнэ.'
from public.products where slug = 'call-me-texure-gem-hair-grab'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CAL-191', 'Style/Size', '10cm*4.5cm', 90000, 3, 0
from public.products where slug = 'call-me-texure-gem-hair-grab'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3fead997d09af964e7', '/hotaru/call-me-texure-gem-hair-grab/call-me-texure-gem-hair-grab-0_MTaFRZQHV.jpg', 'Call Me Texure Gem Hair Grab', 1080, 1080, 0
from public.products where slug = 'call-me-texure-gem-hair-grab'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda3fead997d09af96624', '/hotaru/call-me-texure-gem-hair-grab/call-me-texure-gem-hair-grab-1_BD-2WFuci.jpg', 'Call Me Texure Gem Hair Grab', 1080, 1080, 1
from public.products where slug = 'call-me-texure-gem-hair-grab'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af97370', '/hotaru/call-me-texure-gem-hair-grab/call-me-texure-gem-hair-grab-2_ciLKKwJLx.jpg', 'Call Me Texure Gem Hair Grab', 1080, 1080, 2
from public.products where slug = 'call-me-texure-gem-hair-grab'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Hair Claw · hair-accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'hair-claw', c.id, 'active', false, 20, now()
from public.categories c where c.slug = 'hair-accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Hair Claw', 'Үсний хэрэгсэл', 'Үс гэмтээхгүй зөөлөн бэхэлгээ.', 'Хүчтэй татахаас зайлсхийнэ.'
from public.products where slug = 'hair-claw'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-HAI-201', 'Color', 'Cream White', 90000, 3, 0
from public.products where slug = 'hair-claw'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-HAI-202', 'Color', 'Tortoise Brown', 90000, 5, 1
from public.products where slug = 'hair-claw'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-HAI-203', 'Color', 'Berry', 90000, 7, 2
from public.products where slug = 'hair-claw'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af97400', '/hotaru/hair-claw/hair-claw-0_9ckZUZTOH.jpg', 'Hair Claw', 1080, 1080, 0
from public.products where slug = 'hair-claw'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af9750b', '/hotaru/hair-claw/hair-claw-1_UDDs4Br64.jpg', 'Hair Claw', 1080, 1080, 1
from public.products where slug = 'hair-claw'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af97448', '/hotaru/hair-claw/hair-claw-2_Nf4wlN6XO.jpg', 'Hair Claw', 1080, 1080, 2
from public.products where slug = 'hair-claw'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Cream Bulging Love Hairclip · hair-accessories
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'cream-bulging-love-hairclip', c.id, 'active', true, 21, now()
from public.categories c where c.slug = 'hair-accessories'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Cream Bulging Love Hairclip', 'Үсний хэрэгсэл', 'Үс гэмтээхгүй зөөлөн бэхэлгээ.', 'Хүчтэй татахаас зайлсхийнэ.'
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CRE-211', 'Color', 'Galaxy Cherry', 90000, 3, 0
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CRE-212', 'Color', 'Sunset Dark Chocolate', 90000, 5, 1
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-CRE-213', 'Color', 'Galaxy Milk', 90000, 7, 2
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af9775a', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-0_Gi8Njnrw4Z.jpg', 'Cream Bulging Love Hairclip', 1080, 1080, 0
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda41ead997d09af9784f', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-1_0iNg5q2nwG.jpg', 'Cream Bulging Love Hairclip', 1080, 1080, 1
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda43ead997d09af98a43', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-2_0mgnGdEjx.jpg', 'Cream Bulging Love Hairclip', 1080, 1080, 2
from public.products where slug = 'cream-bulging-love-hairclip'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Pet Toys · pet
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'pet-toys', c.id, 'active', false, 22, now()
from public.categories c where c.slug = 'pet'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Pet Toys', 'Амьтны хэрэглэл', 'Тэжээвэр амьтанд ээлтэй материал, тав тухтай хэлбэр.', 'Бохирдсон тохиолдолд гараар угаана.'
from public.products where slug = 'pet-toys'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-221', 'Color', 'Berry Cube', 48000, 3, 0
from public.products where slug = 'pet-toys'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-222', 'Color', 'Seasalt Cube', 48000, 5, 1
from public.products where slug = 'pet-toys'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-223', 'Color', 'Seasalt Giraffe', 48000, 7, 2
from public.products where slug = 'pet-toys'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-224', 'Color', 'Berry Giraffe', 48000, 9, 3
from public.products where slug = 'pet-toys'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-225', 'Color', 'Matcha Cookies', 48000, 11, 4
from public.products where slug = 'pet-toys'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda43ead997d09af98b71', '/hotaru/pet-toys/pet-toys-0_l94kNXg75.jpg', 'Pet Toys', 1080, 1080, 0
from public.products where slug = 'pet-toys'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda43ead997d09af98c7e', '/hotaru/pet-toys/pet-toys-1_tLPgDWjxiv.jpg', 'Pet Toys', 1080, 1080, 1
from public.products where slug = 'pet-toys'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda43ead997d09af98c6b', '/hotaru/pet-toys/pet-toys-2_TcSzEagiA.jpg', 'Pet Toys', 1080, 1080, 2
from public.products where slug = 'pet-toys'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- lint rollerr · pet
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'lint-rollerr', c.id, 'active', false, 23, now()
from public.categories c where c.slug = 'pet'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'lint rollerr', 'Амьтны хэрэглэл', 'Тэжээвэр амьтанд ээлтэй материал, тав тухтай хэлбэр.', 'Бохирдсон тохиолдолд гараар угаана.'
from public.products where slug = 'lint-rollerr'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LIN-231', 'Color', 'Puppy', 34000, 3, 0
from public.products where slug = 'lint-rollerr'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LIN-232', 'Color', 'Imagine berry', 34000, 5, 1
from public.products where slug = 'lint-rollerr'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-LIN-233', 'Color', 'lint Rollerr Replacement Rolls (Three Rolls)', 10000, 7, 2
from public.products where slug = 'lint-rollerr'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda44ead997d09af98e7f', '/hotaru/lint-rollerr/lint-rollerr-0__eo-93sQB.jpg', 'lint rollerr', 1080, 1080, 0
from public.products where slug = 'lint-rollerr'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda44ead997d09af98f61', '/hotaru/lint-rollerr/lint-rollerr-1_0qsEONrsS.jpg', 'lint rollerr', 1080, 1080, 1
from public.products where slug = 'lint-rollerr'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda47ead997d09af9ace1', '/hotaru/lint-rollerr/lint-rollerr-2_zJpiKcqmK.jpg', 'lint rollerr', 3481, 4641, 2
from public.products where slug = 'lint-rollerr'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;

-- Pet Raglan Stripe T-shirt · pet
insert into public.products (slug, category_id, status, is_featured, position, published_at)
select 'pet-raglan-stripe-t-shirt', c.id, 'active', false, 24, now()
from public.categories c where c.slug = 'pet'
on conflict on constraint products_slug_key do update
  set category_id = excluded.category_id, status = 'active',
      is_featured = excluded.is_featured, position = excluded.position;

insert into public.product_translations (product_id, locale, title, subtitle, description, care_details)
select id, 'mn', 'Pet Raglan Stripe T-shirt', 'Амьтны хэрэглэл', 'Тэжээвэр амьтанд ээлтэй материал, тав тухтай хэлбэр.', 'Бохирдсон тохиолдолд гараар угаана.'
from public.products where slug = 'pet-raglan-stripe-t-shirt'
on conflict on constraint product_translations_product_id_locale_key do update
  set title = excluded.title, subtitle = excluded.subtitle,
      description = excluded.description, care_details = excluded.care_details;
insert into public.variants (product_id, sku, option_label, option_value, price_mnt, quantity, position)
select id, 'HTR-PET-241', 'Color', 'Berry Hazelnut', 69000, 3, 0
from public.products where slug = 'pet-raglan-stripe-t-shirt'
on conflict on constraint variants_sku_key do update
  set price_mnt = excluded.price_mnt, quantity = excluded.quantity,
      option_label = excluded.option_label, option_value = excluded.option_value;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda46ead997d09af9a043', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-0_0BQi-H3XA.jpg', 'Pet Raglan Stripe T-shirt', 1080, 1080, 0
from public.products where slug = 'pet-raglan-stripe-t-shirt'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda46ead997d09af9a577', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-1_tGzxEYwRve.jpg', 'Pet Raglan Stripe T-shirt', 1080, 1080, 1
from public.products where slug = 'pet-raglan-stripe-t-shirt'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select id, '6a9bda46ead997d09af9a393', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-2_xTzj9-2iT.jpg', 'Pet Raglan Stripe T-shirt', 1080, 1080, 2
from public.products where slug = 'pet-raglan-stripe-t-shirt'
on conflict (product_id, position) do update
  set imagekit_file_id = excluded.imagekit_file_id, file_path = excluded.file_path;


-- Keep min/max price and in_stock in step with what we just wrote.
select public.refresh_product_derived(id) from public.products;
