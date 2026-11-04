#!/usr/bin/env bash
# Uploads an APK to Firebase App Distribution for the `testers` group.
#
#   distribute-apk.sh <apk> ["release notes"]
#
# Config precedence: $CONFIG (default /etc/insight-ops/firebase.env) or the same
# variables exported in the environment:
#   FIREBASE_APP_ID, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_GROUPS
#
# Two environment quirks:
#   - this host resolves Google over IPv6 first, and its IPv6 route to Google
#     answers with error pages (a 17 MB upload sat until the CLI's 300 s task
#     timeout). `--dns-result-order=ipv4first` makes the same upload finish in
#     seconds.
#   - firebase-tools' uploader breaks on Node 26 ("invalid onError method"), so
#     run this under Node 20-24.
set -euo pipefail

export NODE_OPTIONS="--dns-result-order=ipv4first${NODE_OPTIONS:+ $NODE_OPTIONS}"

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
