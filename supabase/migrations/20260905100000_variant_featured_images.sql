-- Pair each variant with the photo tagi actually assigned to it.
--
-- Migration 20260905060000 paired variants to images by position, which only
-- holds while both lists happen to line up. The seed uploaded each product's
-- first 3 gallery images but kept up to 5 variants, so every variant at
-- position >= 3 hit the "last image" fallback and shared one photo with its
-- siblings. On those 6 products the hover-to-next-variant swap rendered an
-- identical picture and read as "hover does nothing".
--
-- The authoritative mapping lives in Shopify's payload as
-- variants[].featured_image.id -> images[].id. This migration inserts the 12
-- variant photos that were never uploaded, then assigns image_id explicitly
-- per (slug, option_value) instead of inferring it from position.

insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
  select p.id, '6a9bf2b0ead997d09a888f49', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-vcherry-jam_ztn38c5dd.jpg', 'metal-floral-hair-clip Cherry Jam', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'metal-floral-hair-clip'
union all
  select p.id, '6a9bf2b3ead997d09a88a2fd', '/hotaru/star-hairclip/star-hairclip-vtortoise-brown_HczI0C8RY.jpg', 'star-hairclip Tortoise Brown', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'star-hairclip'
union all
  select p.id, '6a9bf2b5ead997d09a88b65e', '/hotaru/star-hairclip/star-hairclip-vforest-seasalt_O0BUNQRNi.jpg', 'star-hairclip Forest Seasalt', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'star-hairclip'
union all
  select p.id, '6a9bf2b8ead997d09a88bef3', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vblueberry-rainboots-pendant_PnUgYyICJ.jpg', 'small-woven-pilow-laptop-bag Blueberry Rainboots Pendant', 1000, 1000,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'small-woven-pilow-laptop-bag'
union all
  select p.id, '6a9bf2baead997d09a88cd08', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vbutter-rainboots-pendant_k_5YG3Euu.jpg', 'small-woven-pilow-laptop-bag Butter Rainboots Pendant', 1000, 1000,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'small-woven-pilow-laptop-bag'
union all
  select p.id, '6a9bf2bdead997d09a88dc13', '/hotaru/soft-home-slippers/soft-home-slippers-vtaro-apple-m_taT5OMvef.jpg', 'soft-home-slippers Taro Apple M', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'soft-home-slippers'
union all
  select p.id, '6a9bf2c0ead997d09a88ec96', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-s_etseo7otx.jpg', 'soft-home-slippers Denim Apple S', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'soft-home-slippers'
union all
  select p.id, '6a9bf2c3ead997d09a88fd93', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-m_BoNgeunWd.jpg', 'soft-home-slippers Denim Apple M', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'soft-home-slippers'
union all
  select p.id, '6a9bf2c5ead997d09a890c19', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-vfruit-tonton_nXwIKL_65.jpg', 'flower-vacuum-bottle Fruit TonTon', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'flower-vacuum-bottle'
union all
  select p.id, '6a9bf2c8ead997d09a891505', '/hotaru/pet-toys/pet-toys-vberry-giraffe_34Ny2S_5o.jpg', 'pet-toys Berry Giraffe', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'pet-toys'
union all
  select p.id, '6a9bf2cbead997d09a8923e2', '/hotaru/pet-toys/pet-toys-vmatcha-cookies_z-aLbWBOX.jpg', 'pet-toys Matcha Cookies', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'pet-toys'
union all
  select p.id, '6a9bf2ceead997d09a893806', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-vberry-hazelnut_aal46LVBz.jpg', 'pet-raglan-stripe-t-shirt Berry Hazelnut', 1080, 1080,
         coalesce((select max(pi.position) + 1 from public.product_images pi where pi.product_id = p.id), 0)
    from public.products p where p.slug = 'pet-raglan-stripe-t-shirt'
on conflict do nothing;

-- Explicit variant -> image assignment, straight from tagi's own pairing.
with mapping (slug, option_value, file_path) as (values
  ('metal-floral-hair-clip', 'Berry Stripes', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-0_669ADuiI_.jpg'),
  ('metal-floral-hair-clip', 'Cream Cookies', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-1_1DhYrLSzq.jpg'),
  ('metal-floral-hair-clip', 'Tortoiseshell Cocoa', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-2_AHaFHI--Q.jpg'),
  ('metal-floral-hair-clip', 'Cherry Jam', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-vcherry-jam_ztn38c5dd.jpg'),
  ('star-hairclip', 'Cream White', '/hotaru/star-hairclip/star-hairclip-0_PJS6YRe1i.jpg'),
  ('star-hairclip', 'Cream Pink', '/hotaru/star-hairclip/star-hairclip-1_Kxjf023GpE.jpg'),
  ('star-hairclip', 'Cold Tomato', '/hotaru/star-hairclip/star-hairclip-2_znppYxYUM.jpg'),
  ('star-hairclip', 'Tortoise Brown', '/hotaru/star-hairclip/star-hairclip-vtortoise-brown_HczI0C8RY.jpg'),
  ('star-hairclip', 'Forest Seasalt', '/hotaru/star-hairclip/star-hairclip-vforest-seasalt_O0BUNQRNi.jpg'),
  ('lucky-coin-phone-chain', 'Berry', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-0_-yH-ObUsi.jpg'),
  ('lucky-coin-phone-chain', 'Butter', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-1_gMOMpUMho.jpg'),
  ('lucky-coin-phone-chain', 'Seasalt', '/hotaru/lucky-coin-phone-chain/lucky-coin-phone-chain-2_lIiFUZHgt.jpg'),
  ('small-woven-pilow-laptop-bag', 'Blueberry Cookies', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-0_F-nYiYfQR0.jpg'),
  ('small-woven-pilow-laptop-bag', 'Citrus Cookies', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-1_RCZCLsHFy.jpg'),
  ('small-woven-pilow-laptop-bag', 'Blueberry Rainboots Pendant', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vblueberry-rainboots-pendant_PnUgYyICJ.jpg'),
  ('small-woven-pilow-laptop-bag', 'Butter Rainboots Pendant', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vbutter-rainboots-pendant_k_5YG3Euu.jpg'),
  ('ok-laptop-bag', 'Grid', '/hotaru/ok-laptop-bag/ok-laptop-bag-0_4hqna-E7A.jpg'),
  ('vintage-patchwork-baseball-cap', 'Cocoa Hazelnut', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-0_kL5zvdJay.jpg'),
  ('vintage-patchwork-baseball-cap', 'Forest Brownie', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-1_wldxcwJ6gw.jpg'),
  ('vintage-patchwork-baseball-cap', 'Berry Plaid', '/hotaru/vintage-patchwork-baseball-cap/vintage-patchwork-baseball-cap-2_DPIZwsm97.jpg'),
  ('tritan-sports-portable-bottle', 'Strawberry Garden', '/hotaru/tritan-sports-portable-bottle/tritan-sports-portable-bottle-0_skYbuD_vh.jpg'),
  ('tritan-sports-portable-bottle', 'Blueberry Garden', '/hotaru/tritan-sports-portable-bottle/tritan-sports-portable-bottle-1_iohU6PWo9.jpg'),
  ('love-patchwork-baseball-cap', 'Citrus Biscuit', '/hotaru/love-patchwork-baseball-cap/love-patchwork-baseball-cap-0_qRFtOXZT3h.jpg'),
  ('love-patchwork-baseball-cap', 'Imagine Leopard', '/hotaru/love-patchwork-baseball-cap/love-patchwork-baseball-cap-1_gd0us_HIo.jpg'),
  ('dress-up-game-knit-gloves', 'Berry Cherry', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-0_aJZugo5kJ.jpg'),
  ('dress-up-game-knit-gloves', 'Blueberry Matcha', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-1_u1S5JKK3N.jpg'),
  ('dress-up-game-knit-gloves', 'Cherry Hazelnut', '/hotaru/dress-up-game-knit-gloves/dress-up-game-knit-gloves-2_7-zMJqQb4.jpg'),
  ('soft-home-slippers', 'Taro Apple S', '/hotaru/soft-home-slippers/soft-home-slippers-2_4yDRKdIJx.jpg'),
  ('soft-home-slippers', 'Taro Apple M', '/hotaru/soft-home-slippers/soft-home-slippers-vtaro-apple-m_taT5OMvef.jpg'),
  ('soft-home-slippers', 'Denim Apple S', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-s_etseo7otx.jpg'),
  ('soft-home-slippers', 'Denim Apple M', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-m_BoNgeunWd.jpg'),
  ('wonderful-backyard-colorful-woven-cap', 'Strawberry Stripes', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-0_YDJKyijhCX.jpg'),
  ('wonderful-backyard-colorful-woven-cap', 'Strawberry Waffles', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-1_AWfzDJASN.jpg'),
  ('wonderful-backyard-colorful-woven-cap', 'Apple Blueberry Waffles', '/hotaru/wonderful-backyard-colorful-woven-cap/wonderful-backyard-colorful-woven-cap-2_hnSmIDuZL.jpg'),
  ('flower-vacuum-bottle', 'Plaid Flower', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-0_VFDpT_BLZm.jpg'),
  ('flower-vacuum-bottle', 'Crayon Flower', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-1_jU1ur7z8l.jpg'),
  ('flower-vacuum-bottle', 'Puppy TonTon', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-2_vE3ox1_1B.jpg'),
  ('flower-vacuum-bottle', 'Fruit TonTon', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-vfruit-tonton_nXwIKL_65.jpg'),
  ('portable-vacuum-bottle', 'Cream Stripe', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-0_jWh6yt5pu.jpg'),
  ('portable-vacuum-bottle', 'Sea Salt Stripe', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-1_DObNpLblWl.jpg'),
  ('portable-vacuum-bottle', 'Hazelnut Stripe', '/hotaru/portable-vacuum-bottle/portable-vacuum-bottle-2_r7I5BN2skG.jpg'),
  ('apple-sippy-cup', 'Green Apple', '/hotaru/apple-sippy-cup/apple-sippy-cup-0_Pz1qwK5C_.jpg'),
  ('apple-sippy-cup', 'Apple Dots', '/hotaru/apple-sippy-cup/apple-sippy-cup-1_I9RdD6j-Ql.jpg'),
  ('little-tail-phone-case', 'Butter', '/hotaru/little-tail-phone-case/little-tail-phone-case-0_IQPxcf0dW.jpg'),
  ('make-you-happy-phone-case-with-metal-heart-bracket', 'Happy Galaxy', '/hotaru/make-you-happy-phone-case-with-metal-heart-bracket/make-you-happy-phone-case-with-metal-heart-bracket-0_Z--AIo_0Eo.jpg'),
  ('get-rich-magnetic-phone-case', 'Hazelnut', '/hotaru/get-rich-magnetic-phone-case/get-rich-magnetic-phone-case-0_-XR25e_lZ.jpg'),
  ('call-me-texure-gem-hair-grab', '10cm*4.5cm', '/hotaru/call-me-texure-gem-hair-grab/call-me-texure-gem-hair-grab-2_ciLKKwJLx.jpg'),
  ('hair-claw', 'Cream White', '/hotaru/hair-claw/hair-claw-0_9ckZUZTOH.jpg'),
  ('hair-claw', 'Tortoise Brown', '/hotaru/hair-claw/hair-claw-1_UDDs4Br64.jpg'),
  ('hair-claw', 'Berry', '/hotaru/hair-claw/hair-claw-2_Nf4wlN6XO.jpg'),
  ('cream-bulging-love-hairclip', 'Galaxy Cherry', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-2_0mgnGdEjx.jpg'),
  ('cream-bulging-love-hairclip', 'Sunset Dark Chocolate', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-1_0iNg5q2nwG.jpg'),
  ('cream-bulging-love-hairclip', 'Galaxy Milk', '/hotaru/cream-bulging-love-hairclip/cream-bulging-love-hairclip-0_Gi8Njnrw4Z.jpg'),
  ('pet-toys', 'Berry Cube', '/hotaru/pet-toys/pet-toys-0_l94kNXg75.jpg'),
  ('pet-toys', 'Seasalt Cube', '/hotaru/pet-toys/pet-toys-1_tLPgDWjxiv.jpg'),
  ('pet-toys', 'Seasalt Giraffe', '/hotaru/pet-toys/pet-toys-2_TcSzEagiA.jpg'),
  ('pet-toys', 'Berry Giraffe', '/hotaru/pet-toys/pet-toys-vberry-giraffe_34Ny2S_5o.jpg'),
  ('pet-toys', 'Matcha Cookies', '/hotaru/pet-toys/pet-toys-vmatcha-cookies_z-aLbWBOX.jpg'),
  ('lint-rollerr', 'Puppy', '/hotaru/lint-rollerr/lint-rollerr-0__eo-93sQB.jpg'),
  ('lint-rollerr', 'Imagine berry', '/hotaru/lint-rollerr/lint-rollerr-1_0qsEONrsS.jpg'),
  ('pet-raglan-stripe-t-shirt', 'Berry Hazelnut', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-vberry-hazelnut_aal46LVBz.jpg')
)
update public.variants v
   set image_id = pi.id
  from mapping m
  join public.products p on p.slug = m.slug
  join public.product_images pi
    on pi.product_id = p.id and pi.file_path = m.file_path
 where v.product_id = p.id
   and v.option_value = m.option_value;

-- Anything still unmapped falls back to the product's FIRST image, not its last.
update public.variants v
   set image_id = (select pi.id from public.product_images pi
                    where pi.product_id = v.product_id
                    order by pi.position limit 1)
 where v.image_id is null;
