#!/usr/bin/env bash
# Isolated backup → disaster → restore drill for a NON-production stack started from compose.prod.yaml.
# Measures RPO/RTO and verifies restored data and recovery behaviour. Prints no key material.
#   VARS=<compose env file> IDENTITY=<age identity file (private key, drill-only)> METRICS_TOKEN=... \
#   PROJECT=bg-smoke BASE=http://127.0.0.1:18080 docker/backup-drill.sh
set -euo pipefail
: "${VARS:?}" "${IDENTITY:?}" "${METRICS_TOKEN:?}"
P=${PROJECT:-bg-smoke}
BASE=${BASE:-http://127.0.0.1:18080}
DC=(docker compose -p "$P" --env-file "$VARS" -f compose.prod.yaml)
PGUSER_=$(grep -E '^POSTGRES_USER=' "$VARS" | cut -d= -f2)
PGDB=$(grep -E '^POSTGRES_DB=' "$VARS" | cut -d= -f2)
ORIG_URL=$(grep -E '^DATABASE_URL=' "$VARS" | cut -d= -f2-)
RESTORE=$P-drill-restore
now() { date -u +%s.%N; }
sub() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", a - b }'; }
PIDFILE=$(mktemp)
log() { echo "[$(date -u +%H:%M:%S)] $*"; }
q() { "${DC[@]}" exec -T postgres psql -U "$PGUSER_" -d "$PGDB" -Atc "$1"; }
qr() { docker exec "$RESTORE" psql -U "$PGUSER_" -d "$PGDB" -Atc "$1"; }
# Metrics are not routed through the public proxy: scrape inside the api container (internal network).
metric() { "${DC[@]}" exec -T api wget -qO- --header "authorization: Bearer $METRICS_TOKEN" http://127.0.0.1:3000/api/metrics | grep -E "^bg_$1 " | cut -d' ' -f2; }

fingerprint() { # rows that were final at T1 must be byte-identical after restore
  cat <<SQL
select json_build_object(
 'receipts', (select count(*) || ':' || md5(string_agg(id::text || revision || status, ',' order by id)) from command_receipts where created_at <= '$1'),
 'finishedTables', (select count(*) || ':' || md5(string_agg(id::text || revision || game_version_id::text, ',' order by id)) from game_tables where finished_at <= '$1'),
 'results', (select count(*) || ':' || md5(string_agg(table_id::text || outcome::text, ',' order by table_id)) from game_results where created_at <= '$1'),
 'rewards', (select count(*) || ':' || md5(string_agg(source_key || amount, ',' order by source_key)) from reward_ledger where created_at <= '$1'))
SQL
}

log "1. encrypted base backup"
t=$(now); base=$("${DC[@]}" exec -T -u postgres postgres base-backup.sh | tail -n1)
log "   $base in $(sub "$(now)" "$t")s; header: $("${DC[@]}" exec -T postgres sh -c "head -c 21 $base")"

log "2. post-backup gameplay (40 s load)"
(cd apps/api && BASE=$BASE METRICS_TOKEN=$METRICS_TOKEN L3_TABLES=20 SB_TABLES=10 DURATION_S=40 THINK_MS=300 node load/loadtest.ts >/dev/null 2>&1)
T1=$(q "select now()")
F1=$(q "$(fingerprint "$T1")")
log "   T1=$T1"

log "3. idle live tables (120 s turns, nobody moves → deadlines fall due DURING the outage); markers every 2 s; SIGKILL"
IDLE="select id from game_tables where (settings->>'turnSeconds')::int = 120"
(cd apps/api && BASE=$BASE L3_TABLES=6 SB_TABLES=0 DURATION_S=900 THINK_MS=900000 TURN_SECONDS=120 RECONNECT_PCT=0 DUP_PCT=0 node load/loadtest.ts >/dev/null 2>&1 & echo $! > "$PIDFILE")
q "create schema if not exists drill; create table if not exists drill.marker(at timestamptz primary key default clock_timestamp())" >/dev/null
for i in $(seq 1 38); do
  q "insert into drill.marker default values" >/dev/null; sleep 2
  if [ "$i" = 5 ]; then idle_active=$(q "select count(*) from game_tables where status='active' and id in ($IDLE)"); log "   idle tables active=$idle_active"; fi
done
last_written=$(q "select max(at) from drill.marker")
kill "$(cat "$PIDFILE")" 2>/dev/null || true
docker kill "$P-postgres-1" >/dev/null
T_KILL=$(now); log "   killed; last marker written $last_written"

log "4. restore into a NEW volume from base backup + WAL archive (archive mounted read-only)"
docker volume create "$RESTORE" >/dev/null
docker run -d --name "$RESTORE" --network "${P}_backend" \
  -v "$RESTORE:/var/lib/postgresql" -v "${P}_pgarchive:/archive:ro" -v "$IDENTITY:/run/secrets/backup_identity:ro" \
  -e POSTGRES_PASSWORD=unused-existing-cluster --entrypoint restore-base.sh "boardgame-postgres:${IMAGE_TAG:-smoke}" >/dev/null
until [ "$(qr "select not pg_is_in_recovery()" 2>/dev/null)" = "t" ]; do sleep 1; done
T_DB=$(now); log "   database promoted after $(sub "$T_DB" "$T_KILL")s"

log "5. compare data final at T1"
F2=$(qr "$(fingerprint "$T1")")
[ "$F1" = "$F2" ] && log "   fingerprint IDENTICAL: $F1" || { log "   FINGERPRINT MISMATCH"; echo "$F1"; echo "$F2"; }
last_restored=$(qr "select max(at) from drill.marker")
log "   last marker restored $last_restored (written $last_written)"

log "6. switch api + worker to the restored database"
RURL=${ORIG_URL/@postgres:/@$RESTORE:}
DATABASE_URL=$RURL "${DC[@]}" up -d --no-deps --force-recreate api worker >/dev/null 2>&1
until curl -sf "$BASE/api/health/ready" >/dev/null; do sleep 1; done
T_APP=$(now); log "   API ready on restored data; RTO (kill → serving) $(sub "$T_APP" "$T_KILL")s"

log "7. recovery behaviour"
log "   idle tables restored active: $(qr "select count(*) from game_tables where status='active' and id in ($IDLE)") (were $idle_active); waiting for their deadlines"
for _ in $(seq 1 120); do [ "$(qr "select count(*) from game_tables where status='active' and id in ($IDLE)")" = "0" ] && break; sleep 1; done
log "   idle tables finished by the resumed worker: $(qr "select count(*) from game_results r join game_tables t on t.id = r.table_id where t.id in ($IDLE) and r.reason = 'timeout' and r.created_at > to_timestamp($T_KILL)")"
log "   overdue deadlines: $(metric deadlines_overdue); outbox backlog: $(metric outbox_backlog)"
log "   duplicate reward source keys: $(qr "select count(*) from (select source_key from reward_ledger group by 1 having count(*) > 1) d")"
log "   tables whose pinned version is missing: $(qr "select count(*) from game_tables t left join game_versions v on v.id = t.game_version_id where v.id is null")"
(cd apps/api && BASE=$BASE METRICS_TOKEN=$METRICS_TOKEN L3_TABLES=5 SB_TABLES=3 DURATION_S=15 THINK_MS=200 node load/loadtest.ts 2>/dev/null | grep -E '"(accepted|unexpectedErrors|violations)"' | tr -d ' \n'); echo
echo "RESULT rpo_seconds=$(qr "select extract(epoch from (to_timestamp($T_KILL) - max(at)))::numeric(10,1) from drill.marker") rto_db_seconds=$(sub "$T_DB" "$T_KILL") rto_app_seconds=$(sub "$T_APP" "$T_KILL")"

log "8. return the smoke stack to its original database (drill volume kept for inspection)"
"${DC[@]}" up -d postgres >/dev/null 2>&1
DATABASE_URL=$ORIG_URL "${DC[@]}" up -d --no-deps --force-recreate api worker >/dev/null 2>&1
log "done"
