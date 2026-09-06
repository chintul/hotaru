-- ---------------------------------------------------------------------------
-- hotaru — tell the customer their transfer claim landed; one sending identity
-- ---------------------------------------------------------------------------
-- Two fixes that both concern who an email goes to and who it comes from.
--
-- 1. The claim receipt.
--    Pressing "I have transferred" alerted the owner and told the customer
--    nothing. With manual bank transfer that silence is the worst possible
--    moment to go quiet: the buyer has just moved real money and has no
--    confirmation that anyone knows. They now get an acknowledgement that says
--    what happens next, while the owner alert is unchanged.
--
--    Deliberately NOT a payment confirmation — nothing has been verified yet.
--    The wording has to survive the case where the claim turns out to be wrong.
--
-- 2. The sending identity.
--    store_settings.email_from and .email_reply_to have existed since the
--    outbox was built and have never been read by a single line of code; the
--    worker sends from RESEND_FROM_DOMAIN. Two half-configured sources, one of
--    them dead and seeded with a placeholder, is how an email identity silently
--    ends up wrong. The env var wins and the columns go.
--
--    Why env rather than the database, when bank details went the other way:
--    a from-address only delivers if its domain is verified inside the same
--    Resend account the API key belongs to. Domain and key change together, at
--    deploy time, with DNS work in between. An owner editing this field from
--    /admin could not tell a working address from one that silently stops every
--    email the store sends.

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
  -- bank. With manual transfer, missing this alert means an unshipped paid
  -- order. The customer gets an acknowledgement at the same time — see the
  -- header: they have just sent money and are owed a reply.
  if new.payment_status = 'submitted' and old.payment_status is distinct from 'submitted' then
    perform public.enqueue_notification('payment_submitted_owner',    new.id, v_owner,   v_payload);
    perform public.enqueue_notification('payment_submitted_customer', new.id, new.email, v_payload);
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

-- Dead since the outbox was written. Never selected, never exposed through
-- pg_graphql, never editable from /admin. See the header for why the sending
-- identity is env-only.
alter table public.store_settings
  drop column if exists email_from,
  drop column if exists email_reply_to;
