/** S3 demo (docs/05): a designer submits A-101, the checker returns it with a redline, the
 * designer fixes it, the checker approves; an upload named A101.pdf is blocked with the rule. */
import { expect, test } from "@playwright/test";

import { as, freshProject, onePagePdf, STATE } from "./support";

test("review cycle with redlines, and A-04 naming block", async ({ browser }) => {
  test.setTimeout(120_000);
  const lead = await as(browser, STATE.lead);
  await lead.goto("/");
  const { project, sheets } = await freshProject(lead, { sheets: ["A-101"] });
  const sheetUrl = `/projects/${project.id}/sheets/${sheets[0]!.id}`;

  const designer = await as(browser, STATE.designer);
  await test.step("designer starts and uploads a misnamed PDF: blocked with the rule", async () => {
    await designer.goto(sheetUrl);
    await designer.getByRole("button", { name: "Start" }).click();
    await expect(designer.getByText("State: In progress")).toBeVisible();
    await designer.locator('input[type="file"][accept="application/pdf"]').setInputFiles({ name: "A101.pdf", mimeType: "application/pdf", buffer: onePagePdf("A101") });
    await expect(designer.getByText("File name A101.pdf doesn't contain the sheet number A-101. Rename to A-101.pdf.")).toBeVisible({ timeout: 20_000 });
  });

  await test.step("a correctly named PDF passes; designer submits", async () => {
    await designer.locator('input[type="file"][accept="application/pdf"]').setInputFiles({ name: "A-101.pdf", mimeType: "application/pdf", buffer: onePagePdf("A-101 P01") });
    await expect(designer.getByText("File name A101.pdf")).toBeHidden({ timeout: 20_000 });
    await designer.getByRole("button", { name: "Submit for check" }).click();
    await expect(designer.getByText("State: Ready for check")).toBeVisible();
  });

  const checker = await as(browser, STATE.checker);
  await test.step("checker returns it with a redline from the review queue", async () => {
    await checker.goto("/reviews");
    const row = checker.getByRole("row", { name: new RegExp(`A-101.*${project.code}`) });
    await row.getByRole("button", { name: "Open" }).click();
    await checker.getByRole("button", { name: "Start check" }).click();
    await checker.getByLabel("Comment").fill("Grid line C is offset by 300 mm.");
    await checker.locator('input[type="file"][multiple]').setInputFiles({ name: "redline.pdf", mimeType: "application/pdf", buffer: onePagePdf("redline") });
    await checker.getByRole("button", { name: "Return with redlines" }).click();
    await expect(checker.getByText("A-101 returned to the designer").first()).toBeVisible({ timeout: 20_000 });
  });

  await test.step("designer sees the redline, fixes, resubmits", async () => {
    await designer.reload();
    await expect(designer.getByText("State: Changes requested")).toBeVisible();
    await expect(designer.getByText("Grid line C is offset by 300 mm.").first()).toBeVisible();
    await expect(designer.getByText("1 redline file")).toBeVisible();
    await designer.getByRole("button", { name: "Resume work" }).click();
    await designer.getByRole("button", { name: "Submit for check" }).click();
    await expect(designer.getByText("State: Ready for check")).toBeVisible();
  });

  await test.step("checker approves; issue becomes available to the DC", async () => {
    await checker.goto(sheetUrl);
    await checker.getByRole("button", { name: "Start check" }).click();
    await checker.getByRole("button", { name: "Approve" }).click();
    await expect(checker.getByText("State: Approved for issue")).toBeVisible();
    const dc = await as(browser, STATE.dc);
    await dc.goto(sheetUrl);
    await expect(dc.getByRole("link", { name: "Issue…" })).toBeVisible();
  });

  await test.step("history records every step", async () => {
    await checker.reload();
    const activity = checker.getByRole("region", { name: "Activity" }).or(checker.locator("section", { has: checker.getByRole("heading", { name: "Activity" }) }));
    for (const step of ["Planned → In progress", "In progress → Ready for check", "In check → Changes requested", "In check → Approved for issue"]) {
      await expect(activity.getByText(step).first()).toBeVisible();
    }
  });
});
