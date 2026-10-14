# Implementation plan — BGV design system migration

Each phase is one or more `/bgv-implement phase-N` runs. A phase is done when its checklist is complete,
`node scripts/ds-check.mjs` passes (ratchet), `pnpm check` passes, and its screens match their references.
Run `node scripts/ds-check.mjs --ratchet` at the end of every phase. Phase 7 is the gate: `/bgv-qa`.

Server/contract work the UI depends on is in `design/system/docs/6-developer-contract.md` (publicSummary, clock model incl. `stale`,
reminders + web push, reactions/mentions, new routes, rematch). Do it in parallel with the phases that need it.

## Phase 0 — Foundation (no visual change of screens yet)
- [ ] Copy `design/system/tokens.css` and `design/system/components/bundle.css` to `packages/ui/src/bgv/` (byte-identical; never edit locally — changes come from the design system).
- [ ] Copy `design/system/components/bundle.js` and `index.d.ts` to `packages/ui/src/bgv/reference/` (reference only, not imported).
- [ ] `app.css`: import `@bg/ui/bgv/tokens.css` and `@bg/ui/bgv/bundle.css` **before** the legacy files (both run side by side until phase 6); add Tailwind `@theme inline` entries mapped to BGV tokens for layout utilities.
- [ ] Fonts: Vazirmatn 400/700/900 + Manrope 600/800 (`@fontsource-variable/manrope`); `--font-fa` / `--font-latin` resolve to them.
- [ ] Themes: keep `prefs.tsx` (`data-theme` light/dark/system) — the tokens already follow it; set `THEME_COLOR` to `#173A2D` / `#191B1A`.
- [ ] Brand: favicon set, `site.webmanifest`, apple-touch icon, theme-color meta, logo/symbol files into `apps/web/public/brand/` exactly as `design/brand/LOGO-USAGE.md` says.
- [ ] Number/time helpers: port `fa()` and `formatTime()` from bundle.js to `packages/ui/src/bgv/format.ts`; use them everywhere digits are shown.
- [ ] Guard: `node design/install.mjs` (hooks, CLAUDE.md import, scripts, baseline) and the `design-system` CI workflow.

## Phase 1 — Components (`packages/ui/src/bgv/components`)
- [ ] Port all 94 components 1:1 from `bundle.js` with types from `index.d.ts`, in the DS groups order: Brand, Actions, Inputs, Display, Navigation, Overlays, Table, Chat, Notifications, Profile.
- [ ] Rebuild the `/design` showcase route with the ported components (one section per component, light + dark) and compare each with `design/reference/components/<Name>_{light,dark}.png`.
- [ ] Unit tests for behaviour that matters (Switch/Segmented/Tabs keyboard, OtpField paste, Clock states incl. `stale`, Composer mentions).

## Phase 2 — App shell
- [ ] `AppShell` (Sidebar ≥1200, 88px icon sidebar 900–1199, TopBar + floating Dock <900) replaces `shell/Layout.tsx` navigation; identity card, coin chip (real gold), bell with count, nav groups/badges exactly as `Shell-Desktop`/`Shell-Phone` references.
- [ ] Immersive table mode keeps hiding the shell (`useImmersive`) — as the references show.
- [ ] Screens: Shell-Desktop, Shell-Desktop-Dark, Shell-Phone, Shell-Responsive-Spec.

## Phase 3 — Existing pages
| Route | Reference screens | Kind |
|---|---|---|
| `/settings` | Alert-Settings-Mobile · Alert-Settings-Desktop · Settings-Desktop · Settings-Mobile | page |
| `/messages/:id` | DM-Desktop · DM-Thread-Mobile | page |
| `/clubs/:slug` | Club-Chat-Moderation-Desktop · Club-Chat-Report-Desktop · Club-Desktop · Club-Mobile | page |
| `/users/:id` | Profile-Public-Desktop · Profile-Public-Mobile · Profile-Public-Mobile-Dark | page |
| `/me/profile` | Profile-Own-Mobile | page |
| `/me/avatar` | Avatar-Builder-Mobile · Avatar-Builder-Mobile-Buy · Avatar-Builder-Desktop | page |
| `/progress` | Progress-Desktop · Progress-Mobile · Shell-Desktop · Shell-Desktop-Dark | page |
| `/ranking` | Ranking-Desktop · Ranking-Mobile | page |
| `/more` | More-Phone | page |
| `/games` | Catalog-Desktop · Catalog-Phone | page |
| `/games/:id` | GameDetail-Desktop · GameDetail-Phone | page |
| `/games/:id/new` | CreateTable-Desktop · CreateTable-Phone | page |
| `/play` | QuickMatch-Searching-Phone · QuickMatch-Found-Phone · QuickMatch-Joining-Phone | page |
| `/tables` | OpenTables-Desktop | page |
| `/tournaments` | Tournaments-Desktop | page |
| `/tournaments/:id` | Tournament-Desktop · Tournament-Phone | page |
| `/login` | Login-Phone-Mobile · Login-Otp-Mobile · Login-Profile-Mobile · Login-Desktop | page |
| `/friends` | Friends-Desktop · Friends-Mobile | page |
| `/groups/:id` | Group-Desktop | page |
| `/clubs` | Clubs-Desktop | page |
| `/plans` | Plans-Desktop | page |
| `/coins` | Coins-Desktop · Wallet-Mobile | page |
| `/payments/result` | Payment-Success-Mobile · Payment-Failed-Mobile | page |
| `/support` | Support-Desktop | page |
| `/this-route-does-not-exist` | NotFound-Mobile | page |
| `/mod` | Moderation-Desktop | page |
| `/admin` | AdminGames-Desktop | page |
| `/wiki` | Wiki-Desktop | page |

## Phase 4 — Table, time and chat
| Route | Reference screens | Kind |
|---|---|---|
| `/tables/:id` | Hud-Chess-Mobile · Hud-Chess-Desktop · Hud-Uno-Mobile · Hud-Uno-Mobile-Dark · Hud-Uno-Desktop · Hud-Gaia-Mobile · Hud-Gaia-PlayerSheet-Mobile · Hud-Gaia-Desktop · Hud-Catan-Mobile · Hud-Catan-Desktop · Hud-Hanabi-Mobile · Hud-SushiGo-Mobile · Hud-Coup-Mobile · Hud-Ludo-Mobile · Hud-Backgammon-Mobile · Table-Lobby-Mobile · Table-Lobby-Desktop · Table-Spectator-Mobile · Table-OpponentOffline-Mobile · Table-ConnectionLost-Mobile · Table-Result-Mobile · Table-Result-Desktop · Turn-Start-Mobile · Turn-Warn-Mobile · Turn-Critical-Mobile · Turn-Timeout-Mobile · Chat-Docked-Desktop · Chat-Sheet-Mobile · Chat-Sheet-Mobile-Dark · Msg-Menu-Others-Mobile · Msg-Menu-Mine-Mobile · Mention-Compose-Mobile · Chat-Spectator-Mobile · Hud-Bubbles-Mobile | table |
- [ ] `TableScreen` frame; renderer inside `.bgv-felt__stage`; hide renderer player panels/turn text; HUD from `publicSummary`; seat colours via `--seat-*` in renderers.
- [ ] Clocks + alerts (warn 50% silent, critical with sound/vibration per prefs, timeout/auto-move, strikes), `stale` on own disconnect, opponent offline.
- [ ] Chat: docked (≥1200), sheet overlay (phone — never resizes the table), reactions, mentions, spectators read-only, system messages, message menus.

## Phase 5 — New pages and overlays
| Route | Reference screens | Kind |
|---|---|---|
| `(system)` | Push-Lockscreen-Mobile | system |
| `/tables/mine` | My-Tables-Urgency-Mobile · MyTables-Desktop · MyTables-Phone | page-new |
| `/` | Push-Preprompt-Mobile · Shell-Phone · Home-Desktop · Home-Phone · Home-Phone-Dark · Onboarding-Tour-Mobile · Celebration-LevelUp-Mobile · Offline-Mobile | overlay |
| `/me/studio` | Studio-Desktop · Studio-Mobile | page-new |
| `/me/wardrobe` | Wardrobe-Desktop | page-new |
| `/shop` | Shop-Desktop · Shop-Mobile · Shop-Item-Sheet-Mobile | page-new |
| `/notifications` | Notifications-Desktop · Notifications-Phone | page-new |

## Phase 6 — Remove the old system
- [ ] Delete `packages/ui/src/theme.css`, `apps/web/src/styles.css`, `packages/ui/src/vf/**`, old `components.tsx` parts; remove their imports.
- [ ] Renderers: remaining hard-coded chrome colours → `--seat-*`/`--felt-*` (game art stays).
- [ ] `node scripts/ds-check.mjs --strict` → 0 errors; switch the CI workflow to `--strict`; fix and run `contrast.mjs` for both themes.

## Phase 7 — Final QA gate
- [ ] `/bgv-qa` → `design/qa/VERDICT.md` = PASS (static gate 0, all non-spec screens captured, no automated FAIL, no visual blocker).

Spec boards (rules to read, not routes): Clock-System-Spec · Alert-Escalation · Chat-Spec · Identity-Spec · Shell-Responsive-Spec · States-Spec-Desktop.
