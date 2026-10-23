# TRACKER · DrawingOps

Every task, feature, automation, dashboard, integration, non-functional requirement and gate, present and future, in one list. Coding agents update the **Status**, **Owner** and **Notes** columns as work moves (see `BUILD_PROMPT.md`). `tracker.csv` holds the same rows for spreadsheets or Jira import; regenerate it if you edit this file by hand, or edit the CSV and regenerate this file.

**Status values:** Not started · In progress · In review · Done · Blocked · Deferred · Conditional · Decision pending · Out of scope

## Summary

| Phase | Items | Features | Automations | Dashboards | Integrations | NFRs | Tasks | Gates |
|---|---|---|---|---|---|---|---|---|
| P0 | 9 | 0 | 0 | 0 | 0 | 0 | 8 | 1 |
| P1 | 68 | 35 | 6 | 5 | 3 | 10 | 8 | 1 |
| P2 | 21 | 11 | 3 | 0 | 6 | 0 | 0 | 1 |
| P3 | 9 | 6 | 1 | 0 | 2 | 0 | 0 | 0 |
| P4 | 6 | 3 | 0 | 0 | 0 | 0 | 2 | 1 |
| Decide in P2 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| Decide at G1 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| OOS | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **118** | **58** | **10** | **5** | **13** | **10** | **18** | **4** |

## Phase 0 · Discovery

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G0 | Gate | Discovery sign-off (01 §9) | Gates | P0 | P0-01..P0-08 |  | 01 §9 |  | Not started |  |  |
| P0-01 | Task | Kickoff; stakeholder map (owner, champion, IT, accounts) | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-02 | Task | Interviews: owner, 3 project leads, 3 discipline leads, document controller, accounts | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-03 | Task | As-is process map per stage with pain evidence (H1-H7) | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-04 | Task | Baseline metrics on >= 2 past projects (D-05 definitions) | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-05 | Task | Inventory: CAD versions, file storage, email/SSO, accounting, timesheets | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-06 | Task | Collect artefacts: appointment letter, live sheet register, naming rules, title block | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-07 | Task | Owner decisions DEC-01, DEC-02, DEC-04, DEC-05, DEC-06 | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |
| P0-08 | Task | Name pilot projects and champions; sign P1 fixed scope and price | Discovery | P0 |  | H1-H7 | 01 §2, §9 |  | Not started |  |  |

## Phase 1 · Visibility (H1–H4) · sprints S1–S6 + pilot

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-38 | Feature | Role-based access per project | M13 Platform | S1 | T-01 | H1 | 03 §16, §17; 02 §11 |  | Not started |  |  |
| F-39 | Feature | Audit trail of every change | M13 Platform | S1 | T-01 | H2 | 03 §16; 02 §5 | S-14 | Not started |  |  |
| F-40 | Feature | SSO (Google/Microsoft) + local accounts with TOTP | M13 Platform | S1 | I-11 | - | 03 §16; 02 §11 | S-01 | Not started |  | Provider: DEC-02 |
| F-41 | Feature | Issued PDFs in object storage; CAD files linked | M13 Platform | S1 | T-01 | H2 | 03 §16; 02 §9 | S-06 | Not started |  |  |
| F-42 | Feature | Organisation settings: disciplines, templates, codes, calendar, rules, thresholds | M01 Projects and stages | S1 | T-01 | - | 03 §5 | S-14 | Not started |  | Work week: DEC-04 |
| F-43 | Feature | Contacts and external organisations | M01 Projects and stages | S1 | T-01 | - | 03 §5 | S-14 | Not started |  |  |
| I-11 | Integration | SSO: Google Workspace or Microsoft 365 | M14 Integrations | S1 | DEC-02 |  | 03 §19 |  | Not started |  |  |
| I-12 | Integration | Outbound email (SMTP relay or transactional service) | M14 Integrations | S1 | T-01 |  | 03 §19 |  | Not started |  |  |
| N-03 | NFR | Security baseline (ASVS L2 checklist, HTTPS, CSP, scans) | M13 Platform | S1 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-05 | NFR | Observability: errors, logs, metrics, missing-sweep alert | M13 Platform | S1 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-08 | NFR | Localisation and formats (dates, INR grouping, IST) | M13 Platform | S1 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| T-01 | Task | Repo scaffold, CI pipeline, Docker Compose dev environment | Engineering | S1 |  |  | 02 |  | Not started |  |  |
| T-02 | Task | Design tokens and app shell (DESIGN.md §2-4) | Engineering | S1 |  |  | 02 |  | Not started |  |  |
| T-03 | Task | Transactional outbox and event dispatcher (02 §7) | Engineering | S1 | T-01 |  | 02 |  | Not started |  |  |
| T-04 | Task | OpenAPI schema and generated TypeScript client | Engineering | S1 | T-01 |  | 02 |  | Not started |  |  |
| T-05 | Task | Staging environment with auto-deploy from main | Engineering | S1 | T-01 |  | 02 |  | Not started |  |  |
| F-01 | Feature | Project record (client, type, location, team, CAD versions) | M01 Projects and stages | S2 | F-38, F-43 | H1 | 03 §5 | S-04, S-11 | Not started |  |  |
| F-02 | Feature | Fee-stage template from appointment letter; editable % | M01 Projects and stages | S2 | F-01, F-42 | H1, H7 | 03 §5 | S-11 | Not started |  | Default % are placeholders (AS-05) |
| F-04 | Feature | Sheet register: number, title, discipline, stage, package, owner, checker, planned date, state, revision, flags | M02 Drawing register | S2 | F-01 | H2, H3 | 03 §6 | S-05 | Not started |  |  |
| F-05 | Feature | Import sheet list from Excel/CSV with mapping, preview, undo | M02 Drawing register | S2 | F-04, I-01 | H3 | 03 §6 | S-12 | Not started |  |  |
| F-49 | Feature | Packages with planned dates | M01 Projects and stages | S2 | F-01 | H3 | 03 §5 | S-05 | Not started |  |  |
| I-01 | Integration | Excel/CSV sheet-register import | M14 Integrations | S2 | F-05 |  | 03 §19 |  | Not started |  |  |
| A-04 | Automation | On upload: block issue if sheet number/file name breaks rule | M06 Deadlines and alerts | S3 | F-35 | Pain 13 | 03 §10; 02 §8 |  | Not started |  |  |
| F-06 | Feature | Revision history with issued PDF per revision; one current | M02 Drawing register | S3 | F-04, F-41 | H2 | 03 §6 | S-06 | Not started |  |  |
| F-08 | Feature | Purpose and suitability code per issue | M02 Drawing register | S3 | F-42 | H2 | 03 §6 | S-07 | Not started |  | Never show bare 'IFC' |
| F-10 | Feature | Sheet state machine with one-click transitions and audit | M03 Workflow and review | S3 | F-04, F-38 | H1, H3 | 03 §3, §7; 02 §6 | S-06 | Not started |  |  |
| F-11 | Feature | Assign checker; redlines and comments on reviews | M03 Workflow and review | S3 | F-10 | H5 | 03 §7 | S-08 | Not started |  | Senior QC two-step per stage setting |
| F-35 | Feature | Sheet-number and file-name checks on upload | M12 Quality | S3 | F-42 | Pain 13 | 03 §16 | S-14 | Not started |  | Implemented with A-04 |
| F-46 | Feature | Bulk actions in register | M02 Drawing register | S3 | F-04, F-10 | H3 | 03 §6 | S-05 | Not started |  |  |
| F-47 | Feature | Sheet detail page with PDF viewer and timeline | M02 Drawing register | S3 | F-06 | H2 | 03 §6 | S-06 | Not started |  |  |
| A-01 | Automation | At risk: planned date within 7 working days, not started/in progress | M06 Deadlines and alerts | S4 | F-04, F-42 | H3 | 03 §10; 02 §8 |  | Not started |  |  |
| A-02 | Automation | Late: planned date passed, not issued; escalate after 3 working days | M06 Deadlines and alerts | S4 | F-04, F-42 | H3, H1 | 03 §10; 02 §8 |  | Not started |  |  |
| A-03 | Automation | On issue: supersede earlier revision, notify earlier recipients | M06 Deadlines and alerts | S4 | F-14 | H2 | 03 §10; 02 §8 |  | Not started |  |  |
| F-03 | Feature | Stage status and planned/actual dates with automatic roll-up | M01 Projects and stages | S4 | F-02, F-10, F-14 | H1 | 03 §4, §5 | S-04, S-11 | Not started |  | Model in S2; automatic roll-up in S4 |
| F-07 | Feature | Automatic superseding of older revisions on issue | M02 Drawing register | S4 | F-06, F-14 | H2 | 03 §6 | S-06 | Not started |  | Implemented with A-03 |
| F-14 | Feature | Transmittals: recipients, sheets, revisions, purpose, number, cover PDF, secure links | M04 Issue and transmittals | S4 | F-06, F-08, F-43, I-12 | H2 | 03 §8 | S-07, S-15 | Not started |  |  |
| F-20 | Feature | Daily at-risk and late rules on sheets | M06 Deadlines and alerts | S4 | F-04, A-01, A-02 | H3 | 03 §10 | S-05, S-06 | Not started |  |  |
| F-21 | Feature | Notifications: in-app, email, digest, preferences | M06 Deadlines and alerts | S4 | I-12, T-03 | H1, H3 | 03 §10, §18 | S-13 | Not started |  |  |
| F-48 | Feature | SUPERSEDED watermark on old-revision downloads | M02 Drawing register | S4 | F-07 | H2 | 03 §6; 02 §9 | S-06 | Not started |  |  |
| A-05 | Automation | Weekly: over (>110%) / under (<50%) allocation | M06 Deadlines and alerts | S5 | F-17 | H4 | 03 §10; 02 §8 |  | Not started |  |  |
| A-06 | Automation | Weekly: timesheet missing reminder | M06 Deadlines and alerts | S5 | F-18 | H4 | 03 §10; 02 §8 |  | Not started |  |  |
| F-16 | Feature | Staff directory: discipline, role, team, capacity, leave | M05 People and workload | S5 | F-40 | H4 | 03 §9 | S-09 | Not started |  |  |
| F-17 | Feature | Planned hours per person x project-stage x week | M05 People and workload | S5 | F-16, F-02 | H4 | 03 §9 | S-09 | Not started |  |  |
| F-18 | Feature | Weekly timesheets by project and stage; submit/approve; CSV import | M05 People and workload | S5 | F-16, F-02 | H4 | 03 §9 | S-10 | Not started |  | Build vs import: DEC-03 |
| F-19 | Feature | Over/under-allocation heat map | M05 People and workload | S5 | F-17 | H4 | 03 §9 | S-09 | Not started |  |  |
| D-01 | Dashboard | Portfolio dashboard (owner) | M07 Dashboards and reports | S6 | F-22 | H1-H4 | 03 §11 | S-03 | Not started |  |  |
| D-02 | Dashboard | Project dashboard (project lead) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | S-04 | Not started |  |  |
| D-03 | Dashboard | Discipline dashboard (discipline lead) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | - | Not started |  |  |
| D-04 | Dashboard | My work (designer) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | S-02 | Not started |  |  |
| D-05 | Dashboard | Baseline metrics report | M07 Dashboards and reports | S6 | F-53 | H1-H4 | 03 §11 | S-03 | Not started |  |  |
| F-22 | Feature | Owner portfolio dashboard (D-01) | M07 Dashboards and reports | S6 | F-03, F-19, F-20 | H1 | 03 §11 | S-03 | Not started |  |  |
| F-23 | Feature | Project, discipline and My-work dashboards (D-02 to D-04) | M07 Dashboards and reports | S6 | F-22 | H1, H3, H4 | 03 §11 | S-02, S-04 | Not started |  |  |
| F-44 | Feature | Global search | M07 Dashboards and reports | S6 | F-04 | - | 03 §11; 02 §10 | top bar | Not started |  |  |
| F-45 | Feature | Project activity feed | M07 Dashboards and reports | S6 | F-10, F-14 | H1 | 03 §11 | S-04 | Not started |  |  |
| F-52 | Feature | Exports to Excel/PDF | M07 Dashboards and reports | S6 | F-04 | - | 03 §11 | all lists | Not started |  |  |
| F-53 | Feature | Baseline metrics report (D-05) | M07 Dashboards and reports | S6 | F-22 | H1-H7 | 03 §11 | S-03 | Not started |  |  |
| F-54 | Feature | Onboarding of existing projects and historic revisions | M02 Drawing register | S6 | F-05, F-06 | H1 | 03 §6 | S-12 | Not started |  | Started in S2, finished in S6 |
| N-01 | NFR | Performance targets (p95 API < 300 ms; register < 1 s; dashboards < 2 s) | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-02 | NFR | Availability 99.5% office hours; backups; PITR; restore drill | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-04 | NFR | Accessibility WCAG 2.2 AA | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-06 | NFR | Data retention and full project export | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-07 | NFR | Browser and device support | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-09 | NFR | Capacity: 300 users, 100k sheets, 2 TB | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| N-10 | NFR | Privacy and consent review | M13 Platform | S6 |  |  | 03 §20 |  | Not started |  | Continuous from S1; verified in sprint shown |
| T-06 | Task | Production environment, backups, monitoring (02 §14) | Engineering | S6 | T-05 |  | 02 |  | Not started |  |  |
| T-07 | Task | UAT with client champion | Engineering | S6 | all P1 features |  | 02 |  | Not started |  |  |
| G1 | Gate | Pilot go/no-go (01 §9) | Gates | Pilot | T-08 | H1-H4 | 01 §9 |  | Not started |  |  |
| T-08 | Task | Pilot: data load, training, office hours, weekly usage review (01 §7-8) | Engineering | Pilot | T-06, T-07 |  | 02 |  | Not started |  |  |

## Phase 2 · Flow and billing (H5–H7) · sprints S7–S11

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-07 | Automation | Daily: review open > 3 working days, escalate | M06 Deadlines and alerts | S7 | F-12 | H5 | 03 §10; 02 §8 |  | Not started |  |  |
| F-12 | Feature | Review queue with waiting time; delegation | M03 Workflow and review | S7 | F-11 | H5 | 03 §7 | S-08 | Not started |  |  |
| F-13 | Feature | Designer pre-check checklists | M03 Workflow and review | S7 | F-10 | H5 | 03 §7 | S-19 | Not started |  |  |
| F-15 | Feature | Recipient acknowledgement of receipt | M04 Issue and transmittals | S7 | F-14 | H2 | 03 §8 | S-15 | Not started |  |  |
| A-08 | Automation | Daily: client comment unanswered > N days | M06 Deadlines and alerts | S8 | F-24 | H6 | 03 §10; 02 §8 |  | Not started |  |  |
| F-24 | Feature | Client comment log per sheet and stage | M08 Client comments | S8 | F-04 | H6 | 03 §12 | S-16 | Not started |  |  |
| F-25 | Feature | Capture client comments from forwarded email | M08 Client comments | S8 | F-24, I-09 | H6 | 03 §12 | S-16 | Not started |  |  |
| F-26 | Feature | Client approval record per stage | M08 Client comments | S8 | F-03 | H6, H7 | 03 §12 | S-11 | Not started |  |  |
| I-09 | Integration | Inbound email for client comments | M14 Integrations | S8 | F-24 |  | 03 §19 |  | Not started |  |  |
| A-09 | Automation | Event: deliverables issued + client approval -> ready to invoice | M06 Deadlines and alerts | S9 | F-26 | H7 | 03 §10; 02 §8 |  | Not started |  |  |
| F-27 | Feature | Stage-complete (ready to invoice) flag and accounts notification | M09 Billing signal | S9 | F-26, A-09 | H7 | 03 §13 | S-17 | Not started |  |  |
| F-28 | Feature | Accounting export/API push; record invoiced | M09 Billing signal | S9 | F-27, I-08 | H7 | 03 §13 | S-17 | Not started |  |  |
| F-51 | Feature | Site view: mobile read-only current issued set | M02 Drawing register | S9 | F-07 | H2 | 03 §6 | S-18 | Not started |  |  |
| I-08 | Integration | Accounting export (CSV, then webhook/API) | M14 Integrations | S9 | F-27 |  | 03 §19 |  | Not started |  | Tool unknown |
| F-09 | Feature | Sheet-list sync from Revit/AutoCAD plugins | M02 Drawing register | S10 | F-04, I-03, I-04 | H2, H3 | 03 §6 | S-05 | Not started |  |  |
| I-02 | Integration | File-storage connector (CAD file activity) | M14 Integrations | S10 | F-41 |  | 03 §19 |  | Not started |  |  |
| I-03 | Integration | AutoCAD .NET plugin (Sheet Set title-block fields) | M14 Integrations | S10 | API tokens |  | 03 §19 |  | Not started |  | Needs CAD versions (AS-01) |
| I-04 | Integration | Revit add-in (sheet list and revisions) | M14 Integrations | S10 | API tokens |  | 03 §19 |  | Not started |  | Needs Revit versions (AS-01) |
| F-50 | Feature | Title-block reading for bulk PDF import | M02 Drawing register | S11 | F-06 | H2 | 03 §6 | S-05 | Not started |  | Rule-based first; OCR for scans |
| G2 | Gate | Phase 2 review vs baseline (01 §9) | Gates | S11 | all P2 items | H5-H7 | 01 §9 |  | Not started |  |  |
| I-05 | Integration | Autodesk Forma APIs (formerly Autodesk Construction Cloud) | M14 Integrations | S11 | - |  | 03 §19 |  | Conditional |  | Only if the firm uses Forma |

## Phase 3 · Construction stage · sprints S12–S16

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-10 | Automation | Daily: RFI due within 2 working days | M06 Deadlines and alerts | S12 | F-30 | Pain 14 | 03 §10; 02 §8 |  | Not started |  |  |
| F-30 | Feature | RFI log | M10 Construction admin | S12 | F-04, F-43 | Pain 14 | 03 §14 | S-20 | Not started |  |  |
| F-31 | Feature | Submittal log and stamped review | M10 Construction admin | S13 | F-43 | Pain 14 | 03 §14 | S-20 | Not started |  |  |
| F-32 | Feature | Site visit reports with photos | M10 Construction admin | S14 | F-04 | Pain 14 | 03 §14 | S-20 | Not started |  |  |
| F-33 | Feature | Change-order log | M10 Construction admin | S14 | F-30 | Pain 14 | 03 §14 | S-20 | Not started |  |  |
| F-34 | Feature | Clash results import (BCF) as issues | M11 Coordination | S15 | F-04, I-07 | Pain 10 | 03 §15 | S-21 | Not started |  |  |
| I-06 | Integration | Bluebeam Studio API (markup status) | M14 Integrations | S15 | - |  | 03 §19 |  | Conditional |  | Only if India developer access is confirmed |
| I-07 | Integration | Navisworks / BCF clash import | M14 Integrations | S15 | F-34 |  | 03 §19 |  | Not started |  |  |
| F-58 | Feature | Project knowledge base across decisions, comments, RFIs | M12 Quality | S16 | F-24, F-30 | Pain 15 | 03 §16 | S-22 | Not started |  |  |

## Phase 4 · Intelligence · sprints S17–S19

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G3 | Gate | >= 6 months clean history before Phase 4 (01 §9) | Gates | S17 |  |  | 01 §9 |  | Not started |  |  |
| T-09 | Task | Phase 4 data pipeline and feature store | Engineering | S17 | G3 |  | 02 |  | Not started |  |  |
| T-10 | Task | Evaluation datasets and back-testing harness | Engineering | S17 | T-09 |  | 02 |  | Not started |  |  |
| F-55 | Feature | Late-risk prediction (advisory) | M15 Intelligence | S18 | G3, T-09 | H3 | 03 §16; 02 §17 | S-23 | Not started |  |  |
| F-56 | Feature | Workload forecast (advisory) | M15 Intelligence | S18 | G3, T-09 | H4 | 03 §16; 02 §17 | S-23 | Not started |  |  |
| F-57 | Feature | AI drawing checks, exploratory, human-approved | M15 Intelligence | S19 | G3, T-10 | Pain 13 | 03 §16; 02 §17 | S-23 | Not started |  |  |

## Decisions due in Phase 2

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I-13 | Integration | Paperless-ngx sidecar archive | M14 Integrations | S11 | DEC-10 |  | 03 §19 |  | Decision pending |  | See docs/00 |

## Decisions due at G1

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I-10 | Integration | WhatsApp Business API for client comments | M14 Integrations | - | DEC-09 |  | 03 §19 |  | Decision pending |  | Privacy and consent |

## Out of scope

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F-29 | Feature | Invoicing, GST, ledger | M09 Billing signal | - |  | H7 | 03 §13 |  | Out of scope |  | Stays in the firm's accounting tool |
| F-36 | Feature | AI checks drawings for errors (P1-P3) | M12 Quality | - |  | Pain 13 | 03 §16 |  | Out of scope |  | Scope rule; see F-57 |
| F-37 | Feature | Drawing authoring | M12 Quality | - |  | - | 03 §16 |  | Out of scope |  | Scope rule |

## Change log

| Date | Change | By |
|---|---|---|
| 23-Oct-2026 | Tracker created from the research document and `docs/03-features-and-functionality.md` | LatentIQ |
