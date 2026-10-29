# BGV design QA — verdict (2026-10-29, design system v2.1)

**Overall: NOT PASS (automated gates clean)** — 106 PASS · 0 FAIL; 2 screens cannot be captured (below); visual review done for the home and the live table / chat / overlay screens, not yet for every other page.

## Gates
| Gate | Result |
|---|---|
| Static guard `node scripts/ds-check.mjs --strict` | **PASS** (strict zones: `apps/web/src`, `packages/ui/src`; generated `bgv.js` excluded). 221 errors in non-strict zones (legacy tokens in `games/*/src`) and 4471 warnings stay on the baseline. |
| Live capture + DOM audit (desktop-1440 project, widths 1440 / 1000 / 390, both themes) | **96 PASS · 0 FAIL · 12 not captured · 14 spec-only** of 122 screens |
| Independent visual review (side by side with the references) | **started, home only** (see below) |

## Not captured (2)
- `Push-Lockscreen-Mobile`: an OS lock-screen notification, not part of the web page; cannot be captured in a browser.
- `Table-Lobby-Guest-Mobile`: needs a backend change (guests cannot see a table; the 2-minute held seat and `LoginSheet` at the table do not exist yet). Deferred, decision in DECISIONS.md.

## Fixed during this QA
- **Audit tool**: the colour probe read the previous value while a transition ran, so almost every token looked "off-token" (all 60 failures of the first run). Fixed in `e2e/design-qa.spec.ts` (probe without transitions); colours written with `color-mix()` (computed as `color(srgb …)`) are accepted; lobby screens are not required to use `.bgv-tablescreen` (the reference lobby does not); a screen can have its own table or interaction (`PREPARE`).
- **Player rail at 390** (Catan, Hanabi, Coup, Ludo): the turn-order line («۳ نوبت بعد») stuck out of the narrow cards; it now wraps (`table.css`).
- **Cosmetic previews** (Shop, Studio, Wardrobe): item colours come from the item; the preview is marked `data-game-art` like game art.
- **Spectator game bar at 390**: «ترک تماشا» is icon-only on phones.

## Visual review (single agent, side by side)
- **Harness fixes**: `screens.json` `theme` is unreliable (Home-Member* say dark, reference is light) → theme now follows the id (`Dark` → dark, else light). Full-page shots scroll first so lazy game art loads (cards were blank).
- **Home member @1440 / @390 — structure, tokens, shell, hero, cards: match the reference.** Remaining gaps (data/feature, not tokens): hero lacks the big «آخرین بازیت» box art; no weekly-leaders strip; no tournament feature band; footer lacks the «بازی‌های محبوب» column and «دریافت از کافه‌بازار» button; the enamad box shows a broken image; «نوبت شماست»/open-tables rows are empty-state in this data set.
- Other screens not yet compared one by one.

## Second pass (same day)
- **Live tables had expired** (the 60 s turn clock ran out; HUD/chat shots were result screens). Captures now run without the worker (`design/qa/pw.noworker.config.ts`), after `qa-setup*`; Turn-* screens move the pending turn deadline in the dev DB (`setTurnLeft`). Timeout shot shows the client's 0:00 state only (no auto-move, no strike: those need the worker).
- **Table @390**: two-player HUD uses the DS phone `strip` layout (board visible above the fold; `duel` kept for the result). «گزارش این میز» no longer shrinks in the after-game card.
- **Overlays**: Onboarding tour, Level-up celebration and the «خبرتان کنیم؟» pre-prompt (rebuilt like the reference, also shown in a turn-based lobby) are captured by hooks. Level-up keeps the product's shield art where the reference has a numeric ring (decision, not a token issue).
- **Harness**: list-based routes wait for their link (no more `needs-data` flakes).

## Polish items (warnings, not gates)
- 17 Latin digits inside Latin game names in `bgv-gamecard__latin` (names such as «7 Wonders Duel»): expected, add to the audit allow-list.
- 14 «·» separators in UI text → `bgv-sep`.
- Text closer than 6 px to its frame: «همهٔ بازی‌ها» / «دانشنامه» chips, game bar meta items, a few cosmetic names; 2 links with a negative gap («تورنمنت‌ها», «کمد من»).
- 5 pages have under 50 % of elements on `bgv-*` classes.

## How to re-run
```
docker start boardgame-dev-postgres-1   # DATABASE_URL=postgres://boardgame:local-only-postgres-password@127.0.0.1:5434/boardgame
pnpm db:migrate && pnpm db:seed
BGV_QA_SETUP=1 pnpm exec playwright test e2e/qa-setup.spec.ts e2e/qa-setup2.spec.ts e2e/qa-roles.spec.ts e2e/qa-data.spec.ts --project=desktop-1440
BGV_QA_REUSE=1 BGV_QA_TABLES="$(cat design/qa/tables.json)" BGV_QA_MODERATOR_STORAGE=design/qa/app/.storage-moderator.json \
  BGV_QA_ADMIN_STORAGE=design/qa/app/.storage-admin.json pnpm exec playwright test e2e/design-qa.spec.ts --project=desktop-1440
node scripts/ds-qa-report.mjs     # → design/qa/index.html, summary.md
```
