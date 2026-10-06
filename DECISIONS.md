# Recorded implementation decisions

Execution defaults are in IMPLEMENTATION_DECISIONS.md. Exact dependency versions, rating algorithm, provider selection and operational capacity are to be recorded with evidence during implementation. Product name, real launch games, commercial prices and final limits remain open.

## DRAGON-00 (2026-10-06)

### Stack (exact versions, checked against npm registry peer ranges on 2026-10-06)

| Area | Choice | Reason |
|---|---|---|
| Runtime | Node.js 24 (tested 24.13.1, engines ≥ 24.11) | LTS; native TypeScript type stripping lets API/worker/scripts run `.ts` without a build tool |
| Package manager | pnpm 11.5.2, `allowBuilds: esbuild` | pnpm 11 blocks unapproved install scripts; esbuild (via drizzle-kit/vite) needs its binary check |
| Language | TypeScript 6.0.3, strict, `erasableSyntaxOnly` | TS 7.0.2 is latest but typescript-eslint 8.71 supports `<6.1.0` only |
| Lint | ESLint 10.12.0, typescript-eslint 8.71.0, react-hooks 7.1.1 | 8.71.1 and @vitejs/plugin-react 6.1.2 were < 24 h old and rejected by pnpm's `minimumReleaseAge` supply-chain policy; pinned previous releases instead of relaxing the policy |
| Web | React 19.3.0, react-dom 19.3.0, react-router 8.4.0, Vite 8.3.2, @vitejs/plugin-react 6.1.1 | IMPLEMENTATION_DECISIONS default; react-router 8 needs React ≥ 19.2.7 |
| API | Fastify 5.12.5, @fastify/cookie 11.1.2, @fastify/rate-limit 11.2.0, @fastify/swagger 9.9.1, fastify-type-provider-zod 7.0.0, zod 4.6.5 | one zod schema drives validation, serialization and OpenAPI |
| Realtime | socket.io / socket.io-client 4.8.4 | PRD |
| Data | PostgreSQL 18.6 (postgres:18.6-alpine), drizzle-orm 0.45.3, drizzle-kit 0.31.11, postgres.js 3.4.9 | typed SQL + generated, committed SQL migrations |
| Tests | Vitest 5.0.3, @playwright/test 1.63.0 (Chromium) | |
| Font | @fontsource/vazirmatn 5.3.0 (local files) | design doc; no CDN |

Not added on purpose: data-fetching library (a 40-line `useApi` hook covers phase 00), date library (native
`Intl` Persian calendar), dotenv (`node --env-file-if-exists`), Redis, separate API bundler.

### Product/engineering decisions

- **Workspace layout** follows IMPLEMENTATION_DECISIONS except `packages/game-engine`, which is created in DRAGON-01
  together with the command service (nothing to put in it yet). `packages/db` was added so API and worker share one
  schema/migration source.
- **Game metadata** (Persian names, rules summary, policies) lives in each game package next to its manifest and is
  seeded from the reviewed registry `packages/db/src/registry.ts`. Seed sets `status=active` only on first insert,
  so an admin suspension survives re-seeding.
- **Game cover art** lives in `games/*/src/cover.tsx` (renderer side), not in `packages/ui`, so the shared UI stays
  game-agnostic.
- **OTP**: 6-digit code, 120 s TTL, 5 attempts per challenge, 60 s resend delay, 5 codes/hour/mobile,
  10 requests/10 min/IP (configurable `OTP_REQUESTS_PER_IP_PER_10_MIN`). Code stored as HMAC-SHA256 keyed by
  `OTP_HASH_SECRET` and bound to the challenge id. Values are tunable defaults, not tested policy.
- **OTP provider**: only the development `fixture` adapter exists; it sends nothing and accepts `OTP_FIXTURE_CODE`.
  Production config refuses it → **blocker: choose an SMS provider and implement its `OtpDelivery` adapter**.
- **Sessions**: 30-day opaque cookie sessions stored hashed in PostgreSQL (revocable), not JWT.
- **Mobile privacy**: mobile only in `user_private`/`otp_challenges`; owner sees a masked number; public profile is an
  explicit allow-list. OTP challenges purged after 1 day by the worker.
- **Avatars**: six preset icons; uploads wait for the object-storage adapter.
- **CSRF**: Origin/Referer allow-list on all non-GET requests + SameSite=Lax + JSON bodies; no token header.
- **Roles**: global `admin` and `moderator` in `user_roles`; admin implies moderator. Group/club manager is a scoped
  membership role (phase 02). Roles are granted by the operator CLI (audited), not by any HTTP endpoint yet.
- **Display preferences** (theme, reduced motion, mute) are per device in localStorage; mute is honoured by game
  sounds once they exist (phase 01).
- **Dates**: stored `timestamptz` UTC; displayed Jalali in `Asia/Tehran`.
- **Ports**: PostgreSQL defaults to 5434 because 5433/5432 are commonly taken on developer machines.

## DRAGON-01 (2026-10-06)

- **Packages**: `packages/game-engine` (pure engine, registry, RNG, replay) and `packages/play` (authoritative
  runtime shared by API and worker). The worker imports `play` instead of calling the API.
- **RNG**: mulberry32, 32-bit state persisted per snapshot (`game_snapshots.rng`), seed from `crypto.randomInt` at
  start and recorded only in internal `game_events`. Not cryptographic; adequate for these rules, revisit for games
  where prediction would matter.
- **Logical time**: server `Date.now()` captured once per command and recorded with the input for replay; rules
  never read the clock.
- **One deadline key** (`turn`) per table plus an optional `reminder`; per-table `turnSeconds` options
  live 15/30/60/120/300 s, turn-based 12/24/48/72 h; reminder at ¼ of the turn before the deadline (max 6 h).
  Values are tunable defaults.
- **Turn-based concurrency limit** `TURN_TABLE_LIMIT` default 10; one open/active live table per user
  (also the FR-06 rule). Tutorial tables are excluded.
- **Ranked tables are refused** (`RANKED_NOT_AVAILABLE`) until the rating service exists (DRAGON-03); premium
  games refuse table creation (`PREMIUM_REQUIRED`) until entitlements exist. Both test games are free.
- **Tutorials** are server-side tables: private, friendly, untimed, seat 1 is a fixed script (`participants.kind =
  'script'`, no user). Completion is decided by the server (game result), not by a client claim. Replay and skip
  never erase a completion.
- **sealed-bids resignation** follows docs/GAME_MODULES.md literally: the resigned seat keeps auto-bidding its lowest
  token and keeps any points; placement is still by score.
- **Realtime fan-out** uses PostgreSQL `LISTEN/NOTIFY` (`table_changed`, `notification_created`): pushes happen only
  after commit and work for changes made by the worker. Single API instance assumed (multi-instance needs sticky
  sessions for Socket.IO polling).
- **Commands from the web client use HTTP**; the Socket.IO command path is implemented and tested for parity.
- **Rate limiting** keyed by signed-in user (IP for anonymous) so players behind carrier NAT do not throttle each
  other. Found when E2E clients shared one IP.
- **Outbox**: one processed flag per event; topics without a consumer stay queued (`tutorial.completed` waits for
  DRAGON-03). Rating/rewards can also read `game_results` directly.
- **Analytics**: no analytics pipeline exists in this delivery; the only export of game data is the outbox, whose
  payloads are tested to contain no hidden values.
- **Migration 0001** adds NOT NULL columns to tables that are empty in every environment so far (pre-release);
  a populated database would need defaults/backfill.
- **Admin UI** for incidents and version rollout is not built; the audited API endpoints exist (UI in DRAGON-04).

## DRAGON-02 (2026-10-06)

- **Matchmaking baseline**: rating 1500 for everyone until ratings exist; window 100 → +50 per step → cap 400;
  ready window 30 s / 15 min; queue TTL 15 min / 24 h (`defaultMatchConfig`). Friendly only.
- **One active ticket per player** enforced by a partial unique index; queued live tickets and live tables exclude
  each other. Decline re-queues everyone else; ready timeout re-queues only those who accepted.
- **Tickets get a `started` status** (migration 0003) so the one-active-ticket slot frees when the game starts.
- **DM policy** options are "friends" (default) and "nobody"; there is no "everyone" option in this delivery.
- **Table invitations** only to friends or members of a shared active group/club; invited users can open and join a
  private lobby without the link (`table_invites`).
- **Spectators cannot read table chat** (participants only), keeping chat out of spectator feeds.
- **Only DMs create message notifications**; group/club/table chat is visible in place to avoid noise.
- **Moderation**: report-scoped evidence; appeals decided by another moderator; sanctions are `suspended`,
  `chat_restricted` or `warning`; suspended users keep access to sanctions/appeals/reports only.
- **Behaviour signals** are information only (no automatic penalty).
- **Worker health port** (`WORKER_HEALTH_PORT`) added so orchestrators and E2E runs can supervise the worker.
- **Timestamp precision**: JS Dates are millisecond-precise while PostgreSQL stores microseconds; queries comparing
  against a row's own timestamp exclude it by id (found in moderation evidence). The chat `before` cursor shares the
  limitation; two messages within the same millisecond at a page boundary could be skipped.
- **Bundle size**: the web bundle now exceeds Vite's 500 kB warning; route-level code splitting is scheduled for 04.

## DRAGON-03 (2026-10-06)

- **Rating**: Weng–Lin Bradley–Terry full pairing, own ~50-line implementation (no dependency); parameters in
  docs/PROGRESSION.md. Public rating = 60·mu; certainty gates (provisional < 5 games; leaderboard ≥10 games and
  sigma ≤ 6). The conservative mu − 3σ display was rejected after simulation showed volume-driven inflation.
- **Simulation model fix**: outcomes are drawn with Gumbel (logistic) noise to match Bradley–Terry; Gaussian noise
  had mis-scaled the "true" skills.
- **Ranked only via matchmaking**; hand-made tables are always friendly (collusion resistance).
- **Seasons platform-wide** (one active); freeze enforced by a database trigger with an audited correction path.
- **XP values, caps and mission targets** are version-1 tunable defaults, not tested commercial policy.
- **Outbox**: multiple idempotent consumers per topic; rating + rewards run in one transaction per event.
- **Payments**: `PaymentGateway` boundary; development-only fake gateway with a labelled in-app "bank" page; production
  default `PAYMENT_PROVIDER=none` (checkout disabled with a reason). Plans seeded inactive with null price.
  `PUBLIC_WEB_URL` added after E2E showed redirects landing on a different host than the session cookie.
- **Premium access**: per-game access + host-invites-free policy, start-time eligibility snapshot, higher (finite)
  turn-based cap; premium never touches rating, queue order or gameplay.
- **Currency** stored as integer Rial (`IRR`); the UI shows «ریال». Toman display is a product decision.

### Open items noticed (need user decision)

- The baseline `.gitignore` (from the packaging step) ignores `**/*.test.ts`, `**/*.spec.ts`, `/e2e/`,
  `/playwright.config.ts`, `/eslint.config.mjs`, `/compose.dev.yaml`, `CLAUDE.md`, `Requirements.md` and all status
  files. As a result tests, lint config and status/traceability docs would not be committed, and CI on a fresh
  clone cannot lint or test. The file was left unchanged pending the user's decision.

## DRAGON-04 (2026-10-06)

- **Images**: one multi-stage `docker/Dockerfile` with targets `api`, `worker`, `migrate`, `web`; Node runs the
  TypeScript sources by type stripping (no build step), so the workspace layout is kept in the image (workspace
  packages resolve to real paths outside `node_modules`). Runtime files root-owned, read-only root FS, uid 1000.
- **Reverse proxy = Caddy** serving the SPA and proxying `/api` (incl. WebSocket); one image works behind a TLS
  proxy (`SITE_ADDRESS=:8080`) or terminating TLS itself. Source maps are not shipped. `/api/metrics` is not routed.
- **CSP** forbids inline scripts (the theme bootstrap moved to `public/theme-init.js`); inline *styles* stay allowed
  because components use React `style` attributes.
- **Proxy trust by hop count** (`TRUST_PROXY_HOPS`, default 1) instead of `trustProxy: true`, so a client-supplied
  `X-Forwarded-For` cannot defeat per-IP OTP limits (found by the independent review).
- **Empty env values are unset**: Compose/Coolify pass `${X:-}` as `""`; config validation now ignores empty strings.
- **Metrics without a dependency**: hand-written Prometheus text (`apps/api/src/metrics.ts`); token compared in
  constant time; aggregate values only.
- **Backups**: WAL archiving + base backups encrypted with `age` in public-key mode (the DB host cannot decrypt);
  scripts use `pipefail`, temp-file + rename, and a restore completion marker (review findings). Off-host sync is
  an owner/infrastructure decision and remains a blocker.
- **Realtime performance fix**: subscribers of a table now share one viewer-independent read per change and each
  gets its own projection + access check (was: full snapshot per subscriber); independent reads run in parallel.
- **Missed-push race fixed**: `table.subscribe` joins the room before reading the snapshot; previously a change
  committed between read and join was never pushed (found by the load test: clients stuck on an old turn).
- **Load-test bots act like the UI**: the revision is taken at "click" time, not before thinking; earlier counts
  that classified rejected receipts as accepted were discarded and re-run.
- **Capacity statement** is the measured single-process bound on the test laptop (≤ 150 concurrent live players),
  not a production capacity claim.
- **axe-core**: `@axe-core/playwright@4.13.0` pinned (stable, outside the release-age window).
- **Cover art accessibility**: covers with an empty title are decorative (`aria-hidden`) because the surrounding
  link already carries the game name (axe `svg-img-alt`).

## After DRAGON-04: admin-controlled game settings (2026-10-07, owner request)

- **Owner request**: game choices (modes, time per move, player count, rule variants) must be adjustable in the admin
  panel. Implemented as "module declares the possible, admin chooses the offered": manifest `options` (replacing the
  unused `optionSchema`) + `games.play_settings` (migration 0005, additive) + `PUT /api/admin/games/:id/settings`.
- Validation lives in `@bg/play/game-settings.ts`; stored choices are clamped to the active module at read time.
- **Seed bug fixed**: re-seeding overwrote admin-owned `access`, modes and player range with code defaults on every
  deploy. Admin-owned fields are now written only on first insert (and narrowed to module support afterwards).
- Line Three gained variant `firstMove` (random | host). Default `random` draws the same RNG value as before, so
  existing tables and replays are unchanged; rulesVersion stays 1.0.0 (additive, default-preserving change).
- Chosen variants are stored per table, shown in the lobby and recorded with the engine start input.

## Working agreement (owner, 2026-10-07)

- **Commit at the end of every successfully completed request**, after the relevant checks pass, on the current
  working branch. Nothing is pushed or merged unless the owner asks.
