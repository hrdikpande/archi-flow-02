import { expect, type Page } from "@playwright/test";
import { TOTP } from "otpauth";

// Matches backend/apps/core/management/commands/seed_e2e.py (dev/test only).
export const PASSWORD = "e2e-Password-123!";
export const ADMIN = "admin@firm.example";
export const DESIGNER = "designer@firm.example";
export const LEAD = "lead@firm.example";
export const CHECKER = "checker@firm.example";
export const DC = "dc@firm.example";
export const OWNER = "owner@firm.example";
export const ACCOUNTS = "accounts@firm.example";
const ADMIN_TOTP = new TOTP({ secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", digits: 6, period: 30 });

export const STATE = {
  admin: "e2e/.auth/admin.json",
  designer: "e2e/.auth/designer.json",
  lead: "e2e/.auth/lead.json",
  checker: "e2e/.auth/checker.json",
  dc: "e2e/.auth/dc.json",
  owner: "e2e/.auth/owner.json",
  accounts: "e2e/.auth/accounts.json",
};
export const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:8025";

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  // With SSO configured the card offers it first; otherwise it opens on email and password.
  const passwordLink = page.getByRole("button", { name: "Use email and password" });
  const emailField = page.getByLabel("Email");
  await expect(passwordLink.or(emailField)).toBeVisible();
  if (await passwordLink.isVisible()) await passwordLink.click();
  await emailField.fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (email === ADMIN) {
    // allauth rejects a code that was already used (replay protection), so if a previous run
    // used this window's code, wait for the next 30-second window and try once more.
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByLabel("Authentication code").fill(ADMIN_TOTP.generate());
      await page.getByRole("button", { name: "Verify" }).click();
      const welcome = page.getByRole("heading", { name: "My work", exact: true });
      const rejected = page.getByRole("alert");
      await expect(welcome.or(rejected)).toBeVisible();
      if (await welcome.isVisible()) break;
      const msToNextWindow = 30_000 - (Date.now() % 30_000) + 500;
      await page.waitForTimeout(msToNextWindow);
    }
  }
  await page.getByRole("heading", { name: "My work", exact: true }).waitFor();
}

/** Unique suffix so tests can run repeatedly against the same stack. */
export const uid = () => Date.now().toString(36).slice(-5).toUpperCase();

/** A valid one-page PDF (correct xref offsets) with the given text on it. */
export function onePagePdf(text = "DrawingOps test sheet"): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 24 Tf 72 500 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) body += `${String(o).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

/** JSON API calls with the page's session and CSRF token (for test setup only). */
export async function apiCall<T = unknown>(page: Page, method: string, path: string, data?: unknown): Promise<T> {
  const cookies = await page.context().cookies();
  let csrf = cookies.find((c) => c.name === "csrftoken")?.value;
  if (!csrf) {
    await page.request.get("/api/v1/auth/csrf");
    csrf = (await page.context().cookies()).find((c) => c.name === "csrftoken")?.value;
  }
  const response = await page.request.fetch(path, {
    method,
    data,
    headers: { "X-CSRFToken": csrf ?? "", "Content-Type": "application/json" },
  });
  if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${await response.text()}`);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

interface Id {
  id: string;
}

/** A fresh project with stages, a team and (optionally) sheets, created as the PL. */
export async function freshProject(page: Page, opts: { sheets?: string[] } = {}) {
  const code = `${2030 + Math.floor(Math.random() * 69)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const project = await apiCall<Id & { code: string; inbound_address: string }>(page, "POST", "/api/v1/projects", { code, name: `E2E ${code}` });
  const templates = await apiCall<Id[]>(page, "GET", "/api/v1/stage-templates");
  const stages = await apiCall<(Id & { name: string })[]>(page, "POST", `/api/v1/projects/${project.id}/stages/apply-template`, {
    template: templates[0]!.id,
  });
  const people = await apiCall<(Id & { email: string })[]>(page, "GET", "/api/v1/directory");
  const byEmail = (e: string) => people.find((p) => p.email === e)!.id;
  for (const [email, role] of [[DESIGNER, "designer"], [CHECKER, "dl"], [DC, "dc"]] as const) {
    await apiCall(page, "POST", `/api/v1/projects/${project.id}/members`, { user_id: byEmail(email), role });
  }
  const disciplines = await apiCall<(Id & { code: string })[]>(page, "GET", "/api/v1/disciplines");
  const arch = disciplines.find((d) => d.code === "A")!.id;
  const sheets: (Id & { number: string })[] = [];
  for (const number of opts.sheets ?? []) {
    sheets.push(
      await apiCall(page, "POST", `/api/v1/projects/${project.id}/sheets`, {
        number, title: `Sheet ${number}`, discipline: arch, stage: stages[0]!.id,
        owner: byEmail(DESIGNER), checker: byEmail(CHECKER),
      }),
    );
  }
  return { project, stages, sheets, byEmail };
}

export async function as(browser: import("@playwright/test").Browser, state: string): Promise<Page> {
  const context = await browser.newContext({ storageState: state });
  return context.newPage();
}

/** Upload a one-page PDF as the sheet's draft revision, waiting for the pipeline to verify it. */
export async function uploadDraft(page: Page, sheetId: string, number: string, text = "P01") {
  const pdf = onePagePdf(`${number} ${text}`);
  const presign = await apiCall<{ upload: { id: string }; url: string }>(page, "POST", "/api/v1/uploads/presign", {
    filename: `${number}.pdf`, size: pdf.length, content_type: "application/pdf", kind: "sheet",
  });
  const put = await page.request.put(presign.url, { data: pdf, headers: { "Content-Type": "application/pdf" } });
  if (!put.ok()) throw new Error(`storage PUT ${put.status()}`);
  await apiCall(page, "POST", `/api/v1/uploads/${presign.upload.id}/complete`);
  for (let i = 0; i < 40; i++) {
    const u = await apiCall<{ state: string; reason: string }>(page, "GET", `/api/v1/uploads/${presign.upload.id}`);
    if (u.state === "ready") break;
    if (u.state === "rejected") throw new Error(u.reason);
    await page.waitForTimeout(250);
  }
  await apiCall(page, "POST", `/api/v1/sheets/${sheetId}/revisions`, { upload_id: presign.upload.id });
}

/** Move a sheet through upload → submit → check → approve using each person's session. */
export async function approveSheet(designer: Page, checker: Page, sheetId: string, number: string, text = "P01") {
  const upload = (page: Page) => uploadDraft(page, sheetId, number, text);
  const move = (page: Page, action: string) => apiCall(page, "POST", `/api/v1/sheets/${sheetId}/transitions`, { action });
  const state = (await apiCall<{ state: string }>(designer, "GET", `/api/v1/sheets/${sheetId}/detail`)).state;
  if (state === "planned") await move(designer, "start");
  if (state === "issued") await move(designer, "next_revision");
  await upload(designer);
  await move(designer, "submit");
  await move(checker, "start_check");
  await move(checker, "approve");
}
