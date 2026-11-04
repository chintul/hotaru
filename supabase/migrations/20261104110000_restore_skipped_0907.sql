-- 20260907150000 and 20260907160000 never reached production: they were
-- created after 20260908* had already been pushed, so `db push` skipped them
-- as out of order. Production was left with a tg_order_notifications (from
-- 20260908020000) that enqueues 'payment_submitted_customer' while the enum
-- lacked that value, so every bank-transfer claim raised 22P02 and rolled
-- back.
--
-- Replaying them with --include-all would reinstall 20260907160000's older
-- trigger over the pre-order one, so both are marked applied with
-- `supabase migration repair` and only their non-superseded parts run here.
-- Idempotent, so databases that did apply them are unaffected.

alter type public.notification_kind add value if not exists 'payment_submitted_customer';

alter table public.store_settings
  drop column if exists email_from,
  drop column if exists email_reply_to;
