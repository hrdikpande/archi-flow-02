# Operations (T-06)

## Deploy

```bash
export DRAWINGOPS_VERSION=2026.11.1          # image tag built by CI
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/drawingops/env pull
docker compose -f deploy/docker-compose.prod.yml --env-file /etc/drawingops/env up -d
```
`migrate` runs migrations and `check --deploy` before `web`, `worker` and `beat` start.
`/etc/drawingops/env` holds secrets (never in git): `DJANGO_SECRET_KEY`, database, S3, SMTP,
SSO; `SITE_ADDRESS=drawings.<firm-domain>` makes Caddy obtain a certificate.

## Monitoring

* Prometheus (`127.0.0.1:9090`, reach it through an SSH tunnel) scrapes `web:8000/metrics`;
  `/metrics` is not exposed through Caddy.
* App gauges: `drawingops_beat_heartbeat_age_seconds`, `drawingops_sweeps_missing{rule}`,
  `drawingops_outbox_pending`, `drawingops_exports_waiting`; plus django-prometheus request
  latency and status counters.
* Alerts (`deploy/monitoring/alerts.yml`): AppDown, HighErrorRate (> 2 % 5xx), SlowLists
  (p95 > 300 ms, N-01), SchedulerStale, SweepMissing (N-05), OutboxBacklog. Alertmanager emails
  the on-call address (`deploy/monitoring/alertmanager.yml`).
* `/healthz` (unauthenticated, no data): database, cache, scheduler, sweeps.

## Load and capacity (N-01, N-09)

`make seed-scale` then `make loadtest` (200 users, 5 min). The run fails if a list endpoint's
p95 exceeds 300 ms or a dashboard 2 s. Results: [load-test.md](load-test.md).
