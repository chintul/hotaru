-- ============================================================================
-- hotaru — SEO copy reaches the write path
-- ============================================================================
-- product_translations.seo_title / .seo_description have existed since the
-- first migration and are read by the storefront, but admin_upsert_product
-- never wrote them — the only values in the table came from a one-off data fix
-- (20260905150000_seo_title_no_brand.sql). The admin SEO tab needs a way in.
--
-- The old signature is DROPPED, not replaced. Adding parameters to a function
-- creates an overload rather than replacing it, and two overloads of the same
-- name make pg_graphql's reflection ambiguous. The drop also discards the
-- function's grants, so both halves are restored at the bottom.
-- ============================================================================

drop function if exists public.admin_upsert_product(
  text, text, text, text, text, text, text, boolean, int, uuid);

create function public.admin_upsert_product(
  slug text,
  title text,
  category_slug text default null,
  subtitle text default null,
  description text default null,
  care_details text default null,
  status text default 'draft',
  is_featured boolean default false,
  sort_order int default 0,
  product_id uuid default null,
  seo_title text default null,
  seo_description text default null
) returns public.products
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category uuid;
  v_product  public.products;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if coalesce(trim(admin_upsert_product.title), '') = '' then
    raise exception 'title is required' using errcode = '22023';
  end if;

  select c.id into v_category from public.categories c
   where c.slug = admin_upsert_product.category_slug::citext;

  if admin_upsert_product.product_id is not null then
    update public.products p set
      slug = admin_upsert_product.slug::citext,
      category_id = v_category,
      status = admin_upsert_product.status::public.product_status,
      is_featured = admin_upsert_product.is_featured,
      position = admin_upsert_product.sort_order,
      published_at = case
        when admin_upsert_product.status = 'active' then coalesce(p.published_at, now())
        else p.published_at end
    where p.id = admin_upsert_product.product_id
    returning * into v_product;
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
  else
    insert into public.products (slug, category_id, status, is_featured, position, published_at)
    values (
      admin_upsert_product.slug::citext, v_category,
      admin_upsert_product.status::public.product_status,
      admin_upsert_product.is_featured, admin_upsert_product.sort_order,
      case when admin_upsert_product.status = 'active' then now() end
    )
    on conflict on constraint products_slug_key do update set
      category_id = excluded.category_id,
      status = excluded.status,
      is_featured = excluded.is_featured,
      position = excluded.position
    returning * into v_product;
  end if;

  insert into public.product_translations
    (product_id, locale, title, subtitle, description, care_details, seo_title, seo_description)
  values (
    v_product.id, 'mn', admin_upsert_product.title, admin_upsert_product.subtitle,
    admin_upsert_product.description, admin_upsert_product.care_details,
    admin_upsert_product.seo_title, admin_upsert_product.seo_description
  )
  on conflict on constraint product_translations_product_id_locale_key do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    description = excluded.description,
    care_details = excluded.care_details,
    -- null means "not supplied by this caller", not "clear it". The details tab
    -- saves without the SEO args and must not wipe what the SEO tab wrote.
    seo_title = coalesce(excluded.seo_title, product_translations.seo_title),
    seo_description = coalesce(excluded.seo_description, product_translations.seo_description);

  perform public.refresh_product_derived(v_product.id);
  return v_product;
end;
$$;

-- Dropping the old signature threw away its grants, and the new function
-- arrives with EXECUTE granted to PUBLIC (which anon inherits). Both halves
-- have to be restored or tests/sql/02_guards.sql fails — it asserts that no
-- unreviewed SECURITY DEFINER function is anon-executable.
revoke execute on function
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid, text, text)
from public, anon;

grant execute on function
  public.admin_upsert_product(text, text, text, text, text, text, text, boolean, int, uuid, text, text)
to authenticated;

comment on function public.admin_upsert_product is
  'Creates or updates a product AND its Mongolian copy in one call. Null SEO args leave stored SEO copy untouched.';
