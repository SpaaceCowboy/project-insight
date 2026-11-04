#!/bin/bash
set -euo pipefail
cd /opt/insight-online
install -d -m 700 backups secrets
if [ ! -f secrets/backup.agekey ]; then
    age-keygen -o secrets/backup.agekey
    chmod 600 secrets/backup.agekey
fi
backup_file="backups/insight-$(date -u +%Y%m%dT%H%M%SZ).dump.age"
trap 'rm -f "$backup_file.partial"' EXIT
recipient="$(age-keygen -y secrets/backup.agekey)"
runuser -u postgres -- pg_dump insight -Fc | age -r "$recipient" -o "$backup_file.partial"
chmod 600 "$backup_file.partial"
mv "$backup_file.partial" "$backup_file"
