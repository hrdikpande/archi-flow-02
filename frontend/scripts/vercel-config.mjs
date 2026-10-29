// Vercel Build Output API config (v3) for the SPA. The browser talks to one origin: Vercel
// proxies the backend paths to Railway, so session and CSRF cookies stay first-party and the
// API needs no CORS. Uploads and downloads go straight to S3 with presigned URLs.

/** Paths the Django service answers (02 §2; same list as deploy/caddy/Caddyfile). */
export const BACKEND_PATHS = ["api", "_allauth", "accounts", "django-admin", "django-static", "t", "site", "integrations"];

function origin(name, value, { required }) {
  if (!value) {
    if (required) throw new Error(`${name} is required, e.g. https://drawingops-api.up.railway.app`);
    return "";
  }
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must be an https:// origin`);
  return url.origin;
}

export function buildConfig(env) {
  const backend = origin("BACKEND_ORIGIN", env.BACKEND_ORIGIN, { required: true });
  const s3 = origin("S3_ORIGIN", env.S3_ORIGIN, { required: false });
  const sso = ["https://accounts.google.com", "https://login.microsoftonline.com"];
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${s3 ? ` ${s3}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${s3 ? ` ${s3}` : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    `form-action 'self' ${sso.join(" ")}`,
  ].join("; ");
  const security = {
    "content-security-policy": csp,
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(self), microphone=(), geolocation=()",
  };
  const config = {
    version: 3,
    routes: [
      // Backend first; no `continue`, so Django's own headers (no-referrer on /t, CSP) stand.
      { src: `^/(${BACKEND_PATHS.join("|")})(/.*)?$`, dest: `${backend}/$1$2` },
      { src: "^/(healthz|livez)$", dest: `${backend}/$1` },
      { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
      { src: "^/(.*)$", headers: security, continue: true },
      { handle: "filesystem" },
      { src: "^/(.*)$", dest: "/index.html" },
    ],
  };
  // Optional Vercel Cron instead of a beat service (Pro plan for 5-minute schedules).
  if (env.VERCEL_CRON_SCHEDULE) config.crons = [{ path: "/integrations/cron/tick", schedule: env.VERCEL_CRON_SCHEDULE }];
  return config;
}
