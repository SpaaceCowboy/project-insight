#!/usr/bin/env bash
# INSIGHT box watcher: checks the things on this host that fail silently and
# reports state changes to Telegram. A problem is reported when it appears and
# once when it clears, not every five minutes.
#
#   insight-watch.sh            one pass (runs from insight-watch.timer)
#   insight-watch.sh --dry-run  print what is wrong right now, change nothing
#   insight-watch.sh --test     send one Telegram message and exit
#
# Config: /etc/insight-ops/watch.env (root, 600). State: /var/lib/insight-ops.
set -uo pipefail

CONFIG=${CONFIG:-/etc/insight-ops/watch.env}
if [[ -r $CONFIG ]]; then . "$CONFIG"; fi

HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/health}
PUBLIC_URL=${PUBLIC_URL:-https://13.140.89.146/health}
APK_URL=${APK_URL:-https://13.140.89.146/INSIGHT-online.apk}
BACKUP_DIR=${BACKUP_DIR:-/opt/insight-online/backups}
BACKUP_HOURS=${BACKUP_HOURS:-27}
DISK_LIMIT=${DISK_LIMIT:-80}
MEMORY_FLOOR_MB=${MEMORY_FLOOR_MB:-250}
CERT_DAYS=${CERT_DAYS:-3}
HTTP5XX_LIMIT=${HTTP5XX_LIMIT:-5}
DRILL_HOURS=${DRILL_HOURS:-840}
STATE_DIR=${STATE_DIR:-/var/lib/insight-ops}
SERVICES=${SERVICES:-"insight-online nginx postgresql@16-main"}
TIMERS=${TIMERS:-"insight-backup.timer insight-certificate.timer"}

declare -A problems=()
add() { problems[$1]=$2; }

send() {
  if [[ -z ${TELEGRAM_BOT_TOKEN:-} || -z ${TELEGRAM_CHAT_ID:-} ]]; then
    logger -t insight-watch "Telegram not configured; suppressed: ${1//$'\n'/ }"
    return 0
  fi
  curl -fsS --max-time 10 -o /dev/null \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" \
    || logger -t insight-watch "Telegram send failed"
}

if [[ ${1:-} == --test ]]; then
  send "INSIGHT watcher test — $(hostname) $(date -u '+%Y-%m-%d %H:%M UTC')"
  exit $?
fi

mkdir -p "$STATE_DIR" && chmod 700 "$STATE_DIR"
STATE_FILE=$STATE_DIR/problems

# The API behind nginx, then through nginx with TLS validated end to end.
check_url() { # key label url
  curl -fsS --max-time 10 -o /dev/null "$3" 2>/dev/null || add "$1" "$2 is not answering ($3)"
}
check_url api "API health endpoint" "$HEALTH_URL"
check_url public "Public HTTPS health endpoint" "$PUBLIC_URL"

# The published APK: a truncating download or broken route shows up as a bad size.
size=$(curl -fsSI --max-time 15 "$APK_URL" 2>/dev/null | tr -d '\r' | awk 'tolower($1)=="content-length:" {print $2}' | tail -1)
if [[ -z ${size:-} ]]; then
  add apk "APK download does not answer ($APK_URL)"
elif ! [[ $size =~ ^[0-9]+$ ]] || (( size < 10000000 )); then
  add apk "APK download is only ${size} bytes ($APK_URL)"
fi

for unit in $SERVICES; do
  state=$(systemctl is-active "$unit" 2>/dev/null)
  [[ $state == active ]] || add "unit.$unit" "$unit is ${state:-unknown}"
done
for unit in $TIMERS; do
  state=$(systemctl is-active "$unit" 2>/dev/null)
  [[ $state == active ]] || add "timer.$unit" "$unit is ${state:-unknown}"
done

# The incident that prompted this service: the backup unit failed with 203/EXEC
# and nothing noticed for hours. Check both the last result and the dump age.
latest=$(ls -t "$BACKUP_DIR"/*.dump.age 2>/dev/null | head -1)
if [[ -z ${latest:-} ]]; then
  add backup "no encrypted dump found in $BACKUP_DIR"
else
  age_h=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
  (( age_h <= BACKUP_HOURS )) || add backup "newest dump is ${age_h}h old; limit ${BACKUP_HOURS}h ($(basename "$latest"))"
fi
result=$(systemctl show insight-backup.service -p Result --value 2>/dev/null)
[[ $result == success ]] || add backup-result "insight-backup.service last result: ${result:-unknown}"

# The monthly drill proves the dumps are usable; alert if it fails or stalls.
drill_result=$(systemctl show insight-restore-drill.service -p Result --value 2>/dev/null)
[[ -z ${drill_result:-} || $drill_result == success ]] || add restore-drill "insight-restore-drill.service last result: $drill_result"
if [[ -r $STATE_DIR/restore-drill ]]; then
  drill_age_h=$(( ( $(date +%s) - $(cat "$STATE_DIR/restore-drill") ) / 3600 ))
  (( drill_age_h <= DRILL_HOURS )) || add restore-drill-age "restore drill is ${drill_age_h}h old; limit ${DRILL_HOURS}h"
else
  add restore-drill-age "restore drill has never run"
fi

used=$(df --output=pcent / 2>/dev/null | tail -1 | tr -dc '0-9')
if [[ -z ${used:-} ]]; then
  add disk "cannot read root filesystem usage"
elif (( used > DISK_LIMIT )); then
  add disk "root filesystem at ${used}% (limit ${DISK_LIMIT}%)"
fi

avail=$(awk '/^MemAvailable:/ {print int($2/1024)}' /proc/meminfo 2>/dev/null)
if [[ -z ${avail:-} ]]; then
  add memory "cannot read memory availability"
elif (( avail < MEMORY_FLOOR_MB )); then
  add memory "only ${avail} MB RAM available (floor ${MEMORY_FLOOR_MB} MB)"
fi

# The certificate this host actually serves. It is a short-lived IP certificate
# (~6 days, renewed twice daily), hence a three-day threshold rather than weeks.
end=$(openssl s_client -connect 127.0.0.1:443 </dev/null 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
if [[ -z ${end:-} ]]; then
  add cert "cannot read the certificate served on :443"
else
  left=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
  (( left >= CERT_DAYS )) || add cert "served certificate expires in ${left}d ($end; threshold ${CERT_DAYS}d)"
fi

count=$(journalctl -u insight-online --since "-6 min" --no-pager 2>/dev/null | grep -c '"status":5' || true)
if ! [[ ${count:-} =~ ^[0-9]+$ ]]; then
  add http5xx "cannot count recent 5xx responses"
elif (( count >= HTTP5XX_LIMIT )); then
  add http5xx "${count} server 5xx responses in the last 6 minutes"
fi

restarts=$(systemctl show insight-online -p NRestarts --value 2>/dev/null)
[[ ${restarts:-} =~ ^[0-9]+$ ]] || restarts=0
prev_restarts=$(cat "$STATE_DIR/restarts" 2>/dev/null || echo 0)
[[ ${prev_restarts:-} =~ ^[0-9]+$ ]] || prev_restarts=0
(( restarts > prev_restarts )) && add restarts "insight-online restarted $((restarts - prev_restarts)) time(s) since the last check"

# Compare with the previous pass so only transitions produce messages.
declare -A previous=()
if [[ -r $STATE_FILE ]]; then
  while IFS='|' read -r key message; do
    [[ -n ${key:-} ]] && previous[$key]=$message
  done < "$STATE_FILE"
fi
new=()
for key in "${!problems[@]}"; do
  [[ ${previous[$key]:-} == "${problems[$key]}" ]] || new+=("${problems[$key]}")
done
resolved=()
for key in "${!previous[@]}"; do
  [[ -n ${problems[$key]:-} ]] || resolved+=("${previous[$key]}")
done

if [[ ${1:-} == --dry-run ]]; then
  echo "current problems: ${#problems[@]}"
  for key in "${!problems[@]}"; do echo "  [$key] ${problems[$key]}"; done
  echo "would report: ${#new[@]} new, ${#resolved[@]} resolved"
  exit 0
fi

message=""
if (( ${#new[@]} > 0 )); then
  message+="🔴 INSIGHT prod: ${#new[@]} problem(s)"$'\n'
  for line in "${new[@]}"; do message+="• $line"$'\n'; done
fi
if (( ${#resolved[@]} > 0 )); then
  message+="🟢 resolved"$'\n'
  for line in "${resolved[@]}"; do message+="• $line"$'\n'; done
fi
[[ -n $message ]] && message+="$(hostname) · $(date -u '+%Y-%m-%d %H:%M UTC')"

if [[ -n $message ]]; then
  send "$message"
  logger -t insight-watch "reported ${#new[@]} new, ${#resolved[@]} resolved"
fi

tmp=$STATE_FILE.tmp
: > "$tmp"
for key in "${!problems[@]}"; do printf '%s|%s\n' "$key" "${problems[$key]}" >> "$tmp"; done
mv -f "$tmp" "$STATE_FILE"
echo "$restarts" > "$STATE_DIR/restarts"
