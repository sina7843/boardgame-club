# Implementation status

## DRAGON-04 — release candidate: LOCAL CANDIDATE COMPLETE; public release NOT READY

### Checklist

1. Audit — ✅ FR-01..16 / NFR-01..08 re-audited (REQUIREMENTS_TRACEABILITY.md); auth/cookie/CSRF/socket origin, RBAC,
   hidden information, log/metric redaction, XSS, rate limits, schemas, fixture exclusion checked
   (docs/QA_REPORT.md#security-review-item-1). Gaps closed: admin missions, subscriptions view, audit filters,
   proxy-trust hop count, metrics hardening, CSP-compatible theme bootstrap.
2. Admin/screens — ✅ games/versions/tutorials, access, plans, seasons, missions, support (XP, premium, subscriptions,
   payments), incidents, moderation + audit filters; route code-splitting; axe 0 violations on 21 pages × 4 widths;
   92 screenshots; keyboard smoke. Safari iOS / Chrome Android: **UNVERIFIED** (no devices).
3. Production — ✅ multi-stage non-root images (api/worker/migrate/web + postgres), Caddy HTTPS/WebSocket proxy with
   security headers, internal DB network, secrets from environment, config validation (fail closed), graceful
   shutdown (API + worker drain), readiness, migrate/seed one-shot, release procedure, Coolify guide (not executed).
4. Observability — ✅ `/api/metrics` (server move latency excl. network, commands by outcome, stale errors, module
   failures, sockets, tables, moves/min, outbox/deadline backlog, payments, process resources) + worker metrics;
   SLO 99.5 % definition, maintenance and incident rules (docs/OPERATIONS.md) — not claimed achieved.
5. Load — ✅ 4 profiles, both games, hidden + public state, concurrency, reconnects, duplicates, worker restart;
   two defects found and fixed (missed-push race on subscribe; per-subscriber snapshot rebuild). Safe bound
   ≤ 150 concurrent live players per API instance (docs/QA_REPORT.md#load).
6. Backup — ✅ age-encrypted WAL archive + base backups; isolated drill twice: identical data, RPO 32 s, RTO 19.5 s,
   deadline/outbox resume, pinned versions, 0 duplicate rewards; Redis not used. Target-environment drill: BLOCKED.
7. Final verification — ✅ lint, typecheck, build, 134 tests, migrations from scratch, E2E 46 passed / 4 skipped;
   one independent read-only review (findings fixed, see DECISIONS.md).
8. Docs — ✅ OPERATIONS, DEPLOYMENT, RELEASE_CHECKLIST, QA_REPORT, KNOWN_LIMITATIONS, MIGRATIONS; API, UI_INVENTORY,
   ADDING_A_GAME updated; openapi.json regenerated (103 paths).

### Verification actually run

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | clean / 0 errors / OK |
| `pnpm test` | **134 passed** (contracts 13, web 8, engine 17, play 7, api 88, worker 1) |
| `npx playwright test` | final run **46 passed, 4 skipped**; earlier runs: one 3-player flake (diagnosed: test ignored a legitimate STALE rejection; fixed, 12/12 repeats), one social-flow timeout (passed 2/2 isolated + 2 later full runs; not diagnosed) |
| `docker compose -f compose.prod.yaml build/up` (throwaway env) | all healthy; proxy/header/CSRF/WebSocket/metrics/non-root/read-only checks (DEPLOYMENT.md) |
| `node apps/api/load/loadtest.ts` × 4 profiles | `docs/evidence/phase-04/load/*.json` |
| `docker/backup-drill.sh` × 2 | `docs/evidence/phase-04/backup-restore-drill*.log` |
| `docker/postgres/selftest-failures.sh` | PASS |

### Blockers (public release)

Real SMS provider; real payment gateway + credentials + approved prices; hosting/domain; off-host encrypted backup
storage + key custody + target restore drill; real-device tests (Safari iOS, Chrome Android); load test on target
hardware; owner approval of catalog/branding. See docs/KNOWN_LIMITATIONS.md and docs/RELEASE_CHECKLIST.md (Gate B).

## DRAGON-03 — ranking, progression and premium: COMPLETE (implementation); production provider NOT ready

### Checklist

1. Rating — ✅ uncertainty-aware multiplayer model with ties (Weng–Lin BT), simulation for 2–4 players, new account,
   repeated opponent, resignation/timeout, ties (`docs/evidence/phase-03/rating-simulation.md`); per game and pace;
   provisional and leaderboard eligibility configurable; result → history exactly once; only ranked matchmade tables
   are rated; ranked queue by skill, never premium priority.
2. Seasons — ✅ configurable seasons, league placement after min games, leaderboard eligibility, freeze on close
   (DB trigger) with audited correction; bronze…master display; ranking/league/stats pages; core history free,
   trends premium.
3. XP etc. — ✅ XP/account level, per-game mastery, weekly missions, achievements from server events only;
   versioned ledger with unique source keys; daily cap, repeated-opponent policy, manual reward with reason;
   cancelled results award nothing; rewards shown after games only; cosmetics only.
4. Payments — ✅ plans, monthly/yearly, history, entitlements, checkout/status, gateway adapter boundary with
   server verification; order/user/amount/currency/reference binding; idempotent callbacks; failed/pending/delayed/
   expired; reconciliation and user re-check; fake gateway development-only and labelled; production disabled
   without provider (blocker recorded); no auto-renewal.
5. Access — ✅ per-game premium, host-invites-free, turn-based caps; checks on create/join/start with start
   snapshot; expiry mid-game never ends a session; admin controls and audits.

### Verification actually run

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm check` | lint/typecheck/build OK; tests: contracts 13, web 8, engine 17, play 7, api 85, worker 1 → **131 passed** |
| `npx playwright test` | **30 passed** (incl. ranked result → rewards/progress/ranking and dev checkout at 360 and 1440) |
| `pnpm --filter @bg/play simulate` | `docs/evidence/phase-03/rating-simulation.md` |
| migration 0004 (incl. freeze trigger) | applied to dev DB |

Integration coverage (`progression.test.ts`, `billing.test.ts`): manual ranked refused; ranked result once under
double redelivery; reordered events; friendly never rated; shared placement equal updates; season placement,
freeze rejected by DB, audited correction, closed-season board, single season badge; leaderboard eligibility;
XP/missions/achievements/mastery; tutorial XP once; repeated-opponent and daily-cap reasons; cancelled table no XP;
client claim endpoints 404; manual reward audited; unpriced plan not purchasable; production refuses fake gateway;
pending then verified with triple callback → one subscription; forged/wrong-provider/declined/amount-mismatch/
duplicate-reference never activate; failed stays failed; delayed → reconciliation; expiry; renewal extends;
expiry job; premium host + invited free friend; public join refused; eligibility snapshot; revocation mid-game
doesn't stop play; host expired before start refused; caps; queue order unaffected by premium; trends premium.

Bugs found and fixed: volume-inflated display rating (design change), simulator noise mismatch, payment redirects
to a different host than the session (`PUBLIC_WEB_URL`).

### Blockers / limitations

- **Payment provider**: none selected; no credentials; prices not approved → production checkout disabled.
  No real money tested. See docs/PAYMENTS.md checklist.
- **OTP SMS provider**: still missing.
- Rating parameters and reward values are untuned defaults; revisit with real data.
- Two results of the same player processed out of order are applied in arrival order.

### Resume point

DRAGON-03 complete. Next: DRAGON-04.

---


## DRAGON-02 — matchmaking and social experience: COMPLETE (2026-10-06)

### Checklist

1. Matchmaking — ✅ persistent tickets by game/pace/player count/time; cancel; expanding window with cap; documented
   baseline rating; transactional matching (advisory lock + SKIP LOCKED), one active ticket per player, ready
   acceptance with deadline, decline/timeout re-queue, expiry; game and suspension re-checked at start.
2. Social — ✅ friends request/accept/remove, block, mute, user search, DMs friends-only by default (+ "nobody"),
   table chat, group/club chat, table invitations (friend/community/group); permissions enforced on REST, socket
   pushes, notifications and invitations; block prevents all new contact; groups (private, quick invites); clubs
   (public page, owner/managers, open/request/invite, scoped chat moderation); messages persisted, sanitized,
   paginated.
3. Notifications — ✅ turn/reminder/invite/match/message/result/friend/club; persisted read state; per-kind
   preferences; opt-in browser notifications from a user gesture; no hidden state or message text in payloads;
   dedupe keys make redelivery a no-op; invite notification leads to the authorized private lobby.
4. Moderation — ✅ reports (user/display name/message/table) with reason and evidence reference; moderator role
   checks; report-scoped evidence; audit history; appeals decided by another moderator; suspension and chat
   restriction enforced server-side (HTTP, socket, table start); admin controls for game status, tutorial,
   versions and incidents; history preserved; behaviour signals without automatic penalty.
5. Pages — ✅ quick match, friends, profile, messages, groups, clubs, support, moderation, admin, more; table chat
   drawer and invitations; loading/empty/error/denied/offline states; responsive (single-pane messages on mobile,
   bottom bar + «بیشتر»). No licensing/publisher workflows.

### Verification actually run (Windows 11, Node 24.13.1, PostgreSQL 18.6 in Docker)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK / 0 problems / OK / OK (chunk-size warning) |
| `pnpm test` | contracts 13, web 8, engine 17, api 67, worker 1 → **106 passed** |
| `npx playwright test` (API + web + worker started by Playwright) | **26 passed** (incl. 4 social flows × 360 and 1440) |
| migrations 0002_social_moderation, 0003_ticket_started on dev DB | applied |

New integration coverage (`apps/api/test/matchmaking.test.ts`, `social.test.ts`): window growth/cap; match → accept
→ start; ALREADY_QUEUED and live-table exclusion; 8 concurrent enqueues + 3 concurrent matcher runs → 4 tables, no
double assignment; cancel racing the matcher ×4; decline re-queues with original time; ready timeout re-queue +
no-show signal; suspended game at start; ticket expiry; friends/DM policy (friends-only, nobody, after removal);
block stops request/DM/invite/join and is not revealed; sanitization (control/bidi chars), pagination, socket push
only to members, mute hiding; DM notification idempotency under duplicate outbox delivery, preference off, no text in
payload; invite notification → authorized lobby → join; private-table socket subscription denied; table chat
participants only; group invites/accept/chat/quick table invite; club policies (open/request/invite), owner-only
roles, manager edits, member denied, scoped message removal audited; report → evidence → suspension enforced on
HTTP and socket → appeal → second moderator revokes; chat restriction; timeout behaviour signal without sanction.

E2E (`e2e/social.spec.ts`): guest discovery → sign-in → tutorial → queue → accept → line-three and sealed-bids to
the result; friend search/request/accept → private table → invitation notification → lobby join → live lobby chat →
DM → block stops messages; club creation (request policy) → approval → club chat → report → moderator suspension →
appeal → different moderator revokes; page inventory + keyboard smoke. Evidence: `docs/evidence/phase-02/`.

Bugs found by these tests and fixed: moderation evidence repeated the reported message (ms vs µs timestamps); sealed
bids history table overlapped the token buttons at 360 px; finished sealed-bids still showed «در انتظار».

### Blockers / limitations

- OTP: development fixture only (no SMS provider).
- Matchmaking uses the 1500 baseline until DRAGON-03 ratings; ranked queues are not offered.
- Chat `before` cursor can skip messages that share a millisecond at a page boundary (documented).
- Web bundle above 500 kB; code splitting planned for 04.
- Real devices (Safari iOS, Android Chrome) still untested.

### Resume point

DRAGON-02 complete. Next: DRAGON-03.

---


## DRAGON-01 — engine and reliable play: COMPLETE (2026-10-06)

### Checklist

1. Engine/SDK — ✅ `GameModule` contract with runtime action schemas, tutorial script and `BotAdapter` (contract only);
   `packages/game-engine`: reviewed registry keyed by gameId@rulesVersion, persisted seeded RNG, logical time,
   authorized projection/legal actions, deterministic replay; independent of HTTP/DB/commerce. Both games implemented
   per docs/GAME_MODULES.md with Persian interactive tutorials.
2. Tables — ✅ create (private + friendly default; ranked/premium refused honestly), public/private invite, join,
   leave, ready → atomic start, capacity/access/time/mode validation, live-table and turn-based limits, immutable
   settings, policies shown before ready, participant authorization on HTTP and Socket.IO.
3. Command service — ✅ single `executeCommand` for both transports: table row lock, receipt uniqueness, changed payload
   refused, exact duplicate returns the original receipt before revision checks, `STALE_REVISION` + permitted
   snapshot, invalid actions never mutate, atomic snapshot/revision/receipt/internal events/deadlines/outbox/result,
   pushes only per-viewer projections after commit.
4. Worker — ✅ deadlines (table-lock-first, token + expectedRevision, stale cancelled, frozen during incidents),
   leased outbox with backoff and idempotent consumers, canonical result once (`game_results` unique), sealed bids
   revealed only when complete.
5. Reconnect & time — ✅ snapshot on (re)subscribe, receipt lookup, «در انتظار تأیید», no automatic resubmit after
   stale, spectator projection, private access control, server-deadline countdown with skew correction, «نوبت من»,
   reminders, platform incident pause + time compensation distinct from personal disconnect.
6. Screens — ✅ create table, open tables, lobby, live/turn table, tutorial, result, dashboard «نوبت من» +
   notifications; both renderers keyboard-operable at desktop/mobile with hand/action bar; version-pinned renderer
   registry; suspended game stops new tables only. Chat: next phase (no placeholder controls).

### Verification actually run (Windows 11, Node 24.13.1, PostgreSQL 18.6 in Docker)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK / 0 problems / 12 packages / OK |
| `pnpm test` | contracts 13, web 8, engine 17, api 48, worker 1 → **87 passed** |
| `npx playwright test` | **18 passed** (5 play flows × 360 and 1440 + phase-00 shell at 4 widths) |
| `pnpm db:migrate` (0001_engine_play) on dev DB | applied |
| worker process smoke run (8 s, dev DB) | started; fired 1 due deadline; drained 103 outbox events; 0 failures |

Engine tests: setup/RNG determinism, illegal moves (wrong actor, occupied, bad schema, engine actor, after finish),
wins on rows/columns/diagonals, draw, timeout, resign, projection equality/redaction, simultaneous concealment and
atomic reveal, tie scoring, stable-seat-order timeout auto-commit, resignation policy incl. all resigned, replay,
both tutorial scripts.
Integration (`apps/api/test/tables.test.ts`, `play-integrity.test.ts`): creation validation, private/invite access,
start conditions, spectator projection, duplicate/changed-payload/stale/invalid/outsider/client-actor commands,
parallel commands (one accepted), receipt lookup before/after commit, restart with a new app instance, timeout race
x4, stale deadline, sealed-bids deadline carry-over + timeout, socket + HTTP + logs + outbox hidden-bid checks,
socket actor spoof rejected, outbox lease expiry + duplicate redelivery, version rollout/rollback/pinning + missing
registry version + suspension, tutorial guidance/completion/resume/replay/skip, incident freeze + compensation.

Evidence: `docs/evidence/phase-01/` (screenshots at 360 and 1440).

### Blockers / limitations

- OTP still development fixture only (no SMS provider) — carried from phase 00.
- Admin UI for incidents and version rollout not built (audited API only).
- Socket.IO fan-out assumes one API instance (sticky sessions needed for more).
- No analytics pipeline exists; hidden-state checks cover HTTP, sockets, logs and outbox.
- Real devices (Safari iOS, Android Chrome) still untested; Playwright Chromium emulation only.
- Concurrency/timeout tests ran against a local PostgreSQL; no load test yet (NFR-03/04 in phase 04).
- `node tools/validate-package.mjs` now fails by design of its regex `/^- [ [ x] ] DRAGON-00$/`, which only matches the unchecked line (verified: `- [x] DRAGON-00` → false). It is a protected package-preparation check; `04-COPY-NEXT-PROMPT` parses the status correctly and selects DRAGON-02.

### Resume point

DRAGON-01 complete. Next: DRAGON-02.

---


## DRAGON-00 — foundation, design and identity: COMPLETE (2026-10-06)

### Checklist

1. Stack & workspace — ✅ versions recorded in DECISIONS.md; pnpm workspace (apps/api, apps/web, apps/worker,
   packages/contracts, db, ui, game-sdk, games/line-three, games/sealed-bids); TS strict; committed lockfile;
   lint/typecheck/build/test scripts; CI skeleton `.github/workflows/ci.yml` (not yet run on GitHub);
   migrations + idempotent seed; zod config validation (fails closed in production); dependency boundaries
   documented in docs/ARCHITECTURE.md. No native app scaffolding.
2. Schema & identity — ✅ migration `0000_foundation.sql` (42 tables, all PRD domains, CHECK/unique constraints);
   OTP delivery interface + dev fixture + production refusal; hashed single-use challenges with expiry, attempt
   limit, resend delay, hourly per-mobile and per-IP limits; cookie sessions + logout/revocation; server RBAC
   (admin/moderator) with audited admin action; public profile redaction; mobile never returned publicly.
3. Contracts & platform — ✅ zod REST schemas → OpenAPI 3.0.3 (`/api/openapi.json`, `docs/openapi.json`);
   socket event names/payloads + strict command envelope (no actorId); `{errorCode, messageFa, requestId}` errors;
   Origin-based CSRF for HTTP and Socket.IO; log redaction; `/api/health/live|ready`; socket actor pinned from
   the session cookie.
4. UI — ✅ tokens, components, showcase (`/design`); route shell with right desktop nav / bottom mobile nav;
   login, dashboard, catalog, game detail, settings, admin game status, 404 with loading/empty/error/denied/offline
   states; two seeded test games labelled «بازی آزمایشی»; Persian search with ی/ي and ک/ك normalization;
   filters players/time/difficulty/mode/access; theme, mute, reduced motion; Jalali display.
5. Dev environment — ✅ docs/DEVELOPMENT.md, `.env.example` (local-only placeholders), `compose.yaml`
   (PostgreSQL 18.6, localhost-only, test DB init), pnpm scripts usable from Linux and Windows shells; existing
   Windows `.cmd` wrappers untouched.

### Verification actually run (Windows 11, Node 24.13.1, pnpm 11.5.2, Docker 29.6.2)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK (after clean `pnpm clean` + fresh resolution; supply-chain policy passes) |
| `pnpm lint` | 0 problems |
| `pnpm typecheck` | 9 packages OK |
| `pnpm build` | web bundle OK (index ≈ 457 kB / 140 kB gzip) |
| `pnpm db:migrate` + `pnpm db:seed` ×2 (dev DB, PostgreSQL 18.6) | migrations applied; 42 tables; seed idempotent (2 games, 2 versions) |
| `pnpm test` | contracts 13, web 8, api 30, worker 1 → **52 passed** |
| `npx playwright test` | **8 passed**: login → catalog → search → detail → dashboard → settings → admin denied, and showcase, at 360/768/1440/1920 |
| `node .claude/tests/guardrails.test.mjs`, `node tools/validate-package.mjs` | 7 pass / PASS |

API tests cover: valid login + HttpOnly/SameSite cookie + hash-only storage; reused, expired, invalid and unknown
codes; attempt lockout (correct code rejected after 5 failures); concurrent verification consumes once;
resend delay and hourly limit; per-IP limit; mobile normalization to one account; RBAC 401/403/200 incl.
moderator≠admin; audited suspension hides game and blocks new tables; logout revocation; masked `/me`, public
profile allow-list without mobile; profile validation and mass-assignment rejection; catalog search/filters/
detail; CSRF origin rejection; error envelope; health; OpenAPI; log redaction (mobile, code, session token);
production config refusal; Socket.IO no-session/foreign-origin rejection and server-pinned identity.

Screenshots: `docs/evidence/phase-00/` (32 files).

### Blockers / limitations (honest)

- No real SMS provider: production cannot start until an `OtpDelivery` adapter for a chosen provider exists.
- CI workflow written but never executed on GitHub; and see the `.gitignore` issue in DECISIONS.md (tests/lint
  config currently excluded from git).
- Browser evidence is emulated viewports in Playwright Chromium only; no Safari/iOS or real Android device.
- Rate-limit IP buckets are in-process memory (single API instance assumption).
- Report action for display names (FR-01 "reportable") has schema (`reports.target_type='display_name'`) but no
  endpoint/UI yet — delivered with moderation in DRAGON-02.
- Tables, gameplay, tutorials and matchmaking are not implemented; UI states this and disables «ساخت میز».

### Resume point

DRAGON-00 complete. Next: DRAGON-01.

## Remaining phases — explicit checklist

### DRAGON-01 — engine and reliable play
- [x] all items complete (see DRAGON-01 section above)

### DRAGON-02 — matchmaking and social
- [x] all items complete (see DRAGON-02 section above)

### DRAGON-03 — ranking, progression, premium
- [x] implementation complete (see DRAGON-03 section above); real payment provider remains a blocker

### DRAGON-04 — release QA and operations
- [ ] full device/browser matrix incl. Safari iOS and Android Chrome (NFR-07)
- [ ] load test with stated hardware (NFR-03/04), availability plan (NFR-05), encrypted backup + restore test (NFR-08)
- [ ] production Docker/Compose, reverse proxy (HTTPS + WebSocket), observability, runbooks
