#!/usr/bin/env bash
#
# Proves a backup can actually be restored.
#
#   ./scripts/verify-restore.sh <dump-file>
#
# Restores into a scratch database alongside the real one, compares row counts table by
# table, and drops the scratch database again. The live database is never written to.
#
# This exists because "we take nightly backups" is not a recovery plan. An untested
# backup is a file, not a backup (docs/CLIENT_DEPLOYMENT.md §13).
set -euo pipefail

DUMP="${1:?usage: verify-restore.sh <dump-file>}"
PROJECT="${COMPOSE_PROJECT:-wedding-platform}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DB_USER="${POSTGRES_USER:-wedding}"
DB_NAME="${POSTGRES_DB:-wedding}"
SCRATCH="restore_check_$(date -u +%Y%m%d%H%M%S)"

[ -s "$DUMP" ] || { echo "No such dump, or it is empty: $DUMP" >&2; exit 1; }

compose() { docker compose --project-name "$PROJECT" exec -T "$SERVICE" "$@"; }

# Exact counts, not `pg_stat_user_tables.n_live_tup`. Those are estimates that are only
# refreshed by ANALYZE, so a live database that has not been analysed recently reports
# zeroes and the comparison silently passes or fails for the wrong reason. Counting is
# read-only, which matters: verification must never write to the live database.
counts() {
  compose psql -U "$DB_USER" -d "$1" -At -F',' -c "
    SELECT relname,
           (xpath('/row/c/text()', census))[1]::text::bigint AS rows
    FROM (
      SELECT relname,
             query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, relname),
                          false, true, '') AS census
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
    ) counted
    ORDER BY relname" 2>/dev/null
}

cleanup() {
  compose psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Restoring ${DUMP} into scratch database ${SCRATCH}"
compose psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${SCRATCH}" >/dev/null

# pg_restore reports non-fatal notices as errors on a fresh database; --exit-on-error
# would abort on those, so the restore is judged by what actually landed instead.
docker compose --project-name "$PROJECT" exec -T "$SERVICE" \
  pg_restore -U "$DB_USER" -d "$SCRATCH" --no-owner --no-privileges < "$DUMP" >/dev/null 2>&1 || true

LIVE="$(counts "$DB_NAME")"
RESTORED="$(counts "$SCRATCH")"

if [ -z "$RESTORED" ]; then
  echo "FAILED: the restored database has no tables at all." >&2
  exit 1
fi

if [ "$LIVE" = "$RESTORED" ]; then
  echo "OK: $(echo "$LIVE" | wc -l | tr -d ' ') tables restored with matching row counts."
  exit 0
fi

echo "MISMATCH between live and restored row counts:" >&2
diff <(echo "$LIVE") <(echo "$RESTORED") || true
exit 1
