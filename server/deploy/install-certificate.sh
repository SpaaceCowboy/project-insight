#!/bin/bash
set -euo pipefail
cd /opt/insight-online
lineage="${RENEWED_LINEAGE:-/opt/insight-online/acme/config/live/31.57.24.70}"
install -d -m 700 tls
install -m 644 "$lineage/fullchain.pem" tls/fullchain.pem
install -m 600 "$lineage/privkey.pem" tls/privkey.pem
if docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml ps --status running https -q | grep -q .; then
    docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml exec -T https nginx -t
    docker compose -p insight-online -f compose.yaml -f server/deploy/compose.vps.yaml exec -T https nginx -s reload
fi
