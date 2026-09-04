-- ============================================================================
-- hotaru — 02. Tables
-- All money is BIGINT whole MNT. See migration 01.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           citext,
  phone           text,
  full_name       text,
  role            public.user_role not null default 'customer',
  marketing_opt_in boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user, including anonymous ones. Anonymous rows carry no email until the user converts at checkout; the id never changes on conversion, so carts survive.';

-- Mongolian delivery address. Deliberately NOT line1/line2/city/postal_code:
-- postal codes are unused in practice and a real UB address is
-- district -> khoroo -> building -> entrance -> apartment, plus a landmark
-- and a phone the courier will actually ring.
create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  label          text,                       -- 'Гэр', 'Оффис'
  recipient_name text not null,
  phone          text not null,
  city_aimag     text not null,              -- Улаанбаатар / Дархан-Уул / ...
  district_sum   text not null,              -- Сүхбаатар дүүрэг / сум
  khoroo_bag     text,                       -- 8-р хороо / баг
  building       text,                       -- байр / гудамж
  entrance       text,                       -- орц
  apartment      text,                       -- тоот
  landmark_note  text,                       -- 'Улаан хаалганы урд'
  latitude       double precision,
  longitude      double precision,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index addresses_profile_idx on public.addresses (profile_id);
-- At most one default address per customer.
create unique index addresses_one_default_idx
  on public.addresses (profile_id) where is_default;

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.categories(id) on delete set null,
  slug        citext not null unique,
  position    integer not null default 0,
  is_visible  boolean not null default true,
  image_path  text,                          -- ImageKit file path
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.category_translations (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  locale      text not null default 'mn',
  name        text not null,
  description text,
  unique (category_id, locale)
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references public.categories(id) on delete set null,
  slug         citext not null unique,
  status       public.product_status not null default 'draft',
  is_featured  boolean not null default false,
  position     integer not null default 0,
  tags         text[] not null default '{}',
  published_at timestamptz,

  -- DERIVED COLUMNS — maintained by triggers, never written by hand.
  -- Denormalised onto products so the catalog grid can filter and sort on
  -- price / stock / rating without a join, and so pg_graphql exposes them as
  -- ordinary filterable fields rather than requiring a nested collection.
  min_price_mnt bigint,
  max_price_mnt bigint,
  in_stock      boolean not null default false,
  rating_avg    numeric(2,1),
  rating_count  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index products_status_idx   on public.products (status) where status = 'active';
create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (is_featured) where is_featured;
create index products_tags_idx     on public.products using gin (tags);
create index products_price_idx    on public.products (min_price_mnt);
create index products_in_stock_idx on public.products (in_stock) where in_stock;

comment on table public.products is
  'Catalog item. All human-readable copy lives in product_translations. Invariant: every product has at least one variant (see admin_upsert_product).';

-- Translatable copy. Only 'mn' rows exist today; adding English later is an
-- INSERT, not an ALTER.
create table public.product_translations (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  locale          text not null default 'mn',
  title           text not null,
  subtitle        text,
  description     text,
  care_details    text,
  seo_title       text,
  seo_description text,
  -- 'simple' config, NOT 'english': Postgres has no Mongolian stemmer, so this
  -- is tokenisation only. Suffixed word forms will not match; pg_trgm below
  -- covers substring queries. Do not "upgrade" this to 'english'.
  search_vector tsvector generated always as (
      setweight(to_tsvector('simple'::regconfig, coalesce(title, '')),       'A')
   || setweight(to_tsvector('simple'::regconfig, coalesce(subtitle, '')),    'B')
   || setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  unique (product_id, locale)
);

create index product_translations_search_idx on public.product_translations using gin (search_vector);
create index product_translations_title_trgm_idx on public.product_translations using gin (title gin_trgm_ops);

create table public.product_images (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products(id) on delete cascade,
  imagekit_file_id  text not null,   -- needed to delete the asset at ImageKit
  file_path         text not null,   -- transformations are built from the path
  alt               text,
  width             integer,
  height            integer,
  position          integer not null default 0,
  created_at        timestamptz not null default now()
);

-- position 0 = primary grid image, position 1 = hover-swap image.
create unique index product_images_position_idx on public.product_images (product_id, position);

comment on column public.product_images.position is
  '0 = primary card image, 1 = hover-swap image, 2+ = gallery.';

-- Single optional variant axis. Most products have exactly one variant and the
-- PDP renders no selector; option_label/option_value are null in that case.
create table public.variants (
  id                    uuid primary key default gen_random_uuid(),
  product_id            uuid not null references public.products(id) on delete cascade,
  sku                   citext unique,
  option_label          text,     -- 'Урт' / 'Хэмжээ'
  option_value          text,     -- '45cm'
  price_mnt             bigint not null check (price_mnt >= 0),
  compare_at_price_mnt  bigint check (compare_at_price_mnt is null or compare_at_price_mnt > price_mnt),
  quantity              integer not null default 0 check (quantity >= 0),
  allow_backorder       boolean not null default false,
  weight_grams          integer,
  image_id              uuid references public.product_images(id) on delete set null,
  position              integer not null default 0,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- An axis is all-or-nothing: label without value (or vice versa) is a bug.
  constraint variants_option_pair_ck check (
    (option_label is null and option_value is null)
    or (option_label is not null and option_value is not null)
  ),
  unique (product_id, option_value)
);

create index variants_product_idx on public.variants (product_id);
-- A product may hold at most ONE option-less (default) variant. Without this,
-- NULL-distinctness in the unique constraint above lets duplicates through.
create unique index variants_single_default_idx
  on public.variants (product_id) where option_value is null;

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------

create table public.carts (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'converted', 'abandoned')),
  -- Single-use handoff token. Minted by the anonymous session that owns this
  -- cart, redeemed once by the real account it is being handed to. Exists so
  -- cart transfer never has to trust a caller-supplied profile id.
  transfer_token            uuid,
  transfer_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index carts_transfer_token_idx
  on public.carts (transfer_token) where transfer_token is not null;

-- Exactly one open cart per customer.
create unique index carts_one_open_per_profile_idx
  on public.carts (profile_id) where status = 'open';

create table public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.variants(id) on delete cascade,
  quantity   integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_variant_key unique (cart_id, variant_id)
);

comment on table public.cart_items is
  'No price column by design. Cart lines are always re-priced from variants at read and at checkout, so a price change never leaves a stale amount in a cart.';

-- ---------------------------------------------------------------------------
-- Delivery & discounts
-- ---------------------------------------------------------------------------

create table public.delivery_methods (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  kind       public.delivery_kind not null,
  fee_mnt    bigint not null default 0 check (fee_mnt >= 0),
  note       text,
  is_active  boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.discount_codes (
  id               uuid primary key default gen_random_uuid(),
  code             citext not null unique,
  kind             public.discount_kind not null,
  value            numeric(12,2) not null default 0 check (value >= 0),
  min_subtotal_mnt bigint not null default 0 check (min_subtotal_mnt >= 0),
  starts_at        timestamptz,
  ends_at          timestamptz,
  usage_limit      integer check (usage_limit is null or usage_limit > 0),
  times_used       integer not null default 0 check (times_used >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on column public.discount_codes.value is
  'percentage -> 0..100. fixed_amount -> whole MNT. free_delivery -> ignored.';

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create sequence public.order_number_seq start with 1001;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique
                       default 'HTR-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
  profile_id         uuid references public.profiles(id) on delete set null,
  email              citext not null,
  phone              text not null,
  status             public.order_status not null default 'awaiting_payment',
  payment_status     public.payment_status not null default 'unpaid',

  subtotal_mnt       bigint not null check (subtotal_mnt >= 0),
  discount_mnt       bigint not null default 0 check (discount_mnt >= 0),
  delivery_mnt       bigint not null default 0 check (delivery_mnt >= 0),
  total_mnt          bigint not null check (total_mnt >= 0),

  discount_code_id   uuid references public.discount_codes(id) on delete set null,
  delivery_method_id uuid references public.delivery_methods(id) on delete set null,

  -- Snapshot, not a reference. Editing a saved address must never rewrite where
  -- a past order was shipped.
  shipping_address   jsonb not null,

  customer_note      text,
  internal_note      text,
  tracking_number    text,

  placed_at          timestamptz not null default now(),
  paid_at            timestamptz,
  shipped_at         timestamptz,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index orders_profile_idx on public.orders (profile_id, placed_at desc);
create index orders_status_idx  on public.orders (status, placed_at desc);
-- The owner's working queue.
create index orders_pending_idx on public.orders (placed_at)
  where status = 'awaiting_payment';

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  variant_id     uuid references public.variants(id) on delete set null,
  product_id     uuid references public.products(id) on delete set null,
  -- Snapshots: an order line must stay readable after the product is renamed,
  -- re-priced, or deleted.
  product_title  text not null,
  variant_label  text,
  sku            text,
  image_path     text,
  unit_price_mnt bigint not null check (unit_price_mnt >= 0),
  quantity       integer not null check (quantity > 0),
  line_total_mnt bigint generated always as (unit_price_mnt * quantity) stored
);

create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  -- 'bank_transfer' today; 'qpay' / 'card' slot in here with no schema change.
  provider           text not null default 'bank_transfer',
  status             public.payment_status not null default 'unpaid',
  amount_mnt         bigint not null check (amount_mnt >= 0),
  external_reference text,     -- bank txn id / QPay invoice id
  payer_note         text,     -- what the customer typed on the transfer
  raw_payload        jsonb,    -- untouched provider callback, for audit
  confirmed_by       uuid references public.profiles(id) on delete set null,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index payments_order_idx on public.payments (order_id);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------

create table public.wishlist_items (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products(id) on delete cascade,
  profile_id           uuid not null references public.profiles(id) on delete cascade,
  order_id             uuid references public.orders(id) on delete set null,
  rating               integer not null check (rating between 1 and 5),
  title                text,
  body                 text,
  is_verified_purchase boolean not null default false,
  is_approved          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- One review per customer per product.
  constraint reviews_product_profile_key unique (product_id, profile_id)
);

create index reviews_product_approved_idx on public.reviews (product_id) where is_approved;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','addresses','categories','products','variants','carts','cart_items',
    'discount_codes','orders','payments','reviews','delivery_methods'
  ] loop
    execute format(
      'create trigger %I_set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
