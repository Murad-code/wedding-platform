#!/usr/bin/env bash
#
# Takes an encrypted-at-rest-if-you-ask backup of one wedding's database.
#
#   ./scripts/backup.sh [output-directory]
#
# Reads the compose project from COMPOSE_PROJECT (default: the development project), so
# the same script works for a client deployment:
#
#   COMPOSE_PROJECT=sarah-and-adam POSTGRES_USER=wedding POSTGRES_DB=wedding \
#     ./scripts/backup.sh /var/backups/sarah-and-adam
#
# Custom format (-Fc) rather than plain SQL: it is compressed, and pg_restore can be
# pointed at a single table from it during an incident.
set -euo pipefail

PROJECT="${COMPOSE_PROJECT:-wedding-platform}"
SERVICE="${POSTGRES_SERVICE:-postgres}"
DB_USER="${POSTGRES_USER:-wedding}"
DB_NAME="${POSTGRES_DB:-wedding}"
OUT_DIR="${1:-./backups}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$OUT_DIR/${PROJECT}-${STAMP}.dump"

echo "Backing up ${PROJECT}/${DB_NAME} to ${TARGET}"

docker compose --project-name "$PROJECT" exec -T "$SERVICE" \
  pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$TARGET"

# A zero-byte file is the classic silent backup failure: the command "succeeded", the
# cron job was happy, and there is nothing in the file.
if [ ! -s "$TARGET" ]; then
  echo "Backup is empty — refusing to keep it." >&2
  rm -f "$TARGET"
  exit 1
fi

SIZE="$(wc -c < "$TARGET" | tr -d ' ')"
echo "Wrote ${SIZE} bytes."

if [ "$RETAIN_DAYS" -gt 0 ]; then
  find "$OUT_DIR" -name "${PROJECT}-*.dump" -type f -mtime "+${RETAIN_DAYS}" -delete
fi

echo "Done. Backups are not proven until a restore has been tested — see verify-restore.sh."
