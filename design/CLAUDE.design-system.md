# BGV design system — mandatory rules for every UI change

This repository is being migrated to the **BGV (بردگیم‌ورس) design system v2.1** («printed token» language: every pressable thing is a game token with an ink frame and a hard shadow, nothing else is raised; ivory page + white cards; site header instead of the sidebar; navy selections, amber only for the main action; ink-navy dark). Coming from v1.6? Read `design/MIGRATION-v1.6-to-v2.1.md` first. The design system is the only allowed
source of colour, type, spacing, radius, elevation, motion, icons, logos and UI components. These rules are not
suggestions: a hook (`scripts/ds-check.mjs`) blocks edits that add violations, CI fails on them, and `/bgv-qa` is the
final gate. If a rule blocks you, fix the code — never weaken the rule, the config, or the baseline.

## Sources of truth (read before touching UI)
| What | Where |
|---|---|
| Tokens (CSS custom properties, light + dark) | `design/system/tokens.css` (+ `tokens.json`) → installed at `packages/ui/src/bgv/tokens.css` |
| Component CSS (all `bgv-*` classes) | `design/system/components/bundle.css` → `packages/ui/src/bgv/bundle.css` |
| Component API (props, variants) | `design/system/components/index.d.ts` |
| Reference behaviour of every component | `design/system/components/bundle.js` (plain React.createElement, `window.Bgv`) |
| Usage rules per component | `design/system/components/<Name>/README.md` (100 components) |
| System rules (table, time, chat, identity, content/a11y, dev contract) | `design/system/docs/0…6-*.md` |
| What each screen must look like | `design/reference/screens.json` → `reference/img/<page>/<Screen>@<width>.png` and the exact markup in `reference/html/<page>/<Screen>.html` |
| Component look | `design/reference/components/<Name>_{light,dark}.png` |
| Brand: logos, favicon, app icons (the design system is the only brand source; no brand book PDF) | `design/brand/` and `design/brand/LOGO-USAGE.md` |
| Site shell (header, search, account menu, footer, «بیشتر» tiles, login sheet) | DS components `SiteHeader`, `SiteSearch`, `AccountMenu`, `SiteFooter`, `MoreTile`/`MoreGroup`, `LoginSheet`, `Stepper` + specs `reference/html/concept/{Header-Footer-Spec,Header-Search-Desktop,Search-States-Spec,GameCard-Spec,Flow-Simplify}.html` (any page-local CSS there is design intent only: use the DS component, never copy it into pages) |
| Gaia Project table | **Not here.** `design/games/gaia-project/` from `BGV-Gaia-Handoff-v1.4.zip`. The old `table/Hud-Gaia-*` screens are `supersededBy` it. |
| v1.6 → v2.1 changes (classes, components, screens) | `design/MIGRATION-v1.6-to-v2.1.md` |
| Old token → new token | `design/MIGRATION-MAP.md` |
| Order of work | `design/IMPLEMENTATION-PLAN.md` |

Use the `bgv-design-system` skill whenever you build or change UI. Use `/bgv-implement <screen|page>` to build a
screen and `/bgv-qa` for the final comparison against the design.

## Material and colour in practice (v2.1.13, owner-approved)
- **Materials («توکن چاپی»):** *token* = anything that is pressed itself (button, chip, reaction, cosmetic tile, switch thumb): fill + ink frame + hard shadow of the same ink (`--shadow-tile-sm/-/-lg`), hover lifts 1px (pointer only), press lands. *Row* = pressable inside a board (menu, nav, dock, conversation, segment/tab option): flat, `--shadow-row-press` on press. *Well* = field, checkbox, radio, switch/slider track, progress (`--shadow-field`). *Board* = card, panel, dialog, menu (`--line` + `--shadow-card`; floating `--shadow-float`). *Print* = badge, tag, meta (flat, never pressable). No blurred shadow, glass, glow or gradient anywhere — only the DS tokens.
- Light page `--bg` #F2EEE7 (ivory), cards and floating surfaces white with the warm `--line` hairline.
- **Buttons (v2.1.10–2.1.12):** primary = solid amber with a 1.5px burnt-amber frame/shadow `--ink-btn-primary` #B57A25; secondary/neutral (the default `Button`, «جزئیات», «تغییر بازی», «ماندن», «رد», non-ghost icon buttons) = white (dark: `--surface-raised`) with a 1.5px soft-slate frame/shadow `--ink-btn` (#A1AAB1 light, #4A6476 dark). A toggle that is on (`pressed`) is the same token filled navy (`--selected`). The DS CSS does all of this; never add your own.
- «ترک میز / خروج از حساب / انصراف از صف» = `variant="leave"` (soft pink token, crimson label, `log-out` icon). «رد» is `secondary`. Never `danger` for leaving.
- **Shell (v2.1):** desktop ≥900 = sticky `SiteHeader` (logo, خانه · بازی‌ها · میزها · تورنمنت‌ها · رتبه‌بندی, `SiteSearch`, «بازی سریع», messages, bell, avatar → `AccountMenu`). Coins live in the account menu on desktop. «بازی سریع» is hidden on the home page. Phone <900 = `TopBar` + floating `Dock` (خانه، میزها، پیام‌ها، بیشتر; also for guests, without counts); the active dock item is an **amber token with a normal icon**; games and game pages keep خانه active; 404 and notifications have none active. «بیشتر» = `MoreTile`/`MoreGroup`. `SiteFooter` only on public pages (home, games, game page, wiki, support), never on tables, messages or settings.
- **Amber** only for: the one main action per view, the «نوبت شما» pill, coins, and the two owner exceptions — «بازی سریع» in the header and the active dock item. Every selection (chip, segment, tab, checkbox, radio, active menu item, page number, switch on, the «شما» row) is **navy** (cream in dark).
- **Guests:** «ورود / ثبت‌نام» is a secondary token in header/top bar (opens `/login?next=…`); account-only pages show `StateBlock kind="guest"`; sitting at a table opens `LoginSheet` in place (seat held 2 min); login is a 3-step `Stepper`.
- Names: «بازی سریع» (not «حریف‌یابی»), «اشتراک پریمیوم», «فروشگاه کازمتیک», «ورود / ثبت‌نام».
- `Badge tone="premium"` + crown only for premium; roles = neutral + `shield`; wins = `success` + `trophy`; mastery = `info` + `star` (v2.1.3).
- Online/bot availability = `ModeTag` (desktop: «آنلاین | ربات», phone: `compact`, icons only). Only for games that have a bot.
- No gradients and no grey/tinted boxes inside cards; separate with a hairline instead.

## Hard rules (enforced)
1. **Colour** only through semantic tokens: `var(--bg|--surface|--surface-raised|--surface-sunken|--surface-chrome|--text|--text-muted|--heading|--line|--border|--primary|--on-primary|--invite|--accent|--danger|--success|--warning|--info|--felt|--felt-ink|--seat-1…10|--clock-*|--tier-*|--coin*)`. No hex/rgb/hsl, no Tailwind palette classes (`text-white`, `bg-amber-300`), no arbitrary values (`bg-[#…]`). Primitives (`--brand-*`) are for the logo/brand only.
2. **Radius** (brand rule): `--radius-sm` 8 (buttons, fields, menu items) · `--radius-md` 12 (inner tiles) · `--radius-lg` 20 (cards, panels, dialogs) · `--radius-xl` 28 (felt, sheets) · `--radius-pill` (chips, badges, avatars) · `--radius-xs` 4 (tags).
3. **Elevation** only `var(--shadow-*)` (printed tokens: tile-sm/tile/tile-lg, tile-selected, row-press, field, card, float, felt, plate, piece — all hard, no blur). **Type**: `var(--font-fa)` / `var(--font-latin)` and the `t-*` classes. **z-index**: `var(--z-*)`. **Motion**: `--dur-*`, `--ease-*`, and respect `prefers-reduced-motion` / `data-motion`.
4. **Components first.** If a DS component exists (Button incl. icon-only, TextField, Select, Switch, Segmented, Tabs, PageTabs, Card, Sheet, Dialog, Toast, Badge, Tag, Avatar, Frame, Identity, PlayerCard, Hud, TurnPill, Clock, Felt, ActionDock, Chat, Message, AppShell, SiteHeader, SiteSearch, AccountMenu, SiteFooter, TopBar, Dock, MoreTile, LoginSheet, Stepper …) use it (ported to `packages/ui/src/bgv/components`) with the documented props. Never restyle a DS component locally to make it "look right" — if it is wrong, fix the shared component.
5. **Button roles:** primary = go (join, ready, rematch, send, accept) · secondary = neutral (invite, details, **«رد»**, cancel-but-stay) · ghost = low emphasis · **leave** = exit without destroying («ترک میز», «انصراف از صف», «خروج از حساب», `log-out` icon) · danger = destroys (delete account, resign confirm).
6. **RTL:** logical properties only (`margin-inline-start`, `inset-inline-end`, `ms-*/me-*`, `ps-*/pe-*`, `start-*/end-*`, `text-start`). Isolate LTR runs (`<bdi>`, `.bgv-num--signed`, chess coordinates, codes).
7. **Persian content:** Persian digits with «٬» thousands and «٫» decimal (use `fa()` and `formatTime()` from the DS (`Bgv.fa` in bundle.js)); Jalali dates; `<span class="bgv-sep"/>` between meta items, never «·» or «•»; corrected game names from `design/system/docs/5-content-and-accessibility.md` with the Latin title beside them.
8. **Spacing:** `--space-*` tokens. Tiles/plates ≥12px inner padding, cards 16–20px, symmetric (never only the start side). Nothing may touch the edge of its frame, stick out of it, or overlap a neighbour. Avatar rings keep ≥4px from anything.
9. **Identity:** «شما» is the inline badge of `.is-you` (never absolutely positioned); league names use `--text` (the shield carries the tier); seat = colour + glyph + name, never colour alone.
10. **Logo & favicon:** only the brand-kit files (`<Logo src srcDark markSrc markSrcDark/>`); never redraw, recolour or rebuild the logo in SVG/CSS; primary colourway on light, reversed on dark/felt/navy; favicon set from `design/brand/favicon-production` (see LOGO-USAGE.md).
11. **App shell:** every app page lives in the canonical `AppShell` (≥1200 `SiteHeader` with the full search field · 900–1199 header with search collapsed to a 44px button · <900 sticky `TopBar` + floating `Dock`), one centred column `--content-max` 1320 shared by header, page and footer. There is **no sidebar** any more: `Sidebar`, `NavItem`, `.bgv-sidebar*`, `.bgv-nav-item*`, `.bgv-app--icons` and `.bgv-btn--outline` are retired (ds-check DS016). Login/OTP/onboarding/payment-result/table-in-game are full-screen (no shell), exactly as the reference shows.
12. **Table screens:** `TableScreen` frame (game bar, HUD rail inline-start | felt + action dock | chat inline-end on desktop; phone order game bar → HUD strip → felt → dock). The game's own board/hand/controls render **unchanged** inside `.bgv-felt__stage` (letterboxed) — do not redesign game art; hide the renderer's own player panels/turn text, the HUD replaces them (`publicSummary`). Seat colours/felt inside renderers use `--seat-*`/`--felt-*`.
13. **Clocks:** states calm/warn/critical/paused/frozen/stale. Own connection lost = `stale` (dashed ring, `wifi-off`, last confirmed time, «در حال اتصال دوباره»); `frozen` only for a server incident.
14. **Themes:** light + dark from tokens only. Light = ivory page (`--bg` #F2EEE7), white cards, chrome and raised surfaces, navy text, amber actions. Dark = ink-navy page (`--bg` #0D1A23), cards `--surface` #192E3C, felt #234156. Never hard-code a theme colour; one `theme-color` meta = #142B3B.
15. **Responsive:** every desktop page works at 1440, 1000 and 390 with no horizontal page scroll; use `.bgv-cols`, `.bgv-grid`, `.bgv-grid--sm`, `.bgv-scroll-x`, fluid widths (no fixed px content widths). Touch targets ≥44px on coarse pointers.
16. **Accessibility:** WCAG 2.2 AA contrast (tokens are pre-measured — don't invent pairs), visible focus ring (`--focus`, `--focus-on-felt`), `role="timer"` + live regions for clocks, reduced motion respected.

## Process rules
- Before building a screen: open its reference PNGs **and** its reference HTML; list the DS components it uses; build with them; then compare your render with the reference at every listed width (see skill).
- Data, numbers, rules text and limits come from the code (server/game definitions), not from the mock text — the mocks were written against the code, so a mismatch means one of them is wrong: report it.
- Never edit `design/system/**`, `design/reference/**`, `design/ds.config.json` or raise numbers in `design/ds-baseline.json`. Run `node scripts/ds-check.mjs --ratchet` after a migration step to lower the baseline.
- `// ds-check-ignore` is allowed only inside game-art code with a one-line reason; it is reviewed in `/bgv-qa`.
- A screen is **done** only when: it uses DS components/tokens only, `node scripts/ds-check.mjs --changed` passes, and its capture matches the reference at every width in both required themes.
