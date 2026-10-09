# Gaia Project content API

Everything that differs between factions, tech tiles, boosters, scoring tiles and federation tokens is **data plus
small effect functions** declared in `src/content/*.ts`. The engine (`core.ts`, `rules.ts`) never names a faction or
tile. `content/index.ts` concatenates every chunk and registers it (`registerContent`); ids must be unique across files
(a duplicate throws at import).

Each chunk owns exactly one file and exports one `ContentBundle`:

```ts
import type { ContentBundle } from '../types.ts';
export const factionsA: ContentBundle = { factions: [/* FactionDef */] };
```

Only import from `../types.ts`, `../core.ts`, `../map.ts` (and `./base.ts` for the shared counters `mineCount`,
`bigCount`, `stationCount`). Never import `../rules.ts` (cycle). Effects mutate the state draft they receive; the engine
clones it per step. No `Math.random`, no `Date`.

## The context `x`

Every effect gets `x: X = { s: GaiaState, seat: number }` — the whole state and the seat that owns the effect.
Useful state: `s.pl[seat]` (`c o k q vp`, `power {b1 b2 b3 gaia brain}`, `research`, `gf`, `gfGaia`, `booster`,
`techs`, `feds`, `satellites`, `used`, `mark`), `s.hexes[i]` (`planet owner building extra sats feds sector q r`),
`s.round`, `s.phase`.

`p.mark` is free per-player JSON storage for counters/flags (e.g. `mark.itarsAside = 3`).

## Effect kinds (`Effects`)

| Field | When it runs | Example |
|---|---|---|
| `onGain(x)` | once, when the tile/token is taken | `std1`: `gain(x.s, x.seat, { o: 1, q: 1 })` |
| `income: Gain \| (x) => Gain` | every income phase while held (tech: while not covered) | `std5`: `{ o: 1, pw: 1 }` |
| `onPass(x)` | when the holder passes (also in round 6) | `b6`: `vp(x.s, x.seat, mineCount(x.s, x.seat), 'booster')` |
| `on: { mine \| upgrade \| terraform \| research \| federation \| gaiaform }` | after the holder's own event | Geodens: `mine: (x, e) => { if (hasPI(x.s, x.seat) && e.newType) gain(...{ k: 3 }) }` |
| `action: SpecialAction` | once-per-round special action (orange octagon) | `std9`, Firaks PI |
| `conversions: Conversion[]` | free actions, any number, during your turn | Hadsch Hallas PI |
| `powerValue(x, hex, base)` | passive: power value of the holder's structure | `std3`: PI/academies 3 → 4 |
| `fedThreshold(x, base)` | passive: power value needed for a federation (base 7) | Xenos PI → 6 |
| `mineCost(x, hex, cost)` | passive: change the cost of a mine (after terraforming/QIC) | e.g. pay ore instead of the gaia QIC |
| `onGaiaPhase(x)` | **factions only**, each gaia phase, **before** gaia-area tokens return | Itars PI, Terrans PI |
| `leech { options, resolve }` | **factions only**, replaces the accept/decline leech decision | Taklons PI |
| `decide: { [key]: (x, choice, d) => void }` | handler for a `custom` decision this source created | see below |

Events (`GameEvent`) fired for the acting seat:

- `mine { hex, planet, gaia, newType, newSector, extra }` — `gaia` = built on a gaia planet (not a Lantids extra mine);
  `newType`/`newSector` relative to the seat's structures before this mine; Lost Planet fires `planet: 'l'`.
- `upgrade { hex, to: 'ts'|'lab'|'pi'|'ac1'|'ac2', from }`
- `terraform { steps }` (only when steps > 0, before the `mine` event)
- `research { track, level }` (every advance, paid or free)
- `federation { token }` (formed, terraforming-5 token, or a token granted by content via `gainFedToken`)
- `gaiaform { hex }`

Round scoring tiles listen to the same events (`RoundTileDef.on`) for the current round only.

### Faction data (`FactionDef`)

```ts
{
  id: 'xenos', nameFa: 'زنوس', nameEn: 'Xenos', home: 'd',            // home: r o v d s t i (wheel order)
  start: { research: { ai: 1 }, c?, o?, k?, q?, b1?, b2?, b3?, brain? }, // defaults 15c 4o 3k 1q, bowls 2/4/0
  income: { o: 1, k: 1 },                    // base income printed on the board (default 1 ore + 1 knowledge)
  buildings: { ts?: Gain[], lab?: Gain[], pi?: Gain, ac1?: Gain, ac2Action?: Gain, piCost?: Gain },
  setupMines: 3,                             // default 2; Xenos 3; Ivits 0 with setupPI: true
  setupPI: false,
  flags: { gaiaToBowl2?, burnToGaia?, bowl3DoubleAfterPI?, singleFederation?, satelliteQic?, sharePlanets?,
           noNavigationUntilPI?, qicAsOreUntilAc2? },
  effects: { ... },                          // see table; "after PI" effects check hasPI(x.s, x.seat) themselves
  abilityFa: '…', piFa: '…'                  // Persian text shown in the UI
}
```

Defaults (standard faction board): mines give ore income `[0,1,2,2,3,4,5,6,7]` for 0–8 mines (plus base income),
trading stations `3,4,4,5` credits, labs `1,1,1` knowledge, PI `4 charge + 1 token`, knowledge academy `2 knowledge`,
QIC academy action `1 QIC`. Override only what the faction board changes. `start.research` levels are applied without
rewards logging (they do give level rewards, e.g. a gaiaformer for gaia 1, QIC for AI 1).

Engine flags (already implemented in core):

| Flag | Effect |
|---|---|
| `gaiaToBowl2` | gaia-area tokens return to bowl II (Terrans) |
| `burnToGaia` | burning moves the removed token to the gaia area (Itars) |
| `bowl3DoubleAfterPI` | after the PI each bowl-III token is worth 2 when spending (Nevlas) |
| `singleFederation` | all federations form one growing federation; new buildings may touch it (Ivits) |
| `satelliteQic` | satellites cost 1 QIC instead of a power token (Ivits) |
| `sharePlanets` | may build a mine on a planet another player colonized, no terraforming (Lantids) → `hexes[i].extra` |
| `noNavigationUntilPI` | navigation research blocked until the PI (Bal T'aks) |
| `qicAsOreUntilAc2` | after set-up every QIC gained becomes ore until the QIC academy is built (Gleens) |

### Tech tiles, boosters, tiles, tokens

```ts
TechDef      { id: 'std1'…'std9' | 'adv1'…'adv15', kind: 'std'|'adv', labelFa, effects }
BoosterDef   { id: 'b1'…'b10', labelFa, income: Gain, effects? }
RoundTileDef { id: 'r1'…'r10', labelFa, on: Triggers }
FinalTileDef { id: 'f1'…'f6', labelFa, neutral, value(s, seat) }   // neutral = 2-player neutral count
FedTokenDef  { id, labelFa, gain: Gain, green, copies }              // copies 0 = never in the supply
```

Tech tile numbering (fixed so chunks never collide):

| id | tile | id | tile |
|---|---|---|---|
| std1 | immediately 1 ore + 1 QIC | adv1 | pass: 3 VP per federation token |
| std2 | immediately 7 VP | adv2 | pass: 3 VP per research lab |
| std3 | PI and academies have power value 4 | adv3 | pass: 1 VP per planet type |
| std4 | immediately 1 knowledge per planet type | adv4 | immediately 2 VP per mine |
| std5 | income 1 ore + 1 power charge | adv5 | immediately 4 VP per trading station |
| std6 | income 1 knowledge + 1 credit | adv6 | immediately 5 VP per federation token |
| std7 | 3 VP per mine built on a gaia planet | adv7 | immediately 2 VP per sector you are in |
| std8 | income 4 credits | adv8 | immediately 1 ore per sector you are in |
| std9 | action: charge 4 power | adv9 | immediately 2 VP per gaia planet |
| | | adv10 | action: 1 QIC + 5 credits |
| | | adv11 | action: 3 ore |
| | | adv12 | action: 3 knowledge |
| | | adv13 | 3 VP per trading station built |
| | | adv14 | 3 VP per mine built |
| | | adv15 | 2 VP per research step |

Already implemented in `base.ts`: std1, std3, std5, std7, std9, adv1, adv4, adv14, all boosters, round tiles, final
tiles, federation tokens (incl. the Gleens token `gleens`), and four factions (Hadsch Hallas, Xenos, Geodens, Firaks).

## Core helpers (`../core.ts`)

Resources: `gain(s, seat, g)` (tokens before charge; caps 30c/15o/15k; Gleens rule), `pay`, `canPay`, `vp(s, seat, n, why)`,
`addGains`. Power: `charge` (returns charged), `chargeable`, `addTokens`, `removeTokens`, `moveToGaia`, `spendable`,
`spendPower`, `burn`, `tokens`. Research: `advance(s, seat, track)` (one level + its reward + event; check
`researchBlock` first), `researchBlock`, `queueResearch(s, seat, tracks|null)` (free advance chosen by the player).
Map: `dist`, `within`, `adjacent`, `range`, `distanceFrom`, `qicFor(s, seat, hex, extraRange)`, `isolated`.
Building: `minePlan(s, seat, hex, { freeSteps, extraRange })` (cost or error code), `buildMine` (pays, events, leech,
joins a federation), `upgradeCost`, `upgrade`, `gaiaformPlan`, `gaiaform`, `queueLeech(s, from, hex)`.
Structures: `colonized`, `structuresOf`, `buildingAt`, `countBuilding(s, seat, 'mine'|'ts'|'lab'|'pi'|'ac'|'ac1'|'ac2')`,
`hasPI`, `planetTypes`, `sectorsOf`, `gaiaPlanets`, `powerValue`. Tech: `techOptions`, `queueTech` (a tech decision),
`takeTech`. Federations: `fedPlan`, `formFederation`, `gainFedToken(s, seat, id)`, `fedThreshold`. Misc: `log`, `fire`,
`flag`, `factionOf`, `conversion(id, labelFa, cost, gain)` (builds a simple `Conversion`), `pushDecision`, `takeLeech`,
`leechAmount`.

Gain keys: `c` credits, `o` ore, `k` knowledge, `q` QIC, `vp`, `pw` = charge power, `t` = power tokens to bowl I.
As a cost, `pw` spends from bowl III and `t` removes tokens from the cycle.

## Special actions

```ts
action: {
  labelFa: 'تنزل آزمایشگاه به ایستگاه تجاری و یک پیشرفت پژوهش',
  can: (x) => hasPI(x.s, x.seat),                       // optional availability (used-this-round is checked by the engine)
  targets: (x) => [/* hex ids */],                      // optional: one legal action per target hex
  run: (x, hex) => { /* pay costs yourself, mutate, push decisions */ }
}
```

The action key is the source id: `faction:<id>`, `booster:<id>`, `tech:<id>` (and `ac2` for the QIC academy). The
client sends `{ type: 'special', id: 'faction:firaks', hex: 12 }`.

## Player decisions (`custom`)

When an effect needs a choice, push a decision; the engine stops until that seat answers with
`{ type: 'decide', choice }` (choice must be one of `options`, max 40 chars).

```ts
pushDecision(x.s, { kind: 'custom', seat: x.seat, source: 'faction:itars', key: 'tech', options: ['yes', 'no'],
  labelFa: '۴ ژتون گایا → یک کاشی فناوری؟' });
// …and in the same source's effects:
decide: { tech: (x, choice) => { if (choice === 'yes') { x.s.pl[x.seat]!.mark.itarsAside -= 4; queueTech(x.s, x.seat); /* ask again */ } } }
```

Decisions created while resolving one step run before later leech offers, in the order pushed. A decision whose options
become empty is skipped. On timeout the engine picks `decline` if offered, otherwise the first option — put the
"do nothing" option first when that is the safe default.

## Tests

Each chunk has `packages/game-engine/test/gaia-project-<key>.test.ts`. Import from `@bg/game-gaia-project` and use the
helpers pattern of `gaia-project.test.ts` (`ready([...factions])`, `turnOf`, direct state edits on `st(snap)` before
an `act`). Cover every item you implement, plus a seeded random game that uses your factions/tiles and terminates.
Run: `cd packages/game-engine && npx vitest run test/gaia-project` and `pnpm --filter @bg/game-gaia-project typecheck`.
