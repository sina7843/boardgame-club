# Deployment

Production-shaped stack: `docker/Dockerfile` (targets `api`, `worker`, `migrate`, `web`), `docker/postgres/`
(PostgreSQL + encrypted archiving), `docker/Caddyfile`, `compose.prod.yaml`. Nothing has been deployed to a real
host; hosting, domain and providers are owner decisions.

> **Production needs real providers**: `NODE_ENV=production` rejects the development OTP fixture, the fake payment
> gateway and the Zarinpal sandbox. Configure Kavenegar (SMS) and, for paid plans, Zarinpal before starting.

## Images

| Target | Base | User | Notes |
|---|---|---|---|
| `api`, `worker`, `migrate` | `node:24.13.1-alpine3.22` | `node` (uid 1000) | prod deps only (`pnpm install --prod --frozen-lockfile`), files root-owned + read-only, TS run by Node type stripping |
| `web` | `caddy:2.10.2-alpine` | `web` (non-root) | built SPA without source maps; admin API off |
| `postgres` | `postgres:18.6-alpine` + `age` | `postgres` | archive/backup/restore scripts |

All builds are lockfile-backed (`pnpm fetch --frozen-lockfile` then `--offline` install). Base images are pinned
by tag; pin by digest in your registry for full reproducibility. No secrets are baked in: `.dockerignore` excludes
`.env*`, keys, `.git`, docs and tests.

Compose hardening: `read_only` root FS, `cap_drop: [ALL]` (web adds only `NET_BIND_SERVICE`),
`no-new-privileges`, tmpfs `/tmp`, log rotation, PostgreSQL only on an `internal: true` network with no published
port. `api` and `worker` also join `edge` for outbound provider calls.

## Configuration (validated at startup)

| Variable | Service | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | api, worker, migrate | yes | secret; `postgres://user:pass@postgres:5432/db` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres | yes | password is secret |
| `WEB_ORIGINS` | api, worker | yes | comma list; **https only** in production (CSRF + socket origin check) |
| `PUBLIC_WEB_URL` | api | no | defaults to first origin; used for payment return URLs |
| `OTP_HASH_SECRET` | api | yes | ≥ 32 chars, secret |
| `OTP_PROVIDER` | api | yes | `kavenegar` in production (`fixture` is refused there) |
| `KAVENEGAR_API_KEY`, `KAVENEGAR_VERIFY_TEMPLATE` | api | with kavenegar | secret key + approved Verify Lookup template name |
| `PAYMENT_PROVIDER` | api, worker | no | `none` (checkout disabled), `zarinpal`, or `fake` (refused in production) |
| `ZARINPAL_MERCHANT_ID`, `ZARINPAL_SANDBOX` | api, worker | with zarinpal | secret merchant id; sandbox `true` only outside production. Callback: `https://<site>/api/payments/callback/zarinpal` |
| `METRICS_TOKEN` | api | recommended | ≥ 24 chars; without it `/api/metrics` is disabled in production |
| `TURN_TABLE_LIMIT`, `TURN_TABLE_LIMIT_PREMIUM` | api | no | 10 / 30 |
| `SITE_ADDRESS` | web | no | `:8080` (behind a TLS proxy, default) or a domain → Caddy obtains certificates itself (publish 80/443) |
| `HTTP_BIND` | web | no | host bind, default `127.0.0.1:8080` |
| `BACKUP_RECIPIENT_FILE` | postgres | yes | path to the **age public key** file |
| `ARCHIVE_TIMEOUT` | postgres | no | seconds, default 60 (bounds RPO) |

Unset optional values may be passed as empty strings (Compose/Coolify do this); they are treated as unset.
Secrets come from the platform's secret store or an env file **outside** the repository — never committed.

## First deployment

```sh
# 1. backup keys — on an offline/admin machine, NOT the server
age-keygen -o backup-identity.txt            # private: store offline (two custodians)
age-keygen -y backup-identity.txt > backup-recipient.txt   # public: copy to the server
# 2. on the server, with secrets supplied by the environment
docker compose -f compose.prod.yaml build
docker compose -f compose.prod.yaml up -d          # postgres → migrate (one-shot) → api/worker → web
docker compose -f compose.prod.yaml exec -u postgres postgres base-backup.sh   # first base backup
pnpm --filter @bg/db grant-role <owner-mobile> admin                          # run with DATABASE_URL of the target
```

Readiness: `curl -fsS https://<site>/api/health/ready` → `{"status":"ok",…}`.

## Release / upgrade procedure

1. CI green (lint, typecheck, build, unit/integration, E2E) on the exact commit; tag `vX.Y.Z`.
2. Build images with `IMAGE_TAG=vX.Y.Z`; push to the registry.
3. Take a base backup (above). Migrations are forward-only and additive by policy (see [MIGRATIONS.md](MIGRATIONS.md)).
4. `docker compose -f compose.prod.yaml up -d migrate` — must exit 0.
5. `up -d api worker web`. `api`/`worker` receive SIGTERM: the API closes sockets and drains HTTP, the worker
   finishes in-flight jobs (≤ 15 s); clients reconnect and resubscribe automatically.
6. Smoke: readiness, login, play one move on each game, `/api/metrics` sane, no `bg_module_failures_total` increase.
7. Rollback: redeploy the previous image tag. Because migrations are additive, the previous API runs against the
   new schema; a destructive migration requires a restore instead (never done in a normal release).

Game rules versions are pinned per table: a release that adds a new rules version leaves running tables on their
original version (see [ADDING_A_GAME.md](ADDING_A_GAME.md)).

## Reverse proxy behaviour (Caddy)

- `/api/*` → `api:3000`, HTTP and WebSocket (`/api/socket.io`), unlimited read timeout for sockets.
- Everything else → SPA with history fallback; hashed assets `immutable` for a year, `index.html` `no-cache`.
- Headers: CSP `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
  connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, HSTS,
  `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, COOP; `Server` removed.
  (`style-src 'unsafe-inline'` is needed for React `style` attributes; no inline scripts exist.)
- `X-Forwarded-For` is accepted only from private-range proxies; the API trusts the proxy in production.

## Optional: Coolify

Not performed — documented only.

1. New resource → *Docker Compose* → point to this repository, compose file `compose.prod.yaml`.
2. In *Environment variables* add the secrets from the table above (mark secret ones as secret). Set
   `SITE_ADDRESS=:8080` (Coolify's proxy terminates TLS) and remove/override `HTTP_BIND` so Coolify routes to
   `web:8080`; assign the domain to the `web` service only.
3. Upload the age **recipient** file as a file mount and set `BACKUP_RECIPIENT_FILE` to its path.
4. Persistent volumes: `pgdata`, `pgarchive`, `caddy_data`, `caddy_config`. Configure an off-host sync for
   `pgarchive` (S3-compatible destination) — Coolify's own database backups are logical dumps and do **not**
   replace WAL archiving/PITR.
5. Deploy; check the `migrate` service exited 0 and `/api/health/ready` is OK through the public domain,
   including a WebSocket connection (open a table page).
6. Scheduled task: daily `base-backup.sh` in the postgres container.

## Local production-shape smoke (what was actually run)

Throwaway values in an env file **outside** the repo; `NODE_ENV=development` because production mode refuses the
fixture OTP (verified separately: the API exits with "Refusing to start in production: OTP_PROVIDER=fixture…" and the
worker with "PAYMENT_PROVIDER=fake is development-only").

```sh
docker compose -p bg-smoke --env-file <scratch>/smoke.vars -f compose.prod.yaml up -d --build
```

Verified: all services healthy; SPA + deep links; CSP and headers; CSRF origin rejection (403); OTP login with
`HttpOnly; SameSite=Lax` cookie; WebSocket through Caddy (foreign origin rejected); metrics token gating; uids
1000/100 (non-root); read-only FS; PostgreSQL not published; `SIGTERM` drains (`worker stopped … abandonedJobs: 0`).
