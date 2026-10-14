# BGV design system — mandatory rules for every UI change

This repository is being migrated to the **BGV (بردگیم‌ورس) design system v1.3**. The design system is the only allowed
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
| Usage rules per component | `design/system/components/<Name>/README.md` (94 components) |
| System rules (table, time, chat, identity, content/a11y, dev contract) | `design/system/docs/0…6-*.md` |
| What each screen must look like | `design/reference/screens.json` → `reference/img/<page>/<Screen>@<width>.png` and the exact markup in `reference/html/<page>/<Screen>.html` |
| Component look | `design/reference/components/<Name>_{light,dark}.png` |
| Brand: logos, favicon, app icons, brand book | `design/brand/` and `design/brand/LOGO-USAGE.md` |
| Old token → new token | `design/MIGRATION-MAP.md` |
| Order of work | `design/IMPLEMENTATION-PLAN.md` |

Use the `bgv-design-system` skill whenever you build or change UI. Use `/bgv-implement <screen|page>` to build a
screen and `/bgv-qa` for the final comparison against the design.

## Hard rules (enforced)
1. **Colour** only through semantic tokens: `var(--bg|--surface|--surface-raised|--surface-sunken|--surface-chrome|--text|--text-muted|--heading|--line|--border|--primary|--on-primary|--invite|--accent|--danger|--success|--warning|--info|--felt|--felt-ink|--seat-1…10|--clock-*|--tier-*|--coin*)`. No hex/rgb/hsl, no Tailwind palette classes (`text-white`, `bg-amber-300`), no arbitrary values (`bg-[#…]`). Primitives (`--brand-*`) are for the logo/brand only.
2. **Radius** = brand book: `--radius-sm` 8 (buttons, fields, menu items) · `--radius-md` 12 (inner tiles) · `--radius-lg` 20 (cards, panels, dialogs) · `--radius-xl` 28 (felt, sheets) · `--radius-pill` (chips, badges, avatars) · `--radius-xs` 4 (tags).
3. **Elevation** only `var(--shadow-*)` (claymorphism: tile, tile-primary, press, field, card, float, felt, piece). **Type**: `var(--font-fa)` / `var(--font-latin)` and the `t-*` classes. **z-index**: `var(--z-*)`. **Motion**: `--dur-*`, `--ease-*`, and respect `prefers-reduced-motion` / `data-motion`.
4. **Components first.** If a DS component exists (Button incl. icon-only, TextField, Select, Switch, Segmented, Tabs, PageTabs, Card, Sheet, Dialog, Toast, Badge, Tag, Avatar, Frame, Identity, PlayerCard, Hud, TurnPill, Clock, Felt, ActionDock, Chat, Message, AppShell, Sidebar, TopBar, Dock …) use it (ported to `packages/ui/src/bgv/components`) with the documented props. Never restyle a DS component locally to make it "look right" — if it is wrong, fix the shared component.
5. **Button roles:** primary = go (join, ready, rematch, send, accept) · secondary = neutral (invite, details, **«رد»**, cancel-but-stay) · ghost = low emphasis · **leave** = exit without destroying («ترک میز», «انصراف از صف», «خروج از حساب», `log-out` icon) · danger = destroys (delete account, resign confirm).
6. **RTL:** logical properties only (`margin-inline-start`, `inset-inline-end`, `ms-*/me-*`, `ps-*/pe-*`, `start-*/end-*`, `text-start`). Isolate LTR runs (`<bdi>`, `.bgv-num--signed`, chess coordinates, codes).
7. **Persian content:** Persian digits with «٬» thousands and «٫» decimal (use `fa()` and `formatTime()` from the DS (`Bgv.fa` in bundle.js)); Jalali dates; `<span class="bgv-sep"/>` between meta items, never «·» or «•»; corrected game names from `design/system/docs/5-content-and-accessibility.md` with the Latin title beside them.
8. **Spacing:** `--space-*` tokens. Tiles/plates ≥12px inner padding, cards 16–20px, symmetric (never only the start side). Nothing may touch the edge of its frame, stick out of it, or overlap a neighbour. Avatar rings keep ≥4px from anything.
9. **Identity:** «شما» is the inline badge of `.is-you` (never absolutely positioned); league names use `--text` (the shield carries the tier); seat = colour + glyph + name, never colour alone.
10. **Logo & favicon:** only the brand-kit files (`<Logo src srcDark markSrc markSrcDark/>`); never redraw, recolour or rebuild the logo in SVG/CSS; primary colourway on light, reversed on dark/felt/charcoal; favicon set from `design/brand/favicon-production` (see LOGO-USAGE.md).
11. **App shell:** every app page lives in the canonical `AppShell` (≥1200 full sidebar · 900–1199 88px icon sidebar · <900 sticky top bar + floating dock). Login/OTP/onboarding/payment-result/table-in-game are full-screen (no shell), exactly as the reference shows.
12. **Table screens:** `TableScreen` frame (game bar, HUD rail inline-start | felt + action dock | chat inline-end on desktop; phone order game bar → HUD strip → felt → dock). The game's own board/hand/controls render **unchanged** inside `.bgv-felt__stage` (letterboxed) — do not redesign game art; hide the renderer's own player panels/turn text, the HUD replaces them (`publicSummary`). Seat colours/felt inside renderers use `--seat-*`/`--felt-*`.
13. **Clocks:** states calm/warn/critical/paused/frozen/stale. Own connection lost = `stale` (dashed ring, `wifi-off`, last confirmed time, «در حال اتصال دوباره»); `frozen` only for a server incident.
14. **Themes:** light + dark from tokens only. Dark = charcoal page (`--bg` #191B1A) and chrome (`--surface-chrome`), dark-green cards. Never hard-code a theme colour; `theme-color` meta = #173A2D light / #191B1A dark.
15. **Responsive:** every desktop page works at 1440, 1000 and 390 with no horizontal page scroll; use `.bgv-cols`, `.bgv-grid`, `.bgv-grid--sm`, `.bgv-scroll-x`, fluid widths (no fixed px content widths). Touch targets ≥44px on coarse pointers.
16. **Accessibility:** WCAG 2.2 AA contrast (tokens are pre-measured — don't invent pairs), visible focus ring (`--focus`, `--focus-on-felt`), `role="timer"` + live regions for clocks, reduced motion respected.

## Process rules
- Before building a screen: open its reference PNGs **and** its reference HTML; list the DS components it uses; build with them; then compare your render with the reference at every listed width (see skill).
- Data, numbers, rules text and limits come from the code (server/game definitions), not from the mock text — the mocks were written against the code, so a mismatch means one of them is wrong: report it.
- Never edit `design/system/**`, `design/reference/**`, `design/ds.config.json` or raise numbers in `design/ds-baseline.json`. Run `node scripts/ds-check.mjs --ratchet` after a migration step to lower the baseline.
- `// ds-check-ignore` is allowed only inside game-art code with a one-line reason; it is reviewed in `/bgv-qa`.
- A screen is **done** only when: it uses DS components/tokens only, `node scripts/ds-check.mjs --changed` passes, and its capture matches the reference at every width in both required themes.
