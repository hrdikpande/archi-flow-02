# 06 · Repository and specification review

Review of the DrawingOps document set before the build starts: what each file is for, the planned dependencies and configuration, gaps and contradictions found, and recommendations. Written 24-Oct-2026 at the start of Sprint S1.

---

## 1. What the repository contains

At review time the repository holds a specification only (12 files, ~2,100 lines, no code). One commit: `333fbc7 Add DrawingOps build document set`.

| File | Purpose | Authority |
|---|---|---|
| `README.md` | Index of the document set, reading order, phase summary, status of facts | Navigation |
| `CLAUDE.md` | Rules for coding agents: scope, clean room, architecture, data integrity, UI, commands | **Binding** for every change |
| `BUILD_PROMPT.md` | Master prompt, sprint kickoff and review prompts for a coding agent | Process |
| `docs/00-paperless-ngx-assessment.md` | Why DrawingOps is not built on Paperless-ngx (GPL-3.0, file-first model) | Context (ADR-007) |
| `docs/01-implementation-plan.md` | Outcome, assumptions AS-01..15, team, timeline, gates G0–G3, effort, owner decisions DEC-01..10 | Context |
| `docs/02-architecture.md` | Stack, code layout, data model, state machine, outbox, automation engine, files, search, identity, API, ops, ADR-001..012 | **Source of truth: how** |
| `docs/03-features-and-functionality.md` | Roles, objects, states, F-01..58, A-01..10, D-01..05, I-01..13, N-01..10, permission matrix §17, notification catalogue §18 | **Source of truth: what** |
| `DESIGN.md` | Tokens (contrast-checked), components, 23 screens, interaction, accessibility, formats | **Source of truth: look** |
| `docs/05-build-phases.md` | Discovery, 19 sprints in 4 phases, demos and exit checks | Plan |
| `TRACKER.md` / `tracker.csv` | 118 items with phase, sprint, dependencies, status (all "Not started") | Status |
| `docs/decisions.md` | Running decisions log (DD-001..003) | Log |

### 1.1 Shape of the product

- **Architecture:** a modular monolith. It has Django domain apps, a React SPA, Celery workers and beat, PostgreSQL, a Redis-compatible broker and S3-compatible storage, all deployed with Docker Compose on one VM.
- **Core flows:** sheet register → state machine (planned → in progress → check → approved → issued) → transmittals with cover sheets and tokenised links → superseding and watermarking → daily sweeps (at risk, late) → workload and timesheets → dashboards.
- **Cross-cutting rules:**
  - Organisation and project-membership scoping on every query.
  - Business logic only in `services.py`.
  - Side effects only through a transactional outbox.
  - One transition table.
  - Insert-only audit.
  - Immutable issued files.
  - Idempotent sweeps.

### 1.2 Planned dependencies (checked against registries 24-Oct-2026)

| Layer | Package | Spec | Current | Licence | Note |
|---|---|---|---|---|---|
| Web | Django | 5.2.x LTS | 5.2.18 (6.1.2 exists) | BSD-3 | Keep 5.2 LTS (support to Apr-2028) |
| API | djangorestframework / drf-spectacular | 3.16+ / 0.30 | 3.18.3 / 0.30.0 | BSD-3 | |
| Jobs | celery / django-celery-beat | 5.6 / 2.9 | 5.6.3 / 2.9.0 | BSD | |
| Auth | django-allauth | 65 | 65.20.1 | MIT | Headless mode suits the SPA |
| DB driver | psycopg | 3.3 | 3.3.6 | LGPL-3.0 | Allowed (unmodified library) |
| Storage | django-storages / boto3 | 1.14 | 1.14.6 / 1.43 | BSD-3 / Apache-2.0 | |
| PDF | pikepdf | 10 | 10.17.0 | MPL-2.0 | |
| Server | gunicorn | 26 | 26.2.0 | MIT | |
| Frontend | React / Vite / TanStack Query | 19 / 8 / 5 | 19.3.1 / 8.3.5 / 5.104 | MIT | |
| Frontend | TypeScript | – | 5.9.3 pinned (7.0.2 exists) | Apache-2.0 | typescript-eslint needs < 6.1 and openapi-typescript needs 5.x |
| Frontend | Tailwind CSS | 4 | 4.3.3 | MIT | |

---

## 2. Findings

Severity: **High** means it will cause a defect or a rule violation if not resolved. **Medium** is an ambiguity that will cost rework. **Low** is polish.

### 2.1 Infrastructure and licences

| # | Sev. | Finding | Recommendation |
|---|---|---|---|
| R-01 | High | **MinIO** (02 §2, §3, §14) is AGPL-3.0 and the community edition is archived: no Docker images since Oct-2025, repository read-only since Feb-2026. This conflicts with the "no GPL/AGPL" rule in spirit, and leaves an unpatched storage server holding hospital drawings. | Keep the code on the S3 API only (ADR-005 already does). Use an Apache-2.0 S3 server for dev/on-prem (SeaweedFS chosen for S1, see DD-006), or cloud S3 / Azure Blob in an Indian region. Owner decision under DEC-01. |
| R-02 | High | "**Redis 7 or Valkey**": Redis ≥ 7.4 is RSAL/SSPL and Redis 8 adds AGPL-3.0. Valkey is BSD-3. | Use Valkey only (done in S1 compose). |
| R-03 | Medium | TypeScript 7 (native compiler) is current, but the lint and codegen toolchain does not support it yet. | Pin TS 5.9.3 and revisit at S6. |

### 2.2 Contradictions and ambiguities in behaviour

| # | Sev. | Finding | Where | Recommendation |
|---|---|---|---|---|
| R-04 | High | F-07 says the earlier revision is superseded "in the same transaction". A-03 lists superseding as an **event-triggered automation**. The partial unique index (one `issued` revision per sheet) only works if the supersede is in the issue transaction. | 03 §6 F-07; 03 §10 A-03; 02 §7 | Supersede inside `issue()`. A-03's outbox handler only **notifies** previous recipients. Record as a decision in S4. |
| R-05 | High | A-02 "no issued revision for the **current cycle**": "cycle" is undefined. After `next_revision` the old planned date has passed, so a re-opened sheet would be flagged Late immediately. | 03 §10; 02 §6 | Define a cycle as starting at the last `next_revision` transition, and require a new planned date on `next_revision`. |
| R-06 | Medium | `hold` is allowed from "any active" state, which is not defined. Can a sheet `in_check` or `approved_for_issue` be held? 03 §3 lists `on_hold` only after planned and in_progress. | 02 §6 vs 03 §3 | Define `ACTIVE_STATES` explicitly in the transition table (S3). |
| R-07 | Medium | Who uploads **draft** PDFs? The role table says designers "upload check prints", but the matrix only grants "Upload issued PDF" to PL and DC. F-06 says any upload creates a draft. | 03 §1, §6, §17 | Draft upload: sheet owner, DL, PL. Issue: DC, PL. Add a matrix row. |
| R-08 | Medium | **Contacts** (F-43) are org-wide but "a PL can add" one, and PL is a project role. The matrix has no contacts row. | 03 §5, §17 | Chosen for S1: Admin, Owner, or anyone who is PL, DL or DC on any project can manage contacts; all staff can read (DD-007). |
| R-09 | Medium | A-01 covers only `planned` and `in_progress`. A sheet stuck `in_check` or `approved_for_issue` two days before its date never shows At risk. | 03 §10 | Confirm in discovery. The likely intent is "not yet issued". |
| R-10 | Medium | A-01 text says "within 7 days" while the tracker says "7 working days". The section header says all counts are working days. | 03 §10, TRACKER A-01 | Treat as working days. Fix the 03 wording. |
| R-11 | Low | F-21 mentions **quiet hours**, but no data-model field supports them. | 03 §10, 02 §5 | Add `quiet_from/quiet_to` on the user preference row in S4, or drop. |
| R-12 | Medium | **Admin** sees every project (matrix "View project ✔"). An IT admin does not need hospital drawings. | 03 §17 | Consider least privilege: Admin manages settings and users only, with break-glass access audited. |
| R-13 | Medium | "Create project: PL-eligible staff (org setting)". PL is assigned per project, so creating one needs an org-level eligibility flag that is not in the model. | 03 §5 | Add `staff_profile.can_lead_projects` in S2. |

### 2.3 Data model gaps

| # | Sev. | Missing | Needed by | S1 action |
|---|---|---|---|---|
| R-14 | High | `api_token` table (02 §11 describes it; §5 omits it) | Plugins, integrations | Added (`accounts.ApiToken`) |
| R-15 | High | Per-handler delivery record for outbox idempotency "keyed by (event_id, handler_name)" | 02 §7 | Added (`outbox.OutboxDelivery`) |
| R-16 | Medium | Upload session separate from the deduplicated `file_object`. `unique(organisation, sha256)` cannot hold a pending upload whose hash is unknown. | 02 §9 | Added (`files.Upload` → `files.FileObject`) |
| R-17 | Medium | `idempotency_key` storage for the `Idempotency-Key` header | 02 §12 | Deferred to P2, when plugins need it |
| R-18 | Low | `org_settings` lacks transmittal link expiry (30 days), project code format, default weekly capacity (45 h) | 03 §5, §8, §9 | Added as fields |
| R-19 | Medium | `sheet.current_revision` duplicates the "one issued revision" index, which gives two sources of truth. | 02 §5 | Maintain it only inside the issue service. Add a consistency test in S4. |

### 2.4 Security and operations

| # | Sev. | Finding | Recommendation |
|---|---|---|---|
| R-20 | High | Audit insert-only via a row trigger does not stop `TRUNCATE`, a DB superuser, or dropping the trigger. | In production the app's DB role gets `INSERT, SELECT` only on `audit_event`. Migrations run as a separate owner role. Optional hash chain for tamper evidence. |
| R-21 | High | A presigned **PUT** cannot enforce the 200 MB limit or the content type. | S1: the worker verifies actual size, magic bytes, page count and SHA-256 before a file becomes usable. Rejected files are deleted. |
| R-22 | High | SSO "first sign-in creates the user" lets **any** Google/Microsoft account sign up. | Restrict sign-up to the firm's email domains (`SSO_ALLOWED_DOMAINS`). Done in S1. |
| R-23 | Medium | `/t/<token>` public links: tokens can leak through the Referer header, logs and search indexing. | `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, rate limit, never log the token (S4). |
| R-24 | Medium | Single VM with RTO 4 h: no rebuild runbook is specified. | Write the runbook with the restore drill (N-02, S6). |
| R-25 | Low | Fonts (Inter, IBM Plex Mono): loading from a CDN leaks usage and complicates CSP. | Self-host (both SIL OFL). Done in S1 via the system stack until the font files are approved. |

### 2.5 Plan and process

| # | Sev. | Finding | Recommendation |
|---|---|---|---|
| R-26 | Medium | **S6 holds 21 items**: dashboards, search, exports, onboarding importer, 7 NFR verifications, production environment and UAT. Every other P1 sprint holds 3–9. | Move F-52 exports and F-54 onboarding to S5, or add a hardening sprint before the pilot. |
| R-27 | Medium | S1 starts before G0, so DEC-02 (SSO provider) and DEC-04 (work week) are open. | Both are built as configuration: either provider can be enabled, and the work week is an org setting. |
| R-28 | Low | Lucide renamed `x-circle` to `circle-x`. | Use the current icon names (done in `StatusChip`). |
| R-29 | Low | The Docker Compose list in 02 §14 omits the dev mail catcher that CLAUDE.md requires. | Mailpit (MIT) is added to the dev compose. |

---

## 3. Recommendations for code quality, maintainability and scale

1. **Keep the boundaries mechanical, not cultural.**
   - Each app exposes `services` (writes) and `selectors` (reads).
   - Views import nothing from `models` for writing.
   - The permission map is the only place roles are named.
   - A test fails if an API route has no role test.
2. **One scoped base for every model and viewset.**
   - `OrgScopedModel` (UUID, organisation, timestamps, created_by) plus an `OrgScopedViewSet` that filters by `request.user.organisation` and sets it on create.
   - This makes ADR-010 (later SaaS) a configuration change.
   - When SaaS is real, add PostgreSQL row-level security as a second fence.
3. **Make side effects durable and replayable.** Outbox rows plus per-handler delivery rows mean a handler can be re-run safely and failures are visible. Alert on undispatched events older than 5 minutes.
4. **Contract-first frontend.**
   - The OpenAPI schema is generated, the TypeScript types are generated, and CI fails on drift.
   - The UI never re-implements rules: `allowed_actions` comes from the server.
5. **Test pyramid tied to the spec.**
   - Acceptance criteria become test names, and the tracker notes link them.
   - The permission matrix becomes a parametrised test.
   - The state table becomes an exhaustive transition test.
6. **Scale path without re-architecture (N-09).**
   - Materialised dashboard views refreshed by beat.
   - GIN and trigram indexes for search.
   - A read replica only if p95 exceeds 300 ms at 200 users.
   - Separate `pdf` worker queue so heavy PDF work never delays email or sweeps.
7. **Supply chain.**
   - Lock files (`uv.lock`, `package-lock.json`) committed.
   - The licence gate fails on GPL/AGPL.
   - pip-audit, npm audit, Trivy and gitleaks run in CI.
   - Renovate or Dependabot groups weekly updates.
   - Container base images pinned by digest in production.
8. **Observability from day one.**
   - Request ID in every log line and audit row.
   - A Celery beat heartbeat visible on `/healthz`, to catch missing sweeps (N-05).
   - Prometheus metrics behind the internal network only.

---

## 4. Decisions needed from the owner (from this review)

| Ref | Decision | Blocking |
|---|---|---|
| R-01 / DEC-01 | Object storage for production: cloud S3 / Azure Blob in India, or on-prem SeaweedFS (or another Apache-2.0 S3 server) | T-06 (S6) |
| R-05 | Definition of "cycle" for Late, and whether a new planned date is required on next revision | A-02 (S4) |
| R-07 | Who may upload draft PDFs | F-06 (S3) |
| R-09 | Whether At risk covers sheets in check or approved | A-01 (S4) |
| R-12 | Admin access to project data | F-38 (now; S1 follows the matrix as written) |
