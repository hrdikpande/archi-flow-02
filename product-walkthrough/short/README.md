# DrawingOps · 12-minute walkthrough

A shorter, client-facing cut of the [complete walkthrough](../README.md). Every part of the product appears briefly. The core of daily work gets more time: the portfolio, projects and fee stages, the register and drawing management, issue and issue tracking, the client's side, and billing. Two parts are new in this cut: how email keeps everything tracked, and how the roles hand work to each other. Subtitles are burned into the picture.

| File | What it is |
|---|---|
| [`drawingops-walkthrough-12min.mp4`](drawingops-walkthrough-12min.mp4) | The video: 11:42, 1920×1080, 30 fps, H.264 + AAC, English narration, burned-in English subtitles, 14 chapter markers |
| [`drawingops-walkthrough-12min.srt`](drawingops-walkthrough-12min.srt) | The same subtitles as a file. A matching soft track is also inside the MP4, switched off by default so captions never show twice |
| [`chapters.txt`](chapters.txt) | Chapter timestamps (paste into YouTube/Vimeo descriptions) |
| [`video-storyboard.md`](video-storyboard.md) | Every scene: time, screen, on-screen actions and narration |
| [`narration-script.md`](narration-script.md) | The complete narration in video order, with times |

## What is in it

| Part | Starts | Depth | Covers (chapters of the complete walkthrough) |
|---|---|---|---|
| 00 Introduction | 00:00 | | 00: what DrawingOps is, the sheet lifecycle, how this video was recorded |
| 01 Signing in and roles | 00:46 | Brief | 01: single sign-on, two-factor for admins, the eight roles, role-based navigation |
| 02 The owner's portfolio | 01:16 | **Detail** | 02: the five headline numbers, drill-down lists, projects table, workload and forecast, export, alerts |
| 03 Projects, fee stages and teams | 02:15 | **Detail** | 03–04: project dashboard, burn-up, stage timeline, stage plan from the appointment letter, team, activity |
| 04 The register and drawing management | 03:09 | **Detail** | 05–07: register, search, filters, inline edit, bulk bar, Excel import with row checks, PDF upload and matching, CAD sync, sheet page, superseded revisions |
| 05 Drafting and checking | 04:36 | Brief | 08–09: My work, pre-check list on submit, review queue, senior QC |
| 06 Issue and issue tracking | 05:12 | **Detail** | 10: issue composer, naming-rule block and fix, purpose, cover sheet, superseding, transmittal log, matrix, per-recipient tracking |
| 07 The client's side | 06:22 | **Detail** | 11: email with secure link, external page, zip download, acknowledgement, phone site view, acknowledgement back in the app |
| 08 Client comments and approvals | 06:57 | Brief | 12: comment log, client approval of a stage with evidence |
| 09 Billing signals | 07:21 | **Detail** | 13: accounting connection, Accounts home, billing signals, CSV and push, mark invoiced, Accounts' narrow view |
| 10 Everything else | 08:07 | Brief | 14–20: workload, construction stage, command search, reports, automation, intelligence, audit trail |
| 11 Email | 08:59 | **Detail (new)** | Outbound mail, per-person alerts, transmittal delivery and bounces, inbound client email, digests, weekly summary |
| 12 How the roles work together | 10:24 | **Detail (new)** | The hand-off chain from plan to invoice, shown through each person's real notifications from this recording |
| 13 Close | 11:17 | | 21: design-for-trust summary and close |

### Email (part 11)

What the video shows, all in the prototype:

- **Outbound.** Every email the product would send lands in a demonstration mailbox: transmittal links, notifications, new-revision notices, the daily digest, the weekly owner summary and invitations. Filtering by recipient shows that Karthik was emailed when Rahul submitted M-206, and that Meera's ready-to-invoice alert arrived the same way.
- **Tracking.** A transmittal records delivery, download and acknowledgement for each recipient. The bounced email on the previous HSR transmittal is shown, then resent.
- **Inbound.** A client email forwarded to the project's own address becomes a logged comment. Mail from an unknown sender waits in a queue until someone accepts it.
- **Preferences.** Each person chooses instant, digest or off for each alert. Must-not-miss alerts are locked on.

What is simulated: no email is sent or received. The prototype stands in for the firm's mail server (outbound) and for inbound email to the project address. The narration and on-screen labels say so.

### How the roles work together (part 12)

A card sets out the chain: the project lead plans, the discipline lead assigns and checks, the designer submits, the senior reviewer approves, the document controller issues, the client acknowledges, the project lead records approval, Accounts invoices, and the owner sees it all.

The video then opens each person's notification bell, showing what earlier steps of this recording actually produced:

- Sunita: senior QC needed for A-107
- Deepa: A-107 ready to issue, and the client's acknowledgement
- Priya: the transmittal-sent copy
- Meera: ready to invoice
- Nikhil: the project's activity feed

Nothing in this part is staged separately.

## Verified and simulated

- **Driven live in the prototype:** every click, form, import, upload, review, issue, acknowledgement, approval and billing action in the video. The recording ran with 0 recorder errors and 0 page errors: 80 steps, 243 keyframes.
- **Simulated, and labelled in the video:**
  - Microsoft sign-in
  - email delivery and inbound email
  - the Revit and AutoCAD plugins
  - the accounting webhook push
  - the history, accuracy and forecast figures on the intelligence screen
- **Not claimed:** a production deployment, real customer outcomes, or measured performance.

## Before sending it to a client

The same notes as the [complete walkthrough](../README.md#before-sending-it-to-a-client) apply:

- It uses fictional data throughout.
- Prototype-only controls are hidden in the footage.
- No credentials appear on screen.
- The voice is synthetic: Kokoro-82M, Apache-2.0.

To rebuild the video: `pipeline/run-short.sh BUILD_DIR product-walkthrough/short` (see [`pipeline/README.md`](../pipeline/README.md)).
