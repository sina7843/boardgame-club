# syntax=docker/dockerfile:1.7
# One lockfile-backed build, four runtime targets:
#   api     Fastify + Socket.IO (TypeScript run by Node's type stripping, no build step)
#   worker  deadlines / outbox / matchmaking / payments / maintenance loops
#   migrate one-shot: applies migrations, then the idempotent catalog seed
#   web     Caddy: static SPA + reverse proxy to the API (HTTP + WebSocket) + security headers
# Build: docker build -f docker/Dockerfile --target api -t bg-api .
ARG NODE_IMAGE=node:24.13.1-alpine3.22
ARG CADDY_IMAGE=caddy:2.10.2-alpine

FROM ${NODE_IMAGE} AS pnpm
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app
# Store is filled from the lockfile alone, so source edits do not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=bg-pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

FROM pnpm AS build
COPY . .
RUN --mount=type=cache,id=bg-pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile \
 && pnpm --filter @bg/web build \
 # Source maps stay out of the public image.
 && find apps/web/dist -name '*.map' -delete

FROM pnpm AS prod-deps
COPY . .
RUN --mount=type=cache,id=bg-pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile --prod \
      --filter "@bg/api..." --filter "@bg/worker..." --filter "@bg/db..." \
 && rm -rf apps/web apps/*/test packages/*/test

FROM ${NODE_IMAGE} AS server
ENV NODE_ENV=production
WORKDIR /app
# Files stay root-owned and read-only for the runtime user.
COPY --from=prod-deps /app /app
USER node

FROM server AS api
ENV API_HOST=0.0.0.0 API_PORT=3000
EXPOSE 3000
# Slow shared hosts (2 vCPU / 2 GB) can need over a minute to boot; a passing probe still marks healthy at once.
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health/ready >/dev/null || exit 1
STOPSIGNAL SIGTERM
CMD ["node", "apps/api/src/server.ts"]

FROM server AS worker
ENV WORKER_HEALTH_PORT=3010
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3010/health >/dev/null || exit 1
STOPSIGNAL SIGTERM
CMD ["node", "apps/worker/src/main.ts"]

FROM server AS migrate
CMD ["sh", "-c", "node packages/db/src/migrate.ts && node packages/db/src/seed.ts"]

FROM ${CADDY_IMAGE} AS web
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
# Non-root: the official binary carries cap_net_bind_service, so :80/:443 still work for direct TLS.
RUN addgroup -S web && adduser -S -G web web && chown -R web:web /data /config
USER web
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8081/healthz >/dev/null || exit 1
