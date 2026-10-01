-- Reviews publish on submit. The owner's moderation becomes "hide": a review
-- the owner hid stays hidden when its author edits it, so editing is not a way
-- around a takedown. Reviews already waiting in the queue are published.

alter table public.reviews alter column is_approved set default true;

update public.reviews r set is_approved = true where not r.is_approved;

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

  insert into public.reviews (product_id, profile_id, order_id, rating, title, body, is_verified_purchase, is_approved)
  values (submit_review.product_id, auth.uid(), v_order, submit_review.rating,
          submit_review.title, submit_review.body, v_verified, true)
  on conflict on constraint reviews_product_profile_key do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        updated_at = now()
  returning * into v_review;

  return v_review;
end;
$$;
