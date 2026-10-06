# Architecture (DRAGON-00 foundation + DRAGON-01 engine and play)

Modular monolith in one pnpm workspace. Server-authoritative: rules, time, RNG, results, eligibility and
entitlements are decided on the server; clients receive projections only.

```
apps/
  api/        Fastify 5 HTTP API + Socket.IO; domain modules under src/modules/{auth,users,catalog,health}
  web/        React 19 + Vite 8 SPA, Persian RTL shell, react-router 8
  worker/     Background jobs: deadlines (1 s poll), outbox consumers (leased), matchmaking (2 s), retention;
              optional GET /health on WORKER_HEALTH_PORT
packages/
  contracts/  zod schemas shared by API, sockets and web: requests/responses, error codes, socket events, text helpers
  db/         Drizzle schema, SQL migrations, seed, reviewed game registry, operator CLI
  game-sdk/   GameManifest/catalog schema, GameModule contract, tutorial script and BotAdapter contracts
  game-engine/ Pure engine: seeded RNG, registry of reviewed modules by version, apply/timeout/project, replay
  play/       Authoritative table runtime shared by API and worker: tables, command service, deadlines, outbox, views
  ui/         Design tokens + shared React components (no business logic)
games/
  line-three/   definition, rules, tutorial script, cover + renderer (web-only subpaths)
  sealed-bids/  same
```

## Dependency rules

- `games/*` depend only on `@bg/game-sdk` (rules) and React (renderer subpath `./cover`, later `./renderer`).
  The server never imports renderer subpaths.
- `apps/api` business modules (auth, users, catalog) contain no game-specific code. Games enter only through the
  registry in `packages/db/src/registry.ts`, which lists reviewed in-repo modules; no uploaded code runs.
- `packages/ui` knows nothing about games or the API. Game art lives with the game module.
- `contracts` is the only package shared by server and browser besides `game-sdk` enums.

## Runtime

- **Node 24 native TypeScript** (type stripping): API, worker and scripts run `.ts` directly with no build step;
  code is restricted to erasable syntax (`erasableSyntaxOnly`). The web app is bundled by Vite.
- **PostgreSQL 18** is the only durable store. Redis is not used (no operational need yet).
- **Sessions**: random 256-bit token in an HttpOnly, SameSite=Lax cookie (`__Host-` prefix + Secure in production);
  only its SHA-256 is stored. Server resolves `req.auth = { userId, sessionId, roles }` on each request.
- **Actor pinning**: HTTP handlers and Socket.IO handlers read identity only from the session
  (`req.auth`, `socket.data.auth`). The command envelope schema is strict and rejects any `actorId`.
- **CSRF / origin**: every non-GET request must carry an allow-listed `Origin` (or `Referer`); Socket.IO rejects
  foreign origins in `allowRequest` before the handshake. JSON-only bodies, 64 KB limit.
- **Rate limits**: global 300 req/min/IP; OTP request 10 / 10 min / IP, verify 30 / 10 min / IP; per mobile a 60 s
  resend delay and 5 codes per hour (DB-backed, serialized with an advisory lock).
  In-memory IP buckets are per process (move to a shared store before running >1 API replica).
- **Errors**: always `{ errorCode, messageFa, requestId }` (+ `details` for validation); `x-request-id` header;
  stacks only in server logs.
- **Logging**: pino with redaction of cookies, auth headers, bodies, `mobile`, `code`, `token`. Tested.
- **Health**: `/api/health/live` (process) and `/api/health/ready` (DB reachable + schema present).
- **Config**: zod-validated env at startup; production fails closed on the OTP fixture, `local-only` placeholder
  secrets and non-HTTPS origins.

## OTP login flow

1. `POST /api/auth/otp/request` — normalize mobile (Persian digits, +98 forms) → advisory lock per mobile →
   resend/hourly checks → insert challenge with `HMAC-SHA256(secret, challengeId:code)`, 120 s expiry,
   5 attempts → deliver via `OtpDelivery` adapter.
2. `POST /api/auth/otp/verify` — `SELECT … FOR UPDATE` the challenge; reject unknown/consumed/expired/locked;
   constant-time compare; count the attempt; on success mark consumed (single use), find-or-create the user
   (`users` + private `user_private.mobile`), create session, set cookie.
3. `POST /api/auth/logout` — revoke session row, clear cookie.

## Data model

One initial migration (`packages/db/migrations/0000_foundation.sql`, 42 tables) covers every PRD domain:
identity (users, user_private, user_roles, otp_challenges, sessions), social (friendships, blocks, groups, clubs,
memberships, conversations, conversation_members, messages, reports), catalog (games, game_versions, tutorials,
asset_bundles), play (game_tables, participants, matchmaking_tickets, game_snapshots, command_receipts,
game_events, scheduled_deadlines, game_results), progression (ratings, rating_history, seasons,
league_placements, mission/achievement definitions and progress, reward_ledger) and commerce/ops (plans,
subscriptions, entitlements, payments, notifications, outbox_events, audit_log).

Key constraints already in the schema: receipt unique `(table_id, actor_id, command_id)`, result unique
`table_id`, reward unique `(result_id, user_id, rule_id, rule_version)`, rating PK `(user_id, game_id, mode)`,
snapshot PK `(table_id, revision)`, `game_versions` unique `(game_id, rules_version)`; enumerations are CHECK
constraints. Only identity, catalog and audit tables have behaviour in phase 00; the rest are storage contracts
for later phases. Mobile numbers live only in `user_private` and `otp_challenges` (purged after 1 day).

## Ranking, progression and payments

See docs/PROGRESSION.md and docs/PAYMENTS.md. Rating, XP and payment logic live in `packages/play` (shared by
API and worker); rating and rewards are outbox consumers of `table.finished` / `tutorial.completed`; the worker also
reconciles pending payments and expires subscriptions.

## Matchmaking, social and moderation

See docs/SOCIAL_AND_MODERATION.md. Matchmaking lives in `packages/play` (shared by API enqueue and the worker loop);
social, chat, communities and moderation are API modules. All notifications flow through the outbox.

## Engine and play

See docs/ENGINE_PROTOCOL.md (command order, deadlines, outbox, recovery) and docs/ADDING_A_GAME.md.

## Realtime

Socket.IO at `/api/socket.io`: authenticated connection, `user:{id}` room, `session.ready`; `table.subscribe`
(authorized like HTTP, optional invite code for private lobbies), `table.command` (same `executeCommand` as HTTP).
Pushes are triggered by PostgreSQL `LISTEN/NOTIFY` (`table_changed`, `notification_created`), so they happen only
after commit and each socket gets its own projection. Single API instance assumed; multiple instances need every
instance to LISTEN (works as-is) plus sticky sessions for Socket.IO polling.
