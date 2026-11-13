# CLAUDE.md: boardgameverse complete handoff (Nov 2026)

You are applying the final design handoff of **boardgameverse.ir** (repo `github.com/sina7843/boardgame-club`, pnpm monorepo, games in `games/<slug>`). This zip merges all 11 approved packages into one tree. Nothing in it is a draft.

## Layout of this zip
- `repo/`: copy over the repo root (merge, nothing to delete). It contains:
  - `design/`: design system v2.4.3, with fonts in `design/system/fonts` (Peyda 9 weights, Manrope, Vazirmatn plus OFL licences), tokens, components, brand/favicons, reference screens. Read `design/CLAUDE.design-system.md` first.
  - `design/games/<pkg>/`: chess, group-a, group-b, group-c, group-d, gaia-project, terraforming-mars, brass, ark-nova, blood-rage. Each has HANDOFF, COMPONENTS, QA-CHECKLIST, art, data and reference, and a **RULES.md for every game (68 in total)**.
  - `.claude/commands/` (per-package `implement`/`qa`/`fix`, plus `/bgv-start`), `.claude/agents/` (QA agents), `.claude/skills/bgv-design-system`.
- `packages/<name>/START-HERE.md`: the original per-package start notes, kept unchanged. Read the one for the package you're working on.
- `docs/`: `START-HERE.md` (install order), `QA-REPORT.md` (Persian, all QA rounds), `RULES-INDEX.md`, `MERGE-LOG.md` (0 conflicts: no two packages ship the same path), `PENDING.md`.

## Order of work (one phase = one branch + one PR)
1. **Design system**: `node design/install.mjs`, then `/bgv-implement`, then `/bgv-qa`. Everything else depends on it.
2. Chess: `/bgv-chess-implement`, then `/bgv-chess-qa`.
3. Group A (11 two-player board games): `/bgv-groupa-*`.
4. Group C (22 card games): `/bgv-groupc-*`.
5. Group B (7 dice/board games): `/bgv-groupb-*`.
6. Group D (22 medium/heavy games): `/bgv-groupd-*`.
7. Gaia `/bgv-gaia-*`, Terraforming Mars `/bgv-tm-*`, Brass `/bgv-brass-*`, Ark Nova `/bgv-arknova-*`, Blood Rage `/bgv-bloodrage-*`. Blood Rage has no engine; `ENGINE.md` is the contract.

Each `*-fix` command loops on the QA verdict until it passes. Run `/bgv-start` at the beginning of every session to see where you are.

## Non-negotiable rules (owner decisions; they override anything older you see in references)
- **Use DS tokens and components only.** No page-local overrides of DS components. Shadows stay the hard «printed» `--shadow-float` style; never soften them.
- **Persian copy:** natural Persian, as written in the designs (`design/COPY-FINAL.md`). Write ranges as «X تا Y», never with hyphens.
- **Persian digits:** no `tabular-nums` and no letter-spacing. Never put «·» beside a Persian digit; use `.bgv-sep` or «،».
- **Thousands separator:** a plain comma between Persian digits, «۲,۴۸۰», for amounts of 1000 or more. `toLocaleString('fa-IR')` gives U+066C «٬», so replace it with ','. Never use it in years, codes or clocks. Some older table references still show «٬»: follow this rule.
- **Box art:** game box images use the shared box class with `filter: drop-shadow` (never `box-shadow`). No gameplay photos in place of box art.
- **Chat:** own messages on the right, others on the left, send button on the right (physical sides, the same in LTR).
- **Game names:** Iranian community names from `design/GAME_NAMES.md`.
- **Rules source priority:** BGA implementation, then the official rulebook, then the printed board. Each game's `RULES.md` lists engine gaps ("تفاوت موتور با دفترچه"); fix the «بالا» (high) ones first.
- **No invented game art.** Use only the art in `design/games/*/art`. If a piece is missing, stop and ask; don't draw one.
- Seat colours, undo windows and test hooks (`data-*`, class names used by e2e) are as each game's HANDOFF says.

## Repo facts and risks (checked 2026-11-10)
- `main` is at `6421fb9`. It has DS v2.1.13 and only the Gaia design; everything else here is new.
- CI is red before you start: `pnpm lint` fails, and the design-system workflow fails at `setup-node`. Fix CI in phase 1.
- **Every push to `main` builds images and can deploy the live site** (`.github/workflows/images.yml` → Coolify). Work on branches and merge by PR only.
- The live site runs the Coolify TEST compose (no DB backup, no PITR). Take a DB backup before any migration.
- Typo to fix: `games/terraforming-mars/src/definition.ts` `nameFa` «تررافورمینگ» → «ترافورمینگ مارس» (also in its e2e test).

## Design sources (read-only canvases)
- DS https://claude.ai/artifact/3DPEkKeSg5PfZjphyRMMCu
- Site pages https://claude.ai/artifact/61m4wUqVQ373pFLzuqsier
- Game tables https://claude.ai/artifact/NhRomGy1qHDxcE3QoYedhU
