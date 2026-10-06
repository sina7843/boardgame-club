# QA report — phase 04 release candidate (2026-10-06)

Only commands that were actually run are listed. "Local" means one developer laptop; nothing ran on a production
host or a real phone.

**Environment**: Intel i7-12650H (10 cores / 16 threads), 15.6 GB RAM, Windows 11 Enterprise; Docker Desktop
29.6.2 (WSL2, 16 vCPU / 7.6 GiB visible to containers); Node 24.13.1; pnpm 11.5.2; PostgreSQL 18.6; Playwright 1.63
(Chromium only).

## Build and tests

| Check | Result |
|---|---|
| `pnpm lint` | clean |
| `pnpm typecheck` (all packages) | 0 errors |
| `pnpm build` (web) | OK; main chunk 280.9 kB (87.5 kB gzip), routes lazy-loaded, no size warning |
| `pnpm test` | **134 passed**: contracts 13, web 8, engine 17, play 7, api 88 (incl. new `ops.test.ts`: metrics gating + aggregate-only output, admin missions/audit filters/subscriptions; config empty-value handling), worker 1 |
| `npx playwright test` (final run) | **46 passed, 4 skipped** (3-player and turn-return flows run at 360/1440 only, by design) |
| Docker images | `api`, `worker`, `migrate`, `web`, `postgres` built from the lockfile |
| Archive failure self-test | `docker/postgres/selftest-failures.sh` → PASS (missing source / missing key exit non-zero, no file written) |

E2E covers: login/OTP, catalog/detail, tutorial, quick match → both games, two-player live **and** turn-based games
to the result (public state: Line Three), **three-player Sealed Bids** with per-client concealment checked in the
UI and in the payload each client receives, turn-based return via «نوبت من», friends/invite/table chat/block,
clubs/report/moderator suspension/appeal, ranked result → rating/XP/missions, dev checkout (failed and verified),
admin and moderator endpoints refused for a normal player (UI + API 403).

**Flakiness observed and handled**
- The three-player spec failed 1 in ~8 runs. Diagnosis: a bid clicked before another player's push arrived was
  rejected `STALE_REVISION` (correct; the protocol forbids automatic resubmission) and the test did not check that
  its bid landed. The test now verifies acceptance via the API and re-seals like a user; 12/12 repeats passed.
- One full run (of three) timed out once in the social discovery→queue→both-games flow at 1440; it passed 2/2 in
  isolation and in the two later full runs. Artifacts were overwritten before diagnosis; the same stale-bid race in
  its two-player Sealed Bids section is the likely cause (not confirmed).

## Accessibility (NFR-06) and widths (NFR-07)

- axe-core 4.13 (`@axe-core/playwright`), tags WCAG 2.0/2.1 A + AA, **21 pages × 4 widths (360/768/1440/1920):
  0 violations** after one fix (decorative cover SVGs had `role="img"` with an empty name inside a labelled link).
  Results: `docs/evidence/phase-04/a11y-*.json`.
- Keyboard: skip link first, visible focus ring, focus moves through > 5 distinct controls without trapping;
  board and token controls keyboard-operable (earlier phases).
- Screenshots: `docs/evidence/phase-04/screenshots/` (92 files).
- **Safari iOS and Chrome Android: UNVERIFIED** — no real devices; emulated viewports are not counted.

## Production-shape smoke (NFR-08 / deployment)

Ran `compose.prod.yaml` locally with throwaway values (`NODE_ENV=development`, because production mode refuses
the fixture OTP — verified separately: API and worker both refuse to start in production with fixture OTP / fake
payments). Verified through Caddy: SPA + deep links, CSP and security headers, `Server` header removed, CSRF
origin rejection (403), OTP login cookie `HttpOnly; SameSite=Lax`, WebSocket upgrade (foreign origin rejected),
`/api/metrics` 404 publicly and 403 internally without token, readiness `migrations: ok`, uid 1000/100, read-only
root FS, PostgreSQL unpublished on an internal network, SIGTERM drain (`worker stopped … abandonedJobs: 0`).

## Load (NFR-03, NFR-04) {#load}

Driver: `apps/api/load/loadtest.ts` through the production proxy and images. Bots are real Socket.IO clients
(cookie session, subscribe, act only on server-provided `legalActions`, revision taken at "click" time like the UI),
2 % reconnects, 3 % duplicate resends of the same `commandId`. Live tables, 60 s turns. Line Three = 2 players,
public state; Sealed Bids = 3 players, simultaneous hidden bids. Dataset at start ≈ 10 k tables / 140 k receipts.
Generator, proxy, API, worker and DB all on the same laptop. Raw results: `docs/evidence/phase-04/load/*.json`.

| Profile | Players / sockets | Tables (L3 + SB) | Think (mean) | Commands/s | Accepted moves/s | Client RTT p50 / p95 / p99 ms | Server command time: mean, ≤ 50 ms, ≤ 250 ms | Errors | Hidden-info checks |
|---|---|---|---|---|---|---|---|---|---|
| A + worker restart mid-run | 190 / 190 | 50 + 30 | 1.5 s | 59.5 | 56.8 | 29 / 128 / 288 | 29 ms, 87.2 %, **99.6 %** | 0 | 0 / 14 017 violations |
| B | 398 / 398 | 100 + 66 | 1.5 s | 87.3 | 77.7 | 299 / 587 / 782 | 124 ms, 11.3 %, 96.0 % | 0 | 0 / 18 939 |
| C | 600 / 600 | 150 + 100 | 1.5 s | 98.4 | 80.4 | 722 / 1085 / 1423 | 260 ms, 4.3 %, 44.4 % | 0 | 0 / 20 504 |
| D contention (no think, 5 % reconnects) | 160 / 160 | 20 + 40 | 0 | 136.5 | 78.3 | 451 / 541 / 891 | 159 ms, 0.3 %, 99.1 % | 0 | 0 / 18 389 |

Server command time excludes network (measured inside the API around the command path; histogram buckets, so the
p95 is stated as "share ≤ 250 ms"). In all profiles: 0 stalled games, every duplicate resend returned the identical
receipt, 0 module failures, 0 overdue deadlines after the run; `STALE_REVISION` rejections are expected protocol
outcomes in simultaneous bidding (A: 1.7 %, D: 70 % of commands by construction).

**Reading**: the target "p95 server time < 250 ms" holds in A and D, marginally in B (96 %), and fails in C. The
single API process is the bottleneck (≈ 96 % of one core at saturation, PostgreSQL ≈ 1 core): ≈ 80 accepted moves/s
ceiling. **Safe limited-release bound: ≤ 150 concurrent live players (≈ 45 moves/s, ≤ 200 sockets) per API
instance.** This is not a production capacity claim; repeat on target hardware.

**Defects found by load testing and fixed in this phase**
1. Missed-push race: `table.subscribe` read the snapshot before joining the room; a move committed in between was
   never pushed → client stuck on an old turn. Now join-then-read.
2. Per-subscriber full snapshot rebuild on every change (≈ 7 queries × subscribers): replaced by one shared,
   parallel read per change + per-viewer projection and access check (throughput 72 → ~80 moves/s at saturation,
   with lower latency below saturation).

## Backup and restore (NFR-02, NFR-08)

`docker/backup-drill.sh` against the production-shape stack (age-encrypted WAL archive, `archive_timeout=60s`;
throwaway drill key kept outside the repository, never printed). Log: `docs/evidence/phase-04/backup-restore-drill.log`
(final run with hardened scripts; the first run's log has one garbled echo line but the same outcome).

| Step | Final run |
|---|---|
| Encrypted base backup | 2.3 s, file header `age-encryption.org/v1` |
| Disaster | `SIGKILL` of the primary during writes |
| Restore | new volume, archive read-only, private identity mounted only in the restore container |
| Data final before snapshot point | **identical** fingerprints: 149 857 receipts, 11 334 finished tables + pinned versions, 11 334 results, 61 722 reward-ledger rows |
| RPO | **32.1 s** (first run 34.3 s) — target ≤ 15 min |
| RTO database promoted | 3.1 s; **application serving 19.5 s** (first run 16.6 s) — target ≤ 4 h |
| Deadlines due during the outage | 6/6 live tables finished by timeout by the resumed worker; 0 overdue afterwards |
| Outbox | resumed (backlog sampled at 6 = events emitted by those timeouts, then drained) |
| Duplicate rewards | 0 duplicate `source_key` |
| Pinned versions | 0 tables with a missing version; gameplay continued on the restored DB (588 accepted moves, 0 errors) |
| Redis | not used by this system |

Limits: laptop-local archive (no off-host copy), small database, decision time not included. Production RPO/RTO
must be re-measured on the target with off-host storage — release blocker.

## Security review (item 1)

Checked in code/tests: session cookie (HttpOnly, SameSite=Lax, `__Host-` + Secure in production), CSRF by Origin
allow-list, Socket.IO origin + session check before connect, per-viewer projections (load + E2E hidden checks),
RBAC on every admin/moderator route (403 tests), log redaction (cookies, auth headers, mobiles, OTP), rate limits
(per user / per IP), zod schemas at every boundary, chat content escaped by React (no `dangerouslySetInnerHTML`),
fixture OTP / fake gateway refused in production, seed contains no accounts. One independent read-only review was
run; its findings fixed in this phase: backup scripts lacked `pipefail` (a truncated backup could be accepted),
metrics endpoint reachable via the proxy and compared non-constant-time, `trustProxy: true` allowed
`X-Forwarded-For` spoofing of per-IP limits, a partial restore could be booted, failed shared reads dropped pushes
silently. Remaining soft spot: `style-src 'unsafe-inline'`.
