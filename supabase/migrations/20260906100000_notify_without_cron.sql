-- ---------------------------------------------------------------------------
-- Immediate notifications: drop the 5-minute cron, kick the drain on write
-- ---------------------------------------------------------------------------
-- The outbox stays exactly as it was. What changes is WHO wakes the worker:
-- previously a Vercel cron every 5 minutes, now the trigger itself, the moment
-- a row is queued. Two reasons:
--
--   1. A buyer waited up to 5 minutes for the order confirmation that tells
--      them which account to pay into. That is the most important email the
--      store sends and it was the slowest.
--   2. Vercel's Hobby plan rejects any cron more frequent than once per day —
--      a `*/5` schedule fails the deployment outright, not silently.
--
-- pg_net does NOT make the request inline. net.http_post() inserts into pg_net's
-- queue inside this transaction and a background worker sends it after commit.
-- So checkout latency is unchanged, a Resend outage cannot fail an order, and a
-- rolled-back order can never email anyone. The properties the outbox was built
-- for survive; only the 5-minute wait is gone.
--
-- The daily maintenance cron also drains, catching anything whose kick was lost.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- The kick
-- ---------------------------------------------------------------------------
-- URL and secret live in Vault, not here: a migration is committed to git and
-- the worker secret must not be. Create them once per environment with:
--
--   select vault.create_secret('https://<domain>/api/cron/notifications',
--                              'notification_worker_url');
--   select vault.create_secret('<NOTIFICATION_WORKER_SECRET>',
--                              'notification_worker_secret');
--
-- Until both exist this is a no-op. That is deliberate — an unconfigured
-- environment must still be able to take an order. The rows stay pending and
-- the daily drain sends them once the secrets are in place.
create or replace function public.kick_notification_drain()
returns void
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'notification_worker_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'notification_worker_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url     => v_url,
    body    => '{}'::jsonb,
    headers => jsonb_build_object(
      'Content-Type',  'application/json',
      'authorization', 'Bearer ' || v_secret
    )
  );
end;
$$;

comment on function public.kick_notification_drain() is
  'Asks the drain route to run now. Queued by pg_net, sent after commit. No-op until the Vault secrets exist.';

-- Same posture as the rest of the outbox API: infrastructure, not a storefront
-- surface. Anyone who could call this could point traffic at the drain route.
revoke execute on function public.kick_notification_drain() from public, anon, authenticated;

create or replace function public.kick_if_queued(p_order_id uuid, p_before bigint)
returns void
volatile
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select count(*) from public.notification_outbox where order_id = p_order_id) > p_before then
    perform public.kick_notification_drain();
  end if;
end;
$$;

revoke execute on function public.kick_if_queued(uuid, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: unchanged enqueue logic, one added kick
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
  v_queued  bigint;
begin
  select owner_alert_email into v_owner from public.store_settings where id;
  v_payload := public.order_notification_payload(new.id);

  -- Kick only if THIS write queued something. Asking "is anything pending for
  -- this order" instead would also match a row an earlier write left behind,
  -- so a customer double-clicking the transfer button would fire a request
  -- every time while queueing nothing. Redelivery of a stuck row is the daily
  -- drain's job, not the button's.
  select count(*) into v_queued from public.notification_outbox where order_id = new.id;

  if tg_op = 'INSERT' then
    -- Customer gets the bank details; the owner gets told a sale is pending.
    perform public.enqueue_notification('order_placed_customer', new.id, new.email, v_payload);
    perform public.enqueue_notification('order_placed_owner',    new.id, v_owner,   v_payload);
    perform public.kick_if_queued(new.id, v_queued);
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

  perform public.kick_if_queued(new.id, v_queued);
  return null;
end;
$$;
