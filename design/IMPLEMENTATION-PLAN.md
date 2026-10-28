# Implementation plan — BGV design system v2.1

Each phase is one or more `/bgv-implement phase-N` runs. A phase is done when its checklist is complete,
`node scripts/ds-check.mjs` passes (ratchet), `pnpm check` passes, and its screens match their references.
Run `node scripts/ds-check.mjs --ratchet` at the end of every phase. Phase 7 is the gate: `/bgv-qa`.
Screens marked ✱ are new in v2.1. Coming from v1.6: `design/MIGRATION-v1.6-to-v2.1.md` lists exactly what changed.

Server/contract work the UI depends on is in `design/system/docs/6-developer-contract.md` (publicSummary, clock model incl. `stale`,
reminders + web push, reactions/mentions, new routes, rematch). Do it in parallel with the phases that need it.

## Phase 0 — Foundation (no visual change of screens yet)
- [ ] Copy `design/system/tokens.css`, `design/system/fonts/` and `design/system/components/bundle.css` to `packages/ui/src/bgv/` (byte-identical; never edit locally — changes come from the design system). `tokens.css` loads the fonts from `fonts/` next to it.
- [ ] Copy `design/system/components/bundle.js` and `index.d.ts` to `packages/ui/src/bgv/reference/` (reference only, not imported).
- [ ] `app.css`: import `@bg/ui/bgv/tokens.css` and `@bg/ui/bgv/bundle.css` **before** the legacy files (both run side by side until phase 6); add Tailwind `@theme inline` entries mapped to BGV tokens for layout utilities.
- [ ] Fonts: Vazirmatn (variable, 100–900) and Manrope (variable, Latin) from `design/system/fonts/` (OFL); `--font-fa` / `--font-latin` resolve to them.
- [ ] Themes: keep `prefs.tsx` (`data-theme` light/dark/system) — the tokens already follow it; set `THEME_COLOR` to `#142B3B` for both themes (or drop the swap).
- [ ] Brand: favicon set, `site.webmanifest`, apple-touch icon, theme-color meta, logo/symbol files into `apps/web/public/brand/` exactly as `design/brand/LOGO-USAGE.md` says.
- [ ] Number/time helpers: port `fa()` and `formatTime()` from bundle.js to `packages/ui/src/bgv/format.ts`; use them everywhere digits are shown.
- [ ] Guard: `node design/install.mjs` (hooks, CLAUDE.md import, scripts, baseline) and the `design-system` CI workflow.

## Phase 1 — Components (`packages/ui/src/bgv/components`)
- [ ] Port all 100 components 1:1 from `bundle.js` with types from `index.d.ts`, in the DS groups order: Brand, Actions, Inputs, Display, Navigation, Overlays, Table, Chat, Notifications, Profile. New in v2.1: `SiteHeader`, `SiteSearch`, `AccountMenu`, `SiteFooter`, `MoreTile`/`MoreGroup`, `LoginSheet`, `Stepper`. Do **not** port `Sidebar` or `NavItem` (removed).
- [ ] Rebuild the `/design` showcase route with the ported components (one section per component, light + dark) and compare each with `design/reference/components/<Name>_{light,dark}.png`.
- [ ] Unit tests for behaviour that matters (Switch/Segmented/Tabs keyboard, OtpField paste, Clock states incl. `stale`, Composer mentions, SiteSearch combobox keys: Ctrl K, `/`, arrows, Esc).

## Phase 2 — Site shell (v2.1)
- [ ] `AppShell` = sticky `SiteHeader` ≥900 (≥1200 full search field; 900–1199 search as a 44px button) + `TopBar` and floating `Dock` <900; one 1320 column (`--content-max`) for header, page and footer. It replaces `shell/Layout.tsx` navigation and the old sidebar entirely.
- [ ] Header: logo, خانه · بازی‌ها · میزها (turn count) · تورنمنت‌ها · رتبه‌بندی, `SiteSearch`, «بازی سریع» (hidden on `/`), messages, bell, avatar → `AccountMenu` (14 items in four groups; coins + «خرید سکه» live here on desktop).
- [ ] Phone: `TopBar` (logo/back, title, magnifier, coin chip, bell), `Dock` (خانه، میزها، پیام‌ها، بیشتر; active = amber token), «بیشتر» page from `MoreTile`/`MoreGroup`.
- [ ] Search: desktop popover, phone full-screen sheet (combobox/listbox, fa/Latin/finglish matching, empty state with suggestions).
- [ ] Guest pattern: «ورود / ثبت‌نام» (secondary) → `/login?next=…`; `StateBlock kind="guest"` on account-only pages; `LoginSheet` when sitting at a table (seat held 2 min).
- [ ] `SiteFooter` only on public pages (home, games, game page, wiki, support).
- [ ] Immersive table mode keeps hiding the shell (`useImmersive`) — as the references show.

| Route | Reference screens | Kind |
|---|---|---|
| `/progress` | Shell-Desktop · Shell-Desktop-Dark | page |
| `/` | Shell-Phone | page |
| `(spec)` | Shell-Responsive-Spec · Header-Footer-Spec · Header-Search-Desktop · Search-States-Spec · Flow-Simplify ✱ | spec |
| `/more` | More-Phone | page |
| `/messages` | Messages-Guest-Mobile ✱ | page |
| `/tables/:id` | Table-Lobby-Guest-Mobile ✱ | table |

## Phase 2b — New home and game card
- [ ] `/` member and guest homes (light + dark, desktop + phone); «بازی سریع» lives in the home hero, not in the header.
- [ ] `GameCard` (box art, hover lift, inline expandable panel, one open at a time).

| Route | Reference screens | Kind |
|---|---|---|
| `/` | Home-Member · Home-Member-Dark ✱ · Home-Member-Phone · Home-Member-Phone-Dark ✱ · Home-Guest · Home-Guest-Phone | page |
| `(spec)` | GameCard-Spec | spec |

## Phase 3 — Existing pages
| Route | Reference screens | Kind |
|---|---|---|
| `/settings` | Alert-Settings-Desktop · Settings-Desktop · Settings-Mobile | page |
| `/messages/:id` | DM-Desktop · DM-Thread-Mobile | page |
| `/clubs/:slug` | Club-Chat-Moderation-Desktop · Club-Chat-Report-Desktop · Club-Desktop · Club-Mobile | page |
| `/me/profile` | Profile-Own-Desktop ✱ · Profile-Own-Mobile | page |
| `/users/:id` | Profile-Public-Desktop · Profile-Public-Mobile · Profile-Public-Mobile-Dark | page |
| `/me/avatar` | Avatar-Builder-Mobile · Avatar-Builder-Desktop | page |
| `/progress` | Progress-Desktop · Progress-Mobile | page |
| `/ranking` | Ranking-Desktop · Ranking-Mobile | page |
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
| `/games` | Catalog-Desktop | page |
| `/games/:id` | GameDetail-Desktop · GameDetail-Phone | page |
| `/games/:id/new` | CreateTable-Desktop | page |
| `/play` | QuickMatch-Searching-Phone · QuickMatch-Found-Phone · QuickMatch-Joining-Phone · QuickMatch-Desktop ✱ | page |
| `/tables` | OpenTables-Desktop | page |
| `/tournaments` | Tournaments-Desktop | page |
| `/tournaments/:id` | Tournament-Desktop · Tournament-Phone | page |

## Phase 4 — Table, time and chat
| Route | Reference screens | Kind |
|---|---|---|
| `/tables/:id` | Hud-Chess-Mobile · Hud-Chess-Desktop · Hud-Uno-Mobile · Hud-Uno-Mobile-Dark · Hud-Uno-Desktop · Hud-Catan-Mobile · Hud-Catan-Desktop · Hud-Hanabi-Mobile · Hud-SushiGo-Mobile · Hud-Coup-Mobile · Hud-Ludo-Mobile · Hud-Backgammon-Mobile · Table-Lobby-Mobile · Table-Lobby-Desktop · Table-Spectator-Mobile · Table-OpponentOffline-Mobile · Table-ConnectionLost-Mobile · Table-Result-Mobile · Table-Result-Desktop · Turn-Start-Mobile · Turn-Warn-Mobile · Turn-Critical-Mobile · Turn-Timeout-Mobile · Chat-Docked-Desktop · Chat-Sheet-Mobile · Chat-Sheet-Mobile-Dark · Msg-Menu-Others-Mobile · Msg-Menu-Mine-Mobile · Mention-Compose-Mobile · Chat-Spectator-Mobile · Hud-Bubbles-Mobile | table |
- [ ] `TableScreen` frame; renderer inside `.bgv-felt__stage`; hide renderer player panels/turn text; HUD from `publicSummary`; seat colours via `--seat-*` in renderers.
- [ ] Clocks + alerts (warn 50% silent, critical with sound/vibration per prefs, timeout/auto-move, strikes), `stale` on own disconnect, opponent offline.
- [ ] Chat: docked (≥1200), sheet overlay (phone — never resizes the table), reactions, mentions, spectators read-only, system messages, message menus.
- [ ] **Gaia Project is not part of this phase.** Build it from `design/games/gaia-project/` (`BGV-Gaia-Handoff-v1.4.zip`, commands `/bgv-gaia-implement`, `/bgv-gaia-qa`). Superseded here: Hud-Gaia-Mobile · Hud-Gaia-PlayerSheet-Mobile · Hud-Gaia-Desktop.

## Phase 5 — New pages and overlays
| Route | Reference screens | Kind |
|---|---|---|
| `(spec)` | Push-Lockscreen-Mobile | system |
| `/tables/mine` | My-Tables-Urgency-Mobile · MyTables-Desktop | page-new |
| `/` | Push-Preprompt-Mobile · Onboarding-Tour-Mobile · Celebration-LevelUp-Mobile | overlay |
| `/me/studio` | Studio-Desktop · Studio-Mobile | page-new |
| `/me/avatar` | Avatar-Builder-Mobile-Buy | overlay |
| `/me/wardrobe` | Wardrobe-Desktop | page-new |
| `/shop` | Shop-Desktop · Shop-Mobile | page-new |
| `/shop` | Shop-Item-Sheet-Mobile | overlay |
| `/` | Offline-Mobile | system |
| `/notifications` | Notifications-Desktop | page-new |

## Phase 6 — Remove the old system
- [ ] Delete `packages/ui/src/theme.css`, `apps/web/src/styles.css`, `packages/ui/src/vf/**`, old `components.tsx` parts, the old sidebar/nav-item markup; remove their imports.
- [ ] Renderers: remaining hard-coded chrome colours → `--seat-*`/`--felt-*` (game art stays).
- [ ] `node scripts/ds-check.mjs --strict` → 0 errors (incl. DS016 retired classes); switch the CI workflow to `--strict`; fix and run `contrast.mjs` for both themes.

## Phase 7 — Final QA gate
- [ ] `/bgv-qa` → `design/qa/VERDICT.md` = PASS (static gate 0, all non-spec, non-superseded screens captured, no automated FAIL, no visual blocker).

Spec boards (rules to read, not routes): Clock-System-Spec · Alert-Escalation · Chat-Spec · Identity-Spec · States-Spec-Desktop.
