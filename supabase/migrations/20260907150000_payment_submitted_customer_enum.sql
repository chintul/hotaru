-- ---------------------------------------------------------------------------
-- hotaru — the enum label for the customer's "we got your transfer claim" mail
-- ---------------------------------------------------------------------------
-- Its own migration on purpose. ALTER TYPE ... ADD VALUE may run inside a
-- transaction on PG12+, but the new label cannot be USED in that same
-- transaction — and `supabase db push` wraps one migration file in one
-- transaction. The trigger that enqueues this kind therefore lives in the next
-- migration, which commits after this one.
alter type public.notification_kind add value if not exists 'payment_submitted_customer';
