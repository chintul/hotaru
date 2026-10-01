-- Category create/edit for the admin. Same contract as admin_upsert_product:
-- SECURITY DEFINER, is_admin() inside, every column and parameter qualified.
-- A new slug that already exists raises 23505 instead of overwriting.

create or replace function public.admin_upsert_category(
  slug text,
  name text,
  description text default null,
  parent_slug text default null,
  is_visible boolean default true,
  sort_order int default 0,
  category_id uuid default null
) returns public.categories
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent   uuid;
  v_category public.categories;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if coalesce(trim(admin_upsert_category.name), '') = '' then
    raise exception 'name is required' using errcode = '22023';
  end if;
  if coalesce(trim(admin_upsert_category.slug), '') = '' then
    raise exception 'slug is required' using errcode = '22023';
  end if;

  if nullif(admin_upsert_category.parent_slug, '') is not null then
    select c.id into v_parent from public.categories c
     where c.slug = admin_upsert_category.parent_slug::citext;
    if not found then
      raise exception 'parent category not found' using errcode = 'P0002';
    end if;
    if v_parent = admin_upsert_category.category_id then
      raise exception 'a category cannot be its own parent' using errcode = '22023';
    end if;
  end if;

  if admin_upsert_category.category_id is not null then
    update public.categories c set
      slug = admin_upsert_category.slug::citext,
      parent_id = v_parent,
      is_visible = admin_upsert_category.is_visible,
      position = admin_upsert_category.sort_order
    where c.id = admin_upsert_category.category_id
    returning * into v_category;
    if not found then
      raise exception 'category not found' using errcode = 'P0002';
    end if;
  else
    insert into public.categories (slug, parent_id, is_visible, position)
    values (
      admin_upsert_category.slug::citext, v_parent,
      admin_upsert_category.is_visible, admin_upsert_category.sort_order
    )
    returning * into v_category;
  end if;

  insert into public.category_translations (category_id, locale, name, description)
  values (
    v_category.id, 'mn', trim(admin_upsert_category.name),
    nullif(trim(admin_upsert_category.description), '')
  )
  on conflict on constraint category_translations_category_id_locale_key do update set
    name = excluded.name,
    description = excluded.description;

  return v_category;
end;
$$;

revoke execute on function
  public.admin_upsert_category(text, text, text, text, boolean, int, uuid)
from public, anon;

grant execute on function
  public.admin_upsert_category(text, text, text, text, boolean, int, uuid)
to authenticated;
