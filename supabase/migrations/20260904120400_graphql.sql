-- ============================================================================
-- hotaru — 05. pg_graphql comment directives
-- ============================================================================
-- These comments ARE the GraphQL schema definition. pg_graphql reflects the
-- Postgres catalog at request time; there is no SDL file to deploy and no
-- resolver layer to write. What is below controls the names the client sees.
--
--   inflect_names  snake_case -> camelCase fields, PascalCase types
--   name           overrides the type name (tables are plural, types are not)
--   totalCount     opts a collection into a totalCount field (off by default,
--                  because it costs a second count query per request)
-- ============================================================================

comment on schema public is e'@graphql({"inflect_names": true})';

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

comment on table public.products is e'@graphql({"name": "Product", "totalCount": {"enabled": true}, "description": "A catalog item. Copy lives in productTranslationCollection; price and stock live on variantCollection."})';
comment on table public.product_translations is e'@graphql({"name": "ProductTranslation", "description": "Locale-specific copy. Only mn rows exist today."})';
comment on table public.product_images  is e'@graphql({"name": "ProductImage", "description": "ImageKit asset. position 0 is the card image, position 1 the hover-swap image."})';
comment on table public.variants        is e'@graphql({"name": "Variant", "description": "The sellable unit. Products with a single option-less variant render no selector."})';
comment on table public.categories      is e'@graphql({"name": "Category"})';
comment on table public.category_translations is e'@graphql({"name": "CategoryTranslation"})';

comment on column public.variants.price_mnt is
  e'@graphql({"description": "Price in WHOLE Mongolian tugrik. Not a minor unit. Never divide by 100."})';
comment on column public.products.min_price_mnt is
  e'@graphql({"description": "Lowest active variant price, in whole MNT. Derived — maintained by trigger."})';
comment on column public.products.in_stock is
  e'@graphql({"description": "True when any active variant has stock or allows backorder. Derived."})';

-- ---------------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------------

comment on table public.carts      is e'@graphql({"name": "Cart"})';
comment on table public.cart_items is e'@graphql({"name": "CartItem", "description": "Holds no price. Lines are re-priced from the catalog on every read and at checkout."})';
comment on table public.orders     is e'@graphql({"name": "Order", "totalCount": {"enabled": true}})';
comment on table public.order_items is e'@graphql({"name": "OrderItem", "description": "Snapshot of what was bought. Stays readable after the product changes or is deleted."})';
comment on table public.payments   is e'@graphql({"name": "Payment", "description": "One row per order. provider is bank_transfer today; qpay/card slot in unchanged."})';
comment on table public.delivery_methods is e'@graphql({"name": "DeliveryMethod"})';
comment on table public.discount_codes   is e'@graphql({"name": "DiscountCode"})';

comment on column public.orders.shipping_address is
  e'@graphql({"description": "Frozen copy of the address at order time. Editing the saved address never rewrites this."})';

-- ---------------------------------------------------------------------------
-- Customer
-- ---------------------------------------------------------------------------

comment on table public.profiles       is e'@graphql({"name": "Profile"})';
comment on table public.addresses      is e'@graphql({"name": "Address", "description": "Mongolian address shape: city/aimag, district/sum, khoroo/bag, building, entrance, apartment."})';
comment on table public.wishlist_items is e'@graphql({"name": "WishlistItem"})';
comment on table public.reviews        is e'@graphql({"name": "Review", "totalCount": {"enabled": true}})';

-- ---------------------------------------------------------------------------
-- Function-backed fields
-- ---------------------------------------------------------------------------
-- Volatility decides placement: volatile -> Mutation, stable/immutable -> Query.
-- Arguments without a SQL default become non-null in GraphQL.

comment on function public.search_products(text) is
  e'@graphql({"description": "Full-text + trigram product search. Tokenisation only — Postgres has no Mongolian stemmer, so suffixed forms may not match."})';
comment on function public.place_order(uuid, uuid, text, text) is
  e'@graphql({"description": "Creates an order from the caller''s cart. All amounts are computed server-side from the catalog."})';
comment on function public.confirm_payment(uuid, text, bigint) is
  e'@graphql({"description": "Admin only. Confirms funds and performs the authoritative stock decrement. Idempotent."})';
