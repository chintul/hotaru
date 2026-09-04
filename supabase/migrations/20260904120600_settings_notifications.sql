-- ============================================================================
-- hotaru — 07. Store settings + notification outbox
-- ============================================================================
-- Bank details live in the DATABASE, not in environment variables, because the
-- owner must be able to change an account number from /admin without a
-- redeploy. Env vars stay for secrets only (API keys), which the owner never
-- edits and which must never reach the browser.
-- ============================================================================

-- Singleton: `id boolean primary key default true check (id)` permits exactly
-- one row, so there is no "which settings row is live" question ever.
create table public.store_settings (
  id boolean primary key default true check (id),

  -- Bank transfer instructions, shown to the customer after placing an order.
  bank_name             text,
  bank_account_number   text,
  bank_account_name     text,
  bank_swift            text,
  -- Free text under the account details, e.g. "Гүйлгээний утга дээр захиалгын
  -- дугаараа бичнэ үү". Kept editable so wording can change without a deploy.
  payment_instructions  text,
  -- How long the customer has to transfer before the owner chases or cancels.
  payment_deadline_hours integer not null default 24 check (payment_deadline_hours > 0),

  -- Notification routing. No API keys here — those are env-only.
  owner_alert_email     citext,
  email_from            text default 'hotaru <noreply@example.com>',
  email_reply_to        text,

  -- Storefront contact details, also used in email footers.
  store_email           citext,
  store_phone           text,
  store_address         text,

  updated_at timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

comment on table public.store_settings is
  'Single-row store configuration. Bank details are here rather than in env so the owner can edit them from /admin without a deploy.';

-- Seed the singleton with obvious placeholders. These MUST be replaced before
-- taking a real order — nothing in the code validates them, because a wrong
-- account number is indistinguishable from a right one to the database.
insert into public.store_settings (
  id, bank_name, bank_account_number, bank_account_name,
  payment_instructions, owner_alert_email, email_from, store_email
) values (
  true,
  'REPLACE_ME — Хаан банк / Голомт банк',
  'REPLACE_ME — 0000000000',
  'REPLACE_ME — account holder name',
  'Гүйлгээний утга дээр захиалгын дугаараа бичнэ үү.',
  'REPLACE_ME@example.com',
  'hotaru <noreply@example.com>',
  'REPLACE_ME@example.com'
) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Notification outbox
-- ---------------------------------------------------------------------------
-- Postgres does NOT call Resend directly. Triggers write a row here; a worker
-- (Vercel cron or an edge function, running as service_role) drains it.
--
-- Why an outbox rather than pg_net straight to the Resend API:
--   * the Resend key never has to be stored in the database
--   * a send that fails is retried instead of lost — with manual bank transfer
--     a missed owner alert is an unfulfilled paid order
--   * the whole path is testable today, with no credentials
--   * an email is never sent for a transaction that later rolls back, because
--     the row commits with the order

create type public.notification_kind as enum (
  'order_placed_customer',
  'order_placed_owner',
  'payment_submitted_owner',
  'payment_confirmed_customer',
  'order_oversold_owner',
  'order_shipped_customer',
  'order_cancelled_customer'
);

create table public.notification_outbox (
  id             uuid primary key default gen_random_uuid(),
  kind           public.notification_kind not null,
  order_id       uuid references public.orders(id) on delete cascade,
  recipient_email citext not null,
  -- Everything the template needs, snapshotted. The worker must not have to
  -- re-read the order, which may have changed by the time it sends.
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'pending'
                   check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts       integer not null default 0,
  last_error     text,
  provider_message_id text,
  scheduled_for  timestamptz not null default now(),
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index notification_outbox_pending_idx
  on public.notification_outbox (scheduled_for)
  where status = 'pending';

create index notification_outbox_order_idx on public.notification_outbox (order_id);

-- One notification per kind per order: makes the triggers idempotent, so a
-- retried status update cannot double-send.
create unique index notification_outbox_once_idx
  on public.notification_outbox (order_id, kind)
  where order_id is not null;

comment on table public.notification_outbox is
  'Queued emails. Written by triggers, drained by a service_role worker calling Resend. Never contains API keys.';

-- ---------------------------------------------------------------------------
-- Enqueue helpers
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_notification(
  p_kind public.notification_kind,
  p_order_id uuid,
  p_recipient citext,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_recipient is null or p_recipient = '' then
    return;  -- nothing to send to; not an error worth failing the order over
  end if;

  insert into public.notification_outbox (kind, order_id, recipient_email, payload)
  values (p_kind, p_order_id, p_recipient, p_payload)
  on conflict do nothing;   -- covered by notification_outbox_once_idx
end;
$$;

-- Snapshot of everything an email template needs for an order.
create or replace function public.order_notification_payload(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'status',       o.status,
    'total_mnt',    o.total_mnt,
    'subtotal_mnt', o.subtotal_mnt,
    'discount_mnt', o.discount_mnt,
    'delivery_mnt', o.delivery_mnt,
    'placed_at',    o.placed_at,
    'customer_email', o.email,
    'customer_phone', o.phone,
    'shipping_address', o.shipping_address,
    'delivery_method', (select name from public.delivery_methods where id = o.delivery_method_id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', oi.product_title,
        'variant', oi.variant_label,
        'quantity', oi.quantity,
        'unit_price_mnt', oi.unit_price_mnt,
        'line_total_mnt', oi.line_total_mnt
      ) order by oi.product_title)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    -- Bank details travel WITH the notification, so the email shows what was
    -- current when the order was placed even if the owner edits them later.
    'bank', (
      select jsonb_build_object(
        'bank_name', s.bank_name,
        'account_number', s.bank_account_number,
        'account_name', s.bank_account_name,
        'instructions', s.payment_instructions,
        'deadline_hours', s.payment_deadline_hours
      ) from public.store_settings s where s.id
    )
  )
  from public.orders o
  where o.id = p_order_id;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.tg_order_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner   citext;
  v_payload jsonb;
begin
  select owner_alert_email into v_owner from public.store_settings where id;
  v_payload := public.order_notification_payload(new.id);

  if tg_op = 'INSERT' then
    -- Customer gets the bank details; the owner gets told a sale is pending.
    perform public.enqueue_notification('order_placed_customer', new.id, new.email, v_payload);
    perform public.enqueue_notification('order_placed_owner',    new.id, v_owner,   v_payload);
    return null;
  end if;

  -- Customer says they have transferred: this is the owner's cue to check the
  -- bank. With manual transfer, missing this alert means an unshipped paid order.
  if new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    perform public.enqueue_notification('payment_submitted_owner', new.id, v_owner, v_payload);
  end if;

  -- Confirmed payment on an order we CANNOT fulfil must not tell the customer
  -- their payment went through — they would reasonably expect a shipment. An
  -- oversold order is a refund conversation, driven by the owner alert below.
  if new.payment_status = 'confirmed'
     and old.payment_status is distinct from 'confirmed'
     and new.status <> 'oversold' then
    perform public.enqueue_notification('payment_confirmed_customer', new.id, new.email, v_payload);
  end if;

  -- Money in, stock gone. Needs the owner immediately.
  if new.status = 'oversold' and old.status is distinct from 'oversold' then
    perform public.enqueue_notification('order_oversold_owner', new.id, v_owner, v_payload);
  end if;

  if new.status = 'shipped' and old.status is distinct from 'shipped' then
    perform public.enqueue_notification('order_shipped_customer', new.id, new.email,
      v_payload || jsonb_build_object('tracking_number', new.tracking_number));
  end if;

  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.enqueue_notification('order_cancelled_customer', new.id, new.email, v_payload);
  end if;

  return null;
end;
$$;

create trigger orders_notify_insert
  after insert on public.orders
  for each row execute function public.tg_order_notifications();

create trigger orders_notify_update
  after update on public.orders
  for each row execute function public.tg_order_notifications();

-- ---------------------------------------------------------------------------
-- Worker API (called by the drain job as service_role)
-- ---------------------------------------------------------------------------

-- Claims a batch atomically. SKIP LOCKED means two concurrent workers never
-- send the same email twice.
create or replace function public.claim_notifications(batch_size int default 10)
returns setof public.notification_outbox
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update public.notification_outbox o
     set status = 'sending', attempts = o.attempts + 1
   where o.id in (
     select id from public.notification_outbox
      where status = 'pending' and scheduled_for <= now()
      order by scheduled_for
      limit batch_size
      for update skip locked
   )
  returning o.*;
end;
$$;

create or replace function public.mark_notification_sent(
  notification_id uuid, provider_message_id text default null
) returns void
volatile
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_outbox
     set status = 'sent',
         sent_at = now(),
         provider_message_id = mark_notification_sent.provider_message_id,
         last_error = null
   where id = notification_id;
$$;

-- Exponential backoff, giving up after 5 attempts so a permanently bad address
-- cannot spin forever.
create or replace function public.mark_notification_failed(
  notification_id uuid, error_text text
) returns void
volatile
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_outbox
     set status = case when attempts >= 5 then 'failed' else 'pending' end,
         last_error = error_text,
         scheduled_for = now() + (interval '1 minute' * power(3, least(attempts, 5)))
   where id = notification_id;
$$;

-- ---------------------------------------------------------------------------
-- Grants + RLS
-- ---------------------------------------------------------------------------

alter table public.store_settings      enable row level security;
alter table public.store_settings      force row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;

-- Customers need the bank details to pay. Nothing here is secret — an account
-- number appears on every invoice — but there is no reason to expose it to
-- logged-out visitors either.
grant select on public.store_settings to authenticated;
create policy store_settings_read on public.store_settings
  for select using (auth.uid() is not null);

grant update on public.store_settings to authenticated;
create policy store_settings_admin_write on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- The outbox is infrastructure. No storefront role may read it; service_role
-- bypasses RLS and the admin can inspect failures.
create policy notification_outbox_admin_read on public.notification_outbox
  for select using (public.is_admin());
grant select on public.notification_outbox to authenticated;

revoke execute on function
  public.enqueue_notification(public.notification_kind, uuid, citext, jsonb),
  public.claim_notifications(int),
  public.mark_notification_sent(uuid, text),
  public.mark_notification_failed(uuid, text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- GraphQL surface
-- ---------------------------------------------------------------------------

comment on table public.store_settings is
  e'@graphql({"name": "StoreSettings", "description": "Single-row store config. Bank details for the transfer instructions screen."})';
comment on table public.notification_outbox is
  e'@graphql({"name": "NotificationOutbox", "description": "Queued email. Drained by a service_role worker; not part of the storefront API."})';
