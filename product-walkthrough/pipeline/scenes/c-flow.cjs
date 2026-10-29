/* Chapters 08 to 11: designer, checking and senior QC, issue and transmittals, the client's side. */
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });
const sheetId = (r, n, pid = "p1") => r.eval(([n, pid]) => DO.store.S.sheets.find((x) => x.projectId === pid && x.number === n).id, [n, pid]);
const openReviewId = (r, n, kind) => r.eval(([n, kind]) => { const s = DO.store.S.sheets.find((x) => x.projectId === "p1" && x.number === n); return DO.store.S.reviews.find((v) => v.sheetId === s.id && v.state === "open" && (!kind || v.kind === kind))?.id; }, [n, kind]);
const pageCard = (title) => `main section.card:has(> .card-head :text-is("${title}"))`;

module.exports = [
  {
    id: "designer", num: "08", title: "Designer: my work and pre-checks",
    steps: [
      {
        say: "Chapter eight: a designer's day.",
        act: async (r) => { await r.card(chapterCard("08", "Designer: my work and pre-checks", "One list of my sheets with the next action on each, one click at the real event, and a checklist before every submission.", [{ icon: "pen-tool", text: "Rahul Kumar · Designer (HVAC)" }])); },
      },
      {
        say: "Rahul is an HVAC designer. My work lists his sheets across every project by due date, each with its state, its flags, and the one next action that makes sense right now.",
        act: async (r) => { await r.as("designer"); await r.go("#/", { wait: 800 }); await r.zoom(pageCard("Due soon · 23"), { pad: 8, max: 1.35, anchor: "top" }).catch(async () => { await r.zoom("main .stack .card >> nth=0", { pad: 8, max: 1.35, anchor: "top" }); }); },
      },
      {
        say: "Starting a planned sheet is a single click at the moment the work begins. If it is the first sheet of its stage, the stage becomes active automatically.",
        act: async (r) => { r.zoomOut(); await r.click("button[data-act=quick-transition][data-a=start] >> nth=0", { wait: 900 }); },
      },
      {
        say: "Further down, Returned to you lists sheets that came back from a check, with who returned them, when, and the checker's comment. On the right, hours this week compares time logged with capacity, and flags a missing timesheet.",
        act: async (r) => { await r.clearToasts(); await r.scrollIntoView('main section.card:has-text("Returned to you")', 0.45); await r.frame("cut"); await r.hl('main section.card:has-text("Returned to you")'); },
      },
      {
        say: "When a drawing is ready, Rahul opens the sheet and submits it for check. Here, M-206 already has a draft check print attached.",
        act: async (r) => { const id = await sheetId(r, "M-206"); await r.go(`#/projects/p1/sheets/${id}`, { wait: 2000 }); await r.hl("#sd-submit"); },
      },
      {
        say: "Submitting opens the discipline's pre-check list. Mandatory items must be ticked, and the submission is refused until they are.",
        act: async (r) => {
          r.hlOff();
          await r.click("#sd-submit", { wait: 600 });
          await r.zoom(".dialog", { pad: 30, max: 1.6 });
          await r.check("form[data-submit=pc-go] input[type=checkbox] >> nth=0", { wait: 200 });
          await r.click(".dialog-foot .btn.primary", { wait: 600 });
        },
      },
      {
        say: "With every item ticked, the sheet moves to ready for check, the ticks are stored with the review, and Karthik, the HVAC checker, is notified straight away.",
        act: async (r) => {
          await r.clearToasts();
          const n = await r.page.locator("form[data-submit=pc-go] input[type=checkbox]").count();
          for (let i = 0; i < n; i++) await r.check(`form[data-submit=pc-go] input[type=checkbox] >> nth=${i}`, { wait: 150, shot: i === n - 1 });
          await r.click(".dialog-foot .btn.primary", { wait: 900 });
          r.zoomOut();
        },
      },
      {
        say: "A sheet that comes back carries the checker's comment and any redline files on its page. M-204 was returned because the return-air path is not allowed through the corridor ceiling in the ICU zone. Starting the revision puts it back in progress.",
        act: async (r) => { await r.clearToasts(); const id = await sheetId(r, "M-204"); await r.go(`#/projects/p1/sheets/${id}`, { wait: 2000 }); await r.zoom(["main h2.display", "main section.card[aria-labelledby=rv-t]"], { pad: 14, max: 1.3 }); },
      },
    ],
  },

  {
    id: "review", num: "09", title: "Checking and senior QC",
    steps: [
      {
        say: "Chapter nine: checking, returning and approving.",
        act: async (r) => { await r.card(chapterCard("09", "Checking and senior QC", "A review queue oldest first, the drawing beside the check, redlines on return, a second step for senior QC, and delegation while away.", [{ icon: "list-checks", text: "Anil Kapoor · Discipline lead" }, { icon: "badge-check", text: "Sunita Rao · Senior reviewer" }])); },
      },
      {
        say: "Anil leads the architecture team. His My work shows what is waiting for his check, and how long the oldest has waited.",
        act: async (r) => { await r.as("checker"); await r.go("#/", { wait: 800 }); await r.zoom('main section.card:has-text("Waiting for your check")', { pad: 14, max: 1.6 }); },
      },
      {
        say: "The review queue lists every sheet waiting for him, oldest first, with the working days waited. Anything open for more than three working days is flagged as overdue, and the daily sweep escalates it. A senior QC tag shows that a sheet's stage needs a second check.",
        act: async (r) => { await r.go("#/reviews", { wait: 800 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Opening a review puts the drawing and the check side by side, with the designer, the submission time and the review round.",
        act: async (r) => { const id = await openReviewId(r, "A-401"); await r.go(`#/reviews?open=${id}`, { wait: 2200 }); },
      },
      {
        say: "Returning a sheet needs a comment or a redline file, so the designer always knows what to fix. Anil writes his comment and returns A-401 to Meghna, who is notified at once.",
        act: async (r) => {
          await r.scrollIntoView("#rq-c", 0.5); await r.frame("cut");
          await r.zoom("#rq-c", { pad: 120, max: 1.5 });
          await r.type("#rq-c", "Grid C dimension chain does not close; check the toilet core walls.", { chunk: 6 });
          await r.click("form[data-submit=rq-return] button.danger", { wait: 900 });
          r.zoomOut();
        },
      },
      {
        say: "For A-107, the check passes. Because stage four requires senior quality control, Anil's approval sends the sheet on to the senior reviewer as a second step. It stays in check until she approves.",
        act: async (r) => {
          await r.clearToasts();
          const id = await openReviewId(r, "A-107");
          await r.go(`#/reviews?open=${id}`, { wait: 2200 });
          await r.scrollIntoView("#rq-approve-btn", 0.6); await r.frame("cut");
          await r.click("#rq-approve-btn", { wait: 900 });
        },
      },
      {
        say: "Going on leave? A reviewer can delegate their queue to a colleague for a date range. Reviews route to the delegate automatically, and overdue escalations follow them.",
        act: async (r) => {
          await r.clearToasts();
          await r.go("#/reviews", { wait: 700 });
          await r.click("[data-act=rq-delegate]", { wait: 500 });
          await r.zoom(".dialog", { pad: 30, max: 1.6 });
        },
      },
      {
        say: "The discipline dashboard gives Anil one view of his team: late and at-risk sheets, the check queue, sheets approved but not yet issued, assignments per person, and capacity this week and next.",
        act: async (r) => { await r.key("Escape", { shot: false }); r.zoomOut(); await r.go("#/disciplines/A", { wait: 900 }); },
      },
      {
        say: "Sunita, the senior reviewer, now finds A-107 in her queue, tagged senior QC.",
        act: async (r) => { await r.as("senior"); await r.go("#/reviews", { wait: 800 }); await r.hl("main tbody tr:has-text('A-107')"); },
      },
      {
        say: "Her approval moves the sheet to approved for issue. The sheet's owner and the document controller are both notified that it is ready.",
        act: async (r) => {
          r.hlOff();
          const id = await openReviewId(r, "A-107", "senior_qc");
          await r.go(`#/reviews?open=${id}`, { wait: 2200 });
          await r.scrollIntoView("#rq-approve-btn", 0.6); await r.frame("cut");
          await r.click("#rq-approve-btn", { wait: 900 });
        },
      },
    ],
  },

  {
    id: "issue", num: "10", title: "Issue and transmittals",
    steps: [
      {
        say: "Chapter ten: issuing drawings with transmittals.",
        act: async (r) => { await r.card(chapterCard("10", "Issue and transmittals", "Approved sheets go out on a numbered transmittal with a cover sheet and secure links. Older revisions are superseded in the same step.", [{ icon: "send-horizontal", text: "Deepa Chandra · Document controller" }])); },
      },
      {
        say: "Deepa is the document controller. Her My work lists the approved sheets that are ready to issue, project by project.",
        act: async (r) => { await r.as("dc"); await r.go("#/", { wait: 800 }); await r.zoom('main section.card:has-text("Approved and ready to issue")', { pad: 14, max: 1.6 }); },
      },
      {
        say: "The issue composer has three steps: sheets, purpose and recipients, and a preview. The next transmittal number is reserved in sequence for the project, and numbers are never reused.",
        act: async (r) => { r.zoomOut(); await r.click('main a.btn[href="#/projects/p1/issue"]', { wait: 1000, trans: "fade" }); },
      },
      {
        say: "Each approved sheet shows its draft PDF and whether it is ready. A-104 is blocked because its file name breaks the naming rule, and E-102 has no PDF yet.",
        act: async (r) => { await r.zoom("main .card >> nth=0", { pad: 6, max: 1.35, anchor: "top" }); await r.pause(1); await r.hl("main tr:has-text('A-104')"); },
      },
      {
        say: "A-104 is fixed with one click, which renames the file to the valid name. Choosing all approved sheets then selects everything that is ready, and E-102 waits behind for its PDF.",
        act: async (r) => { r.hlOff(); r.zoomOut(); await r.click("[data-act=sd-rename]", { wait: 500 }); await r.click("[data-act=ic-all]", { wait: 600 }); },
      },
      {
        say: "The purpose of the issue is required. Here it is good for construction. Recipients receive a secure link by email, paper copies handed over in person can be recorded too, and a note can be added for everyone.",
        act: async (r) => {
          await r.scrollIntoView("select[data-change=ic-purpose]", 0.3);
          await r.select("select[data-change=ic-purpose]", "GFC", { wait: 500 });
          const note = r.page.locator("#ic-note");
          if (await note.count()) await r.type(note, "Working drawings for review on site, ground to fourth floor.", { chunk: 6 });
          await r.zoom('main section.card:has-text("Purpose and recipients")', { pad: 10, max: 1.4, anchor: "top" });
        },
      },
      {
        say: "The preview shows the numbered cover sheet exactly as recipients will receive it: the project, purpose, recipients, and every drawing with its revision.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=ic-preview]", { wait: 2200 }); await r.zoom('iframe[title="Cover sheet preview"]', { pad: 20, max: 1.6 }); },
      },
      {
        say: "Issuing asks for one final confirmation.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=ic-issue]", { wait: 600 }); await r.zoom(".dialog", { pad: 40, max: 1.6 }); },
      },
      {
        say: "One click issues the whole set on a single transmittal. In the same step, earlier revisions of those sheets are superseded, recipients get their secure link, and anyone who received an older revision is told a newer one exists.",
        act: async (r, d) => {
          r.zoomOut(); await r.click("#cf-ok", { wait: 1200, trans: "fade" });
          d.tr = await r.eval(() => { const t = DO.store.S.transmittals[DO.store.S.transmittals.length - 1]; return { id: t.id, number: t.number, token: t.token, r: t.recipients[0].contactId, n: t.items.length }; });
          await r.zoom("main .card >> nth=-1", { pad: 20, max: 1.6 });
        },
      },
      {
        say: "The transmittal log lists every issue with its purpose, sheets, recipients and acknowledgement status, including emails that bounced, so nothing is assumed to have arrived.",
        act: async (r) => { await r.clearToasts(); await r.go("#/projects/p1/transmittals", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Switching to the matrix view shows, for every sheet, which revision each recipient holds.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=tm-view][data-v=matrix]", { wait: 900 }); },
      },
      {
        say: "Each transmittal has its own page, with delivery, download and acknowledgement times for every recipient, and a resend button for a bounced email. Transmittals are never edited after sending: a correction is a new transmittal that references the original.",
        act: async (r) => {
          const id = await r.eval(() => DO.store.S.transmittals.filter((t) => t.projectId === "p1").find((t) => t.number.endsWith("0032"))?.id);
          await r.go(`#/projects/p1/transmittals/${id}`, { wait: 900 });
          await r.zoom('main section.card:has-text("Recipients")', { pad: 10, max: 1.5, anchor: "top" });
        },
      },
    ],
  },

  {
    id: "client", num: "11", title: "The client's side",
    steps: [
      {
        say: "Chapter eleven: what the client, consultant or contractor sees. No account, and no software to install.",
        act: async (r) => { await r.card(chapterCard("11", "The client's side", "A secure link, every drawing and its revision, download all as a zip, acknowledge receipt, and a phone view of the current set for site.", [{ icon: "users", text: "Clients, consultants, contractors · no sign-in" }])); },
      },
      {
        say: "Recipients get an ordinary email in their own inbox. In this demonstration, emails land in a demonstration mailbox instead of being sent.",
        act: async (r, d) => {
          await r.as("client", { lt: false });
          await r.go("#/mailbox", { wait: 900 });
          r.lowerThird("Dr. Vikram Nair", "Client · Navjeevan Health Trust");
          await r.click(`a.mail-item:has-text("${d.tr.number}"):has-text("Vikram") >> nth=0`, { wait: 700 }).catch(async () => { await r.click(`a.mail-item:has-text("${d.tr.number}") >> nth=0`, { wait: 700 }); });
          await r.zoom(".email-frame", { pad: 20, max: 1.5 });
        },
      },
      {
        say: "The link opens a secure page with no sign-in: the transmittal number, project, purpose, sender and expiry date, and every drawing with its revision.",
        act: async (r) => { r.zoomOut(); await r.click(".email-frame a.btn.primary", { wait: 1000, trans: "fade" }); },
      },
      {
        say: "Drawings download one at a time, or all together as a zip file that includes the cover sheet.",
        act: async (r) => { await r.click("[data-act=ext-zip]", { wait: 900 }); },
      },
      {
        say: "Acknowledging receipt records the date and time, and the sender sees it on the transmittal immediately.",
        act: async (r) => { await r.clearToasts(); await r.click("[data-act=ext-ack]", { wait: 900 }); await r.zoom("main .card >> nth=0", { pad: 20, max: 1.5 }); },
      },
      {
        say: "People who hold an older revision are emailed automatically when a newer one is issued, and told to stop using the old one.",
        act: async (r) => { r.zoomOut(); await r.clearToasts(); const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "new_revision")?.id); await r.go(`#/mailbox?m=${mid}`, { wait: 800 }); await r.zoom(".email-frame", { pad: 20, max: 1.5 }); },
      },
      {
        say: "On site, the project's site-view link shows only the current issued set, on a phone, with search and large touch targets. Superseded drawings never appear, so nobody builds from an old sheet.",
        act: async (r) => {
          r.zoomOut();
          const token = await r.eval(() => DO.store.project("p1").siteToken);
          await r.page.setViewportSize({ width: 390, height: 844 });
          await r.page.evaluate((t) => { location.hash = `#/site/${t}`; }, token);
          await r.wait(1200);
          await r.prep();
          const buf = await r.page.screenshot({ type: "png" });
          await r.page.setViewportSize({ width: 1440, height: 810 });
          await r.page.evaluate(() => { location.hash = "#/mailbox"; }); await r.wait(500);
          await r.card({ type: "device", eyebrow: "Site view · phone", title: "The current set, in the pocket of everyone on site", img: `data:image/png;base64,${buf.toString("base64")}`, items: [{ icon: "shield-check", text: "Only current issued revisions, never superseded ones" }, { icon: "search", text: "Search by sheet number or title" }, { icon: "smartphone", text: "Phone first, large touch targets, no sign-in" }, { icon: "link", text: "One link per project, shared by the project lead" }] });
        },
      },
      {
        say: "Back in DrawingOps, the client's acknowledgement already shows on the transmittal.",
        act: async (r, d) => { await r.as("dc"); await r.go(`#/projects/p1/transmittals/${d.tr.id}`, { wait: 900 }); await r.zoom('main section.card:has-text("Recipients")', { pad: 10, max: 1.5, anchor: "top" }); },
      },
    ],
  },
];
