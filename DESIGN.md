# DESIGN.md · DrawingOps

The design system and screen specification for DrawingOps. Coding agents and designers should treat this file as the source of truth for look, layout and interaction; `docs/03-features-and-functionality.md` is the source of truth for behaviour.

**Design goal:** a project lead should understand a project's health in 5 seconds and change a sheet's status in 1 click. It is a dense, calm working tool used all day, not a marketing site.

---

## 1. Principles

1. **Status at a glance.** Every sheet, stage and person shows its state and its flags in the same place, in the same form, everywhere.
2. **One click at the real event.** Start, Submit, Approve, Issue are single, obvious buttons on the item; there are no status forms to fill in.
3. **Dense but quiet.** Tables first, compact rows, muted chrome; colour is reserved for status and flags.
4. **Never colour alone.** Every status is colour + icon + word (WCAG 2.2 AA, N-04).
5. **Irreversible means explicit.** Issue, cancel and supersede show a confirmation that says exactly what will happen ("Issue 12 sheets to 3 recipients as GFC. Earlier revisions become superseded.").
6. **Plain language.** "Sent for check", not "Workflow state transitioned". Architects' terms are kept (GFC, RCP, transmittal); software jargon is not.

## 2. Design tokens

Define these as CSS custom properties on `:root`, with the dark set under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`. Every text/background pair below was checked for WCAG AA contrast (≥ 4.5:1) on 23 Oct 2026; the lowest is `cancelled` at 4.85:1.

### 2.1 Colour: base

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F8FA` | `#0F141A` | App background |
| `--surface` | `#FFFFFF` | `#151B23` | Cards, tables, panels |
| `--surface-muted` | `#F1F3F6` | `#1C232C` | Table header, hover row, inputs |
| `--border` | `#D9DEE5` | `#2E3742` | Dividers, input borders |
| `--text` | `#16202C` (16.4:1 on surface) | `#E6EAF0` (14.3:1) | Body text |
| `--text-muted` | `#556172` (6.3:1) | `#9AA6B5` (7.0:1) | Secondary text, labels |
| `--primary` | `#0B5FA5` (white text 6.6:1) | `#5AA7E8` (dark text 7.1:1) | Primary buttons, links, selection |
| `--primary-hover` | `#094D86` | `#7DBAEE` | Hover |
| `--focus-ring` | `#2B7FFF` | `#7DB3FF` | 2 px focus outline, 2 px offset |

### 2.2 Colour: sheet states

Each state is a chip: tinted background, dark text, 1 px border in the text colour at 30% opacity, icon on the left.

| State | Label | Icon (Lucide) | Light text / bg | Contrast | Dark text / bg | Contrast |
|---|---|---|---|---|---|---|
| `planned` | Planned | `circle-dashed` | `#3D4A5C` / `#EEF1F5` | 7.95 | `#C9D1DC` / `#2A323D` | 8.41 |
| `in_progress` | In progress | `pencil` | `#0B4F8A` / `#E6F0FB` | 7.29 | `#9CC8F2` / `#132A42` | 8.32 |
| `ready_for_check` | Ready for check | `send` | `#5B34A8` / `#F0EBFB` | 7.19 | `#C9B5F2` / `#2A2140` | 8.18 |
| `in_check` | In check | `search-check` | `#8A5300` / `#FDF3E1` | 5.75 | `#F2C77A` / `#3A2C12` | 8.54 |
| `changes_requested` | Changes requested | `undo-2` | `#A33E0B` / `#FDEBE2` | 5.59 | `#F5A57E` / `#3D2216` | 7.34 |
| `approved_for_issue` | Approved for issue | `badge-check` | `#0B6B5E` / `#E3F5F2` | 5.68 | `#84D6C8` / `#123631` | 7.78 |
| `issued` | Issued · C02 | `send-horizontal` | `#1D6B2F` / `#E5F5E8` | 5.81 | `#8FD39C` / `#163420` | 7.74 |
| `superseded` | Superseded (text struck through) | `archive` | `#5F6368` / `#F1F1F1` | 5.36 | `#A9AEB5` / `#262A30` | 6.46 |
| `on_hold` | On hold | `pause` | `#4A5568` / `#ECEFF3` | 6.52 | `#B8C2CF` / `#262D37` | 7.70 |
| `cancelled` | Cancelled | `x-circle` | `#6B6B6B` / `#F4F4F4` | 4.85 | (as on_hold) | – |

### 2.3 Colour: flags

Flags sit beside the state chip as small pills with an icon. They are the only "alarm" colours in the product.

| Flag | Label | Icon | Light text / bg | Dark text / bg |
|---|---|---|---|---|
| At risk | "Due in 4 days" | `clock-alert` | `#8A5300` / `#FFF4D6` (5.78) | `#F2C77A` / `#3A2C12` (8.54) |
| Late | "Late 3 days" | `alarm-clock-off` | `#A61B1B` / `#FDE7E7` (6.36) | `#F59A9A` / `#3D1A1A` (7.33) |
| Over-allocated | "132%" | `trending-up` | `#A61B1B` / `#FDE7E7` | `#F59A9A` / `#3D1A1A` |
| Under-allocated | "38%" | `trending-down` | `#0B4F8A` / `#E6F0FB` (7.29) | `#9CC8F2` / `#132A42` |
| Timesheet missing | "Hours missing" | `timer-off` | as At risk | as At risk |
| Ready to invoice (P2) | "Ready to invoice · 9 days" | `receipt-indian-rupee` | as Issued | as Issued |

### 2.4 Typography

| Token | Value |
|---|---|
| `--font-sans` | "Inter", system-ui, sans-serif (SIL Open Font License) |
| `--font-mono` | "IBM Plex Mono", ui-monospace, monospace (SIL OFL) — sheet numbers, revision codes, transmittal numbers |
| Numbers | `font-variant-numeric: tabular-nums` in all tables and dashboards |

| Style | Size / line height / weight | Use |
|---|---|---|
| `display` | 24 / 32 / 600 | Page title |
| `title` | 18 / 26 / 600 | Section and card titles |
| `body` | 14 / 20 / 400 | Default text, table cells |
| `body-strong` | 14 / 20 / 600 | Emphasis, sheet number |
| `small` | 12 / 16 / 400 | Meta, timestamps, chip text |
| `metric` | 28 / 32 / 600 tabular | Dashboard numbers |

### 2.5 Space, shape, depth, motion

| Token | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32, 48 px |
| Radius | 4 px inputs and chips · 8 px cards and panels · 12 px dialogs |
| Borders | 1 px `--border`; no shadows on cards, 1 shadow level for menus and dialogs only (`0 8px 24px rgb(0 0 0 / 0.12)`) |
| Table rows | 36 px compact (default), 44 px comfortable (user setting) |
| Motion | 120 ms ease-out for hover/press, 180 ms for panels; none when `prefers-reduced-motion` |
| Breakpoints | `sm` 360 · `md` 768 · `lg` 1280 (design target) · `xl` 1600 |

## 3. Layout and navigation

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ ▣ DrawingOps   [ Search sheets, projects, transmittals…  ⌘K ]     🔔 3   NP ▾ │  top bar 56 px
├──────────────┬────────────────────────────────────────────────────────────────┤
│ ⌂ My work    │  Page title                                     [Primary action] │
│ ▦ Portfolio  │  breadcrumb · filters                                            │
│ ▤ Projects   │ ┌──────────────────────────────────────────────────────────────┐ │
│ ✓ Reviews  4 │ │                                                              │ │
│ ▥ Workload   │ │   content (tables, cards, viewer)                            │ │
│ ◷ Timesheets │ │                                                              │ │
│ ⇄ Transmittals│ │                                                              │ │
│ ─────────    │ └──────────────────────────────────────────────────────────────┘ │
│ ⚙ Admin      │                                                                  │
└──────────────┴────────────────────────────────────────────────────────────────┘
  left nav 232 px, collapsible to 64 px icons
```

- **Left nav** items show by role: Portfolio for Owner and PLs; Admin for Admins; Reviews shows a count of items waiting for the user.
- **Project sub-navigation** (tabs under the project title): Overview · Register · Stages · Transmittals · Team & hours · Activity · Comments (P2) · Construction (P3: RFIs, Submittals, Site, Changes, Clashes).
- **Global search** (`⌘K` / `Ctrl+K`) opens a command palette: sheets, projects, transmittals, contacts, and actions ("Go to Workload").
- **Notifications** bell opens a right-hand panel; each item links to its object; "Mark all read".

## 4. Components

Build on accessible primitives (Radix), styled with the tokens. Every data component has five states: loading (skeleton rows), empty (one sentence + one action), error (message + retry), partial (some data failed, banner), and success.

| Component | Spec |
|---|---|
| `StatusChip` | Props: `state`, `revision?`. Icon + label; `issued` appends revision code in mono. Never truncates the word; min width 0. |
| `FlagPill` | Props: `kind`, `text`. Icon + short text; tooltip with rule and date raised. |
| `ActionBar` | The 1–2 next actions allowed for this user on this sheet (from the API's `allowed_actions`), primary first. Disabled actions are hidden, not greyed, except "Issue" which shows why it is blocked ("Upload PDF first"). |
| `DataGrid` | TanStack Table + Virtual. Sticky header and first column (sheet number); column chooser; saved views; multi-select with shift-click; inline edit for owner, checker, planned date, package; keyboard: arrows, Enter to open, Space to select. |
| `FilterBar` | Chips for discipline, stage, state, flag, owner, package; "Late only" and "At risk only" quick toggles; filters reflected in the URL. |
| `MetricCard` | Big number + label + delta vs last week + link to the list behind it. |
| `BurnUpChart` | Planned vs issued sheets over time per discipline (Recharts); planned line dashed, issued line solid; today marker. |
| `Heatmap` | People × weeks, cell = % of capacity with number shown; colour + text; click → allocation drawer. |
| `PdfViewer` | PDF.js; fit-to-width default; zoom, pan, page thumbnails hidden for single-sheet PDFs; superseded banner; download button (watermarked when superseded). |
| `Timeline` | Vertical list of state changes, reviews, revisions and transmittals, newest first, with actor and time. |
| `Drawer` | Right side, 480 px, for quick edits (assign, allocate, review) without leaving the list. |
| `ConfirmDialog` | Title states the action; body lists the consequences; primary button repeats the verb ("Issue 12 sheets"). |
| `UploadDropzone` | Drag-drop many PDFs; matches each file to a sheet by number in the file name (and title-block text in P2); unmatched files listed for manual pick; progress per file. |
| `Toast` | Bottom-right, 5 s, with Undo where the action can be undone (assignments, dates); never for errors that need action. |
| `EmptyState` | Illustration-free: one line + one primary action ("No sheets yet. Import your Excel register."). |

## 5. Screens

IDs (S-nn) are referenced from `TRACKER.md`. Wireframes are layout guides, not pixel specs.

### S-01 Sign in (F-40)
One card: firm logo, "Sign in with Microsoft" or "Sign in with Google" (whichever is configured), "Use email and password" link for local accounts, TOTP step for admins.

### S-02 My work (D-04, F-23)
```text
My work                                                     Week 44 · 27-Oct-2026
┌ Due soon ──────────────────────────────────────────┐ ┌ Hours this week ────────┐
│ A-101 Ground Floor Plan   ▸In progress  ⏰ Due in 4d │ │ 32 / 45 h  ▓▓▓▓▓▓▓░░░   │
│ M-205 OT Ductwork L2      ▸In progress  ⛔ Late 2d   │ │ [Open timesheet]        │
│ …                                       [Submit ▸]  │ └─────────────────────────┘
├ Returned to you ───────────────────────────────────┤ ┌ Waiting for your check ─┐
│ E-310 Lighting L3   ↩ Changes requested  by RK 1d  │ │ 3 sheets · oldest 2 d   │
└────────────────────────────────────────────────────┘ └─────────────────────────┘
```
Each row has its next action button on the right.

### S-03 Portfolio (D-01, F-22)
```text
Portfolio                          Active projects 38 · Updated 10:45  [Export]
┌ Late sheets ─┐ ┌ At risk ─┐ ┌ Oldest review ─┐ ┌ Over-allocated ─┐ ┌ Ready to invoice (P2) ┐
│     27  ▲4   │ │   61     │ │   9 days       │ │   12 people     │ │   5 stages · ₹38,40,000│
└──────────────┘ └──────────┘ └────────────────┘ └─────────────────┘ └───────────────────────┘
Project            Stage            Sheets issued/planned   Late  At risk  Lead   Next stage date
2026-014 HSR Blk B  4 Working dwgs   212 / 340  ▓▓▓▓▓░░      9     14      AK     15-Nov-2026
2026-009 Raipur OPD 3 Approvals       48 / 60   ▓▓▓▓▓▓▓░     0      3      SM     02-Nov-2026
…
┌ Discipline workload, next 4 weeks ───────────────────────────────────────────┐
│ Architecture  92%  104%  88%  71%     HVAC  118% 121% 97% 80%   …            │
└──────────────────────────────────────────────────────────────────────────────┘
```
Rows sort by "Late" by default. Every number is a link to the filtered list.

### S-04 Project overview (D-02, F-23)
Header: project code + name, client, stage chip, lead, CAD versions. Cards: sheets planned vs issued (burn-up per discipline), late list (top 10), stage timeline (horizontal, current stage highlighted), team allocation this week, recent transmittals, (P2) open client comments.

### S-05 Register (F-04, F-05, F-46, F-52)
```text
HSR Block B › Register        [Import Excel] [Upload PDFs] [+ Sheet]  [Export]
Discipline: All ▾  Stage: 4 Working dwgs ▾  State: All ▾  Owner ▾  ☐ Late only ☐ At risk only   Saved view: My HVAC ▾
┌────┬────────┬───────────────────────────┬──────┬─────────────┬────────────────────┬──────────┬────────┬────────┐
│ ☐  │ Sheet  │ Title                     │ Disc │ Owner       │ State              │ Planned  │ Rev    │ Flags  │
├────┼────────┼───────────────────────────┼──────┼─────────────┼────────────────────┼──────────┼────────┼────────┤
│ ☐  │ A-101  │ Ground Floor Plan         │ A    │ Priya S     │ ▸ In progress      │ 31-Oct   │ P03    │ ⏰ 4d  │
│ ☐  │ A-102  │ First Floor Plan          │ A    │ Priya S     │ ✓ Issued · C01     │ 20-Oct   │ C01    │        │
│ ☐  │ M-205  │ OT Ductwork Level 2       │ M    │ Rahul K     │ ⌕ In check         │ 22-Oct   │ P02    │ ⛔ 2d  │
└────┴────────┴───────────────────────────┴──────┴─────────────┴────────────────────┴──────────┴────────┴────────┘
3 selected: [Assign owner] [Set checker] [Shift dates ±] [Move to package] [Change state ▾]
```
- Inline edit on Owner, Checker, Planned date, Package; changes save on blur with toast + Undo.
- Clicking a row opens S-06; Shift+click selects ranges.
- Group-by toggle: discipline, package, stage.

### S-06 Sheet detail (F-06, F-07, F-10, F-11, F-47, F-48)
```text
A-101 · Ground Floor Plan                     ▸ In progress  ⏰ Due in 4 days
Architecture · Stage 4 Working drawings · Package: Arch GFC set · Owner Priya S · Checker Anil K
[Submit for check ▸]  [⋯ Hold · Cancel · Reassign]
┌──────────────────────────────────────────────┬─────────────────────────────────┐
│                                              │ Revisions                        │
│            PDF viewer (current rev)           │  P03  draft   (uploaded today)   │
│                                              │  C01  issued  20-Oct · TR-0012   │
│                                              │  P02  superseded 20-Oct          │
│                                              ├─────────────────────────────────┤
│                                              │ Activity                         │
│                                              │  10:12 Priya started P03         │
│                                              │  20-Oct Issued C01 for GFC (DC)  │
│                                              │  19-Oct Anil approved            │
└──────────────────────────────────────────────┴─────────────────────────────────┘
CAD file: \\fileserver\2026-014\ARCH\A-101.dwg  [Copy path]
```
Superseded revisions open with a red-bordered banner: "Superseded on 20-Oct-2026 by C01. Do not use for construction."

### S-07 Issue and transmittal composer (F-14, F-08)
Three steps in one page, not a multi-page wizard:
1. **Sheets:** list of selected approved sheets, each with its draft PDF (or drop zone to add it); blocked rows explain why.
2. **Purpose and recipients:** purpose (required), recipients from contacts (chips), optional note.
3. **Preview:** cover sheet preview (PDF), summary: "Issue 12 sheets to 3 recipients for GFC. 9 earlier revisions become superseded. 2 previous recipients will be told."
Primary button: **Issue 12 sheets**. After issue: success page with transmittal number, copy-link, and "Back to register".

### S-08 Review queue (F-11; F-12 in P2)
Table: sheet, project, designer, submitted (working days ago), stage, senior QC needed? Row actions: Open (side-by-side: PDF left, review panel right with Approve / Return, comment box, redline upload).

### S-09 Workload (F-17, F-19)
```text
Workload · Architecture ▾   Weeks 44–51                         [Allocate]
Person          W44    W45    W46    W47    W48 …
Priya S        104%    96%    88%    60%    40%
Rahul K       ⛔132%  ⛔121%   98%    90%    75%
Meera T        ↓38%   ↓42%    70%    85%    90%
```
Cell click opens a drawer listing allocations (project, stage, hours) with inline edit and "copy to next weeks".

### S-10 Timesheet (F-18)
Week grid: rows = project · stage the person is on; columns Mon–Sun (Sat/Sun shaded per work week); totals per day and row; "Submit week" button; approved weeks read-only with a lock icon. DL view adds "Approve" per person and a list of missing timesheets.

### S-11 Stage plan editor (F-02, F-03)
Table of stages: name, fee %, planned start, planned end, required purposes, senior QC required, state. Footer shows fee total (must be 100%). "Apply template" button. Attachment slot for the appointment letter.

### S-12 Import wizard (F-05, F-54)
Upload → column mapping (auto-guessed, editable) → preview with row-level errors (red row, reason in the last column) → commit → result with "Undo import" (24 h).

### S-13 Notifications centre and preferences (F-21)
Panel list grouped by Today / Earlier; preferences page: table of events × Instant / Digest / Off; mandatory events locked with an explanation.

### S-14 Admin settings (F-42, F-43, F-38, F-40)
Sections: Organisation · Disciplines · Stage templates · Revision codes · Purpose codes · Naming rules (with live tester: paste a file name, see pass/fail) · Working calendar · Automation thresholds · Users and roles · Contacts · Integrations · Audit export.

### S-15 External transmittal page (F-14; F-15 in P2)
Public, token link, no login: firm logo, transmittal number, purpose, sender, list of sheets with download buttons and "Download all (ZIP)"; P2 adds "Acknowledge receipt". Expired link shows who to contact.

### Later-phase screens
| Screen | Phase | Summary |
|---|---|---|
| S-16 Client comments log | P2 | Table per project: source, received, linked sheets, assignee, status, response; drawer to respond; email-ingested items show the original email |
| S-17 Billing signals | P2 | Accounts view: stages ready to invoice, fee %, amount (₹ with Indian grouping), days waiting, Export CSV, Mark invoiced |
| S-18 Site view | P2 | Mobile, read-only current issued set per project, search by sheet number, large tap targets (44 px) |
| S-19 Checklists admin and pre-check panel | P2 | Checklist builder; tick list shown in the Submit dialog |
| S-20 RFI, submittal, site report, change-order logs | P3 | Same register pattern: table + detail with linked sheets and "ball in court" |
| S-21 Clash issues | P3 | Imported BCF topics with viewpoint thumbnail, discipline, status, linked sheets |
| S-22 Knowledge search | P3 | Search across decisions, comments, RFIs with project and discipline filters |
| S-23 Predictions panel | P4 | Advisory risk score with top reasons on S-03/S-04/S-06; clearly labelled "Forecast" |

## 6. Interaction rules

- **Allowed actions come from the server.** Every sheet payload includes `allowed_actions` for the current user; the UI never re-implements the state machine.
- **Optimistic updates** only for non-destructive edits (owner, dates); transitions wait for the server and show a spinner on the button.
- **Undo** for assignments, date changes and imports (24 h); no undo for Issue (it sends email): use a confirmation instead.
- **Keyboard shortcuts** (shown with `?`): `⌘K` search, `g r` go to register, `j/k` next/previous row, `Enter` open, `x` select, `s` submit for check (on own sheet), `a` approve (in review), `e` edit field.
- **Bulk feedback:** a bulk action reports "47 updated, 3 skipped" with a link listing the skipped rows and why.
- **Live freshness:** dashboards show "Updated hh:mm"; lists refetch on window focus and every 60 s.

## 7. Content and formats

| Item | Rule | Example |
|---|---|---|
| Dates | `DD-Mon-YYYY`; relative for recent ("2 days ago"); due dates in working days | 23-Oct-2026 · Due in 4 days |
| Times | 24-hour, IST unless user changes timezone | 14:30 |
| Money (P2) | ₹ with Indian grouping | ₹38,40,000 |
| Sheet numbers, revisions, transmittals | Mono font, never wrapped | `A-101` · `C02` · `2026-014-TR-0012` |
| Purposes | Full words; never bare "IFC" | Good for Construction (GFC) |
| Errors | Say what happened and what to do | "File name A101.pdf doesn't match rule `A-###`. Rename to A-101.pdf." |
| People | First name + last initial in tables; full name in detail | Priya S |

## 8. Accessibility (N-04)

- WCAG 2.2 AA on every P1 screen; axe-core checks in CI.
- Visible focus ring (`--focus-ring`, 2 px) on every interactive element; logical tab order; skip-to-content link.
- Tables use real `<table>` semantics with header scopes; the virtualised grid keeps `aria-rowcount`/`aria-rowindex`.
- Status chips and flags expose their full text to screen readers ("State: In check. Flag: Late by 2 working days.").
- Targets ≥ 24 × 24 px (44 × 44 px on S-18 site view).
- Charts have a "View as table" toggle.
- Respect `prefers-reduced-motion` and browser zoom to 200% without horizontal scrolling on S-02 and S-18.

## 9. Responsive behaviour

| Screen | ≥ 1280 | 768–1279 | 360–767 |
|---|---|---|---|
| Portfolio, project, register, workload | Full | Columns collapse into a column chooser; left nav collapses | Read-only summary cards; register shows number, title, state |
| My work, notifications | Full | Full | Full (designed for phone) |
| Sheet detail | Viewer + side panel | Viewer above, panel below | Panel only; "Open PDF" opens the viewer full-screen |
| Site view (P2) | – | Full | Primary target |

## 10. Dark mode

Supported from P1 through the tokens above (all pairs AA). Default follows the OS; user can override in profile.
