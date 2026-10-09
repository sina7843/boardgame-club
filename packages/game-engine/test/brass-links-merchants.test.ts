import { describe, expect, it } from 'vitest';
import { linksMerchants } from '../../../games/brass/src/content/links-merchants.ts';
import { CARDS, LINK, LOCATIONS, MERCHANT_TILES, STACK, brassModule, linkId, type BrassState, type Industry, type Tile } from '@bg/game-brass';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = brassModule as never;
const st = (s: EngineSnapshot) => s.state as BrassState;
const game = (players: number, seed: number) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, { kind: 'player', seat }, action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const tile = (owner: number, industry: Industry, level: number): Tile => ({ owner, industry, level, cubes: 0, flipped: false });
const has = (...ids: string[]) => ids.every((id) => LOCATIONS.some((l) => l.id === id));

const ALL_IDS = [
  'belper', 'derby', 'leek', 'stoke-on-trent', 'stone', 'uttoxeter', 'stafford', 'burton-on-trent', 'cannock', 'tamworth',
  'walsall', 'wolverhampton', 'coalbrookdale', 'dudley', 'kidderminster', 'worcester', 'birmingham', 'coventry', 'nuneaton', 'redditch',
  'farm-cannock', 'farm-worcester',
  'shrewsbury', 'gloucester', 'oxford', 'warrington', 'nottingham'
];

describe('brass links-merchants chunk', () => {
  it('declares the five merchants exactly', () => {
    expect(linksMerchants.locations).toEqual([
      { id: 'oxford', nameFa: 'آکسفورد', nameEn: 'Oxford', kind: 'merchant', pos: [72, 93], merchant: { spaces: 2, minPlayers: 2, bonus: { kind: 'income', amount: 2 }, linkVp: 2 } },
      { id: 'shrewsbury', nameFa: 'شروزبری', nameEn: 'Shrewsbury', kind: 'merchant', pos: [3, 45], merchant: { spaces: 1, minPlayers: 2, bonus: { kind: 'vp', amount: 4 }, linkVp: 2 } },
      { id: 'gloucester', nameFa: 'گلاستر', nameEn: 'Gloucester', kind: 'merchant', pos: [9, 97], merchant: { spaces: 2, minPlayers: 2, bonus: { kind: 'develop' }, linkVp: 2 } },
      { id: 'warrington', nameFa: 'وارینگتون', nameEn: 'Warrington', kind: 'merchant', pos: [21, 2], merchant: { spaces: 2, minPlayers: 3, bonus: { kind: 'money', amount: 5 }, linkVp: 2 } },
      { id: 'nottingham', nameFa: 'ناتینگهام', nameEn: 'Nottingham', kind: 'merchant', pos: [98, 12], merchant: { spaces: 2, minPlayers: 4, bonus: { kind: 'vp', amount: 3 }, linkVp: 2 } }
    ]);
    expect(linksMerchants.locations!.reduce((n, l) => n + l.merchant!.spaces, 0)).toBe(9);
  });

  it('declares the nine merchant tiles: 5/7/9 for 2/3/4 players', () => {
    expect(linksMerchants.merchantTiles!.map((t) => [t.id, t.goods.join('+'), t.minPlayers])).toEqual([
      ['m2-cotton', 'cotton', 2], ['m2-manufacturer', 'manufacturer', 2], ['m2-blank-1', '', 2], ['m2-blank-2', '', 2],
      ['m2-all', 'cotton+manufacturer+pottery', 2], ['m3-pottery', 'pottery', 3], ['m3-blank', '', 3],
      ['m4-cotton', 'cotton', 4], ['m4-manufacturer', 'manufacturer', 4]
    ]);
    expect([2, 3, 4].map((n) => linksMerchants.merchantTiles!.filter((t) => t.minPlayers <= n).length)).toEqual([5, 7, 9]);
  });

  it('declares all 39 lines once with the right era flags and known ends', () => {
    const links = linksMerchants.links!;
    const key = (l: (typeof links)[number]) => `${linkId(l)}:${l.canal ? 'C' : ''}${l.rail ? 'R' : ''}${l.also ? `+${l.also.join(',')}` : ''}`;
    expect(links.map(key).sort()).toEqual([
      'belper~derby:CR', 'belper~leek:R', 'birmingham~coventry:CR', 'birmingham~dudley:CR', 'birmingham~nuneaton:R', 'birmingham~oxford:CR',
      'birmingham~redditch:R', 'birmingham~tamworth:CR', 'birmingham~walsall:CR', 'birmingham~worcester:CR', 'burton-on-trent~cannock:R',
      'burton-on-trent~derby:CR', 'burton-on-trent~stone:CR', 'burton-on-trent~tamworth:CR', 'burton-on-trent~walsall:C', 'cannock~farm-cannock:CR',
      'cannock~stafford:CR', 'cannock~walsall:CR', 'cannock~wolverhampton:CR', 'coalbrookdale~kidderminster:CR', 'coalbrookdale~shrewsbury:CR',
      'coalbrookdale~wolverhampton:CR', 'coventry~nuneaton:R', 'derby~nottingham:CR', 'derby~uttoxeter:R', 'dudley~kidderminster:CR',
      'dudley~wolverhampton:CR', 'gloucester~redditch:CR', 'gloucester~worcester:CR', 'kidderminster~worcester:CR+farm-worcester',
      'leek~stoke-on-trent:CR', 'nuneaton~tamworth:CR', 'oxford~redditch:CR', 'stafford~stone:CR', 'stoke-on-trent~stone:CR',
      'stoke-on-trent~warrington:CR', 'stone~uttoxeter:R', 'tamworth~walsall:R', 'walsall~wolverhampton:CR'
    ].sort());
    expect(links).toHaveLength(39);
    expect(new Set(links.map(linkId)).size).toBe(39);
    expect(links.filter((l) => l.canal && l.rail)).toHaveLength(30);
    expect(links.filter((l) => !l.canal && l.rail)).toHaveLength(8);
    expect(links.filter((l) => l.canal && !l.rail)).toHaveLength(1);
    for (const l of links) for (const x of [l.a, l.b, ...(l.also ?? [])]) expect(ALL_IDS).toContain(x);
    expect(new Set(ALL_IDS).size).toBe(27);
    // every merchant is reachable by at least one line
    for (const mer of linksMerchants.locations!) expect(links.some((l) => l.a === mer.id || l.b === mer.id)).toBe(true);
  });

  it('setup places tiles per player count; inactive merchants stay empty; beer only beside non-blank tiles', () => {
    for (const n of [2, 3, 4]) for (const seed of [1, 2, 3, 4, 5]) {
      const s = st(game(n, seed));
      const placed = linksMerchants.locations!.flatMap((l) => s.merchants[l.id]!.tiles);
      const used = MERCHANT_TILES.filter((t) => t.minPlayers <= n).map((t) => t.id);
      expect(placed.filter(Boolean).sort()).toEqual([...used].sort());
      if (n === 2) expect(s.merchants.warrington).toEqual({ tiles: [null, null], beer: [false, false] });
      if (n < 4) expect(s.merchants.nottingham).toEqual({ tiles: [null, null], beer: [false, false] });
      if (n === 4) expect(placed.every(Boolean)).toBe(true);
      for (const mer of Object.values(s.merchants)) mer.tiles.forEach((id, i) => {
        const goods = id ? MERCHANT_TILES.find((t) => t.id === id)!.goods.length : 0;
        expect(mer.beer[i]).toBe(goods > 0);
      });
    }
  });
});

/** Seat 0 to act in Canal round 2 with a level-1 cotton mill at `town`, linked (by seat 1) to `merchant` holding m2-all + beer. */
function sellSetup(players: number, town: string, merchant: string) {
  const snap = game(players, 11);
  const s = st(snap);
  s.order = Array.from({ length: players }, (_, i) => i); s.turn = 0; s.round = 2; s.actionsLeft = 2;
  const card = CARDS[0]!.id;
  s.hands = s.hands.map((_, i) => (i === 0 ? [card, CARDS[1]!.id] : [CARDS[2]!.id]));
  for (const k of Object.keys(s.merchants)) s.merchants[k] = { tiles: s.merchants[k]!.tiles.map(() => null), beer: s.merchants[k]!.beer.map(() => false) };
  s.merchants[merchant] = { tiles: s.merchants[merchant]!.tiles.map((_, i) => (i === 0 ? 'm2-all' : null)), beer: s.merchants[merchant]!.tiles.map((_, i) => i === 0) };
  s.board[town]![0] = tile(0, 'cotton', 1);
  s.links[linkId({ a: town, b: merchant })] = 1;
  return { snap, card };
}

describe('brass merchant bonuses through this chunk', () => {
  const ready = (town: string, merchant: string) => has(town, merchant) && LINK.has(linkId({ a: town, b: merchant })) && STACK.cotton.length > 0;

  it.skipIf(!ready('coalbrookdale', 'shrewsbury'))('Shrewsbury: consumed merchant beer gives +4 VP', () => {
    const { snap, card } = sellSetup(2, 'coalbrookdale', 'shrewsbury');
    const vp = st(snap).vp[0]!;
    const s = st(act(snap, 0, { type: 'sell', card, sales: [{ loc: 'coalbrookdale', slot: 0, merchant: 'shrewsbury' }] }));
    expect(s.vp[0]).toBe(vp + 4);
    expect(s.merchants.shrewsbury!.beer).toEqual([false]);
    expect(s.board.coalbrookdale![0]!.flipped).toBe(true);
  });

  it.skipIf(!ready('worcester', 'gloucester'))('Gloucester: develops the named industry once, without iron', () => {
    const { snap, card } = sellSetup(2, 'worcester', 'gloucester');
    const before = st(snap);
    const [iron, money, lvl] = [before.iron, before.money[0]!, before.mat[0]!.manufacturer];
    const s = st(act(snap, 0, { type: 'sell', card, sales: [{ loc: 'worcester', slot: 0, merchant: 'gloucester', develop: 'manufacturer' }] }));
    expect([s.mat[0]!.manufacturer, s.iron, s.money[0]]).toEqual([lvl + 1, iron, money]);
  });

  it.skipIf(!ready('stoke-on-trent', 'warrington'))('Warrington (3+ players): +£5', () => {
    const { snap, card } = sellSetup(3, 'stoke-on-trent', 'warrington');
    const money = st(snap).money[0]!;
    const s = st(act(snap, 0, { type: 'sell', card, sales: [{ loc: 'stoke-on-trent', slot: 0, merchant: 'warrington' }] }));
    expect(s.money[0]).toBe(money + 5);
  });

  it.skipIf(!ready('derby', 'nottingham'))('Nottingham (4 players): +3 VP', () => {
    const { snap, card } = sellSetup(4, 'derby', 'nottingham');
    const vp = st(snap).vp[0]!;
    const s = st(act(snap, 0, { type: 'sell', card, sales: [{ loc: 'derby', slot: 0, merchant: 'nottingham' }] }));
    expect(s.vp[0]).toBe(vp + 3);
  });
});
