-- Minimal assertion helpers. Every failure raises, so psql -v ON_ERROR_STOP=1
-- turns a wrong value into a non-zero exit code instead of a line of output
-- nobody reads.
create schema if not exists test;

create or replace function test.eq(actual anyelement, expected anyelement, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL % — expected %, got %', label, expected, actual;
  end if;
  raise notice 'ok   %', label;
end; $$;

create or replace function test.ok(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAIL % — condition was %', label, coalesce(condition::text, 'null');
  end if;
  raise notice 'ok   %', label;
end; $$;

-- Asserts that a statement raises the given SQLSTATE. Used for every guard:
-- a permission check that silently passes is worse than no check.
create or replace function test.raises(stmt text, sqlstate_expected text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if SQLSTATE = sqlstate_expected then
      raise notice 'ok   % (raised %)', label, sqlstate_expected;
      return;
    end if;
    raise exception 'FAIL % — expected SQLSTATE %, got % (%)', label, sqlstate_expected, SQLSTATE, SQLERRM;
  end;
  raise exception 'FAIL % — expected SQLSTATE %, but nothing raised', label, sqlstate_expected;
end; $$;

-- Impersonate a user for subsequent statements.
create or replace function test.as_user(p_uid uuid, p_anon boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  perform set_config('request.jwt.claims',
    case when p_uid is null then ''
         else json_build_object('sub', p_uid, 'is_anonymous', p_anon)::text end, false);
end; $$;

-- Server-side context: no JWT, like the SQL editor or service_role.
create or replace function test.as_service()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end; $$;

-- Suites switch to `set role authenticated` to exercise RLS, and must still be
-- able to call the assertion helpers from that role.
grant usage on schema test to anon, authenticated;
grant execute on all functions in schema test to anon, authenticated;
