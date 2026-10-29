# Privacy and data protection (N-10)

Prepared for review with the firm's counsel before go-live. Items marked **[COUNSEL]** need a
legal answer; the rest describe what the software does today.

## 1. What personal data DrawingOps holds

| Data | Whose | Why | Where it lives |
|---|---|---|---|
| Name, work email, org role, project roles | Staff | Sign-in, permissions, assignments | `user`, `project_membership` |
| Discipline, team, weekly capacity, leave dates and type (annual/sick/other) | Staff | Workload planning (F-16, F-17) | `staff_profile`, `leave` |
| Cost rate per hour | Staff | Fee tracking (P2); visible to Admin only | `staff_profile.cost_rate` |
| Planned and logged hours per project and stage | Staff | Workload and timesheets (F-17, F-18) | `allocation`, `timesheet`, `time_entry` |
| Name, email, phone, designation, organisation | Client, consultant and contractor contacts | Transmittals (F-14) | `contact`, `external_org` |
| Download log: who opened a transmittal link, when, IP | External recipients | Proof of issue (F-14) | `download_log` |
| Audit trail: actor, time, IP, request ID, before/after values | Staff | F-39; cannot be edited or deleted | `audit_event` |
| Sign-in events, TOTP secrets (admins) | Staff | Security (F-40) | allauth tables |

No special-category data is collected by design. **Sick leave is recorded only as a leave type,
never with a reason**; the UI offers no free-text reason field for leave.

## 2. Who can see hours (03 §9, §17)

* A person sees their own hours. A DL sees their discipline; a PL the people on their projects;
  the Owner everyone; Accounts sees **totals only** (project/stage), never per person.
* Individual hourly productivity is **not ranked anywhere**: utilisation lists sort by name.
* Enforced server-side (`apps/people/services.visible_people`, `apps/dashboards/services.hours_report`)
  and covered by tests (`tests/test_people.py`, `tests/test_dashboards.py`).

## 3. Retention

| Data | Retention | Basis |
|---|---|---|
| Issued revisions, transmittals, download logs | Life of the system (N-06) | Professional record of what was issued |
| Audit trail | Life of the system; export on request | F-39 |
| Timesheets and allocations | **[COUNSEL]** propose 8 years (accounting records) | |
| Leave records | **[COUNSEL]** propose 3 years | |
| Upload staging objects | 24 h (purged nightly) | `purge_stale_uploads` |
| Backups | 7 days (N-02) | |

## 4. Where data is stored

* Database and object storage in the agreed region (**DEC-01**: production storage is the owner's
  choice; default proposal is an Indian region, `ap-south-1`).
* Email is sent through the firm's SMTP relay; no third-party analytics or trackers in the app.
* Content-Security-Policy allows no third-party scripts (deploy/caddy/Caddyfile).

## 5. Rights of individuals

| Request | How |
|---|---|
| Access | Admin › Audit trail export filtered by person; staff profile from Workload › Staff |
| Correction | Admin or DL edits the staff profile; timesheets are returned for correction |
| Erasure | Deactivate the user (sign-in stops at once). Audit rows and issued records stay (legitimate interest / legal record). **[COUNSEL]** confirm this position under the DPDP Act 2023 |

## 6. Questions for counsel [COUNSEL]

1. Is the firm a *Data Fiduciary* under the Digital Personal Data Protection Act 2023 for staff and
   client contacts, and is a notice to staff about timesheet and workload processing needed?
2. Retention periods in §3.
3. Cross-border transfer if the owner chooses storage outside India (DEC-01).
4. Hospital projects: confirm drawings carry no patient data (they should not); if any site
   photos (P3) may show patients, add a capture rule before Phase 3.
5. Whether the download log (external recipients' IP addresses) needs a notice on the public
   transmittal page.

## 7. Status

Software controls above are implemented and tested. The legal review itself (T-07/N-10) is a
human task and is tracked as **Blocked – needs counsel** in `TRACKER.md`.
