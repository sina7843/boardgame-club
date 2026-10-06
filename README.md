# باشگاه بردگیم (Boardgame Club)

سکوی فارسی و راست‌به‌چپ برای بازی آنلاین بردگیم در مرورگر، روی موبایل و دسکتاپ.

A Persian (RTL) web platform for playing board games online: live and turn-based tables, matchmaking,
friends and clubs, ratings and seasons, and an admin panel that controls each game's modes and rule variants.

**Games:** UNO (2-10 players), Sealed Bids, Line Three, each with an interactive tutorial.

## Stack

pnpm monorepo, Node 24 (TypeScript), Fastify + Socket.IO, PostgreSQL 18, React 19 + Vite, Playwright.
The server owns rules, randomness, time and results; clients only receive their own view of the game.

## Run locally

```sh
corepack enable
pnpm install
cp .env.example .env
pnpm dev:services && pnpm db:migrate && pnpm db:seed
pnpm dev:api    # http://127.0.0.1:3000/api
pnpm dev:web    # http://127.0.0.1:5173
pnpm dev:worker
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `npx playwright test`.
More: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/ADDING_A_GAME.md](docs/ADDING_A_GAME.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Status

Local release candidate. Not production-ready: a real SMS provider, payment gateway, hosting and real-device
testing are still required (see [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md)).

## License

All rights reserved. See [LICENSE](LICENSE).
