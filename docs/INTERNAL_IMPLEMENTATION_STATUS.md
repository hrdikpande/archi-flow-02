# DrawingOps · Internal implementation status

> **Internal — not for client distribution.**
> Companion to `docs/FEATURES_AND_ARCHITECTURE.md`. That document describes every feature in the same present tense, including a few that are only partly built or exist only in the browser prototype. This file records the true state of each, based on the code on 27-Oct-2026.

## How to read this

- **Complete** — back end, API, SPA screen and tests exist in the production code (`backend/`, `frontend/`). "Complete" means built, not accepted: every tracker item is still *In review*; nothing is marked *Done* (only humans do that, CLAUDE.md), UAT (T-07) and gates G0–G3 have not started.
- **Partial** — some layers exist; the "What is missing" column says which.
- **UI-only** — a production SPA screen exists without the back end behind it.
- **Mock** — exists only in the standalone browser prototype `demo/` (fictional data, browser storage, no API calls; `demo/README.md`).
- Statuses below are evidence-based. Two automated checks backed them: every one of the 154 OpenAPI paths (215 operations) in `frontend/src/lib/api/schema.yaml` has a caller in `frontend/src`, and the production SPA contains no stub/TODO/placeholder markers. So the production app has **no UI-only features**; gaps are at the integration edges and in features that only the prototype shows.

## Features described in the main document that are not fully built

| Feature | Module | Status | Evidence (file paths) | What is missing |
|---|---|---|---|---|
| User invitation by email | Accounts / Admin | Mock | Prototype: `demo/js/screens/admin.js` (`us-invite`, `us-resend`, `us-withdraw`), `demo/js/demo-auth.js` (`#/invite/`). Production: `backend/apps/accounts/api/views.py` (`UserViewSet` is list/retrieve/partial_update only), `frontend/src/features/admin/UsersSettings.tsx` (no invite control) | **The main document infers `POST /api/v1/users`** (Admin, `manage_org_settings`) creating the user and emailing a set-password link via the allauth reset flow. Not in the code: no create endpoint, no invitation email template, no "invited" state, no SPA form. Today users come from SSO auto-signup, `bootstrap_org`, the Django support admin or seed commands. |
| Password reset ("Forgot password") | Accounts / Auth | Partial | `backend/config/settings/base.py` (`HEADLESS_FRONTEND_URLS["account_reset_password_from_key"]` → `/sign-in`); prototype `demo/js/demo-auth.js` (`#/forgot`, `#/reset`) | allauth headless provides the request/reset endpoints, but the SPA has no "Forgot password" link, request form or reset-key form (`frontend/src/lib/auth/allauth.ts` has no password calls; `SignInPage.tsx` has none). Reset email template and end-to-end flow are untested. |
| Profile page | Platform | Partial | Prototype `#/settings/profile` in `demo/js/demo-app.js` and `demo/js/screens/admin.js` (`S.profile`). Production: account menu in `frontend/src/app/AppShell.tsx`, `GET /me` | No dedicated profile screen in production. The main document describes "Profile" as the account menu + `/me` data + links to preferences and delegation, which is accurate for production; the richer prototype page (profile card with delegation) is not built. |
| API token scopes in the Admin UI | Admin / Integrations | Partial | `backend/apps/accounts/models.py` (`ApiTokenScope.FILE_EVENTS_WRITE`); `frontend/src/features/admin/IntegrationsSettings.tsx` (`SCOPES` lists only `cad_sync:write`, `accounting:read`, `accounting:write`) | The token form cannot create a `file_events:write` token for the storage connector; it can only be created through the API or Django admin. One-line UI fix. |
| I-02 file-storage connector (watcher) | Integrations / CAD sync | Partial | `backend/apps/cadsync/api.py:FileEventsView`, `cadsync/services.py:receive_file_events`, `TRACKER.md` I-02 (*In progress*) | The receiving API, matching and sheet display are built and tested. The connector that watches the office server / Google Drive / SharePoint / Egnyte and posts events does not exist in the repo; it waits for the firm's storage choice (P0-05). |
| I-03 / I-04 AutoCAD and Revit plugins | Integrations | Partial | `plugins/src/DrawingOps.Sync.Core/` (tested, `make plugins`), `plugins/src/DrawingOps.Revit/`, `plugins/src/DrawingOps.AutoCAD/`; DD-033 | The shared core is built and unit-tested. The host add-ins compile only against the firm's licensed Autodesk assemblies (not in the repo, not built in CI) and have not been run inside Revit/AutoCAD. Target versions unconfirmed. |
| F-40 / I-11 Single sign-on | Accounts | Partial | `backend/apps/accounts/adapters.py`, `config/settings/base.py:_sso_providers`; `TRACKER.md` I-11 (*Blocked*) | Code complete and domain-restricted; never verified against a real Google Workspace or Microsoft 365 tenant (needs DEC-02 and client credentials). |
| I-12 Outbound email (production SMTP) | Notifications | Partial | `backend/apps/notifications/email.py`; e2e uses Mailpit | Works against Mailpit in development and tests; no production SMTP relay has been configured or verified (T-06 *Blocked*). |
| F-25 / I-09 Inbound email | Comments | Partial | `backend/apps/comments/inbound.py`, `webhook.py`, `tasks.py`; `test_comments.py` | Webhook and IMAP code complete and tested with fixtures; no mail provider or mailbox is configured; the prototype simulates forwarded email. |
| F-28 / I-08 Accounting webhook | Billing | Complete (production) / Mock (prototype extras) | `backend/apps/billing/services.py:deliver_webhook`; prototype `demo/js/screens/clients.js` (`bl-push`), `demo/js/screens/admin.js` (`ig-test`) | Production pushes automatically via the outbox. The prototype's manual "Push to accounting" and "Test webhook" buttons do not exist in production; not claimed in the main document. No real accounting tool connected. |
| F-44 Global search scope | Search | Partial (vs spec) | `backend/apps/search/services.py` | Spec 03 F-44 says "P2 adds comments and PDF text". Global search covers sheets, projects, transmittals and contacts only. Comments are searchable through knowledge search (`knowledge/services.py`); extracted PDF text is not indexed anywhere. The main document describes the actual scope and does not claim PDF-text search. |
| F-55 / F-56 / F-57 Intelligence | Intelligence | Complete but inert | `backend/apps/intelligence/*`, `features.py:gate`; `test_intelligence.py` | Code, back-testing and UI exist, but training is skipped until gate G3 (≥ 6 months, ≥ 2,000 issued revisions). No production history exists, so no real forecasts or calibrated precision. The prototype shows deterministic stand-ins labelled "Forecast". Drawing-check mode defaults to off; "on" needs 200 labelled sheets. |
| Timesheet "Remind" button on discipline dashboard | People / Dashboards | Mock | Prototype `demo/js/screens/dashboards.js` (`remind-ts`) | Production sends reminders only through A-06 (weekly sweep). Not claimed in the main document. |
| Prototype-only conveniences | – | Mock | `demo/js/demo-app.js` (`#/mailbox`, sweep-now in Demo menu, guided walkthrough, reset), sign-in "Demo Access" panel | Mailbox stands in for SMTP; reset and walkthrough are prototype-only. Production has "Run now" per automation rule (`POST /automation-rules/{id}/run`). Not in the main document. |

## Integrations deliberately left out of the main document

These have only a status label (in the prototype's Admin › Integrations screen and the tracker); no code exists, so the main document does not describe them as features.

| Integration | Status | Evidence | Note |
|---|---|---|---|
| I-05 Autodesk Forma | Not present (Conditional) | `TRACKER.md`, DD-036, `demo/js/screens/admin.js` | Only if the firm uses Forma |
| I-06 Bluebeam Studio | Not present (Conditional) | `TRACKER.md`, DD-036 | Needs confirmed India developer access |
| I-10 WhatsApp Business API | Not present (Decision pending) | `TRACKER.md`, DEC-09 | Privacy and consent decision at G1. "WhatsApp" exists only as a manual comment *source* (`CommentSource.WHATSAPP`), which the main document does describe |
| I-13 Paperless-ngx sidecar | Not present (Decision pending) | `TRACKER.md`, DEC-10, `docs/00-paperless-ngx-assessment.md` | Waits for DEC-10 |

## Everything else: complete in production code

All remaining features, automations, dashboards and integrations in the main document are built end to end (model, service, API, SPA screen, tests). Tracker status is *In review* for each.

| Area | Items | Evidence |
|---|---|---|
| Platform | F-38, F-39, F-40 (local + TOTP), F-41, API tokens, audit export | `backend/apps/accounts/`, `audit/`, `files/`; `backend/tests/test_auth.py`, `test_permission_map.py`, `test_api_permissions.py`, `test_audit.py`, `test_files.py` |
| Organisation settings | F-42, F-43, stage templates, naming rules, checklists, calendar | `core/`, `contacts/`, `projects/`, `register/naming.py`, `workflow/checklists.py`; `test_org_settings.py`, `test_contacts_users.py` |
| Projects | F-01, F-02, F-03, F-49, team | `projects/`; `test_projects.py`, e2e `s2-register.spec.ts` |
| Register | F-04…F-08, F-35, F-46…F-48, F-50, F-51, F-54, saved views, A-04 | `register/`, `transmittals/site.py`; `test_register.py`, `test_revisions.py`, `test_imports.py`, `test_titleblock.py`, `test_exports_onboarding.py`, `test_billing_site.py` |
| Workflow | F-10…F-13, A-07 | `workflow/`; `test_workflow.py`, `test_review_flow.py`, e2e `s3-workflow`, `s7-review-flow` |
| Transmittals | F-14, F-15, A-03, resend, distribution | `transmittals/`; `test_transmittals.py`, e2e `s4-issue` |
| People | F-16…F-19, A-05, A-06, CSV import | `people/`; `test_people.py`, e2e `s5-people` |
| Alerts | F-20, F-21, A-01, A-02, digest, quiet hours, owner summary, missing-sweep alert | `automation/`, `notifications/`, `dashboards/summary.py`; `test_automation.py`, `test_notifications.py` |
| Dashboards & reports | D-01…D-05, F-22, F-23, F-45, F-52, F-53, N-06, hours report | `dashboards/`, `exports/`, `audit/activity.py`; `test_dashboards.py`, `test_search_activity.py`, e2e `s6-dashboards` |
| Client comments | F-24, F-26, A-08 | `comments/`; `test_comments.py`, e2e `s8-comments` |
| Billing | F-27, A-09, CSV, mark invoiced | `billing/`; `test_billing_site.py`, `test_net.py`, e2e `s9-billing-site` |
| CAD sync (server side) | F-09 proposals | `cadsync/`; `test_cadsync.py`, e2e `s10-cad-sync` |
| Construction | F-30…F-33, A-10 | `ca/`; `test_ca.py`, e2e `s12-construction` |
| Coordination / knowledge | F-34, I-07, F-58 | `coordination/`, `knowledge/`; `test_coordination.py`, `test_knowledge.py` |
| Non-functional | N-01 (load test on dev hardware), N-03, N-04, N-05, N-07, N-08, N-10 (review pending) | `loadtest/`, `.github/workflows/ci.yml`, `frontend/e2e/a11y.spec.ts`, `docs/privacy.md` |

Not product features but relevant: T-05 staging and T-06 production environments are *Blocked* (DEC-01); N-02 availability needs production hosting; N-09 capacity is *In progress* (seed exists, production-sized run not done).

## The `demo/` folder

`demo/` is a standalone, no-build browser prototype of the complete intended product (`demo/demo.html`, `demo/js/*`, fictional seed in `demo/js/demo-data.js`, state in `localStorage`). It never calls the backend, enforces permissions only in the browser, and simulates SSO, email, CAD plugins, webhooks and ML. Its own coverage map is `demo/feature-coverage.md`. The main document does not describe `demo/`; it documents the production system. Anything shown to a client from `demo/` should be presented as a prototype.

## Ambiguities and interpretations used in the main document

| Topic | Interpretation in the main document | Why it is ambiguous |
|---|---|---|
| Invitation mechanism | `POST /api/v1/users` + set-password link through the allauth reset flow; user shown as invited until first sign-in | No backend exists; chose the smallest design coherent with `UserViewSet`, allauth and the existing email templates. Alternatives: Django admin only, or an `invitation` table with expiring tokens. |
| Password reset | Available to local accounts through allauth headless | Settings point the reset link at `/sign-in`, but no SPA UI or tested email exists. |
| "Profile" | Account menu + `/me` + links to preferences and delegation | The prototype has a richer page; production has no route for it. |
| DL rights to check sheets | DL may start check / approve only as the assigned checker (or a delegate) | Spec 03 §17 gives DL a blanket ✔; the state machine requires the `checker` actor for `start_check`. The main document follows the code. |
| Admin timesheets | Admins do not log timesheets | `log_own_timesheet` covers Owner, Staff, Accounts only (`MEMBER_ORG_ROLES`); matches spec §17 but may surprise a firm whose IT staff bill hours. |
| Leave entry | Admin and DL only, not self-service | `people/services.py:add_leave`; spec F-16 says "Admin or DL can set capacity and leave". |
| Event catalogue | Events without handlers are described as "published for subscribers" | `project.created`, `sheet.created`, `import.committed`, `client_approval.recorded`, `submittal.reviewed`, `site_report.filed`, `change_order.*` have no in-process handler today. |
| Phase labels (P1–P4) | Omitted from the main document | All phases are built; labels would read as a roadmap. They remain in `TRACKER.md` and `docs/03`. |
| Credentials | Not reproduced | `README.md` and `demo/README.md` contain development/prototype passwords; the main document lists environment variable names only and no seed or prototype credentials. |
