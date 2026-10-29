/* Chapters 20 and 21: administration; platform, trust and close. */
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });

module.exports = [
  {
    id: "admin", num: "20", title: "Administration",
    steps: [
      {
        say: "Chapter twenty: administration.",
        act: async (r) => { await r.card(chapterCard("20", "Administration", "Firm settings, rules with live testers, users and invitations, integrations, onboarding and the audit trail.", [{ icon: "settings", text: "Asha Menon · System admin" }])); },
      },
      {
        say: "Administration starts with the organisation: the firm's name and address, time zone, project code format, default weekly capacity, digest time, how long transmittal links stay valid, and when an unacknowledged transmittal is flagged. Dates, times and rupee amounts follow Indian formats throughout.",
        act: async (r) => { await r.as("admin"); await r.go("#/admin/organisation", { wait: 800 }); await r.zoom("main .card >> nth=0", { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "Disciplines each carry their own sheet-number rule, with a live test beside it.",
        act: async (r) => { r.zoomOut(); await r.go("#/admin/disciplines", { wait: 700 }); },
      },
      {
        say: "Stage templates mirror the firm's standard appointment letters, with their fee percentages, and one is the default.",
        act: async (r) => { await r.go("#/admin/stage-templates", { wait: 700 }); },
      },
      {
        say: "Revision codes follow the firm's scheme, P for preliminary and C for construction. A purpose is required on every issue, and ISO 19650 suitability codes are available for firms that use them.",
        act: async (r) => { await r.go("#/admin/codes", { wait: 700 }); },
      },
      {
        say: "Naming rules come with a live tester. Paste a file name, and see immediately whether it passes, and if not, exactly why, with a valid example.",
        act: async (r) => {
          await r.go("#/admin/naming-rules", { wait: 700 });
          await r.type("#nr-test", "A101 ground floor rev.pdf", { chunk: 3, after: 400 });
          await r.zoom("#nr-test >> xpath=ancestor::section[1]", { pad: 10, max: 1.5 });
          await r.pause(1.2);
          await r.type("#nr-test", "A-101_C02.pdf", { chunk: 3, after: 400 });
        },
      },
      {
        say: "Pre-check checklists are defined for each discipline and stage, with their mandatory items, and the working calendar sets the working week and holidays that every deadline, escalation and working-day count relies on.",
        act: async (r) => { r.zoomOut(); await r.go("#/admin/checklists", { wait: 700 }); await r.go("#/admin/calendar", { wait: 700 }); },
      },
      {
        say: "Users and roles shows each person's organisation role, how they sign in, and when they were last seen. People can be deactivated, but never deleted, so their history stays intact. New people are invited by email.",
        act: async (r) => {
          await r.go("#/admin/users", { wait: 800 });
          await r.click("[data-act=us-invite]", { wait: 600 });
          await r.type("#iv-nn", "Kiran Bhat", { chunk: 3 });
          await r.type("#iv-em", "kiran.bhat@firm.example", { chunk: 4 });
          await r.zoom(".dialog", { pad: 20, max: 1.5 });
          r.zoomOut();
          await r.click(".dialog-foot .btn.primary", { wait: 900 });
        },
      },
      {
        say: "The invitation arrives by email. The new person chooses a password, or signs in with the firm's Microsoft account, and sees projects once a project lead adds them to a team.",
        act: async (r) => {
          await r.clearToasts();
          const tok = await r.eval(() => DO.store.S.invitations.find((i) => i.email === "kiran.bhat@firm.example")?.token);
          const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "invite" && (m.to || []).includes("kiran.bhat@firm.example"))?.id);
          await r.go(`#/mailbox?m=${mid}`, { wait: 800 });
          await r.zoom(".email-frame", { pad: 20, max: 1.5 });
          r.zoomOut();
          await r.go(`#/invite/${tok}`, { wait: 800 });
        },
      },
      {
        say: "Integrations lists every connection with its status: single sign-on, local accounts with two-factor, outbound and inbound email, the Revit and AutoCAD plugins, the file-storage connector, clash import, and accounting. Scoped API tokens are created here and shown only once. Options that depend on the firm's tools, such as Autodesk Forma and Bluebeam, are marked as conditional.",
        act: async (r) => { await r.signInSilently("admin"); r.role = "admin"; await r.go("#/admin/integrations", { wait: 800 }); await r.pause(6); await r.scrollBy(380); },
      },
      {
        say: "Onboarding loads a live project from a template workbook and a folder of issued PDFs, including historic revisions, without sending a single notification. Problems in the workbook are listed before anything is loaded.",
        act: async (r) => {
          await r.go("#/admin/onboarding", { wait: 800 });
          await r.click("[data-act=ob-sample]", { wait: 1200 });
          const load = r.page.locator("[data-act=ob-load]:not([disabled])");
          if (await load.count()) await r.click("[data-act=ob-load]", { wait: 1200 });
        },
      },
      {
        say: "Finally, the audit trail records every change: who made it, when, what it was before and after, from which address, with a request ID. Rows can never be edited or deleted, and the full trail exports as a background job that emails a link when it is ready.",
        act: async (r) => {
          await r.clearToasts(); await r.go("#/admin/audit", { wait: 900 });
          await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" });
          await r.pause(1.5); r.zoomOut();
          await r.click("[data-act=au-export]", { wait: 900 });
        },
      },
    ],
  },

  {
    id: "platform", num: "21", title: "Built for everyday use and for trust",
    steps: [
      {
        say: "Chapter twenty-one: the qualities that run through the whole product.",
        act: async (r) => { await r.clearToasts(); await r.card(chapterCard("21", "Built for everyday use, and for trust", "Accessible, fast, works on any screen, and designed so the record can be relied on.")); },
      },
      {
        say: "Every screen also works in a dark theme, chosen from the account menu, and in a compact or comfortable row height.",
        act: async (r) => {
          await r.as("owner", { lt: false });
          await r.go("#/portfolio", { wait: 800 });
          await r.click("[data-act=user-menu]", { wait: 400 });
          await r.zoom(".menu", { pad: 80, max: 1.5 });
          r.zoomOut();
          await r.click('.menu .mi:has-text("Dark")', { wait: 900, trans: "fade" });
        },
      },
      {
        say: "Status is always shown with colour, an icon and a word, never colour alone. Every chart has a table view, and keyboard shortcuts cover the most frequent actions.",
        act: async (r) => {
          await r.page.keyboard.press("?"); await r.wait(500); await r.frame("cut");
          await r.zoom(".dialog", { pad: 20, max: 1.5 });
        },
      },
      {
        say: "Underneath, DrawingOps is designed so that the record can be trusted. Permissions are enforced on the server for every request, for each person's organisation role and project role. Issued files are never altered or overwritten. The audit trail is insert-only. Automations are safe to run twice. And a project's full record can be exported at any time.",
        act: async (r) => {
          await r.key("Escape", { shot: false }); r.zoomOut();
          await r.eval(() => DO.app.applyTheme("light"));
          await r.card({ type: "statement", eyebrow: "Designed for trust", title: "A record the whole firm can rely on", items: [
            { icon: "shield-check", text: "Permissions enforced on the server for every request, by organisation role and project role" },
            { icon: "lock", text: "Issued PDFs are immutable; corrections are new revisions and new transmittals" },
            { icon: "list-checks", text: "Insert-only audit trail with before and after values, address and request ID" },
            { icon: "refresh-cw", text: "Idempotent automations: running a sweep twice never sends anything twice" },
            { icon: "download", text: "Full project export at any time: structured data plus every issued PDF" },
            { icon: "smartphone", text: "Accessible (WCAG 2.2 AA target), keyboard friendly, desktop, tablet and phone" },
          ], note: "These describe the product's design. This walkthrough was recorded in the browser prototype, where these rules are simulated in the browser." });
        },
      },
      {
        say: "DrawingOps gives an architecture and MEP firm one live record of every sheet, from the day it is planned to the day it is invoiced: who owns it, where it stands, what is late, who is overloaded, and what the client holds. It works alongside the CAD tools the firm already uses, and it keeps the site on the current set.",
        act: async (r) => { await r.card({ type: "statement", eyebrow: "In summary", title: "Every sheet. Every revision. Every deadline. One live register.", items: [
          { icon: "layout-dashboard", text: "Owners see the whole practice without a phone call" },
          { icon: "list-checks", text: "Leads plan, check and approve in one place" },
          { icon: "pen-tool", text: "Designers see their next action, and nothing else" },
          { icon: "send-horizontal", text: "Issue with numbered transmittals; superseding is automatic" },
          { icon: "receipt-indian-rupee", text: "Stages signal when they are ready to invoice" },
          { icon: "hard-hat", text: "Site works from the current set, on any phone" },
        ] }); },
      },
      {
        say: "DrawingOps is built by LatentIQ. To see it working with your own projects and sheet lists, talk to the LatentIQ team. Thank you for watching.",
        act: async (r) => { await r.card({ type: "title", eyebrow: "Thank you", tagline: "To see DrawingOps working with your own projects and sheet lists, talk to the LatentIQ team.", pills: [{ icon: "building-complex", text: "Architecture and MEP firms" }, { icon: "layers", text: "On top of AutoCAD and Revit" }, { icon: "shield-check", text: "Your data, always exportable" }], by: "Built by LatentIQ" }); },
      },
    ],
  },
];
