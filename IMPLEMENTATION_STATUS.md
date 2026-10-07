# Implementation status

## Game table, Board Game Arena style (2026-10-07): DONE locally — real devices UNVERIFIED

While a game is running the shell hides its sidebar and dock and the table takes the screen: game bar (back, title,
connection, chat, rules), sticky status strip that always says whose move it is (brass when it is yours, with timer
and tutorial hint), a walnut-rimmed felt table with grain and lamp light, and player boards with per-seat colour
stripes and a turn chevron (horizontal strip on phones). Renderers sit on the table in the night palette.
Checks run: lint, typecheck, build clean; E2E 52 passed, 10 skipped by design (axe light and dark included).
Full-page screenshots draw sticky bars at the scroll position; a viewport capture at 360px confirmed the mobile
header stays at the top, so the "header in the middle" seen in evidence images is a capture artifact.

## VibeFarsi "Anar" redesign (2026-10-07): DONE locally — real devices UNVERIFIED

Whole site moved to the VibeFarsi Anar (pomegranate) design language with an owner-requested custom café palette
(felt green + brass); Tailwind v4, Vazirmatn, lucide icons, 58 VibeFarsi registry files vendored under
`packages/ui/src/vf/` (MIT) and VibeFarsi's own keyframes. Hand-redesigned: shell (girih background, clay sidebar,
floating mobile dock), login (step dots, +98 phone field, six-cell OTP with paste/SMS autofill, error shake),
dashboard (felt hero), plans (Toman prices, featured plan), payment result (success check + confetti), table result
(winner confetti, podium). Every other page inherits the language through the rewritten shared components and
`apps/web/src/styles.css`.
Checks run: lint clean (2 upstream VibeFarsi hook warnings); typecheck clean; build OK; contrast script 0 failures;
unit/integration 175 passed; E2E 52 passed, 10 skipped by design (includes axe light at 4 widths, axe dark).
Supersedes the cobalt/Estedad café redesign below.

## Visual redesign "board-game café" (2026-10-07): DONE locally — real devices UNVERIFIED

New tokens (light/dark following the device), Estedad, walnut navigation, felt and card-stock materials, pill controls.
Checks run: contrast script 0 failures (42 pairs, both themes); axe 0 serious/critical in light (21 pages × 4 widths) and
dark (6 pages × 2 widths); lint, typecheck, build clean; unit/integration 165 passed; E2E 52 passed, 10 skipped by design.
Screenshots: `docs/evidence/redesign/` (dark) and `docs/evidence/phase-04/screenshots/` (light).

## Risk (2026-10-07): DONE locally — real devices UNVERIFIED

New module `games/risk` (classic rules, original world map with sea lanes, zoomable, cards, dice tray, tutorial)
registered in engine, catalog and web. Checks run: engine 25 (`packages/game-engine/test/risk.test.ts`: map integrity
and geometry/adjacency match, setup, reinforcement + card values, forced trades, dice rules, blitz, occupy, elimination,
fortify modes, both goals, timeouts, resign, redaction, tutorial, 20 random games + replay); API 3
(`apps/api/test/risk.test.ts`); catalog test updated; E2E `e2e/risk.spec.ts`: three browsers place starting armies and
play 6 turns incl. a blitz attack at 360 and 1440 — 2/2 passed (screenshots `docs/evidence/risk/`). Full world conquest
through the browser not run (engine-tested). Error texts for the new codes added to `GAME_ERRORS_FA`.

## Game visuals, board zoom, phone landscape (2026-10-07): DONE locally — real devices UNVERIFIED

All eight renderers redrawn as physical tabletop objects (wood frames, illustrated terrain/maps, 3D pieces, real dice,
illustrated cards); Unmatched gets thematic battlefields, hero/sidekick emblems and illustrated cards. Shared
`ZoomBoard` (`packages/ui/src/zoom.tsx`): buttons, ctrl+wheel, pinch, drag-pan, double-tap, full screen (landscape
lock where allowed); used by Catan, Ludo, Snakes and Ladders, Unmatched. Phone landscape (`max-height: 560px`): board
and panel side by side, board fits the screen height, shell status strip stops sticking. Checks run: E2E 26 game flows
at 360/1440 + `e2e/board-zoom.spec.ts` (780×360 landscape: fit, zoom, pan without a move, tap after zoom) — all passed;
engine 113/113; typecheck; lint (games, ui). Screenshots refreshed under `docs/evidence/*`.

## Catan (2026-10-07): DONE locally — real devices UNVERIFIED

New module `games/catan` (base game rules from the owner-supplied rulebook, 3–4 players, variable or beginners' map,
renderer with vector island, cover, tutorial) registered in engine, catalog and web. Checks run: engine tests 22
(`packages/game-engine/test/catan.test.ts`: geometry, both maps, 6/8 rule over 200 seeds, snake set-up + starting
resources, road/settlement/city rules and limits, production incl. robber and bank shortage, 7 discard/robber/steal
redaction, 4:1/3:1/2:1 and domestic trade, development cards, Longest Road break, Largest Army, hidden-VP win, timeouts,
resign, projection redaction, tutorial, 30 random games to a winner with card conservation + replay); API 3
(`apps/api/test/catan.test.ts`); E2E `e2e/catan.spec.ts`: three browsers create a live
beginners'-map table, do the whole set-up phase and 8 regular turns (roll, discard/robber/steal on 7) through the UI at 360
and 1440 — 2/2 passed (screenshots `docs/evidence/catan/`). Run on an isolated API/Vite/worker (ports 3100/5175/3110)
because the shared dev Vite on 5173 was serving another session's catan stub. Engine suite 113/113, typecheck, lint
(catan files), web build clean. Not done: full game to 10 VP through the browser
(engine-tested only), load-test driver entry, 5–6 player extension.

## «املاک» (Monopoly-style, 2026-10-08): DONE locally — real devices UNVERIFIED

New module `games/amlak` (board data, rules, renderer, cover, tutorial) registered in engine, catalog and web. Checks
run: engine 14 (`packages/game-engine/test/amlak.test.ts`: rent cases, auction, building/selling evenly with bank supply,
mortgages, jail, cards, multi-party debts, bankruptcy, trades with mortgage interest, house rules, round limit,
timeouts, tutorial, 30 random 2–6 player games with money/supply/card invariants and replay); API 3
(`apps/api/test/amlak.test.ts`); catalog test updated (now also lists risk and ticket-to-ride from parallel sessions);
E2E `e2e/amlak.spec.ts` — 20-round two-player game incl. a trade offer through the UI at 360 and 1440 (screenshots
`docs/evidence/amlak/`). Engine suite 173/173. Found and fixed a shared `SegmentedControl` overflow at 360px.
Not run: full web typecheck (ticket-to-ride renderer from another session does not compile yet).
Visual pass (same day): new `board-art.tsx`, which adds a walnut-framed board, Tehran skyline centre, chance/chest decks,
illustrated corners, houses/hotels, owner ribbons, mortgage stamp and domed pawns, plus title-deed cards, drawn-card
face, wallets and bid chips in `renderer.tsx`/`renderer.css`. Board is now inside `ZoomBoard`. Re-run: amlak tsc + eslint clean;
E2E passed at 360 and 1440 after the change.

## Snakes and Ladders + Ludo (2026-10-07): DONE locally — real devices UNVERIFIED

New modules `games/snakes-ladders` and `games/ludo` (rules, vector boards, renderers, covers, tutorials) registered in
engine, catalog and web. Checks run: engine tests 12 (`packages/game-engine/test/race-games.test.ts`: board data, moves,
ladders/snakes, exact/bounce finish, entering on 6, extra roll, three tries, capture, own-piece blocking, goal rules,
ranking, timeouts, resign, tutorials, 30 + 40 random games with replay and a no-stacking invariant); API 6
(`apps/api/test/race-games.test.ts`); catalog test updated; E2E `e2e/race-games.spec.ts` — 3-player Snakes and Ladders and
2-player Ludo played to the result through the UI at 360 and 1440 (screenshots `docs/evidence/race/`). Engine suite
113/113; lint/typecheck clean.

## Chess (2026-10-07): DONE locally — real devices UNVERIFIED

New module `games/chess` (rules, renderer, cover, tutorial) registered in engine, catalog and web. Checks run: engine tests
13 (`packages/game-engine/test/chess.test.ts`: perft on 5 reference positions, SAN, castling/en passant/promotion, all draw
rules, timeout, tutorial, 40 random games + replay); API 3 (`apps/api/test/chess.test.ts`: catalog, option injection refused,
command path, server tutorial to mate); catalog test updated (now lists chess and catan); E2E `e2e/chess.spec.ts`: Fool’s Mate
through the UI at 360 and 1440, Black’s board orientation checked (screenshots `docs/evidence/chess/`). Lint/typecheck clean.

## Unmatched — Battle of Legends Vol. 1 (2026-10-07): DONE locally — real devices UNVERIFIED

New module `games/unmatched`: core rules (owner-supplied core rulebook) for duel and free-for-all (2–4 players), heroes
King Arthur, Medusa, Sinbad, Alice with all 30-card decks and effects, battlefields Marmoreal and Sarpedon (original
vector board), in-game hero pick, deployment, Alice size, tutorial. Registered in engine, catalog and web.
Checks run: engine tests 17 (`packages/game-engine/test/unmatched.test.ts`, incl. rulebook combat example and a 60-game
random-play fuzz checking no hand leaks + deterministic replay), API integration 3 (`apps/api/test/unmatched.test.ts`),
E2E `e2e/unmatched.spec.ts`: two browsers pick, deploy and fight a duel to the result at 360 and 1440
(screenshots `docs/evidence/unmatched/`). Full workspace `pnpm test` 195 passed; typecheck clean; lint 0 errors.
Not done: team mode, other Unmatched sets/maps, load-test driver entry, FFA E2E (FFA covered by engine tests only).

**Cobble & Fog added (2026-10-07):** Sherlock Holmes, Dracula, Jekyll & Hyde, Invisible Man; maps SoHo and Baskerville
Manor (secret passages). Engine tests now 25 (8 targeted Cobble & Fog tests + a 160-game random fuzz over all 8 heroes and
4 maps); API 3/3; E2E three duels (Vol. 1 on Marmoreal, Invisible Man vs Jekyll on Baskerville, Holmes vs Dracula on SoHo)
at 360 and 1440 — 6/6 passed. Note: E2E ran with a temporary Vite alias stubbing `@bg/game-catan` cover/renderer, which
another session was still building; full-workspace `pnpm test`/build were not re-run because that module is incomplete.

## UNO (2026-10-07): DONE locally — real devices UNVERIFIED

New module `games/uno` (rules, original card faces, renderer, cover, tutorial) registered in engine, catalog and web.
Checks run: rules unit tests 24 (`packages/game-engine/test/uno.test.ts`), API integration 3 (`apps/api/test/uno.test.ts`:
catalog/variants, hidden hands over HTTP, server tutorial to completion), E2E `e2e/uno.spec.ts`: three browsers play a
full hand through the UI at 360 and 1440 (screenshots `docs/evidence/uno/`). Not yet in the load-test driver.

## After DRAGON-04 — admin-controlled game settings (2026-10-07): DONE

Admin panel «تنظیمات بازی‌ها» chooses per game, within what the module supports: paces, friendly/ranked, player
range, offered live time budgets and turn deadlines, and each rule variant's allowed choices / default / host choice.
Enforced server-side on create, matchmaking and start; running tables unchanged; variants shown on detail, create and
lobby; audited. Fixed: re-seeding no longer overwrites admin choices (access, modes, players).
Checks run: lint clean, typecheck 0 errors, build OK, `pnpm test` 138 passed (new `game-settings.test.ts` 4),
E2E 47 passed / 6 skipped in the full run plus one a11y timeout at 1920 (bounded `networkidle` wait added; 4/4 passed on rerun),
new E2E: admin restricts Line Three → player sees only the offered mode and fixed variant (360 and 1440).

## DRAGON-04 — release candidate: LOCAL CANDIDATE COMPLETE; public release NOT READY

### Checklist

1. Audit — ✅ FR-01..16 / NFR-01..08 re-audited (REQUIREMENTS_TRACEABILITY.md); auth/cookie/CSRF/socket origin, RBAC,
   hidden information, log/metric redaction, XSS, rate limits, schemas, fixture exclusion checked
   (docs/QA_REPORT.md#security-review-item-1). Gaps closed: admin missions, subscriptions view, audit filters,
   proxy-trust hop count, metrics hardening, CSP-compatible theme bootstrap.
2. Admin/screens — ✅ games/versions/tutorials, access, plans, seasons, missions, support (XP, premium, subscriptions,
   payments), incidents, moderation + audit filters; route code-splitting; axe 0 violations on 21 pages × 4 widths;
   92 screenshots; keyboard smoke. Safari iOS / Chrome Android: **UNVERIFIED** (no devices).
3. Production — ✅ multi-stage non-root images (api/worker/migrate/web + postgres), Caddy HTTPS/WebSocket proxy with
   security headers, internal DB network, secrets from environment, config validation (fail closed), graceful
   shutdown (API + worker drain), readiness, migrate/seed one-shot, release procedure, Coolify guide (not executed).
4. Observability — ✅ `/api/metrics` (server move latency excl. network, commands by outcome, stale errors, module
   failures, sockets, tables, moves/min, outbox/deadline backlog, payments, process resources) + worker metrics;
   SLO 99.5 % definition, maintenance and incident rules (docs/OPERATIONS.md) — not claimed achieved.
5. Load — ✅ 4 profiles, both games, hidden + public state, concurrency, reconnects, duplicates, worker restart;
   two defects found and fixed (missed-push race on subscribe; per-subscriber snapshot rebuild). Safe bound
   ≤ 150 concurrent live players per API instance (docs/QA_REPORT.md#load).
6. Backup — ✅ age-encrypted WAL archive + base backups; isolated drill twice: identical data, RPO 32 s, RTO 19.5 s,
   deadline/outbox resume, pinned versions, 0 duplicate rewards; Redis not used. Target-environment drill: BLOCKED.
7. Final verification — ✅ lint, typecheck, build, 134 tests, migrations from scratch, E2E 46 passed / 4 skipped;
   one independent read-only review (findings fixed, see DECISIONS.md).
8. Docs — ✅ OPERATIONS, DEPLOYMENT, RELEASE_CHECKLIST, QA_REPORT, KNOWN_LIMITATIONS, MIGRATIONS; API, UI_INVENTORY,
   ADDING_A_GAME updated; openapi.json regenerated (103 paths).

### Verification actually run

| Command | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | clean / 0 errors / OK |
| `pnpm test` | **134 passed** (contracts 13, web 8, engine 17, play 7, api 88, worker 1) |
| `npx playwright test` | final run **46 passed, 4 skipped**; earlier runs: one 3-player flake (diagnosed: test ignored a legitimate STALE rejection; fixed, 12/12 repeats), one social-flow timeout (passed 2/2 isolated + 2 later full runs; not diagnosed) |
| `docker compose -f compose.prod.yaml build/up` (throwaway env) | all healthy; proxy/header/CSRF/WebSocket/metrics/non-root/read-only checks (DEPLOYMENT.md) |
| `node apps/api/load/loadtest.ts` × 4 profiles | `docs/evidence/phase-04/load/*.json` |
| `docker/backup-drill.sh` × 2 | `docs/evidence/phase-04/backup-restore-drill*.log` |
| `docker/postgres/selftest-failures.sh` | PASS |

### Blockers (public release)

Real SMS provider; real payment gateway + credentials + approved prices; hosting/domain; off-host encrypted backup
storage + key custody + target restore drill; real-device tests (Safari iOS, Chrome Android); load test on target
hardware; owner approval of catalog/branding. See docs/KNOWN_LIMITATIONS.md and docs/RELEASE_CHECKLIST.md (Gate B).

## DRAGON-03 — ranking, progression and premium: COMPLETE (implementation); production provider NOT ready

### Checklist

1. Rating — ✅ uncertainty-aware multiplayer model with ties (Weng–Lin BT), simulation for 2–4 players, new account,
   repeated opponent, resignation/timeout, ties (`docs/evidence/phase-03/rating-simulation.md`); per game and pace;
   provisional and leaderboard eligibility configurable; result → history exactly once; only ranked matchmade tables
   are rated; ranked queue by skill, never premium priority.
2. Seasons — ✅ configurable seasons, league placement after min games, leaderboard eligibility, freeze on close
   (DB trigger) with audited correction; bronze…master display; ranking/league/stats pages; core history free,
   trends premium.
3. XP etc. — ✅ XP/account level, per-game mastery, weekly missions, achievements from server events only;
   versioned ledger with unique source keys; daily cap, repeated-opponent policy, manual reward with reason;
   cancelled results award nothing; rewards shown after games only; cosmetics only.
4. Payments — ✅ plans, monthly/yearly, history, entitlements, checkout/status, gateway adapter boundary with
   server verification; order/user/amount/currency/reference binding; idempotent callbacks; failed/pending/delayed/
   expired; reconciliation and user re-check; fake gateway development-only and labelled; production disabled
   without provider (blocker recorded); no auto-renewal.
5. Access — ✅ per-game premium, host-invites-free, turn-based caps; checks on create/join/start with start
   snapshot; expiry mid-game never ends a session; admin controls and audits.

### Verification actually run

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm check` | lint/typecheck/build OK; tests: contracts 13, web 8, engine 17, play 7, api 85, worker 1 → **131 passed** |
| `npx playwright test` | **30 passed** (incl. ranked result → rewards/progress/ranking and dev checkout at 360 and 1440) |
| `pnpm --filter @bg/play simulate` | `docs/evidence/phase-03/rating-simulation.md` |
| migration 0004 (incl. freeze trigger) | applied to dev DB |

Integration coverage (`progression.test.ts`, `billing.test.ts`): manual ranked refused; ranked result once under
double redelivery; reordered events; friendly never rated; shared placement equal updates; season placement,
freeze rejected by DB, audited correction, closed-season board, single season badge; leaderboard eligibility;
XP/missions/achievements/mastery; tutorial XP once; repeated-opponent and daily-cap reasons; cancelled table no XP;
client claim endpoints 404; manual reward audited; unpriced plan not purchasable; production refuses fake gateway;
pending then verified with triple callback → one subscription; forged/wrong-provider/declined/amount-mismatch/
duplicate-reference never activate; failed stays failed; delayed → reconciliation; expiry; renewal extends;
expiry job; premium host + invited free friend; public join refused; eligibility snapshot; revocation mid-game
doesn't stop play; host expired before start refused; caps; queue order unaffected by premium; trends premium.

Bugs found and fixed: volume-inflated display rating (design change), simulator noise mismatch, payment redirects
to a different host than the session (`PUBLIC_WEB_URL`).

### Blockers / limitations

- **Payment provider**: none selected; no credentials; prices not approved → production checkout disabled.
  No real money tested. See docs/PAYMENTS.md checklist.
- **OTP SMS provider**: still missing.
- Rating parameters and reward values are untuned defaults; revisit with real data.
- Two results of the same player processed out of order are applied in arrival order.

### Resume point

DRAGON-03 complete. Next: DRAGON-04.

---


## DRAGON-02 — matchmaking and social experience: COMPLETE (2026-10-06)

### Checklist

1. Matchmaking — ✅ persistent tickets by game/pace/player count/time; cancel; expanding window with cap; documented
   baseline rating; transactional matching (advisory lock + SKIP LOCKED), one active ticket per player, ready
   acceptance with deadline, decline/timeout re-queue, expiry; game and suspension re-checked at start.
2. Social — ✅ friends request/accept/remove, block, mute, user search, DMs friends-only by default (+ "nobody"),
   table chat, group/club chat, table invitations (friend/community/group); permissions enforced on REST, socket
   pushes, notifications and invitations; block prevents all new contact; groups (private, quick invites); clubs
   (public page, owner/managers, open/request/invite, scoped chat moderation); messages persisted, sanitized,
   paginated.
3. Notifications — ✅ turn/reminder/invite/match/message/result/friend/club; persisted read state; per-kind
   preferences; opt-in browser notifications from a user gesture; no hidden state or message text in payloads;
   dedupe keys make redelivery a no-op; invite notification leads to the authorized private lobby.
4. Moderation — ✅ reports (user/display name/message/table) with reason and evidence reference; moderator role
   checks; report-scoped evidence; audit history; appeals decided by another moderator; suspension and chat
   restriction enforced server-side (HTTP, socket, table start); admin controls for game status, tutorial,
   versions and incidents; history preserved; behaviour signals without automatic penalty.
5. Pages — ✅ quick match, friends, profile, messages, groups, clubs, support, moderation, admin, more; table chat
   drawer and invitations; loading/empty/error/denied/offline states; responsive (single-pane messages on mobile,
   bottom bar + «بیشتر»). No licensing/publisher workflows.

### Verification actually run (Windows 11, Node 24.13.1, PostgreSQL 18.6 in Docker)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK / 0 problems / OK / OK (chunk-size warning) |
| `pnpm test` | contracts 13, web 8, engine 17, api 67, worker 1 → **106 passed** |
| `npx playwright test` (API + web + worker started by Playwright) | **26 passed** (incl. 4 social flows × 360 and 1440) |
| migrations 0002_social_moderation, 0003_ticket_started on dev DB | applied |

New integration coverage (`apps/api/test/matchmaking.test.ts`, `social.test.ts`): window growth/cap; match → accept
→ start; ALREADY_QUEUED and live-table exclusion; 8 concurrent enqueues + 3 concurrent matcher runs → 4 tables, no
double assignment; cancel racing the matcher ×4; decline re-queues with original time; ready timeout re-queue +
no-show signal; suspended game at start; ticket expiry; friends/DM policy (friends-only, nobody, after removal);
block stops request/DM/invite/join and is not revealed; sanitization (control/bidi chars), pagination, socket push
only to members, mute hiding; DM notification idempotency under duplicate outbox delivery, preference off, no text in
payload; invite notification → authorized lobby → join; private-table socket subscription denied; table chat
participants only; group invites/accept/chat/quick table invite; club policies (open/request/invite), owner-only
roles, manager edits, member denied, scoped message removal audited; report → evidence → suspension enforced on
HTTP and socket → appeal → second moderator revokes; chat restriction; timeout behaviour signal without sanction.

E2E (`e2e/social.spec.ts`): guest discovery → sign-in → tutorial → queue → accept → line-three and sealed-bids to
the result; friend search/request/accept → private table → invitation notification → lobby join → live lobby chat →
DM → block stops messages; club creation (request policy) → approval → club chat → report → moderator suspension →
appeal → different moderator revokes; page inventory + keyboard smoke. Evidence: `docs/evidence/phase-02/`.

Bugs found by these tests and fixed: moderation evidence repeated the reported message (ms vs µs timestamps); sealed
bids history table overlapped the token buttons at 360 px; finished sealed-bids still showed «در انتظار».

### Blockers / limitations

- OTP: development fixture only (no SMS provider).
- Matchmaking uses the 1500 baseline until DRAGON-03 ratings; ranked queues are not offered.
- Chat `before` cursor can skip messages that share a millisecond at a page boundary (documented).
- Web bundle above 500 kB; code splitting planned for 04.
- Real devices (Safari iOS, Android Chrome) still untested.

### Resume point

DRAGON-02 complete. Next: DRAGON-03.

---


## DRAGON-01 — engine and reliable play: COMPLETE (2026-10-06)

### Checklist

1. Engine/SDK — ✅ `GameModule` contract with runtime action schemas, tutorial script and `BotAdapter` (contract only);
   `packages/game-engine`: reviewed registry keyed by gameId@rulesVersion, persisted seeded RNG, logical time,
   authorized projection/legal actions, deterministic replay; independent of HTTP/DB/commerce. Both games implemented
   per docs/GAME_MODULES.md with Persian interactive tutorials.
2. Tables — ✅ create (private + friendly default; ranked/premium refused honestly), public/private invite, join,
   leave, ready → atomic start, capacity/access/time/mode validation, live-table and turn-based limits, immutable
   settings, policies shown before ready, participant authorization on HTTP and Socket.IO.
3. Command service — ✅ single `executeCommand` for both transports: table row lock, receipt uniqueness, changed payload
   refused, exact duplicate returns the original receipt before revision checks, `STALE_REVISION` + permitted
   snapshot, invalid actions never mutate, atomic snapshot/revision/receipt/internal events/deadlines/outbox/result,
   pushes only per-viewer projections after commit.
4. Worker — ✅ deadlines (table-lock-first, token + expectedRevision, stale cancelled, frozen during incidents),
   leased outbox with backoff and idempotent consumers, canonical result once (`game_results` unique), sealed bids
   revealed only when complete.
5. Reconnect & time — ✅ snapshot on (re)subscribe, receipt lookup, «در انتظار تأیید», no automatic resubmit after
   stale, spectator projection, private access control, server-deadline countdown with skew correction, «نوبت من»,
   reminders, platform incident pause + time compensation distinct from personal disconnect.
6. Screens — ✅ create table, open tables, lobby, live/turn table, tutorial, result, dashboard «نوبت من» +
   notifications; both renderers keyboard-operable at desktop/mobile with hand/action bar; version-pinned renderer
   registry; suspended game stops new tables only. Chat: next phase (no placeholder controls).

### Verification actually run (Windows 11, Node 24.13.1, PostgreSQL 18.6 in Docker)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | OK / 0 problems / 12 packages / OK |
| `pnpm test` | contracts 13, web 8, engine 17, api 48, worker 1 → **87 passed** |
| `npx playwright test` | **18 passed** (5 play flows × 360 and 1440 + phase-00 shell at 4 widths) |
| `pnpm db:migrate` (0001_engine_play) on dev DB | applied |
| worker process smoke run (8 s, dev DB) | started; fired 1 due deadline; drained 103 outbox events; 0 failures |

Engine tests: setup/RNG determinism, illegal moves (wrong actor, occupied, bad schema, engine actor, after finish),
wins on rows/columns/diagonals, draw, timeout, resign, projection equality/redaction, simultaneous concealment and
atomic reveal, tie scoring, stable-seat-order timeout auto-commit, resignation policy incl. all resigned, replay,
both tutorial scripts.
Integration (`apps/api/test/tables.test.ts`, `play-integrity.test.ts`): creation validation, private/invite access,
start conditions, spectator projection, duplicate/changed-payload/stale/invalid/outsider/client-actor commands,
parallel commands (one accepted), receipt lookup before/after commit, restart with a new app instance, timeout race
x4, stale deadline, sealed-bids deadline carry-over + timeout, socket + HTTP + logs + outbox hidden-bid checks,
socket actor spoof rejected, outbox lease expiry + duplicate redelivery, version rollout/rollback/pinning + missing
registry version + suspension, tutorial guidance/completion/resume/replay/skip, incident freeze + compensation.

Evidence: `docs/evidence/phase-01/` (screenshots at 360 and 1440).

### Blockers / limitations

- OTP still development fixture only (no SMS provider) — carried from phase 00.
- Admin UI for incidents and version rollout not built (audited API only).
- Socket.IO fan-out assumes one API instance (sticky sessions needed for more).
- No analytics pipeline exists; hidden-state checks cover HTTP, sockets, logs and outbox.
- Real devices (Safari iOS, Android Chrome) still untested; Playwright Chromium emulation only.
- Concurrency/timeout tests ran against a local PostgreSQL; no load test yet (NFR-03/04 in phase 04).
- `node tools/validate-package.mjs` now fails by design of its regex `/^- [ [ x] ] DRAGON-00$/`, which only matches the unchecked line (verified: `- [x] DRAGON-00` → false). It is a protected package-preparation check; `04-COPY-NEXT-PROMPT` parses the status correctly and selects DRAGON-02.

### Resume point

DRAGON-01 complete. Next: DRAGON-02.

---


## DRAGON-00 — foundation, design and identity: COMPLETE (2026-10-06)

### Checklist

1. Stack & workspace — ✅ versions recorded in DECISIONS.md; pnpm workspace (apps/api, apps/web, apps/worker,
   packages/contracts, db, ui, game-sdk, games/line-three, games/sealed-bids); TS strict; committed lockfile;
   lint/typecheck/build/test scripts; CI skeleton `.github/workflows/ci.yml` (not yet run on GitHub);
   migrations + idempotent seed; zod config validation (fails closed in production); dependency boundaries
   documented in docs/ARCHITECTURE.md. No native app scaffolding.
2. Schema & identity — ✅ migration `0000_foundation.sql` (42 tables, all PRD domains, CHECK/unique constraints);
   OTP delivery interface + dev fixture + production refusal; hashed single-use challenges with expiry, attempt
   limit, resend delay, hourly per-mobile and per-IP limits; cookie sessions + logout/revocation; server RBAC
   (admin/moderator) with audited admin action; public profile redaction; mobile never returned publicly.
3. Contracts & platform — ✅ zod REST schemas → OpenAPI 3.0.3 (`/api/openapi.json`, `docs/openapi.json`);
   socket event names/payloads + strict command envelope (no actorId); `{errorCode, messageFa, requestId}` errors;
   Origin-based CSRF for HTTP and Socket.IO; log redaction; `/api/health/live|ready`; socket actor pinned from
   the session cookie.
4. UI — ✅ tokens, components, showcase (`/design`); route shell with right desktop nav / bottom mobile nav;
   login, dashboard, catalog, game detail, settings, admin game status, 404 with loading/empty/error/denied/offline
   states; two seeded test games labelled «بازی آزمایشی»; Persian search with ی/ي and ک/ك normalization;
   filters players/time/difficulty/mode/access; theme, mute, reduced motion; Jalali display.
5. Dev environment — ✅ docs/DEVELOPMENT.md, `.env.example` (local-only placeholders), `compose.yaml`
   (PostgreSQL 18.6, localhost-only, test DB init), pnpm scripts usable from Linux and Windows shells; existing
   Windows `.cmd` wrappers untouched.

### Verification actually run (Windows 11, Node 24.13.1, pnpm 11.5.2, Docker 29.6.2)

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK (after clean `pnpm clean` + fresh resolution; supply-chain policy passes) |
| `pnpm lint` | 0 problems |
| `pnpm typecheck` | 9 packages OK |
| `pnpm build` | web bundle OK (index ≈ 457 kB / 140 kB gzip) |
| `pnpm db:migrate` + `pnpm db:seed` ×2 (dev DB, PostgreSQL 18.6) | migrations applied; 42 tables; seed idempotent (2 games, 2 versions) |
| `pnpm test` | contracts 13, web 8, api 30, worker 1 → **52 passed** |
| `npx playwright test` | **8 passed**: login → catalog → search → detail → dashboard → settings → admin denied, and showcase, at 360/768/1440/1920 |
| `node .claude/tests/guardrails.test.mjs`, `node tools/validate-package.mjs` | 7 pass / PASS |

API tests cover: valid login + HttpOnly/SameSite cookie + hash-only storage; reused, expired, invalid and unknown
codes; attempt lockout (correct code rejected after 5 failures); concurrent verification consumes once;
resend delay and hourly limit; per-IP limit; mobile normalization to one account; RBAC 401/403/200 incl.
moderator≠admin; audited suspension hides game and blocks new tables; logout revocation; masked `/me`, public
profile allow-list without mobile; profile validation and mass-assignment rejection; catalog search/filters/
detail; CSRF origin rejection; error envelope; health; OpenAPI; log redaction (mobile, code, session token);
production config refusal; Socket.IO no-session/foreign-origin rejection and server-pinned identity.

Screenshots: `docs/evidence/phase-00/` (32 files).

### Blockers / limitations (honest)

- No real SMS provider: production cannot start until an `OtpDelivery` adapter for a chosen provider exists.
- CI workflow written but never executed on GitHub; and see the `.gitignore` issue in DECISIONS.md (tests/lint
  config currently excluded from git).
- Browser evidence is emulated viewports in Playwright Chromium only; no Safari/iOS or real Android device.
- Rate-limit IP buckets are in-process memory (single API instance assumption).
- Report action for display names (FR-01 "reportable") has schema (`reports.target_type='display_name'`) but no
  endpoint/UI yet — delivered with moderation in DRAGON-02.
- Tables, gameplay, tutorials and matchmaking are not implemented; UI states this and disables «ساخت میز».

### Resume point

DRAGON-00 complete. Next: DRAGON-01.

## Remaining phases — explicit checklist

### DRAGON-01 — engine and reliable play
- [x] all items complete (see DRAGON-01 section above)

### DRAGON-02 — matchmaking and social
- [x] all items complete (see DRAGON-02 section above)

### DRAGON-03 — ranking, progression, premium
- [x] implementation complete (see DRAGON-03 section above); real payment provider remains a blocker

### DRAGON-04 — release QA and operations
- [ ] full device/browser matrix incl. Safari iOS and Android Chrome (NFR-07)
- [ ] load test with stated hardware (NFR-03/04), availability plan (NFR-05), encrypted backup + restore test (NFR-08)
- [ ] production Docker/Compose, reverse proxy (HTTPS + WebSocket), observability, runbooks

## Ticket to Ride (2026-10-08): DONE locally — real devices UNVERIFIED

New module `games/ticket-to-ride` (classic rules, three selectable maps: North America, Europe, Iran; zoomable map,
face-up market, hand, tickets, claim panel with colour/locomotive choice, final score table, tutorial) registered in
engine, catalog and web. Checks run: engine 21 (`packages/game-engine/test/ticket-to-ride.test.ts`: map integrity on
all maps, longest path, setup/card conservation, simultaneous ticket choice, draw rules incl. locomotive rules and
redeal, claiming/payment/double routes, last round + scoring + ties, timeouts, resign, redaction, tutorial, 15 random
games + replay); full engine suite 173 passed; API 3 (`apps/api/test/ticket-to-ride.test.ts`) + catalog test 16 passed
together; E2E `e2e/ticket-to-ride.spec.ts`: three browsers keep tickets and claim 3 routes — Iran at 360, Europe and
North America at 1440, 3/3 passed (screenshots `docs/evidence/ticket-to-ride/`). A full game to the end through the
browser not run (engine-tested). Persian texts for the new rejection codes added to `GAME_ERRORS_FA`.
Visual overhaul (2026-10-08, owner request, three review rounds with screenshots): real simplified coastlines, lakes,
inland seas, borders, mountains/forests/deserts per map (`geo.ts`), wooden frame with 0–99 score track and markers,
compass and cartouche, 3D route slots and claimed cars, station plaques; illustrated train cards (a different wagon per
colour, steam locomotive, card back), ticket stubs with a mini-map, wooden face-up rack, stacked hand, player boards
with train-stock bars, claim preview, styled log, scoring legend, final medals, new cover. Re-checked: engine 21,
E2E 3/3 at 360/1440, lint and typecheck clean.
