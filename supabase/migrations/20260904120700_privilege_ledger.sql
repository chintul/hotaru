-- ============================================================================
-- hotaru — 08. Authoritative privilege ledger
-- ============================================================================
-- WHY THIS MIGRATION EXISTS
--
-- Supabase ships ALTER DEFAULT PRIVILEGES granting ALL on new tables in
-- `public` to anon and authenticated. Migration 04 revoked everything and
-- re-granted a minimal set — but it could only act on objects that existed
-- when it ran. Every table and function created in a LATER migration silently
-- inherits full default privileges again.
--
-- That is exactly what happened with migration 07: `store_settings` and
-- `notification_outbox` ended up with SELECT/INSERT/UPDATE/DELETE/TRUNCATE
-- for anon, and `order_notification_payload()` — SECURITY DEFINER, so it
-- bypasses RLS — was callable by anonymous visitors, returning a customer's
-- email, phone, address and the store's bank details for any order id.
--
-- Two structural fixes, so this cannot recur:
--   1. Change the DEFAULT so future objects arrive with no privileges.
--   2. Make this file the single authoritative statement of who may do what:
--      revoke everything, then grant the complete intended set. It is
--      idempotent and safe to re-run, and it supersedes the grant block in
--      migration 04.
--
-- RULE FOR FUTURE MIGRATIONS: after adding any table or function, add its
-- grant here. Never rely on defaults. Verify with the query at the bottom.
-- ============================================================================

-- 1. Stop the bleeding at the source: new objects get nothing by default.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 2. Reset to zero. TRUNCATE is included in ALL, and RLS does NOT restrict
--    TRUNCATE — a stray grant there is not covered by any policy.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tables — the complete intended set
-- ---------------------------------------------------------------------------

-- Public catalog: readable by logged-out visitors.
grant select on
  public.categories, public.category_translations,
  public.products, public.product_translations, public.product_images,
  public.variants, public.delivery_methods, public.reviews
to anon, authenticated;

-- Customer-owned data: RLS scopes each of these to the caller's own rows.
grant select on
  public.profiles, public.addresses, public.carts, public.cart_items,
  public.orders, public.order_items, public.payments,
  public.wishlist_items, public.discount_codes
to authenticated;

-- Bank details for the transfer screen. Admin-only for writes via policy;
-- the UPDATE grant is column-free because store_settings has no field a
-- customer may change.
grant select on public.store_settings to authenticated;
grant update on public.store_settings to authenticated;

-- Outbox is infrastructure: admin may read failures, nobody may write.
-- service_role bypasses RLS and needs no grant.
grant select on public.notification_outbox to authenticated;

-- The only direct table writes in the whole system.
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;
grant insert, update, delete on public.addresses to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Functions — the complete intended set
-- ---------------------------------------------------------------------------
-- Anything omitted here is unreachable from the API. That includes every
-- trigger function, every derived-column helper, and critically
-- order_notification_payload(), which is SECURITY DEFINER and must never be
-- callable by a client.

-- Browse and build a cart; available before signing in.
grant execute on function
  public.search_products(text),
  public.current_cart_id(),
  public.add_to_cart(uuid, int),
  public.set_cart_item_quantity(uuid, int),
  public.clear_cart(),
  public.issue_cart_transfer_token(),
  public.is_admin(),
  public.is_anonymous_user()
to anon, authenticated;

-- Real accounts only.
grant execute on function
  public.redeem_cart_transfer(uuid),
  public.place_order(uuid, uuid, text, text),
  public.submit_payment_proof(uuid, text, text),
  public.cancel_order(uuid, text),
  public.toggle_wishlist(uuid),
  public.submit_review(uuid, int, text, text),
  public.confirm_payment(uuid, text, bigint)
to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Self-check
-- ---------------------------------------------------------------------------
-- Fails the migration if anything outside the intended set is reachable, so a
-- future table or function cannot leak in unnoticed.

do $$
declare
  v_bad text;
begin
  -- Tables anon can write to. RLS is a second layer; it must never be the only one.
  select string_agg(distinct table_name || ':' || privilege_type, ', ')
    into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if v_bad is not null then
    raise exception 'anon holds write privileges: %', v_bad;
  end if;

  -- SECURITY DEFINER functions reachable by a client must be an explicit,
  -- reviewed list. Anything else is a privilege-escalation surface.
  select string_agg(p.proname, ', ')
    into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in (
      'search_products', 'current_cart_id', 'add_to_cart',
      'set_cart_item_quantity', 'clear_cart', 'issue_cart_transfer_token',
      'is_admin', 'is_anonymous_user'
    );
  if v_bad is not null then
    raise exception 'anon can execute unreviewed SECURITY DEFINER functions: %', v_bad;
  end if;

  raise notice 'privilege ledger verified';
end $$;
