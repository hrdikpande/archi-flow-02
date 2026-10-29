/**
 * django-allauth headless "browser" client (sessions + CSRF). Only the flows DrawingOps uses:
 * local sign-in, TOTP second step and setup, SSO redirect, sign-out (F-40).
 */
import { ensureCsrf } from "@/lib/api/client";

const BASE = "/_allauth/browser/v1";

export interface AllauthError {
  message: string;
  code: string;
  param?: string;
}

export interface Flow {
  id: string;
  is_pending?: boolean;
  provider?: { id: string; name: string };
}

export interface AllauthResponse {
  status: number;
  data?: {
    flows?: Flow[];
    user?: { id: string; email: string };
    socialaccount?: { providers: { id: string; name: string }[] };
    type?: string;
    unused_code_count?: number;
    unused_codes?: string[];
  };
  meta?: { is_authenticated?: boolean; secret?: string; totp_url?: string; recovery_codes_generated?: boolean };
  errors?: AllauthError[];
}

async function call(method: string, path: string, body?: unknown): Promise<AllauthResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRFToken"] = await ensureCsrf();
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as AllauthResponse;
  return { ...json, status: response.status };
}

export const allauth = {
  config: () => call("GET", "/config"),
  session: () => call("GET", "/auth/session"),
  login: (email: string, password: string) => call("POST", "/auth/login", { email, password }),
  mfaAuthenticate: (code: string) => call("POST", "/auth/2fa/authenticate", { code }),
  logout: () => call("DELETE", "/auth/session"),
  totpSetup: () => call("GET", "/account/authenticators/totp"),
  totpActivate: (code: string) => call("POST", "/account/authenticators/totp", { code }),
  recoveryCodes: () => call("GET", "/account/authenticators/recovery-codes"),
};

export function pendingFlow(response: AllauthResponse): string | undefined {
  return response.data?.flows?.find((f) => f.is_pending)?.id;
}

export function firstError(response: AllauthResponse, fallback: string): string {
  return response.errors?.[0]?.message ?? fallback;
}

/** SSO starts with a top-level form POST so the browser follows the provider redirect. */
export async function redirectToProvider(providerId: string, next = "/"): Promise<void> {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${BASE}/auth/provider/redirect`;
  const fields: Record<string, string> = {
    provider: providerId,
    process: "login",
    callback_url: `${window.location.origin}${next}`,
    csrfmiddlewaretoken: await ensureCsrf(),
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
