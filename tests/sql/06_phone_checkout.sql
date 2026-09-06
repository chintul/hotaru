\set ON_ERROR_STOP on
\echo '── phone-only checkout: an account with no email can still order ──'

-- Phone sign-in mints a synthesised <phone>@phone.hotaru.invalid address as a
-- login identity and deliberately does NOT mirror it into profiles.email, so a
-- phone customer has no email at all. They must still be able to buy.
update public.variants set quantity = 20 where sku='TEST-HOLDER-1';

insert into auth.users (id, phone, is_anonymous)
values ('cafe0000-0000-0000-0000-0000000000c1', '89286859', false);
select test.as_user('cafe0000-0000-0000-0000-0000000000c1', false);

select test.ok((select email is null from public.profiles where id='cafe0000-0000-0000-0000-0000000000c1'),
               'a phone sign-in has no email to mirror');

select public.add_to_cart((select id from public.variants where sku='TEST-HOLDER-1'), 1);

insert into public.addresses (id, profile_id, recipient_name, phone, city_aimag, district_sum, is_default)
values ('cafe0000-0000-0000-0000-0000000000c2','cafe0000-0000-0000-0000-0000000000c1',
        'Бат','89286859','Улаанбаатар','Сүхбаатар', true);

create temp table p_order as
select * from public.place_order(
  'cafe0000-0000-0000-0000-0000000000c2',
  (select id from public.delivery_methods where code='ub_courier'));

select test.eq((select status from p_order)::text, 'awaiting_payment',
               'a customer with no email can place an order');
select test.ok((select email is null from p_order),
               'the order carries no email rather than a fake one');
select test.eq((select phone from p_order), '89286859',
               'the phone is the contact detail that survives');

-- The receipt cannot be sent, but the owner must still be told.
select test.eq((select count(*)::int from public.notification_outbox
                 where order_id=(select id from p_order) and kind='order_placed_customer'),
               0, 'no customer receipt is queued for an address that does not exist');
select test.eq((select count(*)::int from public.notification_outbox
                 where order_id=(select id from p_order) and kind='order_placed_owner'),
               1, 'the owner alert still fires');

-- An email customer is unaffected.
select test.ok((select email is not null from public.orders
                 where profile_id='11111111-1111-1111-1111-111111111111' limit 1),
               'orders from email accounts still carry their address');
