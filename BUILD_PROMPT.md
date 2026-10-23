# BUILD_PROMPT · DrawingOps

Prompts for building DrawingOps with a coding agent (for example Claude Code) one sprint at a time. Use them from the repository root, with this document set present.

**How to use**

1. Create an empty repository and copy in this document set (`README.md`, `CLAUDE.md`, `DESIGN.md`, `BUILD_PROMPT.md`, `TRACKER.md`, `tracker.csv`, `docs/`).
2. Start a session and paste the **master prompt** (§1) once.
3. For each sprint, paste the **sprint kickoff prompt** (§2) with the sprint number filled in.
4. At the end of each sprint, run the **review prompt** (§3), ideally in a fresh session.
5. A human (tech lead) reviews and merges every pull request. The agent never deploys to production.

---

## 1. Master prompt

```text
You are the lead engineer building DrawingOps, a web application for an
architecture and MEP design firm (200+ staff, many concurrent projects,
hospital clients) that gives one live view of every project's drawing sheets,
deadlines, reviews, people and fee stages, on top of the firm's existing
AutoCAD/Revit tools. You are building it for LatentIQ AI Technologies.

READ THESE FIRST, IN THIS ORDER, AND TREAT THEM AS THE SPECIFICATION:
1. CLAUDE.md                                  – repo rules and commands
2. docs/03-features-and-functionality.md      – behaviour, rules, acceptance criteria, permissions
3. docs/02-architecture.md                    – stack, code layout, data model, state machine, events, API
4. DESIGN.md                                  – tokens, components, screens, interaction and accessibility rules
5. docs/05-build-phases.md                    – what each sprint delivers
6. TRACKER.md                                 – the master list of items and their status
Context only: docs/00-paperless-ngx-assessment.md, docs/01-implementation-plan.md.

NON-NEGOTIABLE RULES
1. Scope. Build only the tracker items assigned to the current sprint, plus the
   minimum plumbing they need. Never build drawing authoring, accounting/GST/ledger,
   or any AI/ML feature before Phase 4. If something seems missing from the spec,
   do not invent a feature: note it under "Proposed additions" in your sprint summary.
2. Clean room. Do not copy, translate or paraphrase code from OpenConstructionERP
   (AGPL-3.0) or Paperless-ngx (GPL-3.0). You may rely on the patterns described in
   docs/02 §16 only. Do not add any dependency licensed GPL or AGPL. LGPL libraries
   used unmodified as libraries (e.g. psycopg) are allowed. Keep the licence check in CI passing.
3. Architecture. Modular monolith: Django apps as in docs/02 §4. All writes and
   business rules go in services.py inside transactions; views and serializers stay
   thin; reads go in selectors.py. Side effects (notifications, automations, roll-ups)
   happen only through outbox events (docs/02 §7). The sheet state machine is one
   transition table (docs/02 §6); never hard-code transitions anywhere else. Every
   query is scoped by organisation and, for project data, by project membership.
4. Permissions. Enforce the matrix in docs/03 §17 on the server, in services and in
   DRF permission classes. The API returns allowed_actions for sheets; the UI only
   renders what the server allows. Every endpoint gets role tests.
5. Data integrity. Issued files are immutable. Exactly one issued (current) revision
   per sheet (partial unique index). Audit rows are insert-only. Automations are
   idempotent: running a sweep twice must not duplicate flags or notifications.
6. UI. Follow DESIGN.md: tokens as CSS variables, components listed in §4, the
   screen layouts in §5, status = colour + icon + word, five states (loading, empty,
   error, partial, success) for every data component, WCAG 2.2 AA, Indian formats
   (23-Oct-2026, ₹1,00,000).
7. Safety. Never send real email from dev or staging: use the console or a local
   mail catcher. Never commit secrets. Validate every upload (PDF magic bytes, size,
   one page). Never run destructive commands against shared databases.
8. Tests. Definition of Done (docs/01 §6): unit tests for services, permission tests
   for endpoints, e2e (Playwright) for the sprint's demo flow, axe checks for new
   screens, migrations included, OpenAPI schema regenerated, TypeScript client regenerated.
9. Tracker. When you start an item set its Status to "In progress"; when its
   acceptance criteria pass, set "In review" with a one-line note and the test names.
   Only a human sets "Done". Add a line to the TRACKER change log each sprint.
10. Decisions. For small ambiguities, choose the simplest option consistent with the
   spec, record it in docs/decisions.md (date, question, choice, reason) and list it in
   your sprint summary. STOP AND ASK before: changing the meaning of a data-model
   field, changing permissions, anything that emails clients or external parties,
   adding a new dependency with a non-permissive licence, or moving scope between sprints.

WORKING METHOD FOR EVERY SPRINT
1. Restate the sprint goal and list the tracker IDs you will deliver.
2. Write a short plan: models and migrations, services, API endpoints, events,
   Celery tasks, screens and components, tests. Show it before coding.
3. Build backend first (models → services → API → tests), then frontend
   (generated client → components → screens → tests), then the e2e demo flow.
4. Run the full test suite, linters and type checks; fix everything.
5. Update docs where behaviour was clarified, TRACKER.md statuses, docs/decisions.md.
6. Finish with a sprint summary in this format:
   - Delivered (ID → what, tests that prove it)
   - Not delivered and why
   - Decisions taken (link to docs/decisions.md)
   - Proposed additions (not built)
   - Risks and follow-ups
   - How to run the demo locally (exact commands)

Reply "Ready" and list the documents you have read, then wait for the sprint kickoff.
```

---

## 2. Sprint kickoff prompt

Fill in `<SPRINT>` (S1 … S19) and paste. The items come from `docs/05-build-phases.md` and `TRACKER.md`.

```text
Start sprint <SPRINT>.

1. From TRACKER.md, list every item whose Sprint column is <SPRINT>, with its type,
   dependencies and spec reference. Confirm each dependency is "In review" or "Done";
   if any is not, tell me before you start.
2. From docs/05-build-phases.md, restate the sprint's work by layer, demo and exit check.
3. From docs/03, copy the acceptance criteria of each item into a checklist; these are
   your tests.
4. Produce the plan (models, migrations, services, endpoints, events, tasks, screens,
   components, tests). Wait for my "go".
5. After "go", build, test, update TRACKER.md and docs/decisions.md, and end with the
   sprint summary in the master-prompt format.
```

### Example: S1 kickoff (already filled in)

```text
Start sprint S1 (Foundations).
Items: T-01, T-02, T-03, T-04, T-05, F-38, F-39, F-40, F-41, F-42, F-43, I-11, I-12,
N-03, N-05, N-08.
Specifics:
- Scaffold backend/ (Django 5.2.x, DRF, Celery, django-allauth, drf-spectacular,
  django-storages) and frontend/ (Vite, React, TypeScript, TanStack Query, React Router,
  Tailwind with DESIGN.md tokens) per docs/02 §3–§4; pin exact versions.
- deploy/docker-compose.yml with web, worker, beat, postgres:16, valkey, minio, caddy,
  and a local mail catcher for dev.
- Organisation, OrgSettings, Discipline, Holiday, work week (Mon–Fri default,
  Mon–Sat option), Contact, ExternalOrg, users with org role, ProjectMembership roles
  (model only; projects arrive in S2), API tokens.
- Permission map module + generated permission tests; audit_event insert-only with a
  DB trigger; outbox_event + dispatcher; presigned upload endpoints; email templates.
- SSO: build both Google and Microsoft OIDC providers behind settings; DEC-02 picks
  which is enabled. Local login with TOTP for admins.
- App shell per DESIGN.md §3 with role-based nav; S-01 sign-in; S-14 admin settings
  for disciplines, holidays, work week, contacts.
- CI: ruff, mypy, pytest, eslint, tsc, vitest, Playwright smoke, pip-audit, npm audit,
  Trivy, gitleaks, licence check (fail on GPL/AGPL).
Demo: sign in, set disciplines/holidays/work week, add a contact, show the audit log.
```

### Example: S4 kickoff (already filled in)

```text
Start sprint S4 (Transmittals, supersede, alerts).
Items: F-03, F-07, F-14, F-20, F-21, F-48, A-01, A-02, A-03.
Specifics:
- Issue service: approved sheets + draft revisions + purpose + recipients → one
  transmittal (number <project>-TR-<NNNN>), revisions issued, earlier ones superseded,
  all in one transaction, events revision.issued and transmittal.sent.
- Cover sheet with WeasyPrint; external page /t/<token> (hashed token, expiry,
  download log); watermark worker with pikepdf for superseded downloads (cached).
- Stage roll-up rules from docs/03 §4 (planned → active → deliverables_issued).
- Automation engine (docs/02 §8): AutomationRule params, AutomationRun log, flags with
  partial unique index on open flags, working-day calendar; A-01, A-02 with escalation,
  A-03. Celery beat schedules; missing-run alert.
- Notifications: in-app, instant email, daily digest, preferences per event; catalogue
  in docs/03 §18.
- Screens: S-07 composer with preview and confirmation text from DESIGN.md §5; S-15;
  S-13; flags in S-05 and S-06.
Tests: sweeps idempotent; holiday and Saturday maths; e2e issue → email (mail catcher)
→ supersede → watermark.
Demo: as in docs/05 S4.
```

---

## 3. Sprint review prompt

Run in a fresh session after the sprint's pull request is open.

```text
Review the pull request for sprint <SPRINT> of DrawingOps against the specification.
Read CLAUDE.md, docs/03, docs/02, DESIGN.md and TRACKER.md first.
Check and report, with file:line references:
1. Every tracker item marked "In review" for this sprint meets every acceptance
   criterion in docs/03; list any criterion without a test.
2. Permission matrix (docs/03 §17) enforced server-side on every new endpoint.
3. State changes only through the transition table; side effects only through outbox
   events; services hold the business rules.
4. Organisation and membership scoping on every new query (look for unscoped
   .objects.all() / filter()).
5. Idempotency of any new Celery task or sweep.
6. Upload validation, secret handling, no real email outside production.
7. DESIGN.md compliance: tokens, status chips with icon + word, five data states,
   accessibility (labels, focus, table semantics), Indian date/number formats.
8. No code copied from OpenConstructionERP or Paperless-ngx; no GPL/AGPL dependency.
9. Migrations reversible or documented; OpenAPI and TS client regenerated.
Rank findings: blocking, should-fix, nice-to-have. Do not modify code.
```

---

## 4. Phase-level prompts (short)

| When | Prompt |
|---|---|
| Before the pilot | "Prepare the pilot: run the onboarding importer (F-54) dry-run on `pilot/*.xlsx`, list validation errors per file, produce role quick-reference cards (one page each) from DESIGN.md and docs/03, and a pilot runbook covering daily office hours and the weekly usage metrics in docs/01 §8. Do not send any emails." |
| Start of Phase 2 | "Re-read docs/03 §7, §8, §12, §13 and the G1 outcomes in docs/decisions.md. Propose any changes to Phase 2 scope as a diff to TRACKER.md for human approval before building S7." |
| Start of Phase 4 | "Confirm G3 using the data: months of history, completed sheet cycles, missing-data rates per field. If G3 fails, stop and report. If it passes, design the feature store and back-testing harness (T-09, T-10) following docs/02 §17; no model reaches users without the evaluation report." |
