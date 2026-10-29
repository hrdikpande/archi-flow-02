/* Chapters 12 and 13: client comments, decisions and approvals; billing signals. */
const path = require("path");
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });

module.exports = [
  {
    id: "comments", num: "12", title: "Client comments, decisions and approvals",
    steps: [
      {
        say: "Chapter twelve: client comments, decisions, and client approval of a stage.",
        act: async (r) => { await r.card(chapterCard("12", "Client comments, decisions and approvals", "Every comment logged, assigned and answered; decisions kept with their reasons; stage approvals recorded with evidence.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }])); },
      },
      {
        say: "Client comments arrive by email, letter, phone call, WhatsApp or in meetings. Each one is logged with a number, linked to the sheets it affects, assigned to a person, and tracked until it has a written response.",
        act: async (r) => { await r.as("lead"); await r.go("#/projects/p1/comments", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "A comment with no response after five days is flagged as overdue, and the daily sweep reminds the person it is assigned to, and the project lead.",
        act: async (r) => { r.zoomOut(); await r.check("input[data-change=cm-overdue]", { wait: 700 }); },
      },
      {
        say: "Logging a new comment takes seconds: what the client asked for, where it came from, the sheets it concerns, and who should answer it. The person is notified straight away.",
        act: async (r) => {
          await r.go("#/projects/p1/comments", { wait: 700 });
          await r.click("[data-act=cm-new]", { wait: 600 });
          await r.type("#cn-t", "Please add a visitor toilet near the OPD waiting area.", { chunk: 5 });
          await r.select("#cn-a", "u_meg", { wait: 300 });
          await r.click(".dialog-foot .btn.primary", { wait: 900 });
        },
      },
      {
        say: "A comment can only be closed with a written response. The answer becomes part of the project record, and is searchable later.",
        act: async (r) => {
          await r.clearToasts();
          await r.click("tr[data-act=cm-open] >> nth=0", { wait: 700 });
          await r.type("#cm-r", "Visitor toilet added at grid B/2 on A-101; revised plan to follow.", { chunk: 6 });
          await r.click("[data-act=cm-op][data-op=close]", { wait: 900 });
        },
      },
      {
        say: "Each project also has its own email address. Forwarding a client's email to it logs the comment automatically, matched to the sender. In this demonstration the forwarding is simulated.",
        act: async (r) => { await r.clearToasts(); await r.go("#/projects/p1/comments", { wait: 700 }); await r.click("[data-act=cm-sim]", { wait: 1000 }); },
      },
      {
        say: "Emails from senders the system does not recognise wait in a review queue, so nothing is logged against a project until a person accepts it.",
        act: async (r) => { await r.clearToasts(); await r.click("[data-act=cm-queue]", { wait: 600 }); await r.zoom(".dialog, .drawer", { pad: 20, max: 1.5 }); await r.click("[data-act=iq-accept] >> nth=0", { wait: 800 }); r.zoomOut(); },
      },
      {
        say: "Decisions agreed with the client are recorded too, with their context and the sheets they affect. They are searchable across projects, so the reasoning behind a design choice is never lost.",
        act: async (r) => {
          await r.clearToasts(); await r.go("#/projects/p1/decisions", { wait: 800 });
          await r.click("[data-act=dc-new]", { wait: 600 });
          await r.type("#dn-t", "Visitor toilet added at grid B/2", { chunk: 5 });
          await r.type("#dn-c", "Agreed with Navjeevan at the design review; OPD waiting area.", { chunk: 6 });
          await r.click(".drawer-foot .btn.primary, .dialog-foot .btn.primary", { wait: 800 });
        },
      },
      {
        say: "On the Mysuru heritage hotel, every deliverable of stage five, tender, has been issued. The project lead now records the client's approval, attaching the approval letter as evidence.",
        act: async (r, d) => {
          await r.clearToasts(); await r.go("#/projects/p5/stages", { wait: 900 });
          await r.click("[data-act=sp-approve]", { wait: 600 });
          await r.files("#ap-e", path.join(d.DOCS, "sample-client-approval-letter.pdf"), { wait: 500, pointAt: "#ap-e" });
          await r.zoom(".dialog", { pad: 24, max: 1.5 });
        },
      },
      {
        say: "With every deliverable issued and the client's approval on record, the stage becomes ready to invoice automatically, and Accounts, the owner and the project lead are notified.",
        act: async (r) => { r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 900 }); await r.zoom(".toast", { pad: 80, max: 1.5 }); },
      },
    ],
  },

  {
    id: "billing", num: "13", title: "Billing signals",
    steps: [
      {
        say: "Chapter thirteen: billing signals, for Accounts.",
        act: async (r) => { await r.card(chapterCard("13", "Billing signals", "Stages ready to invoice, with the amount and the evidence; export or push to accounting; record the invoice reference.", [{ icon: "settings", text: "Asha Menon · System admin" }, { icon: "receipt-indian-rupee", text: "Meera Thomas · Accounts" }])); },
      },
      {
        say: "First, the administrator connects the firm's accounting system: choose the columns to send, give a webhook address, and switch it on. The address is checked, so it can never point inside the firm's own network. In this demonstration the connection is simulated.",
        act: async (r) => {
          await r.as("admin"); await r.go("#/admin/integrations", { wait: 800 });
          await r.scrollIntoView("input[data-change=ig-wh-on]", 0.5); await r.frame("cut");
          await r.check("input[data-change=ig-wh-on]", { wait: 500 });
          await r.zoom("input[data-change=ig-wh-on] >> xpath=ancestor::section[1]", { pad: 10, max: 1.5 });
        },
      },
      {
        say: "Meera, in Accounts, sees the stages that are ready to invoice on her home page.",
        act: async (r) => { await r.as("accounts"); await r.go("#/", { wait: 800 }); await r.zoom('main section.card:has-text("Ready to invoice")', { pad: 14, max: 1.5 }); },
      },
      {
        say: "Billing signals lists every stage ready to invoice, with the project, the stage, its share of the fee and the amount, how long it has been waiting, and the client approval behind it. The Mysuru stage approved a moment ago is already here.",
        act: async (r) => { await r.go("#/billing", { wait: 900 }); await r.zoom("main table", { pad: 10, max: 1.4, anchor: "top" }); },
      },
      {
        say: "The list exports as a CSV file in the columns the accounting tool expects, or pushed straight to the accounting system as a signed message. In this demonstration the push is simulated, and the message is shown instead of sent.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=bl-csv]", { wait: 700 }); await r.clearToasts(); await r.click("[data-act=bl-push]", { wait: 900 }); await r.zoom(".dialog", { pad: 20, max: 1.5 }); },
      },
      {
        say: "Once the invoice is raised in the accounting tool, Accounts marks the stage invoiced with its reference and date, and the stage's fee percentage locks.",
        act: async (r) => { r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 500, shot: false }); await r.clearToasts(); await r.frame("cut"); await r.click("[data-act=bl-mark] >> nth=0", { wait: 600 }); await r.zoom(".dialog", { pad: 24, max: 1.6 }); await r.pause(1.2); r.zoomOut(); await r.click(".dialog-foot .btn.primary", { wait: 900 }); },
      },
      {
        say: "Invoiced stages stay on record with their reference. Invoicing, tax and ledgers deliberately remain in the firm's accounting software: DrawingOps supplies the signal, not the invoice.",
        act: async (r) => { await r.clearToasts(); await r.go("#/billing/invoiced", { wait: 800 }); },
      },
      {
        say: "Accounts sees projects in a deliberately narrow way: stages and fees only, never drawings, reviews or individual people's hours.",
        act: async (r) => { await r.go("#/projects/p1", { wait: 900 }); await r.hl("main nav.tabs"); },
      },
    ],
  },
];
