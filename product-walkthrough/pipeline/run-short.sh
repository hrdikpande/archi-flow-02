#!/usr/bin/env bash
# Rebuilds the 12-minute cut end to end, with subtitles burned into the picture as well as a soft track.
# Usage: pipeline/run-short.sh BUILD_DIR OUTPUT_DIR   (same requirements and environment as run-all.sh)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="${1:?build dir}"; OUT="${2:?output dir}"; PY="${PY:-python3}"
NAME=drawingops-walkthrough-12min
mkdir -p "$BUILD" "$OUT"
WT_SUBS_SAFE=1 node "$HERE/record.cjs" --scenes scenes-short/index.cjs --build "$BUILD"
"$PY" "$HERE/tts.py" "$BUILD"
export BURN_SUBS=1 WT_TITLE="DrawingOps · 12-minute walkthrough"
"$PY" "$HERE/compose.py" "$BUILD" plan
"$PY" "$HERE/compose.py" "$BUILD" render "${WORKERS:-3}"
"$PY" "$HERE/compose.py" "$BUILD" mux "$OUT/$NAME.mp4"
cp "$BUILD/captions.srt" "$OUT/$NAME.srt"
"$PY" "$HERE/report.py" "$BUILD" "$OUT" "$OUT/$NAME.mp4" --short
echo "done: $OUT/$NAME.mp4"
