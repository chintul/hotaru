-- ============================================================================
-- hotaru — 04. Grants + Row Level Security
-- ============================================================================
-- Two things enforce access here, and they do different jobs:
--
--   GRANTS decide what EXISTS. pg_graphql filters the schema it reflects by the
--   caller's SQL privileges, so revoking INSERT on `orders` from `authenticated`
--   does not merely forbid the mutation — it removes insertIntoOrdersCollection
--   from the schema that role can even introspect.
--
--   RLS decides which ROWS. Policies scope reads to the caller's own data.
--
-- Storefront roles get SELECT and nothing else. Every write is a SECURITY
-- DEFINER function from migration 03, which runs as owner and therefore
-- bypasses both layers on purpose.
-- ============================================================================

-- Start from zero rather than trusting defaults.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. A table with RLS on and no policy denies everything,
-- which is the correct default for anything not explicitly opened below.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','addresses','categories','category_translations','products',
    'product_translations','product_images','variants','carts','cart_items',
    'delivery_methods','discount_codes','orders','order_items','payments',
    'wishlist_items','reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Public catalog — readable by everyone, including logged-out visitors
-- ---------------------------------------------------------------------------

grant select on
  public.categories, public.category_translations,
  public.products, public.product_translations, public.product_images,
  public.variants, public.delivery_methods
to anon, authenticated;

create policy categories_public_read on public.categories
  for select using (is_visible or public.is_admin());

create policy category_translations_public_read on public.category_translations
  for select using (
    exists (select 1 from public.categories c
             where c.id = category_id and (c.is_visible or public.is_admin()))
  );

create policy products_public_read on public.products
  for select using (status = 'active' or public.is_admin());

create policy product_translations_public_read on public.product_translations
  for select using (
    exists (select 1 from public.products p
             where p.id = product_id and (p.status = 'active' or public.is_admin()))
  );

create policy product_images_public_read on public.product_images
  for select using (
    exists (select 1 from public.products p
             where p.id = product_id and (p.status = 'active' or public.is_admin()))
  );

create policy variants_public_read on public.variants
  for select using (
    (is_active and exists (select 1 from public.products p
                            where p.id = product_id and p.status = 'active'))
    or public.is_admin()
  );

create policy delivery_methods_public_read on public.delivery_methods
  for select using (is_active or public.is_admin());

-- Discount codes are never listable: a readable table is a coupon leak. Codes
-- are validated inside place_order, which runs as owner.
grant select on public.discount_codes to authenticated;
create policy discount_codes_admin_only on public.discount_codes
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Customer-owned data
-- ---------------------------------------------------------------------------

grant select on
  public.profiles, public.addresses, public.carts, public.cart_items,
  public.orders, public.order_items, public.payments,
  public.wishlist_items, public.reviews
to authenticated;

create policy profiles_self_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Profile self-service is the one direct write allowed, and only on columns
-- that carry no authority. `role` is protected by the trigger below.
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy addresses_owner_all on public.addresses
  for select using (profile_id = auth.uid() or public.is_admin());

-- The address book is ordinary CRUD; nothing here can move money.
grant insert, update, delete on public.addresses to authenticated;
create policy addresses_owner_write on public.addresses
  for insert with check (profile_id = auth.uid() and not public.is_anonymous_user());
create policy addresses_owner_modify on public.addresses
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy addresses_owner_delete on public.addresses
  for delete using (profile_id = auth.uid());

create policy carts_owner_read on public.carts
  for select using (profile_id = auth.uid() or public.is_admin());

create policy cart_items_owner_read on public.cart_items
  for select using (
    exists (select 1 from public.carts c
             where c.id = cart_id and (c.profile_id = auth.uid() or public.is_admin()))
  );

create policy orders_owner_read on public.orders
  for select using (profile_id = auth.uid() or public.is_admin());

create policy order_items_owner_read on public.order_items
  for select using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.profile_id = auth.uid() or public.is_admin()))
  );

create policy payments_owner_read on public.payments
  for select using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.profile_id = auth.uid() or public.is_admin()))
  );

create policy wishlist_owner_all on public.wishlist_items
  for select using (profile_id = auth.uid());

-- Approved reviews are public; your own unapproved review stays visible to you
-- so the UI can say "awaiting approval" instead of losing it.
create policy reviews_read on public.reviews
  for select using (is_approved or profile_id = auth.uid() or public.is_admin());

grant select on public.reviews to anon;

-- ---------------------------------------------------------------------------
-- Privilege escalation guard
-- ---------------------------------------------------------------------------
-- profiles_self_update above permits a customer to update their own row. Column
-- grants already exclude `role`, but a future grant change would silently open
-- self-promotion to admin. Defence in depth.
--
-- BOOTSTRAP: create the first admin from the Supabase SQL editor with
--   update public.profiles set role = 'admin' where email = 'you@hotaru.mn';
-- That session has no auth.uid(), so the guard below stands aside for it.
create or replace function public.tg_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() is null for service_role, the Supabase SQL editor, and psql —
  -- i.e. trusted server-side contexts. That escape hatch is required, not
  -- incidental: without it there is no way to promote the FIRST admin, since
  -- is_admin() is false for everyone on a fresh database.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'cannot change own role' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.tg_protect_profile_role();

-- ---------------------------------------------------------------------------
-- Function execution
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

-- Anonymous visitors may browse and build a cart, nothing more.
grant execute on function
  public.search_products(text),
  public.add_to_cart(uuid, int),
  public.set_cart_item_quantity(uuid, int),
  public.clear_cart(),
  public.current_cart_id(),
  public.issue_cart_transfer_token()
to anon, authenticated;

-- Real accounts only.
grant execute on function
  public.place_order(uuid, uuid, text, text),
  public.submit_payment_proof(uuid, text, text),
  public.cancel_order(uuid, text),
  public.toggle_wishlist(uuid),
  public.submit_review(uuid, int, text, text),
  public.redeem_cart_transfer(uuid)
to authenticated;

-- Admin-gated internally by is_admin(); granted so the mutation is reflected
-- into the schema for staff sessions.
grant execute on function public.confirm_payment(uuid, text, bigint) to authenticated;

-- Helpers used inside policies.
grant execute on function public.is_admin(), public.is_anonymous_user()
  to anon, authenticated;
