#!/usr/bin/env bash
# Uploads an APK to Firebase App Distribution for the `testers` group.
#
#   distribute-apk.sh <apk> ["release notes"]
#
# Config precedence: $CONFIG (default /etc/insight-ops/firebase.env) or the same
# variables exported in the environment:
#   FIREBASE_APP_ID, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_GROUPS
#
# Two environment quirks learned the hard way:
#   - firebase-tools' uploader breaks on Node 26 ("invalid onError method"), so
#     run this under Node 20-24.
#   - this VPS's egress to Google is slow enough that a 17 MB upload can hit the
#     CLI's 300 s task timeout. Distribute from the workstation; the VPS keeps
#     building and publishing.
set -euo pipefail

CONFIG=${CONFIG:-/etc/insight-ops/firebase.env}
if [[ -r $CONFIG ]]; then
  # shellcheck disable=SC1090
  . "$CONFIG"
fi

: "${FIREBASE_APP_ID:?set FIREBASE_APP_ID or provide $CONFIG}"
: "${GOOGLE_APPLICATION_CREDENTIALS:?set GOOGLE_APPLICATION_CREDENTIALS or provide $CONFIG}"
export GOOGLE_APPLICATION_CREDENTIALS

apk=${1:?usage: distribute-apk.sh <apk> ["release notes"]}
notes=${2:-$(basename "$apk")}
[[ -f $apk ]] || { echo "no such APK: $apk" >&2; exit 1; }

if command -v firebase >/dev/null 2>&1; then
  cli=(firebase)
else
  cli=(npx -y firebase-tools@15.34.2)
fi

"${cli[@]}" appdistribution:distribute "$apk" \
  --app "$FIREBASE_APP_ID" \
  --groups "${FIREBASE_GROUPS:-testers}" \
  --release-notes "$notes"
