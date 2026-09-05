-- The slug for this product was generated before the brand name was stripped
-- from titles, so it kept "tagi" in the URL. Titles were already clean.
update public.products
   set slug = 'denim-patchwork-laptop-bag'
 where slug = 'denim-patchwork-laptop-bag-tagi-corduroy-floral-patchwork-la';
