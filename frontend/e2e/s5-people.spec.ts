/** S5 demo (docs/05): a DL allocates two people across three projects; one shows 132% next
 * week; a designer submits a week; a missing timesheet triggers a reminder. */
import { expect, test } from "@playwright/test";

import { apiCall, as, CHECKER, DC, DESIGNER, freshProject, STATE } from "./support";

interface Person {
  id: string;
  email: string;
  short_name: string;
}
interface Cell {
  week: string;
  capacity_h: string;
  planned_h: string;
  pct: number | null;
}

const monday = (offsetWeeks: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7 * offsetWeeks);
  return d.toISOString().slice(0, 10);
};

test("allocate across three projects, 132% shows, a week is submitted, missing hours remind", async ({ browser }) => {
  test.setTimeout(180_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const projects = [await freshProject(lead), await freshProject(lead), await freshProject(lead)];
  const people = await apiCall<Person[]>(lead, "GET", "/api/v1/directory");
  const designer = people.find((p) => p.email === DESIGNER)!;
  const dcPerson = people.find((p) => p.email === DC)!;
  const nextWeek = monday(1);

  const dl = await as(browser, STATE.checker); // the DL on each fresh project
  await dl.goto("/");
  expect((await apiCall<Person[]>(dl, "GET", "/api/v1/directory")).some((p) => p.email === CHECKER)).toBe(true);

  // Earlier runs leave allocations on the shared stack: clear the designer's next week first.
  for (const a of await apiCall<{ project: string; stage: string; user: string }[]>(dl, "GET", `/api/v1/allocations?user=${designer.id}&week=${nextWeek}`)) {
    await apiCall(dl, "PUT", "/api/v1/allocations", { ...a, weeks: [nextWeek], hours: "0" }).catch(() => undefined);
  }
  const workload = await apiCall<{ people: { user: Person; cells: Cell[] }[] }>(dl, "GET", `/api/v1/workload?from=${nextWeek}&to=${nextWeek}`);
  const capacity = Number(workload.people.find((p) => p.user.id === designer.id)!.cells[0]!.capacity_h);
  const target = Number((capacity * 1.32).toFixed(1));
  const first = Number((target / 3).toFixed(1));
  const hours = [first, first, Number((target - 2 * first).toFixed(1))];

  await test.step("DL allocates the designer on the first project from the Allocate drawer", async () => {
    await dl.goto("/workload");
    await dl.getByRole("button", { name: "Allocate" }).click();
    const drawer = dl.getByRole("dialog", { name: "Allocate hours" });
    await drawer.getByLabel("Project").selectOption({ label: projects[0]!.project.code });
    await drawer.getByLabel("Person").selectOption({ label: "Rahul Kumar" });
    await drawer.getByLabel("Stage").selectOption({ index: 1 });
    await drawer.getByLabel("From week of").fill(nextWeek);
    await drawer.getByLabel("Weeks", { exact: true }).fill("1");
    await drawer.getByLabel("Hours a week").fill(String(hours[0]));
    await drawer.getByRole("button", { name: "Allocate" }).click();
    await expect(dl.getByText(/a week allocated for weeks/).first()).toBeVisible();
  });

  await test.step("the other two projects, and the DC on all three", async () => {
    for (const [i, { project, stages }] of projects.entries()) {
      if (i > 0) await apiCall(dl, "PUT", "/api/v1/allocations", { user: designer.id, project: project.id, stage: stages[0]!.id, weeks: [nextWeek], hours: String(hours[i]) });
      await apiCall(dl, "PUT", "/api/v1/allocations", { user: dcPerson.id, project: project.id, stage: stages[0]!.id, weeks: [nextWeek], hours: "10" });
    }
  });

  await test.step("the heat map shows 132% over-allocated next week; the drawer lists three projects", async () => {
    await dl.reload();
    const cell = dl.getByRole("button", { name: new RegExp(`^${designer.short_name}, week \\d+: 132% of .*over-allocated`) });
    await expect(cell).toBeVisible();
    await expect(cell).toHaveText(/132%/);
    await cell.click();
    const drawer = dl.getByRole("dialog");
    for (const { project } of projects) await expect(drawer.getByText(project.code, { exact: true })).toBeVisible();
    await expect(drawer.getByLabel("Copy to next weeks")).toBeVisible();
  });

  const designerPage = await as(browser, STATE.designer);
  await designerPage.goto("/");
  await test.step("the designer logs and submits a week", async () => {
    // A week no earlier run has submitted (the stack is shared between runs).
    let week = monday(-2);
    for (let i = 2; i < 200; i++) {
      week = monday(-i);
      const mine = await apiCall<{ timesheet: { state: string } }>(designerPage, "GET", `/api/v1/timesheets/me?week=${week}`);
      if (mine.timesheet.state === "draft") break;
    }
    await designerPage.goto(`/timesheets?week=${week}`);
    const code = projects[0]!.project.code;
    await designerPage.getByLabel("Add a row").selectOption({ label: `${code} · ${projects[0]!.stages[0]!.name}` });
    await designerPage.getByRole("textbox", { name: new RegExp(`^${code} · .*, Mon `) }).first().fill("8");
    await designerPage.getByRole("textbox", { name: new RegExp(`^${code} · .*, Tue `) }).first().fill("7.5");
    await expect(designerPage.getByRole("row", { name: /Day total/ })).toContainText("15.5");
    await designerPage.getByRole("button", { name: "Submit week" }).click();
    await designerPage.getByRole("dialog").getByRole("button", { name: "Submit week" }).click();
    await expect(designerPage.getByText(/submitted/).first()).toBeVisible();
    await expect(designerPage.getByText("waiting for approval")).toBeVisible();
    await expect(designerPage.getByRole("button", { name: "Submit week" })).toHaveCount(0);
  });

  await test.step("the DL sees it waiting and approves it", async () => {
    await dl.goto("/timesheets/approvals");
    const row = dl.getByRole("row", { name: /Rahul Kumar/ }).first();
    await expect(row).toContainText("15.5");
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(dl.getByText(/week \d+ approved/).first()).toBeVisible();
  });

  await test.step("A-06 reminds the DC, who has not submitted last week", async () => {
    const admin = await as(browser, STATE.admin);
    await admin.goto("/");
    const rules = await apiCall<{ id: string; key: string }[]>(admin, "GET", "/api/v1/automation-rules");
    await apiCall(admin, "POST", `/api/v1/automation-rules/${rules.find((r) => r.key === "A-06")!.id}/run`);
    const dc = await as(browser, STATE.dc);
    await dc.goto("/");
    // Earlier runs may already have raised this week's reminder (sweeps are idempotent), so
    // look through the DC's notifications rather than only the newest in the panel.
    const list = await apiCall<{ results: { title: string; event: string }[] }>(dc, "GET", "/api/v1/notifications?page_size=200");
    expect(list.results.some((n) => n.event === "timesheet_missing" && /Your timesheet for the week of \d{2}-[A-Z][a-z]{2}-\d{4} is missing/.test(n.title))).toBe(true);
  });
});
