# DrawingOps · 60-second client demo

**Ask:** a short client demo that looks premium and moves fast. It must still be easy to follow, show every part of the product, and carry subtitles.

**Run:** `/brag` on Opus 5.5, so `/brag-slim`. I build everything myself: visuals, voice, music and render.

**Deviations from the skill defaults, at the user's request:**
- **Length:** about 60 s instead of 20 s. "All the features", told clearly, needs a minute.
- **Voice:** a short voiceover with burned-in subtitles. The subtitles need something to follow. The voice is Kokoro `af_heart`, the provider brag uses for `--voice`.

**Format:** landscape, 1920×1080, 30 fps.

**Tone:** `polished` with `app-store` feature cards. One feature per scene, real UI in every scene, and fast because of motion and cuts rather than text flashing past.

## Rubric

- **What is it:** drawing and deliverable control for architecture and MEP design firms, working alongside AutoCAD and Revit.
- **Who is it for:** the firm's owner, project leads, discipline leads, designers, reviewers, document controllers and accounts. It is sold to the principal who wants to see the practice without phoning anyone.
- **What it does for them:** one live record of every sheet, from the day it is planned to the day it is invoiced. It shows who owns each sheet, where it stands, what is late, who is overloaded, and what the client holds.
- **What sets it apart:**
  - A sheet exists before any file does.
  - One click issues a numbered transmittal and supersedes every older revision.
  - A stage tells Accounts when it is ready to invoice.
  - Site only ever sees the current set.
- **Most impressive claim:** every dashboard number opens the exact list behind it, and issuing supersedes older revisions automatically.
- **Visual hook:** three questions a principal asks every week, each answered by a real fragment of the product:
  - "Which drawings are late?" with a real register row carrying its Late flag.
  - "Who's overloaded?" with a real 116 % workload cell.
  - "Is site on the latest set?" with a real superseded revision.
- **Real UI:** 2× captures from the interactive demo (`demo/demo.html`), driven through the real flows by `work/capture.cjs`.
  - The data is the demo's fictional firm, so there is no personal data.
  - Simulated integrations are labelled on screen.
- **Share line:** "DrawingOps in 60 seconds: every sheet, revision and deadline of an architecture and MEP firm, in one live record."

## Visual identity

- **Product tokens:**
  - primary `#0B5FA5`, light primary `#5AA7E8` / `#7DBAEE`
  - navy `#0D1B2A` (the walkthrough cards)
  - the state and flag colours from `demo/css/tokens.css`
  - the demo's Lucide icons
- **Type:** Inter (Display for headlines, 600 and 700), and IBM Plex Mono for eyebrows and sheet numbers, the product's mono face.
- **Stage:** deep navy with a faint drafting grid and soft brand-blue glows. The grid nods to the drawings this product manages.
- **UI cards:**
  - real captures in rounded cards, 18 px radius, with a hairline border and a long soft shadow;
  - a slight 3D settle as they arrive, then a slow drift so nothing is ever static;
  - a cursor and a brand-blue ring on the real element positions for simulated clicks.
- **Layout:** each feature scene has a left rail with a mono eyebrow, a two-line title and a role pill. Real UI sits on the right. The bottom 150 px is kept clear for subtitles.
- **Transitions:** staggered. The old content lifts out, then the new settles in, dipping through the stage. There are no muddy crossfades between busy layouts.

## Storyboard (as built)

The tempo is 120 BPM: one beat is 0.5 s and one bar is 2 s. Scene lengths come from the measured voice, rounded up to whole beats, so every cut lands on a beat. **Total running time: 62.5 s.**

| # | Time | Scene | On screen (all UI is real demo captures) | Voiceover |
|---|---|---|---|---|
| 1 | 0.0–5.0 | Hook | Three questions land one by one. Each comes with its real evidence: the Late sheets metric and late list; the Over-allocated metric and the 116 % workload row (red ring); the M-205 drawing stamped SUPERSEDED with its revisions card | "Which drawings are late? Who's overloaded? Is site on the latest set?" |
| 2 | 5.0–10.0 | Reveal | Logo and wordmark lock-up; tagline; six feature pills; "Works alongside AutoCAD and Revit". The real M-205 drawing sits behind as a faint blueprint | "DrawingOps answers all three, for architecture and MEP firms." |
| 3 | 10.0–15.0 | 01 Portfolio | "The whole practice, on one page." Five metric cards land, the projects table settles, the cursor clicks Late sheets, and the late list rises | "Owners see every project on one page, and every number opens its list." |
| 4 | 15.0–19.0 | 02 Register | "Every sheet, from day one." Register, then the "OT duct" search with the M-205 row ringed, then the sheet header | "Every sheet lives in one register, from planned to issued." |
| 5 | 19.0–25.0 | 03 Drawings in | "Excel, PDFs, CAD. Checked on entry." Import preview (problem rows ringed); PDF matching (title-block match ringed); CAD proposals with the cursor clicking Accept. Tagged *simulated in this demo* | "Import Excel lists, drop in PDFs, or sync from Revit and AutoCAD." |
| 6 | 25.0–30.5 | 04 Checking | "Checked before it leaves." The cursor ticks the four pre-check items and submits; the review queue (A-107 ringed); Sunita's "Senior QC needed: A-107" | "Designers submit with a checklist. Leads review, with senior QC built in." |
| 7 | 30.5–35.5 | 05 Issue | "One click. Issued, superseded." Issue composer (A-104 naming block, cursor on Rename), then the cover sheet PDF, then "13 sheets issued … 7 earlier revisions became superseded" | "One click issues a numbered transmittal, and supersedes older revisions." |
| 8 | 35.5–40.5 | 06 Client & site | "No login. Just the current set." Client email, then the cursor opens the secure page and clicks Acknowledge receipt; the toast; the phone site view | "Clients acknowledge from a secure link, and site only sees the current set." |
| 9 | 40.5–45.5 | 07 Hand-offs | "Every hand-off, in the right inbox." Mailbox of real notification emails (tagged *demo mailbox, nothing is sent*); Deepa's bell; the bounced recipient ringed, then resent | "Every hand-off notifies the next person, and every email is tracked." |
| 10 | 45.5–49.5 | 08 Billing | "Issued and approved? Ready to invoice." Billing signals with the Mysuru stage ringed; the signed push (tagged *simulated in this demo*) | "Approved stages signal Accounts, ready to invoice." |
| 11 | 49.5–55.5 | 09 Everything else | "Run the whole practice." A bento grid fills word by word: workload (over-allocation in red), site RFIs, reports, advisory forecasts (*simulated figures*), audit trail | "Plus workload, site RFIs, reports, advisory forecasts and a full audit trail." |
| 12 | 55.5–62.5 | Outro | "Eight roles. One live record." Eight role pills, then the lock-up "Every sheet. Every revision. Every deadline." / "Built by LatentIQ" / "Interactive prototype · fictional data · integrations simulated" | "Eight roles, one live record. DrawingOps, by LatentIQ." |

The poster is the settled reveal frame (9.5 s). It is baked in as frame 0.

## Sound

- **Music:** an original 120 BPM track in D major (vi–IV–I–V: Bm, G, D, A).
  - Hook: a soft pad and filtered pluck only.
  - Reveal: the kick and bass enter.
  - Features: the full groove of kick, offbeat hats, soft clap, sub bass and a pluck arpeggio.
  - Outro: drums drop out and the pad resolves to D.
- **Effects:** cuts get a soft air whoosh and a quiet tonal tick tuned to the key, all on the same beat grid and mixed under the music.
- **Mix:**
  - The music ducks under the voice.
  - The voice sits on top at about −16 LUFS integrated.
  - Nothing peaks above −1 dBFS.

## Subtitles

The voiceover text is burned in at the bottom centre, two lines at most, in Inter SemiBold on a translucent navy pill. The same cues are also saved as `brag.srt`.

## Build

All files are in `work/`; run them from this folder.

1. `node work/capture.cjs`
   - Drives `demo/demo.html` per role and saves 2× captures and element positions to `work/captures/`.
   - Render the PDFs with `pdftoppm -r 160 -png -singlefile …`.
2. Voice: `python product-walkthrough/pipeline/tts.py work/vo --speed 1.05`, with Kokoro, voice `af_heart`.
3. `python work/prep.py` writes:
   - `comp/timeline.js` (scene times, word times, subtitle cues);
   - `brag.srt`;
   - `vo/placement.json`.
4. `node work/render.cjs --stills …` gives frames to check. `node work/render.cjs --video work/video-silent.mp4 --poster 9.5` renders the video.
5. `python work/sound.py` writes `work/audio/mix.wav`: the music, the effects and the voice ducking the music.
6. Mux at −16 LUFS:
   ```
   ffmpeg -i work/video-silent.mp4 -i work/audio/mix.wav -map 0:v -map 1:a -c:v copy -af volume=-1dB -c:a aac -b:a 192k brag.mp4
   ```
