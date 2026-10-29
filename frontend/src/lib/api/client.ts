import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

/** The API error format (backend apps/core/exceptions.py): {code, detail, errors?, ...extra}. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: Record<string, string[]>;
  readonly body: Record<string, unknown>;

  constructor(status: number, body: unknown) {
    const data = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const detail = typeof data.detail === "string" ? data.detail : "Something went wrong. Try again.";
    super(detail);
    this.status = status;
    this.code = typeof data.code === "string" ? data.code : "error";
    this.errors = (data.errors as Record<string, string[]>) ?? {};
    this.body = data;
  }

  /** First message for a form field, if the server rejected it. */
  field(name: string): string | undefined {
    const value = this.errors[name];
    return Array.isArray(value) ? String(value[0]) : undefined;
  }
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function ensureCsrf(): Promise<string> {
  let token = readCookie("csrftoken");
  if (!token) {
    await fetch("/api/v1/auth/csrf", { credentials: "same-origin" });
    token = readCookie("csrftoken");
  }
  return token ?? "";
}

const csrf: Middleware = {
  async onRequest({ request }) {
    if (UNSAFE.has(request.method)) {
      request.headers.set("X-CSRFToken", await ensureCsrf());
    }
    return request;
  },
};

export const api = createClient<paths>({
  baseUrl: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  credentials: "same-origin",
});
api.use(csrf);

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/** Resolves to data, or throws ApiError with the server's code and messages. */
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok) throw new ApiError(response.status, error);
  return data as T;
}
