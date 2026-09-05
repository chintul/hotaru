-- Shared fixtures. Each suite must be able to run on its own, so the admin and
-- the seed catalog are created here rather than as a side effect of suite 01.
insert into auth.users (id, email) values ('22222222-2222-2222-2222-222222222222','owner@hotaru.mn')
on conflict (id) do nothing;

-- No auth.uid() in this context, so the role-protection trigger stands aside —
-- the same escape hatch the Supabase SQL editor uses to make the first admin.
update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';
