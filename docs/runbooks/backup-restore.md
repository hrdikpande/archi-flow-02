# Backup, point-in-time recovery and restore drills (N-02)

Targets: nightly backup, 7-day point-in-time recovery (PITR), object-storage versioning,
monthly restore drill, RPO 24 h (in practice ≤ 5 min with WAL archiving), RTO 4 h.

## What runs

* **Postgres WAL archiving** (`deploy/docker-compose.prod.yml`, service `postgres`):
  `archive_mode=on`, `archive_timeout=300`, WAL copied to the `walarchive` volume.
* **Nightly backup** (service `backup`, `deploy/backup/run.sh`, 01:30 IST): `pg_basebackup`
  (base for PITR) + `pg_dump -Fc` (logical, quick restore). 7 days kept; WAL older than the
  oldest base is pruned. `BACKUP_SYNC_CMD` copies `/backups` off the host (e.g. `rclone sync`
  to a second region). `/backups/LAST_SUCCESS` holds the time of the last good run.
* **Object storage**: enable bucket versioning on the production bucket (owner's S3, DEC-01):
  `aws s3api put-bucket-versioning --bucket <bucket> --versioning-configuration Status=Enabled`,
  plus a lifecycle rule expiring non-current versions after 30 days. Issued files are never
  overwritten by the app (keys include the SHA-256), so versioning only guards against deletes.

## Restore the latest nightly dump (fast path)

```bash
docker compose -f deploy/docker-compose.prod.yml stop web worker beat
docker compose -f deploy/docker-compose.prod.yml exec backup sh -c \
  'pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/dump-YYYYMMDD-HHMM.pgdump'
docker compose -f deploy/docker-compose.prod.yml start web worker beat
```

## Point-in-time recovery (to a moment before an incident)

1. Stop the app (`web worker beat`) and `postgres`.
2. Move the old data directory aside; untar the newest base backup taken **before** the target
   time into the data volume (`base.tar.gz`, `pg_wal.tar.gz` is not used: `-X none`).
3. In the data directory create `recovery.signal` and add to `postgresql.auto.conf`:
   ```
   restore_command = 'cp /wal-archive/%f %p'
   recovery_target_time = '2026-11-12 14:05:00+05:30'
   recovery_target_action = 'promote'
   ```
4. Start `postgres`; watch the log until "database system is ready to accept connections".
5. Check `/healthz`, a few recent sheets, and the audit trail end time; start the app.

## Monthly restore drill

`make restore-drill` (dev: dumps the running DB) or
`make restore-drill ARGS=/path/to/dump-YYYYMMDD-HHMM.pgdump` (staging/production dump).
The script restores into a throwaway Postgres 16, compares row counts of the key tables,
checks the audit insert-only trigger still blocks deletes and the dashboard view exists, and
prints a summary row. Append it to [restore-drills.md](restore-drills.md). Exit code 0 = passed.
