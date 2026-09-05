-- ============================================================================
-- hotaru — 16. Category tiles, hero banner, per-variant imagery
-- ============================================================================
-- Three things the catalog had structure for but no data behind:
--
--   * categories.image_path was never populated, so the home rail fell back to
--     tinted circles carrying the category initial.
--   * There was no hero image at all; the home page ran a flat colour panel.
--     It lives in store_settings so the owner can swap it from /admin without
--     a deploy, same rule as the bank details.
--   * variants.image_id existed from the start and was never used, so hovering
--     a colour swatch changed the badge but not the picture.
-- ============================================================================

alter table public.store_settings
  add column if not exists hero_image_path text,
  add column if not exists hero_headline   text,
  add column if not exists hero_subline    text,
  add column if not exists hero_cta_label  text,
  add column if not exists hero_cta_href   text;

comment on column public.store_settings.hero_image_path is
  'ImageKit file path for the home hero. Empty falls back to the colour panel.';


update public.store_settings set
  hero_image_path = '/hotaru/hero/hero-1_t9pJhKyPT.jpg',
  hero_headline   = coalesce(hero_headline, 'Өдөр бүрийг гэрэлтүүлэх зүйлс'),
  hero_subline    = coalesce(hero_subline, '2026 намрын цуглуулга'),
  hero_cta_label  = coalesce(hero_cta_label, 'Дэлгүүр үзэх'),
  hero_cta_href   = coalesce(hero_cta_href, '/shop')
where id;


-- Category tiles --------------------------------------------------------------
update public.categories set image_path = '/hotaru/category/accessories_spenjU1RzK.jpg' where slug = 'accessories';
update public.categories set image_path = '/hotaru/category/bags_weqPEMPtn.jpg' where slug = 'bags';
update public.categories set image_path = '/hotaru/category/cap_GO_t7dK37.jpg' where slug = 'cap';
update public.categories set image_path = '/hotaru/category/clothing_Kc5B5HL3t.jpg' where slug = 'clothing';
update public.categories set image_path = '/hotaru/category/cups_gUMIwC0cO.jpg' where slug = 'cups';
update public.categories set image_path = '/hotaru/category/electronics_H3_r2SfnN.jpg' where slug = 'electronics';
update public.categories set image_path = '/hotaru/category/hair-accessories_sSAcIdo21.jpg' where slug = 'hair-accessories';
update public.categories set image_path = '/hotaru/category/pet_4dyq-9CFw.jpg' where slug = 'pet';


-- Per-variant imagery ---------------------------------------------------------
-- Pair the nth variant with the nth product image so hovering a swatch shows
-- that colourway. Products with fewer images than variants reuse the last one,
-- which is better than showing an unrelated photo.
with paired as (
  select
    v.id as variant_id,
    coalesce(
      (select pi.id from public.product_images pi
        where pi.product_id = v.product_id and pi.position = v.position),
      (select pi.id from public.product_images pi
        where pi.product_id = v.product_id order by pi.position desc limit 1)
    ) as image_id
  from public.variants v
)
update public.variants v
   set image_id = p.image_id
  from paired p
 where v.id = p.variant_id and p.image_id is not null;
