import { describe, expect, it } from 'vitest';
import { industriesResources } from '../../../games/brass/src/content/industries-resources.ts';
import { CARDS, LOC, STACK, brassModule, cardAllows, deckFor, type BrassState, type Industry, type Tile } from '@bg/game-brass';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = brassModule as never;
const st = (s: EngineSnapshot) => s.state as BrassState;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, { kind: 'player', seat }, action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, { kind: 'player', seat }, action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const loc = (town: string, n = 0) => CARDS.filter((c) => c.kind === 'location' && c.loc === town)[n]!.id;
const cardOf = (inds: Industry[], n = 0) => CARDS.filter((c) => c.kind === 'industry' && c.industries.join() === inds.join())[n]!.id;
const tile = (owner: number, industry: Industry, level: number, cubes = 0, flipped = false): Tile => ({ owner, industry, level, cubes, flipped });

/** 2-player table, Canal Era round 2, seat 0 to act with 2 actions. */
function table(hand: number[]) {
  const snap = startGame(m, { playerCount: 2, seed: 7, options: {} }).snapshot;
  const s = st(snap);
  s.order = [0, 1]; s.turn = 0; s.round = 2; s.actionsLeft = 2;
  s.hands = [hand, [cardOf(['brewery'], 3), cardOf(['brewery'], 4)]];
  return snap;
}

describe('brass content: industries-resources', () => {
  it('every resource tile entry', () => {
    const row = (t: (typeof industriesResources.tiles & {})[number]) =>
      [t.industry, t.level, t.count, t.cost, t.coal, t.iron, t.beer, t.produce, t.vp, t.income, t.linkVp, t.era ?? null, t.noDevelop ?? false];
    const brew = { canal: 1, rail: 2 };
    expect(industriesResources.tiles!.map(row)).toEqual([
      ['coal', 1, 1, 5, 0, 0, 0, 2, 1, 4, 2, 'canal', false],
      ['coal', 2, 2, 7, 0, 0, 0, 3, 2, 7, 1, null, false],
      ['coal', 3, 2, 8, 0, 1, 0, 4, 3, 6, 1, null, false],
      ['coal', 4, 2, 10, 0, 1, 0, 5, 4, 5, 1, null, false],
      ['iron', 1, 1, 5, 1, 0, 0, 4, 3, 3, 1, 'canal', false],
      ['iron', 2, 1, 7, 1, 0, 0, 4, 5, 3, 1, null, false],
      ['iron', 3, 1, 9, 1, 0, 0, 5, 7, 2, 1, null, false],
      ['iron', 4, 1, 12, 1, 0, 0, 6, 9, 1, 1, null, false],
      ['brewery', 1, 2, 5, 0, 1, 0, brew, 4, 4, 2, 'canal', false],
      ['brewery', 2, 2, 7, 0, 1, 0, brew, 5, 5, 2, null, false],
      ['brewery', 3, 2, 9, 0, 1, 0, brew, 7, 5, 2, null, false],
      ['brewery', 4, 1, 9, 0, 1, 0, brew, 10, 5, 2, 'rail', false]
    ]);
    expect([STACK.coal.length, STACK.iron.length, STACK.brewery.length]).toEqual([7, 4, 7]);
    expect(STACK.brewery.map((t) => t.level)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });

  it('every industry card entry and the deck totals', () => {
    expect(industriesResources.industryCards).toEqual([
      { id: 'card-coal', industries: ['coal'], copies: [2, 2, 3] },
      { id: 'card-iron', industries: ['iron'], copies: [4, 4, 4] },
      { id: 'card-brewery', industries: ['brewery'], copies: [5, 5, 5] },
      { id: 'card-pottery', industries: ['pottery'], copies: [2, 2, 3] },
      { id: 'card-cotton-manufacturer', industries: ['cotton', 'manufacturer'], copies: [0, 6, 8] }
    ]);
    const totals = [0, 1, 2].map((i) => industriesResources.industryCards!.reduce((n, c) => n + c.copies[i]!, 0));
    expect(totals).toEqual([13, 19, 23]);
    // deckFor counts the industry cards of this chunk per player count
    const industryIn = (n: number) => deckFor(n).filter((id) => CARDS[id]!.kind === 'industry').length;
    expect([2, 3, 4].map(industryIn)).toEqual([13, 19, 23]);
    expect(deckFor(2).some((id) => CARDS[id]!.kind === 'industry' && CARDS[id]!.industries.length === 2)).toBe(false);
  });

  it('brewery: 1 barrel in the Canal Era, 2 in the Rail Era; costs 1 iron', () => {
    let snap = table([loc('walsall')]);
    snap = act(snap, 0, { type: 'build', card: loc('walsall'), industry: 'brewery', loc: 'walsall', slot: 1 });
    let s = st(snap);
    expect(s.board.walsall![1]).toEqual(tile(0, 'brewery', 1, 1));
    expect([s.money[0], s.iron]).toEqual([17 - 5 - 2, 7]); // iron bought from the market at £2

    snap = table([loc('walsall')]);
    s = st(snap);
    s.era = 'rail';
    s.mat[0]!.brewery = 2; // level 2 next (level 1 is canal-only)
    snap = act(snap, 0, { type: 'build', card: loc('walsall'), industry: 'brewery', loc: 'walsall', slot: 1 });
    expect(st(snap).board.walsall![1]).toEqual(tile(0, 'brewery', 2, 2));
    expect(st(snap).money[0]).toBe(17 - 7 - 2);
  });

  it('brewery IV is Rail Era only', () => {
    let snap = table([loc('walsall')]);
    st(snap).mat[0]!.brewery = 6;
    const before = JSON.stringify(st(snap));
    expect(reject(snap, 0, { type: 'build', card: loc('walsall'), industry: 'brewery', loc: 'walsall', slot: 1 })).toBe('WRONG_ERA_TILE');
    expect(JSON.stringify(st(snap))).toBe(before);
    st(snap).era = 'rail';
    snap = act(snap, 0, { type: 'build', card: loc('walsall'), industry: 'brewery', loc: 'walsall', slot: 1 });
    expect(st(snap).board.walsall![1]).toEqual(tile(0, 'brewery', 4, 2));
    expect(st(snap).mat[0]!.brewery).toBe(7);
  });

  it('iron works IV: £12 + 1 coal, 6 iron sold to the market at its prices', () => {
    let snap = table([loc('birmingham')]);
    const s0 = st(snap);
    s0.mat[0]!.iron = 3;
    s0.iron = 5; // empty spaces priced £3,2,2,1,1
    s0.links['birmingham~oxford'] = 1; // market coal reachable
    snap = act(snap, 0, { type: 'build', card: loc('birmingham'), industry: 'iron', loc: 'birmingham', slot: 2 });
    const s = st(snap);
    expect(s.board.birmingham![2]).toEqual(tile(0, 'iron', 4, 1)); // 1 cube left on the tile, not flipped
    expect([s.iron, s.coal]).toEqual([10, 12]);
    expect([s.money[0], s.spent[0]]).toEqual([17 - 12 - 1 + (3 + 2 + 2 + 1 + 1), 13]);
  });

  it('cotton / manufacturer card builds both goods but not a coal mine', () => {
    const dual = cardOf(['cotton', 'manufacturer']);
    let snap = table([dual, cardOf(['cotton', 'manufacturer'], 1)]);
    expect(reject(snap, 0, { type: 'build', card: dual, industry: 'coal', loc: 'tamworth', slot: 0 })).toBe('CARD_CANNOT_BUILD');
    expect(cardAllows(st(snap), 0, dual, 'manufacturer', LOC.get('birmingham')!)).toBe(true);
    snap = act(snap, 0, { type: 'build', card: dual, industry: 'cotton', loc: 'birmingham', slot: 0 });
    expect(st(snap).board.birmingham![0]).toEqual(tile(0, 'cotton', 1, 0));
  });

  it.skipIf(STACK.manufacturer.length === 0)('cotton / manufacturer card builds a manufacturer', () => {
    const dual = cardOf(['cotton', 'manufacturer']);
    const t = table([dual]);
    st(t).links['birmingham~oxford'] = 1; // Manufacturer I needs 1 coal: market coal through the Oxford connection
    const snap = act(t, 0, { type: 'build', card: dual, industry: 'manufacturer', loc: 'birmingham', slot: 1 });
    expect(st(snap).board.birmingham![1]).toMatchObject({ owner: 0, industry: 'manufacturer', level: 1 });
  });
});
