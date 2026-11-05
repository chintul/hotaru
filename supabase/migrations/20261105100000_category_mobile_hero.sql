-- A portrait cover per category for phones. hero_image_path is a wide 3:1
-- banner; on a phone it shows only a narrow strip of the photo, so the home
-- carousel swaps to this one below the sm breakpoint when it is set.

alter table public.categories
  add column if not exists hero_mobile_image_path text
  check (hero_mobile_image_path is null or btrim(hero_mobile_image_path) <> '');

comment on column public.categories.hero_mobile_image_path is
  'ImageKit file path for this category''s phone hero (4:5). Null falls back to hero_image_path.';

create or replace function public.admin_set_category_mobile_hero_image(
  category_id uuid,
  hero_mobile_image_path text default null
) returns public.categories
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_category public.categories;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  update public.categories c
     set hero_mobile_image_path = nullif(btrim(admin_set_category_mobile_hero_image.hero_mobile_image_path), '')
   where c.id = admin_set_category_mobile_hero_image.category_id
  returning * into v_category;
  if not found then
    raise exception 'category not found' using errcode = 'P0002';
  end if;
  return v_category;
end;
$$;

revoke execute on function public.admin_set_category_mobile_hero_image(uuid, text) from public, anon;
grant execute on function public.admin_set_category_mobile_hero_image(uuid, text) to authenticated;

comment on function public.admin_set_category_mobile_hero_image is
  'Sets or, with a null path, clears a category''s phone hero cover.';
