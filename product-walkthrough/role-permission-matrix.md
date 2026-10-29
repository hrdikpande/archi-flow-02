# DrawingOps · role and permission matrix

How each role experiences DrawingOps: what it sees, what it can do, and what it cannot. Built from three sources that agree with each other:

1. **Observed in the demo**: every role was signed in with Playwright and every route opened (`product-walkthrough/pipeline` exploration run, 8 roles × 33 routes); navigation items and capability flags were read from the running app (`DO.store.caps`).
2. **Demo rules**: `demo/js/demo-state.js` (`caps`, `allowedActions`, `canSeeProject`, `canSeeHoursOf`).
3. **Specification**: `docs/03-features-and-functionality.md` §17 (permission matrix), §18 (notifications).

A person has one **organisation role** (Owner, Staff, Accounts, Admin) and, on each project, one or more **project roles** (Project lead, Discipline lead for a discipline, Designer, Senior reviewer, Document controller, Viewer). Permissions combine both. In production they are enforced on the server for every request; in the prototype they are enforced in the browser only.

## Demo personas

| Role | Persona | Organisation role | Project roles in the demo data |
|---|---|---|---|
| Owner / Principal | Nikhil Prasad | Owner | none needed: sees every project |
| Project lead | Priya Sharma | Staff | PL on 2026-014, 2025-047, 2026-003, 2026-018; Viewer on the others |
| Discipline lead | Anil Kapoor | Staff | DL (Architecture) on all 9 projects |
| Designer | Rahul Kumar | Staff | Designer (HVAC) on 7 projects |
| Senior reviewer | Sunita Rao | Staff | Senior reviewer on 5 projects |
| Document controller | Deepa Chandra | Staff | DC on all 9 projects |
| Accounts | Meera Thomas | Accounts | none: sees stage data on every project |
| System admin | Asha Menon | Admin (password + TOTP) | none: sees every project |
| External recipient | e.g. Dr. Vikram Nair (client) | no account | receives transmittal links; site view link |

## Navigation per role (observed)

| Item | Owner | PL | DL | Designer | SR | DC | Accounts | Admin |
|---|---|---|---|---|---|---|---|---|
| My work | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Portfolio | ✔ | ✔ | — | — | — | — | — | ✔ |
| Projects | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Reviews (with waiting count) | ✔ | ✔ | ✔ (9) | ✔ | ✔ (3) | ✔ | ✔ | ✔ |
| Workload | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | ✔ |
| Timesheets | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — |
| Reports | ✔ | ✔ | ✔ | — | — | — | ✔ | ✔ |
| Knowledge | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Billing | ✔ | ✔ | — | — | — | — | ✔ | — |
| Contacts | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Admin | Audit trail only | — | — | — | — | — | — | ✔ (all 14 sections) |

## Pages per role (observed; "—" means the app shows "No access")

| Route | Owner | PL | DL | Designer | SR | DC | Accounts | Admin |
|---|---|---|---|---|---|---|---|---|
| `#/portfolio` | ✔ | ✔ | — | — | — | — | — | ✔ |
| `#/projects/new` | ✔ | ✔ | — | — | ✔ (can lead) | — | — | ✔ |
| Project tabs (`#/projects/:pid/*`) | all 9 tabs | all 9 tabs | all 9 tabs | all 9 tabs | all 9 tabs | all 9 tabs | **Overview and Stages only** | all 9 tabs |
| `#/timesheets` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — (admins do not log hours) |
| `#/timesheets/approvals` | — | ✔ | ✔ | — | — | — | — | — |
| `#/reports` tabs | Baseline, Hours, Utilisation, Review cycle, Missing | Hours, Utilisation, Review cycle, Missing | same as PL | — | — | — | Hours, Review cycle | all five |
| `#/billing` | ✔ (all) | ✔ (own projects) | — | — | — | — | ✔ (all) | — |
| `#/admin/*` | Audit trail | — | — | — | — | — | — | ✔ |
| `#/intelligence/findings` | view | view | view | view | act | act | view | act |

## Actions (rules from `allowedActions` and docs/03 §17)

✔ allowed · own = only on own sheets · — not allowed.

| Action | Owner | PL | DL | Designer | SR | DC | Accounts | Admin | External |
|---|---|---|---|---|---|---|---|---|---|
| View projects | all | member projects | member projects | member projects | member projects | member projects | stage data only | all | own transmittals; site view |
| Create project, edit stage plan | ✔ | ✔ | — | — | — | — | — | ✔ | — |
| Create, import, edit sheets; inline and bulk edits | — | ✔ | ✔ (own discipline) | notes | — | — | — | — | — |
| Start / submit for check | — | ✔ | ✔ | own | — | — | — | — | — |
| Withdraw a submission | — | ✔ | — | own | — | — | — | — | — |
| Start check, return, approve | — | ✔ | ✔ (assigned checker) | — (never own sheet) | ✔ (senior QC) | — | — | — | — |
| Upload issued PDF, issue transmittal | — | ✔ | — | — | — | ✔ | — | — | — |
| Hold, resume, cancel, supersede, delete never-issued sheet, override a step (with reason) | — | ✔ | — | — | — | — | — | — | — |
| Admin reopen of cancelled/superseded sheet | — | — | — | — | — | — | — | ✔ | — |
| Allocate hours | — | ✔ | ✔ | — | — | — | — | — | — |
| Log own timesheet | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | — | — |
| Approve / return timesheets | — | ✔ | ✔ | — | — | — | — | — | — |
| See others' hours | everyone | project members | own discipline | — | — | — | totals only | — | — |
| Log client comments | — | ✔ | ✔ | — | — | ✔ | — | — | — |
| Record client approval | — | ✔ | — | — | — | — | — | — | — |
| Mark invoiced, push to accounting | — | — | — | — | — | — | ✔ | — | — |
| Accept / dismiss AI findings | — | — | — | — | ✔ | ✔ | — | ✔ | — |
| Org settings, users, integrations, automation, onboarding | — | — | — | — | — | — | — | ✔ | — |
| Export audit trail | ✔ | — | — | — | — | — | — | ✔ | — |
| Acknowledge receipt, download drawings | — | — | — | — | — | — | — | — | ✔ (no sign-in) |

## Role-specific "My work" (observed)

| Role | What My work shows |
|---|---|
| Designer | Due soon (own sheets by date, state, flags, next action), Returned to you, Hours this week, Latest for you |
| Discipline lead | Due soon (empty if no own sheets), Returned to you, Waiting for your check (count, oldest), Your disciplines (dashboard link), Hours this week |
| Project lead | Due soon, Projects you lead (stage, issued/planned, late, at risk), Waiting for your check, Hours this week |
| Senior reviewer | Waiting for your check (senior QC), Hours this week |
| Document controller | Approved and ready to issue (per project, Issue button), Hours this week |
| Accounts | Ready to invoice (stage, fee %, amount, days waiting), Hours this week |
| Owner | Ready to invoice, Hours this week, latest notifications (portfolio is the main dashboard) |
| Admin | Set up your firm (links to disciplines, calendar, naming rules, onboarding, users, integrations, audit) |

## Notifications per role (docs/03 §18, demo `EVENTS`)

| Event | Goes to | Default | Mandatory |
|---|---|---|---|
| Sheet assigned to you | Designer | instant | yes |
| Sheet ready for your check | Checker | instant | yes |
| Sheet returned with redlines | Designer | instant | yes |
| Sheet approved for issue | Designer, DC | digest | no |
| Senior QC needed | Senior reviewer | instant | yes |
| At risk (A-01) | Designer, DL | digest | no |
| Late (A-02) / escalation | DL, then PL | instant | no |
| Transmittal sent | PL | digest | no |
| Over/under-allocated (A-05) | DL, PL | digest | no |
| Timesheet missing (A-06) | Person | instant | no |
| Review overdue (A-07) | Reviewer or delegate, DL | instant | no |
| Client comment overdue (A-08) | Assignee, PL | instant | no |
| Ready to invoice (A-09) | Accounts, Owner, PL | instant | yes |
| RFI due (A-10) | Assignee | instant | no |
| Weekly owner summary | Owner | email | no |
| Transmittal / new revision (A-03) | External recipients | email | yes |

## Privacy rules visible in the product

- Individual hours are visible only to the person, their discipline lead, the project lead and the owner; Accounts sees totals (Team & hours, Reports).
- Utilisation lists people alphabetically and never ranks individuals (Reports › Utilisation).
- Accounts sees projects as stages and fees only.
- External recipients see only their own transmittal; the site view lists only current issued revisions.

## Where the video shows each role

See `coverage-report.md` › *Roles and dashboards*.
