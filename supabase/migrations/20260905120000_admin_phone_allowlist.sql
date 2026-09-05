-- Admin sign-in by phone.
--
-- The owner signs in with a phone OTP, so admin has to be derivable from a
-- verified phone number. The obvious place to look -- profiles.phone -- is
-- NOT safe: 20260904120300_rls.sql:108 grants
--   update (full_name, phone, marketing_opt_in) on public.profiles to authenticated
-- so any signed-in customer can write their own profiles.phone. Keying admin
-- off that column would let anyone self-promote by typing the owner's number.
--
-- auth.users.phone is the trustworthy source: only GoTrue writes it, and only
-- after the number has actually been confirmed. This allowlist is matched
-- against that column, and against phone_confirmed_at, never against
-- profiles.phone.
--
-- The table itself is service_role only -- no grants to anon or authenticated,
-- so the allowlist cannot be read (enumerating admin phone numbers) or written
-- (adding your own) from the browser.

create table if not exists public.admin_phones (
  phone      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_phones enable row level security;
-- Deliberately no policy: RLS with zero policies denies every role that does
-- not bypass it. Only service_role reaches this table.

revoke all on public.admin_phones from public, anon, authenticated;

-- Mongolian mobile numbers are 8 digits; a handset or carrier may present them
-- with a +976 country code or with spaces. Reduce everything to the 8-digit
-- subscriber number so the comparison holds whatever shape arrives.
create or replace function public.normalise_mn_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when length(digits) > 8 and left(digits, 3) = '976' then right(digits, 8)
    else digits
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as digits) s;
$$;

comment on function public.normalise_mn_phone is
  'Reduce a Mongolian phone number to its 8-digit subscriber form.';

insert into public.admin_phones (phone, note) values
  (public.normalise_mn_phone('88286859'), 'owner'),
  (public.normalise_mn_phone('89286859'), 'owner')
on conflict (phone) do nothing;

-- Promote any profile whose CONFIRMED auth.users.phone is on the allowlist.
--
-- Promote only, never demote: the email-based admin account has no phone at
-- all and must not be stripped of its role by a phone sync. Removing someone
-- is a deliberate act, done by hand.
create or replace function public.sync_admin_roles()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  promoted integer;
begin
  with eligible as (
    select u.id
      from auth.users u
      join public.admin_phones a
        on a.phone = public.normalise_mn_phone(u.phone)
     where u.phone_confirmed_at is not null
  )
  update public.profiles p
     set role = 'admin'
    from eligible e
   where p.id = e.id
     and p.role is distinct from 'admin';

  get diagnostics promoted = row_count;
  return promoted;
end;
$$;

comment on function public.sync_admin_roles is
  'Grant admin to every profile whose confirmed auth.users.phone is allowlisted. Promotes only.';

-- service_role calls this from the verify callback; nobody else may.
revoke execute on function public.sync_admin_roles() from public, anon, authenticated;

-- Backfill for numbers already registered and confirmed.
select public.sync_admin_roles();
