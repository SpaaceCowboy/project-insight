#!/bin/bash
set -euo pipefail
cd /opt/insight-online
install -d -m 700 backups
backup_file="backups/insight-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
trap 'rm -f "$backup_file.partial"' EXIT
recipient="$(age-keygen -y secrets/backup.agekey)"
docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml exec -T db pg_dump -U insight -d insight -Fc |
    age -r "$recipient" -o "$backup_file.partial"
chmod 600 "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
