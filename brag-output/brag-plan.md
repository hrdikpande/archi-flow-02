# DrawingOps · client walkthrough video plan

**Ask:** a professional video a client can watch to understand the whole intended product, covering every module. This is longer than the normal brag length on purpose: about 2:44, set by the music track.

**Format:** landscape 1920×1080, 30 fps. **Tone:** polished, close to app-store (clean feature cards, calm pacing, real UI in every chapter).
**Music:** `happy-beats-business-moves-vol-1` (163.96 s, about 120 BPM). Chapter cuts land on beats where it is easy; readability comes first.

## Rubric

- **What is it:** drawing and deliverable control for an architecture and MEP firm. It covers the sheet register, review states, transmittals, deadlines, workload, fee stages and dashboards, and it sits on top of AutoCAD and Revit.
- **Who is it for:** the firm's owner, project leads, discipline leads, designers, senior reviewers, document controllers, accounts and admins, plus external clients and contractors.
- **What it does for them:** the owner sees which sheets are late, who is overloaded and what is waiting for review, without phone calls. Site never works from a superseded drawing. (Source: docs/01 §1.)
- **What sets it apart:** a sheet exists from the day it is planned, before any file. One state machine covers every sheet, issue automatically supersedes older revisions, and the billing signal fires when a stage's deliverables are issued and the client approves.
- **Most impressive claim:** every dashboard number opens the exact list behind it, and the 08:00 sweep can run twice without sending anything twice.
- **Visual hook:** sheet-state chips (Planned → In progress → Ready for check → In check → Approved → Issued) snap through the real colour tokens.
- **Real UI:** screenshots of the actual demo (`demo/demo.html`) captured at 2× from scripted flows, with the cursor and highlight rings placed on the real element positions.
- **Share line:** "DrawingOps in 2 minutes 44: every sheet, review, transmittal, deadline and fee stage of an architecture and MEP firm, in one register."

## Visual identity

The demo's own tokens: primary `#0b5fa5`, bg `#f7f8fa`, text `#16202c`, state and flag colours from `tokens.css`. Fonts are Inter 400/600 and IBM Plex Mono, taken from `demo/assets/fonts`. Title cards use a deep navy (`#0d1b2a`) derived from the primary. Feature chapters have a light backdrop, a left text rail (chapter number, title, bullets) and the app in a rounded browser window on the right.

## Storyboard

| # | Time | Scene | On screen |
|---|---|---|---|
| 0 | 0–6 | Hook | "Every sheet. Every revision. Every deadline." State chips cascade, then "In one live register." |
| 1 | 6–12 | Reveal | Logo, DrawingOps, "Drawing and deliverable control for architecture and MEP firms, on top of AutoCAD and Revit." |
| 2 | 12–19 | Outcome | The owner sees late sheets, overloads and review waits without phone calls; site never works from a superseded drawing. |
| 3 | 19–26 | Roles | Sign-in (SSO, 2FA), eight role cards |
| 4 | 26–34 | 01 Portfolio | Owner dashboard; the Late sheets metric is clicked and opens its list |
| 5 | 34–42 | 02 Projects and fee stages | Stage plan, 100 % rule, roll-up |
| 6 | 42–52 | 03 Drawing register | Register → bulk bar → import with errors |
| 7 | 52–59 | 04 Sheet detail | PDF viewer, revisions, SUPERSEDED watermark |
| 8 | 59–66 | 05 Designer flow | My work → pre-check checklist |
| 9 | 66–73 | 06 Reviews | Review panel, return needs comment, senior QC, delegation |
| 10 | 73–83 | 07 Issue and transmittals | Naming block → purpose → cover sheet → issue |
| 11 | 83–90 | 08 Client side | Mailbox email → external page → acknowledge, site view |
| 12 | 90–99 | 09 Comments, approval, billing | Comment log → client approval → Ready to invoice → billing |
| 13 | 99–108 | 10 Workload and timesheets | Heat map, timesheet |
| 14 | 108–115 | 11 Alerts and automation | Notifications, rules, sweep |
| 15 | 115–124 | 12 Construction stage | RFIs, submittals, site reports, change orders, clashes |
| 16 | 124–130 | 13 Search and knowledge | ⌘K, knowledge search |
| 17 | 130–136 | 14 CAD and integrations | Revit/AutoCAD sync proposals, integrations |
| 18 | 136–142 | 15 Intelligence (Phase 4) | Forecast and AI findings, advisory |
| 19 | 142–150 | 16 Admin and trust | Naming tester, audit trail, platform badges |
| 20 | 150–157 | Roadmap | P0 → P4 with durations and gates |
| 21 | 157–164 | Outro | Logo, "Built by LatentIQ", how to try the demo |

## Sound

The music bed runs at a steady level, with a 1.5 s fade-in and a 3 s fade-out. Soft UI clicks land on simulated clicks and very quiet keypresses on typing, all mixed well under the music.

## Music cue guidance

Strong beats every 0.5 s from 3.02 s. The hook text lands near 3.0 s and the reveal near 6.0 s. Chapter cuts snap to the nearest 0.5 s beat.
