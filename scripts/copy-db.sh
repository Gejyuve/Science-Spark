#!/usr/bin/env bash
# Copies the app's tables (public schema) from SOURCE_DATABASE_URL to TARGET_DATABASE_URL,
# then checks that every table has the same row count on both sides.
# Used by .github/workflows/copy-db.yml; can also be run by hand with both variables set.
#
# Safety: the target must have no tables in its public schema, or it must be an earlier copy
# of this app (it has schema_meta) and REPLACE=yes. It never touches other schemas.
set -euo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is not set}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is not set}"
REPLACE="${REPLACE:-no}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

q() { psql "$1" -X -v ON_ERROR_STOP=1 -Atc "$2"; }

echo "Source server: $(q "$SOURCE_DATABASE_URL" 'SHOW server_version')"
echo "Target server: $(q "$TARGET_DATABASE_URL" 'SHOW server_version')"
echo "pg_dump: $(pg_dump --version)"

if [ "$(q "$SOURCE_DATABASE_URL" "SELECT to_regclass('public.schema_meta') IS NOT NULL")" != "t" ]; then
  echo "Source has no public.schema_meta table; is SOURCE_DATABASE_URL the Science Spark database?" >&2
  exit 1
fi

existing="$(q "$TARGET_DATABASE_URL" "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
clean=()
if [ "$existing" != "0" ]; then
  if [ "$(q "$TARGET_DATABASE_URL" "SELECT to_regclass('public.schema_meta') IS NOT NULL")" = "t" ] && [ "$REPLACE" = "yes" ]; then
    echo "Target already holds an earlier copy ($existing tables); replacing it."
    clean=(--clean --if-exists)
  else
    echo "Target public schema already has $existing tables. Refusing to copy over them." >&2
    echo "Use an empty database, or set REPLACE=yes if the target is an earlier copy of this app." >&2
    exit 1
  fi
fi

pg_dump "$SOURCE_DATABASE_URL" --schema=public --no-owner --no-privileges --format=custom --file="$WORK/db.dump"
# Leave the public schema itself (and its comment) alone; only restore the objects inside it.
pg_restore --list "$WORK/db.dump" | grep -vE ' (SCHEMA|COMMENT) - public ' > "$WORK/list"
pg_restore --no-owner --no-privileges --single-transaction --exit-on-error "${clean[@]}" \
  --use-list="$WORK/list" --dbname="$TARGET_DATABASE_URL" "$WORK/db.dump"

echo "Row counts (source / target):"
counts() {
  local sql
  sql="$(q "$1" "SELECT string_agg(format('SELECT %L, count(*) FROM public.%I', tablename, tablename), ' UNION ALL ' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public'")"
  psql "$1" -X -v ON_ERROR_STOP=1 -AtF ' ' -c "$sql" | sort
}
counts "$SOURCE_DATABASE_URL" > "$WORK/src"
counts "$TARGET_DATABASE_URL" > "$WORK/dst"
join -a1 -a2 -e MISSING -o 0,1.2,2.2 "$WORK/src" "$WORK/dst" | awk '{ printf "  %-22s %8s / %-8s %s\n", $1, $2, $3, ($2 == $3 ? "ok" : "MISMATCH") }'
if ! diff -q "$WORK/src" "$WORK/dst" > /dev/null; then
  echo "Row counts differ." >&2
  exit 1
fi
echo "Copy complete: all tables match."
