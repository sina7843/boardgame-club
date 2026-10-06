# Operations

Runbook for the limited-release stack (`compose.prod.yaml`). Deployment steps: [DEPLOYMENT.md](DEPLOYMENT.md).
Measured numbers: [QA_REPORT.md](QA_REPORT.md). Nothing here claims the targets are already met in production.

## Components

| Service | Role | State | Health |
|---|---|---|---|
| `web` (Caddy) | static SPA, reverse proxy `/api/*` incl. WebSocket, security headers | none (TLS certs in `caddy_data`) | `:8081/healthz` (container) |
| `api` (Node 24) | REST + Socket.IO; command path; one process | none | `/api/health/live`, `/api/health/ready` (DB reachable + migrated) |
| `worker` (Node 24) | deadlines, outbox, matchmaking, payment reconciliation, subscription expiry, maintenance | none | `:3010/health` (503 if no loop tick for 30 s), `:3010/metrics` |
| `migrate` | one-shot: migrations, then idempotent catalog seed | none | exit code |
| `postgres` 18.6 | **all durable state**: tables, snapshots, receipts, deadlines, outbox, ledger, payments | `pgdata` + encrypted archive `pgarchive` | `pg_isready` |

There is no Redis or other cache: a restart of any stateless service loses nothing; deadlines and the outbox
resume from PostgreSQL (verified in the load test with a worker restart and in the restore drill).

## Metrics

`GET /api/metrics` (Prometheus text) requires `Authorization: Bearer $METRICS_TOKEN`; without a token configured
the endpoint is disabled in production. Values are aggregates only — no user ids, table ids or game content.

| Metric | Meaning | Alert when (initial) |
|---|---|---|
| `bg_command_duration_ms{transport}` histogram | server-side command time, **network excluded** | share ≤ 250 ms below 95 % over 15 min |
| `bg_commands_total{transport,outcome}` | accepted / duplicate / rejection code (`STALE_REVISION`, …) | `INTERNAL_ERROR` > 0 |
| `bg_module_failures_total` | unexpected exceptions from a game module or command path | any increase → page |
| `bg_http_5xx_total` | 5xx responses | > 1 % of traffic |
| `bg_socket_connections` | open Socket.IO connections (this process) | > 80 % of the measured safe bound |
| `bg_active_tables`, `bg_open_tables`, `bg_moves_last_minute` | load | moves/min > 80 % of measured bound |
| `bg_outbox_backlog`, `bg_outbox_oldest_seconds` | unprocessed events | oldest > 60 s |
| `bg_deadlines_overdue` | pending deadlines > 5 s past due | > 0 for 2 min |
| `bg_queued_tickets` | matchmaking queue | informational |
| `bg_payments_pending`, `bg_payments_failed_last_hour` | payment reconciliation | pending older than TTL, failure spike |
| `bg_process_*` | RSS, heap, CPU seconds, uptime | RSS > 80 % of limit |
| worker `bg_worker_{runs,failures}_total{loop}`, `bg_worker_last_run_ms` | per-loop health | failures increasing |

Logs are structured JSON (pino in the API). Redacted: cookies, authorization headers, mobile numbers, OTP codes.
Slow commands (> 250 ms) log `tableId`, revision, outcome and duration only. Module failures log error name and
message, never the game state.

## Availability objective (NFR-05)

- **Target**: 99.5 % monthly availability of the *game service* (≈ 3 h 39 min of unplanned downtime per 30 days).
  This is a target; **it has not been measured in production** and is not claimed as achieved.
- **Measured as**: an external probe every 60 s from outside the hosting network performing
  `GET /api/health/ready` **and** a Socket.IO handshake through the public URL. A minute counts as down when both
  attempts in that minute fail. Availability = good minutes / (total minutes − announced maintenance minutes).
- **Excluded**: announced maintenance (below), and failures of third-party SMS / payment providers (tracked
  separately; login and checkout degrade, live games continue).
- **Error budget**: when > 50 % of the monthly budget is spent, freeze non-urgent releases until the cause is fixed.

## Maintenance

- Announce ≥ 24 h ahead in-app (support page) for anything that interrupts live games; window ≤ 30 min, at the
  lowest-traffic hour observed in metrics.
- During maintenance open a **platform incident** (`POST /api/admin/incidents`) first: turn clocks freeze and are
  extended by the downtime when the incident is closed, so nobody loses a game by timeout.
- Rolling restarts of `api`/`worker` alone are not maintenance: clients reconnect and resubscribe, commands resolve
  through receipts. Database upgrades are.

## Incidents

| Severity | Examples | Response |
|---|---|---|
| SEV-1 | game service down, data loss/corruption, hidden-information leak, wrong results | page owner immediately; open platform incident (freeze clocks); status note in-app within 30 min |
| SEV-2 | p95 > 1 s for 15 min, worker stalled (deadlines overdue), payments not reconciling | respond within 1 h |
| SEV-3 | single feature degraded, provider outage with workaround | next business day |

For every SEV-1/2: timeline, impact (tables/users), root cause, compensation applied (clock extension is
automatic; XP/premium via audited admin tools with a reason), follow-up actions. A hidden-information leak is
always SEV-1: disable the affected game (`PATCH /api/admin/games/:id` → not accepting tables) without deleting history.

## Backups and recovery (NFR-02, NFR-08)

**Design**
- Continuous WAL archiving (`archive_mode=on`, `archive_timeout=60s`) plus periodic base backups
  (`docker compose -f compose.prod.yaml exec -u postgres postgres base-backup.sh`; schedule daily via host cron or
  the platform's scheduler).
- Every file is `zstd`-compressed and encrypted with [age](https://age-encryption.org) **public-key** mode. The
  database host holds only the recipient (public) key (`BACKUP_RECIPIENT_FILE`); it cannot decrypt its own backups.
  The private identity is kept offline by the owner (password manager / hardware token, two named people) and is
  mounted only into a restore container.
- RPO is bounded by `archive_timeout` (60 s) **plus the off-host copy interval**. The `pgarchive` volume must be
  synced off-host (object storage in another region/provider, e.g. `rclone sync` every ≤ 5 min with a write-only
  credential). **No off-host target exists yet — release blocker.**
- Retention (initial): base backups 30 days (daily) + 12 monthly; WAL for the base-backup window (≥ 30 days).
  Access: only the operator role can read the bucket; deletion protected (object lock/versioning) where available.

**Restore** (tested procedure, `docker/backup-drill.sh` automates it for drills)
1. Open a platform incident (freezes clocks). Stop `api` and `worker`.
2. Start a restore container from the same postgres image with the archive mounted **read-only**, the private
   identity mounted at `/run/secrets/backup_identity`, an empty data volume and entrypoint `restore-base.sh`
   (newest base backup by default; `RECOVERY_TARGET_TIME` for point-in-time recovery). It replays WAL from the
   archive and promotes; archiving is disabled on the restored server.
3. Point `DATABASE_URL` at the restored server, start `api` + `worker`; readiness must report `migrations: ok`.
4. Verify: `bg_deadlines_overdue` → 0, `bg_outbox_backlog` drains, a test game can be played; close the incident
   (clocks resume with compensation).

**Drill result (local, 2026-10-06)**: RPO 34 s, database RTO 3.3 s, application RTO 16.6 s from `SIGKILL`; all rows
final before the snapshot point byte-identical (receipts, finished tables + pinned versions, results, reward
ledger); 6 live tables whose deadlines expired during the outage were completed by the resumed worker; 0 duplicate
rewards; 0 overdue deadlines; gameplay continued on the restored database. Targets: RPO ≤ 15 min, RTO ≤ 4 h.
Measured on a laptop with ~150 k receipts — production RTO grows with database size and download time from
off-host storage and must be re-measured on the target environment.

## Capacity (NFR-04)

Measured safe bound for limited release on one API process (details in [QA_REPORT.md](QA_REPORT.md#load)):
**≤ 150 concurrent live players (≈ 45 accepted moves/s, ≤ 200 sockets)**. Beyond ~200 live players the single
API event loop saturates (~80 accepted moves/s ceiling) and latency rises sharply. Turn-based players cost
almost nothing while idle. Scaling paths (not yet tested): run several API replicas — table pushes already fan out
via PostgreSQL `LISTEN/NOTIFY` to every replica, so no Socket.IO adapter is needed for tables — and add sticky
sessions at the proxy for the polling fallback.

## Routine tasks

| Task | How |
|---|---|
| Grant/revoke staff role | `pnpm --filter @bg/db grant-role <mobile> <role>` against the target DB (audited) |
| Suspend a broken game | Admin → game → "not accepting tables" (history kept) |
| Freeze clocks | Admin → «توقف سراسری» (platform incident) |
| Compensation | Admin → support: manual XP / premium days (reason required, audited) |
| Payment stuck pending | worker reconciles every 30 s; admin payments list shows provider status |
