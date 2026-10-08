# Recorded implementation decisions

Execution defaults are in IMPLEMENTATION_DECISIONS.md. Exact dependency versions, rating algorithm, provider selection and operational capacity are to be recorded with evidence during implementation. Product name, real launch games, commercial prices and final limits remain open.

## Standing owner rule: polish every new game (2026-10-08, owner instruction, applies to all future work)

> «هر بازی که گفتم اضافه کن تا ۴ بار زیباتر و حرفه‌ای‌ترش می‌کنی، UI/UX بازی بهبود می‌دی، انیمیشن‌های جذاب می‌ذاری.»

Every game the owner asks to add is not done at "rules + working renderer". After it works, run up to **four**
successive visual/UX polish passes on it. Each pass: take screenshots at 360 and 1440, critique them, then improve the
look (physical board/pieces/cards, typography, colour), the UX (fewer taps, clear turn state, readable at 360,
one-tap moves within the shell's undo window) and add purposeful animations (moves, dice, card draws, captures,
scoring, result), always respecting `prefers-reduced-motion`. Stop early only when a pass finds nothing worth
changing. Re-run that game's E2E at 360 and 1440 after the passes and record what changed.

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

## UNO (2026-10-07, owner request; owner states the game is licensed)

- Source: official Mattel rulebook 42001 (2001 edition, English section) supplied by the owner in `Rulebooks/`
  (kept out of git like other source inputs).
- Implemented as written: 108 cards (the 4 blank house-rule cards are not used), 7-card deal, start-card effects
  (Wild Draw 4 returned and redrawn; Draw 2 / Skip / Reverse / Wild as described), draw-one then optionally play
  only the drawn card, voluntary draw, two-player rules, UNO call with a catch window that closes when the next
  player begins their turn, self-catch, Wild Draw 4 bluff + challenge (hand shown only to the challenger),
  reshuffle of the discard pile, scoring to a target.
- Deviations (platform needs): the dealer is drawn by the engine RNG instead of a high-card draw; on timeout the
  engine draws one card and passes (accepts a pending +4); three consecutive timeouts remove the player; a resigning
  player's cards go back into the draw pile. Not implemented: partners and multi-table tournament variants.
- Admin variants: match length (500 official / 200 / one hand) and UNO penalty (4 per this rulebook / 2).
- Tutorial uses a fixed teaching deal through the new `TutorialScript.options` (never offered to hosts/admins).
- Card faces are original vector designs (no bitmap assets); every face carries the colour's Persian initial and a
  spoken label so colour is never the only signal.

## Game table like Board Game Arena (2026-10-07, owner request)

- Immersive mode is a `data-immersive` attribute set by the game view; shell parts carry `shell-nav`/`shell-main`
  classes. Lobby and result pages keep the normal shell.
- The table is always the "night" palette (`.table-night` reuses the dark tokens in either theme) so every renderer
  stays readable on felt without per-game changes; muted text on felt is lifted to #c8d4cc for contrast.
- Seat colours are only stripes and rings, never text colour. The status strip says «حرکت با شماست», not
  «نوبت شماست», because renderers already show the latter and tests match it in strict mode.

## VibeFarsi Anar redesign (2026-10-07, owner request) — supersedes the cobalt café entry below

- Source: VibeFarsi registry and MCP (vibefarsi.ir, MIT). Design language "Anar": clay depth shadows, pill controls,
  16px fields, 28px surfaces, 420ms spring motion, Vazirmatn (display 800). Registry files are vendored, not fetched at
  runtime; header comment in each file names the source.
- Colors are the owner's override of the MCP palette: "classy game café" — felt green primary (#21563e light,
  #5cbf8c dark), brass accent (#8a5d10 / #dcab4f), warm sage paper backgrounds. Tokens live in
  `packages/ui/src/theme.css`; `apps/web/scripts/contrast.mjs` measures them.
- Tailwind CSS v4 (`@tailwindcss/vite`) added for the vendored components; page classes in `styles.css` live in
  `@layer components` so utilities win.
- Prices are stored in Rial (what Zarinpal charges) and displayed in Toman (Rial / 10).
- E2E contexts run with `reducedMotion: 'reduce'` so screenshots show settled UI; the reduced-motion path is thereby
  covered too.
- VibeFarsi `cn` has no tailwind-merge; conflicting overrides use Tailwind's `!` modifier.

## Visual redesign "board-game café" (2026-10-07, owner request)

- Owner choices: café mood, theme follows the device, cobalt accent, Estedad font.
- Materials as the system: walnut wood for navigation (CSS-only grain), green felt for game tables and the "start a game"
  panel, card stock for panels. One accent (cobalt); the old purple palette was removed everywhere.
- Light "café by day" and dark "café at night"; with no saved choice the theme follows `prefers-color-scheme` live
  (no data-theme attribute), a saved choice overrides it. Default preference changed from dark to system.
- Shape rule: interactive controls are pills, inputs 12px, panels and cards 16px. Game cards read as game-box lids.
- Contrast is measured by `apps/web/scripts/contrast.mjs` (fails below AA) and checked in the browser with axe in both
  themes (`e2e/release.spec.ts` light, `e2e/theme.spec.ts` dark).
- Estedad (`@fontsource-variable/estedad` 5.3.0, OFL) is self-hosted; Vazirmatn removed.
- Visible em/en dashes replaced with Persian punctuation per the design brief.
- `docs/DESIGN_SYSTEM.md` is a protected source document and was not edited; this entry and the tokens file are
  the current reference.

## Real providers: Kavenegar and Zarinpal (2026-10-07, owner choice)

- Implemented from the VibeFarsi registry guides (`kavenegar-otp`, `zarinpal-payment`) behind the existing
  `OtpDelivery` and `PaymentGateway` boundaries; no SDK dependency, plain `fetch` with a 10 s timeout.
- Kavenegar: Verify Lookup with an approved template; logical errors arrive inside `return.status` (often HTTP 200)
  and are treated as delivery failures. The API key sits in the URL path, so URLs never reach logs or error text.
- Zarinpal: amounts stay in Rial end to end (our storage unit and Zarinpal's API unit; no Toman conversion).
  Callback `/api/payments/callback/zarinpal?Authority&Status`: NOK fails the payment without a verify call; OK verifies.
  Verify codes 100/101 are paid (101 = duplicate, idempotent), -50/-54/-55 are final failures, and **-51 stays pending**
  because Zarinpal also returns it for an unfinished payment (reconciliation runs while buyers may still be paying);
  abandoned payments expire after the 30-minute TTL.
- Production refuses `ZARINPAL_SANDBOX=true`. Merchant ids are validated by shape, not RFC UUID rules (Zarinpal ids
  are not guaranteed RFC-valid).

## Unmatched (2026-10-07, owner request)

- Sources: core rulebook `Rulebooks/Unmatched/rules_EN_Light.pdf` (owner-supplied, kept out of git); card values, BOOST
  and copy counts from the unmatched.cards deck database. Scope chosen by the owner: core rules + Battle of Legends
  Vol. 1 (Arthur, Medusa, Sinbad, Alice), duel and free-for-all. Team play and the other ~70 heroes / 24 maps are not
  implemented.
- The database lists a joke "mirror" variant of Medusa's ability, Gaze of Stone and A Momentary Glance; the official
  printed text is used instead.
- Battlefields: space centres and zones taken from published map geometry; adjacency lines and start spaces read by
  hand from the board art. The board is drawn as original vector shapes (no board art shipped).
- Platform deviations: the first player (start space 1) is drawn by the engine RNG instead of "youngest player"; heroes
  are picked in turn order, no duplicates; the map is a table option (random / Marmoreal / Sarpedon).
- Every decision is a server prompt with a fresh turn deadline. Timeout = most passive choice (maneuver without moving,
  no defence, skip "may"); three in a row remove the player. A leaver's fighters leave the board.
- Prophecy: the two kept cards are the first two picked; any further picks set the order on top of the deck.
  Bewilderment prevents all damage to its fighter until the combat ends (after-combat effects included).
  Restless Spirits may target any space in Merlin's zone(s), then one adjacent space.
- The defender is always asked for a defence card unless their hand is empty, so the attacker never learns that no
  usable card was held.
- Shell fix: the result screen's generic `win` reason no longer says "three in a row" (was Line Three wording for all games).

## Unmatched — Cobble & Fog (2026-10-07, owner request)

- Added Sherlock Holmes (+ Dr. Watson), Dracula (+ 3 Sisters), Jekyll & Hyde and the Invisible Man (all 30-card decks,
  values from the unmatched.cards database) and the SoHo and Baskerville Manor battlefields.
- Board data: the published map geometry lacks one zone on each new map (SoHo rooftops, Baskerville garden); those
  spaces/halves were added by hand from the board art (`navy` zone). Baskerville's four secret-passage spaces are
  mutually adjacent for movement only (never for attacks).
- "Your opponent" on a scheme in free-for-all (Invisible Man fog moves) = the next player in turn order; Holmes's
  "Choose an opponent" is a real choice. In combat it is always the other combatant.
- Elementary is played face up with a prediction 0–8 of the attack card's printed value; a correct guess cancels the
  attack card's effects (unless they are uncancellable Holmes effects) and its value is ignored.
- Do My Bidding: the returned attack card was already revealed, so it stays visible; the defender picks from the
  attacker's attack/versatile cards usable by the attacking fighter.
- Calming Research keeps the first picked card and puts the rest on the bottom (choosing "fewer than 3" is not offered).
  Coded Notes: the first picked card ends on top. Confirm Suspicion values offered: 0–8.
- Ravening Seduction: choose the fighter first, then move it up to 2 (0 allowed), then damage per adjacent Sister.
- Vanish: the Invisible Man is off the board (not defeated, cannot be targeted, his cards cannot be played) until he is
  placed at the start of his next turn; played as the first action, it ends the turn.
- "Started this turn in a space" (Momentous Shift, Emerge From Mist) is measured after start-of-turn effects.

## Chess (2026-10-07, owner request)

- FIDE basic rules: castling (not out of/through check), en passant, promotion to Q/R/B/N, check, checkmate, stalemate.
  Move generator verified by perft against the standard reference positions (start, Kiwipete, positions 3–5).
- Draws are automatic (no claim step): threefold repetition (key includes castling rights and a *capturable*
  en-passant square), fifty-move rule (100 half-moves), insufficient material (K v K, K+minor v K, K+B v K+B same
  shade), stalemate, and an accepted draw offer. An offer is sent with a move and lapses when the receiver moves.
- Time: the platform's per-turn deadline. On timeout the side to move loses (FIDE 6.9), or the game is drawn if the
  opponent has no mating material (lone king, or king + one bishop/knight). Variant: White = random (default) or host.
- `setup` accepts a `fen` option for engine tests only; the API rejects undeclared options (`OPTION_NOT_ALLOWED`),
  covered by `apps/api/test/chess.test.ts`.
- Pieces are Unicode chess glyphs (text presentation forced with U+FE0E), coloured by CSS; no image assets.
- Board coordinates stay literal (ltr); the board is shown from the viewer's side. Notation is standard SAN (Latin).

## Snakes and Ladders (مارپله) and Ludo (منچ) (2026-10-07, owner request)

- Both are traditional public-domain games; dice are rolled by the server RNG (never the client). Tutorials use a short
  scripted dice list (tutorial tables only; never projected).
- Snakes and Ladders: 2–6 players, classic 1943 "Chutes and Ladders" layout (9 ladders, 10 snakes), any number of
  tokens per square, start off the board, first player drawn by the engine. Variants: reaching 100 needs an exact roll
  (default: an overshoot does not move) or bounces back; optional extra roll on a 6 (default off). Ranking: the winner,
  then by square.
- Ludo / منچ: 2–4 players, Mensch ärgere Dich nicht rules — 40-square track, 4-square goal per colour, enter on a 6,
  a 6 rolls again (also when blocked), three tries when nothing can move without a 6, capture sends the piece to its
  yard, no landing on own pieces, no jumping over own pieces in the goal, exact count into the goal. Two players sit
  opposite. Not enforced (common house rules vary): compulsory capture and compulsory clearing of the start square;
  the player chooses freely, and a single possible move is played automatically. The game ends when the first player
  has all four pieces home; the others are ranked by total progress.
- Timeouts: the turn is played for the absent player (roll; Ludo moves the most advanced movable piece); three in a row
  remove the player. Resign: the player leaves (Ludo: their pieces leave the board); the last player standing wins.

## Catan (2026-10-07, owner request)

- Source: base-game rulebook `Rulebooks/Catan/catan_base_rules_2020_200707.pdf` (owner-supplied, kept out of git).
  Scope: base game for 3–4 players. The 5–6 player extension and Seafarers/Cities & Knights are not implemented.
- Maps: variable set-up (default) uses the rulebook's "fully random" option — terrain and number tokens shuffled,
  re-shuffled until no 6/8 are adjacent; harbor types shuffled over 9 fixed frame positions. "Beginners' map" uses the
  terrain/number layout of Illustration A; its harbor order and the preset starting pieces are not reproduced —
  everyone places with the normal set-up phase. The board is original vector art.
- Platform deviations: the starting player is drawn by the engine RNG (rulebook: highest roll). The almanac's combined
  trade/build phase is used (trade and build in any order after rolling). Domestic trade is an open offer from the
  current player; others accept/decline and the current player picks one partner; counter-offers go through table
  chat. Any other move by the current player withdraws the open offer.
- Resource counts of other players are public (counts only, as at a real table); which card was stolen is shown only
  to the thief and the victim. Development cards are hidden until played; victory point cards are revealed at the end.
- A 7 asks every player above 7 cards to discard at once (simultaneous decision, shared deadline). Robber victims are
  limited to adjacent players who hold cards; with one candidate the steal is automatic.
- Win: checked after every action of the current player and at the start of a turn, so Longest Road gained on another
  player's turn wins on your own turn. Largest Army set aside when its holder leaves and the rest tie.
- Timeout = minimum play for the absent player (best-dot set-up spot + first road; roll; robber on the hex hurting
  opponents most; steal from the first candidate; end turn; discards from the largest piles). Three in a row remove
  the player; a removed player's pieces stay (they block) but no longer produce.
- Tutorial tables have two seats: a fixed position on the beginners' map (learner at 8 VP, scripted roll of 8), five
  steps to 10 VP. Two players are only accepted for that tutorial deal.

## Risk (2026-10-07, owner request)

- No rulebook was supplied (`Rulebooks/` has none); classic Hasbro world-domination rules are implemented: 42
  territories / 6 continents (bonuses NA 5, SA 2, EU 5, AF 3, AS 7, AU 2), 3–6 players, starting armies 35/30/25/20,
  reinforcements max(3, ⌊territories/3⌋) + continents + card sets (4, 6, 8, 10, 12, 15, then +5; +2 on one pictured
  owned territory per turn), forced trade at 5+ cards, attack 1–3 dice vs defender up to 2 (ties to defender),
  occupation of at least the dice rolled, one fortify per turn, a card per turn with a conquest, eliminated players'
  cards pass to the eliminator (6+ → trade down immediately). The world map is original vector art.
- Platform deviations: first player and the territory deal use the engine RNG ("deal the cards" set-up); each player
  places all remaining starting armies in one action; the defender always rolls the maximum allowed; occupation is
  skipped when only one count is possible; the +2 card bonus goes to the lowest-index pictured territory you own.
- Variants: goal `world` (default) or `majority` (30 territories at the end of your own turn, a shorter online game);
  fortify through `connected` own territories (default) or `adjacent` only.
- Timeouts play the minimum (forced trade, all armies on the most threatened own territory, minimum occupation, no
  attack, no fortify); three in a row or resigning leaves the seat `abandoned` (its territories stay, can be conquered).
- Tutorial: two-seat fixed position, scripted dice, six steps to a majority win.

## «املاک» — Monopoly-style property trading (2026-10-08, owner request)

- Owner choices: Tehran streets and toman (original board, names and art; not the branded game), full trading,
  official rules by default with house rules as table options, and both end conditions as an option.
- Board: classic 40-square layout and economics (prices, rents, building costs, stations, utilities, taxes, 16 + 16
  cards adapted to Persian); money in units of 1,000 toman (salary 200 = ۲۰۰ هزار تومان, start 1,500).
- Rules: two server-rolled dice, doubles roll again, three doubles → jail; jail exits by doubles, bail (50), card, or
  forced bail after the third failed roll; buy or auction (sequential ascending, seats from the current player; a
  bidder must have the cash); rent doubles for a complete unimproved group (also if one is mortgaged); even building
  and selling, 32 houses / 12 hotels; mortgage half price, unmortgage +10%; multi-party debts (birthday, chairman).
- Simplifications: a debtor who could not pay even after selling and mortgaging everything is declared bankrupt
  automatically; on bankruptcy to the bank properties return unowned (no auction of them); assets passed to a player
  keep their mortgages without the 10% transfer fee; mortgaged property received in a trade costs the receiver 10%
  interest at once (the trade is refused if they cannot pay). Building/trading happen on your own turn (before or after
  rolling), not at any time. Selling a hotel needs 4 houses in the bank.
- Options: gameLength (bankruptcy | 35 rounds | 20 rounds → highest net worth), auction (on | off), freeParking
  jackpot (taxes and card fees), doubleGo (landing exactly on Go pays double).
- Timeouts play passively (roll, decline, pass, reject trade, end turn; debts: sell buildings then mortgage, else
  bankrupt); three in a row = bankrupt to the bank. Card deck order is never projected.
- Visual identity: physical board-game look, consistent with the other tabletop modules. It uses a walnut frame, a cream
  board with a faint girih pattern, and a Tehran skyline in the centre (Alborz, Milad, Azadi) drawn as original SVG,
  not taken from the branded game. Property info is shown as a «سند مالکیت» title-deed card. The drawn
  chance/chest card animates face up, and that animation is turned off under reduced motion.

## Ticket to Ride (2026-10-08, owner request)

- No rulebook supplied; classic base rules: 2–5 players, 45 trains, 110 cards (12 × 8 colours + 14 locomotives),
  5 face-up (3 face-up locomotives → redeal), turn = draw 2 cards / claim a route / draw 3 tickets (keep ≥1), face-up
  locomotive first ends the drawing and is not allowed as the second card, double routes never both for one player and
  closed for 2–3 players, last round when someone ends a turn with ≤2 trains (everyone incl. the trigger plays once
  more), route points 1/2/4/7/10/15/18/21, tickets ±, longest continuous path +10 (ties all), tie-break completed
  tickets then longest path. No tunnels, ferries or stations on any map (owner chose classic rules).
- Maps (option `map`, default `usa`): North America, Europe, Iran. Cities use real longitude/latitude; the route
  networks are our own data; ticket values are computed as the shortest connection in train cars, not hand-typed.
  The map art (projected cities, curved routes, land silhouette) is original vector art.
- Platform deviations: first player drawn by the engine; initial ticket choice is simultaneous; a turn with no possible
  action is passed and the game ends if every active player passes in a row.
- Timeouts: ticket choice keeps the cheapest minimum; a turn draws blind cards; three in a row or resigning leaves the
  seat `abandoned` (routes stay, cards discarded, ranked after active players).
- Tutorial: Iran map, two seats, learner has 7 trains, seven steps to a win in the last round with a scripted opponent.
- Shared UI fix found by the املاک 360px E2E: `SegmentedControl` used `whitespace-nowrap` in equal-width grid columns,
  so long option labels (any game's variants) overflowed the screen and the create-table button was covered. Labels
  now wrap inside their column (`whitespace-normal`, `min-h`), short labels look unchanged.

## Test server switch (2026-10-08, owner request)

- `ALLOW_TEST_PROVIDERS=true` (default `false`) lets `NODE_ENV=production` start with the OTP fixture (fixed code,
  no SMS), the fake payment gateway and the Zarinpal sandbox, so a public test deployment works before Kavenegar and
  Zarinpal are configured. With the fixture in production the code must not be an obvious one (123456/000000/111111).
  Without the switch production still fails closed. Login and plans pages label the test mode. Never on the live site.

## Coolify test deployment (2026-10-08, owner request)

- `compose.coolify.yaml` is for the current low-traffic TEST server: plain `postgres:18.6-alpine` with one named volume
  `boardgame_pgdata` (`PGDATA` pinned to `/var/lib/postgresql/data` because postgres 18 defaults elsewhere), no WAL
  archiving / PITR / off-site backup. `compose.prod.yaml` and `docker/postgres` stay unchanged for hardened production.
- No host ports; only `web` (Caddy, `expose: 8080`) gets the Coolify domain. Caddy `/data` and `/config` are tmpfs
  (Traefik terminates TLS, nothing to persist). Default Compose network instead of the prod internal/edge split,
  since Coolify attaches its own network to every service. `TRUST_PROXY_HOPS` defaults to 2 (Traefik -> Caddy).

## One-tap moves with an undo window; table chat alerts (2026-10-08, owner request)

- Moves no longer need a confirm step. The table shell holds every renderer action for 2 s ("حرکت شما تا لحظه‌ای دیگر
  ثبت می‌شود" + «انصراف», Escape also cancels) and only then sends it; the board is `busy` meanwhile. Resign keeps its
  dialog and skips the window. `localStorage bg.undoMs` overrides the delay (E2E sets 0; the undo test sets 2000).
- Confirm buttons removed where they only confirmed a single choice: line-three cell, sealed-bids chip, Catan
  settlement/city/road/robber, Unmatched attack and defence card and single-card boost/choice. Kept where a second real
  input exists: Arthur's boost, Elementary's prediction, multi-card picks, amounts (bids, trades, armies).
- Table chat: while the chat drawer is closed, a new message from another participant shows a toast
  («پیام در میز — نام: متن»), an unread count on «گفت‌وگوی میز», and a browser notification if enabled and the tab is
  hidden. Only on the table page; no server-side notification for table chat (it would flood turn-based players).
- Fullscreen: a game-bar button puts the whole page (`document.documentElement`) in fullscreen, so the status strip,
  hand, chat drawer, dialogs and toasts stay usable; ZoomBoard's own board-only fullscreen remains. Hidden where the
  Fullscreen API is missing (iPhone Safari). Leaving the table exits fullscreen.
- Catan shows no build targets while a move is held or in flight (a tap then would be ignored).
## «تخته‌نرد» (Backgammon, 2026-10-08, owner list batch 1)

- Standard rules: 15 checkers, server dice, opening roll (one die each, re-rolled on a tie, the higher die moves with
  both), "use as many dice as possible / the larger die" enforced by enumerating complete plays, hits and bar entry,
  bearing off (higher die only from the farthest point), gammon ×2 and backgammon ×3.
- A whole turn is one `play` action (the list of checker steps). The renderer builds it locally and sends it when no
  dice are left, so the 2 s undo window covers the whole turn instead of every checker.
- Options: gammons counted (default) or always 1 point; doubling cube off by default (common casual play in Iran),
  on as an option (double before rolling, take = ×2 and cube passes, drop = lose at the current value).
- Resign and three timeouts in a row concede a single game × cube; a timeout plays passively (take, roll, first legal
  play). The tutorial is an endgame that ends in a win, because tutorials complete only on a finished game.
- Look: walnut frame with a khatam inlay, ivory/ebony checkers, red/ivory points, dice that roll in, gold rings on
  movable checkers, dashed landings, move trails, bear-off slabs in the tray; reduced motion turns animations off.
## «چکرز» (Checkers, 2026-10-08, owner list batch 1)

- Default English/American draughts (WCDF): dark moves first, men move/capture forward only, compulsory capture
  (free choice between capture sequences), multi-jumps, crowning ends the move, kings move one square.
- Option "brazilian" (8×8 international rules): men capture backwards, flying kings, the longest capture is
  compulsory, crowning only when the move ends on the last row. Option firstMove (random / host plays dark).
- Draws: threefold repetition, 40 moves each without a capture or man move, or an accepted offer made with a move.
  A flag fall loses (like chess). The tutorial is a forced double jump followed by the winning capture.
- Look: maple/walnut board in a dark frame with coordinates, lacquered red vs ivory discs, gold rings on movable
  pieces, dots on next squares (multi-jumps tapped square by square, sent as soon as the path is unique), the last
  move slides in, captured pieces fade, a crown pops on promotion; board seen from the viewer's side.
## «اتللو» (Othello, 2026-10-08, owner list batch 1)

- World Othello Federation rules: standard centre start, black first, outflanking in eight directions, automatic
  pass when a player has no move, game over when neither can move; empty squares go to the winner; equal = draw.
  Option firstMove (random / host plays black). A flag fall loses. Tutorial: one outflank, then a three-disc capture
  that wipes out white.
- Look: green baize with brass lines and star points, glossy discs that drop in; outflanked discs turn over in a
  ripple from the new disc; legal squares dotted (ghost disc on hover); live disc counts with a black/white bar.
## «کوریدور» (Quoridor, 2026-10-08, owner list batch 1)

- Official rules for 2 and 4 players (10 / 5 walls), plus the common unofficial 3-player setup (bottom, left, top;
  7 walls). Pawn step or wall per turn; walls may not overlap/cross or cut any active pawn off its goal (BFS check);
  straight jumps over an adjacent pawn, diagonal side-steps when a wall or the edge is behind it.
- Others are placed by remaining distance when someone wins; resign / three timeouts remove a player (their pawn
  leaves the board); a timeout steps along a shortest path. Legal walls are computed on the client with the same
  `wallOk`; the server re-validates every wall.
- Look: oiled wooden tiles in grooves, dark walnut walls that drop in, glossy pawns in seat colours that slide,
  goal edges glowing in each player's colour, board turned so the viewer's start edge is at the bottom; walls are
  placed by tapping the groove crossings (preview on hover), with a horizontal/vertical toggle in viewer terms.
## «اونیتاما» (Onitama, 2026-10-08, owner list batch 1)

- Base game with the 16 standard cards (offsets from the owner's side, mirrored for blue), deal 2 + 2 + 1, the side
  card's colour starts, the used card swaps with the side card, pass = card exchange when no move exists, wins by
  the Way of the Stone and the Way of the Stream. House safety: threefold repetition (board + cards) is a draw.
  A flag fall loses. Cards are public information, so nothing is hidden in the view.
- Look: rice paper and ink lines, temple gates on both temples, vermilion vs indigo tokens (crowned masters), move
  cards with a 5×5 pattern and colour stamp (opponent's cards upside down, the side card labelled with who gets it
  next); targets coloured by card, a card picker when two cards reach the same square, sliding last move.
## «گو» (Go, 2026-10-08, owner list batch 2)

- Area (Chinese-style) scoring with komi (7.5 default; 6.5 / 5.5 / 0.5 options), board 9×9 default (13 / 19 options),
  suicide illegal, positional superko (server keeps every earlier board hash; the client shows the simple-ko point).
- End: two passes open a scoring phase; either player toggles dead groups (any change clears both acceptances),
  both accept to score, either may resume play (opponent of the resumer moves). Timeouts pass (three in a row lose);
  a timeout during scoring accepts the current marking. No handicap stones in this version.
- Look: kaya board with grain, ink lines, star points and coordinates; slate and shell stones that drop in; captured
  stones fade; last-move ring; ko square; territory squares and live score in the scoring phase; dead stones marked ×.
## «سانتورینی» (Santorini, 2026-10-08, owner list batch 2)

- Base game for two without god powers (stated in the rules text): setup placements, move (8 directions, up ≤ 1,
  down any) then build next to the moved worker (vacated square allowed), domes on level 3, piece supply 22/18/14/18,
  win by climbing onto level 3, lose when no whole turn exists. A turn is one action (from, to, build) composed on the
  board; a winning climb needs no build. Timeouts play a random legal turn (a winning one if available); three lose.
- Look: grassy island in an Aegean sea, whitewashed tiered towers with columns on level 3 and blue domes, level
  badges, workers that slide and stand on the towers, dashed gold move targets and blue build targets, ghost worker
  while choosing the build, new levels rise in.
## «تاک» (Tak, 2026-10-08, owner list batch 2)

- Standard rules: sizes 4/5/6 (15/21/30 stones, 0/1/1 capstones; 5×5 default), opening places an opponent flat,
  place flat/wall/capstone or move a controlled stack (carry limit = size, ≥ 1 per square, walls and capstones block,
  a lone capstone as the last drop flattens a wall), roads of flats and capstones between opposite edges win (the
  mover wins a double road), else full board / empty reserve → most top flats (equal = draw). No komi.
- Moves and placements are computed on the client (`allMoves`, `moveOk`) and re-validated on the server. Timeouts
  place a flat (or a random move); three in a row lose.
- Look: walnut board; birch and ebony stones drawn as square tiles with thickness, stacked in layers with a height
  badge; walls lean, capstones are domed; moves are built by tapping drop squares (dashed gold), the lifted part of
  the stack rises; the winning road glows.
## «آبالون» (Abalone, 2026-10-08, owner list batch 2)

- Standard layout on the 61-cell board, 1–3 marbles in a line move in-line or broadside, sumito (2>1, 3>1, 3>2) with
  an empty cell or the edge behind, six marbles off wins. House rule: after 200 moves, more marbles pushed off wins
  (equal = draw), so games always end. Moves are enumerated on the client (`legalMoves`), re-validated on the server.
  Timeouts play a random legal move; three in a row lose.
- Look: flat-topped walnut tray with brass rim and dimples, black glass vs white pearl marbles, six-slot trays of
  marbles pushed off, selection rings, direction arrows only where a move is legal, sliding marbles (pushed ones too),
  the marble pushed off fades at the edge; board turned so the viewer's marbles start at the bottom.
## «کندو» (Hive, 2026-10-08, owner list batch 2)

- Base game (no Mosquito/Ladybug/Pillbug): 1 Q, 2 S, 2 B, 3 G, 3 A each; first piece in the centre, second next to it,
  then placements touching only own pieces; Queen by the fourth own turn; no moves before the Queen; One Hive and
  Freedom to Move (ground slides need exactly one occupied common neighbour; beetles respect the climbing gate);
  queen 1, beetle 1 (climbs), grasshopper jumps, spider exactly 3, ant any distance; surround the Queen to win, both
  at once draws; forced pass when nothing is legal (two in a row draws). House limit: 300 turns → draw. No tournament
  "no queen on the first turn" rule. Timeouts play a random legal action; three in a row lose.
- Look: bakelite hex tiles (ivory/charcoal) with drawn insects in the classic bug colours, stacked tiles show the piece
  underneath and a height badge, the view fits the hive as it grows (zoomable), reserve strips for both players,
  dashed gold targets, placed tiles pop in, moved tiles slide, the trapped queen glows red.
- Fixed during polish: tiles had `pointer-events: none`, so pieces on the board could not be tapped (caught by E2E).
## «نه، مرسی!» (No Thanks!, 2026-10-08, owner list batch 3)

- Standard rules: cards 3–35 with nine removed unseen, 11 chips (9 for six, 7 for seven players), take with the chips or
  pay one to refuse, the taker continues, runs score only their lowest card, chips subtract, lowest total wins.
  Chip counts are secret until the end (projected only to their owner); deck and removed cards are never projected.
  The 2-player game is offered (unofficial, common) because tutorial tables have two seats. Result scores are shown
  as positive totals (lower is better). Timeouts refuse while chips last, otherwise take (no elimination).
- Look: bold numbered cards from cool to hot, a stacked red chip pile with a count, a face-down deck, players' cards
  grouped in runs with only the scoring card bright, big take/refuse buttons with the score impact of taking.
## «گاو شش» (6 nimmt!, 2026-10-08, owner list batch 3)

- Standard rules for 2–10 players: 104 cards with bullheads, ten cards each, four rows, simultaneous hidden choice,
  placement lowest first, the sixth card takes the row, a card below every row makes its owner choose a row, rounds
  until someone reaches 66 (option: one round), fewest bullheads wins. Hands, pending choices, the undealt deck and
  penalties collected in the running round are private; all choices of a turn are revealed together (including cards
  still waiting while a row choice is pending). Timeouts play the lowest card / the cheapest row for everyone the game
  waits on. Resign ends the game with the resigner last.
- Look: classic numbered cards coloured by penalty with bull heads, rows with a red «۶» danger slot and a bullhead
  total, revealed choices in order with who took what, rows turn into buttons for a forced choice, tap-to-play hand.
## «نامه عاشقانه» (Love Letter, 2026-10-08, owner list batch 3)

- Classic 16-card edition for 2–4 players (Guard ×5 … Princess), one card set aside (two players: three more face up),
  draw-and-play turns, all card effects incl. Handmaid protection, Prince on yourself, the set-aside card when the
  deck is empty, the Countess rule; round by last standing or highest card (tie → discard total; still tied → all tied
  win); tokens 7/5/4, option "short" (3 tokens). Hidden: hands, deck, set-aside card; a Priest look (and a Baron tie)
  is projected only to the players concerned. Timeouts play the lowest legal card (never the Princess) on a random
  target. Resign leaves the game; the last remaining player wins.
- Look: parchment cards with value, drawn emblem, name, effect and a wax seal; opponents with heart tokens, Handmaid
  shield, discard rows; private "only you see" banner; target buttons on players and a guess strip for the Guard.
## «جمجمه» (Skull, 2026-10-08, owner list batch 3)

- Standard rules for 3–6 (2-player offered as unofficial for tutorials): everyone places a first disc in turn order,
  then place or bid (bids from 1 up to every disc on the table; the maximum ends bidding at once), raise or pass,
  the challenger turns all their own discs first and then picks opponents' top discs; all roses → a point (two win);
  a skull → the challenger loses a random disc (only they learn which; engine RNG so replay is exact) and the skull's
  owner starts the next round; no discs left → out; last standing wins. Hidden: hands and placed stacks (counts
  public); owners see their own stack. Timeouts place a rose, pass, or flip the first possible stack.
- Look: tavern coasters — leather faces with a drawn rose or skull, patterned backs in seat colours, stacked per
  player, two-point mats, a bid strip with number chips, opponents' stacks become "turn" buttons in the reveal,
  turned discs flip up.## «کودتا» (Coup, 2026-10-08, owner list batch 3)

- Base game for 2–6 players: 15-card court (3 of each role), two influence and two coins each (two players: the
  starting player has one coin). Income, Foreign Aid (any Duke claim blocks), Coup (7, forced at 10+), Tax, Assassinate
  (3; Contessa blocks), Steal (2; Captain/Ambassador block), Exchange (draw 2, keep as many as held). One response
  window per claim: every other living player may challenge or accept, the target (anyone for Foreign Aid) may block;
  a block opens its own challenge window. A true claim costs the challenger an influence and the claimer reshuffles
  the shown card and redraws; a false one costs the claimer and cancels the action. A failed Assassin claim refunds
  the 3 coins; after a lost challenge on Assassinate/Steal the target still gets the chance to block. The first
  player to respond wins the window (no priority ordering between simultaneous challengers). Players choose which
  card to lose when two are face down. Hidden: face-down cards, the deck and the Ambassador's options.
  Timeouts: Income (or Coup on the first opponent at 10+), accept every response, lose the first face-down card,
  keep the first cards offered. Resign reveals both cards.
- Look: plum velvet court, gilt-framed role cards with drawn emblems (crown, dagger, anchor, scroll, fan) in role
  colours, coin pills that bump on change, a claim banner with role tags, action board coloured by claimed role,
  red challenge button, lost cards greyed with a ✕ badge and a flip-in animation, target players pulse while aiming.
- Polish passes (screenshots 360/1440): (1) lost cards keep their emblem readable with a ✕ badge instead of a cross
  over the art; the court uses two columns at 360; (2) the empty event log is hidden and "resolved" lines are dropped;
  (3) hover lifts on action/response buttons replaced by glow — the lift made a button "unstable" under the pointer
  (e2e click stalled at 1440); (4) the court/hand no longer shrink to a narrow column on the result screen.
## «بنگاه» (For Sale, 2026-10-08, owner list batch 4)

- Official 3–6 players plus an unofficial 2-player game (10 property and 10 cheque cards removed; needed for the
  2-seat tutorial). Properties 1–30, cheques 0,0,2–15 ×2; 3 players drop 6 of each, 4 players 2. Coins 18 (5–6: 14).
  Buying: raise or pass in turn; passing takes the cheapest card and refunds half the bid rounded down; the last
  bidder pays in full for the top card and starts the next round. Selling: simultaneous hidden picks, highest
  property takes the highest cheque. Score = cheques + coins; tie → more coins, else shared place. Properties in hand
  and won cheques are private until the end (counts and coins public). Timeouts pass / sell the cheapest property.
  Resign ends the game with the resigner last (same convention as «گاو شش»).
- Look: estate agent's desk; cream property cards with a building that grows by tier (reed hut → house → apartment
  → tower → domed palace), banknote-green cheques (0 is a red «باطل»), cards deal in with a stagger, coin and bid
  bumps, a −/+ bid stepper, pass button shows which card you'd get and what it costs.
- Polish passes (360/1440): (1) SVG text clipped — card SVGs forced to LTR so text anchors are right; sell buttons
  hug the cards; (2) result screen: player strip hidden, totals sorted by place with the winner framed and an
  explicit "cheques + coins = total" line.
## «اشرافی» (High Society, 2026-10-08, owner list batch 4)

- Official 3–5 players plus an unofficial 2-player game (for the 2-seat tutorial). Money 1 2 3 4 6 8 10 12 15 20 25;
  16 status cards (luxury 1–10, prestige ×3, passé, scandal, faux pas); the 4th red-frame card (prestige/scandal)
  ends the game unauctioned. Bids add money cards; passing takes them back. Normal cards: last bidder pays and wins;
  disgrace: the first to pass takes the card and keeps their money, everyone else pays. The winner/taker starts the
  next auction. Faux pas discards the owner's lowest luxury automatically (always optimal: status is monotonic in the
  luxury sum and the tie-break uses the highest card) or the next luxury won. End: the poorest player(s) are out
  unless everyone is equally poor; then status, money, highest luxury card. Hands are private, bids/spent/won public.
- Look: art-deco salon; ivory status cards with gilt numerals (red frames for prestige/scandal, grey for disgrace),
  four red lamps counting red cards, guilloché banknotes (20/25 in gold), tap-to-select note fan that lifts, the bid
  button states the total and the minimum, stage turns red for disgrace auctions, card reveal flip.
- Polish passes (360/1440): (1) stage card enlarged on wide screens; red-frame lamps labelled "قاب قرمز: n از ۴";
  (2) result: players sorted by place, final money shown with "کم‌پول‌ترین" marking the eliminated.
## «سوشی گردان» (Sushi Go!, 2026-10-08, owner list batch 4)

- Original Sushi Go! for 2–5: 108 cards, hands 10/9/8/7, three rounds, simultaneous hidden picks, hands pass to the
  next seat. Chopsticks: pick two, chopsticks return to the passed hand. Wasabi triples the next nigiri. Maki most 6
  / second 3 with ties split (rounded down); a tie for most gives no second. Puddings kept; most +6, fewest −6 (no
  penalty with two players), ties split; all equal → nothing. Score tie → more puddings, else shared place.
  Timeouts pick the first card. Resign ends the game with the resigner last.
- Look: sushi bar; dishes drawn on plates with rim colours per dish family, your hand on a moving conveyor belt
  (plates slide in), tableaux on wooden geta boards grouped by dish with running set points and maki count,
  freshly revealed plates pop in, per-round score table.
- Polish passes (360/1440): (1) pudding counter uses a plate icon instead of an emoji; (2) the middle dot " · "
  next to Persian numerals reads like «۰» — replaced with «،» here and in «کودتا»، «بنگاه»، «اشرافی»; (3) the round
  line is hidden on the result screen.
## «کاوشگران» (Lost Cities, 2026-10-08, owner list batch 4)

- Classic two-player game: five colours (2–10 plus three wagers), hands of 8, place (expedition strictly ascending,
  wagers only before numbers) or discard, then draw from the deck or a discard pile other than the one just used.
  The round ends with the last deck card; expedition = (sum − 20) × (1 + wagers), +20 for 8+ cards. Three rounds
  (option «یک دست»). The loser of a round starts the next (tie alternates) — the published rules differ between
  editions; this is recorded as our choice. Hands/deck hidden. Timeout: discard the lowest card, draw from the deck.
  Resign loses.
- Look: explorer's map table; five colour columns (desert/sea/mountain/jungle/volcano glyphs) with the rival's
  expedition above, parchment discard piles on the map, yours below, live per-expedition scores; striped wager cards;
  pick a card then «روی سفر …» / «دور بینداز» (or tap the glowing pile), piles and deck glow in the draw phase.
- Polish passes (360/1440): (1) stacked small cards show their value strip (top-aligned content, smaller overlap);
  (2) the rival's stack cascades the same way and sits against the map, so every card's value stays readable.
- `simultaneous-actions` capability declared for «سوشی گردان» and «بنگاه» (manifest is descriptive only).
## «هم‌فکر» (The Mind, 2026-10-08, owner list batch 4)

- Cooperative 2–4 players, live and friendly only (a team result has no rating meaning; asynchronous play makes no
  sense for a timing game). Level n deals n cards of 1–100; anyone may play their lowest card at any time — actions
  are ordered by arrival at the server. A card played while someone holds a lower one costs a life and discards
  every lower card. Throwing star: everyone still holding cards must agree; each discards their lowest card. Levels
  12/10/8; lives = players; one star; star after levels 2/5/8, life after 3/6/9 (max 5 lives, 3 stars).
  Turn timeout (a minute of silence): the lowest card on the table is played for its holder (never a mistake).
  Resign ends the game as a team loss.
- Team outcome convention (no SDK change): a team win is every seat at place 1 with reason 'win'; a loss is every
  seat at place 2. The generic result panel now shows «شما بردید» when every seat is first with reason 'win'
  (otherwise a shared first place stays «مساوی»). Server progression already treats equal places neutrally.
- Look: a quiet night table — the pile's top number glows and "breathes", card hue warms as numbers climb, hearts and
  throwing stars in the HUD, teammates show only face-down counts and star votes, one large «بگذار n» button, a red
  flash and a list of discarded cards on a mistake.
## «گوهرفروش» (Splendor, 2026-10-08, owner list batch 5)

- 2–4 players; gems 4/5/7 per colour plus 5 gold; 90 development cards in three levels (40/30/20) and 10 nobles.
  The cards are generated from per-colour cost patterns that follow the original's distribution (levels, prestige,
  cost shapes) rather than a card-for-card copy; nobles are 4+4 of adjacent colours or 3+3+3. Take three different
  gems (fewer only when fewer colours remain), two of a pile with four or more, reserve (face up or blind; max three;
  +1 gold) or buy (bonuses discount, gold is wild). Over ten tokens → return phase. The first eligible noble visits
  automatically at the end of the turn (a choice between two simultaneous nobles is not offered — rare; noted).
  Reaching 15 finishes the round; tie → fewer cards. A `pass` exists only when no other action is legal. Blind
  reserves are hidden from others ({ level } only); deck order hidden. Timeouts: take gems / buy / reserve blind.
- Look: jeweller's velvet; faceted gem chips, ivory cards with a gem-coloured crown band, points and cost pips, a
  faint gem watermark; level decks as striped tiles (معدن / کارگاه / کاروان) that reserve blind; nobles as turbaned
  portrait tiles; rival ledgers show bonuses (squares) and tokens (chips); tap gems to build a take (tap twice for a
  pair), tap a card for «خرید» / «رزرو», shortfall shown when unaffordable.
- Polish passes (360/1440): (1) cards keep a 5:7 shape and the market is capped at 36rem so desktop cards are not
  stretched; a gem watermark fills the card body.
## «کاشی‌کار» (Azul, 2026-10-08, owner list batch 5)

- Standard Azul for 2–4 (fixed coloured wall side): 100 tiles, 5/7/9 factories, factory or centre drafting with the
  first-player marker, pattern lines (one colour, not already on that wall row), floor penalties −1 −1 −2 −2 −2 −3 −3
  (excess tiles beyond seven go to the lid), automatic wall tiling with adjacency scoring, score floored at 0, bag
  refilled from the lid. Ends after the round in which a wall row is completed; bonuses rows 2 / columns 7 /
  colours 10; tie → more complete rows. Only the bag order is hidden (the manifest has no hidden-information flag).
  Timeout: take the smallest group onto the first legal line. Resign ends the game with the resigner last.
- Look: Isfahan tile-work; glazed tiles with an eight-point star (lapis, saffron, pomegranate, black-and-gold,
  turquoise), factories as round kiln plates in a 2×2 grid, a brass centre tray with the «۱» marker, boards in deep
  indigo with stepped pattern lines, a ghost-glazed 5×5 wall and the floor with penalty labels; pick a tile group,
  allowed lines glow; round gains summary.
- Polish passes (360/1440): (1) factory tile groups overflowed the fixed round plates and covered the boards (clicks
  intercepted at both sizes) — each factory tile is now its own button in a 2×2 grid.
## «کاروان» (Jaipur, 2026-10-08, owner list batch 5)

- Two-player Jaipur: 55 cards, market of five (three camels to start), hands of five with camels to the herd, take
  one good (hand limit 7), take all camels, exchange ≥2 market goods for hand goods and/or camels (no camels taken, no
  same type given), sell one type (precious goods need two) for the top tokens plus a hidden 3/4/5+ bonus. The round
  ends with three empty token piles or an unrefillable market; most camels +5; round winner by rupees, then bonus
  tokens, then goods tokens. Two seals win (or three rounds); option «یک دست». The round's loser starts the next.
  Hands, deck and bonus values are hidden (owners see their own bonus values; everything is shown at the end).
- Look: caravanserai market — a red carpet with an indigo and gold border holds the market, goods cards with drawn
  wares, brass-ringed token stacks showing the next value and how many remain, the rival's stall (card backs, herd,
  earnings). Selecting cards drives one action button (take / exchange n / sell n), a camel stepper for exchanges,
  and a separate «همهٔ شترها».
- Polish passes (360/1440): (1) the result screen shows both stalls (yours was hidden with the hand).
## «چهل‌تکه» (Patchwork, 2026-10-08, owner list batch 5)

- Two-player Patchwork, perfect information: 33 patches in a circle — a generated set following the original's sizes
  and cost/time/income ranges, not a piece-for-piece copy — the smallest one right after the neutral token; 9×9
  quilts; 53-space time track. The player behind moves (tie: whoever arrived last). Buy one of the three patches after
  the token (rotate/flip; must fit) or advance one past the opponent for one button per space. Income spaces 5…53 pay
  the buttons sewn on the quilt; the first to pass each leather space (20, 26, 32, 38, 44) places a 1×1 patch at
  once. First complete 7×7 square +7. End when both reach 53: buttons − 2 × empty squares; a score tie goes to the
  player who reached the end first. Timeout: advance (leather on the first empty cell). Resign loses.
- Look: quilter's table; printed fabrics per patch hue with stitched seams and wooden buttons, a linen time track
  (income squares in ochre, leather in brown, blue/red pawns), the next six patches with the first three
  highlighted, rotate/flip tools, green/red placement preview and «بدوز».
- Polish passes (360/1440): (1) sewn cells rendered as plain linen (the empty-cell background overrode the fabric
  classes) — fixed; (2) the time track is capped at 34rem so its squares are not huge on desktop.
## «قلمرو» (Kingdomino, 2026-10-08, owner list batch 5)

- Kingdomino for 2–4: 48 dominoes — a generated set following the original's terrain mix (wheat, forest, lake,
  grassland, swamp, mine; crowns concentrated on rarer terrain and higher numbers), not a copy. 2 players: 24
  dominoes and two kings each; 3 players: 36 and lines of three; 4 players: 48. The first line is picked in random
  king order; afterwards kings act in line order: place the domino (one half next to the castle or matching terrain,
  kingdom within 5×5; discard only when it cannot be placed) then pick from the next line, as one action. Score:
  region size × crowns; tie → largest region, then crowns. Only the deck order is hidden. Timeout: first legal
  placement (or discard) and the first free domino. Resign ends the game with the resigner last.
- Look: illuminated map; painted terrain squares (wheat stalks, tree crowns, lake ripples, meadow dots, reeds, ore),
  gold crowns, castle tile, numbered dominoes with coloured king markers in «این دور» / «دور بعد» lines; your 9×9
  field highlights every cell where the domino can start for the current rotation, with a live preview.
## «بازار سبزی» (Point Salad, 2026-10-08, owner list batch 6)

- 2–6 players; 108 double-sided cards (six vegetables × 18). The scoring rules are generated from the original's rule
  families — vegetable sets, ± per vegetable, even/odd, most/fewest of a vegetable, full sets, most/fewest in total —
  not a card-for-card copy. Three cards of each vegetable per player are used (2 players 36 … 6 players 108). Market:
  three rule piles with two vegetables under each; take a top rule or two vegetables (one if only one is left), then
  optionally flip one of your rules into its vegetable (sent in the same action). Slots refill from the pile above;
  an empty pile borrows from the bottom of the largest. Game ends when all cards are taken; most/fewest compare with
  everyone and ties share. Public information apart from pile order. Timeout: take the first vegetables.
- Look: greengrocer's stall; slatted crates with chalkboard rule cards (rules drawn with vegetable icons) and
  vegetables below; players show vegetable counts and their rules each with live points; tap a rule to flip it.
- Polish passes (360/1440): (1) at 360 the crates overflowed (two fixed 3rem vegetable slots plus a wide rule card) —
  slots now shrink to fit and rule cards on piles are compact.
## «بلوف حشره‌ها» (Cockroach Poker, 2026-10-08, owner list batch 6)

- 2–6 players; 64 cards (eight creatures × 8) all dealt. Give a hand card face down with a claim; the receiver calls
  «راست»/«دروغ» (a right call puts the card in front of the giver, a wrong one in front of the receiver, who then
  starts) or looks («peek», after which they must pass) and passes it on with a new claim to someone who has not seen
  it (never possible with two players; a blind pass is also accepted). Four of one creature face up, or having to give
  with an empty hand, loses. Hidden: hands and the card in play except to those who have seen it.
- Outcome convention: the loser is place 2 and everyone else shares place 1 with reason 'win'; the generic result
  panel now treats any shared first place under reason 'win' as a win (cooperative teams included) — draws keep
  reason 'draw'/'score' and still read «مساوی».
- Look: a smoky card room; creature cards with bold silhouettes on colour fields, the card in play sliding in with
  the claim in a speech bubble and who has seen it, face-up stacks grouped per creature with a throbbing warning at
  three, give/pass built from card + player + claim.
## «سیرک» (Scout, 2026-10-08, owner list batch 6)

- 45 cards (every pair of distinct numbers 1–10). 3 players drop the cards with a 10, 4 players the 9/10, 5 use all;
  2 players are an unofficial variant (cards with 9 or 10 removed, two rounds). Random orientation on the deal; each
  player decides once per round, simultaneously, whether to turn the whole hand over (reversing its order). Hand order
  is fixed. Show adjacent cards forming a set or a run (either direction) that beats the ring's show (more cards → set
  over run → higher lowest number) and capture it; or scout an end card (optionally flipped) into any gap, giving the
  show's owner a chip; Scout & Show once per round (if no show is then possible the turn simply ends). The round ends
  on an emptied hand or when everyone else scouted in a row back to the show's owner, who is then exempt from the
  hand penalty. Score: captured + chips − hand. One round per player.
- Look: circus ring — candy-striped ring with a sawdust centre holding the show, cards with the big top number, a
  star and the other number upside down at the bottom, hue rising with the value; orient choice shows both
  versions of your hand; scouting shows pulsing «+» gaps in the hand.
- Polish passes (360/1440): (1) the upside-down bottom number was pushed outside the card — now anchored inside;
  playing-card glyph replaced with words (it rendered as a box); the ring is visible while choosing the orientation.
## «راه ادویه» (Century: Spice Road, 2026-10-08, owner list batch 6)

- 2–5 players; spices turmeric < saffron < cardamom < cinnamon; caravan limit 10 (excess discarded — the UI offers
  the cheapest). Merchant cards (spice / upgrade N / repeatable trade) and 36 order cards (points = y1 r2 g3 b4 summed)
  are generated sets following the original's kinds and value curve, not copies. Starting hands «2 turmeric» +
  «upgrade 2»; starting spices by seat from the first player 3y, 4y, 4y, 3y+1r, 3y+1r. Play / acquire (one spice
  on each earlier market card; the UI pays the cheapest) / rest / claim (first slot gold 3, second silver 1 while
  2×players of each last). The 6th order (5th with 4–5 players) finishes the round. Score: orders + coins + non-turmeric
  spices; tie → later in turn order. Only deck orders are hidden. Timeout: rest, else play a spice card, else take the
  first market card.
- Look: caravanserai on the spice road; sandstone merchant cards (blue for upgrades, terracotta for trades), golden
  order cards with points and needed cubes, brass gold/silver coin badges, spice cubes left on market cards, a
  trade-count stepper and an upgrade picker with a live preview.
- Polish passes (360/1440): (1) a renderer crash when a selected card stopped being playable for one render (stale
  selection read with a non-null assertion) — the selection is now only used while legal; (2) order and market rows
  are capped at 38rem on desktop.
## «کاغذ و دریا» (Sea Salt & Paper, 2026-10-08, owner list batch 6)

- 2–4 players; 58 cards (duos crab/boat/fish/swimmer/shark, collectors shell/octopus/penguin/sailor, multipliers
  lighthouse/shoal/colony/captain, four mermaids). Card colours follow a fixed rotation over nine colours (mermaids
  white) instead of the printed colours. Draw two (keep one; the other goes to an empty discard pile first) or take a
  pile top; play duos (crab: search a pile, boat: extra turn, fish: draw, swimmer+shark: steal at random); with 7+
  points «بس» or «آخرین فرصت» with the original's caller/others scoring; an exhausted deck ends the round with no
  points; four mermaids win immediately (others share second). Target 40/35/30. Duo pairs count in hand and played.
  Hidden: hands, deck, the two drawn cards and a crab-searched pile (except to the searcher). Timeout: take a pile
  top (or draw and keep the first), then end the turn.
- Look: origami on a paper sea; folded-paper cards (two-tone crease) with geometric creatures, a striped paper deck,
  two discard piles on a watercolour sea, private draw-two choice, duo actions offered from the two selected cards,
  live hand points and «بس!» / «آخرین فرصت» once at 7.
## «آتش‌بازی» (Hanabi, 2026-10-08, owner list batch 7)

- Cooperative 2–5, friendly only; 50 cards, hands of 5 (4 with 4–5 players), 8 clue tokens, 3 fuses. Clue a colour or
  number (must touch a card; marks positive and negative knowledge), discard (+1 clue, not at 8), or play (wrong play
  burns a fuse; a finished colour returns a clue). Deck out → everyone one more turn. Outcome: three fuses (or resign)
  → team loss (everyone place 2); otherwise a team win carrying the stack total as score. Each viewer sees every hand
  but their own (own cards carry only the clue knowledge). Timeout: discard the oldest card (or clue at 8 tokens).
- Look: night sky; firework stacks that burst as they grow, glowing clue tokens and fuses, teammates' firework cards
  with the clues they hold (freshly clued cards flash), your own cards as patterned backs showing what you know,
  including «نه: …» negatives; discard pile shown.
- Polish (360/1440): stacks capped at 30rem; card sparks dimmed so numbers read clearly.
## «مسابقهٔ شترها» (Camel Up, 2026-10-08, owner list batch 7)

- First edition without crazy camels, 2–8 players (2 unofficial). Five camels on 16 spaces stack and carry the camels
  on top; five 1–3 dice drawn at random from the pyramid (+1 coin). Leg-bet tiles 5/3/2 per camel; one desert tile per
  player (oasis +1 on top / mirage −1 underneath; not space 1, not under camels, not on or beside another tile; owner
  +1 coin on landing), reset each leg. Leg scoring: tile value for the leader, 1 for second, −1 otherwise. Crossing
  space 16 ends the game; overall winner/loser bets pay 8, 5, 3, 2, 1, 1… in placing order, −1 if wrong. Coins never
  drop below 0. Start 3 coins. Hidden: overall bets (count public; own bets shown to you); all revealed at the end.
  Timeout: roll a die.
- Look: desert race course; 16 sand tiles in two rows with painted camels stacked (top drawn highest, hop animation),
  oasis/mirage badges, pyramid button with remaining dice and the last roll announced, leg-bet tiles in camel colours,
  secret overall-bet buttons per unused camel card.
- Polish (360/1440): «پایان» marker moved onto space 16; track capped at 42rem; bigger camels on desktop.
## «شهر تاس» (Machi Koro, 2026-10-08, owner list batch 7)

- Base game, 2–4 players, perfect information: start Wheat Field + Bakery + 3 coins; all 15 establishments on display
  (6 each; majors one per player); landmarks Train Station 4, Shopping Mall 10, Amusement Park 16, Radio Tower 22. Roll
  1 (or 2 with the station) dice; Radio Tower: one reroll; resolution red (counter-clockwise from the roller) → blue/
  green → purple (Stadium automatic; TV Station and Business Center ask the roller). Mall +1 for cup/bread cards.
  Build one card or landmark, or pass; doubles with the Amusement Park give another turn; four landmarks win.
  Timeout: roll one die, decline purple choices, build nothing.
- Look: toy town; establishment cards in their colours with activation numbers and effect lines, tumbling dice with
  the sum and everyone's income from the roll, supply grid with prices and stock, landmarks that light up gold.
## «غول‌های شهر» (King of Tokyo, 2026-10-08, owner list batch 7)

- 2–6 players, base rules with a single Tokyo spot at every count (no Tokyo Bay for 5–6 — a stated simplification).
  Six dice, up to three rolls keeping any; numbers score on three of a kind (+1 per extra), hearts heal outside Tokyo,
  bolts give energy, claws hit Tokyo from outside or everyone from Tokyo; a hit Tokyo monster may yield (the attacker
  enters); entering +1 VP, starting a turn inside +2 VP. Power cards: a curated 23-card set of base-style discard and
  keep effects with Persian names (not the full 66): VP/energy/heal/damage discards and keeps like armour, acid,
  regeneration, extra energy, bigger, herbivore, urbavore, alpha, solar, underdog. 2 energy sweeps the market. 20 VP
  or last monster alive wins. Timeouts: resolve what is on the table, stay in Tokyo, buy nothing.
- Look: neon city at night; skyline arena showing the monster in Tokyo (stomp animation), monster panels in their own
  hue with health and 20-point star bars and energy, chunky dice that lift when kept, comic-style power cards.
- Polish (360/1440): bar labels centred on the bars.
## «ارگ‌ها» (Citadels, 2026-10-08, owner list batch 7)

- 2–7 players with the eight base characters and the 54 coloured districts; purple special districts are left out
  (so the colour bonus is +3 for all four colours). Draft from the crowned player: one character removed face down,
  2/1 face up with 4/5 players (never the King); 2–3 players each take two characters in turn order (a simplified
  draft without the 2-player discard sequence). Characters called 1→8: 2 gold or draw 2 keep 1; build one district
  (Architect: +2 cards, three builds); Assassin kill, Thief rob (paid when the victim is called), Magician swap/redraw,
  King crown (also at round end if killed), Bishop protected, Merchant +1, Warlord destroy at cost − 1 (not completed
  cities, not the living Bishop); colour income automatic. No duplicate districts. Eighth district ends the game
  after the round: costs + 3 four colours + 4 first / + 2 other completed cities. Timeouts: first character, gold, end.
- Look: illuminated city chronicle; parchment district cards with colour banners and gold-coin costs, gilded
  character seals in a 1–8 track marking called, killed and robbed characters and their holders, the draft pool only
  for the picker, an ability panel for the active character.

## «قلعه‌سازان» (Carcassonne, 2026-10-08, owner list batch 8)

- 2–5 players, base game's 72 tiles (24 types, counts as published) with the start tile in the middle; farmers and
  fields are left out (the common beginner rule). Each player has 7 followers. Placing: the drawn tile must touch the
  map and match every touching edge; a tile with no legal spot anywhere is discarded. One follower may go on a city,
  road or monastery of the placed tile if that city/road has no follower yet. Completion: city 2 per tile + 2 per
  pennant, road 1 per tile, monastery 9 when surrounded; most followers score (ties all), followers return. End: city
  1 per tile + 1 per pennant, road 1 per tile, monastery 1 + neighbours. The stack order is hidden; the drawn tile is
  public. Timeout: first legal spot, no follower.
- Look: wheat-field tiles drawn in SVG (sandstone cities with dashed terracotta walls, cream roads, red-roofed
  monasteries, blue pennants) on a dark oak, scrollable/zoomable map (LTR, module coordinates); legal spots glow, the
  chosen spot shows a live preview of the rotated tile and follower; the last tile is outlined in its owner's colour.

## «لوبیاکاری» (Bohnanza, 2026-10-08, owner list batch 8)

- 2–5 players (the 2-player count uses the same rules), the ten base bean types (150 cards, published counts and
  beanometers; no cocoa/expansion beans). Five cards each; hand order is fixed and private. Turn: plant the first
  card (must) and the second (may) into a field holding the same bean or empty; flip two; the active player makes
  offers to one player at a time (face-up and/or hand cards given, bean types wanted; an empty want is a donation)
  that the target accepts (first matching cards from hand) or declines; ending the trade gives the active player the
  remaining face-up cards; everyone then plants what they received (any order, harvesting first if needed); the
  active player draws three. Harvest any time with the single-bean protection rule; coin cards leave play. Third
  field for 3 coins. Simplification: one pass through the deck (no reshuffles) — when the deck cannot supply a flip
  or draw, all fields are harvested and the most coins win (ties share). Other players cannot start their own trades.
- Look: market-garden table — tall seed-packet bean cards with beanometer strips (thresholds light up as a field
  grows), furrowed soil plots, a burlap trade cloth with the deck, an offer builder and a paper offer slip.

## «شگفتی‌ها: دوئل» (7 Wonders Duel, 2026-10-08, owner list batch 8)

- Two players; the 12 base wonders (8 drafted 4 + 4 in the A·B·B·A / B·A·A·B order), 10 progress tokens (5 on the
  board), 66 age cards + 7 guilds with Persian names and effects modelled on the base game (costs/values close to the
  published ones but not a verified one-to-one reproduction). Card structures: Age I 2-3-4-5-6, Age II 6-5-4-3-2,
  Age III 2-3-4-2-4-3-2 with 3 random guilds; alternate rows face down, revealed when uncovered. Build (resources,
  choice producers, trades at 2 + opponent brown/grey or 1 with a reserve; chains free), discard for 2 + yellow cards,
  or a wonder (max 7 total; Theology/replay wonders give another turn). Military tokens at 3/6 (2/5 coins), supremacy at
  9; science pairs → progress token, six symbols (law counts) win; civilian VP with blue tie-break otherwise.
- Simplifications: the weaker military player starts the next age (no choice prompt; tie → the player who did not
  take the last card); the Great Library offers three random out-of-game tokens only to its builder.
- Look: sandstone court with lapis wonder plates (gold when built), coloured effect bands on cards, age-specific card
  backs, a bronze conflict track with coin tokens and a sliding pawn, green progress discs.

## «قلمرو» (Dominion, 2026-10-08, owner list batch 9)

- 2–4 players with the base treasures/victory cards (no Curse pile, since no kingdom card gives curses) and the
  "first game" kingdom: Cellar, Moat, Merchant, Village, Workshop, Militia, Remodel, Smithy, Market, Mine (10 each).
  Province/Duchy/Estate piles 8 (2 players) or 12. Turn phases action → buy (playing treasures or buying ends the
  action phase) → cleanup. Choices of Cellar/Workshop/Remodel/Mine travel with the play command. Militia: every other
  player with more than 3 cards discards to 3 at the same time; Moat in hand reveals automatically. Merchant's +1
  applies to the first Silver played. End after the turn in which Provinces or three piles run out; ties share
  (no fewer-turns tie-break). Hidden: hands, deck order and discard piles below the top card.
- Look: royal ledger — parchment cards with a wax cost seal and a type band (gold treasure, green victory, red
  attack, blue reaction), supply piles on a crimson velvet board, the turn tally as pills.

## «نبرد ستاره‌ها» (Star Realms, 2026-10-08, owner list batch 9)

- Two players, 50 authority, 8 Scouts + 2 Vipers; first player draws 3. The 65-card trade deck is generated (original
  Persian names; costs and effects modelled on the four factions of the base game, not a verified reproduction; "or"
  choices folded into fixed effects; no base-destroy effects on ships). Explorers unlimited. Ally abilities fire
  automatically once per card per turn when another card of the faction is in play (bases included); scrap abilities
  are optional one-shots; Machine Cult scrap and Blob trade-row scrap are allowances; Star Empire discards are
  resolved by the opponent at the start of their next turn. Bases re-apply their primary ability at the start of each
  of their owner's turns; outposts must fall before other bases or the player. Authority ≤ 0 loses.
- Look: starfield bridge — faction-framed glowing cards with a faction emblem, red/blue authority orbs, trade row
  band, pooled trade/combat pills, fleet line of played ships.

## «خدمه: سیارهٔ نهم» and «خدمه: اعماق دریا» (The Crew ×2, 2026-10-08, owner list batch 9)

- Shared trick core in `games/the-crew/src/trick.ts` and a module factory (`crewModule`) used by both editions:
  40 cards (four colours 1–9, rockets 1–4 as trumps), follow suit, rocket 4 holder is commander and leads; one
  communication per player per mission between tricks (highest/lowest/only card of a colour, shown publicly).
  3–5 players; with 3 the one card that does not divide evenly is set aside face up (never rocket 4). The tutorial
  tables have two seats, so setup accepts 2 players only for the scripted tutorial deal. Cooperative outcome:
  success = everyone place 1 (reason win), failure/resign = everyone place 2. One mission per table.
- Planet Nine: host picks mission 1–10 (task count and order tokens: relative numbered order and "last");
  tasks are task cards drafted from the commander clockwise; a task fails if anyone but its owner wins it.
  Not the 50-mission logbook (no dead-zone/distress rules) — a compact mission ladder instead.
- Deep Sea: host picks a difficulty target (3–11); condition tasks (15 original conditions such as win a nine,
  win no tricks, exactly N tricks, last trick, no rockets, more pink than blue) are revealed until their difficulty
  sum reaches the target, then drafted. Not the published task-card list.
- Look: mission console — space theme (violet nebula) for Planet Nine, sea theme (teal depths) for Deep Sea; task
  cards with order tokens and ✓/✗ status, a trick table with player names, crew pills showing the communicated card.

## «پایگاه فضایی» (Space Base, 2026-10-08, owner list batch 10)

- 2–5 players, 12 sectors each with a starting ship; roll 2d6 and choose separate sectors or the sum — the roller's
  choice applies to everyone (simplification: in the published game each player chooses for themselves). Blue
  rewards for the roller's stations, red rewards for everyone else's deployed ships; buy at most one ship per turn
  (the old station is deployed); credits rise to income at the end of your turn; the game ends after the turn in
  which someone reaches 40 VP. Starting credits 3, 4, 5… in turn order.
- The ship list is generated (sector × level 1–3 × 2 variants = 72 shop ships with original names; rarer sectors pay
  more); no charge, colony or special-ability cards.
- Look: hangar console — gunmetal panels, cyan station rewards and amber deployed rewards per bay, dice that light
  up the bays they hit, a shipyard with level-coloured frames.

## «نبرد تاس» (Dice Throne, 2026-10-08, owner list batch 10)

- Two players; four original heroes (mountain warrior, shadow runner, fire-starter, guardian of light) with their own
  die faces, five abilities each (symbol counts with tiers, combos, small/large straights, an undefendable ultimate)
  and defence dice. 30 HP (shortened from 50 for a single-session duel), 2 CP (max 15), +1 CP per turn. Up to three
  rolls keeping any dice, extra rolls for 2 CP; defendable attacks wait for the defender's defence roll. Statuses:
  wound (1 HP per stack at upkeep, max 3), stun (lose the next offensive phase), shield (prevent 3 once). No card
  deck — CP only buys extra rolls and moves through abilities. Hero pick: first picker also plays first.
- Look: arena — stone floor, hero-coloured banners with a sliding health bar and status badges, chunky dice showing
  the hero's symbols (tap to keep), an ability board that lights up the combos your dice make.

## «راه الدورادو» (The Quest for El Dorado, 2026-10-08, owner list batch 10)

- 2–4 players on one fixed 11×6 hex map (odd-r offset; jungle/water/village costs 1–3, rubble = discard N cards,
  base camp = remove N cards, mountains blocked, four start hexes and four El Dorado hexes). The map is shorter than
  the published modular boards so an online race fits one session; no blockade tiles or caves.
- Start deck 3 explorers, 1 sailor, 4 travellers; hand of 4. A card's points can be spread over consecutive hexes of
  its colour (jokers fix their colour on first use), cards are never combined for one hex; occupied hexes are blocked.
  One purchase per turn with coin points (other cards count ½); the whole market (18 types, 3 each) is open from the
  start; single-use cards leave the game when used. Reaching El Dorado ends the game at the end of the round:
  arrivals share first place, the rest rank by distance.
- Look: explorer's map — parchment frame around an SVG hex jungle, glowing reachable hexes for the selected card,
  coloured expedition pawns, seed-packet style cards and a market strip.

## «آرکانا» (Res Arcana, 2026-10-08, owner list batch 10)

- 2–4 players. Original card set in the spirit of the game: 24 artifacts (each player is dealt 6: 3 in hand, 3 in a
  private deck), 4 mages (collect two essences), 5 places of power (cost, VP, collect or a VP power) and 6 monuments
  (4 gold, 2 VP, two face up). Essences fire/life/calm/death/gold, everyone starts with one of each. Round: collect,
  then single actions in turn until all pass (play, tap once per round, buy, discard for 1 gold or 2 of an essence,
  pass = draw 1; first to pass leads next round). Ends at the end of a round with someone on 10+ VP; most VP wins,
  ties share. Not included: attacks, dragons/creatures, reactions, "any essence" costs, mage/item drafting.
- Look: alchemist's table — faceted essence gems, vellum card plates (cost / collect / power rows), a velvet shelf
  for places of power and monuments, tapped cards tilt.

## «رقابت کهکشانی» (Race for the Galaxy, 2026-10-08, owner list batch 10)

- 2–4 players. Original generated card set: 3 start worlds, 32 worlds (production/windfall/military with four good
  colours) and 20 developments with simple powers (develop −1, settle −1, military, explore +1, consume +1). Hand of
  4 at start (no draw-6-discard-2). Each round every player secretly chooses one of five phases; chosen phases run
  in order for everyone with a bonus for the chooser (explore 4 instead of 2, develop −1, settle draws 1 afterwards,
  consume ×2, produce also fills windfalls). Placement pays in cards from hand; military worlds need military ≥
  defence. Consume turns each good into VP chips (no trade); hand limit 10. Ends after a round with a 12-card
  tableau or an empty chip pool (12 per player). Not included: trade, search, takeovers, 6-cost dev bonuses, goals.
- Look: star-chart command deck — five phase tiles with emoji glyphs (secret choice, then lit when chosen), planet
  orbs coloured by good with glowing goods, violet hex developments, empires waiting on others outlined in amber.

## Game screen: fullscreen target and stage restyle (2026-10-08)

- Fullscreen now targets the `.game` container, which fills the screen and scrolls itself. Fullscreen on `<html>`
  hid the board: browsers force `overflow: hidden` on a fullscreen root (measured: computed `overflow-y: hidden`),
  so anything below the fold could not be reached. Dialogs/drawers are native modal `<dialog>`s in the top layer and
  still show; toasts (fixed in `<body>`) are not visible while fullscreen.
- The table stage is a single graphite panel instead of walnut rim + felt + the game's own panel; the status strip
  is one slim sticky line with an accent edge for "your move" (no full-colour slab covering the board on phones);
  tutorial text appears once, in the tutorial panel. Phones hide the table subtitle line.

## «نبرد دریایی» (Battleship, 2026-10-08, owner request)

- Two players, 10×10 sea each, fleet 5/4/3/3/2 (aircraft carrier, battleship, destroyer, submarine, patrol boat),
  horizontal or vertical, no overlaps (touching allowed). Placement is simultaneous and secret (manual with a
  rotate toggle, or a local random layout to start from, then confirm); then single alternating shots — no extra
  shot on a hit (the classic rule). Sunk ships are announced and revealed; first to sink the whole fleet wins.
  Timeouts place a random fleet or fire at the first open cell.
- Look: two vintage nautical charts — parchment frame with sepia Persian coordinates (rows الف…د, columns ۱…۱۰),
  deep water with wave hatching, drawn steel hulls with deck guns, flame bursts for hits, splash rings for misses,
  darkened hulls when sunk; a fleet tray for placement.
