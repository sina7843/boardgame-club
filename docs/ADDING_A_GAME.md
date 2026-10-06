# Adding a game

A new game is a reviewed package under `games/{gameId}` that implements the SDK contract. Identity, sessions,
tables, deadlines, payments and ratings do not change. Both demonstrator games (`line-three`, `sealed-bids`) are
complete examples; this walkthrough uses `line-three`.

## 1. Package layout

```
games/line-three/
  package.json        exports ".", "./cover", "./renderer"; deps: @bg/game-sdk, zod (+ @bg/ui, react for UI files)
  src/definition.ts   manifest + Persian catalog metadata (defineGame)
  src/rules.ts        GameModule: rules, projection, legal actions, timeout, tutorial script
  src/index.ts        re-exports definition + rules (server-safe: no React)
  src/cover.tsx       catalog cover art (web only)
  src/renderer.tsx    table renderer (web only) + renderer.css
```

The server imports only `.` (definition + rules). Renderer and cover files are imported only by the web app.

## 2. Manifest and catalog (`definition.ts`)

```ts
export const lineThree = defineGame({
  manifest: {
    gameId: 'line-three', rulesVersion: '1.0.0', stateSchemaVersion: 1,
    supportedModes: { pace: ['live', 'turn'], competition: ['friendly', 'ranked'] },
    playerCounts: { min: 2, max: 2 },
    options: [{ key: 'firstMove', labelFa: 'شروع‌کننده', descriptionFa: 'چه کسی حرکت اول را انجام می‌دهد.',
      choices: [{ value: 'random', labelFa: 'تصادفی' }, { value: 'host', labelFa: 'میزبان (صندلی اول)' }],
      default: 'random' }],
    capabilities: ['public-state', 'seeded-rng'],
    clientBundleRef: 'line-three@1.0.0', assetsRef: 'line-three/1'
  },
  catalog: { nameFa: 'سه‌خطی', nameOriginal: 'Line Three', summaryFa: '…', rulesFa: ['…'],
    minutes: { min: 2, max: 5 }, difficulty: 'easy', access: 'free', isTestGame: true,
    timeoutPolicyFa: '…', resignPolicyFa: '…', tutorialFa: '…' }
});
```

### What the module declares vs what the admin decides

The manifest declares everything the rules **can** do: paces, competitions, player range and rule variants
(`options`; each has Persian labels, its choices and a `default` that reproduces the standard rules). The admin
panel («تنظیمات بازی‌ها») then chooses, per game, what players are **offered**: paces, friendly/ranked, player range,
live time budgets and turn deadlines (from `TIME_OPTIONS`), and for every variant the allowed choices, the default and
whether the host may choose. The server enforces the offer on table creation and matchmaking; matchmade tables use the
admin default; every table stores its chosen variants, which reach `setup({ options })` and are recorded with the
start input (exact replay). Running tables never change. Re-seeding/deploying never overwrites admin choices — it only
narrows them if a new version supports less. Read options defensively in `setup` (`options.x === 'y'`), because
tutorials and old tables pass `{}` and must get the standard rules.

`defineGame` validates both with zod at import time. Timeout and resignation policies are shown to players before
they ready up, so write them precisely.

## 3. Rules module (`rules.ts`)

Implement `GameModule<State, Action, View>` from `@bg/game-sdk`:

| Member | Rule |
|---|---|
| `actionSchema` | zod schema for untrusted client actions (strict objects). |
| `setup({playerCount, options, rng})` | Initial state. Use only `rng.nextInt` for randomness. |
| `validate(state, actor, action)` | Return `{ok:false, errorCode}` with a stable code (add Persian text to `GAME_ERRORS_FA` in contracts). Must not mutate. |
| `apply(state, actor, action, ctx)` | Return `{nextState, internalEvents, scheduleChanges}`. Pure: no clock (use `ctx.logicalTime`), no `Math.random`. |
| `project(state, viewer)` | The ONLY data a viewer receives. Never include hidden values, other players' private data, RNG or internals. |
| `legalActions(state, viewer)` | Only actions of that viewer; never derived from someone else's hidden data. |
| `outcome(state)` | `null` while running; placements with shared places for ties. |
| `onTimeout(state, {deadlineKey}, ctx)` | Deterministic timeout policy (e.g. current player loses / lowest token auto-committed). |
| `pendingSeats(state)` | Seats the game waits on — public (drives «نوبت من», reminders, notifications). |
| `tutorial` | Fixed seed, Persian intro, steps `{instructionFa, expected, reply}`, completion text. The opponent is a script. |

`scheduleChanges`: emit `{kind:'set', deadlineKey:'turn'}` whenever a new turn/round starts, `{kind:'clear'}` when
the game ends, and nothing when the current deadline still applies.

Example (abridged from `games/line-three/src/rules.ts`):

```ts
apply(state, actor, action) {
  const seat = (actor as { seat: number }).seat as Mark;
  if (action.type === 'resign') return done({ ...state, outcome: loserOutcome(seat, 'resign') }, [{ type: 'resigned', seat }]);
  const board = state.board.slice();
  board[action.cell] = seat;
  if (winningLine(board)) return done({ ...state, board, outcome: { placements: [...], reason: 'win' } }, [...]);
  return { nextState: { ...state, board, current: (1 - seat) as Mark }, internalEvents: [...],
           scheduleChanges: [{ kind: 'set', deadlineKey: 'turn' }] };
}
```

## 4. Register the module (reviewed code only)

1. `packages/game-engine/src/index.ts` → add the module to `reviewedModules`.
2. `packages/db/src/registry.ts` → add the definition (catalog seed).
3. `apps/web/src/games/renderers.tsx` → map `clientBundleRef` → renderer; `apps/web/src/games/covers.tsx` → cover.
4. `pnpm db:seed` publishes the catalog row (status `active`) and the `game_versions` row.

No uploaded or remote code is ever executed; adding a game is a reviewed code change.

## 5. Renderer (`renderer.tsx`)

Receives `GameRendererProps<View>`: `view`, `legalActions`, `mySeat`, `seatName`, `busy`, `onAction`, `expected`.
Requirements: keyboard operable, labels in Persian, state shown with text + icon (not color alone), confirm final
moves (select → «ثبت»), stop offering moves while `busy`, keep board coordinates literal (`dir="ltr"` on the board
when coordinates are spatial), never infer hidden information. Use shared `@bg/ui` table components
(`TurnIndicator`, `ActionBar`, `Hand`, `Token`, `PlayerSeat`). The shell provides resign (with confirmation),
timer, players drawer, pending/stale handling and result screen.

## 6. Tests to add (copy `packages/game-engine/test/*.test.ts`)

Setup determinism; legal/illegal moves and rejected moves not mutating; finish, draw/ties, resign, timeout;
projection redaction for every viewer kind (opponent, spectator); simultaneous decisions if any; deterministic
replay; tutorial script plays to completion. Integration coverage of commands/deadlines is generic and already
exists in `apps/api/test`.

## 7. Releasing a new rules version (rollout / rollback)

Running tables are pinned to the version they started with; only new tables follow the active version.

1. Copy the module for the new version (e.g. `rulesVersion: '1.1.0'`, `clientBundleRef: 'line-three@1.1.0'`) and
   **keep the old module registered** in `reviewedModules` and the old renderer key in `renderers.tsx` while any
   table uses it. If the state shape changes, bump `stateSchemaVersion`; running tables are not migrated in place.
2. Deploy. Insert a `game_versions` row for 1.1.0 (seed or SQL) with status `retired`.
3. Rollout: `PATCH /api/admin/game-versions/{id}` `{status:'active', reason}` for 1.1.0, then `retired` for 1.0.0.
   New tables get 1.1.0; existing tables continue on 1.0.0 (integration-tested).
4. Rollback: re-activate 1.0.0 and retire 1.1.0. Tables already started on 1.1.0 keep running on 1.1.0.
5. Remove an old module only after `select count(*) from game_tables t join game_versions v on v.id = t.game_version_id
   where v.rules_version = '1.0.0' and t.status in ('open','active')` is zero.
6. Emergency stop: `PATCH /api/admin/games/{id}` `{status:'suspended'}` stops new tables for the whole game without
   touching history or running tables. If the deployed registry lacks the active version, new tables are refused
   (`GAME_NOT_ACCEPTING_TABLES`) instead of guessing.

## 7a. Before launch (phase-04 gates)

- Add the game to the load driver (`apps/api/load/loadtest.ts`: a bot only needs `legalActions`) and run a profile
  with it; record numbers in docs/QA_REPORT.md. For hidden information, extend the driver's projection key check.
- Add its main pages to `e2e/release.spec.ts` so axe and the 4-width screenshots cover the renderer.
- Watch `bg_module_failures_total` after release; a module exception never mutates state (the command is rejected)
  but must be fixed — suspend the game if failures repeat.

## 8. Bots (future)

`BotAdapter` in `@bg/game-sdk` is a contract only: a bot gets its own participant id, receives exactly the
projection and legal actions of its seat, and must submit through the normal command path. No bot exists in this
delivery.
