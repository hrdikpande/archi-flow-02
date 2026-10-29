/** S4 demo (docs/05): issue sheets to recipients as GFC; earlier recipients get "new revision"
 * emails; downloading the old revision gives the watermarked copy; the public page needs no login. */
import { expect, test } from "@playwright/test";

import { apiCall, approveSheet, as, freshProject, MAILPIT, STATE } from "./support";

interface Msg {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

async function mailTo(request: import("@playwright/test").APIRequestContext, address: string, subject: RegExp): Promise<Msg> {
  let found: Msg | undefined;
  await expect
    .poll(async () => {
      const list = (await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)).json()) as { messages: Msg[] };
      found = list.messages.find((m) => subject.test(m.Subject));
      return !!found;
    }, { timeout: 30_000 })
    .toBe(true);
  return found!;
}

async function linkIn(request: import("@playwright/test").APIRequestContext, id: string): Promise<string> {
  const body = (await (await request.get(`${MAILPIT}/api/v1/message/${id}`)).json()) as { Text: string };
  return /https?:\/\/\S+\/t\/[\w-]+/.exec(body.Text)![0].replace(/^https?:\/\/[^/]+/, "");
}

test("issue as GFC, re-issue tells earlier recipients, old revision is watermarked", async ({ browser, request }) => {
  test.setTimeout(180_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets } = await freshProject(lead, { sheets: ["A-101", "A-102"] });
  const designer = await as(browser, STATE.designer);
  const checker = await as(browser, STATE.checker);
  await designer.goto("/");
  await checker.goto("/");
  for (const s of sheets) await approveSheet(designer, checker, s.id, s.number);
  const stamp = Date.now().toString(36);
  const first = await apiCall<{ id: string; email: string }>(lead, "POST", "/api/v1/contacts", { full_name: `Client PM ${stamp}`, email: `pm.${stamp}@client.example` });
  const second = await apiCall<{ id: string; email: string }>(lead, "POST", "/api/v1/contacts", { full_name: `Contractor ${stamp}`, email: `site.${stamp}@contractor.example` });

  const dc = await as(browser, STATE.dc);
  await test.step("DC issues both sheets for GFC from the composer", async () => {
    await dc.goto(`/projects/${project.id}/issue?sheets=${sheets.map((s) => s.id).join(",")}`);
    await dc.getByLabel("Purpose").selectOption({ label: "Good for Construction (GFC)" });
    await dc.getByLabel("Find a contact to add").fill(`Client PM ${stamp}`);
    await dc.getByRole("button", { name: new RegExp(`Client PM ${stamp}`) }).click();
    await expect(dc.getByRole("status").filter({ hasText: "Issue 2 sheets to 1 recipient for Good for Construction (GFC)." })).toBeVisible();
    await dc.getByRole("button", { name: "Issue 2 sheets" }).click();
    await dc.getByRole("dialog").getByRole("button", { name: "Issue 2 sheets" }).click();
    await expect(dc.getByText(new RegExp(`${project.code}-TR-0001`))).toBeVisible();
  });

  const message = await mailTo(request, first.email, new RegExp(`${project.code}-TR-0001`));
  const firstLink = await linkIn(request, message.ID);

  await test.step("recipient opens the link without signing in and downloads", async () => {
    const outsider = await (await browser.newContext()).newPage();
    await outsider.goto(firstLink + "/");
    await expect(outsider.getByRole("heading", { name: new RegExp(`${project.code}-TR-0001`) })).toBeVisible();
    await expect(outsider.getByRole("cell", { name: "A-101", exact: true })).toBeVisible();
    const response = await outsider.request.get(`${firstLink}/zip`);
    expect(response.headers()["content-type"]).toBe("application/zip");
    expect((await response.body()).subarray(0, 2).toString()).toBe("PK");
  });

  await test.step("A-101 C… re-issued to someone else; the first recipient is told", async () => {
    await approveSheet(designer, checker, sheets[0]!.id, "A-101", "P02");
    await apiCall(dc, "POST", `/api/v1/projects/${project.id}/transmittals`, {
      sheet_ids: [sheets[0]!.id], purpose: "GFC", contact_ids: [second.id],
    });
    const notice = await mailTo(request, first.email, /^New revision of A-101: use P02/);
    expect(notice.Subject).toContain("P02");
  });

  await test.step("the old link now shows A-101 P01 as superseded, downloaded watermarked", async () => {
    const outsider = await (await browser.newContext()).newPage();
    await outsider.goto(firstLink + "/");
    await expect(outsider.getByText("Superseded by P02")).toBeVisible();
    const download = await outsider.request.get(`${firstLink}/zip`);
    const zip = await download.body();
    expect(zip.includes(Buffer.from("A-101 P01 SUPERSEDED.pdf"))).toBe(true);
  });

  await test.step("the transmittal log and delivery status", async () => {
    await dc.goto(`/projects/${project.id}/transmittals`);
    await expect(dc.getByRole("link", { name: `${project.code}-TR-0002` })).toBeVisible();
    await dc.getByRole("link", { name: `${project.code}-TR-0001` }).click();
    await expect(dc.getByText(/Emailed/)).toBeVisible();
    await expect(dc.getByText(/Downloaded|Not yet/).first()).toBeVisible();
  });
});

test("the reviewer sees the request in the bell", async ({ browser }) => {
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { sheets } = await freshProject(lead, { sheets: ["A-201"] });
  const designer = await as(browser, STATE.designer);
  await designer.goto("/");
  await apiCall(designer, "POST", `/api/v1/sheets/${sheets[0]!.id}/transitions`, { action: "start" });
  await apiCall(designer, "POST", `/api/v1/sheets/${sheets[0]!.id}/transitions`, { action: "submit" });
  const checker = await as(browser, STATE.checker);
  await checker.goto("/");
  await expect.poll(async () => {
    await checker.reload();
    return checker.getByRole("button", { name: /Notifications, \d+\+? unread/ }).count();
  }, { timeout: 30_000 }).toBeGreaterThan(0);
  await checker.getByRole("button", { name: /Notifications/ }).click();
  await expect(checker.getByRole("link", { name: /A-201 is ready for your check/ }).first()).toBeVisible();
});
