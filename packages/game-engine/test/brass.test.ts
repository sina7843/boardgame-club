import { describe, expect, it } from 'vitest';
import {
  CARDS, LINK, LINKS, LOCATIONS, MERCHANT_TILES, STACK, TILES, linkId, WILD_INDUSTRY, WILD_LOCATION, brassModule, buyPrice, deckFor, incomeLevel, legalFor, topSpace, brass,
  type BrassState, type BrassView, type Industry, type Tile
} from '@bg/game-brass';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = brassModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as BrassState;
const game = (players = 2, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** n-th copy of a town's Location card / an Industry card. */
const loc = (town: string, n = 0) => CARDS.filter((c) => c.kind === 'location' && c.loc === town)[n]!.id;
const indCard = (x: Industry, n = 0) => CARDS.filter((c) => c.kind === 'industry' && c.industries.includes(x))[n]!.id;
const tile = (owner: number, industry: Industry, level: number, cubes = 0, flipped = false): Tile => ({ owner, industry, level, cubes, flipped });
const L = (a: string, b: string) => { const id = linkId({ a, b }); if (!LINK.has(id)) throw new Error(`no link ${id}`); return id; };

/** A 2-player table in round 2 of the Canal Era: seat 0 to act with 2 actions and the given hand. */
function table(hand: number[], other: number[] = [indCard('brewery', 0), indCard('brewery', 1), indCard('brewery', 2)]) {
  const snap = game(2, 7);
  const s = st(snap);
  s.order = [0, 1]; s.turn = 0; s.round = 2; s.actionsLeft = 2;
  s.hands = [hand, other];
  return snap;
}

describe('brass content registry', () => {
  it('ids are unique and every link and card points at a declared location', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LINKS.map(linkId)).size).toBe(LINKS.length);
    expect(new Set(MERCHANT_TILES.map((t) => t.id)).size).toBe(MERCHANT_TILES.length);
    for (const l of LOCATIONS) {
      if (l.kind === 'merchant') expect(l.merchant && !l.slots && !l.cards).toBeTruthy();
      else expect(l.slots?.length && !l.merchant).toBeTruthy();
      if (l.kind === 'farm') expect([l.slots, l.cards]).toEqual([[['brewery']], undefined]);
    }
    for (const ind of ['cotton', 'manufacturer', 'pottery', 'coal', 'iron', 'brewery'] as const) {
      const levels = TILES.filter((t) => t.industry === ind).map((t) => t.level);
      expect(levels).toEqual([...new Set(levels)].sort((a, b) => a - b));
    }
  });

  // Runs once every chunk has landed (27 locations = 20 towns + 2 farm breweries + 5 merchants).
  it.skipIf(LOCATIONS.length < 27)('complete base game: 64/54/40-card decks, 39 lines, 9 merchant tiles, 45 mat tiles', () => {
    expect([2, 3, 4].map((n) => deckFor(n).length)).toEqual([40, 54, 64]);
    expect(LINKS).toHaveLength(39);
    expect(LINKS.filter((l) => l.canal && !l.rail)).toHaveLength(1);
    expect(LINKS.filter((l) => !l.canal && l.rail)).toHaveLength(8);
    expect([2, 3, 4].map((n) => MERCHANT_TILES.filter((t) => t.minPlayers <= n).length)).toEqual([5, 7, 9]);
    expect(Object.fromEntries(Object.entries(STACK).map(([k, v]) => [k, v.length]))).toEqual({ cotton: 11, manufacturer: 11, pottery: 5, coal: 7, iron: 4, brewery: 7 });
    expect(LOCATIONS.filter((l) => l.kind === 'merchant').reduce((n, l) => n + l.merchant!.spaces, 0)).toBe(9);
  });
});

describe('brass full base-game inventory', () => {
  it('every board location, merchant and card exists exactly once', () => {
    const byKind = (k: string) => LOCATIONS.filter((l) => l.kind === k).map((l) => l.id).sort();
    expect(byKind('town')).toEqual(['belper', 'birmingham', 'burton-on-trent', 'cannock', 'coalbrookdale', 'coventry', 'derby', 'dudley', 'kidderminster', 'leek',
      'nuneaton', 'redditch', 'stafford', 'stoke-on-trent', 'stone', 'tamworth', 'uttoxeter', 'walsall', 'wolverhampton', 'worcester']);
    expect(byKind('farm')).toEqual(['farm-cannock', 'farm-worcester']);
    expect(byKind('merchant')).toEqual(['gloucester', 'nottingham', 'oxford', 'shrewsbury', 'warrington']);
    // Build spaces on the board: 20 towns + 2 farm breweries.
    expect(LOCATIONS.reduce((n, l) => n + (l.slots?.length ?? 0), 0)).toBe(49);
    // Location cards (2/3/4 players) and industry cards; 2 wild piles of 4.
    const locCards = (n: number) => deckFor(n).filter((id) => CARDS[id]!.kind === 'location').length;
    expect([2, 3, 4].map(locCards)).toEqual([27, 35, 41]);
    expect([2, 3, 4].map((n) => deckFor(n).length - locCards(n))).toEqual([13, 19, 23]);
    expect(CARDS).toHaveLength(64);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(64);
    expect(WILD_LOCATION).not.toBe(WILD_INDUSTRY);
    // Player mat: cotton 11, manufacturer 11, pottery 5, coal 7, iron 4, brewery 7 = 45 tiles; level counts per industry.
    expect(Object.fromEntries(Object.entries(STACK).map(([k, v]) => [k, v.map((t) => t.level).join('')]))).toEqual({
      cotton: '11122333444', manufacturer: '12234556788', pottery: '12345', coal: '1223344', iron: '1234', brewery: '1122334'
    });
    // Canal-only tiles: level 1 of cotton, manufacturer, coal, iron, brewery. Rail-only: Pottery V and Brewery IV.
    expect(TILES.filter((t) => t.era === 'canal').map((t) => `${t.industry}${t.level}`).sort()).toEqual(['brewery1', 'coal1', 'cotton1', 'iron1', 'manufacturer1']);
    expect(TILES.filter((t) => t.era === 'rail').map((t) => `${t.industry}${t.level}`).sort()).toEqual(['brewery4', 'pottery5']);
    expect(TILES.filter((t) => t.noDevelop).map((t) => `${t.industry}${t.level}`).sort()).toEqual(['pottery1', 'pottery3']);
    // Merchants: 9 spaces; bonuses.
    expect(Object.fromEntries(LOCATIONS.filter((l) => l.merchant).map((l) => [l.id, [l.merchant!.spaces, l.merchant!.minPlayers, l.merchant!.bonus.kind]]))).toEqual({
      oxford: [2, 2, 'income'], shrewsbury: [1, 2, 'vp'], gloucester: [2, 2, 'develop'], warrington: [2, 3, 'money'], nottingham: [2, 4, 'vp']
    });
    expect(MERCHANT_TILES.map((t) => t.id).sort()).toEqual(['m2-all', 'm2-blank-1', 'm2-blank-2', 'm2-cotton', 'm2-manufacturer', 'm3-blank', 'm3-pottery', 'm4-cotton', 'm4-manufacturer']);
  });

  it('catalog: rules guide has sections and every policy is set', () => {
    const c = brass.catalog;
    const sections = c.rulesFa.filter((x) => x.startsWith('## ')).map((x) => x.slice(3));
    for (const h of ['هدف', 'آماده‌سازی', 'پایان بازی', 'امتیاز', 'نکته‌ها']) expect(sections.some((x) => x.includes(h)), h).toBe(true);
    expect(c.nameFa).toBe('برس: بیرمنگام');
    expect(c.nameOriginal).toBe('Brass: Birmingham');
    expect(brass.manifest.playerCounts).toEqual({ min: 2, max: 4 });
  });
});

describe('brass content-independent rules', () => {
  it('income track levels and loan spaces', () => {
    expect([0, 10, 11, 12, 30, 31, 33, 60, 61, 64, 99].map(incomeLevel)).toEqual([-10, 0, 1, 1, 10, 11, 11, 20, 21, 21, 30]);
    expect([-10, -3, 0, 1, 10, 11, 20, 21, 30].map(topSpace)).toEqual([0, 7, 10, 12, 30, 33, 60, 64, 99]);
    for (let lvl = -10; lvl <= 30; lvl++) expect(incomeLevel(topSpace(lvl))).toBe(lvl);
    expect([13, 14, 1, 0].map((c) => buyPrice('coal', c))).toEqual([1, 1, 7, 8]);
    expect([8, 10, 1, 0].map((c) => buyPrice('iron', c))).toEqual([2, 1, 5, 6]);
  });

  it('setup per player count: 8 cards + 1 face-down discard, £17, income 10, markets 13/8, random order', () => {
    for (const n of [2, 3, 4]) {
      const s = st(game(n, n));
      const total = deckFor(n).length;
      const dealt = s.hands.flat().length + s.facedown.flat().length;
      expect(dealt + s.deck.length).toBe(total);
      if (total >= 9 * n) { expect(s.hands.every((h) => h.length === 8)).toBe(true); expect(s.facedown.every((d) => d.length === 1)).toBe(true); }
      expect(s.discards.every((d) => d.length === 0)).toBe(true);
      expect(s.money).toEqual(Array(n).fill(17));
      expect(s.income).toEqual(Array(n).fill(10));
      expect([s.coal, s.iron]).toEqual([13, 8]);
      expect([...s.order].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(s.actionsLeft).toBe(1);
      expect(s.era).toBe('canal');
      for (const l of LOCATIONS) if (l.merchant) {
        const placed = s.merchants[l.id]!.tiles;
        expect(placed).toHaveLength(l.merchant.spaces);
        if (l.merchant.minPlayers > n) expect(placed.every((t) => t === null)).toBe(true);
      }
    }
    expect(() => brassModule.setup({ playerCount: 1, options: {}, rng: createRng({ s: 1 }) })).toThrow();
    // deck variants: a copy is in the deck from its minPlayers on
    expect(deckFor(2).length).toBeLessThanOrEqual(deckFor(3).length);
    expect(deckFor(3).length).toBeLessThanOrEqual(deckFor(4).length);
  });

  it('build: location card anywhere, single-icon slot first, one tile per town in the Canal Era', () => {
    let snap = table([loc('cannock'), loc('cannock', 1), loc('birmingham')]);
    const before = JSON.stringify(st(snap));
    expect(reject(snap, 0, { type: 'build', card: loc('cannock'), industry: 'coal', loc: 'cannock', slot: 0 })).toBe('USE_SINGLE_SLOT');
    expect(reject(snap, 0, { type: 'build', card: loc('birmingham'), industry: 'coal', loc: 'cannock', slot: 1 })).toBe('CARD_CANNOT_BUILD');
    expect(reject(snap, 0, { type: 'build', card: loc('cannock'), industry: 'iron', loc: 'cannock', slot: 1 })).toBe('SLOT_REJECTS_INDUSTRY');
    expect(reject(snap, 1, { type: 'pass', card: indCard('brewery') })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'pass', card: 999 })).toBe('NOT_IN_HAND');
    expect(JSON.stringify(st(snap))).toBe(before);
    snap = act(snap, 0, { type: 'build', card: loc('cannock'), industry: 'coal', loc: 'cannock', slot: 1 });
    const s = st(snap);
    expect(s.board.cannock![1]).toEqual(tile(0, 'coal', 1, 2)); // not connected to a merchant: cubes stay
    expect([s.money[0], s.spent[0], s.mat[0]!.coal, s.coal]).toEqual([12, 5, 1, 13]);
    expect(s.discards[0]!.at(-1)).toBe(loc('cannock'));
    expect(reject(snap, 0, { type: 'build', card: loc('cannock', 1), industry: 'coal', loc: 'cannock', slot: 0 })).toBe('ONE_TILE_PER_TOWN');
  });

  it('build: iron works buys market coal through a merchant connection and sells iron to the market', () => {
    let snap = table([loc('birmingham'), loc('birmingham', 1)]);
    expect(reject(snap, 0, { type: 'build', card: loc('birmingham'), industry: 'iron', loc: 'birmingham', slot: 2 })).toBe('NO_COAL');
    st(snap).links[L('birmingham', 'oxford')] = 1;
    snap = act(snap, 0, { type: 'build', card: loc('birmingham'), industry: 'iron', loc: 'birmingham', slot: 2 });
    const s = st(snap);
    // £5 + 1 coal at £1; then 2 iron sold at £1 each (market 8 → 10, full).
    expect([s.money[0], s.spent[0], s.coal, s.iron]).toEqual([13, 6, 12, 10]);
    expect(s.board.birmingham![2]).toEqual(tile(0, 'iron', 1, 2));
  });

  it('build: a coal mine connected to a merchant sells cubes; coal comes from the closest mine first', () => {
    let snap = table([loc('tamworth'), loc('walsall')]);
    const s0 = st(snap);
    s0.links[L('tamworth', 'birmingham')] = 1;
    s0.links[L('birmingham', 'oxford')] = 1;
    s0.board.cannock![1] = tile(1, 'coal', 2, 3);
    s0.links[L('cannock', 'walsall')] = 0;
    snap = act(snap, 0, { type: 'build', card: loc('tamworth'), industry: 'coal', loc: 'tamworth', slot: 0 });
    expect(st(snap).board.tamworth![0]).toEqual(tile(0, 'coal', 1, 1)); // 1 cube sold at £1, market 13 → 14
    expect([st(snap).coal, st(snap).money[0]]).toEqual([14, 13]);
    // Iron works at Walsall (canal link to Cannock): coal from Cannock (distance 1), not from the market.
    snap = act(snap, 0, { type: 'build', card: loc('walsall'), industry: 'iron', loc: 'walsall', slot: 0 });
    const s = st(snap);
    expect(s.board.cannock![1]!.cubes).toBe(2);
    expect(s.board.tamworth![0]!.cubes).toBe(1);
    expect(s.coal).toBe(14);
    expect(s.board.walsall![0]).toEqual(tile(0, 'iron', 1, 2)); // 2 iron sold (market 8 → 10)
  });

  it('build: industry cards need the network; no presence builds anywhere; wild cards', () => {
    let snap = table([indCard('coal'), indCard('coal', 1), WILD_LOCATION, WILD_INDUSTRY]);
    snap = act(snap, 0, { type: 'build', card: indCard('coal'), industry: 'coal', loc: 'tamworth', slot: 0 }); // no presence: anywhere
    expect(reject(snap, 0, { type: 'build', card: indCard('coal', 1), industry: 'coal', loc: 'cannock', slot: 1 })).toBe('CARD_CANNOT_BUILD');
    expect(reject(snap, 0, { type: 'build', card: WILD_LOCATION, industry: 'brewery', loc: 'farm-cannock', slot: 0 })).toBe('CARD_CANNOT_BUILD');
    expect(reject(snap, 0, { type: 'build', card: WILD_INDUSTRY, industry: 'coal', loc: 'cannock', slot: 1 })).toBe('CARD_CANNOT_BUILD');
    snap = act(snap, 0, { type: 'build', card: WILD_LOCATION, industry: 'coal', loc: 'cannock', slot: 1 });
    expect(st(snap).wild.location).toBe(5); // wild cards go back to their pile
    expect(st(snap).discards[0]).not.toContain(WILD_LOCATION);
  });

  it('build: era-restricted tiles and overbuilding', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('tamworth', 0), loc('birmingham')]);
    const s = st(snap);
    s.era = 'rail';
    expect(reject(snap, 0, { type: 'build', card: loc('cannock'), industry: 'coal', loc: 'cannock', slot: 1 })).toBe('WRONG_ERA_TILE');
    s.mat[0]!.coal = 1; // level 2 next
    s.mat[0]!.cotton = 3;
    s.board.cannock![1] = tile(0, 'coal', 1, 1);
    s.board.tamworth![0] = tile(1, 'coal', 1, 0, true);
    s.board.tamworth![1] = tile(1, 'cotton', 1, 0, false);
    snap = act(snap, 0, { type: 'build', card: loc('cannock'), industry: 'coal', loc: 'cannock', slot: 1 }); // own tile: always
    expect(st(snap).board.cannock![1]).toEqual(tile(0, 'coal', 2, 3));
    expect(reject(snap, 0, { type: 'build', card: loc('tamworth'), industry: 'coal', loc: 'tamworth', slot: 0 })).toBe('OVERBUILD_RESOURCES_LEFT');
    expect(reject(snap, 0, { type: 'build', card: loc('tamworth'), industry: 'cotton', loc: 'tamworth', slot: 1 })).toBe('OVERBUILD_OPPONENT');
    st(snap).coal = 0;
    st(snap).board.cannock![1]!.cubes = 0;
    st(snap).mat[0]!.coal = 3;
    snap = act(snap, 0, { type: 'build', card: loc('tamworth'), industry: 'coal', loc: 'tamworth', slot: 0 });
    expect(st(snap).board.tamworth![0]).toMatchObject({ owner: 0, level: 3 });
  });

  it('network: canal £3 one link next to the network; rail £5 + coal, or two for £15 + 2 coal + 1 beer', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('walsall')]);
    expect(reject(snap, 0, { type: 'network', card: loc('cannock'), links: [L('tamworth', 'walsall')] })).toBe('WRONG_ERA_LINK');
    expect(reject(snap, 0, { type: 'network', card: loc('cannock'), links: [L('tamworth', 'birmingham'), L('walsall', 'birmingham')] })).toBe('ONE_CANAL_LINK');
    snap = act(snap, 0, { type: 'network', card: loc('cannock'), links: [L('tamworth', 'birmingham')] }); // no presence: anywhere
    expect([st(snap).money[0], st(snap).links[L('tamworth', 'birmingham')]]).toEqual([14, 0]);
    expect(reject(snap, 0, { type: 'network', card: loc('tamworth'), links: [L('cannock', 'walsall')] })).toBe('NOT_IN_NETWORK');
    expect(reject(snap, 0, { type: 'network', card: loc('tamworth'), links: [L('tamworth', 'birmingham')] })).toBe('LINK_TAKEN');
    snap = act(snap, 0, { type: 'network', card: loc('tamworth'), links: [L('walsall', 'birmingham')] });
    expect(st(snap).money[0]).toBe(11);

    let r = table([loc('cannock'), loc('tamworth')]);
    const s = st(r);
    s.era = 'rail';
    s.money[0] = 30;
    s.board.tamworth![0] = tile(0, 'coal', 2, 3);
    s.board.walsall![1] = tile(1, 'brewery', 1, 2);
    const two = { type: 'network', card: loc('cannock'), links: [L('tamworth', 'birmingham'), L('birmingham', 'oxford')] };
    expect(reject(r, 0, two)).toBe('NO_BEER'); // the opponent's brewery is not connected yet
    r = act(r, 0, { type: 'network', card: loc('tamworth'), links: [L('tamworth', 'walsall')] }); // rail-only line, £5 + 1 coal
    expect([st(r).money[0], st(r).board.tamworth![0]!.cubes]).toEqual([25, 2]);
    r = act(r, 0, two);
    const t = st(r);
    expect([t.money[0], t.spent[0], t.board.walsall![1]!.cubes]).toEqual([10, 20, 1]);
    expect(t.board.tamworth![0]!.flipped).toBe(true); // last coal taken: flipped, income +7 spaces (level 2 mine)
    expect(t.income[0]).toBe(10 + 7);
  });

  it('network regression: with no presence the second rail must touch the first', () => {
    const snap = table([loc('cannock'), loc('tamworth')]);
    const s = st(snap);
    s.era = 'rail';
    s.money[0] = 40;
    s.board.dudley![0] = tile(1, 'coal', 2, 3);
    s.board.wolverhampton![1] = tile(1, 'brewery', 2, 2);
    s.links[L('dudley', 'wolverhampton')] = 1;
    s.links[L('birmingham', 'oxford')] = 1;
    // Seat 0 has no tiles and no links: the first link may go anywhere, the second must join it.
    expect(reject(snap, 0, { type: 'network', card: loc('cannock'), links: [L('birmingham', 'dudley'), L('coalbrookdale', 'shrewsbury')] })).toBe('NOT_IN_NETWORK');
    const ok = act(snap, 0, { type: 'network', card: loc('cannock'), links: [L('birmingham', 'dudley'), L('dudley', 'kidderminster')] });
    expect(st(ok).links[L('dudley', 'kidderminster')]).toBe(0);
  });

  it('sell: needs a connected merchant buying the good and beer; merchant beer pays its bonus', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('walsall'), loc('birmingham')]);
    const s = st(snap);
    s.merchants.oxford = { tiles: ['m2-cotton', 'm2-manufacturer'], beer: [true, true] };
    s.board.birmingham![0] = tile(0, 'cotton', 1);
    s.board.tamworth![0] = tile(0, 'cotton', 1);
    s.board.walsall![0] = tile(0, 'cotton', 1);
    s.links[L('birmingham', 'oxford')] = 1;
    s.links[L('tamworth', 'birmingham')] = 1;
    expect(reject(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'walsall', slot: 0 }] })).toBe('NO_MERCHANT');
    expect(reject(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'birmingham', slot: 0 }, { loc: 'tamworth', slot: 0 }] })).toBe('NO_BEER');
    expect(reject(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'birmingham', slot: 1 }] })).toBe('NOT_SELLABLE');
    snap = act(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] });
    let t = st(snap);
    expect(t.board.birmingham![0]!.flipped).toBe(true);
    expect(t.income[0]).toBe(10 + 5 + 2); // cotton mill +5, Oxford beer bonus +2
    expect(t.merchants.oxford!.beer).toEqual([false, true]);
    expect(reject(snap, 0, { type: 'sell', card: loc('tamworth'), sales: [{ loc: 'tamworth', slot: 0, develop: 'coal' }] })).toBe('NO_BEER');
    t.board.cannock![1] = tile(0, 'brewery', 1, 1); // own brewery: no connection needed
    expect(reject(snap, 0, { type: 'sell', card: loc('tamworth'), sales: [{ loc: 'tamworth', slot: 0, develop: 'coal' }] })).toBe('NO_DEVELOP_BONUS');
    snap = act(snap, 0, { type: 'sell', card: loc('tamworth'), sales: [{ loc: 'tamworth', slot: 0 }] });
    t = st(snap);
    expect(t.board.cannock![1]).toEqual(tile(0, 'brewery', 1, 0, true));
    expect(t.income[0]).toBe(17 + 5 + 4);
  });

  it('develop: iron per tile (own works first, then market), lightbulb tiles stay', () => {
    let snap = table([loc('cannock'), loc('tamworth')]);
    expect(reject(snap, 0, { type: 'develop', card: loc('cannock'), industries: ['pottery'] })).toBe('CANNOT_DEVELOP');
    snap = act(snap, 0, { type: 'develop', card: loc('cannock'), industries: ['coal', 'coal'] });
    expect([st(snap).mat[0]!.coal, st(snap).iron, st(snap).money[0]]).toEqual([2, 6, 13]);
    st(snap).board.birmingham![2] = tile(0, 'iron', 1, 1);
    st(snap).iron = 0;
    snap = act(snap, 0, { type: 'develop', card: loc('tamworth'), industries: ['cotton'] });
    expect([st(snap).board.birmingham![2]!.flipped, st(snap).money[0], st(snap).income[0]]).toEqual([true, 13, 13]);
    expect(STACK.cotton[st(snap).mat[0]!.cotton]?.level).toBe(1); // 3 level-1 cotton mills: 2 left
  });

  it('loan and scout', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('walsall'), loc('birmingham'), loc('birmingham', 1)]);
    snap = act(snap, 0, { type: 'loan', card: loc('cannock') });
    expect([st(snap).money[0], st(snap).income[0], incomeLevel(st(snap).income[0]!)]).toEqual([47, 7, -3]);
    st(snap).income[0] = 2; // level -8
    expect(reject(snap, 0, { type: 'loan', card: loc('tamworth') })).toBe('NO_LOAN');
    snap = act(snap, 0, { type: 'scout', cards: [loc('tamworth'), loc('walsall'), loc('birmingham')] });
    const s = st(snap);
    expect(s.hands[0]).toContain(WILD_LOCATION);
    expect(s.hands[0]).toContain(WILD_INDUSTRY);
    expect(s.wild).toEqual({ location: 3, industry: 3 });
  });

  it('scout is refused while holding a wild card', () => {
    const snap = table([loc('tamworth'), loc('walsall'), loc('birmingham'), WILD_INDUSTRY]);
    expect(reject(snap, 0, { type: 'scout', cards: [loc('tamworth'), loc('walsall'), loc('birmingham')] })).toBe('HAS_WILD');
  });

  it('first round has one action each; next order by money spent; income paid every round', () => {
    let snap = game(2, 3);
    const s = st(snap);
    const [a, b] = s.order as [number, number];
    s.income[b] = 12; // level 1
    snap = act(snap, a, pickBuild(s, a));
    expect(st(snap).order[st(snap).turn]).toBe(b);
    snap = act(snap, b, { type: 'pass', card: st(snap).hands[b]![0] });
    const t = st(snap);
    expect(t.round).toBe(2);
    expect(t.order).toEqual([b, a]);
    expect(t.actionsLeft).toBe(2);
    expect(t.money[b]).toBe(18);
    expect(t.spent).toEqual([0, 0]);
    expect(t.hands[a]).toHaveLength(Math.min(8, t.hands[a]!.length));
  });

  it('era end: links and flipped tiles score, level 1 leaves, beer refills, new hands; rail end ranks by VP, income, money', () => {
    let snap = game(2, 5);
    const s = st(snap);
    s.order = [0, 1]; s.turn = 0; s.round = 6; s.actionsLeft = 1;
    s.deck = [];
    s.hands = [[loc('cannock')], [loc('tamworth')]];
    s.discards = [[loc('walsall'), indCard('coal')], [loc('birmingham')]];
    s.facedown = [[], []];
    s.merchants.oxford = { tiles: ['m2-cotton', 'm2-manufacturer'], beer: [false, false] };
    s.board.cannock![1] = tile(0, 'coal', 1, 0, true); // vp 1, link vp 2
    s.board.tamworth![0] = tile(1, 'cotton', 2, 0, true); // vp 5, link vp 2
    s.board.birmingham![0] = tile(1, 'cotton', 1, 0, false); // unflipped: nothing
    s.links[L('cannock', 'walsall')] = 0; // 2 + 0
    s.links[L('tamworth', 'birmingham')] = 1; // 2 + 0
    s.links[L('birmingham', 'oxford')] = 1; // 0 + 2 (merchant)
    snap = act(snap, 0, { type: 'pass', card: loc('cannock') });
    snap = act(snap, 1, { type: 'pass', card: loc('tamworth') });
    let t = st(snap);
    expect(t.vp).toEqual([3, 9]);
    expect(t.era).toBe('rail');
    expect(t.round).toBe(1);
    expect(t.links).toEqual({});
    expect(t.board.cannock![1]).toBeNull();
    expect(t.board.birmingham![0]).toBeNull();
    expect(t.board.tamworth![0]).not.toBeNull();
    expect(t.merchants.oxford!.beer).toEqual([true, true]);
    expect(t.hands.flat().length + t.deck.length).toBe(5);
    expect(t.discards).toEqual([[], []]);
    expect(t.actionsLeft).toBe(2);
    // Rail end: no income in the last round; cotton level 2 scores again.
    t.deck = []; t.hands = [[loc('cannock')], [loc('tamworth')]]; t.order = [0, 1]; t.turn = 0; t.actionsLeft = 1;
    t.vp = [14, 9]; t.income = [12, 30]; t.money = [5, 5];
    snap = act(snap, 0, { type: 'pass', card: loc('cannock') });
    snap = act(snap, 1, { type: 'pass', card: loc('tamworth') });
    t = st(snap);
    expect(t.money).toEqual([5, 5]);
    expect(t.outcome).toEqual({ reason: 'score', placements: [{ seat: 1, place: 1, score: 14 }, { seat: 0, place: 2, score: 14 }] });
  });

  it('rail end ties: equal VP, income and money share the place', () => {
    let snap = game(2, 5);
    const s = st(snap);
    Object.assign(s, { era: 'rail', round: 9, deck: [], order: [0, 1], turn: 0, actionsLeft: 1, hands: [[loc('cannock')], [loc('tamworth')]], vp: [20, 20], income: [20, 20], money: [3, 3] });
    snap = act(snap, 0, { type: 'pass', card: loc('cannock') });
    snap = act(snap, 1, { type: 'pass', card: loc('tamworth') });
    expect(st(snap).outcome?.placements.map((x) => x.place)).toEqual([1, 1]);
  });

  it('negative income: pays, sells tiles for half cost, then loses VP', () => {
    let snap = game(2, 5);
    const s = st(snap);
    Object.assign(s, { round: 3, order: [0, 1], turn: 0, actionsLeft: 1, deck: [], hands: [[loc('cannock'), loc('walsall')], [loc('tamworth')]] });
    s.income = [5, 10]; // level -5
    s.money = [1, 0];
    s.vp = [4, 0];
    s.board.tamworth![0] = tile(0, 'coal', 1, 1); // £5 → £2
    snap = act(snap, 0, { type: 'pass', card: loc('cannock') });
    snap = act(snap, 1, { type: 'pass', card: loc('tamworth') });
    const t = st(snap);
    expect(t.board.tamworth![0]).toBeNull();
    expect([t.money[0], t.vp[0]]).toEqual([0, 2]); // 1 − 5 + 2 = −2 → lose 2 VP
  });

  it('timeout passes the remaining actions; resign ranks the resigner last', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('walsall')]);
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).order[st(snap).turn]).toBe(1);
    expect(st(snap).discards[0]!.slice(-2)).toEqual([loc('cannock'), loc('tamworth')]);
    expect(st(snap).timeouts[0]).toBe(1);
    const r = act(game(3), 1, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 1, place: 3 });
    expect(st(r).outcome?.reason).toBe('resign');
    expect(reject(r, 0, { type: 'pass', card: 0 })).toBe('GAME_FINISHED');
  });

  it('projection hides other hands, the deck and the face-down discard', () => {
    let snap = game(3, 11);
    const s = st(snap);
    const me = s.order[0]!;
    const other = s.order[1]!;
    const v = projectFor(m, snap, p(other)).view as BrassView;
    expect(v.hand).toEqual(s.hands[other]);
    expect(v.handCounts).toEqual(s.hands.map((h) => h.length));
    expect(v.discardTop).toEqual([null, null, null]);
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('hands');
    expect(v).not.toHaveProperty('discards');
    const spec = projectFor(m, snap, { kind: 'spectator' });
    expect((spec.view as BrassView).hand).toBeNull();
    expect(spec.legalActions).toEqual([]);
    expect(v).not.toHaveProperty('facedown');
    expect(JSON.stringify(projectFor(m, snap, p(other)))).not.toContain('"rng"');
    expect(projectFor(m, snap, p(other)).legalActions).toEqual([{ type: 'resign' }]);
    snap = act(snap, me, { type: 'pass', card: s.hands[me]![0] });
    expect((projectFor(m, snap, p(other)).view as BrassView).discardTop[me]).toBe(s.hands[me]![0]);
  });

  it('random games terminate with a valid outcome and replay deterministically', () => {
    for (let g = 0; g < 9; g++) {
      const rng = createRng({ s: 41 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: 100 + g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: ({ kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number } | { kind: 'timeout'; logicalTime: number })[] = [];
      let n = 0;
      for (; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.order[s.turn]!;
        if (rng.nextInt(25) === 0) { snap = (applyTimeout(m, snap, 0) as StepResult).snapshot; inputs.push({ kind: 'timeout', logicalTime: 0 }); continue; }
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const real = hints.filter((h) => h.type !== 'pass' && h.type !== 'scout' && h.type !== 'loan');
        const h = real.length && rng.nextInt(5) ? real[rng.nextInt(real.length)]! : hints[rng.nextInt(hints.length)]!;
        const hand = s.hands[seat]!;
        const card = hand[rng.nextInt(hand.length)]!;
        let action: unknown;
        if (h.type === 'build') action = { type: 'build', card: (h.cards as number[])[0], industry: h.industry, loc: h.loc, slot: h.slot };
        else if (h.type === 'network') action = { type: 'network', card, links: h.links };
        else if (h.type === 'develop') action = { type: 'develop', card, industries: h.industries };
        else if (h.type === 'sell') action = { type: 'sell', card, sales: [{ loc: h.loc, slot: h.slot, merchant: h.merchant }] };
        else if (h.type === 'scout') action = { type: 'scout', cards: hand.slice(0, 3) };
        else action = { type: h.type, card };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.coal).toBeLessThanOrEqual(14);
        expect(t.iron).toBeLessThanOrEqual(10);
        t.money.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
        const cards = [...t.deck, ...t.hands.flat().filter((c) => c < WILD_LOCATION), ...t.discards.flat(), ...t.facedown.flat()];
        expect(new Set(cards).size).toBe(cards.length);
        expect(cards.length).toBe(deckFor(players).length);
      }
      const out = st(snap).outcome!;
      expect(out.reason).toBe('score');
      expect(out.placements.map((x) => x.seat).sort()).toEqual(Array.from({ length: players }, (_, i) => i));
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});

function pickBuild(s: BrassState, seat: number) {
  const h = legalFor(s, seat).find((x) => x.type === 'build' && x.industry === 'coal');
  if (!h) throw new Error('no coal build');
  return { type: 'build', card: (h.cards as number[])[0], industry: h.industry, loc: h.loc, slot: h.slot };
}

describe('brass tutorial', () => {
  it('the tutorial script plays to the exact outcome with the learner winning', () => {
    const t = brassModule.tutorial;
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(t.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    expect(st(snap).order[st(snap).turn]).toBe(0);
    const money: number[][] = [];
    for (const step of t.steps) {
      // The expected move is offered by the legal hints (so the highlighted UI path exists).
      const hints = projectFor(m, snap, p(0)).legalActions;
      const e = step.expected as Record<string, unknown>;
      const core = e.type === 'sell' ? { type: 'sell', ...(e.sales as object[])[0] } : Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'card'));
      expect(hints.some((h) => Object.entries(core).every(([k, v]) => JSON.stringify(h[k]) === JSON.stringify(v))), JSON.stringify(core)).toBe(true);
      expect(st(snap).hands[0]).toContain(e.card);
      snap = act(snap, 0, step.expected);
      if (step.reply) { expect(currentSeatOf(snap)).toBe(1); snap = act(snap, 1, step.reply); }
      money.push([...st(snap).money]);
    }
    const s = st(snap);
    expect(money).toEqual([[12, 12], [20, 20], [7, 20], [7, 20]]); // after step 2: link £8, then income +8 / +13 (opponent spent £5)
    expect(s.vp).toEqual([70, 67]);
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 70 }, { seat: 1, place: 2, score: 67 }] });
  });
});

function currentSeatOf(snap: EngineSnapshot) { const s = st(snap); return s.order[s.turn]; }
