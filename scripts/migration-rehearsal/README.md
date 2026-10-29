# Migration rehearsal (scratch database only)

Proves that pending migrations upgrade an existing database without touching its data. Never point these at production.

1. Create an empty scratch database, then bring it to the **currently deployed** state: restore a production backup into it
   (preferred), or apply only the already-deployed migrations (`apply.mjs <trimmed-folder> <url>`: copy `packages/db/migrations`
   with `meta/_journal.json` cut at the last deployed entry).
2. `node scripts/migration-rehearsal/legacy.mjs <url> seed` (skip with a real backup) then `... dump > before.json`.
3. `node scripts/migration-rehearsal/apply.mjs packages/db/migrations <url>`, then `... legacy.mjs <url> dump > after.json`: counts and
   fingerprints must be identical; re-applying must be a no-op.
4. `pg_dump --schema-only` of the upgraded database and of a fresh full-migrated one must match.
5. Start the API (`/api/health/ready` reports `migrations: ok`) and the worker against it; no errors, legacy tournaments still load.

Result for 0021–0025 (2026-10-29, dev scratch database with 6 users, 4 tournaments in every state, 16 entries): data identical,
schema identical to a fresh install, applied in well under a second, old rows get the column defaults (no check-in, no playoff),
API healthy, worker started the open tournament and delivered its notifications without errors.
