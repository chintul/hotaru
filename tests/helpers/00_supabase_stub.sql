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

-- ---------------------------------------------------------------------------
-- pg_net + Vault
-- ---------------------------------------------------------------------------
-- Neither extension exists in plain Postgres, and test-db.sh strips the
-- `create extension pg_net` line the same way it strips pg_graphql. The
-- notification triggers call net.http_post() to kick the drain route, so the
-- function must exist here or every order write fails locally.
--
-- The stub RECORDS instead of sending: tests assert on net.sent_requests to
-- prove the kick fired exactly when it should, which is the whole point of
-- dropping the cron.
create schema if not exists net;
create schema if not exists vault;

create table if not exists net.sent_requests (
  id      bigserial primary key,
  url     text not null,
  body    jsonb,
  headers jsonb,
  sent_at timestamptz not null default now()
);

-- Mirrors pg_net's real signature, including argument order and defaults.
-- Production returns a request id and queues the send for after commit; the
-- stub returns the same shape so callers cannot tell the difference.
create or replace function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds int default 5000
) returns bigint
language plpgsql
as $$
declare v_id bigint;
begin
  insert into net.sent_requests (url, body, headers)
  values (http_post.url, http_post.body, http_post.headers)
  returning id into v_id;
  return v_id;
end;
$$;

-- Supabase exposes decrypted secrets through this view. A table is close
-- enough: kick_notification_drain() only ever reads name + decrypted_secret.
create table if not exists vault.decrypted_secrets (
  id               uuid primary key default gen_random_uuid(),
  name             text unique not null,
  decrypted_secret text not null
);

grant usage on schema net, vault to service_role;
