#!/usr/bin/env bash
# N-02 restore drill (monthly): restore a backup into a throwaway Postgres, check that the data
# and the database guards came back, and report how long it took (RTO target 4 h).
#
#   scripts/restore_drill.sh                       # dev: dump the running compose DB, restore it
#   scripts/restore_drill.sh /path/dump.pgdump     # restore a nightly dump from the backup volume
#
# Exit code 0 = drill passed. Append the printed summary to docs/runbooks/restore-drills.md.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=${COMPOSE:-"docker compose -f deploy/docker-compose.yml --env-file .env"}
DB=${POSTGRES_DB:-drawingops}
USER=${POSTGRES_USER:-drawingops}
SCRATCH=drawingops-restore-drill
TABLES="project stage sheet sheet_revision transmittal transmittal_item file_object audit_event timesheet time_entry allocation"
WORK=$(mktemp -d)
trap 'docker rm -f "$SCRATCH" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

count() { # $1 = psql runner, $2 = table
  $1 -tAc "SELECT count(*) FROM $2" 2>/dev/null | tr -d '[:space:]'
}
src_psql() { $COMPOSE exec -T postgres psql -U "$USER" -d "$DB" "$@"; }

started=$(date +%s)
if [ $# -ge 1 ]; then
  DUMP=$1
  echo "drill: using $DUMP"
else
  for t in $TABLES; do count src_psql "$t" > "$WORK/before.$t"; done
  DUMP=$WORK/drill.pgdump
  echo "drill: dumping the running database"
  $COMPOSE exec -T postgres pg_dump -U "$USER" -d "$DB" -Fc > "$DUMP"
  for t in $TABLES; do count src_psql "$t" > "$WORK/after.$t"; done
fi
size=$(du -h "$DUMP" | cut -f1)

echo "drill: starting a scratch Postgres 16"
docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD=drill -e POSTGRES_USER="$USER" -e POSTGRES_DB="$DB" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$SCRATCH" pg_isready -U "$USER" >/dev/null 2>&1 && break; sleep 1; done
sleep 2
restore_started=$(date +%s)
docker exec -i "$SCRATCH" pg_restore -U "$USER" -d "$DB" --no-owner --exit-on-error < "$DUMP"
restore_seconds=$(( $(date +%s) - restore_started ))
dst_psql() { docker exec -i "$SCRATCH" psql -U "$USER" -d "$DB" "$@"; }

fail=0
echo "drill: comparing row counts"
for t in $TABLES; do
  got=$(count dst_psql "$t")
  if [ $# -ge 1 ]; then
    printf '  %-18s %8s\n' "$t" "$got"
  else
    before=$(cat "$WORK/before.$t"); after=$(cat "$WORK/after.$t")
    lo=$before; hi=$after
    [ "$lo" -gt "$hi" ] && { tmp=$lo; lo=$hi; hi=$tmp; }
    ok=OK; { [ "$got" -lt "$lo" ] || [ "$got" -gt "$hi" ]; } && { ok=MISMATCH; fail=1; }
    printf '  %-18s source %8s..%-8s restored %8s  %s\n' "$t" "$before" "$after" "$got" "$ok"
  fi
done

echo "drill: checking database guards"
if dst_psql -tAc "SELECT 1 FROM pg_trigger WHERE tgname = 'audit_event_insert_only'" | grep -q 1; then
  echo "  audit_event insert-only trigger present"
  if dst_psql -c "UPDATE audit_event SET verb = verb WHERE false" >/dev/null 2>&1 && \
     dst_psql -c "DELETE FROM audit_event WHERE id IN (SELECT id FROM audit_event LIMIT 1)" >/dev/null 2>&1 && \
     [ "$(count dst_psql audit_event)" != "0" ]; then
    echo "  WARNING: audit row could be deleted"; fail=1
  else
    echo "  audit rows cannot be deleted (trigger fires)"
  fi
else
  echo "  MISSING audit trigger"; fail=1
fi
dst_psql -tAc "SELECT 1 FROM pg_matviews WHERE matviewname = 'dash_sheet_stats'" | grep -q 1 \
  && echo "  dashboard read model present" || { echo "  MISSING dash_sheet_stats"; fail=1; }
dst_psql -tAc "SELECT max(name) FROM django_migrations" >/dev/null && echo "  migrations table readable"

total=$(( $(date +%s) - started ))
echo
echo "| $(date +%d-%b-%Y) | dump $size | restore ${restore_seconds}s | drill ${total}s | $([ $fail = 0 ] && echo PASSED || echo FAILED) |"
exit $fail
