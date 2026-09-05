-- ============================================================================
-- hotaru — 19. carts_profile_id_fkey guard
-- ============================================================================
-- current_cart_id() inserted straight into carts using auth.uid(), assuming a
-- matching profiles row always exists because handle_new_user() creates one on
-- signup. That assumption breaks whenever the two can drift:
--
--   * a JWT outliving its user (deleted account, restored database) still
--     resolves auth.uid(), so the insert is attempted for a profile that is
--     gone -> "insert or update on table carts violates foreign key constraint
--     carts_profile_id_fkey";
--   * any user created before the trigger existed, or a trigger failure.
--
-- The client now detects the first case and re-authenticates. This closes the
-- second: backfill the profile from auth.users when it is missing, and give a
-- clear error when the user genuinely does not exist rather than a raw FK
-- violation the storefront cannot interpret.
-- ============================================================================

create or replace function public.current_cart_id()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp, auth
as $$
declare
  v_cart uuid;
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Ensure the profile the cart will reference actually exists.
  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    insert into public.profiles (id, email, phone)
    select u.id, nullif(u.email, '')::citext, nullif(u.phone, '')
    from auth.users u
    where u.id = v_uid
    on conflict (id) do nothing;

    -- Still absent means the JWT refers to a user that no longer exists. Say
    -- so: the client can catch this and start a fresh anonymous session.
    if not exists (select 1 from public.profiles p where p.id = v_uid) then
      raise exception 'account no longer exists' using errcode = '28000';
    end if;
  end if;

  select id into v_cart
  from public.carts
  where profile_id = v_uid and status = 'open';

  if v_cart is null then
    insert into public.carts (profile_id) values (v_uid)
    on conflict do nothing
    returning id into v_cart;

    -- Lost the race against a concurrent add-to-cart; re-read the winner.
    if v_cart is null then
      select id into v_cart
      from public.carts
      where profile_id = v_uid and status = 'open';
    end if;
  end if;

  return v_cart;
end;
$$;
