# Deploy: Railway + Vercel + Upstash + Amazon S3 + SMTP

The managed-services layout. The self-hosted alternative (one VM, Docker Compose, Caddy) is
in [operations.md](operations.md).

```text
Browser ──► Vercel (SPA + proxy) ──► Railway "web" (Django, gunicorn)
   │             /api /_allauth /accounts /t /site      │
   │             /integrations /django-admin            ├─► Railway PostgreSQL
   │                                                    ├─► Upstash Redis (TLS) ◄── Railway "worker" (Celery)
   └──── presigned PUT/GET ────► Amazon S3 ◄────────────┘                        ◄── Railway "beat" (Celery beat)
                                                           SMTP provider ◄── worker
```

**Why Vercel proxies the API.** The browser sees one origin, so the session and CSRF cookies
stay first-party (SameSite=Lax) and the API needs no CORS. Only S3 is called cross-origin, and
it uses short-lived presigned URLs.

## 1. Amazon S3

1. Create a bucket in the agreed region (e.g. `ap-south-1`). Keep **Block all public access** on.
2. Turn on **Versioning** and **Default encryption** (SSE-S3).
3. Apply the policies, after replacing `YOUR-BUCKET` and `YOUR-APP` in the files:
   ```bash
   aws s3api put-bucket-cors --bucket YOUR-BUCKET --cors-configuration file://deploy/aws/s3-cors.json
   aws s3api put-bucket-policy --bucket YOUR-BUCKET --policy file://deploy/aws/bucket-policy.json
   aws s3api put-bucket-lifecycle-configuration --bucket YOUR-BUCKET --lifecycle-configuration file://deploy/aws/lifecycle.json
   ```
4. Create an IAM user (or role) with `deploy/aws/iam-policy.json` only, and make an access key for Railway.

## 2. Upstash Redis

Create a Redis database in the region closest to Railway and copy the **TLS** URL (`rediss://…`).
Use it for both `CELERY_BROKER_URL` and `CACHE_URL`. The worker runs without mingle, gossip and
heartbeat, which keeps the command count (and the bill) low. Choose a plan without a daily
command cap, or at least 100k commands a day.

## 3. Railway

1. Create a project and add the **PostgreSQL** plugin.
2. Add **three services from this repository**, each with *Root Directory* `backend` and its own
   *Config file*:

   | Service | Config file | What it runs |
   |---|---|---|
   | `web` | `/backend/railway/web.json` | gunicorn on `$PORT` (`WEB_CONCURRENCY=6` processes for ~200 users: give it ~6 vCPU or run 2 replicas of 3); pre-deploy runs `migrate` and `check --deploy`; health check `/livez` |
   | `worker` | `/backend/railway/worker.json` | Celery worker, queues `default,email,sweeps,pdf` |
   | `beat` | `/backend/railway/beat.json` | Celery beat (exactly one replica) |

   **Cron instead of beat (optional):** instead of `beat`, add a service with
   `/backend/railway/tick-cron.json`. Railway runs `scheduler_tick` every 5 minutes, which
   enqueues each periodic task once; all of them are idempotent. Then set
   `BEAT_STALE_AFTER_MINUTES=11` so `/healthz` does not report the scheduler as stale between ticks.
   **Recommended: the beat service.** It is always on and simpler to monitor; the cron tick
   suits very small installations.
3. Put the variables from `deploy/railway/env.example` on the project (shared variables) with
   real values. Never commit them.
4. Deploy. Watch `web`'s pre-deploy log: migrations, then `System check identified no issues`.
5. Create the firm and its first admin once:
   `railway run --service web python manage.py bootstrap_org --name "Firm name" --admin-email you@firm.com`.

## 4. Vercel

1. Import the repository and set *Root Directory* to `frontend`. `vercel.json` sets the build.
2. Environment variables:
   - `BACKEND_ORIGIN` = the Railway web URL, e.g. `https://drawingops-web.up.railway.app` (https only).
   - `S3_ORIGIN` = `https://YOUR-BUCKET.s3.ap-south-1.amazonaws.com` (added to the CSP).
   - *(optional)* `VERCEL_CRON_SCHEDULE` = `*/5 * * * *` and `CRON_SECRET` (the same value as on
     Railway) to use Vercel Cron instead of beat. 5-minute schedules need the Pro plan; Hobby
     allows one run a day, which is not enough.
3. Deploy. The build fails fast if `BACKEND_ORIGIN` is missing or not https.
4. Put the Vercel domain into Railway's `DJANGO_CSRF_TRUSTED_ORIGINS` and `FRONTEND_URL`, and into
   the S3 CORS `AllowedOrigins`.

## 5. SMTP

Use the provider's SMTP credentials (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`,
`EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS=true` on port 587, `DEFAULT_FROM_EMAIL`). Set up SPF,
DKIM and DMARC for the sending domain. Then use Admin › Integrations › **Send test email**.

## 6. Check it works

- `https://YOUR-APP.vercel.app/healthz` shows database, cache and scheduler `ok` (sweeps show
  `ok` after 09:00 IST on the first day).
- Sign in, create a project, upload a PDF (tests the presigned PUT and S3 CORS), issue a
  transmittal (tests SMTP), and open the emailed link in a private window.

## Limits to know

- Vercel's proxy has a request body limit of about 4.5 MB and a response timeout. File uploads
  bypass it (they go straight to S3), but very large Excel imports should be split.
  `EXPORT_SYNC_MAX_ROWS=2000` keeps synchronous exports short; bigger ones run in the worker.
- Keep the Railway web URL unadvertised. Client IPs (audit log, sign-in rate limits) are taken
  with `TRUSTED_PROXY_COUNT=2`. Requests sent straight to Railway can forge that IP, which only
  affects the audit log and the per-IP sign-in limits; the per-account lock (5 failures in
  5 minutes) and all permissions still apply (DD-038).
- Backups: Railway PostgreSQL backups plus point-in-time recovery on paid plans; S3 versioning.
  Run the restore drill monthly against a backup (`make restore-drill ARGS=dump.pgdump`).
