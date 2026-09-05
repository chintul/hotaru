-- Newsletter signups, category corrections, and the featured shelf.

-- ---------------------------------------------------------------------------
-- Newsletter
-- ---------------------------------------------------------------------------
-- The footer form posted to /api/newsletter, which did not exist: every
-- submission on every page navigated to a 404. The address has to land
-- somewhere, so here is that somewhere.
--
-- Writes go through the service role in the route handler, never from the
-- browser: an anon-writable table collecting email addresses is a spam sink,
-- and being able to READ it would leak the customer list. RLS on with no
-- policy denies both to everyone who does not bypass it.
create table if not exists public.newsletter_subscribers (
  email        citext primary key,
  locale       text not null default 'mn',
  source       text,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Category corrections
-- ---------------------------------------------------------------------------
-- The seed filled every category to exactly three products, which pushed items
-- into whichever bucket still had room rather than the one they belong in: a
-- vacuum bottle sat under Малгай (caps) and a woven cap under Хувцас
-- (clothing). Correct placement beats even counts -- a shopper filtering by
-- Малгай should not be shown a water bottle.
update public.products p
   set category_id = c.id
  from public.categories c
 where c.slug = 'cups'
   and p.slug = 'tritan-sports-portable-bottle';

update public.products p
   set category_id = c.id
  from public.categories c
 where c.slug = 'cap'
   and p.slug = 'wonderful-backyard-colorful-woven-cap';

-- Hair clips belong in Үсний хэрэгсэл, not general Гоёл чимэглэл.
update public.products p
   set category_id = c.id
  from public.categories c
 where c.slug = 'hair-accessories'
   and p.slug in ('star-hairclip', 'metal-floral-hair-clip');

-- ---------------------------------------------------------------------------
-- Featured shelf
-- ---------------------------------------------------------------------------
-- FEATURED_PRODUCTS now honours is_featured. Six rows were flagged, which
-- leaves a ragged second row in a four-column grid; top up to eight so the
-- shelf fills two clean rows. The owner can re-pick these from /admin.
update public.products
   set is_featured = true
 where slug in (
   'star-hairclip',
   'metal-floral-hair-clip',
   'cream-bulging-love-hairclip',
   'flower-vacuum-bottle',
   'love-patchwork-baseball-cap',
   'make-you-happy-phone-case-with-metal-heart-bracket',
   'small-woven-pilow-laptop-bag',
   'ok-laptop-bag'
 );

-- ---------------------------------------------------------------------------
-- Category tile artwork
-- ---------------------------------------------------------------------------
-- hair-accessories was pointing at artwork with the word "Accessories" printed
-- on it, so it and the accessories tile looked like the same category twice.
-- Borrow a photograph from a product actually in that category.
update public.categories c
   set image_path = (
     select pi.file_path
       from public.product_images pi
       join public.products p on p.id = pi.product_id
      where p.slug = 'cream-bulging-love-hairclip'
      order by pi.position
      limit 1
   )
 where c.slug = 'hair-accessories'
   and exists (select 1 from public.products p2 where p2.slug = 'cream-bulging-love-hairclip');
