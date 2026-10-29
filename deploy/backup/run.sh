#!/bin/sh
# N-02 backup loop (runs in the `backup` service). Every night at BACKUP_AT (local time):
#   1. pg_basebackup (tar, compressed) — the base for point-in-time recovery with the WAL archive
#   2. pg_dump -Fc — a logical dump for quick restores and the monthly restore drill
#   3. prune base backups, dumps and archived WAL older than BACKUP_KEEP_DAYS (default 7)
# Off-site copy: set BACKUP_SYNC_CMD (e.g. an rclone sync to the firm's second region).
set -eu
: "${BACKUP_AT:=01:30}" "${BACKUP_KEEP_DAYS:=7}" "${TZ:=Asia/Kolkata}"
export PGPASSWORD="$POSTGRES_PASSWORD" TZ
host=postgres

backup_once() {
  stamp=$(date +%Y%m%d-%H%M)
  dir=/backups/base-$stamp
  echo "backup: base backup to $dir"
  pg_basebackup -h "$host" -U "$POSTGRES_USER" -D "$dir" -Ft -z -X none --checkpoint=fast
  echo "backup: logical dump"
  pg_dump -h "$host" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "/backups/dump-$stamp.pgdump"
  find /backups -maxdepth 1 -name 'base-*' -type d -mtime +"$BACKUP_KEEP_DAYS" -exec rm -rf {} +
  find /backups -maxdepth 1 -name 'dump-*.pgdump' -mtime +"$BACKUP_KEEP_DAYS" -delete
  # WAL older than the oldest kept base backup is no longer needed for PITR.
  oldest=$(ls -1d /backups/base-* 2>/dev/null | head -n 1 || true)
  [ -n "$oldest" ] && find /wal-archive -type f ! -newer "$oldest" -delete
  [ -n "${BACKUP_SYNC_CMD:-}" ] && sh -c "$BACKUP_SYNC_CMD"
  date -Iseconds > /backups/LAST_SUCCESS
  echo "backup: done $stamp"
}

[ "${1:-}" = "--now" ] && { backup_once; exit 0; }
while true; do
  if [ "$(date +%H:%M)" = "$BACKUP_AT" ]; then
    backup_once || echo "backup: FAILED" >&2
    sleep 61
  fi
  sleep 30
done
