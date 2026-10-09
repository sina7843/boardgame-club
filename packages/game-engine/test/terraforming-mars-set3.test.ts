import { describe, expect, it } from 'vitest';
import { ADJ, CARD, MARS, score, terraformingMarsModule, type TmState } from '@bg/game-terraforming-mars';
import { applyAction, projectFor, startGame, type EngineSnapshot } from '../src/index.ts';

const m = terraformingMarsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TmState;
const hints = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const before = JSON.stringify(snap.state);
  const r = applyAction(m, snap, p(seat), action, 0);
  expect(JSON.stringify(snap.state)).toBe(before);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
function begin(players = 2, seed = 1) {
  let snap = startGame(m, { playerCount: players, seed, options: {} }).snapshot;
  for (let k = 0; k < players; k++) snap = act(snap, k, { type: 'corp', corp: st(snap).players[k]!.corpOffer[0], cards: [] });
  return snap;
}
function clean(players = 2, mc = 100): EngineSnapshot {
  const snap = begin(players, 7);
  const s = st(snap);
  s.current = 0; s.firstPlayer = 0; s.actionsTaken = 0;
  for (const pl of s.players) {
    pl.corp = null; pl.firstActionDone = true; pl.hand = []; pl.played = []; pl.cardRes = {};
    pl.res = { mc, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0 };
    pl.prod = { mc: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0 };
  }
  return snap;
}
/** Seat 0 to act again with a fresh turn. */
const mine = (snap: EngineSnapshot) => { Object.assign(st(snap), { current: 0, actionsTaken: 0 }); return snap; };
const firstOption = (snap: EngineSnapshot, seat = 0) => (hints(snap, seat).find((x) => x.type === 'respond')!.options as string[])[0]!;
const P0 = (snap: EngineSnapshot) => st(snap).players[0]!;
const play = (snap: EngineSnapshot, card: string) => { P0(snap).hand.push(card); return act(mine(snap), 0, { type: 'play', card }); };
const cardsVp = (snap: EngineSnapshot, seat = 0) => score(st(snap), seat).cards;

describe('terraforming-mars set3: data', () => {
  it('all 32 cards are defined with official numbers and CE flags', () => {
    const ids = ['073', '074', '075', '076', '077', '079', '080', '081', '082', '083', '084', '085', '086', '087', '088', '089', '090', '091',
      '092', '093', '094', '095', '096', '097', '098', '099', '100', '101', '103', '104', '105', '106'];
    for (const id of ids) expect(CARD[id], id).toBeDefined();
    const ce = ['073', '074', '079', '082', '084', '085', '086', '090', '091', '092', '094', '095', '098', '099', '105', '106'];
    for (const id of ids) expect(!!CARD[id]!.ce, id).toBe(ce.includes(id));
    expect(CARD['090']!.tags).toEqual(['science', 'science']);
  });
});

describe('terraforming-mars set3: production and simple cards', () => {
  it.each([
    ['077', { energy: 1 }, { titanium: 2 }], ['082', { mc: 3 }, {}], ['083', { energy: 3 }, {}], ['092', { titanium: 2, mc: 2 }, {}],
    ['106', { mc: 3 }, {}], ['089', { mc: -1, energy: 2 }, {}], ['100', { mc: -1, energy: 1 }, {}]
  ] as const)('%s production/resources', (id, prod, res) => {
    const snap = play(clean(), id);
    for (const [r, n] of Object.entries(prod)) expect(P0(snap).prod[r as 'mc']).toBe(n);
    for (const [r, n] of Object.entries(res)) expect(P0(snap).res[r as 'mc']).toBe(n);
  });

  it('negative production that cannot be paid is refused without mutation', () => {
    const snap = mine(clean());
    P0(snap).prod.mc = -5;
    P0(snap).hand.push('089', '100', '098', '085');
    expect(reject(snap, 0, { type: 'play', card: '089' })).toBe('PRODUCTION_TOO_LOW');
    expect(reject(snap, 0, { type: 'play', card: '100' })).toBe('PRODUCTION_TOO_LOW');
    P0(snap).prod.heat = 1;
    expect(reject(snap, 0, { type: 'play', card: '098' })).toBe('PRODUCTION_TOO_LOW');
    expect(reject(snap, 0, { type: 'play', card: '085' })).toBe('PRODUCTION_TOO_LOW');
    P0(snap).prod.heat = 2;
    const s2 = act(snap, 0, { type: 'play', card: '098' });
    expect(P0(s2).prod).toMatchObject({ heat: 0, mc: -2 });
    expect(cardsVp(s2)).toBe(2);
  });

  it('VP: Callisto 2, Trans-Neptune 1, Research 1 (+ draws 2), Gene Repair 2, Io Mining per jovian tag', () => {
    let snap = play(clean(), '082');
    snap = play(snap, '084');
    const deckBefore = st(snap).deck.length;
    snap = play(snap, '090');
    expect(P0(snap).hand).toHaveLength(2);
    expect(st(snap).deck.length).toBe(deckBefore - 2);
    expect(cardsVp(snap)).toBe(4);
    // 090 (2) + 084 (1) = 3 science tags: Gene Repair needs 3
    snap = play(snap, '091');
    expect(P0(snap).prod.mc).toBe(5);
    expect(cardsVp(snap)).toBe(6);
    snap = play(snap, '092'); // jovian: 082 + 092 = 2
    expect(cardsVp(snap)).toBe(8);
  });

  it('Gene Repair needs 3 science tags (events do not count)', () => {
    const snap = mine(clean());
    P0(snap).played = ['084', '077'];
    P0(snap).hand.push('091');
    expect(reject(snap, 0, { type: 'play', card: '091' })).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('073');
    expect(reject(snap, 0, { type: 'play', card: '091' })).toBe('ACCEPTED');
  });
});

describe('terraforming-mars set3: plant cards', () => {
  it.each([
    ['087', -16, 1, 3], ['088', -14, 1, 1], ['093', -10, 2, 2]
  ] as const)('%s requires %i °C; gives production and plants', (id, temp, prod, plants) => {
    const snap = mine(clean());
    st(snap).temperature = temp - 2;
    P0(snap).hand.push(id);
    expect(reject(snap, 0, { type: 'play', card: id })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).temperature = temp;
    const s2 = act(snap, 0, { type: 'play', card: id });
    expect(P0(s2).prod.plants).toBe(prod);
    expect(P0(s2).res.plants).toBe(plants);
  });

  it('Greenhouses: 1 plant per city in play, all players, off-Mars too', () => {
    const snap = clean();
    st(snap).tiles['01'] = { kind: 'city', owner: 1 };
    st(snap).tiles['20'] = { kind: 'city', owner: 0 };
    expect(P0(play(snap, '096')).res.plants).toBe(2);
  });
});

describe('terraforming-mars set3: events and tiles', () => {
  it('Towing A Comet: 2 plants, oxygen +1, ocean', () => {
    let snap = play(clean(), '075');
    expect(P0(snap).res.plants).toBe(2);
    expect(st(snap).oxygen).toBe(1);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(1);
    expect(P0(snap).tr).toBe(22);
  });

  it('Giant Ice Asteroid: temperature +2, 2 oceans, remove up to 6 plants', () => {
    let snap = clean();
    st(snap).players[1]!.res.plants = 4;
    snap = play(snap, '080');
    expect(st(snap).temperature).toBe(-26);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(2);
    expect(hints(snap, 0)[0]).toMatchObject({ type: 'respond', kind: 'player', options: [1], optional: true });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.res.plants).toBe(0);
    expect(P0(snap).tr).toBe(24);
  });

  it('Ganymede Colony: city on the off-map area, VP per jovian tag, unplayable once taken', () => {
    let snap = play(clean(), '081');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'space', options: ['01'] });
    snap = act(snap, 0, { type: 'respond', space: '01' });
    expect(st(snap).tiles['01']).toMatchObject({ kind: 'city', owner: 0 });
    expect(score(st(snap), 0).city).toBe(0);
    expect(cardsVp(snap)).toBe(1);
    snap = play(snap, '082');
    expect(cardsVp(snap)).toBe(2 + 2);
    const s3 = mine(clean());
    st(s3).tiles['01'] = { kind: 'city', owner: 1 };
    P0(s3).hand.push('081');
    expect(reject(s3, 0, { type: 'play', card: '081' })).toBe('NO_SPACE');
  });

  it('Commercial District: production, special tile, 1 VP per adjacent city', () => {
    let snap = clean();
    P0(snap).prod.energy = 1;
    snap = play(snap, '085');
    expect(P0(snap).prod).toMatchObject({ energy: 0, mc: 4 });
    const sp = firstOption(snap);
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).tiles[sp]).toMatchObject({ kind: 'special', owner: 0, card: '085' });
    expect(cardsVp(snap)).toBe(0);
    const land = ADJ[sp]!.filter((a) => !MARS.find((x) => x.id === a)!.ocean).slice(0, 2);
    for (const a of land) st(snap).tiles[a] = { kind: 'city', owner: 1 };
    expect(cardsVp(snap)).toBe(2);
  });

  it('Nuclear Zone: special tile, temperature +2, −2 VP', () => {
    let snap = play(clean(), '097');
    expect(st(snap).temperature).toBe(-26);
    expect(P0(snap).tr).toBe(22);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(Object.values(st(snap).tiles).some((t) => t.card === '097' && t.kind === 'special')).toBe(true);
    expect(cardsVp(snap)).toBe(-2);
  });
});

describe('terraforming-mars set3: blue actions', () => {
  it('Space Mirrors: 7 M€ for 1 energy production, once per generation', () => {
    let snap = play(clean(), '076');
    snap = act(mine(snap), 0, { type: 'cardAction', card: '076' });
    expect(P0(snap).prod.energy).toBe(1);
    expect(P0(snap).res.mc).toBe(100 - 3 - 7);
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '076' })).toBe('ACTION_USED');
    const poor = play(clean(2, 9), '076');
    expect(reject(mine(poor), 0, { type: 'cardAction', card: '076' })).toBe('CANNOT_AFFORD');
  });

  it.each([['101', 'steel', 1], ['103', 'steel', 2], ['104', 'titanium', 1]] as const)('%s: 4 energy → %s and oxygen', (id, res, n) => {
    let snap = play(clean(), id);
    P0(snap).res.energy = 3;
    expect(reject(mine(snap), 0, { type: 'cardAction', card: id })).toBe('CANNOT_USE');
    P0(snap).res.energy = 5;
    snap = act(mine(snap), 0, { type: 'cardAction', card: id });
    expect(P0(snap).res.energy).toBe(1);
    expect(P0(snap).res[res]).toBe(n);
    expect(st(snap).oxygen).toBe(1);
    expect(P0(snap).tr).toBe(21);
    P0(snap).res.energy = 4;
    expect(reject(mine(snap), 0, { type: 'cardAction', card: id })).toBe('ACTION_USED');
  });

  it('Physics Complex: 6 energy → 1 science resource, 2 VP each', () => {
    let snap = play(clean(), '095');
    P0(snap).res.energy = 5;
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '095' })).toBe('CANNOT_USE');
    P0(snap).res.energy = 6;
    snap = act(mine(snap), 0, { type: 'cardAction', card: '095' });
    expect(P0(snap).cardRes['095']).toBe(1);
    expect(P0(snap).res.energy).toBe(0);
    expect(cardsVp(snap)).toBe(2);
    P0(snap).cardRes['095'] = 3;
    expect(cardsVp(snap)).toBe(6);
  });
});

describe('terraforming-mars set3: discounts', () => {
  it('Quantum Extractor needs 4 science; space cards 2 M€ cheaper', () => {
    let snap = mine(clean());
    P0(snap).played = ['084', '077', '073'];
    P0(snap).hand.push('079');
    expect(reject(snap, 0, { type: 'play', card: '079' })).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('095');
    snap = act(snap, 0, { type: 'play', card: '079' });
    expect(P0(snap).prod.energy).toBe(4);
    const before = P0(snap).res.mc;
    snap = play(snap, '083');
    expect(before - P0(snap).res.mc).toBe(15);
  });

  it('Mass Converter needs 5 science; energy production 6; space discount', () => {
    let snap = mine(clean());
    P0(snap).played = ['084', '077', '073', '095'];
    P0(snap).hand.push('094');
    expect(reject(snap, 0, { type: 'play', card: '094' })).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('091');
    snap = act(snap, 0, { type: 'play', card: '094' });
    expect(P0(snap).prod.energy).toBe(6);
    const before = P0(snap).res.mc;
    snap = play(snap, '084');
    expect(before - P0(snap).res.mc).toBe(4);
  });

  it('Earth Office: earth cards 3 M€ cheaper', () => {
    let snap = play(clean(), '105');
    const before = P0(snap).res.mc;
    snap = play(snap, '106');
    expect(before - P0(snap).res.mc).toBe(7);
    snap = play(snap, '082'); // not earth
    expect(before - 7 - P0(snap).res.mc).toBe(24);
  });
});

describe('terraforming-mars set3: Toll Station', () => {
  it('1 M€ production per space tag of opponents (not own, not events)', () => {
    const snap = clean(3);
    P0(snap).played = ['083'];
    st(snap).players[1]!.played = ['083', '077', '009'];
    st(snap).players[2]!.played = ['082'];
    expect(P0(play(snap, '099')).prod.mc).toBe(3);
  });
});

describe('terraforming-mars set3: Robotic Workforce', () => {
  it('cannot be played without a building card with a production box', () => {
    const snap = mine(clean());
    P0(snap).played = ['096', '101'];
    P0(snap).hand.push('086');
    expect(reject(snap, 0, { type: 'play', card: '086' })).toBe('CANNOT_PLAY');
  });

  it('copies Power Plant; Capital only when its energy decrease is payable', () => {
    let snap = mine(clean());
    P0(snap).played = ['141', '008'];
    P0(snap).prod = { mc: 5, steel: 0, titanium: 0, plants: 0, energy: 1, heat: 0 };
    snap = play(snap, '086');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'card', options: ['141'], optional: false });
    expect(reject(snap, 0, { type: 'respond', card: '008' })).toBe('BAD_TARGET');
    snap = act(snap, 0, { type: 'respond', card: '141' });
    expect(P0(snap).prod.energy).toBe(2);

    let s2 = mine(clean());
    P0(s2).played = ['141', '008'];
    P0(s2).prod.energy = 2;
    s2 = play(s2, '086');
    expect(hints(s2, 0)[0]).toMatchObject({ kind: 'card', options: ['141', '008'] });
    s2 = act(s2, 0, { type: 'respond', card: '008' });
    expect(P0(s2).prod).toMatchObject({ energy: 0, mc: 5 });
  });
});

describe('terraforming-mars set3: triggers', () => {
  it('Mars University: discard then draw per science tag, including itself; optional', () => {
    let snap = clean();
    P0(snap).hand.push('084');
    snap = play(snap, '073');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'card', options: ['084'], optional: true });
    snap = act(snap, 0, { type: 'respond', card: '084' });
    expect(P0(snap).hand).toHaveLength(1);
    expect(P0(snap).hand).not.toContain('084');
    expect(st(snap).discard).toContain('084');
    expect(st(snap).queue).toHaveLength(0);
    // Research: 2 science tags -> two chained prompts; skipping keeps the hand.
    snap = play(snap, '090');
    expect(P0(snap).hand).toHaveLength(3);
    const h = [...P0(snap).hand];
    snap = act(snap, 0, { type: 'respond', card: h[0] });
    expect(P0(snap).hand).toHaveLength(3);
    expect(P0(snap).hand).not.toContain(h[0]);
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'card', options: P0(snap).hand });
    snap = act(snap, 0, { type: 'respond', skip: true });
    expect(st(snap).queue).toHaveLength(0);
    // no science tag / opponent's science tag: nothing
    snap = play(snap, '106');
    expect(st(snap).queue).toHaveLength(0);
  });

  it('Mars University with an empty hand asks nothing', () => {
    const snap = play(clean(), '073');
    expect(st(snap).queue).toHaveLength(0);
  });

  it('Viral Enhancers: plant on itself; choice of plant or resource on a microbe/animal card', () => {
    let snap = play(clean(), '074');
    expect(P0(snap).res.plants).toBe(1); // its own microbe tag
    st(snap).temperature = -16;
    snap = play(snap, '087'); // plant tag: +1 plant automatically
    expect(P0(snap).res.plants).toBe(1 + 3 + 1);
    st(snap).oxygen = 3;
    snap = play(snap, '131'); // Decomposers: microbe card holding microbes
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'choice' });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(P0(snap).cardRes['131']).toBe(2); // 1 from Decomposers itself + 1 from Viral Enhancers
    expect(P0(snap).res.plants).toBe(5);
    // opponent's plant tag does not trigger
    const s1 = st(snap).players[1]!;
    st(snap).current = 1; st(snap).actionsTaken = 0;
    s1.hand.push('087');
    snap = act(snap, 1, { type: 'play', card: '087' });
    expect(P0(snap).res.plants).toBe(5);
  });

  it('Viral Enhancers choice of a plant', () => {
    let snap = play(clean(), '074');
    st(snap).oxygen = 3;
    snap = play(snap, '131');
    snap = act(snap, 0, { type: 'respond', index: 0 });
    expect(P0(snap).res.plants).toBe(2);
    expect(P0(snap).cardRes['131']).toBe(1);
  });
});
