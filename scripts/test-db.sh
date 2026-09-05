#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres, then runs the SQL suites.
# No pipes around psql: a pipe swallows the exit code and turns a failing test
# into a green run.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER=hotaru-test-pg
PORT=${TEST_PG_PORT:-55434}
DB="postgresql://postgres:pw@localhost:${PORT}/postgres"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pw -p "${PORT}:5432" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && sleep 1 && break
  sleep 1
done

psql "$DB" -v ON_ERROR_STOP=1 -q -c \
  'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;'
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/helpers/00_supabase_stub.sql"

# pg_graphql is absent from plain Postgres and is not needed to exercise the DDL
# or the write path; strip only that one line.
WORK="$(mktemp -d)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  sed 's/^create extension if not exists pg_graphql;/-- pg_graphql not available locally/' "$f" > "$WORK/$(basename "$f")"
done
for f in "$WORK"/*.sql; do
  if ! out=$(psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    printf 'MIGRATION FAILED  %s\n%s\n' "$(basename "$f")" "$out"
    exit 1
  fi
done
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/helpers/01_assert.sql"
psql "$DB" -v ON_ERROR_STOP=1 -q -f "$ROOT/tests/helpers/02_fixtures.sql"

failed=0
for f in "$ROOT"/tests/sql/*.sql; do
  echo
  if out=$(psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    echo "$out" | grep -E '^(NOTICE:|──)' | sed 's/^NOTICE:  //'
    printf 'PASS  %s\n' "$(basename "$f")"
  else
    echo "$out" | grep -E '^(NOTICE:|ERROR:|psql:|──)' | sed 's/^NOTICE:  //'
    printf 'FAIL  %s\n' "$(basename "$f")"
    failed=1
  fi
done

echo
[ "$failed" -eq 0 ] && echo "all database tests passed" || echo "database tests FAILED"
exit "$failed"
