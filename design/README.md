# design/ — BGV design system handoff (v2.1.13, «printed token», site header, navy/amber)

| Path | What |
|---|---|
| `CLAUDE.design-system.md` | The rules. Imported into `CLAUDE.md` by `install.mjs`; Claude Code always follows it. |
| `MIGRATION-v1.6-to-v2.1.md` | **Start here if you used v1.6:** new/removed components, the 72 new and 11 removed `bgv-*` classes, token changes, new/removed screens, Gaia split. |
| `IMPLEMENTATION-PLAN.md` | Phases 0–7 with checklists and the screen list per route (generated from `reference/screens.json`). |
| `MIGRATION-MAP.md` | Old VibeFarsi tokens/files → BGV tokens/files. |
| `system/` | The design system: `tokens.css/json`, `fonts/` (Vazirmatn + Manrope, OFL; `tokens.css` loads them), `components/bundle.css` (all `bgv-*` classes), `components/bundle.js` (reference React implementation), `components/index.d.ts` (API), `components/<Name>/README.md` (100 usage guides), `docs/0…6` (brand book + table, time, chat, identity, content/a11y, developer contract), `assets/` (logo/symbol files used by the shell). |
| `reference/screens.json` | 122 designed screens → route, state, theme, widths, reference files (`supersededBy` marks the old Gaia HUD boards). |
| `reference/img/<page>/<Screen>@<width>.png` | What each screen must look like (responsive desktop: 1440 · 1000 · 390; phone: 390). |
| `reference/html/<page>/<Screen>.html` | Exact markup/classes of each screen (open in a browser; works offline). |
| `reference/components/<Name>_{light,dark}.png` | What each component must look like. |
| `reference/class-diff-v1.6-v2.1.json` | Machine-readable class diff behind the migration note. |
| `brand/` | Brand kit v1.1 navy/amber (logos, symbol, app icons, social), `favicon-production/` (ship these), `LOGO-USAGE.md`. Unchanged since v1.6. |
| `CHANGELOG-v1.4.md`, `CHANGELOG-v1.6.md` | History only. |
| `ds.config.json` | Scope and rules of the guard + QA settings (incl. `retiredClasses`). Do not loosen. |
| `ds-baseline.json` | Created by `install.mjs`: today's debt. Only goes down (`pnpm ds:ratchet`). |
| `claude-hooks.json`, `install.mjs` | Claude Code hooks + installer. |
| `qa/` | Output of `/bgv-qa` (only `VERDICT.md` is kept in git). |

Not in this package: the Gaia Project table (`design/games/gaia-project/`) ships in `BGV-Gaia-Handoff-v1.4.zip`.

Tools outside this folder: `scripts/ds-check.mjs` (static guard, also the hook; DS016 = retired v1.6 classes), `e2e/design-qa.spec.ts`
(live capture + DOM audit), `scripts/ds-qa-report.mjs` (side-by-side report), `.claude/` (skill `bgv-design-system`, commands
`/bgv-implement`, `/bgv-qa`, agent `bgv-design-qa`), `.github/workflows/design-system.yml` (CI).
