# Ark Nova content API

Everything card-, map- or ability-specific is declared as data plus small effect functions in one chunk file
under `src/content/`. The engine (`core.ts`, `flow.ts`) owns the turn structure, the 5 Action cards (both sides),
the map, tracks, break, projects, bonus tiles and final scoring. **Do not edit engine files from a chunk** — if a
hook is missing, list it in your report.

Worked examples of every effect kind: `examples.ts` (Map A, 7 abilities, sponsors 201/202/229/243, scoring 1/3).

Reference material (outside the tracked tree, read-only): `.tmp-trophy/ark-nova/ref/` — `glossary.txt` (official
card clarifications), `icon-overview.txt`, `rulebook.txt`, `faq.txt`, `cards.json` (all cards), `maps.json`
(all map geometry/bonuses), `openboardgame/*` (another implementation; data cross-check only).

## Chunk shape

```ts
import type { ContentChunk } from '../types.ts';
export const myChunk: ContentChunk = { cards: [...], abilities: {...}, maps: [...], scoring: [...], projects: [...], fx: {...} };
```

`content/index.ts` concatenates all chunks; `registerContent` throws on any duplicate card id, ability, map,
scoring id, project id or fx key. Card **stats** (cost, size, icons, conditions, printed appeal/cp/rep, ability
keywords, sponsor level) are generated in `data.ts` — never repeat them; a `CardDef` only adds behaviour + Persian.

## Ctx and the state

Every effect receives `c: Ctx = { s, seat, rng, card? }`: the full `State`, whose effect it is (`c.seat`), the
engine RNG and the card whose effect runs. `P(c)` is that player. Effects mutate `c.s` directly.

Useful state: `p.money/appeal/cp/rep/x`, `p.hand` (hidden), `p.zoo` (played animal+sponsor ids, public),
`p.buildings` (`{id, kind, cells, full?, used?}`), `p.partners`, `p.unis`, `p.slots` (Action cards, index 0 =
slot 1), `p.up` (upgraded sides), `p.tok[card] = {mult, venom, con}`, `p.data[key]` (free **public** per-card
state, e.g. tokens on a card), `p.under[cardId]` (hidden cards under a card), `p.left` (left-edge tokens),
`p.supported`, `p.marks`. Board: `s.display` (6 folders, `null` = taken this turn), `s.deck`, `s.discard`,
`s.baseDeck` (unused base projects), `s.projects`, `s.ptoks`, `s.act` (current action: `card, strength, up,
count, small, ...`).

## Core helpers (import from `../core.ts`)

| Helper | Use |
|---|---|
| `gain(c, 'money'\|'appeal'\|'cp'\|'rep'\|'x', n)` | Tracks with caps and milestones (rep 5/8/11–15, cp 2/5/8/10, appeal 113, X 5). Negative = lose. |
| `count(s, seat, icon)`, `icons(s, seat)`, `categoriesIn`, `continentsIn`, `animalsIn`, `sponsorsIn` | Icons in a zoo (cards incl. rock/water requirements, partner zoos, universities). Cards count themselves. |
| `small(a)`, `large(a)` | Small = standard size 1–2 or petting zoo; large = size 4–5. |
| `drawDeck(c, n)`, `reveal(c)`, `takeDisplay(c, folder)`, `refillDisplay(c)`, `discardFromHand(c, ids)` | Cards. `reveal` pops the deck top (reshuffles discard if empty). |
| `inRange(c)`, `displayFolders(s)`, `range(p)` | Display folders within reputation range / with a card. |
| `advanceBreak(c, n)` | Moves the Break token; reaching the end calls a break (+1 X). |
| `toSlot1(p, card)`, `toSlot5(p, card)`, `strengthOf(p, card)` | Action cards. |
| `hireWorker(c)`, `takePartner(c, z)`, `takeUni(c, u)`, `gainBonus(c, bonus)` | Workers, partner zoos, universities, printed bonuses. |
| `playSponsor(c, id, folder)`, `sponsorError(c, id, up)`, `sponsorLevel(c, id)`, `playAnimal`, `releaseAnimal` | Play/release. |
| `coveredCells(p)`, `connected(p, cell)`, `isolated(p, cell)`, `terrain(p, 'rock'\|'water')`, `adjacentTerrain`, `isFull`, `buildingSpaces`, `mapOf(p)` | Map geometry (cells are `"x_y"`; `hex.ts` has `neighbors`, `isBorder`, `around`). |
| `qsum(c, key, ...)`, `qany(c, key, ...)` | Ask a player's passive modifiers (see Queries). |
| `fromTable(table, n)` | Final scoring tables like `{3: 1, 6: 2}` (capped at 4). |
| `log(c, 't', {...})` | Public log line. **Never log hidden card ids** (hand, deck, under). |

## Asking the player (prompts) and continuations

Effects never block: they queue steps. A continuation is a function `(c, data, ans) => void` registered in the
chunk's `fx` map under a key `"<owner>:<name>"` (owner = `s253`, `a:hunter`, `m4`, …; `core:*` is reserved).

```ts
ask.option(c, { options: [{ value, label }], label, fx: 's253:play', data, optional? });  // ans.value / ans.skip
ask.pick(c, { ids, min, max, label, fx, data, optional?, open? });                       // ans.ids
ask.place(c, { kinds: ['kiosk'], free: true, optional: true, label, fx?, data?, upgraded? }); // builds via core:placed
later(c, 'key', data);        // run a continuation when it reaches the queue head (fresh state)
afterAction(c, 'key', data);  // run after the current action finished (card already in slot 1) — "after finishing"
grantAction(c, { cards?, from?, label, optional? });  // an extra action (Action X, Determination, Hypnosis: from = target seat)
```

Engine prompts you can reuse with `later(c, key)`: `core:card1` (1 card from range or deck), `core:snap`,
`core:upgrade`, `core:partner`, `core:uni`, `core:clever` (any Action card to slot 1), `core:multiplier` (data:
allowed cards or null), `core:sponsorForMoney` (play a hand sponsor paying its level), `core:leftToken`.

Rules: prompts are answered by `c.seat` (it may be another player, e.g. Pilfering's victim — pass
`ctx(c.s, otherSeat, c.rng, c.card)`); prompts with no legal answer are skipped automatically; labels are shown
to every player, so they must not reveal hidden cards (ids in `pick` are shown only to the prompt owner). Options
are computed when the prompt is created — if they depend on an earlier answer, create them inside a `later` step.
Steps created during one resolution run before older queued steps, in creation order.

## CardDef (Animal or Sponsor card, `cards: CardDef[]`)

```ts
{ id, nameFa, textFa,
  canPlay?: (c) => errorCode | null,      // extra play check (sponsors)
  onPlay?: (c) => void,                   // immediate effect (after icons event; printed appeal is added after it)
  income?: (c) => void,                   // each break's income step
  endgame?: (c) => void,                  // final scoring (gain 'appeal' / 'cp' directly)
  on?: { icons?, animal?, sponsor?, built?, occupied?, project?, release?, action?, placementBonus?, covered? },
  q?: Queries,                            // passive modifiers
  building?: { nameFa, shape: [q, r][], rock?, water?, border?, anywhere? },  // unique building, placed by the engine
  wild?: number }                         // tokens usable as a wild icon for a BASE project (215, 218)
```

Animals only need `{ id, nameFa, textFa? }` — their abilities come from the keywords in `data.ts`.

### Events (`on`)

Handlers of **every** player's cards/abilities/map are called for every event (in seat order from the acting
player). Check `e.seat === c.seat` for "into your zoo" effects; omit it for "in any zoo". `c.card` is the
listening card. Events: `icons {seat, card, icons, source}` (double icons count 2 — loop `n` times),
`animal {seat, card, building}`, `sponsor {seat, card}`, `built {seat, building, free}`, `occupied {seat,
building}`, `project {seat, project, slot, released?}`, `release {seat, card}`, `action {seat, card, strength}`
(emitted when an action starts; `s.act` is set), `placementBonus {seat, cell, border, bonus}`, `covered {seat, cells}`.

### Queries (`q`, summed / OR-ed over the player's sources)

`animalCost(c, a)` money delta · `ignoreConditions(c, card)` conditions that may be missing (never rock/water)
· `forbidAnimal(c, a)` · `noEnclosure(c, a)` · `enclosureSize(c, building)` · `sponsorLevel(c, sp)` level delta ·
`handLimit(c)` · `projectStrength(c)` support task cost reduction · `coverTerrain(c)` · `immune(c)` (Quarantine
Lab: content checks `qany(ctx(s, victim, rng), 'immune')`) · `extraBuild(c)` · `repeatRelease(c)`.

## Abilities (`abilities: { key: AbilityImpl }`)

```ts
hunter: { nameFa, textFa: (v) => string, now?: (c, v) => void, after?: (c, v) => void, on?, q? }
```

`v` is the printed value (`number`, an action key like `'association'`, a continent, or `null`). `now` runs when
the animal is played (after its icons/animal events, before its printed appeal); `after` runs after the Animals
action finished. `on`/`q` stay active while the animal is in the zoo (`c.card` = that animal).
`abilityValue(cardId, key)` reads a printed value. Sponsors that reuse an ability call
`REG.abilities.perception!.now!(c, 2)` at run time (no import between chunks).

## Maps (`maps: MapDef[]`)

`{ id, nameFa, textFa, water, rock, blocked?, upgrade, bonuses: { cell: Bonus }, left: 7 × { b, income },
partner: {2: …}, uni: {2: …}, worker: {3: …}, preset?, marks?, on?, q?, income?, endgame?, turn? }`.
`Bonus = { k, n?, fx?, data?, labelFa? }` with `k` in money, x, rep, cp, appeal, card, snap, worker, upgrade,
partner, uni, enclosure (n = size), kiosk, pavilion, clever, multiplier, sponsor, fx (`fx` = your continuation key,
`labelFa` required). `turn` is a once-per-turn ability offered with the turn prompt. `blocked` holds printed
features (tower, harbour, …) that cannot be built on; `marks[cell]` labels them for the renderer.

## Final Scoring cards (`scoring: ScoringDef[]`)

`{ id, nameFa, textFa, score: (c) => conservationPoints }` — the engine caps each card at 4.

## Projects (`projects`)

Only Persian `{ id, nameFa, textFa? }`; project rules are generic (`PROJECT` in `data.ts`).

## Tests

Each chunk owns `packages/game-engine/test/ark-nova-<key>.test.ts`. Import the engine from `@bg/game-ark-nova`
(`core`, `flow`, `hex` namespaces, `restartTurn`, `arkNovaModule`) and build positions directly:

```ts
import { arkNovaModule, core, restartTurn, type State } from '@bg/game-ark-nova';
import { applyAction, startGame } from '../src/index.ts';
const m = arkNovaModule as never;
let snap = startGame(m, { playerCount: 2, seed: 1, options: {} }).snapshot;
// draft: every seat keeps its first 4 cards (see ark-nova.test.ts `drafted`), then edit the state:
const s = snap.state as State; const pl = s.players[s.first]!;
pl.hand = [244]; pl.money = 30; pl.rep = 5;
restartTurn(s, s.first);                       // fresh turn prompt after edits
// answer prompts with { type: 'answer', value } / { ids } / { kind, cells } / { skip: true }
```

For unit-level checks call effects directly: `const c = core.ctx(s, seat, { nextInt: () => 0 }); core.playSponsor(c, 244);
flow.settle(s, c.rng);`. Every implemented id must be covered by at least one assertion of its effect.
