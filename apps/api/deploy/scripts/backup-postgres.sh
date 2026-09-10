#!/usr/bin/env bash
# Daily PostgreSQL backup for APEX on Hostinger VPS.
# Install: sudo cp apps/api/deploy/scripts/backup-postgres.sh /usr/local/bin/apex-backup-postgres.sh
#          sudo chmod 750 /usr/local/bin/apex-backup-postgres.sh
# Cron (as root): 0 3 * * * /usr/local/bin/apex-backup-postgres.sh >> /var/log/apex/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/apex}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_NAME="${DB_NAME:-apex_workspace}"
DB_USER="${DB_USER:-apex}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/${DB_NAME}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Uses peer auth as postgres OS user, or set PGPASSWORD in a root-only env file.
if [[ -f /etc/apex/backup.env ]]; then
  # shellcheck disable=SC1091
  source /etc/apex/backup.env
fi

export PGPASSWORD="${PGPASSWORD:-}"

pg_dump -U "$DB_USER" -h "${PGHOST:-127.0.0.1}" -d "$DB_NAME" --no-owner --format=plain \
  | gzip -c > "$OUT"

chmod 600 "$OUT"
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +"$KEEP_DAYS" -delete

echo "[ok] backup written: $OUT"
