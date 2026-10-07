# UI inventory

Source of truth for design: `packages/ui/src/tokens.css`, `packages/ui/src/components.css`,
`packages/ui/src/components.tsx`, live showcase at `/design`. No Figma file exists; editable source is the handoff.

## Direction

Dark club palette from docs/DESIGN_SYSTEM.md, Vazirmatn (bundled locally via @fontsource, 400/600/800), 16 px base,
4/8 spacing, radius 8/12/16, motion 120–200 ms (zeroed by reduced-motion setting or OS preference).
Signature element: each game module ships its own SVG cover drawn from its mechanic
(line-three: the 3×3 board with a winning diagonal; sealed-bids: the private 1–5 token hand and a wax-sealed bid),
kept in `games/*/src/cover.tsx`. Board art is `direction: ltr` — never mirrored by the RTL shell.

Measured WCAG contrast (script-calculated): text/bg 16.86, text-2/surface 8.68, text-2/surface-2 7.32,
white on action `#7C4DEB` 5.10 (brand `#8B5CF6` with white is 4.23, so it is not used as a button fill),
gold/bg 8.68, warning/surface 8.87, danger/surface 6.29, success/surface 8.03, focus ring/bg 7.94.
Light theme: text/bg 15.79, text-2/white 7.43, white on action 6.37, gold 5.35, warning 5.93, danger 5.64, success 4.96.

## Components

| Component | Status | Notes |
|---|---|---|
| Button (primary/secondary/ghost/danger, sm, busy, disabled) | done | 44 px min touch target |
| Input / Select / Segmented / Switch | done | label, hint, error with aria-describedby/role=alert |
| Tabs | done | WAI-ARIA tabs, arrow keys follow reading direction |
| GameCard | done | `apps/web/src/games/GameCard.tsx` (uses the game cover registry) |
| Badge, LeagueBadge, Progress, Timer, Avatar | done | Timer is display-only from a server deadline |
| Dialog, Drawer | done | native `<dialog>`: focus trap, Esc, backdrop |
| Toast | done | polite live region; errors use role=alert |
| Table (DataTable) | done | caption, scoped headers, horizontal scroll |
| StateBlock (loading/empty/error/offline/denied) | done | used on every phase-00 screen |
| PlayerSeat, TurnIndicator, ActionBar, Token, Hand | done (01) | `packages/ui/src/table.tsx`; boards are per-game renderers |
| Game renderers | done (01) | `games/*/src/renderer.tsx`, keyed by pinned `clientBundleRef` |

## Screens

| Screen | Route | Phase | States implemented |
|---|---|---|---|
| Login (mobile → code → profile) | `/login` | 00 ✅ | validation, busy, server error text, resend countdown, dev-fixture notice |
| Dashboard («نوبت من», «شروع بازی») | `/` | 00 ✅ | loading, signed-out, empty (no tables yet), catalog error |
| Catalog + search/filters | `/games` | 00 ✅ | skeleton loading, error+retry, empty with clear-filters, result count |
| Game detail | `/games/:id` | 00–01 ✅ | loading, not found, error, suspended, test-game label, «ساخت میز», tutorial start/resume/replay |
| Settings (theme, motion, mute, profile) | `/settings` | 00 ✅ | signed-out profile prompt, save error |
| Admin — game status | `/admin` | 00 ✅ (part of FR-16) | loading, signed-out, permission denied, audited confirm dialog |
| Component showcase | `/design` | 00 ✅ | all states rendered |
| Not found | `*` | 00 ✅ | — |
| Create table | `/games/:id/new` | 01 ✅ | signed-out, unavailable game, server errors; policies shown |
| Open tables | `/tables` | 01 ✅ | loading, empty, error, join error |
| Lobby | `/tables/:id` (open) | 01 ✅ | invite link, seats, ready, leave, policies before ready, denied for private |
| Live / turn-based table | `/tables/:id` (active) | 01 ✅ | turn indicator, server timer, frozen (incident), connection state, pending «در انتظار تأیید», stale notice, spectator, missing-bundle error, resign confirm, mobile drawer |
| Tutorial | `/tables/:id` (tutorial) | 01 ✅ | step x/y, guidance, restart, skip |
| Result | `/tables/:id` (finished) | 01 ✅ | placements, reason, next actions |
| Dashboard «نوبت من» + notifications | `/` | 01 ✅ | my-turn first, deadlines, empty, error |
| Quick match (queue, accept) | `/play` | 02 ✅ | loading, signed-out, queued (wait, window, cancel), matched (countdown, accept/decline), expired/cancelled notices |
| Matchmade lobby | `/tables/:id` | 02 ✅ | accept countdown, decline, re-queue explanation |
| Friends | `/friends` | 02 ✅ | tabs friends/requests/find/blocked+muted, empty states, errors |
| Profile | `/users/:id` | 02 ✅ | not found, relationship actions, block/mute, report user/name |
| Messages | `/messages`, `/messages/:id` | 02 ✅ | list/thread (single pane on mobile), unread, pagination, denied, restricted composer |
| Groups | `/groups`, `/groups/:id` | 02 ✅ | create, invitations, members, chat, private denied |
| Clubs | `/clubs`, `/clubs/:slug` | 02 ✅ | directory/search, create, join/request/invite, pending (managers), roles (owner), chat |
| Table chat + invitations | lobby / table drawer | 02 ✅ | participants only; drawer never covers the board |
| Support | `/support` | 02 ✅ | help, my reports, sanctions, appeal form |
| Moderation | `/mod` | 02 ✅ | permission denied, queue, report evidence, decisions, appeals, audit |
| Admin product controls | `/admin` | 02 ✅ | game status, tutorial toggle, versions, incident |
| More (mobile overflow) | `/more` | 02 ✅ | — |
| Progress (level, skill, mastery, missions, achievements, reward reasons) | `/progress` | 03 ✅ | signed-out, error, empty ledger |
| Ranking and league | `/ranking` | 03 ✅ | season selector, eligibility rule text, empty board, free history, premium-locked trends |
| Plans / payment result / dev gateway | `/plans`, `/payments/result`, `/dev-gateway` | 03 ✅ | unavailable checkout reason, unpriced plan, fixture banners, pending/verified/failed/expired, re-check |
| Result rewards | table result panel | 03 ✅ | processing, rating before→after, XP with reasons |
| Admin: plans, access, seasons, corrections, manual reward/premium, payments | `/admin` | 03 ✅ | audited actions |


Shell: desktop ≥ 900 px has the right-side (inline-start) navigation; below 900 px a top bar and fixed bottom
navigation. Global offline banner via `navigator.onLine`. Skip link, focus moved to `<main>` on navigation,
page titles per route. Latin names in `<bdi>`; dates in Jalali (`fa-IR-u-ca-persian`, Asia/Tehran) from UTC.

## Evidence

`docs/evidence/phase-00/*.png` — Playwright Chromium screenshots at 360, 768, 1440 and 1920 px of login, OTP,
catalog, Arabic-yeh search, detail, dashboard, light-theme settings and the component showcase.
Phase 01: `docs/evidence/phase-01/*.png` — two independent browser contexts playing both games live and
turn-based to the result, sealed-bid concealment (own view vs opponent view) and the tutorial, at 360 and 1440 px.
Phase 02: `docs/evidence/phase-02/*.png` — discovery→tutorial→queue→accept→both games, friends/invite/table chat/
block, club roles/report/moderation/appeal, and a page inventory (11 pages), at 360 and 1440 px; keyboard smoke.
Phase 03: `docs/evidence/phase-03/*.png` — ranked result → rewards → progress → ranking; plans → labelled fake gateway
→ failed then verified payment → premium active, at 360 and 1440 px.
Phase 04: `docs/evidence/phase-04/screenshots/*.png` — 21 pages (guest home, catalog, detail, login, ranking, plans,
not-found, dashboard, quick match, open tables, create table, friends, messages, groups, clubs, progress, support,
settings, more, moderator-denied, admin-denied) at **360, 768, 1440 and 1920 px**, plus a three-player sealed-bid
game (own vs opponent view, result) and the turn-based «نوبت من» return at 360/1440. axe WCAG 2.1 A/AA results per
width: `docs/evidence/phase-04/a11y-*.json` (0 violations). Admin panels: games/versions/tutorials, game access,
plans and prices, seasons (+ correction), missions, support (manual XP/premium, subscriptions, payments), platform
incident; moderator queue with audit filters.

Snakes and Ladders / Ludo: `docs/evidence/race/*.png` — full games at 360 and 1440 (start, each player mid-game, result).
Catan: `docs/evidence/catan/*.png` — three players at 360 and 1440 (start, each player's view after set-up and after regular turns).
Chess: `docs/evidence/chess/*.png` — Fool’s Mate at 360 and 1440 (start, Black’s legal targets, result).
Unmatched: `docs/evidence/unmatched/*.png` — duel at 360 and 1440 (hero pick, board for each player, combat, result).
UNO: `docs/evidence/uno/*.png` — three-player hand at 360 and 1440 (start, each player's own view mid-game, result).

Redesign (café): `docs/evidence/redesign/*-dark-*.png` — dark theme at 360 and 1440 (catalog, detail, dashboard, quick match, progress, settings); light theme in phase-04 screenshots.
Redesign (VibeFarsi Anar): light screenshots in `docs/evidence/phase-04/screenshots/` and `docs/evidence/phase-00/` (login, OTP); dark in `docs/evidence/redesign/`.

Devices actually tested: desktop Chromium (Playwright 1.63) with emulated viewports only. **Safari iOS and real
Android Chrome: UNVERIFIED** — no devices were available; viewport emulation is not counted as a device test.
