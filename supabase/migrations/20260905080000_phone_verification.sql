-- ============================================================================
-- hotaru — 18. Phone verification (verify.mn)
-- ============================================================================
-- verify.mn is Mobile-Originated: the user texts a code we mint to shortcode
-- 144773 from the phone they are claiming. That direction is the whole point —
-- the SMS must originate from that number, so it proves possession in a way a
-- delivered OTP does not.
--
-- Sessions are recorded here so a callback can be resolved back to a user, and
-- so a second tab cannot start a parallel session for the same person. No
-- client role can touch this table: the API routes act as service_role.
-- ============================================================================

create table public.phone_verifications (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null unique,          -- verify.mn sessionId
  phone       text not null,
  profile_id  uuid references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending', 'verified', 'expired', 'failed')),
  -- The 6-digit code we minted. Kept for support ("what did I send?"), never
  -- shown to anyone but the owner of the session.
  code        text,
  verified_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index phone_verifications_profile_idx on public.phone_verifications (profile_id);
create index phone_verifications_phone_idx   on public.phone_verifications (phone, created_at desc);
create index phone_verifications_pending_idx on public.phone_verifications (created_at)
  where status = 'pending';

comment on table public.phone_verifications is
  'verify.mn MO-SMS sessions. Written only by the API routes as service_role; no client role has any privilege here.';

alter table public.phone_verifications enable row level security;
alter table public.phone_verifications force row level security;
-- RLS on with no policy denies everything, which is the intent: service_role
-- bypasses RLS, and nothing else should read a phone/code pair.
revoke all on public.phone_verifications from anon, authenticated;

-- A verified phone belongs on the profile so checkout and the courier can use
-- it without re-reading the verification table.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

comment on column public.profiles.phone_verified_at is
  'Set when the number in profiles.phone was confirmed by an MO SMS. Null means unproven.';
