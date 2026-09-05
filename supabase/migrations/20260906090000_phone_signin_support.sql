-- Support returning phone sign-ins.
--
-- Supabase's phone provider is off: SMS goes through verify.mn, not GoTrue, so
-- there is no SMS provider configured and signInWithPassword({ phone }) fails
-- with 422 phone_provider_disabled. That made sign-in look intermittent -- the
-- FIRST time a number is seen it is attached to the caller's own anonymous
-- user and no login is needed, but every later sign-in has to produce a
-- session for the account that already owns the number, and that path was
-- dead on arrival.
--
-- The session is now minted over the email channel, which IS enabled
-- (admin.generateLink + verifyOtp). An account that has only ever signed in by
-- phone has no email, so one is synthesised from the number purely as a login
-- identity.

-- ---------------------------------------------------------------------------
-- Placeholder sign-in addresses
-- ---------------------------------------------------------------------------
-- Those synthesised addresses must never be mistaken for a way to reach the
-- customer: handle_user_updated mirrors auth.users.email into profiles.email,
-- and order_notification_payload reads profiles.email as the contact address
-- for order mail. Left alone, we would address order confirmations to
-- 89286859@phone.hotaru.invalid.
--
-- .invalid is reserved by RFC 2606 and can never resolve, so a placeholder can
-- never reach a real inbox even if one escapes.
create or replace function public.is_placeholder_email(p_email text)
returns boolean
language sql
immutable
as $$
  select p_email is not null and p_email ilike '%@phone.hotaru.invalid';
$$;

comment on function public.is_placeholder_email is
  'True for a synthesised phone sign-in address, which is a login identity and not a contact address.';

-- Both mirrors now skip placeholders, so profiles.email keeps meaning "an
-- address a human actually reads".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    case when public.is_placeholder_email(new.email) then null
         else nullif(new.email, '')::citext end,
    nullif(new.phone, ''),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set
    email = case
              when public.is_placeholder_email(new.email) then email
              else coalesce(nullif(new.email, '')::citext, email)
            end,
    phone = coalesce(nullif(new.phone, ''), phone)
  where id = new.id;
  return new;
end;
$$;

-- Scrub any placeholder that already reached a profile.
update public.profiles
   set email = null
 where public.is_placeholder_email(email::text);

-- ---------------------------------------------------------------------------
-- Owner lookup
-- ---------------------------------------------------------------------------
-- attachPhoneToUser found the owning account by listing users a page at a time
-- and scanning in JS, capped at 1000. Past that the owner stops being found,
-- the caller takes the "attach" branch instead, and the write fails on the
-- unique phone constraint -- sign-in would break for everyone once the table
-- outgrew one page. This answers the same question directly, and matches on
-- the normalised number so +976 / spacing variants still line up.
--
-- SECURITY DEFINER because auth.users is not readable by the API roles, and
-- execute is revoked from them: being able to map a phone number to a user id
-- is exactly the enumeration this table is protected against.
create or replace function public.find_user_id_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.id
    from auth.users u
   where u.phone is not null
     and u.phone <> ''
     and public.normalise_mn_phone(u.phone) = public.normalise_mn_phone(p_phone)
   order by u.created_at
   limit 1;
$$;

comment on function public.find_user_id_by_phone is
  'Service-role only: the account that owns a phone number, matched on the normalised form.';

revoke execute on function public.find_user_id_by_phone(text) from public, anon, authenticated;
