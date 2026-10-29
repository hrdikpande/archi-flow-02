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
| F-38 | Feature | Role-based access per project | M13 Platform | S1 | T-01 | H1 | 03 §16, §17; 02 §11 |  | In review |  | accounts/permissions.py mirrors 03 §17; tests: test_permission_map.py (matrix cell by cell), test_api_permissions.py (every endpoint x role + coverage meta-test), test_projects_scoping.py |
| F-39 | Feature | Audit trail of every change | M13 Platform | S1 | T-01 | H2 | 03 §16; 02 §5 | S-14 | In review |  | Insert-only audit_event (DB trigger + model guard), request ID/IP, CSV export with formula guard; tests: test_audit.py; S-14 Audit trail |
| F-40 | Feature | SSO (Google/Microsoft) + local accounts with TOTP | M13 Platform | S1 | I-11 | - | 03 §16; 02 §11 | S-01 | In review |  | Local sign-in + TOTP for admins + recovery codes verified (test_auth.py, e2e); SSO adapters domain-restricted; real IdP sign-in pending I-11 |
| F-41 | Feature | Issued PDFs in object storage; CAD files linked | M13 Platform | S1 | T-01 | H2 | 03 §16; 02 §9 | S-06 | In review |  | Presigned PUT → worker checks size, %PDF, 1 page, SHA-256 dedupe → content-addressed key; CAD link validator; tests: test_files.py; verified on live stack |
| F-42 | Feature | Organisation settings: disciplines, templates, codes, calendar, rules, thresholds | M01 Projects and stages | S1 | T-01 | - | 03 §5 | S-14 | In review |  | Org, timezone, work week, holidays, disciplines, revision scheme, purpose/suitability codes, thresholds, digest time; stage templates (S2) and naming rules (S3) per DD-014 |
| F-43 | Feature | Contacts and external organisations | M01 Projects and stages | S1 | T-01 | - | 03 §5 | S-14 | In review |  | External orgs + contacts, duplicate email warns (409 + confirm); tests: test_contacts_users.py, e2e s1-demo/roles |
| I-11 | Integration | SSO: Google Workspace or Microsoft 365 | M14 Integrations | S1 | DEC-02 |  | 03 §19 |  | Blocked |  | Google and Microsoft providers built behind env settings; needs DEC-02 and client credentials to verify |
| I-12 | Integration | Outbound email (SMTP relay or transactional service) | M14 Integrations | S1 | T-01 |  | 03 §19 |  | In review |  | Templated email on email queue after commit; non-production limited to a local catcher (system check + runtime guard); tests: test_platform.py, e2e Mailpit |
| N-03 | NFR | Security baseline (ASVS L2 checklist, HTTPS, CSP, scans) | M13 Platform | S1 |  |  | 03 §20 |  | In review |  | Security audit 24-Oct-2026: Semgrep (make sast, CI), ruff-bandit, pip-audit/npm audit 0, gitleaks/Trivy in CI, ZAP baseline 0 FAIL, cross-tenant IDOR sweep 0 leaks; fixed SSRF (DD-029), body-id scoping (DD-030), PDF fetcher (DD-037), proxy-aware login limits (DD-038) |
| N-05 | NFR | Observability: errors, logs, metrics, missing-sweep alert | M13 Platform | S1 |  |  | 03 §20 |  | In review |  | JSON logs with request/user IDs (web and Celery), Sentry hook, /metrics internal only, /healthz scheduler heartbeat; alert routing in T-06 |
| N-08 | NFR | Localisation and formats (dates, INR grouping, IST) | M13 Platform | S1 |  |  | 03 §20 |  | In review |  | IST default, DD-Mon-YYYY, 24 h, INR en-IN grouping; tests: src/lib/format.test.ts |
| T-01 | Task | Repo scaffold, CI pipeline, Docker Compose dev environment | Engineering | S1 |  |  | 02 |  | In review |  | Monorepo, 9-service compose (make up), Makefile, CI (.github/workflows/ci.yml); gates run locally green |
| T-02 | Task | Design tokens and app shell (DESIGN.md §2-4) | Engineering | S1 |  |  | 02 |  | In review |  | Tokens in frontend/src/styles/tokens.css (light+dark), AppShell, nav by role; tests: ui.test.tsx, e2e/a11y.spec.ts |
| T-03 | Task | Transactional outbox and event dispatcher (02 §7) | Engineering | S1 | T-01 |  | 02 |  | In review |  | apps/outbox: per-handler delivery rows, backoff, dead-letter, 30 s sweep; tests: test_outbox.py |
| T-04 | Task | OpenAPI schema and generated TypeScript client | Engineering | S1 | T-01 |  | 02 |  | In review |  | make schema (drf-spectacular --fail-on-warn → openapi-typescript); CI 'contract' job fails on drift |
| T-05 | Task | Staging environment with auto-deploy from main | Engineering | S1 | T-01 |  | 02 |  | Blocked |  | Workflow ready (deploy-staging.yml), inactive until staging host exists (DEC-01) |
| F-01 | Feature | Project record (client, type, location, team, CAD versions) | M01 Projects and stages | S2 | F-38, F-43 | H1 | 03 §5 | S-04, S-11 | In review |  | projects app (Project, client, type, location, team, CAD versions); tests: test_projects.py; e2e s2-register |
| F-02 | Feature | Fee-stage template from appointment letter; editable % | M01 Projects and stages | S2 | F-01, F-42 | H1, H7 | 03 §5 | S-11 | In review |  | Stage templates + appointment letter PDF, editable %; projects/services.py; StagePlanEditor; tests: test_projects.py |
| F-04 | Feature | Sheet register: number, title, discipline, stage, package, owner, checker, planned date, state, revision, flags | M02 Drawing register | S2 | F-01 | H2, H3 | 03 §6 | S-05 | In review |  | Register (register app) with filters, saved views, virtualised table; tests: test_register.py; e2e s2-register |
| F-05 | Feature | Import sheet list from Excel/CSV with mapping, preview, undo | M02 Drawing register | S2 | F-04, I-01 | H3 | 03 §6 | S-12 | In review |  | Excel/CSV import: mapping, preview, commit, undo (register/imports.py); tests: test_imports.py; e2e s2-register |
| F-49 | Feature | Packages with planned dates | M01 Projects and stages | S2 | F-01 | H3 | 03 §5 | S-05 | In review |  | Packages with planned dates; tests: test_projects.py |
| I-01 | Integration | Excel/CSV sheet-register import | M14 Integrations | S2 | F-05 |  | 03 §19 |  | In review |  | See F-05 |
| A-04 | Automation | On upload: block issue if sheet number/file name breaks rule | M06 Deadlines and alerts | S3 | F-35 | Pain 13 | 03 §10; 02 §8 |  | In review |  | Naming-rule block on upload/issue; tests: test_register.py |
| F-06 | Feature | Revision history with issued PDF per revision; one current | M02 Drawing register | S3 | F-04, F-41 | H2 | 03 §6 | S-06 | In review |  | Revision history, one current, issued PDF per revision (register/revisions.py); tests: test_revisions.py |
| F-08 | Feature | Purpose and suitability code per issue | M02 Drawing register | S3 | F-42 | H2 | 03 §6 | S-07 | In review |  | Purpose and suitability codes per issue (org settings); tests: test_transmittals.py |
| F-10 | Feature | Sheet state machine with one-click transitions and audit | M03 Workflow and review | S3 | F-04, F-38 | H1, H3 | 03 §3, §7; 02 §6 | S-06 | In review |  | One transition table (workflow/state_machine.py), audited; tests: test_workflow.py; e2e s3-workflow |
| F-11 | Feature | Assign checker; redlines and comments on reviews | M03 Workflow and review | S3 | F-10 | H5 | 03 §7 | S-08 | In review |  | Checker assignment, redlines (PDF/image), comments; tests: test_review_flow.py; e2e s3-workflow |
| F-35 | Feature | Sheet-number and file-name checks on upload | M12 Quality | S3 | F-42 | Pain 13 | 03 §16 | S-14 | In review |  | Naming rules on upload, block issue on breach (register/naming.py); tests: test_register.py |
| F-46 | Feature | Bulk actions in register | M02 Drawing register | S3 | F-04, F-10 | H3 | 03 §6 | S-05 | In review |  | Bulk actions in register; tests: test_register.py |
| F-47 | Feature | Sheet detail page with PDF viewer and timeline | M02 Drawing register | S3 | F-06 | H2 | 03 §6 | S-06 | In review |  | Sheet detail with PDF viewer and timeline (SheetDetailPage); e2e smoke, s3-workflow |
| A-01 | Automation | At risk: planned date within 7 working days, not started/in progress | M06 Deadlines and alerts | S4 | F-04, F-42 | H3 | 03 §10; 02 §8 |  | In review |  | automation rules registry; tests: test_automation.py (idempotent sweeps, working-day maths DD-017) |
| A-02 | Automation | Late: planned date passed, not issued; escalate after 3 working days | M06 Deadlines and alerts | S4 | F-04, F-42 | H3, H1 | 03 §10; 02 §8 |  | In review |  | Late + escalate after 3 working days; tests: test_automation.py |
| A-03 | Automation | On issue: supersede earlier revision, notify earlier recipients | M06 Deadlines and alerts | S4 | F-14 | H2 | 03 §10; 02 §8 |  | In review |  | Supersede on issue + notify earlier recipients; tests: test_transmittals.py |
| F-03 | Feature | Stage status and planned/actual dates with automatic roll-up | M01 Projects and stages | S4 | F-02, F-10, F-14 | H1 | 03 §4, §5 | S-04, S-11 | In review |  | Stage state machine and planned/actual roll-up (projects/stage_machine.py); tests: test_projects.py, test_automation.py |
| F-07 | Feature | Automatic superseding of older revisions on issue | M02 Drawing register | S4 | F-06, F-14 | H2 | 03 §6 | S-06 | In review |  | Superseding on issue (A-03); tests: test_transmittals.py; e2e s4-issue |
| F-14 | Feature | Transmittals: recipients, sheets, revisions, purpose, number, cover PDF, secure links | M04 Issue and transmittals | S4 | F-06, F-08, F-43, I-12 | H2 | 03 §8 | S-07, S-15 | In review |  | Transmittals: number, purpose, recipients, cover PDF, expiring secure links; tests: test_transmittals.py; e2e s4-issue |
| F-20 | Feature | Daily at-risk and late rules on sheets | M06 Deadlines and alerts | S4 | F-04, A-01, A-02 | H3 | 03 §10 | S-05, S-06 | In review |  | Daily at-risk/late sweeps A-01/A-02 (automation app, idempotent); tests: test_automation.py |
| F-21 | Feature | Notifications: in-app, email, digest, preferences | M06 Deadlines and alerts | S4 | I-12, T-03 | H1, H3 | 03 §10, §18 | S-13 | In review |  | In-app centre, instant/digest/off (DD-021), quiet hours; tests: test_notifications.py |
| F-48 | Feature | SUPERSEDED watermark on old-revision downloads | M02 Drawing register | S4 | F-07 | H2 | 03 §6; 02 §9 | S-06 | In review |  | SUPERSEDED watermark on old-revision downloads (register/watermark.py); tests: test_revisions.py |
| A-05 | Automation | Weekly: over (>110%) / under (<50%) allocation | M06 Deadlines and alerts | S5 | F-17 | H4 | 03 §10; 02 §8 |  | In review |  | Weekly over/under allocation; tests: test_people.py, test_automation.py |
| A-06 | Automation | Weekly: timesheet missing reminder | M06 Deadlines and alerts | S5 | F-18 | H4 | 03 §10; 02 §8 |  | In review |  | Weekly timesheet reminder; tests: test_people.py, test_automation.py |
| F-16 | Feature | Staff directory: discipline, role, team, capacity, leave | M05 People and workload | S5 | F-40 | H4 | 03 §9 | S-09 | In review |  | Staff directory, capacity, leave (people app; MANAGE_STAFF DD-019); tests: test_people.py; e2e s5-people |
| F-17 | Feature | Planned hours per person x project-stage x week | M05 People and workload | S5 | F-16, F-02 | H4 | 03 §9 | S-09 | In review |  | Allocations per person × project-stage × week; tests: test_people.py; e2e s5-people |
| F-18 | Feature | Weekly timesheets by project and stage; submit/approve; CSV import | M05 People and workload | S5 | F-16, F-02 | H4 | 03 §9 | S-10 | In review |  | Weekly timesheets, submit/approve/return (DD-023), CSV import; tests: test_people.py; e2e s5-people |
| F-19 | Feature | Over/under-allocation heat map | M05 People and workload | S5 | F-17 | H4 | 03 §9 | S-09 | In review |  | Allocation heat map (Workload page); tests: test_people.py; e2e s5-people |
| D-01 | Dashboard | Portfolio dashboard (owner) | M07 Dashboards and reports | S6 | F-22 | H1-H4 | 03 §11 | S-03 | In review |  | See F-22; tests: test_dashboards.py; e2e s6-dashboards |
| D-02 | Dashboard | Project dashboard (project lead) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | S-04 | In review |  | Project dashboard incl. construction summary; tests: test_dashboards.py |
| D-03 | Dashboard | Discipline dashboard (discipline lead) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | - | In review |  | Discipline dashboard; tests: test_dashboards.py; e2e a11y /disciplines/A |
| D-04 | Dashboard | My work (designer) | M07 Dashboards and reports | S6 | F-23 | H1-H4 | 03 §11 | S-02 | In review |  | My work; tests: test_dashboards.py; e2e smoke |
| D-05 | Dashboard | Baseline metrics report | M07 Dashboards and reports | S6 | F-53 | H1-H4 | 03 §11 | S-03 | In review |  | See F-53 |
| F-22 | Feature | Owner portfolio dashboard (D-01) | M07 Dashboards and reports | S6 | F-03, F-19, F-20 | H1 | 03 §11 | S-03 | In review |  | Portfolio dashboard D-01 (materialised read model); tests: test_dashboards.py; e2e s6-dashboards |
| F-23 | Feature | Project, discipline and My-work dashboards (D-02 to D-04) | M07 Dashboards and reports | S6 | F-22 | H1, H3, H4 | 03 §11 | S-02, S-04 | In review |  | Project, discipline, My-work dashboards D-02..D-04; tests: test_dashboards.py; e2e s6-dashboards |
| F-44 | Feature | Global search | M07 Dashboards and reports | S6 | F-04 | - | 03 §11; 02 §10 | top bar | In review |  | Global search + command palette, access-filtered; tests: test_search_activity.py; e2e a11y palette |
| F-45 | Feature | Project activity feed | M07 Dashboards and reports | S6 | F-10, F-14 | H1 | 03 §11 | S-04 | In review |  | Project activity feed; tests: test_search_activity.py |
| F-52 | Feature | Exports to Excel/PDF | M07 Dashboards and reports | S6 | F-04 | - | 03 §11 | all lists | In review |  | Excel/PDF exports, async above EXPORT_SYNC_MAX_ROWS (exports app); tests: test_exports_onboarding.py |
| F-53 | Feature | Baseline metrics report (D-05) | M07 Dashboards and reports | S6 | F-22 | H1-H7 | 03 §11 | S-03 | In review |  | Baseline metrics report D-05; tests: test_dashboards.py; e2e s6-dashboards |
| F-54 | Feature | Onboarding of existing projects and historic revisions | M02 Drawing register | S6 | F-05, F-06 | H1 | 03 §6 | S-12 | In review |  | Onboarding of existing projects and historic revisions (register/onboarding.py, DD-028); tests: test_exports_onboarding.py |
| N-01 | NFR | Performance targets (p95 API < 300 ms; register < 1 s; dashboards < 2 s) | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | make loadtest (Locust, loadtest/locustfile.py), 200 users on seed_scale data, 25-Oct-2026 on a 10-CPU Docker VM: 42k requests, 0 failures; API p95 220 ms, 1,000-sheet register p95 610 ms, dashboards p95 ≤ 380 ms with 6 gunicorn processes (2 processes gave p95 580 ms, so prod configs now set 6). Re-run on production hardware |
| N-02 | NFR | Availability 99.5% office hours; backups; PITR; restore drill | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | Backups + PITR runbooks (docs/runbooks/backup-restore.md, restore-drills.md), make restore-drill; availability needs production hosting (T-06) |
| N-04 | NFR | Accessibility WCAG 2.2 AA | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | axe-core WCAG 2.2 AA on every screen, light and dark (e2e a11y.spec.ts, 0 violations) |
| N-06 | NFR | Data retention and full project export | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | Full project export (exports app) and retention per docs/privacy.md; tests: test_exports_onboarding.py |
| N-07 | NFR | Browser and device support | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | Playwright on Chromium, Firefox, WebKit and a 360 px phone profile (e2e smoke, s12 phone) |
| N-09 | NFR | Capacity: 300 users, 100k sheets, 2 TB | M13 Platform | S6 |  |  | 03 §20 |  | In progress |  | seed_scale --projects 100 --sheets 1000 --revisions 5 seeds the N-09 size; capacity run on production-sized hardware still to do |
| N-10 | NFR | Privacy and consent review | M13 Platform | S6 |  |  | 03 §20 |  | In review |  | docs/privacy.md (no leave reasons, EXIF stripped from site photos, retention); needs the firm's privacy review |
| T-06 | Task | Production environment, backups, monitoring (02 §14) | Engineering | S6 | T-05 |  | 02 |  | Blocked |  | Ready: Railway/Vercel/Upstash/S3/SMTP configs and runbook (docs/runbooks/deploy-railway-vercel.md), Compose prod stack, backups, monitoring. Needs the owner's accounts and DEC-01 |
| T-07 | Task | UAT with client champion | Engineering | S6 | all P1 features |  | 02 |  | Not started |  | Script ready: docs/uat-script.md (needs the client champion) |
| G1 | Gate | Pilot go/no-go (01 §9) | Gates | Pilot | T-08 | H1-H4 | 01 §9 |  | Not started |  |  |
| T-08 | Task | Pilot: data load, training, office hours, weekly usage review (01 §7-8) | Engineering | Pilot | T-06, T-07 |  | 02 |  | Not started |  |  |

## Phase 2 · Flow and billing (H5–H7) · sprints S7–S11

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-07 | Automation | Daily: review open > 3 working days, escalate | M06 Deadlines and alerts | S7 | F-12 | H5 | 03 §10; 02 §8 |  | In review |  | Review open > 3 working days escalates; tests: test_automation.py, test_review_flow.py |
| F-12 | Feature | Review queue with waiting time; delegation | M03 Workflow and review | S7 | F-11 | H5 | 03 §7 | S-08 | In review |  | Review queue with waiting time; delegation (workflow/delegation.py); tests: test_review_flow.py; e2e s7-review-flow |
| F-13 | Feature | Designer pre-check checklists | M03 Workflow and review | S7 | F-10 | H5 | 03 §7 | S-19 | In review |  | Pre-check checklists (workflow/checklists.py); tests: test_review_flow.py; e2e s7-review-flow |
| F-15 | Feature | Recipient acknowledgement of receipt | M04 Issue and transmittals | S7 | F-14 | H2 | 03 §8 | S-15 | In review |  | Recipient acknowledgement by POST from the link page (transmittals/public.py); e2e s7-review-flow |
| A-08 | Automation | Daily: client comment unanswered > N days | M06 Deadlines and alerts | S8 | F-24 | H6 | 03 §10; 02 §8 |  | In review |  | Client comment unanswered > N days (daily); tests: test_comments.py, test_automation.py |
| F-24 | Feature | Client comment log per sheet and stage | M08 Client comments | S8 | F-04 | H6 | 03 §12 | S-16 | In review |  | Client comment log per sheet/stage (comments app); tests: test_comments.py; e2e s8-comments |
| F-25 | Feature | Capture client comments from forwarded email | M08 Client comments | S8 | F-24, I-09 | H6 | 03 §12 | S-16 | In review |  | Inbound email → comments triage (I-09); tests: test_comments.py; e2e s8-comments |
| F-26 | Feature | Client approval record per stage | M08 Client comments | S8 | F-03 | H6, H7 | 03 §12 | S-11 | In review |  | Client approval with evidence (DD-031); tests: test_comments.py; e2e s8-comments |
| I-09 | Integration | Inbound email for client comments | M14 Integrations | S8 | F-24 |  | 03 §19 |  | In review |  | See F-25 (webhook secret required) |
| A-09 | Automation | Event: deliverables issued + client approval -> ready to invoice | M06 Deadlines and alerts | S9 | F-26 | H7 | 03 §10; 02 §8 |  | In review |  | Issued + client approval → ready to invoice (event); tests: test_billing_site.py |
| F-27 | Feature | Stage-complete (ready to invoice) flag and accounts notification | M09 Billing signal | S9 | F-26, A-09 | H7 | 03 §13 | S-17 | In review |  | Ready-to-invoice signal (A-09) and Accounts notification; tests: test_billing_site.py; e2e s9-billing-site |
| F-28 | Feature | Accounting export/API push; record invoiced | M09 Billing signal | S9 | F-27, I-08 | H7 | 03 §13 | S-17 | In review |  | CSV export with field mapping, signed webhook (SSRF guard DD-029), mark invoiced; tests: test_billing_site.py, test_net.py |
| F-51 | Feature | Site view: mobile read-only current issued set | M02 Drawing register | S9 | F-07 | H2 | 03 §6 | S-18 | In review |  | Site view: mobile read-only current issued set via magic link (transmittals/site.py); tests: test_billing_site.py; e2e s9-billing-site |
| I-08 | Integration | Accounting export (CSV, then webhook/API) | M14 Integrations | S9 | F-27 |  | 03 §19 |  | In review |  | See F-28 |
| F-09 | Feature | Sheet-list sync from Revit/AutoCAD plugins | M02 Drawing register | S10 | F-04, I-03, I-04 | H2, H3 | 03 §6 | S-05 | In review |  | cadsync app: plugin batches → proposals accepted by PL/DL; CAD sync page; tests: test_cadsync.py; e2e s10-cad-sync; plugin core 11 tests (make plugins) |
| I-02 | Integration | File-storage connector (CAD file activity) | M14 Integrations | S10 | F-41 |  | 03 §19 |  | In progress |  | Partly built: the receiving API (POST /integrations/file-events, token scope file_events:write, cadsync.CadFileEvent, matched to sheets; tests: test_cadsync.py). The watcher for the office server / Google Drive / SharePoint / Egnyte is not built: needs the firm's storage choice (P0-05) |
| I-03 | Integration | AutoCAD .NET plugin (Sheet Set title-block fields) | M14 Integrations | S10 | API tokens |  | 03 §19 |  | In review |  | plugins/src/DrawingOps.AutoCAD on the tested Sync.Core; shell builds only against the firm's AutoCAD assemblies (DD-033) |
| I-04 | Integration | Revit add-in (sheet list and revisions) | M14 Integrations | S10 | API tokens |  | 03 §19 |  | In review |  | plugins/src/DrawingOps.Revit on the tested Sync.Core; shell builds only against the firm's Revit API assemblies (DD-033) |
| F-50 | Feature | Title-block reading for bulk PDF import | M02 Drawing register | S11 | F-06 | H2 | 03 §6 | S-05 | In review |  | Title-block reading for bulk PDF import (text layer, OCR fallback; register/titleblock.py); tests: test_titleblock.py |
| G2 | Gate | Phase 2 review vs baseline (01 §9) | Gates | S11 | all P2 items | H5-H7 | 01 §9 |  | Not started |  |  |
| I-05 | Integration | Autodesk Forma APIs (formerly Autodesk Construction Cloud) | M14 Integrations | S11 | - |  | 03 §19 |  | Conditional |  | Not built: only if the firm uses Forma (DD-036) |

## Phase 3 · Construction stage · sprints S12–S16

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A-10 | Automation | Daily: RFI due within 2 working days | M06 Deadlines and alerts | S12 | F-30 | Pain 14 | 03 §10; 02 §8 |  | In review |  | RFI due within 2 working days (daily; ca/rules.py); tests: test_ca.py, test_automation.py |
| F-30 | Feature | RFI log | M10 Construction admin | S12 | F-04, F-43 | Pain 14 | 03 §14 | S-20 | In review |  | RFI log, ball in court, answer starts next revision (ca app); tests: test_ca.py; e2e s12-construction |
| F-31 | Feature | Submittal log and stamped review | M10 Construction admin | S13 | F-43 | Pain 14 | 03 §14 | S-20 | In review |  | Submittal log, review stamped onto the PDF; tests: test_ca.py; e2e s12-construction |
| F-32 | Feature | Site visit reports with photos | M10 Construction admin | S14 | F-04 | Pain 14 | 03 §14 | S-20 | In review |  | Site reports from a phone, photos ≤ 2 MB without EXIF, PDF; tests: test_ca.py; e2e s12-construction (phone) |
| F-33 | Feature | Change-order log | M10 Construction admin | S14 | F-30 | Pain 14 | 03 §14 | S-20 | In review |  | Change orders, PL approval, revision cycle; tests: test_ca.py; e2e s12-construction |
| F-34 | Feature | Clash results import (BCF) as issues | M11 Coordination | S15 | F-04, I-07 | Pain 10 | 03 §15 | S-21 | In review |  | BCF 2.1/3.0 + Navisworks XML import, update on re-import (coordination app, DD-024); tests: test_coordination.py; e2e s12-construction |
| I-06 | Integration | Bluebeam Studio API (markup status) | M14 Integrations | S15 | - |  | 03 §19 |  | Conditional |  | Not built: needs confirmed India developer access to Bluebeam Studio (DD-036) |
| I-07 | Integration | Navisworks / BCF clash import | M14 Integrations | S15 | F-34 |  | 03 §19 |  | In review |  | See F-34 (defusedxml, zip limits) |
| F-58 | Feature | Project knowledge base across decisions, comments, RFIs | M12 Quality | S16 | F-24, F-30 | Pain 15 | 03 §16 | S-22 | In review |  | Decision log + cross-project knowledge search (knowledge app); tests: test_knowledge.py; e2e s12-construction |

## Phase 4 · Intelligence · sprints S17–S19

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G3 | Gate | >= 6 months clean history before Phase 4 (01 §9) | Gates | S17 |  |  | 01 §9 |  | Not started |  | Enforced in code: Phase 4 runs are skipped until ≥ 6 months and ≥ 2,000 issued revisions (Admin › Intelligence shows progress) |
| T-09 | Task | Phase 4 data pipeline and feature store | Engineering | S17 | G3 |  | 02 |  | In review |  | Point-in-time feature store from StatusTransition (intelligence/features.py); tests: test_intelligence.py |
| T-10 | Task | Evaluation datasets and back-testing harness | Engineering | S17 | T-09 |  | 02 |  | In review |  | Back-testing harness: precision@20% vs A-01 baseline, MAPE; tests: test_intelligence.py |
| F-55 | Feature | Late-risk prediction (advisory) | M15 Intelligence | S18 | G3, T-09 | H3 | 03 §16; 02 §17 | S-23 | In review |  | Advisory late-risk (gradient boosting, back-tested vs A-01 baseline, reasons; intelligence app); gated by G3; tests: test_intelligence.py |
| F-56 | Feature | Workload forecast (advisory) | M15 Intelligence | S18 | G3, T-09 | H4 | 03 §16; 02 §17 | S-23 | In review |  | Advisory workload forecast (ridge, MAPE reported); tests: test_intelligence.py |
| F-57 | Feature | AI drawing checks, exploratory, human-approved | M15 Intelligence | S19 | G3, T-10 | Pain 13 | 03 §16; 02 §17 | S-23 | In review |  | Rule-based drawing checks, off/evaluation/on, 'on' needs ≥ 200 labelled sheets; human review queue; tests: test_intelligence.py |

## Decisions due in Phase 2

| ID | Type | Item | Module | Sprint | Depends on | Hyp. | Spec | Screen | Status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| I-13 | Integration | Paperless-ngx sidecar archive | M14 Integrations | S11 | DEC-10 |  | 03 §19 |  | Decision pending |  | Waits for DEC-10 (DD-036) |

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
| 24-Oct-2026 | S1 built: 13 items In review, N-03 In progress, T-05 and I-11 Blocked (DEC-01, DEC-02). See `docs/06-spec-review.md` and DD-004 to DD-016 | Claude Code (S1) |
| 23-Oct-2026 | Tracker created from the research document and `docs/03-features-and-functionality.md` | LatentIQ |
