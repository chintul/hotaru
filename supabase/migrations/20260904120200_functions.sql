-- ============================================================================
-- hotaru — 03. Write path
-- ============================================================================
-- Every mutation in this application is a function in this file.
--
-- WHY: pg_graphql also auto-generates insertInto*/update*/deleteFrom* mutations
-- for every table. Those are fine for a blog. They are not fine for money: a
-- client permitted to insert an order row is a client permitted to choose its
-- own total, and a mis-scoped `filter` on a bulk update rewrites rows you never
-- intended. So the storefront is granted SELECT only, and all writes go through
-- SECURITY DEFINER functions here, which recompute every amount from the
-- catalog and ignore anything the client claims about price.
--
-- pg_graphql exposes `volatile` functions as Mutation fields and
-- `stable`/`immutable` ones as Query fields. That mapping is the entire API.
--
-- NAMING TRAP: parameter names here become the GraphQL argument names, so they
-- are deliberately called `variant_id`, `product_id`, `order_id` rather than
-- `p_*`. That means a parameter can share a name with a column, and plpgsql
-- will refuse a BARE reference to it as ambiguous. Two rules follow:
--   * qualify every column reference (`cart_items.variant_id`) and every
--     parameter reference (`add_to_cart.variant_id`);
--   * use `on conflict on constraint <name>`, never a column list — the
--     inference clause cannot be qualified at all.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Role check (defined here, not in 01: it reads public.profiles)
-- ---------------------------------------------------------------------------

-- Role check. SECURITY DEFINER so it can read profiles without tripping the
-- RLS policies that themselves call it (which would recurse).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

comment on function public.is_admin is 'True when the calling user has the admin role.';

-- ---------------------------------------------------------------------------
-- Derived-column maintenance (products.min_price_mnt / in_stock / rating_*)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_product_derived(p_product_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.products p set
    min_price_mnt = v.min_price,
    max_price_mnt = v.max_price,
    in_stock      = coalesce(v.in_stock, false)
  from (
    select
      min(price_mnt) as min_price,
      max(price_mnt) as max_price,
      bool_or(quantity > 0 or allow_backorder) as in_stock
    from public.variants
    where product_id = p_product_id and is_active
  ) v
  where p.id = p_product_id;
$$;

create or replace function public.tg_variant_touch_product()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.refresh_product_derived(coalesce(new.product_id, old.product_id));
  -- A variant that moved between products must refresh both sides.
  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    perform public.refresh_product_derived(old.product_id);
  end if;
  return null;
end;
$$;

create trigger variants_refresh_product
  after insert or update or delete on public.variants
  for each row execute function public.tg_variant_touch_product();

create or replace function public.tg_review_touch_product()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p set
    rating_avg   = r.avg_rating,
    rating_count = coalesce(r.cnt, 0)
  from (
    select round(avg(rating)::numeric, 1) as avg_rating, count(*) as cnt
    from public.reviews
    where product_id = v_product and is_approved
  ) r
  where p.id = v_product;
  return null;
end;
$$;

create trigger reviews_refresh_product
  after insert or update or delete on public.reviews
  for each row execute function public.tg_review_touch_product();

-- ---------------------------------------------------------------------------
-- Auth: mirror auth.users into profiles
-- ---------------------------------------------------------------------------

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
    nullif(new.email, '')::citext,
    nullif(new.phone, ''),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- An anonymous user converting to a permanent one keeps the same id but gains
-- an email/phone. Keep profiles in step so orders carry real contact details.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles set
    email = coalesce(nullif(new.email, '')::citext, email),
    phone = coalesce(nullif(new.phone, ''), phone)
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------

create or replace function public.current_cart_id()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into v_cart
  from public.carts
  where profile_id = auth.uid() and status = 'open';

  if v_cart is null then
    insert into public.carts (profile_id) values (auth.uid())
    on conflict do nothing
    returning id into v_cart;

    -- Lost the race against a concurrent add-to-cart; re-read the winner.
    if v_cart is null then
      select id into v_cart
      from public.carts
      where profile_id = auth.uid() and status = 'open';
    end if;
  end if;

  return v_cart;
end;
$$;

-- Adds to the caller's cart. Quantity is additive; the client sends a delta,
-- never a price. Returns the cart so the drawer can refetch in one round trip.
create or replace function public.add_to_cart(variant_id uuid, quantity int default 1)
returns public.carts
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart uuid := public.current_cart_id();
  v_available int;
  v_backorder boolean;
  v_result public.carts;
begin
  if quantity <= 0 then
    raise exception 'quantity must be positive' using errcode = '22023';
  end if;

  select v.quantity, v.allow_backorder into v_available, v_backorder
  from public.variants v
  join public.products p on p.id = v.product_id
  where v.id = add_to_cart.variant_id
    and v.is_active
    and p.status = 'active';

  if not found then
    raise exception 'variant not purchasable' using errcode = 'P0002';
  end if;

  insert into public.cart_items (cart_id, variant_id, quantity)
  values (v_cart, add_to_cart.variant_id, add_to_cart.quantity)
  on conflict on constraint cart_items_cart_variant_key
  do update set quantity = public.cart_items.quantity + excluded.quantity,
                updated_at = now();

  -- Advisory only. Stock is NOT reserved here — see confirm_payment.
  if not v_backorder then
    update public.cart_items
       set quantity = least(public.cart_items.quantity, greatest(v_available, 1))
     where cart_id = v_cart and cart_items.variant_id = add_to_cart.variant_id;
  end if;

  update public.carts set updated_at = now() where id = v_cart
  returning * into v_result;
  return v_result;
end;
$$;

-- Absolute quantity. 0 removes the line.
create or replace function public.set_cart_item_quantity(variant_id uuid, quantity int)
returns public.carts
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart uuid := public.current_cart_id();
  v_result public.carts;
begin
  if quantity < 0 then
    raise exception 'quantity cannot be negative' using errcode = '22023';
  end if;

  if quantity = 0 then
    delete from public.cart_items
     where cart_id = v_cart and cart_items.variant_id = set_cart_item_quantity.variant_id;
  else
    update public.cart_items
       set quantity = set_cart_item_quantity.quantity, updated_at = now()
     where cart_id = v_cart and cart_items.variant_id = set_cart_item_quantity.variant_id;
  end if;

  update public.carts set updated_at = now() where id = v_cart
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.clear_cart()
returns public.carts
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart uuid := public.current_cart_id();
  v_result public.carts;
begin
  delete from public.cart_items where cart_id = v_cart;
  update public.carts set updated_at = now() where id = v_cart
  returning * into v_result;
  return v_result;
end;
$$;

-- Cart handoff, for the one case where a cart genuinely has to move between
-- users: a returning customer whose email already belongs to an account. The
-- anonymous identity cannot be linked to it, so they sign in to the existing
-- account instead — and the anonymous cart has to follow them.
--
-- SECURITY: this must never accept a caller-supplied profile id. A
-- SECURITY DEFINER function that merges "the cart belonging to <uuid>" into the
-- caller's cart lets any authenticated user drain any other user's cart by
-- guessing or harvesting an id. Instead the anonymous session mints an
-- unguessable single-use token for the cart it already owns, and the signed-in
-- account redeems it. Authority travels with the token, not with an argument.

create or replace function public.issue_cart_transfer_token()
returns uuid
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cart  uuid := public.current_cart_id();
  v_token uuid := gen_random_uuid();
begin
  update public.carts
     set transfer_token = v_token,
         transfer_token_expires_at = now() + interval '15 minutes',
         updated_at = now()
   where id = v_cart and profile_id = auth.uid();

  if not found then
    raise exception 'no cart to transfer' using errcode = 'P0002';
  end if;

  return v_token;
end;
$$;

-- Redeems a token minted above. Higher quantity wins per line, never the sum —
-- summing is the "added 2, signed in, now 4" bug.
create or replace function public.redeem_cart_transfer(token uuid)
returns public.carts
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid;
  v_source uuid;
  v_result public.carts;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Burn the token as we read it: single use, even under concurrency.
  update public.carts
     set transfer_token = null, transfer_token_expires_at = null
   where transfer_token = redeem_cart_transfer.token
     and transfer_token_expires_at > now()
     and status = 'open'
  returning id into v_source;

  if v_source is null then
    raise exception 'transfer token invalid or expired' using errcode = '22023';
  end if;

  v_target := public.current_cart_id();

  if v_source = v_target then
    select * into v_result from public.carts where id = v_target;
    return v_result;
  end if;

  insert into public.cart_items (cart_id, variant_id, quantity)
  select v_target, si.variant_id, si.quantity
  from public.cart_items si
  where si.cart_id = v_source
  on conflict on constraint cart_items_cart_variant_key
  do update set quantity = greatest(public.cart_items.quantity, excluded.quantity),
                updated_at = now();

  update public.carts set status = 'abandoned' where id = v_source;
  update public.carts set updated_at = now() where id = v_target
  returning * into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------

create or replace function public.compute_discount_mnt(
  p_code_id uuid, p_subtotal_mnt bigint, p_delivery_mnt bigint
) returns bigint
language sql
stable
as $$
  select case d.kind
    when 'percentage'    then least(p_subtotal_mnt, floor(p_subtotal_mnt * d.value / 100.0)::bigint)
    when 'fixed_amount'  then least(p_subtotal_mnt, d.value::bigint)
    when 'free_delivery' then p_delivery_mnt
  end
  from public.discount_codes d
  where d.id = p_code_id;
$$;

-- Places an order from the caller's cart.
--
-- Money is computed here from the catalog. The client supplies an address id, a
-- delivery method id and optionally a code — never an amount.
--
-- Stock is deliberately NOT reserved (a bank transfer may take hours or never
-- arrive, and stale reservations freeze a small catalog). Availability is
-- checked advisorily here; the authoritative decrement happens in
-- confirm_payment.
create or replace function public.place_order(
  address_id         uuid,
  delivery_method_id uuid,
  discount_code      text default null,
  customer_note      text default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_cart      uuid;
  v_addr      public.addresses;
  v_delivery  public.delivery_methods;
  v_code      public.discount_codes;
  v_subtotal  bigint := 0;
  v_discount  bigint := 0;
  v_order     public.orders;
  v_email     citext;
  v_phone     text;
  v_lines     int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Accounts are required at checkout: an anonymous cart holder must convert
  -- before they can place an order.
  if public.is_anonymous_user() then
    raise exception 'account required to place an order' using errcode = '42501';
  end if;

  select id into v_cart from public.carts
   where profile_id = v_uid and status = 'open';
  if v_cart is null then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  select * into v_addr from public.addresses
   where id = place_order.address_id and profile_id = v_uid;
  if not found then
    raise exception 'address not found' using errcode = 'P0002';
  end if;

  select * into v_delivery from public.delivery_methods
   where id = place_order.delivery_method_id and is_active;
  if not found then
    raise exception 'delivery method unavailable' using errcode = 'P0002';
  end if;

  select email, phone into v_email, v_phone from public.profiles where id = v_uid;
  v_phone := coalesce(v_phone, v_addr.phone);
  if v_email is null then
    raise exception 'account email required' using errcode = '22023';
  end if;

  -- Lock the variants this order touches, in a stable order, so concurrent
  -- checkouts of the same item serialise rather than deadlock.
  perform 1
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  where ci.cart_id = v_cart
  order by v.id
  for update of v;

  select coalesce(sum(v.price_mnt * ci.quantity), 0), count(*)
    into v_subtotal, v_lines
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  if v_lines = 0 then
    raise exception 'cart is empty' using errcode = 'P0002';
  end if;

  if place_order.discount_code is not null then
    select * into v_code from public.discount_codes
     where code = place_order.discount_code::citext
       and is_active
       and (starts_at is null or starts_at <= now())
       and (ends_at   is null or ends_at   >= now())
       and (usage_limit is null or times_used < usage_limit)
       and min_subtotal_mnt <= v_subtotal;
    if not found then
      raise exception 'discount code not valid' using errcode = '22023';
    end if;
    v_discount := public.compute_discount_mnt(v_code.id, v_subtotal, v_delivery.fee_mnt);
  end if;

  insert into public.orders (
    profile_id, email, phone,
    subtotal_mnt, discount_mnt, delivery_mnt, total_mnt,
    discount_code_id, delivery_method_id, shipping_address, customer_note
  ) values (
    v_uid, v_email, v_phone,
    v_subtotal,
    v_discount,
    v_delivery.fee_mnt,
    greatest(v_subtotal - v_discount, 0)
      + case when v_code.kind = 'free_delivery' then 0 else v_delivery.fee_mnt end,
    v_code.id, v_delivery.id, to_jsonb(v_addr), place_order.customer_note
  ) returning * into v_order;

  -- Snapshot every line so the order stays readable after the catalog changes.
  insert into public.order_items (
    order_id, variant_id, product_id, product_title, variant_label,
    sku, image_path, unit_price_mnt, quantity
  )
  select
    v_order.id, v.id, p.id,
    coalesce(pt.title, 'Unknown'),
    case when v.option_label is null then null
         else v.option_label || ': ' || v.option_value end,
    v.sku::text,
    (select pi.file_path from public.product_images pi
      where pi.product_id = p.id order by pi.position limit 1),
    v.price_mnt, ci.quantity
  from public.cart_items ci
  join public.variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id
  left join public.product_translations pt
         on pt.product_id = p.id and pt.locale = 'mn'
  where ci.cart_id = v_cart and v.is_active and p.status = 'active';

  insert into public.payments (order_id, provider, status, amount_mnt)
  values (v_order.id, 'bank_transfer', 'unpaid', v_order.total_mnt);

  if v_code.id is not null then
    update public.discount_codes set times_used = times_used + 1 where id = v_code.id;
  end if;

  update public.carts set status = 'converted' where id = v_cart;

  return v_order;
end;
$$;

-- Customer marks that they have sent the bank transfer. Does not move money or
-- stock; it only puts the order into the owner's confirmation queue.
create or replace function public.submit_payment_proof(
  order_id uuid, external_reference text default null, payer_note text default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  update public.payments p
     set status = 'submitted',
         external_reference = coalesce(submit_payment_proof.external_reference, p.external_reference),
         payer_note = coalesce(submit_payment_proof.payer_note, p.payer_note),
         updated_at = now()
   where p.order_id = submit_payment_proof.order_id
     and exists (
       select 1 from public.orders o
       where o.id = p.order_id and o.profile_id = auth.uid()
     );

  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  update public.orders set payment_status = 'submitted'
   where id = submit_payment_proof.order_id
  returning * into v_order;
  return v_order;
end;
$$;

-- ADMIN. Confirms funds received, then performs the authoritative stock
-- decrement.
--
-- Because stock was never reserved, two customers can both pay for the last
-- unit. That is an accepted trade-off — but it must fail LOUDLY. Every line is
-- decremented conditionally (`where quantity >= n`); if any line cannot be
-- satisfied the whole decrement is abandoned and the order is flagged
-- `oversold` for the owner to refund, rather than silently shipping something
-- that does not exist.
create or replace function public.confirm_payment(
  order_id uuid, external_reference text default null, amount_mnt bigint default null
) returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  public.orders;
  v_item   record;
  v_short  boolean := false;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = confirm_payment.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if v_order.payment_status = 'confirmed' then
    return v_order;  -- idempotent: never decrement stock twice
  end if;

  -- Lock every variant on the order in id order before checking anything.
  perform 1 from public.variants v
   where v.id in (select oi.variant_id from public.order_items oi
                   where oi.order_id = v_order.id and oi.variant_id is not null)
   order by v.id
   for update;

  for v_item in
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  loop
    if not exists (
      select 1 from public.variants v
      where v.id = v_item.variant_id
        and (v.allow_backorder or v.quantity >= v_item.qty)
    ) then
      v_short := true;
      exit;
    end if;
  end loop;

  if v_short then
    -- The money genuinely arrived — the owner only pressed confirm because it
    -- did. Record the payment as confirmed so the refund has a record to work
    -- from, and flag the ORDER as unfulfillable. Recording it as still unpaid
    -- would lose the fact that funds are sitting in the account.
    update public.payments
       set status = 'confirmed',
           confirmed_by = auth.uid(),
           confirmed_at = now(),
           external_reference = coalesce(confirm_payment.external_reference, payments.external_reference),
           amount_mnt = coalesce(confirm_payment.amount_mnt, payments.amount_mnt),
           updated_at = now()
     where payments.order_id = v_order.id;

    update public.orders
       set status = 'oversold',
           payment_status = 'confirmed',
           paid_at = now(),
           internal_note =
             coalesce(internal_note || E'\n', '') ||
             '[' || now()::text || '] Payment confirmed but stock insufficient. Refund or restock.'
     where id = v_order.id
    returning * into v_order;
    return v_order;
  end if;

  update public.variants v
     set quantity = v.quantity - agg.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = v_order.id and oi.variant_id is not null
    group by oi.variant_id
  ) agg
  where v.id = agg.variant_id and not v.allow_backorder;

  update public.payments
     set status = 'confirmed',
         confirmed_by = auth.uid(),
         confirmed_at = now(),
         external_reference = coalesce(confirm_payment.external_reference, payments.external_reference),
         amount_mnt = coalesce(confirm_payment.amount_mnt, payments.amount_mnt),
         updated_at = now()
   where payments.order_id = v_order.id;

  update public.orders
     set status = 'paid', payment_status = 'confirmed', paid_at = now()
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- Cancelling a paid order returns its stock. Cancelling an unpaid one does not,
-- because nothing was ever taken.
create or replace function public.cancel_order(order_id uuid, reason text default null)
returns public.orders
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = cancel_order.order_id for update;
  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or v_order.profile_id = auth.uid()) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if v_order.status in ('shipped', 'delivered', 'refunded', 'cancelled') then
    raise exception 'order can no longer be cancelled' using errcode = '22023';
  end if;

  if v_order.payment_status = 'confirmed' then
    update public.variants v
       set quantity = v.quantity + agg.qty
    from (
      select oi.variant_id, sum(oi.quantity) as qty
      from public.order_items oi
      where oi.order_id = v_order.id and oi.variant_id is not null
      group by oi.variant_id
    ) agg
    where v.id = agg.variant_id and not v.allow_backorder;
  end if;

  update public.orders
     set status = 'cancelled',
         cancelled_at = now(),
         internal_note = coalesce(internal_note || E'\n', '') ||
           '[' || now()::text || '] Cancelled: ' || coalesce(reason, 'no reason given')
   where id = v_order.id
  returning * into v_order;
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------

create or replace function public.toggle_wishlist(product_id uuid)
returns boolean
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_deleted int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from public.wishlist_items w
   where w.profile_id = auth.uid() and w.product_id = toggle_wishlist.product_id;
  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    return false;
  end if;

  insert into public.wishlist_items (profile_id, product_id)
  values (auth.uid(), toggle_wishlist.product_id);
  return true;
end;
$$;

-- Reviews start unapproved. is_verified_purchase is derived from the order
-- history, never accepted from the client.
create or replace function public.submit_review(
  product_id uuid, rating int, title text default null, body text default null
) returns public.reviews
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_verified boolean;
  v_order    uuid;
  v_review   public.reviews;
begin
  if auth.uid() is null or public.is_anonymous_user() then
    raise exception 'account required to review' using errcode = '42501';
  end if;

  select o.id into v_order
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.profile_id = auth.uid()
    and oi.product_id = submit_review.product_id
    and o.status in ('paid', 'packed', 'shipped', 'delivered')
  limit 1;
  v_verified := v_order is not null;

  insert into public.reviews (product_id, profile_id, order_id, rating, title, body, is_verified_purchase)
  values (submit_review.product_id, auth.uid(), v_order, submit_review.rating,
          submit_review.title, submit_review.body, v_verified)
  on conflict on constraint reviews_product_profile_key do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        is_approved = false,      -- an edited review is re-moderated
        updated_at = now()
  returning * into v_review;

  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search (Query field: `stable` -> pg_graphql puts it on Query as a Connection)
-- ---------------------------------------------------------------------------
-- Postgres ships no Mongolian dictionary, so this is tokenisation plus trigram
-- similarity, not linguistic search. Suffixed forms will not always match.
create or replace function public.search_products(term text)
returns setof public.products
stable
language sql
set search_path = public, pg_temp
as $$
  select p.*
  from public.products p
  join public.product_translations pt
    on pt.product_id = p.id and pt.locale = 'mn'
  where p.status = 'active'
    and (
      pt.search_vector @@ plainto_tsquery('simple'::regconfig, term)
      or pt.title ilike '%' || term || '%'
      or similarity(pt.title, term) > 0.2
    )
  order by
    similarity(pt.title, term) desc,
    p.position;
$$;
