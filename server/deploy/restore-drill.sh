#!/usr/bin/env bash
# Restores the newest encrypted dump into a scratch database, verifies it, then
# drops it. The archive is decrypted inside a pipe, so plaintext never touches
# disk. Run monthly by insight-restore-drill.timer; the box watcher alerts when
# the last run failed or the success timestamp is older than 35 days.
set -euo pipefail

BACKUP_DIR=${BACKUP_DIR:-/opt/insight-online/backups}
AGE_KEY=${AGE_KEY:-/opt/insight-online/secrets/backup.agekey}
DB=${DRILL_DB:-insight_restore_drill}
STATE_DIR=${STATE_DIR:-/var/lib/insight-ops}

exec 9>/var/lock/insight-restore-drill.lock
flock -n 9 || { echo "another restore drill is already running"; exit 0; }

dump=$(ls -t "$BACKUP_DIR"/*.dump.age 2>/dev/null | head -1)
if [[ -z ${dump:-} ]]; then
  echo "no encrypted dump found in $BACKUP_DIR"
  exit 1
fi

cleanup() {
  runuser -u postgres -- dropdb --if-exists "$DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT

runuser -u postgres -- dropdb --if-exists "$DB" >/dev/null
runuser -u postgres -- createdb "$DB"

echo "restoring $(basename "$dump") ($(stat -c %s "$dump") bytes)"
age -d -i "$AGE_KEY" "$dump" \
  | runuser -u postgres -- pg_restore --no-owner --no-privileges --exit-on-error -d "$DB"

# A restore that silently produced a different schema is not a usable backup.
tables_sql="select table_name from information_schema.tables where table_schema='public' order by 1"
if ! diff <(runuser -u postgres -- psql -Atd insight -c "$tables_sql") \
          <(runuser -u postgres -- psql -Atd "$DB" -c "$tables_sql") >/dev/null; then
  echo "restored schema differs from the live schema"
  exit 1
fi

# A restore that produced an empty database is not a usable backup either.
users=$(runuser -u postgres -- psql -Atd "$DB" -c "select count(*) from users")
grids=$(runuser -u postgres -- psql -Atd "$DB" -c "select count(*) from grids")
if (( users <= 0 )) || (( grids <= 0 )); then
  echo "restored database looks empty (users=$users grids=$grids)"
  exit 1
fi

install -d -m 700 "$STATE_DIR"
date -u +%s > "$STATE_DIR/restore-drill"
echo "drill passed: $(basename "$dump") -> users=$users grids=$grids"
