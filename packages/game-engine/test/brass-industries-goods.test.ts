import { describe, expect, it } from 'vitest';
import { CARDS, LINK, STACK, brassModule, linkId, tileDef, type BrassState, type Industry, type Tile } from '@bg/game-brass';
import { industriesGoods } from '../../../games/brass/src/content/industries-goods.ts';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = brassModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as BrassState;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const loc = (town: string, n = 0) => CARDS.filter((c) => c.kind === 'location' && c.loc === town)[n]!.id;
const indCard = (x: Industry, n = 0) => CARDS.filter((c) => c.kind === 'industry' && c.industries.includes(x))[n]!.id;
const tile = (owner: number, industry: Industry, level: number, cubes = 0, flipped = false): Tile => ({ owner, industry, level, cubes, flipped });
const L = (a: string, b: string) => { const id = linkId({ a, b }); if (!LINK.has(id)) throw new Error(`no link ${id}`); return id; };

function table(hand: number[]) {
  const snap = startGame(m, { playerCount: 2, seed: 7, options: {} }).snapshot;
  const s = st(snap);
  s.order = [0, 1]; s.turn = 0; s.round = 2; s.actionsLeft = 2;
  s.hands = [hand, [indCard('brewery', 0), indCard('brewery', 1), indCard('brewery', 2)]];
  return snap;
}

// [level, count, cost, coal, iron, beer, vp, income, linkVp, extra]
type Row = [number, number, number, number, number, number, number, number, number, object?];
const expected: Record<'cotton' | 'manufacturer' | 'pottery', Row[]> = {
  cotton: [
    [1, 3, 12, 0, 0, 1, 5, 5, 1, { era: 'canal' }],
    [2, 2, 14, 1, 0, 1, 5, 4, 2],
    [3, 3, 16, 1, 1, 1, 9, 3, 1],
    [4, 3, 18, 1, 1, 1, 12, 2, 1]
  ],
  manufacturer: [
    [1, 1, 8, 1, 0, 1, 3, 5, 2, { era: 'canal' }],
    [2, 2, 10, 0, 1, 1, 5, 1, 1],
    [3, 1, 12, 2, 0, 0, 4, 4, 0],
    [4, 1, 8, 0, 1, 1, 3, 6, 1],
    [5, 2, 16, 1, 0, 2, 8, 2, 2],
    [6, 1, 20, 0, 0, 1, 7, 6, 1],
    [7, 1, 16, 1, 1, 0, 9, 4, 0],
    [8, 2, 20, 0, 2, 1, 11, 1, 1]
  ],
  pottery: [
    [1, 1, 17, 0, 1, 1, 10, 5, 1, { noDevelop: true }],
    [2, 1, 0, 1, 0, 1, 1, 1, 1],
    [3, 1, 22, 2, 0, 2, 11, 5, 1, { noDevelop: true }],
    [4, 1, 0, 1, 0, 1, 1, 1, 1],
    [5, 1, 24, 2, 0, 2, 20, 5, 1, { era: 'rail' }]
  ]
};

describe('brass industries-goods content', () => {
  it('every goods tile level matches the player mat exactly', () => {
    const want = Object.entries(expected).flatMap(([industry, rows]) => rows.map(([level, count, cost, coal, iron, beer, vp, income, linkVp, extra]) =>
      ({ industry, level, count, cost, coal, iron, beer, produce: 0, vp, income, linkVp, ...extra })));
    const sort = (xs: readonly object[]) => [...xs].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    expect(sort(industriesGoods.tiles!)).toEqual(sort(want));
    for (const t of want) expect(tileDef(t.industry as Industry, t.level)).toEqual(t);
    expect(industriesGoods.locations ?? []).toEqual([]);
    expect(industriesGoods.industryCards ?? []).toEqual([]);
  });

  it('totals: 11 cotton mills, 11 manufacturers, 5 potteries per mat', () => {
    expect([STACK.cotton.length, STACK.manufacturer.length, STACK.pottery.length]).toEqual([11, 11, 5]);
    expect(STACK.manufacturer.map((t) => t.level)).toEqual([1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 8]);
    expect(STACK.pottery.map((t) => t.level)).toEqual([1, 2, 3, 4, 5]);
  });

  it('develop: pottery I and III carry the lightbulb, II and IV can be developed', () => {
    let snap = table([loc('cannock'), loc('tamworth'), loc('walsall')]);
    const before = JSON.stringify(st(snap));
    expect(reject(snap, 0, { type: 'develop', card: loc('cannock'), industries: ['pottery'] })).toBe('CANNOT_DEVELOP');
    expect(JSON.stringify(st(snap))).toBe(before);
    st(snap).mat[0]!.pottery = 1; // next tile: Pottery II
    snap = act(snap, 0, { type: 'develop', card: loc('cannock'), industries: ['pottery'] });
    expect(st(snap).mat[0]!.pottery).toBe(2); // next tile: Pottery III (lightbulb)
    expect(reject(snap, 0, { type: 'develop', card: loc('tamworth'), industries: ['pottery'] })).toBe('CANNOT_DEVELOP');
    st(snap).mat[0]!.pottery = 3; // next tile: Pottery IV
    snap = act(snap, 0, { type: 'develop', card: loc('tamworth'), industries: ['pottery'] });
    expect(st(snap).mat[0]!.pottery).toBe(4);
  });

  it('Pottery V cannot be built in the Canal Era', () => {
    const snap = table([indCard('pottery'), loc('cannock')]);
    st(snap).mat[0]!.pottery = 4;
    expect(reject(snap, 0, { type: 'build', card: indCard('pottery'), industry: 'pottery', loc: 'belper', slot: 2 })).toBe('WRONG_ERA_TILE');
  });

  it('selling a Manufacturer V needs 2 beer: merchant barrel + own brewery', () => {
    let snap = table([loc('cannock'), loc('tamworth')]);
    const s = st(snap);
    s.merchants.oxford = { tiles: ['m2-manufacturer', 'm2-blank-1'], beer: [true, false] };
    s.board.birmingham![1] = tile(0, 'manufacturer', 5);
    s.links[L('birmingham', 'oxford')] = 0;
    const before = JSON.stringify(s);
    expect(reject(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'birmingham', slot: 1 }] })).toBe('NO_BEER');
    expect(JSON.stringify(st(snap))).toBe(before);
    st(snap).board.cannock![1] = tile(0, 'brewery', 1, 1); // own brewery anywhere
    snap = act(snap, 0, { type: 'sell', card: loc('cannock'), sales: [{ loc: 'birmingham', slot: 1, merchant: 'oxford' }] });
    const t = st(snap);
    expect(t.board.birmingham![1]).toEqual(tile(0, 'manufacturer', 5, 0, true));
    expect(t.merchants.oxford!.beer).toEqual([false, false]);
    expect(t.board.cannock![1]).toEqual(tile(0, 'brewery', 1, 0, true));
    expect(t.income[0]).toBe(10 + 2 + 2 + 4); // Manufacturer V +2, Oxford bonus +2, own Brewery I flips +4
  });
});
