-- Local stand-in for the parts of Supabase that live outside our migrations.
--
-- IMPORTANT: this must mirror production's PERMISSIVE defaults. A test database
-- that is stricter than production cannot find privilege leaks — that is
-- exactly how migration 07 shipped tables with ALL privileges granted to anon.
create schema if not exists auth;

-- Mirrors the columns of Supabase's real auth.users that our migrations read.
-- Anything missing here passes locally and fails on push, so add the column
-- when a migration starts depending on it: phone_confirmed_at was added after
-- sync_admin_roles() began gating admin promotion on a *confirmed* number.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

grant usage on schema auth to anon, authenticated;
grant select on auth.users to anon, authenticated;

alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
