-- Pre-order deposits: the new states. Enum values live in their own migration
-- because a value added inside a transaction cannot be used in that same
-- transaction; 20260908020000 uses them.
--
--   awaiting_payment → deposit_paid → awaiting_balance → paid → packed → …
--
-- deposit_paid      the upfront part is confirmed; waiting for the goods.
-- awaiting_balance  the goods arrived and the owner has asked for the rest.
-- partially_paid    payment_status while only the upfront part is in.

alter type public.order_status add value if not exists 'deposit_paid' after 'awaiting_payment';
alter type public.order_status add value if not exists 'awaiting_balance' after 'deposit_paid';
alter type public.payment_status add value if not exists 'partially_paid' after 'submitted';
alter type public.notification_kind add value if not exists 'deposit_confirmed_customer';
alter type public.notification_kind add value if not exists 'balance_requested_customer';
