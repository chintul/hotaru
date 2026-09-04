-- ============================================================================
-- hotaru — 09. addresses.profile_id defaults to the caller
-- ============================================================================
-- The address book is the one place a client inserts a row directly. Requiring
-- it to send profile_id had two problems:
--
--   1. It broke. An insert that omits the column stores NULL, which fails the
--      `profile_id = auth.uid()` check with "new row violates row-level
--      security policy" — the error a customer hit on the checkout screen.
--   2. It was the wrong shape. A client that *supplies* an owner id is a client
--      that can try to supply someone else's. Deriving it server-side removes
--      the question entirely; the RLS check then becomes a second layer rather
--      than the only one.
--
-- With a default the GraphQL AddressInsertInput makes profileId optional, so
-- the storefront simply never mentions it.
-- ============================================================================

alter table public.addresses
  alter column profile_id set default auth.uid();

comment on column public.addresses.profile_id is
  'Defaults to auth.uid(). Clients must not send this — ownership is derived from the JWT, never from the request body.';
