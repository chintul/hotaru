-- Shop analytics that only the database can answer. Traffic, product views,
-- the visit funnel and visit hours live in PostHog (decision 20); stock, sales,
-- carts and order stages are reported here by admin_analytics.
--
-- Stock "below half" is measured against variants.stock_baseline: the level
-- the stock was last raised to. Sales lower the quantity, never the baseline.

-- ---------------------------------------------------------------------------
-- 1. Stock baseline
-- ---------------------------------------------------------------------------
alter table public.variants add column if not exists stock_baseline integer check (stock_baseline >= 0);

update public.variants v set stock_baseline = v.quantity where v.stock_baseline is null;

create or replace function public.tg_variants_stock_baseline()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.stock_baseline := coalesce(new.stock_baseline, new.quantity);
  elsif new.quantity > old.quantity then
    new.stock_baseline := new.quantity;
  end if;
  return new;
end;
$$;

drop trigger if exists variants_stock_baseline on public.variants;
create trigger variants_stock_baseline
  before insert or update of quantity on public.variants
  for each row execute function public.tg_variants_stock_baseline();

-- ---------------------------------------------------------------------------
-- 2. The report
-- ---------------------------------------------------------------------------
-- Hours and days are in Ulaanbaatar time. A sale is an order placed in the
-- window that is neither cancelled nor still waiting for its first payment.
create or replace function public.admin_analytics(since timestamptz, until timestamptz default now())
returns jsonb
stable
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz constant text := 'Asia/Ulaanbaatar';
  v_report jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  with
  sold_orders as (
    select o.* from public.orders o
     where o.placed_at >= admin_analytics.since and o.placed_at < admin_analytics.until
       and o.status not in ('cancelled', 'awaiting_payment')
  ),
  sold_lines as (
    select oi.product_id, oi.quantity, oi.line_total_mnt
      from public.order_items oi join sold_orders so on so.id = oi.order_id
  ),
  product_stats as (
    select p.id, p.slug, coalesce(pt.title, p.slug) as title, p.category_id,
           coalesce((select sum(sl.quantity) from sold_lines sl where sl.product_id = p.id), 0) as units,
           coalesce((select sum(sl.line_total_mnt) from sold_lines sl where sl.product_id = p.id), 0) as revenue
      from public.products p
      left join public.product_translations pt on pt.product_id = p.id and pt.locale = 'mn'
     where p.status = 'active'
  ),
  window_carts as (
    select c.*,
           (select coalesce(sum(ci.quantity * v.price_mnt), 0)
              from public.cart_items ci join public.variants v on v.id = ci.variant_id
             where ci.cart_id = c.id) as value_mnt,
           exists (select 1 from public.cart_items ci where ci.cart_id = c.id) as has_items
      from public.carts c
     where c.created_at >= admin_analytics.since and c.created_at < admin_analytics.until
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'orders',        (select count(*) from sold_orders),
      'revenue_mnt',   (select coalesce(sum(so.total_mnt), 0) from sold_orders so),
      'avg_order_mnt', (select coalesce(round(avg(so.total_mnt)), 0) from sold_orders so)
    ),
    'by_day', (
      select jsonb_agg(jsonb_build_object('day', d::date, 'orders', coalesce(o.orders, 0), 'revenue_mnt', coalesce(o.revenue, 0)) order by d)
        from generate_series(
          (admin_analytics.since at time zone v_tz)::date,
          ((admin_analytics.until - interval '1 second') at time zone v_tz)::date,
          interval '1 day') d
        left join (
          select (so.placed_at at time zone v_tz)::date as day, count(*) as orders, sum(so.total_mnt) as revenue
            from sold_orders so group by 1
        ) o on o.day = d::date
    ),
    'top_products', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.units desc, t.revenue_mnt desc), '[]'::jsonb)
        from (select ps.slug, ps.title, ps.units, ps.revenue as revenue_mnt
                from product_stats ps
               where ps.units > 0
               order by ps.units desc, ps.revenue desc
               limit 20) t
    ),
    'categories', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.units desc, t.revenue_mnt desc), '[]'::jsonb)
        from (select coalesce(c.slug::text, '') as slug,
                     coalesce(ct.name, 'Ангилалгүй') as name,
                     sum(ps.units)::bigint as units, sum(ps.revenue)::bigint as revenue_mnt
                from product_stats ps
                left join public.categories c on c.id = ps.category_id
                left join public.category_translations ct on ct.category_id = c.id and ct.locale = 'mn'
               group by c.slug, ct.name) t
    ),
    'stock_low', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.ratio), '[]'::jsonb)
        from (select p.slug, coalesce(pt.title, p.slug) as title,
                     public._variant_label(v.option_label, v.option_value, v.size) as variant,
                     v.quantity, v.stock_baseline as baseline,
                     round(v.quantity::numeric / v.stock_baseline, 2) as ratio
                from public.variants v
                join public.products p on p.id = v.product_id and p.status = 'active'
                left join public.product_translations pt on pt.product_id = p.id and pt.locale = 'mn'
               where v.is_active and v.quantity > 0 and v.stock_baseline > 0
                 and v.quantity * 2 < v.stock_baseline) t
    ),
    'stock_out', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.title), '[]'::jsonb)
        from (select p.slug, coalesce(pt.title, p.slug) as title,
                     public._variant_label(v.option_label, v.option_value, v.size) as variant,
                     v.allow_backorder as preorder
                from public.variants v
                join public.products p on p.id = v.product_id and p.status = 'active'
                left join public.product_translations pt on pt.product_id = p.id and pt.locale = 'mn'
               where v.is_active and v.quantity = 0) t
    ),
    'carts', jsonb_build_object(
      'created',   (select count(*) from window_carts wc where wc.has_items or wc.status = 'converted'),
      'converted', (select count(*) from window_carts wc where wc.status = 'converted'),
      'abandoned', (select count(*) from window_carts wc
                     where wc.status <> 'converted' and wc.has_items and wc.updated_at < now() - interval '24 hours'),
      'active',    (select count(*) from window_carts wc
                     where wc.status = 'open' and wc.has_items and wc.updated_at >= now() - interval '24 hours'),
      'abandoned_value_mnt', (select coalesce(sum(wc.value_mnt), 0) from window_carts wc
                     where wc.status <> 'converted' and wc.has_items and wc.updated_at < now() - interval '24 hours')
    ),
    'order_stages', (
      select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
        from (select o.status::text as status, count(*) as n
                from public.orders o
               where o.placed_at >= admin_analytics.since and o.placed_at < admin_analytics.until
               group by o.status) x
    )
  ) into v_report;

  return v_report;
end;
$$;

revoke all on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;
