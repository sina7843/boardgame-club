# Database migrations

Schema source: `packages/db/src/schema.ts` (Drizzle, `casing: 'snake_case'`). Migrations: `packages/db/migrations/`
(SQL + `meta/` snapshots, applied in `_journal.json` order by `drizzle-orm`'s migrator, tracked in
`drizzle.__drizzle_migrations`).

| File | Phase | Content |
|---|---|---|
| `0000_foundation.sql` | 00 | users, sessions, OTP, roles, audit log, games, game versions |
| `0001_engine_play.sql` | 01 | tables, participants, snapshots, engine inputs/events, receipts, deadlines, outbox, results, incidents |
| `0002_social_moderation.sql` | 02 | friends, blocks, conversations/messages, groups, clubs, reports, sanctions, appeals, notifications, matchmaking |
| `0003_ticket_started.sql` | 02 | matchmaking ticket start marker |
| `0004_progression_commerce.sql` | 03 | ratings, seasons (+ freeze trigger), XP ledger, missions, achievements, plans, payments, subscriptions, entitlements |

## Workflow

```sh
# 1. edit packages/db/src/schema.ts
pnpm db:generate          # drizzle-kit diff → new numbered SQL file (never connects to a database)
# 2. review the SQL by hand; rename the file to describe it; add CHECKs/triggers drizzle cannot express (sql.raw)
pnpm db:migrate           # dev database
pnpm test                 # the API test setup migrates boardgame_test from scratch
```

Production: the `migrate` image runs `migrate.ts` and then the idempotent `seed.ts` (catalog games/versions,
inactive unpriced plans, mission and achievement definitions — **no user or fixture data**) before `api`/`worker`
start (`depends_on: service_completed_successfully`).

## Rules

- **Forward-only and additive in a release**: add tables/columns (nullable or with defaults), add indexes
  (`CREATE INDEX CONCURRENTLY` in a hand-written migration for large tables), add constraints `NOT VALID` then
  validate. The previous release must keep working on the new schema so a rollback is a redeploy, not a restore.
- Removing or renaming a column takes two releases: stop using it → drop it later.
- Never edit an applied migration. Drizzle may ask whether a column was renamed — answer explicitly; the default
  "create + drop" loses data.
- Game state is versioned separately: snapshots carry `rules_version` and `state_schema_version`; a table keeps the
  game version it started with. A new rules version is a new `game_versions` row, never an in-place change.
- Take a base backup before applying migrations in production (docs/OPERATIONS.md#backups-and-recovery-nfr-02-nfr-08).

## Verified

- Fresh database: `migrate` container applied 0000–0004 + seed on an empty PostgreSQL 18.6 (production-image smoke).
- `boardgame_test` is migrated from scratch by the test suite on every run.
- Restore drill: the restored cluster reported `migrations: ok` and served games with pinned versions.
