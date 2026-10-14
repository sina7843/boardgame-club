# design/ — BGV design system handoff (v1.3)

| Path | What |
|---|---|
| `CLAUDE.design-system.md` | The rules. Imported into `CLAUDE.md` by `install.mjs`; Claude Code always follows it. |
| `IMPLEMENTATION-PLAN.md` | Phases 0–7 with checklists and the screen list per route. |
| `MIGRATION-MAP.md` | Old VibeFarsi tokens/files → BGV tokens/files. |
| `system/` | The design system: `tokens.css/json`, `components/bundle.css` (all `bgv-*` classes), `components/bundle.js` (reference React implementation), `components/index.d.ts` (API), `components/<Name>/README.md` (94 usage guides), `docs/0…6` (brand + table, time, chat, identity, content/a11y, developer contract), `assets/` (logo/symbol files used by the shell). |
| `reference/screens.json` | 115 designed screens → route, state, theme, widths, reference files. |
| `reference/img/<page>/<Screen>@<width>.png` | What each screen must look like (desktop: 1440 · 1000 · 390; phone: 390). |
| `reference/html/<page>/<Screen>.html` | Exact markup/classes of each screen (open in a browser). |
| `reference/components/<Name>_{light,dark}.png` | What each component must look like. |
| `brand/` | Brand kit v1.0 (logos, symbol, app icons, social, brand book PDF), `favicon-production/` (ship these), `LOGO-USAGE.md`. |
| `ds.config.json` | Scope and rules of the guard + QA settings. Do not loosen. |
| `ds-baseline.json` | Created by `install.mjs`: today's debt. Only goes down (`pnpm ds:ratchet`). |
| `claude-hooks.json`, `install.mjs` | Claude Code hooks + installer. |
| `qa/` | Output of `/bgv-qa` (only `VERDICT.md` is kept in git). |

Tools outside this folder: `scripts/ds-check.mjs` (static guard, also the hook), `e2e/design-qa.spec.ts` (live capture + DOM audit),
`scripts/ds-qa-report.mjs` (side-by-side report), `.claude/` (skill `bgv-design-system`, commands `/bgv-implement`, `/bgv-qa`,
agent `bgv-design-qa`), `.github/workflows/design-system.yml` (CI).
