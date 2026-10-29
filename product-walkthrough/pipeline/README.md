# Walkthrough pipeline

Reproduces `../complete-product-walkthrough.mp4` and the 12-minute cut `../short/drawingops-walkthrough-12min.mp4` from the demo in `demo/`. Everything runs offline once the voice model is downloaded; nothing in `demo/`, `backend/` or `frontend/` is modified.

```text
scenes/*.cjs ──► record.cjs ──► BUILD/frames/*.jpg + timeline.json + narration.json
                                   │
narration.json ──► tts.py ──────► BUILD/audio/*.wav + index.json (sentence timings)
                                   │
timeline + audio ──► compose.py plan ──► schedule.json (every event timed to the voice)
                     compose.py render ─► BUILD/parts/chNN.mp4 (cursor, clicks, zoom, highlights, cards, lower thirds)
                     compose.py mux ────► final MP4: narration, soft English subtitles, chapter markers
report.py ──► narration-script.md, video-storyboard.md, feature-inventory.md, coverage-report.md, chapters.txt
```

## How it works

- **Real footage.** `record.cjs` opens `demo/demo.html` in Playwright's Chromium at 1440×810 CSS px and device scale 2 (2880×1620 keyframes), signs in as each role through the real sign-in form, and drives every workflow with the demo's own controls. The demo's prototype harness (Demo button, Demo Access credentials panel, TOTP hint) is hidden with CSS so the footage shows only the product.
- **Deterministic.** The demo data is reset at the start and the browser clock starts at 29-Oct-2026 10:05 IST, so dates, flags and counts are the same on every run.
- **Keyframes, not screen video.** The recorder captures a keyframe after every state change and records pointer moves, clicks, zooms and highlights as events with element positions. `compose.py` animates the cursor, click ripples, camera zooms (up to 1.6×, still sharp because keyframes are 2×), highlight rings, cross-fades and role lower-thirds, then encodes 1920×1080 at 30 fps with x264 (CRF 29, preset slower, tune animation: UI text is indistinguishable from CRF 21 at well under half the size, keeping the 36-minute file under GitHub's 100 MB limit).
- **Paced by the narration.** Each step's actions start with its narration; the step lasts until both the actions and the voice are done, so the narration always matches the screen.
- **Narration.** Kokoro-82M (Apache-2.0) via `kokoro-onnx`, voice `af_heart`, run offline on CPU. `tts.py` applies pronunciation fixes for sheet numbers (M-205 → "M two oh five"), acronyms (RFI, BCF, QC, CSV) and Indian names, and rupee amounts (₹48,00,000 → "48 laakh rupees"); the subtitles keep the written form.
- **Cards** (title, chapter, lifecycle, summary) are rendered inside the demo page by `lib/cards.js`, using the product's own fonts, colour tokens, state chips and Lucide icons.

## Requirements

- Node 22 and the `playwright` package with its Chromium (`require('playwright')` must resolve).
- `ffmpeg` and `ffprobe` with libx264 and AAC.
- Python 3.11+ with `kokoro-onnx`, `soundfile`, `numpy`, `pillow` (`pip install kokoro-onnx soundfile pillow`).
- Inter fonts in `/usr/share/fonts/opentype/inter` (lower thirds), or change `FONT_DIR` in `compose.py`.
- Kokoro model files (Apache-2.0):
  - `KOKORO_MODEL`: `model_quantized.onnx` from `onnx-community/Kokoro-82M-v1.0-ONNX`. The npm package `kokoro-q8-shards@1.0.0` redistributes it in six parts: `cat kokoro-q8.part{0..5}.bin > kokoro-q8.onnx` (sha256 `fbae9257…a1478`).
  - `KOKORO_VOICES`: a `.npz` of voice style tensors. Build it from the `voices/*.bin` files in the npm package `kokoro-js@1.2.1`:
    ```python
    import numpy as np, glob, os
    np.savez("voices.npz", **{os.path.basename(f)[:-4]: np.fromfile(f, np.float32).reshape(-1, 1, 256) for f in glob.glob("package/voices/*.bin")})
    ```

## Run

```bash
export KOKORO_MODEL=/path/kokoro-q8.onnx KOKORO_VOICES=/path/voices.npz PY=python3 WORKERS=3
product-walkthrough/pipeline/run-all.sh /tmp/wt-build product-walkthrough
```

About 6 minutes to record, 10 minutes to synthesise the voice (cached afterwards in `TTS_CACHE`), and 15 minutes to render on 4 CPU cores.

The 12-minute cut uses the same pipeline with its own scenes (`scenes-short/`) and burned-in subtitles:

```bash
product-walkthrough/pipeline/run-short.sh /tmp/wt-short product-walkthrough/short
```

`WT_SUBS_SAFE=1` (recording) drops the card footer and keeps card content above the subtitle area; `BURN_SUBS=1` (planning and rendering) draws each subtitle cue into the picture and raises the role lower-thirds above it. The soft subtitle track and the `.srt` file are written as usual.

Useful while editing:

```bash
node product-walkthrough/pipeline/record.cjs --build /tmp/wt --only portfolio,register   # record some chapters
python3 product-walkthrough/pipeline/preview.py /tmp/wt portfolio                       # contact sheets of each step
```

## Files

| File | Purpose |
|---|---|
| `record.cjs` | Runs the scenes against the demo and writes keyframes and the timeline |
| `lib/recorder.cjs` | Recorder API used by scenes: `as(role)`, `go`, `click`, `type`, `select`, `check`, `files`, `zoom`, `hl`, `scrollTo`, `card` |
| `lib/cards.js` | Title, chapter, lifecycle, tiles, device and summary cards (runs in the page) |
| `scenes/a-intro.cjs` … `g-admin.cjs` | The 22 chapters: each step has narration (`say`) and actions (`act`) |
| `scenes-short/short.cjs` | The 12-minute cut: 14 parts, run with `record.cjs --scenes scenes-short/index.cjs` |
| `tts.py` | Narration audio per step with sentence timings |
| `compose.py` | Planning, frame rendering and encoding, audio mix, subtitles, chapter markers |
| `features.py` | Feature catalogue and feature-to-step coverage map |
| `report.py` | Generates the storyboard, narration script, feature inventory and coverage report from the build (`--short`: storyboard, narration and chapters only) |
| `preview.py` | Contact sheets for reviewing a recording |
| `run-all.sh` | End-to-end build of the full walkthrough |
| `run-short.sh` | End-to-end build of the 12-minute cut (burned-in subtitles) |

To change the video, edit a scene's `say` or `act`, add features to `features.py`, and rebuild; the documents regenerate from the build so they stay in step with the MP4.
