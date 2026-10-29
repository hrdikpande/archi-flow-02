/* Chapters 14 and 15: workload and timesheets; notifications, alerts and automation. */
const chapterCard = (num, title, lead, roles) => ({ type: "chapter", num, title, lead, roles });

module.exports = [
  {
    id: "people", num: "14", title: "Workload and timesheets",
    steps: [
      {
        say: "Chapter fourteen: workload and timesheets.",
        act: async (r) => { await r.card(chapterCard("14", "Workload and timesheets", "Planned hours against capacity for every person and week, weekly timesheets by project and stage, and approvals.", [{ icon: "folder-kanban", text: "Priya Sharma · Project lead" }, { icon: "pen-tool", text: "Rahul Kumar · Designer" }, { icon: "list-checks", text: "Anil Kapoor · Discipline lead" }])); },
      },
      {
        say: "Workload is a heat map of planned hours against capacity, person by person, for the next eight weeks. Above one hundred and ten percent is flagged as over-allocated, and below fifty percent as under-allocated, always with an icon and a word as well as colour.",
        act: async (r) => { await r.as("lead"); await r.go("#/workload", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "Filters narrow the map to a discipline, a project, or only the people who are over or under. Here is the HVAC team.",
        act: async (r) => { r.zoomOut(); await r.select("select[data-change=wl-f][data-k=disc]", "M", { wait: 800 }); },
      },
      {
        say: "Clicking a cell shows where that person's hours go, project by project and stage by stage. Hours can be edited in place, or copied forward to the next three weeks.",
        act: async (r) => {
          await r.click("button[data-act=wl-cell] >> nth=0", { wait: 700 });
          await r.zoom(".drawer, .dialog", { pad: 10, max: 1.4, anchor: "top" });
          const copy = r.page.locator("[data-act=al-copy]").first();
          if (await copy.count()) { r.zoomOut(); await r.click(copy, { wait: 700 }); }
        },
      },
      {
        say: "New allocations are added for a person, a project stage and a number of weeks, and the heat map updates at once.",
        act: async (r) => {
          r.zoomOut(); await r.go("#/workload?disc=M", { wait: 700, shot: false }); await r.clearToasts(); await r.frame("cut");
          await r.click("[data-act=wl-allocate]", { wait: 600 });
          await r.zoom(".dialog, .drawer", { pad: 20, max: 1.5 });
          await r.type("#al-h", "10", { chunk: 2 });
          await r.type("#al-n", "2", { chunk: 1 });
          r.zoomOut();
          await r.click(".dialog-foot .btn.primary, .drawer-foot .btn.primary", { wait: 900 });
        },
      },
      {
        say: "The staff directory holds each person's discipline, weekly capacity and leave. Leave and the firm's holidays reduce capacity automatically, so the heat map stays honest.",
        act: async (r) => { await r.clearToasts(); await r.go("#/workload/staff", { wait: 800 }); },
      },
      {
        say: "Timesheets are weekly, by project and stage, and start from the person's own allocations. Rahul enters his hours for the week. People who track time elsewhere can import a CSV file instead.",
        act: async (r) => {
          await r.as("designer"); await r.go("#/timesheets", { wait: 900 });
          for (const [i, v] of [[1, "6"], [2, "2"], [8, "5.5"], [9, "3"]]) {
            const sel = `input[data-change=ts-h] >> nth=${i}`;
            if (!(await r.page.locator(sel).count())) continue;
            await r.type(sel, v, { chunk: 2 });
            await r.page.keyboard.press("Tab"); await r.wait(300);
          }
          await r.frame("cut");
          await r.hl("[data-act=ts-csv]");
        },
      },
      {
        say: "Submitting the week locks it and sends it for approval. A timesheet missing by Tuesday noon raises a reminder.",
        act: async (r) => { r.hlOff(); await r.click("[data-act=ts-submit]", { wait: 700 }); await r.zoom(".dialog", { pad: 30, max: 1.6 }); await r.pause(1.2); r.zoomOut(); await r.click("#cf-ok", { wait: 900 }); },
      },
      {
        say: "Discipline leads and project leads approve submitted timesheets, or return them with a reason, and can remind anyone whose week is still missing. Individual hours are only ever visible to the person, their discipline lead, the project lead and the owner.",
        act: async (r) => { await r.clearToasts(); await r.as("checker"); await r.go("#/timesheets/approvals", { wait: 900 }); await r.click("[data-act=ap-ok] >> nth=0", { wait: 800 }); },
      },
    ],
  },

  {
    id: "alerts", num: "15", title: "Notifications, alerts and automation",
    steps: [
      {
        say: "Chapter fifteen: notifications, alerts, and the automations behind them.",
        act: async (r) => { await r.card(chapterCard("15", "Notifications, alerts and automation", "One notification centre per person, preferences with mandatory alerts locked on, and ten automation rules that run themselves.", [{ icon: "pen-tool", text: "Rahul Kumar · Designer" }, { icon: "settings", text: "Asha Menon · System admin" }])); },
      },
      {
        say: "Everyone has one notification centre. Rahul's shows his assignments, review results and deadline alerts, each linking straight to the sheet.",
        act: async (r) => { await r.clearToasts(); await r.as("designer"); await r.go("#/", { wait: 700 }); await r.click("[data-act=notifications]", { wait: 600 }); await r.zoom("#notif-panel", { pad: 10, max: 1.5, anchor: "top" }); },
      },
      {
        say: "Preferences decide how each kind of alert arrives: instantly, in a daily digest, or not at all. Alerts that must not be missed, such as a sheet returned with redlines, are locked on. Quiet hours hold notifications overnight.",
        act: async (r) => { await r.go("#/settings/notifications", { wait: 800 }); await r.zoom("main .card >> nth=0", { pad: 8, max: 1.35, anchor: "top" }); },
      },
      {
        say: "Everything set to digest arrives together in one email each morning.",
        act: async (r) => {
          r.zoomOut();
          await r.click("[data-act=pf-digest]", { wait: 900 });
          const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "digest")?.id);
          if (mid) { await r.go(`#/mailbox?m=${mid}`, { wait: 800 }); await r.zoom(".email-frame", { pad: 20, max: 1.5 }); }
        },
      },
      {
        say: "Behind the alerts are ten automation rules, all visible to the administrator in one place: at-risk and late flags, superseding on issue, naming checks, allocation and timesheet checks, overdue reviews and client comments, the ready-to-invoice signal, and RFI due dates. Each has its schedule and its threshold.",
        act: async (r) => { r.zoomOut(); await r.as("admin"); await r.go("#/admin/automation", { wait: 900 }); await r.zoom("main table", { pad: 8, max: 1.3, anchor: "top" }); },
      },
      {
        say: "The daily sweep runs at eight every morning. Running it now sends the reminders and escalations that are due today.",
        act: async (r) => { r.zoomOut(); await r.click("[data-act=au-run]", { wait: 1200 }); await r.zoom(".toast", { pad: 80, max: 1.5 }); },
      },
      {
        say: "Running it a second time sends nothing twice. Every alert goes out once per day, and the duplicates are counted and skipped. People can trust their inbox.",
        act: async (r) => { r.zoomOut(); await r.clearToasts(); await r.click("[data-act=au-run]", { wait: 1200 }); await r.zoom(".toast", { pad: 80, max: 1.5 }); },
      },
      {
        say: "The run log records every sweep with its counts and duration, and a warning appears if the morning sweep ever fails to run.",
        act: async (r) => { r.zoomOut(); await r.clearToasts(); await r.scrollIntoView('main section.card:has-text("Run log")', 0.2); await r.frame("cut"); await r.hl('main section.card:has-text("Run log")'); },
      },
      {
        say: "And every Monday morning the owner receives a weekly summary by email: late and at-risk sheets, overloaded people, and money waiting to be invoiced.",
        act: async (r) => { r.hlOff(); const mid = await r.eval(() => DO.store.S.emails.find((m) => m.kind === "summary")?.id); await r.go(`#/mailbox?m=${mid}`, { wait: 800 }); await r.zoom(".email-frame", { pad: 20, max: 1.5 }); },
      },
    ],
  },
];
