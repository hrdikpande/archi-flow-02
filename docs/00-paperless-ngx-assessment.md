# 00 · Can we build DrawingOps on Paperless-ngx?

**Answer: no, not as the foundation.** Paperless-ngx is a good archive for scanned and emailed paperwork, but our core (a sheet register where sheets exist before any file, role-gated review states, transmittals, deadlines, workload and fee stages) does not exist in it, and its "one document = one file" model works against ours. Build our own app on the same open-source stack family (Django, Celery, PostgreSQL) and decide in Phase 2 whether to run Paperless-ngx beside it as an archive for correspondence.

| | |
|---|---|
| Checked on | 23 Oct 2026 |
| How | Cloned `github.com/paperless-ngx/paperless-ngx` (commit `f71a9a6`, 22 Oct 2026; changelog top entry 3.3.4) and read `docs/` (the source of docs.paperless-ngx.com) and the code. The website itself was blocked by this environment's network policy; the `docs/` folder is the same content. |
| Tags | **[SOURCED: path]** = read in the cloned repo · **[UNVERIFIED]** = my judgement |

---

## 1. What Paperless-ngx is

| Fact | Evidence |
|---|---|
| "A community-supported open-source document management system that transforms your physical documents into a searchable online archive" | [SOURCED: docs/index.md] |
| Licence: GNU GPL v3 | [SOURCED: LICENSE] |
| Stack: Django ~5.2, Django REST Framework ~3.16, Celery 5.6 with Redis/Valkey, Angular ~22 web UI; PostgreSQL, MariaDB or SQLite | [SOURCED: pyproject.toml, src-ui/package.json, docs/usage.md §Architecture] |
| OCR with Tesseract (100+ languages); stores a PDF/A archive copy next to the untouched original | [SOURCED: docs/index.md] |
| Accepted files: PDF, PNG, JPEG, TIFF, GIF, WebP, plain text; Office files only with the optional Tika service | [SOURCED: docs/faq.md] |
| Any other file type fails consumption with "Unsupported mime type" | [SOURCED: src/documents/consumer.py line 477] |
| Third-party parsers can be added through the `paperless_ngx.parsers` Python entry point | [SOURCED: src/paperless/parsers/registry.py] |
| Metadata: correspondent, tags, document type, storage path, archive serial number, notes, custom fields (string, URL, date, boolean, integer, float, monetary, document link, select, long text) | [SOURCED: docs/usage.md §Terms; src/documents/models.py] |
| File versions: several files under one document, sharing one set of metadata; `_vN` filename suffix; latest version used by default; "merging as versions cannot be undone from the UI" | [SOURCED: docs/usage.md §Document File Versions] |
| Workflows: triggers Consumption Started, Document Added, Document Updated, Scheduled (hourly check, offset from a date or a custom date field); actions Assignment, Removal, Email, Webhook, Move to Trash, Password Removal, Remote OCR, Apply AI Suggestions | [SOURCED: docs/usage.md §Workflows] |
| Permissions: global permissions plus per-object owner/view/edit for users and groups; object permissions do not cascade ("setting permissions for a Tag will not affect the permissions of documents that have the Tag") | [SOURCED: docs/usage.md §Permissions] |
| Email intake: IMAP accounts plus mail rules consume attachments | [SOURCED: docs/usage.md §Incoming Email] |
| Also: share links, audit log (on by default since 2.7), trash, saved views, REST API with versioning, opt-in LLM features | [SOURCED: docs/usage.md, docs/api.md] |
| No multi-tenancy mentioned anywhere in the docs | [SOURCED: grep of docs/] |

## 2. Fit against our requirements

Feature IDs refer to `03-features-and-functionality.md`.

| Our requirement | What Paperless-ngx offers | Verdict |
|---|---|---|
| A sheet exists in the register **before** any file is drawn (state Planned, F-04) | A document is created only by consuming a file | **Absent**; the core mismatch |
| Sheet register: number, discipline, owner, planned date, grid editing of 500+ rows (F-04, F-05) | Custom fields on documents; list views and bulk edit | Partial, weak |
| Issued PDF revisions under one sheet (F-06) | File versions under one document | **Covers** |
| Old revisions marked Superseded, watermark on download (F-07, F-48) | Latest version is the default; no superseded state or watermark | Partial |
| DWG, RVT, IFC, NWD files | Rejected unless we write a parser plugin | Absent |
| Review states with role-gated transitions, checker, redlines (F-10, F-11) | Workflows assign metadata; no approval state machine | Absent |
| Transmittals with numbered cover sheet and recipients (F-14) | Share links and email action only | Absent |
| Projects and fee stages (F-01 to F-03) | Could be faked with tags or storage paths | Absent |
| People, capacity, allocations, timesheets (F-16 to F-19) | None | Absent |
| At-risk / late alerts (A-01, A-02) | Scheduled workflow on a custom date field plus email action can send a reminder | Partial: no escalation, digest, working-day calendar or flag history |
| Owner and lead dashboards (F-22, F-23) | Document statistics and saved views | Absent |
| Client comments arriving by email (F-25) | Mail rules consume attachments | **Covers well** (attachments only; email body handling would need checking) |
| OCR and full-text search of scanned letters and approvals | Core strength | **Covers well** |
| RFIs, submittals, change orders (F-30 to F-33) | None | Absent |
| Per-project roles for 200+ users (F-38) | Groups and object permissions; no project membership | Partial |
| Audit of every state change (F-39) | Document audit log | Partial |

Rough coverage: about 15–20% of Phase 1 value, and none of the parts that make the product worth buying. [UNVERIFIED: my estimate]

## 3. Options

| Option | What it means | Verdict |
|---|---|---|
| A. Fork Paperless-ngx and extend it | Change its document model, add sheets, states, projects, people; reshape its Angular UI | **Reject.** We would fight its core model, rewrite most of the UI, and merge a fast-moving upstream for ever. [UNVERIFIED] |
| B. Run Paperless-ngx beside DrawingOps | Paperless archives scanned approvals, letters and emailed attachments; DrawingOps links to them through Paperless's REST API and webhook actions | **Decide in Phase 2** (tracker item I-13). Useful only if the firm has a large paper/scan problem. Costs a second system to host, back up and keep permissions aligned. |
| C. Build our own app on the same stack family | Django + DRF + Celery + Redis + PostgreSQL, with permissive libraries for PDF work | **Recommend.** Full control of the data model; the same skills and stack mean option B stays easy later. |

## 4. Licence notes (not legal advice)

- Paperless-ngx is GPL-3.0, not AGPL. Running it as a separate service and calling its API is the usual way to keep your own code separate; modifying and distributing it means giving recipients the source of those changes. Get legal advice before any modification. [UNVERIFIED]
- OpenConstructionERP (our other reference) is AGPL-3.0. Its patterns may inform the design; its code must not be copied (see `BUILD_PROMPT.md` guardrails).
- Libraries we plan to use, licences read from PyPI and npm on 23 Oct 2026: Django BSD-3-Clause, DRF BSD-3-Clause, Celery BSD-3-Clause, django-allauth MIT, psycopg LGPL-3.0, OCRmyPDF MPL-2.0, pikepdf MPL-2.0, openpyxl MIT, WeasyPrint BSD, drf-spectacular BSD-3-Clause, React MIT, Vite MIT, TanStack Query MIT, PDF.js (`pdfjs-dist`) Apache-2.0.

## 5. The wider open-source landscape you mentioned

- **Open-source CAD/BIM modellers** (FreeCAD, Bonsai/BlenderBIM, LibreCAD) are drawing-authoring tools. Authoring is out of scope by your rule; the firm keeps AutoCAD and Revit. [GIVEN scope rule]
- **Libraries worth knowing for later phases:**
  - IfcOpenShell, LGPL-3.0-or-later (PyPI), for reading IFC metadata (Phase 3+).
  - web-ifc, MPL-2.0, and @thatopen/components, MIT (npm), for viewing IFC models in the browser (optional, Phase 3+).
  - LibreDWG, GPL-3.0 (its COPYING file); its README says some advanced R2010+ objects fail to read. Do not link it into our app. If we need DWG data, read it inside AutoCAD through our Phase 2 plugin (I-03). [SOURCED: LibreDWG repo]
- **Other open-source DMS** (Mayan EDMS, Alfresco Community, Nextcloud) were not evaluated here; they share Paperless's limitation of being file-centric, not sheet- and deliverable-centric. [UNVERIFIED]

## 6. What we reuse from Paperless-ngx (ideas only)

- Consume-pipeline pattern: upload → detect type → parse → index → run rules. We use it for PDF issue and, in Phase 2, email intake.
- Mail rules for email intake (F-25).
- Scheduled triggers with date offsets, which are the same idea as our A-01/A-02 sweeps.
- Saved views and bulk edit in list screens (DESIGN.md register screen).
