-- Drop the brand from seo_title.
--
-- app/layout.js sets `title: { template: '%s · hotaru' }`, so Next appends the
-- brand to every page title already. Storing "Star Hairclip — hotaru" produced
-- "Star Hairclip — hotaru · hotaru" in the tab and in search results.
--
-- seo_title holds the product name alone; the template owns the brand.
update public.product_translations
   set seo_title = regexp_replace(seo_title, '\s+—\s+hotaru$', '')
 where locale = 'mn'
   and seo_title like '%— hotaru';
