#!/usr/bin/env bash
# Test the Sund 2.0 database: start a throwaway Postgres, stand in what
# Supabase provides, apply every migration and the seed, then run the privacy
# checks in tests/db/rls.sql as the users they are meant to keep apart.
#
# Needs Postgres 15 or later with its contrib extensions (pg_trgm, unaccent,
# citext). Nothing is left behind.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# initdb refuses to run as root.
if [ "$(id -u)" = 0 ]; then
  exec runuser -u postgres -- "$0" "$@"
fi

BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
[ -x "$BIN/initdb" ] || BIN="$(dirname "$(command -v initdb)")"

TMP="$(mktemp -d)"
trap '"$BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

"$BIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

run() { psql -h "$TMP" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

run -f "$ROOT/tests/db/bootstrap.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run -f "$f"; done
run -f "$ROOT/supabase/seed.sql"
run -f "$ROOT/tests/db/rls.sql" 2>&1 | sed -n 's/^psql:.*NOTICE:  //p; s/^NOTICE:  //p; /FAILED\|ERROR\|passed/p'
exit "${PIPESTATUS[0]}"
