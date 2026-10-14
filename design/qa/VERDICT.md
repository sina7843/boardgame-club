# BGV design QA — verdict (2026-10-14)

Static, source-level review of every designed screen (`design/reference/screens.json`, 115 screens) and the design
system (`design/system`) against the code. Seven independent reviewers; no app run, no captures, so pixel-level
differences are not covered. Overall: **FAIL**.

| Group | Done | Partial | Missing | Report |
|---|---|---|---|---|
| table | 0 | 20 | 2 | verdict-table.md |
| time | 0 | 9 | 2 | verdict-time.md |
| chat | 0 | 13 | 0 | verdict-chat.md |
| profile | 0 | 17 | 1 | verdict-profile.md |
| play | 1 | 23 | 1 | verdict-play.md |
| account | 0 | 25 | 1 | verdict-account.md |
| **total** | **1** | **107** | **7** | |

Design system (verdict-ds.md): 94/94 components with identical props; tokens.css and bundle.css byte-identical;
brand assets match. `ds-check --strict` fails with 156 errors (legacy colours in `apps/web/src/app.css`,
`packages/ui/src/game-legacy.css`). Several designed pieces are hand-built instead of DS components
(Composer, QuickChat, SystemMessage, UnreadDivider, CritBar, Spectators, Hero, Popover/Tooltip in onboarding).

Owner decisions: reaction set ends with 👏 (DECISIONS.md).

## Fix plan (priority order)

1. **Table core** — phone player strip layouts (compact / 2-row / 2-player), shared actions in the ActionDock,
   hide in-board TurnIndicator under the HUD, connection-lost banner + action lock, spectator bar, result screens.
2. **Time** — CritBar countdown, turn-start / timeout toasts, strike banner, 50% step visual-only, frozen clock while
   reconnecting/incident, urgent rows in My Tables.
3. **Server data the designs need** (contracts + API): presence, per-player clocks, move log, league/title on seats,
   spectator count, table player lists / turn / result in my-tables and open-tables.
4. **Play** — quick-match joining + ready check, finished-tables history, game-detail open tables, create-table invites
   and phone sticky bar, open-tables filters, phone catalog.
5. **Chat** — SystemMessage + UnreadDivider, long-press menu with reaction bar, missing menu actions, DM invite card,
   floating HUD bubbles, grouped mention picker, slow-mode countdown.
6. **Profile / account** — own-profile page, Studio tabs + batch save, frame outside rings, ranking ladder and "you"
   card, friends two-column with presence, phone layouts (Settings, Wallet), plans comparison, payment retry.
7. **DS cleanup** — remove legacy colours to get `ds-check --strict` to zero, swap hand-built pieces for DS components,
   fix confetti colours.
8. **Web push** (service worker + server sender + pre-prompt) — separate track; needs a push provider decision.
