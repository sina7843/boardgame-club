# Terraforming Mars content API

Every project card and corporation is a `CardDef` object (type in `../api.ts`). Content files import **only** from
`../api.ts`. The engine (`../core.ts`, `../rules.ts`) applies costs, payment, requirements, turn flow, tile rules,
placement bonuses, TR and scoring; a card only declares data plus small effect functions.

## Ownership

| file | owns |
|------|------|
| `corporations.ts` | all 12 base corporations + Beginner Corporation (done) |
| `examples.ts` | 16 worked-example cards (done): 003 008 009 012 023 025 035 052 078 102 111 115 131 141 152 153 |
| `set1.ts` … `set6.ts` | the card numbers listed in each file's header |

`index.ts` concatenates the arrays and throws on duplicate ids. Do not edit `index.ts`, `api.ts`, `core.ts`,
`rules.ts` or another chunk's file. If you need an engine change, do not make it: describe it in your report.

## Card shape

```ts
{ id: '037', name: 'Nitrogen-Rich Asteroid', nameFa: 'سیارک غنی از نیتروژن', kind: 'event', cost: 31, tags: ['space'],
  textFa: '۲ رتبهٔ زمین‌سازی و دما ۱ پله. ۱ تولید گیاه، یا ۴ تولید گیاه اگر ۳ نشان گیاه دارید.',
  tr: 2, raise: { temperature: 1 }, play: (g) => g.prod('plants', g.tags('plant') >= 3 ? 4 : 1) }
```

- `id`: official 3-digit card number as a string. `ce: true` for Corporate Era cards (left out when the host turns
  Corporate Era off). `kind`: `'automated'` (green), `'active'` (blue), `'event'` (red).
- `cost` printed M€ cost; `tags` printed tags (events keep their tags: they trigger "when you play a X tag" and
  discounts, but never count as tags in play).
- `nameFa` Persian name, `textFa` short Persian card text with Persian digits. `name` official English name.
- `vp`: a number (may be negative) or `(g) => number`. Helpers: `vpPerRes(per, each)`, `vpPerTag(tag, per)`.
- `resource`: `'microbe' | 'animal' | 'science' | 'fighter'` if the card holds resources.

### Requirements (`req`)
`temperature` / `oxygen` / `oceans` take `{ min?, max? }` (temperature in °C, e.g. `{ min: -12 }`; "max 5% oxygen" is
`{ max: 5 }`). Tolerance from Adaptation Technology / Inventrix / Special Design is applied by the engine.
`tags: { science: 3 }` own tags in play, `prod: { titanium: 1 }` "requires titanium production", `cities: 2` cities
in play (everyone), `greeneries: 1` own greenery tiles. Anything else: `canPlay: (g) => boolean` (must be pure).

### Immediate effects, applied in this order
`gain`, `prod`, `tr`, `raise`, `oceans`, `tiles`, `draw`, `addSelf`, `anyProd`, `removeAny`, `addCard`, then
`play(g)`, then `prodBox(g)`. The card is already in the owner's `played` list, so "including this" counts work.
- `gain: { plants: -1 }` / `prod: { energy: -1 }`: a negative value is mandatory; the engine refuses the card when it
  cannot be paid (production floor: M€ −5, others 0). Positive values just add.
- `raise: { temperature: 2, oxygen: 1 }`: TR, the heat/ocean/temperature bonuses and caps are automatic.
- `oceans: 2`: queues ocean placements (skipped once 9 oceans are out). Ocean TR and adjacency bonuses are automatic.
- `tiles: [{ kind: 'city' }, { kind: 'special', rule: 'isolated' }]`: queues placements; the placed tile carries
  `card: <id>` so `g.tileOf()` finds it. A card whose non-ocean tile has no legal area cannot be played. Tile rules
  are listed on `TileRule` in `api.ts` (`city`, `greenery`, `land`, `isolated`, `isolatedCity`, `volcanic`, `noctis`,
  `oceanArea`, `landOcean`, `nextToCity`, `twoCities`, `nextToGreenery`, `steelTi`, `steelTiOwnAdj`, `phobos`,
  `ganymede`). Use `kind: 'ocean', rule: 'landOcean'` for Artificial Lake, `kind: 'greenery', rule: 'oceanArea'` for
  Mangrove, `kind: 'city', rule: 'noctis'` for Noctis City, etc.
- `draw: 2`, `addSelf: 1` (resources onto this card), `anyProd: { res: 'plants', n: 1 }` (mandatory "decrease any
  plant production 1 step"; the card is unplayable when no player can lose it), `removeAny: { res: 'plants', n: 3,
  steal?: true }` (optional "remove up to 3 plants from any player"; Protected Habitats is respected),
  `addCard: { type: 'microbe', n: 2, other?: true }` ("add 2 microbes to (another) card"; skipped without a target).
- `prodBox(g)`: production that depends on the board/tags (Power Grid, Medical Lab…). Robotic Workforce re-runs
  `prod` + `prodBox` of a building card via `g.copyProduction(id)`, so put **all** production of a card in `prod` /
  `prodBox`, never in `play`.

### Blue-card actions (`action`, once per generation)
```ts
action: { cost?: 12, payWith?: { titanium: true }, can?: (g) => boolean, run: (g) => void }
```
`cost` is M€ paid by the engine (Helion may use heat; `payWith` adds steel/titanium). Resource costs other than M€
(spend 1 energy, remove 2 microbes…) are checked in `can` and paid in `run` (`g.gain('energy', -1)`,
`g.addRes(-2)`). `can` and `canPlay` are called during validation: they must not change state.

### Ongoing effects (while the card is in its owner's tableau)
- `discount: (card, g) => n` M€ off cards the owner plays; `spDiscount: (project, g) => n` (project ids:
  `sellPatents powerPlant asteroid aquifer greenery city`).
- `reqTolerance: 2`, `steelBonus: 1`, `titaniumBonus: 1`, `greeneryPlants: 7`, `heatAsMc: true`.
- `protects: true` (Protected Habitats: opponents may not remove your plants, animals, microbes). Check
  `g.isProtected(seat)` before removing another player's animals/microbes.
- `keepsResources: true` (Pets). Anything removing card resources must skip cards with `g.card(id).keepsResources`.
- Triggers, called for every card in every tableau (`g.seat` = owner of the effect, `g.self` = this card):
  - `onCardPlayed(g, e)` after any card resolved its immediate effects; `e.seat` who played, `e.card` the CardDef.
    "When you play" → `if (e.seat !== g.seat) return;`. Count tags with `tagCount(e.card, 'plant', 'animal')`.
  - `onTilePlaced(g, e)` with `e.kind`, `e.space`, `e.seat`, `e.onMars`, `e.bonus` (steel/titanium/plants/M€ the
    placer got from the area), `e.card`.
  - `onStandardProject(g, e)` with `e.project` (also fires for `sellPatents`), `e.cost` (base cost).

### Corporations
`kind: 'corporation'`, `id: 'R..'`, `startMc`, data `gain`/`prod` (applied at start), `start(g)` for anything else,
`firstAction(g)` for a mandatory first action, plus any ongoing field above.

## The effect context `g` (`Ctx`)
`g.s` full state, `g.p` owner's PlayerState, `g.seat`, `g.self`. Resources: `gain(res, n)`, `prod(res, n)`,
`prodOf(seat, res, n)`, `tr(n)`, `raise(param, steps)` (returns steps done). Tiles: `tile(kind, rule?, then?)`,
`ocean(n)`, `claim()`, `tileOf(card?)`, `adjacent(space)`, `tileAt(space)`, `space(id)`. Cards: `draw(n)`,
`look(n)` (taken off the deck, not in hand — hand them to a `cards` prompt and discard the rest), `discardCards(ids)`,
`reveal()` (Search For Life: public, goes to discard). Card resources: `addRes(n, card?)`, `resOn(card?)`,
`cardsWith(type, { other?, min?, seat? })`, `addToCard(type, n, other?)`. Counting: `tags(tag, seat?)`,
`cities({ seat?, onMars? })`, `greeneries(seat?)`, `tableau(seat?, events?)`, `eventsPlayed()`. Others:
`isProtected(seat)`, `removeAny`, `reduceAnyProd`, `canReduceAnyProd`, `copyProduction(card)`, `card(id)`.
Player flags: `g.p.trRaised`, `g.p.nextDiscount` (Indentured Workers: set to 8), `g.p.nextReqBonus` (Special Design:
set to 2), `g.p.used`.

## Decisions in the middle of an effect (prompts)
Queue with `g.prompt({...})` (or `g.choose(labelsFa, key)`) and continue in `resolve[key](g, answer, data)`:

| kind | fields | answer |
|------|--------|--------|
| `space` | `tile`, `rule` (use `g.tile`) | `a.space` (tile is already placed when `resolve` runs) |
| `player` | `options: seat[]` | `a.seat` |
| `card` | `options: cardId[]` | `a.card` |
| `choice` | `options: labelFa[]` | `a.index` |
| `cards` | `cards`, `min`, `max` | `a.cards` |
| `amount` | `min`, `max` | `a.amount` |

Common fields: `then: { card: '<this id>', key: 'x' }`, `data` (JSON only), `labelFa`, `optional: true` (adds a
skip; skipped prompts call nothing), `seat` (default: the owner). Prompts with no option are dropped automatically.
A prompt queued inside a resolver runs before the remaining queue. On timeout the engine answers with the first
option / `min` / skip. Only the prompted player sees prompt contents.

Example — Mining Rights: place a tile on a steel/titanium area, gain that production:
```ts
play: (g) => g.tile('special', 'steelTi', { card: '067', key: 'placed' }),
resolve: { placed: (g, a) => g.prod(g.space(a.space!).bonus.includes('titanium') ? 'titanium' : 'steel', 1) }
```
(For `play`-queued tiles pass `then`; tiles from `tiles: [...]` have no continuation.)

## Rules for content code
- Deterministic: never `Math.random`/`Date`; randomness only through `draw`/`look`/`reveal`.
- Never mutate in `can`, `canPlay`, `discount`, `vp`.
- Persian text uses Persian digits and no physical left/right wording.

## Tests (`packages/game-engine/test/terraforming-mars-<key>.test.ts`)
Import from `@bg/game-terraforming-mars` and the engine as in `terraforming-mars.test.ts`; copy its helpers
`act`, `reject`, `st`, `hints`, `begin` and `clean` (a clean action-phase state with corporation-free players, seat 0
to act). Pattern: put the card in `s.players[0].hand`, set the state, `act(snap, 0, { type: 'play', card: 'NNN' })`,
answer prompts with `{ type: 'respond', ... }`, assert resources/production/tiles/VP via `score(state, seat).cards`.
After two actions the turn passes: reset with `Object.assign(st(snap), { current: 0, actionsTaken: 0 })`.
Test every card's requirement, effect, action and VP, and that an illegal play is rejected without mutating state.
