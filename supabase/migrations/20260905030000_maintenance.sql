-- ============================================================================
-- hotaru — 13. Maintenance
-- ============================================================================
-- Anonymous sign-in is the cart identity, so every visitor who touches a cart
-- creates an auth.users row. Without a sweep that table grows forever and the
-- profiles mirror grows with it.
--
-- Deliberately conservative: only anonymous users, only ones older than the
-- window, and never one that owns an order or a non-empty cart — a shopper can
-- leave a tab open for days and must not lose their basket.
-- ============================================================================

create or replace function public.cleanup_anonymous_users(older_than interval default '7 days')
returns integer
volatile
language plpgsql
security definer
set search_path = public, pg_temp, auth
as $$
declare
  v_deleted integer;
begin
  with doomed as (
    select u.id
    from auth.users u
    where u.is_anonymous
      and u.created_at < now() - older_than
      and not exists (select 1 from public.orders o where o.profile_id = u.id)
      and not exists (
        select 1
        from public.carts c
        join public.cart_items ci on ci.cart_id = c.id
        where c.profile_id = u.id
      )
  )
  delete from auth.users u using doomed d where u.id = d.id;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function public.cleanup_anonymous_users is
  'Removes stale anonymous auth users with no order and no cart contents. Run daily. Not exposed to any client role.';

-- Expire abandoned carts so the "one open cart per profile" index does not
-- keep a months-old basket alive forever.
create or replace function public.expire_stale_carts(older_than interval default '30 days')
returns integer
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  update public.carts c
     set status = 'abandoned'
   where c.status = 'open' and c.updated_at < now() - older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Neither is callable by a client. They run as service_role from the cron
-- endpoint, so they must NOT appear in the reflected schema.
revoke execute on function
  public.cleanup_anonymous_users(interval),
  public.expire_stale_carts(interval)
from public, anon, authenticated;

-- Belt and braces for anything added later in this migration chain.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and p.proname not in (
        'search_products','current_cart_id','add_to_cart','set_cart_item_quantity',
        'clear_cart','issue_cart_transfer_token','is_admin','is_anonymous_user')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    raise notice 'revoked anon EXECUTE on %', r.sig;
  end loop;
end $$;
