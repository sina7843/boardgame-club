import { describe, expect, it } from 'vitest';
import { CARDS, LOCATIONS, WILD_INDUSTRY, WILD_LOCATION, brassModule, type BrassState, type Industry } from '@bg/game-brass';
import { townsSouth } from '../../../games/brass/src/content/towns-south.ts';
import { applyAction, startGame, type EngineSnapshot } from '../src/index.ts';

const m = brassModule as never;
const st = (s: EngineSnapshot) => s.state as BrassState;
const loc = (town: string, n = 0) => CARDS.filter((c) => c.kind === 'location' && c.loc === town)[n]!.id;
const indCard = (x: Industry, n = 0) => CARDS.filter((c) => c.kind === 'industry' && c.industries.includes(x))[n]!.id;
const run = (snap: EngineSnapshot, action: unknown) => applyAction(m, snap, { kind: 'player', seat: 0 }, action, 0);
const code = (snap: EngineSnapshot, action: unknown) => { const r = run(snap, action); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };

/** 2-player table in round 2 of the Canal Era: seat 0 to act with 2 actions and the given hand. */
function table(hand: number[]) {
  const snap = startGame(m, { playerCount: 2, seed: 7, options: {} }).snapshot;
  const s = st(snap);
  s.order = [0, 1]; s.turn = 0; s.round = 2; s.actionsLeft = 2;
  s.hands = [hand, [indCard('brewery', 0), indCard('brewery', 1)]];
  return snap;
}

describe('brass content: towns-south', () => {
  it('declares every location exactly, in order', () => {
    const rows = townsSouth.locations!.map((l) => [l.id, l.nameFa, l.nameEn, l.kind, l.pos, l.color, l.slots, l.cards]);
    expect(rows).toEqual([
      ['birmingham', 'بیرمنگام', 'Birmingham', 'town', [62, 67], 'purple', [['cotton', 'manufacturer'], ['manufacturer'], ['iron'], ['manufacturer']], [3, 3, 3]],
      ['walsall', 'والسال', 'Walsall', 'town', [51, 54], 'yellow', [['iron', 'manufacturer'], ['manufacturer', 'brewery']], [1, 1, 1]],
      ['wolverhampton', 'ولورهمپتون', 'Wolverhampton', 'town', [30, 53], 'yellow', [['manufacturer'], ['manufacturer', 'coal']], [2, 2, 2]],
      ['coalbrookdale', 'کول‌بروک‌دیل', 'Coalbrookdale', 'town', [13, 57], 'yellow', [['iron', 'brewery'], ['iron'], ['coal']], [3, 3, 3]],
      ['dudley', 'دادلی', 'Dudley', 'town', [35, 64], 'yellow', [['coal'], ['iron']], [2, 2, 2]],
      ['kidderminster', 'کیدرمینستر', 'Kidderminster', 'town', [23, 75], 'yellow', [['cotton', 'coal'], ['cotton']], [2, 2, 2]],
      ['worcester', 'وُستر', 'Worcester', 'town', [25, 90], 'yellow', [['cotton'], ['cotton']], [2, 2, 2]],
      ['coventry', 'کاونتری', 'Coventry', 'town', [88, 71], 'purple', [['pottery'], ['manufacturer', 'coal'], ['iron', 'manufacturer']], [3, 3, 3]],
      ['nuneaton', 'نانیتن', 'Nuneaton', 'town', [84, 58], 'purple', [['manufacturer', 'brewery'], ['cotton', 'coal']], [1, 1, 1]],
      ['redditch', 'ردیچ', 'Redditch', 'town', [58, 80], 'purple', [['manufacturer', 'coal'], ['iron']], [1, 1, 1]],
      ['farm-worcester', 'آبجوسازی روستایی وُستر', 'Farm Brewery (Worcester)', 'farm', [21, 83], undefined, [['brewery']], undefined]
    ]);
    expect(townsSouth.links ?? []).toEqual([]);
  });

  it('location-card totals [22,22,22], unique ids, all registered, no farm card', () => {
    const totals = [0, 1, 2].map((i) => townsSouth.locations!.reduce((n, l) => n + (l.cards?.[i] ?? 0), 0));
    // Sum of the per-town counts. The brief said [22,22,22], which contradicts its own counts; 20 is right because
    // north 7/15/21 + south 20 + industry cards 13/19/23 make the official 40/54/64-card decks.
    expect(totals).toEqual([20, 20, 20]);
    const ids = LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of townsSouth.locations!) expect(ids).toContain(l.id);
    expect(CARDS.filter((c) => c.kind === 'location' && c.loc === 'coalbrookdale')).toHaveLength(3);
    expect(CARDS.some((c) => c.kind === 'location' && c.loc === 'farm-worcester')).toBe(false);
  });

  it('Coalbrookdale: iron must use the single-icon slot while it is empty', () => {
    const snap = table([loc('coalbrookdale'), loc('coalbrookdale', 1), indCard('iron')]);
    st(snap).board['coalbrookdale']![2] = { owner: 1, industry: 'coal', level: 1, cubes: 2, flipped: false };
    expect(code(snap, { type: 'build', card: loc('coalbrookdale'), industry: 'iron', loc: 'coalbrookdale', slot: 0 })).toBe('USE_SINGLE_SLOT');
    expect(st(snap).board['coalbrookdale']![0]).toBeNull();
    const r = run(snap, { type: 'build', card: loc('coalbrookdale'), industry: 'iron', loc: 'coalbrookdale', slot: 1 });
    if ('ok' in r) throw new Error(r.errorCode);
    const s = st(r.snapshot);
    expect(s.board['coalbrookdale']![1]).toMatchObject({ owner: 0, industry: 'iron', level: 1 });
    expect(s.board['coalbrookdale']![2]!.cubes).toBe(1); // its coal came from the mine in the same town
  });

  it('Coalbrookdale: a brewery uses the two-icon slot (no single brewery slot exists)', () => {
    const snap = table([loc('coalbrookdale'), indCard('brewery')]);
    expect(code(snap, { type: 'build', card: loc('coalbrookdale'), industry: 'brewery', loc: 'coalbrookdale', slot: 1 })).toBe('SLOT_REJECTS_INDUSTRY');
    expect(code(snap, { type: 'build', card: loc('coalbrookdale'), industry: 'brewery', loc: 'coalbrookdale', slot: 0 })).not.toBe('USE_SINGLE_SLOT');
  });

  it('farm-worcester: Wild Location and Worcester Location cards cannot build there', () => {
    const snap = table([WILD_LOCATION, loc('worcester'), WILD_INDUSTRY]);
    expect(code(snap, { type: 'build', card: WILD_LOCATION, industry: 'brewery', loc: 'farm-worcester', slot: 0 })).toBe('CARD_CANNOT_BUILD');
    expect(code(snap, { type: 'build', card: loc('worcester'), industry: 'brewery', loc: 'farm-worcester', slot: 0 })).toBe('CARD_CANNOT_BUILD');
    expect(st(snap).board['farm-worcester']).toEqual([null]);
  });
});
