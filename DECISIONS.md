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