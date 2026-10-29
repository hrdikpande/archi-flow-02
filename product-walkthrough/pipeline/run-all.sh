#!/usr/bin/env bash
# Rebuilds the walkthrough end to end. Usage: pipeline/run-all.sh BUILD_DIR OUTPUT_DIR
# Needs: node + playwright (preinstalled Chromium), ffmpeg, python3 with kokoro-onnx, soundfile, numpy, pillow,
# and the Kokoro model files (see README.md). Environment: KOKORO_MODEL, KOKORO_VOICES, TTS_CACHE (optional), PY.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BUILD="${1:?build dir}"; OUT="${2:?output dir}"; PY="${PY:-python3}"
mkdir -p "$BUILD" "$OUT"
node "$HERE/record.cjs" --build "$BUILD"
"$PY" "$HERE/tts.py" "$BUILD"
"$PY" "$HERE/compose.py" "$BUILD" plan
"$PY" "$HERE/compose.py" "$BUILD" render "${WORKERS:-3}"
"$PY" "$HERE/compose.py" "$BUILD" mux "$OUT/complete-product-walkthrough.mp4"
cp "$BUILD/captions.srt" "$OUT/complete-product-walkthrough.srt"
"$PY" "$HERE/report.py" "$BUILD" "$OUT" "$OUT/complete-product-walkthrough.mp4"
echo "done: $OUT/complete-product-walkthrough.mp4"
