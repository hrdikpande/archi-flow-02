# UAT script (T-07)

Run with the firm's champion on the staging stack before the pilot. Each step names the role,
the action and what must be seen. Mark ✔ / ✘ and note defects (severity 1–4).

| # | Role | Do | Expect |
|---|---|---|---|
| 1 | Admin | Admin › Organisation: set name, timezone, working week; Calendar: add a holiday | Saved; audit trail shows both changes |
| 2 | Admin | Users and roles: invite a DL and two designers | They can sign in with the firm's SSO |
| 3 | Admin | Onboarding: download the template, fill one live project, upload with its PDFs | Problems listed until fixed; "Load project" creates project, sheets and past revisions; no emails sent |
| 4 | PL | Projects › New project; Stages: apply template, fee % = 100, save as final | Stage plan final |
| 5 | PL | Team & hours: add DL, designers, DC | Each gets a "added to a project team" notification |
| 6 | DL | Register › Import Excel: 400-row register with 3 bad rows | Errors listed with reasons; fix; import; undo works within 24 h |
| 7 | Designer | My work: start a sheet; upload the PDF; submit for check | Sheet moves to Ready for check; checker notified |
| 8 | DL (checker) | Reviews: open, add redlines, return | Designer sees it under "Returned to you" |
| 9 | Designer | Upload P02, resubmit; DL approves | Approved for issue |
| 10 | DC | Issue 12 sheets to 3 recipients for GFC | One transmittal, cover sheet lists all 12, 3 emails |
| 11 | Client (no login) | Open the emailed link, download a sheet and the zip | Works without signing in; download logged |
| 12 | DC | Re-issue one sheet as C02 | Earlier recipients told; old revision downloads watermarked SUPERSEDED |
| 13 | DL | Workload: allocate a designer 20 h on Stage 4 for 4 weeks; copy forward | Heat map updates; over 110% shows ⛔ |
| 14 | Designer | Timesheets: log a week, submit | Locked; DL sees it under Approvals |
| 15 | DL | Approvals: approve one week, return another with a reason | Approved week read-only; returned week editable with the reason shown |
| 16 | Owner | Portfolio: click "Late" | Lands on the late list; numbers match the register |
| 17 | Anyone | ⌘K: search "OT duct" | M-205 found; opens the sheet |
| 18 | Owner | Reports: baseline for the last quarter | Four metrics with definitions |
| 19 | PL | Register › Export › Excel with a filter | File has only the filtered rows |
| 20 | Owner | Monday 08:30 | Weekly summary email arrives |

Exit (05 S6): all P1 acceptance criteria demonstrated, no open severity-1/2 defects, restore drill
passed (`make restore-drill`, recorded in `docs/runbooks/restore-drills.md`).
