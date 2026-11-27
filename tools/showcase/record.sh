#!/usr/bin/env bash
# Records one clip from the phone: pushes the Autopilot timeline, screen-records while it plays, pulls the take and prints how many seconds into it the clip starts.
#   tools/showcase/record.sh <timeline.txt|steps.sh> <take.mp4> <seconds>
# A .sh is run on the phone instead (for a window the Autopilot cannot touch, such as the sort sheet): its first line is "# lead <ms>", how much still
# picture the clip should keep before the first thing moves.
# The showcase build must be open on the screen the clip starts from. The take is cut later by build-loop.sh; its start is the first frame that moves minus the
# timeline's first event (the clip begins that long before the first touch), so a timeline should open with a short still lead-in (300-500 ms).
# A flaky cable drops the USB link for a second at a time. Everything timed runs detached on the phone (a dropped adb session would kill it), and every adb call waits for the link and retries.
set -euo pipefail
timeline=${1:?timeline}; take=${2:?take.mp4}; seconds=${3:?seconds}
dir=/sdcard/Android/data/com.insightpuzzle.app.showcase/files
a() { for _ in $(seq 20); do adb wait-for-device && adb "$@" && return 0; sleep 1; done; echo "adb $* failed" >&2; return 1; }
case "$timeline" in
  *.sh) a push "$timeline" /sdcard/steps.sh >/dev/null; first=$(sed -n '1s/^# lead //p' "$timeline") ;;
  *) a push "$timeline" "$dir/g.txt" >/dev/null; first=$(head -1 "$timeline" | cut -d' ' -f1) ;;
esac
a shell rm -f /sdcard/take.mp4
a shell "nohup screenrecord --size 1080x2340 --bit-rate 24M --time-limit $(python3 -c "print(int($seconds)+2)") /sdcard/take.mp4 >/dev/null 2>&1 &"
sleep 1.2
case "$timeline" in
  *.sh) a shell "nohup sh /sdcard/steps.sh >/dev/null 2>&1 &" ;;
  *) a shell am broadcast -a com.insightpuzzle.app.showcase.PLAY -p com.insightpuzzle.app.showcase >/dev/null ;;
esac
sleep "$(python3 -c "print(int($seconds)+4)")"
a pull /sdcard/take.mp4 "$take" >/dev/null
moves=$(ffmpeg -hide_banner -i "$take" -vf "crop=1080:2198:0:100,scale=270:-1,freezedetect=n=0.001:d=0.15" -an -f null - 2>&1 | sed -n 's/.*freeze_end: \([0-9.]*\).*/\1/p' | head -1)
python3 -c "print(round(float('${moves:-0}') - $first/1000, 3))"
