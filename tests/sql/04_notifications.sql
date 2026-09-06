\set ON_ERROR_STOP on
\echo '── notifications: immediate kick, once per order, safe when unconfigured ──'

-- The drain is woken by Postgres now, not a cron. These tests pin the three
-- properties that replaced the schedule: a kick fires the moment there is work,
-- a repeated click cannot produce a second email, and a missing Vault secret
-- degrades to "queued, not sent" instead of failing the order.

select test.as_service();

insert into vault.decrypted_secrets (name, decrypted_secret) values
  ('notification_worker_url',    'https://hotaru.test/api/cron/notifications'),
  ('notification_worker_secret', 's3cret')
on conflict (name) do update set decrypted_secret = excluded.decrypted_secret;

-- An owner address is what makes the owner-side alerts enqueue at all.
update public.store_settings set owner_alert_email = 'owner@hotaru.mn' where id;

truncate net.sent_requests;

-- ---- a new order kicks immediately ---------------------------------------
insert into auth.users (id, email, phone)
values ('77777777-7777-7777-7777-777777777777','notify@example.com','88445566');
select test.as_user('77777777-7777-7777-7777-777777777777', false);

insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum)
values ('aaaa0000-0000-0000-0000-000000000007','77777777-7777-7777-7777-777777777777',
        'Сараа','88445566','Улаанбаатар','Хан-Уул');

select public.add_to_cart((select id from public.variants where sku='TEST-CHARM-1'), 1);

create temp table t_notify as
select * from public.place_order('aaaa0000-0000-0000-0000-000000000007',
  (select id from public.delivery_methods where code='pickup'));

select test.eq(
  (select count(*)::int from public.notification_outbox
    where order_id = (select id from t_notify)),
  2, 'placing an order queues the customer and owner emails');

select test.eq((select count(*)::int from net.sent_requests), 1,
  'one kick per write, not one per queued email');

select test.eq((select url from net.sent_requests limit 1),
  'https://hotaru.test/api/cron/notifications', 'kick targets the drain route');

select test.eq((select headers->>'authorization' from net.sent_requests limit 1),
  'Bearer s3cret', 'kick carries the worker secret');

-- ---- "money sent to bank" kicks once, and only once ----------------------
truncate net.sent_requests;
select test.as_user('77777777-7777-7777-7777-777777777777', false);
select public.submit_payment_proof((select id from t_notify), 'REF-1');

select test.eq(
  (select count(*)::int from public.notification_outbox
    where order_id = (select id from t_notify) and kind = 'payment_submitted_owner'),
  1, 'the transfer claim alerts the owner');

-- The customer has just moved real money. Telling only the owner leaves them
-- staring at a page with no acknowledgement that anyone knows.
select test.eq(
  (select count(*)::int from public.notification_outbox
    where order_id = (select id from t_notify) and kind = 'payment_submitted_customer'),
  1, 'the transfer claim is acknowledged to the customer too');

select test.eq((select count(*)::int from net.sent_requests), 1,
  'the transfer claim kicks the drain, once, for both emails');

-- Clicking the button again is the case that matters: the customer refreshes,
-- double-clicks, or replays the mutation. payment_status is already 'submitted'
-- so the trigger enqueues nothing, and with nothing queued there is no kick.
truncate net.sent_requests;
select public.submit_payment_proof((select id from t_notify), 'REF-2');

select test.eq(
  (select count(*)::int from public.notification_outbox
    where order_id = (select id from t_notify) and kind = 'payment_submitted_owner'),
  1, 'a second click cannot queue a second owner alert');
select test.eq(
  (select count(*)::int from public.notification_outbox
    where order_id = (select id from t_notify) and kind = 'payment_submitted_customer'),
  1, 'a second click cannot queue a second customer receipt');
select test.eq((select count(*)::int from net.sent_requests), 0,
  'a second click does not kick the drain');

-- ---- unconfigured environment still takes orders -------------------------
-- Local dev and a freshly-created project have no Vault secrets. The kick must
-- degrade to nothing: the row is queued and the daily drain will send it.
select test.as_service();
delete from vault.decrypted_secrets where name like 'notification_worker%';
truncate net.sent_requests;

select test.as_user('22222222-2222-2222-2222-222222222222', false);   -- admin
select public.confirm_payment((select id from t_notify));

select test.ok(
  (select count(*) > 0 from public.notification_outbox
    where order_id = (select id from t_notify) and kind = 'payment_confirmed_customer'),
  'confirmation still queues its email without Vault secrets');
select test.eq((select count(*)::int from net.sent_requests), 0,
  'no kick attempted when the worker URL is unknown');
