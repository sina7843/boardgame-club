# Brass: Birmingham content API

All game content is **plain data** declared in one chunk file each. The engine (`../rules.ts`) interprets it; a chunk
never contains rules code. Types live in `../types.ts`.

```ts
import type { ContentChunk } from '../types.ts';
export const townsNorth: ContentChunk = { locations: [...], links: [...], merchantTiles: [...], tiles: [...], industryCards: [...] };
```

`index.ts` (owned by the architect) concatenates the chunks in a fixed order:
`towns-north, towns-south, links-merchants, industries-goods, industries-resources`. That order defines card ids and
the deterministic "board order" used for tie-breaks, so never reorder chunks and never move an entry to another chunk.
Each chunk agent edits **only** its own file and its own test `packages/game-engine/test/brass-<key>.test.ts`.

## Kinds of content

### `LocationDef` (towns, farm breweries, merchants)

```ts
{ id: 'cannock', nameFa: 'کنک', nameEn: 'Cannock', kind: 'town', pos: [41, 44], color: 'yellow',
  slots: [['manufacturer', 'coal'], ['coal']], cards: [2, 2, 2] }
{ id: 'farm-cannock', nameFa: 'آبجوسازی روستایی کنک', nameEn: 'Farm Brewery (Cannock)', kind: 'farm', pos: [45, 49], slots: [['brewery']] }
{ id: 'oxford', nameFa: 'آکسفورد', nameEn: 'Oxford', kind: 'merchant', pos: [72, 93],
  merchant: { spaces: 2, minPlayers: 2, bonus: { kind: 'income', amount: 2 }, linkVp: 2 } }
```

- `id`: lower-case kebab of the English name (`stoke-on-trent`, `burton-on-trent`). Farm breweries: `farm-cannock`,
  `farm-worcester`. Merchants: `warrington`, `nottingham`, `shrewsbury`, `oxford`, `gloucester`.
- `slots`: printed build spaces in order; a space with two icons accepts either industry. The engine enforces "use a
  single-icon space before a two-icon space" and the Canal Era "one own tile per location" rule.
- `cards`: copies of the town's Location card in the draw deck with `[2, 3, 4]` players (0 = not in that deck).
  Farm breweries and merchants have no cards.
- `pos`: 0..100 frame, north up (renderer only). `color`: location-banner colour (renderer only).
- `merchant.minPlayers`: with fewer players no merchant tiles (and no beer) are placed, but the location still exists
  for connections, market coal and link scoring. `merchant.linkVp`: link-VP icons printed at the merchant.
- `merchant.bonus` (consumed merchant beer during a Sell): `{kind:'money', amount}` (+£), `{kind:'vp', amount}`,
  `{kind:'income', amount}` (income-track spaces), `{kind:'develop'}` (the seller may name an industry in the sale's
  `develop` field; its lowest mat tile is removed without iron; lightbulb tiles are refused).

### `LinkDef` (canal / rail lines)

```ts
{ a: 'cannock', b: 'walsall', canal: true, rail: true }
{ a: 'tamworth', b: 'walsall', canal: false, rail: true }            // rail only
{ a: 'kidderminster', b: 'worcester', canal: true, rail: true, also: ['farm-worcester'] } // one link, three places
```

The link id is the two end ids sorted and joined by `~` (`linkId()`, e.g. `birmingham~oxford`), so declaration order
does not matter, but declare each line exactly once. A link whose locations are not all declared yet is skipped by
`index.ts`, so chunks may land in any order.

### `MerchantTileDef`

```ts
{ id: 'm2-cotton', goods: ['cotton'], minPlayers: 2 }
{ id: 'm3-all', goods: ['cotton', 'manufacturer', 'pottery'], minPlayers: 3 }
{ id: 'm2-blank-1', goods: [], minPlayers: 2 }   // blank: buys nothing, never gets beer
```

Setup takes the tiles with `minPlayers <= players`, shuffles them and fills the spaces of the active merchants.

### `IndustryTileDef` (one entry per level; `count` = tiles of that level on each player mat)

```ts
{ industry: 'cotton', level: 1, count: 3, cost: 12, coal: 0, iron: 0, beer: 1, produce: 0, vp: 5, income: 5, linkVp: 1, era: 'canal' }
{ industry: 'brewery', level: 1, count: 2, cost: 5, coal: 0, iron: 1, beer: 0, produce: { canal: 1, rail: 2 }, vp: 4, income: 4, linkVp: 2, era: 'canal' }
{ industry: 'pottery', level: 1, count: 1, cost: 17, coal: 0, iron: 1, beer: 1, produce: 0, vp: 10, income: 5, linkVp: 1, noDevelop: true }
```

- `cost` £, `coal`/`iron` consumed when built; `beer` needed to sell (goods only, 0 allowed: still needs a merchant).
- `produce`: coal cubes (coal mine), iron cubes (iron works), beer barrels (brewery: `{ canal: 1, rail: 2 }`).
- `vp`: VP when flipped (scored at each era end); `income`: income-track **spaces** gained on flipping;
  `linkVp`: link icons the flipped tile gives each adjacent link.
- `era: 'canal'` = canal-only icon (cannot be built in the Rail Era, must be developed away); `era: 'rail'` = only in
  the Rail Era. `noDevelop: true` = lightbulb icon (cannot be developed).

### `IndustryCardDef`

```ts
{ id: 'card-coal', industries: ['coal'], copies: [2, 2, 3] }
{ id: 'card-cotton-manufacturer', industries: ['cotton', 'manufacturer'], copies: [0, 6, 8] }
```

## What the engine already does (do not reimplement)

Turn/round/era flow, 1 action in the first Canal round, discards and wild piles, turn order by spend, income and
shortfall, loans (−3 levels, never below −10), scout, coal (closest connected mine, then market via any merchant
connection, £8 when empty), iron (any works, then market, £6 when empty), beer (merchant barrel, own anywhere,
opponents' connected), overbuilding, selling coal/iron to markets on build, flipping, era scoring, level-1 removal,
merchant beer refill, final ranking (VP, then income level, then money; still tied = shared place).

## Tests per chunk

Write `packages/game-engine/test/brass-<key>.test.ts` importing from `@bg/game-brass` (`LOCATIONS`, `LINKS`, `TILES`,
`MERCHANT_TILES`, `INDUSTRY_CARDS`, `CARDS`, `deckFor`, `STACK`, `brassModule`, engine helpers from `../src/index.ts`).
Assert every entry of your chunk exactly (ids, slots, numbers), cross-check totals given in your instructions, and add
at least one engine-level scenario using your content (see `brass.test.ts` for the `table()`/`act()` pattern).
Run: `cd packages/game-engine && npx vitest run test/brass` and `pnpm --filter @bg/game-brass typecheck`.
