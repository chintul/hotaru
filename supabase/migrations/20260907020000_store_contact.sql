-- ============================================================================
-- hotaru — 31. Storefront contact details are public
-- ============================================================================
-- store_settings already carried store_email, store_phone and store_address,
-- described as "storefront contact details, also used in email footers" — but
-- nothing on the storefront ever read them, so the footer named no way to reach
-- the shop and /contact said "email us" without giving an address.
--
-- Two changes, both about the same gap:
--   * social links get columns. In Mongolia the Facebook page is usually the
--     shop's front door, and a customer who cannot find it messages nobody.
--   * anon gets store_address and the two links, alongside store_email and
--     store_phone which migration 17 already granted. Same split as the hero:
--     the row policy stays open, COLUMN grants decide what a logged-out
--     visitor sees, and the bank account stays invisible.
-- ============================================================================

alter table public.store_settings
  add column if not exists facebook_url  text,
  add column if not exists instagram_url text;

comment on column public.store_settings.facebook_url is
  'Full URL to the shop''s Facebook page. Empty hides the link rather than rendering a dead one.';
comment on column public.store_settings.instagram_url is
  'Full URL to the shop''s Instagram profile. Empty hides the link.';

-- The footer and /contact render server-side with the anon key.
grant select (store_address, facebook_url, instagram_url) on public.store_settings to anon;
