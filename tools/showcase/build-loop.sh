#!/usr/bin/env bash
# Cuts seven raw phone screen recordings into the Worlds preview loop for one theme and encodes it (22 s, 1320 frames, 1080x2198, 60 fps).
#   tools/showcase/build-loop.sh <dark|light> <take-dir> [out.mp4]
# <take-dir> holds 1.mp4 ... 7.mp4: the raw 1080x2340 recordings, one per clip. Optional <take-dir>/start.txt: seconds to skip at the start of each take,
# one line per clip (the recording starts a moment before the gestures do); default 0. Output default: app/src/main/assets/showcase/worlds_<theme>.mp4.
# The phone captures at 90 fps (VFR, a frame per change): it is held to a steady 90, then blended down to 60 so a swipe keeps even steps (a plain 60 would drop every third frame).
# The still lead-in of a take is a single frame (nothing changes), so the take is held to 90 fps first and cut after, or the cut would drop it.
# The crop drops the status bar (100 px) and the gesture strip (42 px); clips 1-6 are 180 frames (3 s), clip 7 is 240 (4 s).
set -euo pipefail
theme=${1:?dark or light}; dir=${2:?folder with 1.mp4 ... 7.mp4}
out=${3:-"$(dirname "$0")/../../app/src/main/assets/showcase/worlds_$theme.mp4"}
frames=(180 180 180 180 180 180 240)
inputs=(); filter=""; join=""
for i in 1 2 3 4 5 6 7; do
  start=$(sed -n "${i}p" "$dir/start.txt" 2>/dev/null || true); start=${start:-0}
  inputs+=(-i "$dir/$i.mp4")
  filter+="[$((i-1)):v]crop=1080:2198:0:100,fps=90,trim=start=$start,setpts=PTS-STARTPTS,framerate=fps=60:interp_start=0:interp_end=255:scene=100,tpad=stop_mode=clone:stop_duration=5,trim=end_frame=${frames[$((i-1))]},setpts=N/60/TB[v$i];"
  join+="[v$i]"
done
ffmpeg -v error -y "${inputs[@]}" -filter_complex "${filter}${join}concat=n=7:v=1:a=0,settb=1/15360,setpts=N*256[v]" -map "[v]" \
  -fps_mode cfr -r 60 -video_track_timescale 15360 -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 21 -bf 0 -g 60 -refs 5 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart -an "$out"
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$out")
[ "$n" = 1320 ] || { echo "expected 1320 frames, got $n: a take is shorter than its clip" >&2; exit 1; }
echo "$out: $n frames"
