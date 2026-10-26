# 06 · Inputs requested from the firm

Everything DrawingOps needs the design firm to provide, in one checklist of 121 items: people, answers, documents, data, access, decisions, settings and sign-offs. Fourteen items block the discovery call; the rest are needed in time for the sprint, phase or gate shown. Each row points back to the assumption (AS-), decision (DEC-), task (P0-) or tracker item it unblocks.

| | |
|---|---|
| Prepared | 26-Oct-2026 by LatentIQ |
| Owner of this list | LatentIQ founder (sends, chases, records receipt) |
| Status values | Not requested · Requested · Received · Partly received · Not applicable · Blocked |
| Firm roles used below | **Owner** (principal) · **Champion** (senior architect named at G0) · **PL** project lead · **DL** discipline lead · **DC** document controller · **IT** · **Accounts** · **HR/Admin** · **Legal** |

**When each item is needed**

| Label | Meaning |
|---|---|
| Before call | Send before the first discovery call |
| P0 | During the 3-week discovery |
| G0 | Before discovery sign-off |
| S1 … S6 | Before that Phase 1 sprint starts (`05-build-phases.md`) |
| Pilot | Before the 4-week pilot starts |
| P2 / P3 / P4 | Before that later phase starts |

---

## 1. Request now: the 14 items that block discovery

| # | Item | From |
|---|---|---|
| REQ-001 | Named client sponsor (the owner) and their availability for a 60-minute call | Owner |
| REQ-002 | Named day-to-day champion (senior architect) | Owner |
| REQ-003 | Interview slots: owner, 3 project leads, 3 discipline leads, document controller, accounts (45 min each) | Owner |
| REQ-012 | Owner's answers to the "what you want" questions (§3.1) | Owner |
| REQ-030 | One typical signed appointment letter (with stage schedule and fee %) | Owner / Accounts |
| REQ-031 | One live project's sheet register (Excel or printout) | PL |
| REQ-032 | Sheet-numbering and file-naming conventions (any written standard) | DL / DC |
| REQ-033 | Title-block template (DWG and a sample PDF sheet) | DL |
| REQ-034 | Two sample transmittals or issue emails | DC |
| REQ-050 | List of active projects with code, client, stage, lead, approximate sheet count | PL / Admin |
| REQ-070 | Baseline data from 2 completed projects (§6) | PL / Accounts |
| REQ-090 | Hosting preference: Indian cloud region or on-premise server (DEC-01) | Owner / IT |
| REQ-091 | Email and sign-in platform: Google Workspace or Microsoft 365 (DEC-02) | IT |
| REQ-092 | Folder listing of the file server for one project (no files, just names) | IT |

A ready-to-send message for these is in §13.

---

## 2. People and governance

| ID | Item | Why we need it | Format | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|---|
| REQ-001 | Client sponsor named; 60-minute kickoff | Decisions and adoption push | Name, calendar slot | Owner | Before call | 01 §4, AS-13 | Not requested |
| REQ-002 | Day-to-day champion named, with ~4 hours/week in P0 and pilot | Answers, UAT, pilot coordination | Name, time commitment | Owner | Before call | 01 §4 | Not requested |
| REQ-003 | Interview slots (owner, 3 PLs, 3 DLs, DC, accounts) | As-is process and pain evidence | Calendar slots | Owner | Before call | P0-02 | Not requested |
| REQ-004 | IT contact with admin rights for email, sign-in and servers | SSO, email relay, hosting, network | Name, email, phone | IT | P0 | 01 §4 | Not requested |
| REQ-005 | Accounts contact | Baseline invoice data; P2 billing signal | Name | Accounts | P0 | P0-02, F-27 | Not requested |
| REQ-006 | Discipline champions for pilot projects (one per discipline) | Feedback and peer support | Names | DLs | Pilot | 01 §4, §8 | Not requested |
| REQ-007 | UAT testers (4–6 people across roles) | Acceptance testing in S6 | Names, availability in S6 | Champion | S6 | T-07 | Not requested |
| REQ-008 | Decision makers for DEC-01 to DEC-10 | Avoid blocked sprints | Name per decision | Owner | G0 | 01 §13 | Not requested |
| REQ-009 | Owner commitment to run the weekly review from the portfolio dashboard during the pilot | Adoption; G1 criterion | Yes/no | Owner | G0 | AS-13, 01 §9 | Not requested |
| REQ-010 | Who in the firm owns DrawingOps day to day after go-live | Support and admin | Name | Owner | Pilot | 01 §11 | Not requested |
| REQ-011 | Escalation contact for severity-1 issues | Support | Name, phone | Owner | Pilot | 01 §11 | Not requested |

## 3. Answers to discovery questions

### 3.1 What the owner wants

| ID | Question | From | Needed by | Ref | Status |
|---|---|---|---|---|---|
| REQ-012 | Every Monday, what do you want to know that you can't see today? Who do you call to find out? Which three problems cost the most money or reputation last year (one real example)? What result in six months would make this a success? | Owner | Before call | Research §14.2 | Not requested |

### 3.2 Firm scope and scale

| ID | Question | From | Needed by | Ref | Status |
|---|---|---|---|---|---|
| REQ-013 | Is structural design done in-house or by outside consultants? | Owner | P0 | AS-02 | Not requested |
| REQ-014 | What does "civil architecture" cover (site civil works such as roads, drainage, STP, or building architecture)? | Owner | P0 | Research §2 | Not requested |
| REQ-015 | Disciplines in the firm (architecture, HVAC, electrical, plumbing, fire, ELV, medical gas, civil, interiors, other) and headcount per discipline | HR/Admin | P0 | F-42, F-16 | Not requested |
| REQ-016 | Number of projects running at once; sheets per typical hospital project; revisions per sheet | PL | P0 | AS-04, AS-09 | Not requested |
| REQ-017 | Does the firm provide construction-stage services (RFIs, site visits, submittal reviews) on hospital projects? | Owner | P0 | P3 scope | Not requested |
| REQ-018 | Is the firm working on Narayana Health's planned new hospitals or similar programmes? | Owner | P0 | Research §2 | Not requested |
| REQ-019 | Office locations and whether staff work on Saturdays | HR/Admin | P0 | AS-06, DEC-04 | Not requested |

### 3.3 How work is done today

| ID | Question | From | Needed by | Ref | Status |
|---|---|---|---|---|---|
| REQ-020 | How does internal review work? Who signs a sheet off before issue? Which milestones need a senior/principal check? | DL, Owner | P0 | F-11, DEC-08 | Not requested |
| REQ-021 | How are drawings issued to clients, consultants and site (email, shared drive, print)? Is there a document controller? | DC, PL | P0 | AS-07, DEC-07 | Not requested |
| REQ-022 | How do client comments arrive (email, WhatsApp groups, meetings, letters)? Who records them? | PL | P0 | F-24, I-10 | Not requested |
| REQ-023 | Who decides a stage is finished, and how long after that does the invoice go out? | Owner, Accounts | P0 | H7, F-27 | Not requested |
| REQ-024 | How are hours recorded today, if at all? | HR/Admin | P0 | DEC-03, F-18 | Not requested |
| REQ-025 | Which software is in use: AutoCAD and Revit (which years, same version for everyone?), Navisworks, Bluebeam, Autodesk Forma/Construction Cloud or BIM 360, Newforma, Aconex? Do any clients require a specific platform? | IT, DL | P0 | AS-01, I-03 to I-06 | Not requested |
| REQ-026 | Which accounting and invoicing tool is used (Tally, Zoho Books, other)? | Accounts | P0 | I-08 | Not requested |
| REQ-027 | Any staff sensitivity about tracking hours or workload? | Owner, HR/Admin | P0 | N-10, 03 §9 | Not requested |

## 4. Documents and samples

| ID | Item | Why we need it | Format | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|---|
| REQ-030 | Typical signed appointment letter with stage schedule and fee % | Stage template (F-02); billing logic | PDF | Owner / Accounts | Before call | AS-05, DEC-05 | Not requested |
| REQ-031 | One live sheet register | Register fields and import mapping | Excel or PDF | PL | Before call | F-04, F-05 | Not requested |
| REQ-032 | Sheet-numbering and file-naming conventions | Naming rules (F-35, A-04) | Any written standard or examples | DL / DC | Before call | DEC-06 | Not requested |
| REQ-033 | Title-block template and one sample issued sheet | Sheet fields; P2 title-block reading | DWG + PDF | DL | Before call | F-50, I-03 | Not requested |
| REQ-034 | Two sample transmittals or issue emails | Transmittal format and numbering (F-14) | PDF / email | DC | Before call | F-14 | Not requested |
| REQ-035 | Revision-code practice (P01/C01, A/B/C, 0/1/2…) with examples | Revision scheme setting | Examples | DC | S2 | F-06, F-42 | Not requested |
| REQ-036 | Issue purposes in use (for comment, approval, tender, GFC, authority, record) and their wording on drawings | Purpose codes | List | DC | S3 | F-08 | Not requested |
| REQ-037 | CAD standards manual (layers, title blocks), if any | Quality checks later | PDF | DL | P0 | Pain 13 | Not requested |
| REQ-038 | Existing QC or review checklists, if any | Pre-check checklists (P2) | Any | DL | P2 | F-13 | Not requested |
| REQ-039 | Organisation chart (teams, leads, disciplines) | Roles and permissions | Chart or list | HR/Admin | S1 | F-16, F-38 | Not requested |
| REQ-040 | Firm logo and letterhead | Transmittal cover sheet, emails | SVG or high-res PNG | Admin | S4 | F-14 | Not requested |
| REQ-041 | Standard wording for transmittal emails and cover sheet notes (disclaimers) | External communications | Text | Owner / DC | S4 | F-14 | Not requested |

## 5. Data for loading

| ID | Item | Why we need it | Format | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|---|
| REQ-050 | Active projects: code, name, client, type, location, stage, lead, approximate sheet count | Portfolio and pilot choice | Excel | PL / Admin | Before call | F-01, F-54 | Not requested |
| REQ-051 | Staff list: name, work email, discipline, role, team, weekly hours, part-time status | Users, capacity | Excel | HR/Admin | S1 | F-16 | Not requested |
| REQ-052 | Office holiday calendar for the current and next year | Working-day calculations | List of dates | HR/Admin | S1 | F-42, DEC-04 | Not requested |
| REQ-053 | Contacts: clients, consultants (incl. structural), contractors, authorities with names and emails | Transmittal recipients | Excel | PL / DC | S1 | F-43 | Not requested |
| REQ-054 | Pilot projects' full sheet registers, filled in the DrawingOps template workbook | Pilot data load | Template (provided by LatentIQ in S2) | Champion, PLs | Pilot | F-54 | Not requested |
| REQ-055 | Pilot projects' past issued PDFs, organised by sheet and revision | Historic revisions | Folder of PDFs | DC | Pilot | F-54 | Not requested |
| REQ-056 | Pilot projects' stage plans with dates | Stage tracking | Excel or appointment letter | PL | Pilot | F-02, F-03 | Not requested |
| REQ-057 | Staff leave already approved for the pilot period | Capacity | Excel | HR/Admin | Pilot | F-16 | Not requested |
| REQ-058 | Existing timesheet export, if hours are already recorded elsewhere | CSV import (F-18) | CSV/Excel | HR/Admin | S5 | DEC-03 | Not requested |

## 6. Baseline data (for the G0 metrics)

Measured on at least two completed projects so the pilot can be judged against today (`01-implementation-plan.md` §1, §9).

| ID | Item | Why we need it | Format | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|---|
| REQ-070 | For 2 completed projects: sheet list with planned and actual issue dates | Late issue rate | Excel, emails or transmittal log | PL | P0 | P0-04, D-05 | Not requested |
| REQ-071 | For the same projects: dates sheets were sent for check and approved (best available) | Review wait | Emails, review logs | DL | P0 | D-05 | Not requested |
| REQ-072 | For the same projects: stage completion dates and invoice dates | Stage-to-invoice delay | Accounts records | Accounts | P0 | D-05, H7 | Not requested |
| REQ-073 | Hours spent per project and stage, if recorded | Hours vs plan | Any | HR/Admin | P0 | D-05 | Not requested |
| REQ-074 | Two or three real incidents (wrong revision on site, missed deadline, lost client comment) with rough cost or delay | Business case and priorities | Short description | Owner, PLs | P0 | H2, H3, H6 | Not requested |

## 7. IT, access and infrastructure

| ID | Item | Why we need it | Format | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|---|
| REQ-090 | Hosting choice: Indian cloud region or on-premise server | Architecture and cost | Decision | Owner / IT | Before call (preference), G0 (final) | DEC-01, AS-14 | Not requested |
| REQ-091 | Email and sign-in platform: Google Workspace or Microsoft 365 | SSO and email | Answer | IT | Before call | DEC-02, AS-12 | Not requested |
| REQ-092 | File-server folder listing for one project | Storage layout; CAD links | Text listing | IT | Before call | F-41, I-02 | Not requested |
| REQ-093 | If cloud: an account or subscription in the firm's name, or approval for LatentIQ to host | Production environment | Account access | IT / Owner | S1 | T-05, T-06 | Not requested |
| REQ-094 | If on-premise: a server or VM meeting the sizing (8 vCPU, 32 GB RAM, 200 GB SSD + storage for PDFs), with remote access for LatentIQ | Production environment | Server access | IT | S1 | 02 §14, AS-09 | Not requested |
| REQ-095 | Subdomain for the app (e.g. `drawings.<firm-domain>`) and DNS changes | Web address and TLS certificate | DNS records | IT | S1 | 02 §2 | Not requested |
| REQ-096 | SSO setup: OIDC app registration (Microsoft Entra ID or Google) and admin consent | Sign-in (F-40) | Client ID, tenant details shared securely | IT | S1 | I-11 | Not requested |
| REQ-097 | Outgoing email: SMTP relay or approval to use a transactional email service; SPF/DKIM records for the sending domain | Notifications and transmittals | Relay details shared securely; DNS records | IT | S1 | I-12 | Not requested |
| REQ-098 | Read-only network path from the app to the file server, or confirmation that CAD links are only displayed | CAD links now, file activity later | Network/VPN details | IT | S2 (links), P2 (connector) | F-41, I-02 | Not requested |
| REQ-099 | Offsite backup location (second region, bucket or NAS) | Backups and restore drill | Storage access | IT | S6 | N-02 | Not requested |
| REQ-100 | Browser versions in use and office internet speed | Browser support; PDF viewer target | Answer, speed test | IT | S3 | N-07, AS-10 | Not requested |
| REQ-101 | Firewall, VPN or device-management rules that apply to new web apps | Access from office and site | Policy | IT | S1 | N-03 | Not requested |
| REQ-102 | Error monitoring: approval to send error reports to a cloud service, or require self-hosted | Observability | Decision | IT / Owner | S1 | N-05 | Not requested |

## 8. Decisions

| ID | Decision | Options | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|
| REQ-110 | Hosting | Indian cloud region / on-premise | Owner, IT | G0 | DEC-01 | Not requested |
| REQ-111 | Sign-in provider | Google Workspace / Microsoft 365 | IT | G0 | DEC-02 | Not requested |
| REQ-112 | Timesheets | Use DrawingOps / import from existing tool / not in Phase 1 | Owner, HR | S5 | DEC-03 | Not requested |
| REQ-113 | Work week | Mon–Fri / Mon–Sat | HR/Admin | S1 | DEC-04 | Not requested |
| REQ-114 | Stage template and fee percentages | Firm's standard | Owner | S2 | DEC-05 | Not requested |
| REQ-115 | Sheet-numbering and file-naming rules | Firm's standard, or adopt one | DLs, DC | S2 | DEC-06 | Not requested |
| REQ-116 | Who issues drawings | Document controller / project lead | Owner | S4 | DEC-07 | Not requested |
| REQ-117 | Milestones and stages needing senior QC | e.g. 60%, 90%, GFC | Owner | S3 | DEC-08 | Not requested |
| REQ-118 | WhatsApp capture of client comments | Allowed / not allowed | Owner | G1 | DEC-09, I-10 | Not requested |
| REQ-119 | Paperless-ngx archive for scanned paperwork | Yes / no | Owner | P2 | DEC-10, I-13 | Not requested |
| REQ-120 | Pilot projects (two, one of them a hospital) | Named projects | Owner, Champion | G0 | P0-08 | Not requested |
| REQ-121 | Phase 1 scope, price and dates signed | Fixed-scope agreement | Owner | G0 | G0 | Not requested |
| REQ-122 | G1 targets (late issue rate, review wait, adoption) | Numbers agreed against baseline | Owner | G0 | 01 §9 | Not requested |

## 9. Settings to confirm (defaults proposed by LatentIQ)

The firm confirms or changes each default before the sprint shown.

| ID | Setting | Proposed default | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|
| REQ-130 | Disciplines and sheet-number prefixes | A, S, C, M (HVAC), E, P (plumbing), F (fire), X (ELV), MG (medical gas) | DLs | S1 | F-42 | Not requested |
| REQ-131 | Weekly capacity per person | 45 hours | HR/Admin | S5 | AS-08 | Not requested |
| REQ-132 | Purposes each stage needs before it counts as "deliverables issued" | Approval for early stages; GFC for working drawings | Owner, PLs | S4 | 03 §4 | Not requested |
| REQ-133 | At-risk warning period | 7 working days before planned date | Owner | S4 | A-01 | Not requested |
| REQ-134 | Late escalation | After 3 working days late, to project lead | Owner | S4 | A-02 | Not requested |
| REQ-135 | Over/under-allocation thresholds | Above 110% / below 50% of capacity | Owner, DLs | S5 | A-05 | Not requested |
| REQ-136 | Timesheet deadline | Tuesday 12:00 for the previous week | HR/Admin | S5 | A-06 | Not requested |
| REQ-137 | Daily digest time and weekly owner summary time | 08:30 daily; Monday 08:30 | Owner | S4 | F-21 | Not requested |
| REQ-138 | Download-link expiry for external recipients | 30 days | Owner, DC | S4 | F-14 | Not requested |
| REQ-139 | Who may see whose hours | Self; DL sees discipline; PL sees project totals; owner sees all; no individual ranking | Owner, HR | S5 | 03 §9 | Not requested |
| REQ-140 | Transmittal number format | `<project code>-TR-<NNNN>` | DC | S4 | F-14 | Not requested |
| REQ-141 | Project code format | `YYYY-NNN` | Admin | S2 | F-01 | Not requested |
| REQ-142 | Date, money and time formats | 23-Oct-2026; ₹1,00,000; IST, 24-hour | Owner | S1 | N-08 | Not requested |
| REQ-143 | Support hours and severity targets | IST working days 09:30–18:30; severity-1 response 1 hour | Owner | Pilot | 01 §11 | Not requested |

## 10. Legal, security and commercial

Discuss these with the owner directly rather than sending them in a list.

| ID | Item | Why we need it | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|
| REQ-150 | Mutual NDA | Sharing drawings and client data in discovery | Owner / Legal | Before call | – | Not requested |
| REQ-151 | Data-processing terms: what data LatentIQ may access, where it is stored, retention and deletion | Hospital client data, staff data | Legal | G0 | N-06, N-10 | Not requested |
| REQ-152 | Hospital client contract clauses on drawing confidentiality or storage location | Hosting and access rules | Legal / PL | G0 | AS-14 | Not requested |
| REQ-153 | Privacy review sign-off for staff hours and workload data (India data-protection obligations) | Go-live readiness | Legal / HR | S6 | N-10 | Not requested |
| REQ-154 | Staff communication about the new system and what is measured | Trust and adoption | Owner / HR | Pilot | 01 §8 | Not requested |
| REQ-155 | Budget range and target go-live date | Plan and price | Owner | Before call | 01 §10 | Not requested |
| REQ-156 | Agreement to a paid 2–3 week discovery | Start P0 | Owner | Before call | 01 §2 | Not requested |
| REQ-157 | Purchase order, billing entity, GST number, payment terms | Invoicing LatentIQ's work | Accounts | G0 | – | Not requested |
| REQ-158 | Agreement on intellectual property: firm owns its data; LatentIQ keeps the reusable product core | Productisation | Owner / Legal | G0 | 01 §10 | Not requested |
| REQ-159 | Acceptance sign-off authority for each gate | G0–G2 decisions | Owner | G0 | 01 §9 | Not requested |
| REQ-160 | Written consent before any client drawing data is sent to an outside AI model | Phase 4 guardrail | Owner / Legal | P4 | F-57, 02 §17 | Not requested |

## 11. Pilot and rollout

| ID | Item | Why we need it | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|
| REQ-170 | Pilot user list (names, roles, emails) for the two pilot projects | Accounts and training | Champion | Pilot | T-08 | Not requested |
| REQ-171 | Training slots: 90 minutes for champions, 45 minutes per role group | Pilot week 1 | Champion | Pilot | 01 §8 | Not requested |
| REQ-172 | Meeting room with a screen, or video-call setup, for training and daily office hours | Training | Admin | Pilot | 01 §8 | Not requested |
| REQ-173 | Champion's time for weekly usage review (30 minutes/week) | Adoption metrics | Champion | Pilot | 01 §8 | Not requested |
| REQ-174 | Rollout order after the pilot (which projects and disciplines first) | Wave plan | Owner | G1 | 01 §7 | Not requested |

## 12. Later phases

| ID | Item | Why we need it | From | Needed by | Ref | Status |
|---|---|---|---|---|---|---|
| REQ-180 | Accounting export layout: columns the accounting tool needs; sample invoice | Billing signal export (F-28) | Accounts | P2 | I-08 | Not requested |
| REQ-181 | How client stage approval is evidenced today (email, signed letter, minutes) | Client approval record (F-26) | PL | P2 | F-26 | Not requested |
| REQ-182 | A mailbox or forwarding rule for client comments per project | Email capture (F-25) | IT | P2 | I-09 | Not requested |
| REQ-183 | Permission to install CAD plugins on staff machines, and the exact AutoCAD/Revit versions per machine | Plugins (F-09) | IT | P2 | I-03, I-04 | Not requested |
| REQ-184 | Sample DWG and RVT files with the firm's title blocks and sheet sets | Plugin development and testing | DL | P2 | I-03, I-04 | Not requested |
| REQ-185 | Autodesk Forma/Construction Cloud account access, if used (API app registration) | Forma integration | IT | P2 | I-05 | Not requested |
| REQ-186 | Bluebeam account and Studio usage details, if used | Bluebeam integration | IT | P3 | I-06 | Not requested |
| REQ-187 | Sample Navisworks clash reports or BCF exports | Clash import (F-34) | DL (MEP) | P3 | I-07 | Not requested |
| REQ-188 | Templates for RFIs, submittal reviews, site visit reports, change orders | Construction-stage modules | PL | P3 | F-30 to F-33 | Not requested |
| REQ-189 | Review stamp wording for submittals (approved, approved as noted, revise and resubmit, rejected) | Submittal stamps (F-31) | Owner | P3 | F-31 | Not requested |
| REQ-190 | Approval to use 6+ months of DrawingOps history for forecasting models | Phase 4 | Owner | P4 | G3, F-55, F-56 | Not requested |
| REQ-191 | A labelled set of ≥ 200 issued sheets with known drawing issues | Evaluating AI drawing checks | DLs | P4 | F-57 | Not requested |

---

## 13. Message to send the owner (ready to paste)

> Subject: Getting started: 14 items before our discovery call
>
> Dear [Owner name],
>
> Thank you for the time so far. To make our first discovery call useful, could your team send the items below? Rough versions are fine; we will tidy them together.
>
> **People**
> 1. A day-to-day contact (ideally a senior architect) who can give about 4 hours a week during discovery.
> 2. 45-minute interview slots with you, three project leads, three discipline leads, your document controller (if you have one) and accounts.
>
> **Your view**
> 3. What would you like to see every Monday that you can't see today? Which three problems have cost the most in the last year?
>
> **Documents**
> 4. One typical appointment letter showing the stage schedule and fee percentages.
> 5. The sheet list for one live project (Excel or printout).
> 6. Any written sheet-numbering or file-naming rules.
> 7. Your title-block template and one sample issued sheet (PDF).
> 8. Two recent transmittals or issue emails.
> 9. A list of active projects with lead, stage and rough sheet count.
>
> **Data for a baseline**
> 10. For two completed projects: planned and actual issue dates of sheets, and when each stage was invoiced (whatever records exist).
>
> **IT**
> 11. Do you use Google Workspace or Microsoft 365 for email?
> 12. Would you prefer the system hosted in an Indian cloud region or on a server in your office?
> 13. A folder listing (names only) of one project on your file server.
>
> **Next step**
> 14. A 60-minute slot for the kickoff call.
>
> We will share a mutual NDA before any drawings change hands.
>
> Regards,
> [Founder name]
> LatentIQ AI Technologies
