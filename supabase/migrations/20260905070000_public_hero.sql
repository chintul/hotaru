-- ============================================================================
-- hotaru — 17. Hero readable by logged-out visitors
-- ============================================================================
-- The hero copy and image live in store_settings, but that table also holds the
-- bank account and the owner's alert address, and its policy was
-- `auth.uid() is not null`. The home page renders server-side with the anon
-- key, so it could not read its own hero.
--
-- Split the two concerns properly rather than loosening the row policy:
--   RLS decides which ROWS are visible  -> now everyone, it is a single row
--   COLUMN GRANTS decide which COLUMNS  -> anon gets the hero fields only
--
-- pg_graphql reflects per-column privileges, so an anonymous session does not
-- even see bankAccountNumber in the schema. Verified in the test suite.
-- ============================================================================

drop policy if exists store_settings_read on public.store_settings;

create policy store_settings_read on public.store_settings
  for select using (true);

-- Anonymous visitors: presentation fields only.
grant select (
  id, hero_image_path, hero_headline, hero_subline, hero_cta_label, hero_cta_href,
  store_email, store_phone
) on public.store_settings to anon;

-- Signed-in customers additionally need the payment instructions at checkout;
-- the admin needs everything, which the existing full grant already covers.
grant select on public.store_settings to authenticated;
