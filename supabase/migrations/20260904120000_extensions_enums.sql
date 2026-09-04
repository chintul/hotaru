-- ============================================================================
-- hotaru — 01. Extensions, enums, shared helpers
-- ============================================================================
-- MONEY CONVENTION (read this before touching any amount column)
--   All monetary values are BIGINT in WHOLE MONGOLIAN TUGRIK (MNT).
--   MNT has no circulating minor unit. There are NO cents. Never divide or
--   multiply by 100 anywhere in this codebase. Every money column is suffixed
--   `_mnt` so a misuse is visible at the call site.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive email / slug / sku
create extension if not exists pg_graphql; -- GraphQL API (Supabase enables by default)
create extension if not exists pg_trgm;    -- substring search (no Mongolian stemmer exists)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('customer', 'admin');

create type public.product_status as enum ('draft', 'active', 'archived');

-- Order lifecycle. `oversold` is not a normal state: it is the loud failure
-- flag raised when payment was confirmed but stock could not be decremented.
-- It exists because we deliberately do NOT reserve stock at order time.
create type public.order_status as enum (
  'awaiting_payment',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
  'oversold'
);

create type public.payment_status as enum (
  'unpaid',      -- order placed, nothing received
  'submitted',   -- customer says they transferred; awaiting owner confirmation
  'confirmed',   -- owner verified funds landed
  'failed',
  'refunded'
);

create type public.delivery_kind as enum ('courier', 'pickup', 'intercity');

create type public.discount_kind as enum ('percentage', 'fixed_amount', 'free_delivery');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True while the caller is still a Supabase anonymous user. Anonymous users may
-- hold a cart; they may not place an order, review, or own an address.
create or replace function public.is_anonymous_user()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

comment on function public.is_anonymous_user is 'True when the caller is a Supabase anonymous (not yet converted) user.';

-- NOTE: is_admin() lives in migration 03, not here. It reads public.profiles,
-- and a LANGUAGE SQL body resolves its relations at CREATE time, so it cannot
-- be defined before migration 02 creates the table.
