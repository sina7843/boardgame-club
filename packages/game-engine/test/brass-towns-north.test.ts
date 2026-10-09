import { describe, expect, it } from 'vitest';
import { CARDS, LOCATIONS, WILD_LOCATION, brassModule, deckFor, type BrassState, type Industry } from '@bg/game-brass';
import { townsNorth } from '../../../games/brass/src/content/towns-north.ts';
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
const locCards = (town: string) => CARDS.filter((c) => c.kind === 'location' && c.loc === town);
const indCard = (x: Industry, n = 0) => CARDS.filter((c) => c.kind === 'industry' && c.industries.includes(x))[n]!.id;

function table(players: number, hand: number[]) {
  const snap = startGame(m, { playerCount: players, seed: 7, options: {} }).snapshot;
  const s = st(snap);
  s.order = Array.from({ length: players }, (_, i) => i); s.turn = 0; s.round = 2; s.actionsLeft = 2;
  s.hands = s.hands.map((h, i) => (i === 0 ? hand : [indCard('brewery', i - 1)]));
  return snap;
}

type I = Industry;
const EXPECTED: [string, string, string, 'town' | 'farm', [number, number], string | undefined, I[][], [number, number, number] | undefined][] = [
  ['cannock', 'کنک', 'Cannock', 'town', [41, 44], 'yellow', [['manufacturer', 'coal'], ['coal']], [2, 2, 2]],
  ['tamworth', 'تمورث', 'Tamworth', 'town', [75, 48], 'yellow', [['cotton', 'coal'], ['cotton', 'coal']], [1, 1, 1]],
  ['farm-cannock', 'آبجوسازی روستایی کنک', 'Farm Brewery (Cannock)', 'farm', [45, 49], undefined, [['brewery']], undefined],
  ['belper', 'بلپر', 'Belper', 'town', [85, 7], 'teal', [['cotton', 'manufacturer'], ['coal'], ['pottery']], [0, 0, 2]],
  ['derby', 'دربی', 'Derby', 'town', [88, 20], 'teal', [['cotton', 'brewery'], ['cotton', 'manufacturer'], ['iron']], [0, 0, 3]],
  ['leek', 'لیک', 'Leek', 'town', [52, 6], 'blue', [['cotton', 'manufacturer'], ['cotton', 'coal']], [0, 2, 2]],
  ['stoke-on-trent', 'استوک‌آن‌ترنت', 'Stoke-on-Trent', 'town', [36, 14], 'blue', [['cotton', 'manufacturer'], ['pottery', 'iron'], ['manufacturer']], [0, 3, 3]],
  ['stone', 'استون', 'Stone', 'town', [23, 23], 'blue', [['cotton', 'brewery'], ['manufacturer', 'coal']], [0, 2, 2]],
  ['uttoxeter', 'آتاکستر', 'Uttoxeter', 'town', [56, 20], 'blue', [['manufacturer', 'brewery'], ['cotton', 'brewery']], [0, 1, 2]],
  ['stafford', 'استافورد', 'Stafford', 'town', [31, 34], 'red', [['manufacturer', 'brewery'], ['pottery']], [2, 2, 2]],
  ['burton-on-trent', 'برتن‌آن‌ترنت', 'Burton-on-Trent', 'town', [73, 35], 'red', [['manufacturer', 'coal'], ['brewery']], [2, 2, 2]]
];

describe('brass content: towns-north', () => {
  it('declares exactly the 11 northern locations in order', () => {
    const got = townsNorth.locations!.map((l) => [l.id, l.nameFa, l.nameEn, l.kind, l.pos, l.color, l.slots, l.cards]);
    expect(got).toEqual(EXPECTED);
    expect(townsNorth.links ?? []).toEqual([]);
    expect(townsNorth.merchantTiles ?? []).toEqual([]);
  });

  it('ids are unique across the registry and the chunk comes first in board order', () => {
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 11)).toEqual(EXPECTED.map((e) => e[0]));
  });

  it('Location-card totals and per-player-count decks', () => {
    const totals = [0, 1, 2].map((k) => townsNorth.locations!.reduce((n, l) => n + (l.cards?.[k] ?? 0), 0));
    expect(totals).toEqual([7, 15, 21]); // sum of the per-town counts (the brief's [5, 13, 20] does not match them)
    for (const [k, n] of [2, 3, 4].entries()) {
      const deck = new Set(deckFor(n));
      for (const e of EXPECTED) expect(locCards(e[0]).filter((c) => deck.has(c.id)).length).toBe(e[7]?.[k] ?? 0);
    }
  });

  it('3 players: pottery on the two-icon Stoke-on-Trent space with a Stoke card (market iron)', () => {
    const stoke = locCards('stoke-on-trent');
    let snap = table(3, [stoke[0]!.id, stoke[1]!.id]);
    st(snap).money[0] = 30;
    expect(reject(snap, 0, { type: 'build', card: stoke[0]!.id, industry: 'pottery', loc: 'stoke-on-trent', slot: 2 })).toBe('SLOT_REJECTS_INDUSTRY');
    const ironBefore = st(snap).iron;
    snap = act(snap, 0, { type: 'build', card: stoke[0]!.id, industry: 'pottery', loc: 'stoke-on-trent', slot: 1 });
    const s = st(snap);
    expect(s.board['stoke-on-trent']![1]).toEqual({ owner: 0, industry: 'pottery', level: 1, cubes: 0, flipped: false });
    expect(s.iron).toBe(ironBefore - 1);
    expect([s.money[0], s.spent[0]]).toEqual([11, 19]); // £17 tile + 1 market iron at £2
    expect(reject(snap, 0, { type: 'build', card: stoke[1]!.id, industry: 'cotton', loc: 'stoke-on-trent', slot: 0 })).toBe('ONE_TILE_PER_TOWN');
  });

  it('2 players: no Belper card in the deck, but Belper is buildable with a Wild Location', () => {
    const deck = new Set(deckFor(2));
    for (const t of ['belper', 'derby', 'leek', 'stoke-on-trent', 'stone', 'uttoxeter']) expect(locCards(t).some((c) => deck.has(c.id))).toBe(false);
    const belper = locCards('belper')[0]!.id;
    let snap = table(2, [belper, WILD_LOCATION]);
    st(snap).hands[0] = [WILD_LOCATION];
    expect(reject(snap, 0, { type: 'build', card: belper, industry: 'cotton', loc: 'belper', slot: 0 })).toBe('NOT_IN_HAND');
    snap = act(snap, 0, { type: 'build', card: WILD_LOCATION, industry: 'cotton', loc: 'belper', slot: 0 });
    expect(st(snap).board.belper![0]).toMatchObject({ owner: 0, industry: 'cotton', level: 1 });
  });
});
