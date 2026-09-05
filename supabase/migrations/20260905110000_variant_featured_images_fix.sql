-- Finish the variant->image pairing that 20260905100000 left half-applied.
--
-- product_images carries `unique (product_id, position)` (20260904120100:149).
-- The previous migration computed each new row's position as
-- `max(position) + 1` in a per-row subquery, but every row of a single INSERT
-- sees the same pre-statement snapshot -- so all new images for one product
-- computed the SAME position, collided on that unique index, and were
-- silently discarded by `on conflict do nothing`. Exactly one image per
-- product survived; the 5 others never landed, and the variants pointing at
-- them kept their stale image_id.
--
-- Here position is assigned with row_number() over the incoming rows, offset
-- by the product's current max, so each new image gets its own slot.

with incoming (slug, imagekit_file_id, file_path, alt, width, height) as (values
  ('metal-floral-hair-clip', '6a9bf2b0ead997d09a888f49', '/hotaru/metal-floral-hair-clip/metal-floral-hair-clip-vcherry-jam_ztn38c5dd.jpg', 'metal-floral-hair-clip Cherry Jam', 1080, 1080),
  ('star-hairclip', '6a9bf2b3ead997d09a88a2fd', '/hotaru/star-hairclip/star-hairclip-vtortoise-brown_HczI0C8RY.jpg', 'star-hairclip Tortoise Brown', 1080, 1080),
  ('star-hairclip', '6a9bf2b5ead997d09a88b65e', '/hotaru/star-hairclip/star-hairclip-vforest-seasalt_O0BUNQRNi.jpg', 'star-hairclip Forest Seasalt', 1080, 1080),
  ('small-woven-pilow-laptop-bag', '6a9bf2b8ead997d09a88bef3', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vblueberry-rainboots-pendant_PnUgYyICJ.jpg', 'small-woven-pilow-laptop-bag Blueberry Rainboots Pendant', 1000, 1000),
  ('small-woven-pilow-laptop-bag', '6a9bf2baead997d09a88cd08', '/hotaru/small-woven-pilow-laptop-bag/small-woven-pilow-laptop-bag-vbutter-rainboots-pendant_k_5YG3Euu.jpg', 'small-woven-pilow-laptop-bag Butter Rainboots Pendant', 1000, 1000),
  ('soft-home-slippers', '6a9bf2bdead997d09a88dc13', '/hotaru/soft-home-slippers/soft-home-slippers-vtaro-apple-m_taT5OMvef.jpg', 'soft-home-slippers Taro Apple M', 1080, 1080),
  ('soft-home-slippers', '6a9bf2c0ead997d09a88ec96', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-s_etseo7otx.jpg', 'soft-home-slippers Denim Apple S', 1080, 1080),
  ('soft-home-slippers', '6a9bf2c3ead997d09a88fd93', '/hotaru/soft-home-slippers/soft-home-slippers-vdenim-apple-m_BoNgeunWd.jpg', 'soft-home-slippers Denim Apple M', 1080, 1080),
  ('flower-vacuum-bottle', '6a9bf2c5ead997d09a890c19', '/hotaru/flower-vacuum-bottle/flower-vacuum-bottle-vfruit-tonton_nXwIKL_65.jpg', 'flower-vacuum-bottle Fruit TonTon', 1080, 1080),
  ('pet-toys', '6a9bf2c8ead997d09a891505', '/hotaru/pet-toys/pet-toys-vberry-giraffe_34Ny2S_5o.jpg', 'pet-toys Berry Giraffe', 1080, 1080),
  ('pet-toys', '6a9bf2cbead997d09a8923e2', '/hotaru/pet-toys/pet-toys-vmatcha-cookies_z-aLbWBOX.jpg', 'pet-toys Matcha Cookies', 1080, 1080),
  ('pet-raglan-stripe-t-shirt', '6a9bf2ceead997d09a893806', '/hotaru/pet-raglan-stripe-t-shirt/pet-raglan-stripe-t-shirt-vberry-hazelnut_aal46LVBz.jpg', 'pet-raglan-stripe-t-shirt Berry Hazelnut', 1080, 1080)
),
numbered as (
  select p.id as product_id, i.imagekit_file_id, i.file_path, i.alt, i.width, i.height,
         coalesce((select max(pi.position) from public.product_images pi
                    where pi.product_id = p.id), -1)
           + row_number() over (partition by p.id order by i.file_path) as position
    from incoming i
    join public.products p on p.slug = i.slug
   where not exists (select 1 from public.product_images pi
                      where pi.product_id = p.id and pi.file_path = i.file_path)
)
insert into public.product_images (product_id, imagekit_file_id, file_path, alt, width, height, position)
select product_id, imagekit_file_id, file_path, alt, width, height, position from numbered;

-- Re-apply the full mapping now that every image exists.
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
   and v.option_value = m.option_value
   and v.image_id is distinct from pi.id;
