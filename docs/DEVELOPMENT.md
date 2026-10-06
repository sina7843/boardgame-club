# Developer bootstrap

Requirements: Node.js ≥ 24.11 (tested 24.13.1), pnpm 11.5.2 (`corepack enable`), Docker with Compose v2.
Works the same from Linux/macOS shells and Windows (PowerShell, Git Bash); all commands are `pnpm` scripts.

## First run

```sh
pnpm install                 # lockfile is committed; CI uses --frozen-lockfile
cp .env.example .env         # Windows: run 06-CREATE-LOCAL-ENV.cmd
pnpm dev:services            # PostgreSQL 18.6 on 127.0.0.1:5434 (+ boardgame_test database)
pnpm db:migrate              # applies packages/db/migrations
pnpm db:seed                 # idempotent: publishes the two labelled test games
```

Then, in separate terminals:

```sh
pnpm dev:api                 # http://127.0.0.1:3000/api  (OpenAPI: /api/openapi.json)
pnpm dev:web                 # http://127.0.0.1:5173      (proxies /api, incl. WebSocket)
pnpm dev:worker              # turn deadlines, reminders, outbox → notifications, retention (needed for timeouts)
```

Sign in with any Iranian mobile number (`09xxxxxxxxx`). The development OTP provider sends no SMS and
accepts `OTP_FIXTURE_CODE` (default `123456`). The UI says so on the code screen. Production refuses to start
with this provider.

Grant a role to an account that has signed in at least once (writes an audit log entry):

```sh
pnpm --filter @bg/db grant-role 09121234567 admin            # or moderator; add --revoke to remove
```

## Database changes

1. Edit `packages/db/src/schema.ts`.
2. `pnpm db:generate` — writes a new SQL migration into `packages/db/migrations` (review it; it is committed).
3. `pnpm db:migrate`.

Migrations are forward-only SQL files run by the Drizzle migrator (`packages/db/src/migrate.ts`); the API does not
auto-migrate on start.

## Checks

```sh
pnpm lint && pnpm typecheck && pnpm build && pnpm test     # or: pnpm check
pnpm test:e2e                                              # Playwright; needs dev DB migrated + seeded
```

`pnpm test` runs API/worker integration tests against `TEST_DATABASE_URL`
(default `postgres://boardgame:…@127.0.0.1:5434/boardgame_test`) — they migrate it and truncate its tables.
First-time Playwright setup: `npx playwright install chromium`. E2E screenshots land in `docs/evidence/phase-00/`.

## Ports and overrides

| Service | Default | Variable |
|---|---|---|
| PostgreSQL | 127.0.0.1:5434 | `POSTGRES_PORT`, `DATABASE_URL` |
| API | 127.0.0.1:3000 | `API_HOST`, `API_PORT` |
| Web | 127.0.0.1:5173 | `VITE_API_PROXY` (API target) |

Stop services with `docker compose stop`. Removing the data volume (`docker compose down -v`) is destructive and
deliberately not wrapped in a script.
