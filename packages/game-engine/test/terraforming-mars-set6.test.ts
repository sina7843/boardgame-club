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
const mine = (snap: EngineSnapshot) => { Object.assign(st(snap), { current: 0, actionsTaken: 0 }); return snap; };
const firstOption = (snap: EngineSnapshot, seat = 0) => (hints(snap, seat).find((x) => x.type === 'respond')!.options as string[])[0]!;
const P0 = (snap: EngineSnapshot) => st(snap).players[0]!;
const P1 = (snap: EngineSnapshot) => st(snap).players[1]!;
const play = (snap: EngineSnapshot, card: string) => { P0(snap).hand.push(card); return act(mine(snap), 0, { type: 'play', card }); };
const use = (snap: EngineSnapshot, card: string, pay?: unknown) => act(mine(snap), 0, { type: 'cardAction', card, ...(pay ? { pay } : {}) });
const cardsVp = (snap: EngineSnapshot, seat = 0) => score(st(snap), seat).cards;

describe('terraforming-mars set6: data', () => {
  it('all 32 cards with official numbers, CE flags, costs and VP', () => {
    const ids = Array.from({ length: 32 }, (_, i) => String(177 + i));
    for (const id of ids) expect(CARD[id], id).toBeDefined();
    const ce = ['180', '182', '185', '186', '192', '194', '195', '196', '197', '199', '201', '204', '207', '208'];
    for (const id of ids) expect(!!CARD[id]!.ce, id).toBe(ce.includes(id));
    expect(CARD['197']!.cost).toBe(33);
    expect(CARD['203']!.cost).toBe(35);
    expect(CARD['185']!.tags).toEqual(['science', 'earth', 'building']);
  });

  it.each([
    ['178', -1], ['179', 1], ['182', -2], ['183', -1], ['185', 1], ['186', 1], ['188', -1], ['195', -1], ['196', 1], ['197', 2],
    ['201', -1], ['207', 1], ['208', 1]
  ] as const)('%s printed VP %i', (id, vp) => {
    const snap = clean();
    P0(snap).played = [id];
    expect(cardsVp(snap)).toBe(vp);
  });
});

describe('terraforming-mars set6: production cards', () => {
  it.each([
    ['179', { energy: 0, plants: 1 }], ['180', { energy: 0, titanium: 1, mc: 1 }], ['203', { heat: 7 }], ['198', { mc: 5 }]
  ] as const)('%s production', (id, prod) => {
    const snap = mine(clean());
    P0(snap).prod.energy = 1;
    const s2 = play(snap, id);
    for (const [r, n] of Object.entries(prod)) expect(P0(s2).prod[r as 'mc']).toBe(n);
  });

  it('energy decreases must be payable (Soil Factory, Fuel Factory, Rad-Chem, AI Central, Stronghold, Immigrant City)', () => {
    const snap = mine(clean());
    P0(snap).played = ['196', '204', '207']; // 2 science tags in play (204 is an event: does not count)
    P0(snap).played.push('185');
    P0(snap).hand.push('179', '180', '205', '208', '182', '200');
    for (const id of ['179', '180', '205', '208', '182', '200']) expect(reject(snap, 0, { type: 'play', card: id }), id).toBe('PRODUCTION_TOO_LOW');
  });

  it('Rad-Chem Factory: −1 energy production, +2 TR', () => {
    const snap = mine(clean());
    P0(snap).prod.energy = 1;
    const s2 = play(snap, '205');
    expect(P0(s2).prod.energy).toBe(0);
    expect(P0(s2).tr).toBe(22);
  });

  it('Rad-Suits needs 2 cities in play (any player)', () => {
    const snap = mine(clean());
    st(snap).tiles['20'] = { kind: 'city', owner: 1 };
    P0(snap).hand.push('186');
    expect(reject(snap, 0, { type: 'play', card: '186' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).tiles['01'] = { kind: 'city', owner: 1 };
    expect(P0(act(snap, 0, { type: 'play', card: '186' })).prod.mc).toBe(1);
  });

  it('Energy Saving: 1 energy production per city in play (all players)', () => {
    const snap = clean();
    st(snap).tiles['20'] = { kind: 'city', owner: 1 };
    st(snap).tiles['01'] = { kind: 'city', owner: 0 };
    st(snap).tiles['40'] = { kind: 'city', owner: 1 };
    expect(P0(play(snap, '189')).prod.energy).toBe(3);
  });

  it('Medical Lab: 1 M€ production per 2 building tags including itself', () => {
    let snap = clean();
    P0(snap).played = ['179', '180'];
    snap = play(snap, '207');
    expect(P0(snap).prod.mc).toBe(1);
    const s2 = clean();
    P0(s2).played = ['179', '180', '203', '187'];
    expect(P0(play(s2, '207')).prod.mc).toBe(2);
  });

  it('Immigration Shuttles: 1 VP per 3 cities in play', () => {
    const snap = play(clean(), '198');
    expect(cardsVp(snap)).toBe(0);
    for (const sp of ['01', '20', '40']) st(snap).tiles[sp] = { kind: 'city', owner: 1 };
    expect(cardsVp(snap)).toBe(1);
    st(snap).tiles['02'] = { kind: 'city', owner: 0 };
    expect(cardsVp(snap)).toBe(1);
  });

  it('Terraforming Ganymede: 1 TR per jovian tag including itself (events do not count)', () => {
    const snap = clean();
    P0(snap).played = ['012'];
    const s2 = play(snap, '197');
    expect(P0(s2).tr).toBe(22);
    expect(P0(play(clean(), '197')).tr).toBe(21);
  });

  it('Lagrange Observatory draws 1, Technology Demonstration draws 2', () => {
    expect(P0(play(clean(), '196')).hand).toHaveLength(1);
    expect(P0(play(clean(), '204')).hand).toHaveLength(2);
  });
});

describe('terraforming-mars set6: decrease any production', () => {
  it('Heat Trappers: −2 heat production of a player with ≥2, +1 energy; unplayable without a target', () => {
    let snap = mine(clean());
    P0(snap).hand.push('178');
    expect(reject(snap, 0, { type: 'play', card: '178' })).toBe('NO_TARGET');
    P1(snap).prod.heat = 3;
    snap = act(snap, 0, { type: 'play', card: '178' });
    expect(P0(snap).prod.energy).toBe(1);
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'player', options: [1], optional: false });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).prod.heat).toBe(1);
  });

  it('Biomass Combustors: oxygen 6%, −1 plant production, +2 energy', () => {
    let snap = mine(clean());
    P1(snap).prod.plants = 1;
    st(snap).oxygen = 5;
    P0(snap).hand.push('183');
    expect(reject(snap, 0, { type: 'play', card: '183' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 6;
    snap = act(snap, 0, { type: 'play', card: '183' });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P0(snap).prod.energy).toBe(2);
    expect(P1(snap).prod.plants).toBe(0);
  });

  it('Energy Tapping: −1 energy production of a player, +1 own', () => {
    let snap = mine(clean());
    P1(snap).prod.energy = 2;
    snap = play(snap, '201');
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P0(snap).prod.energy).toBe(1);
    expect(P1(snap).prod.energy).toBe(1);
  });
});

describe('terraforming-mars set6: oceans and tiles', () => {
  it.each([['181', 2], ['191', -8]] as const)('%s needs temperature %i °C and places an ocean', (id, t) => {
    let snap = mine(clean());
    st(snap).temperature = t - 2;
    P0(snap).hand.push(id);
    expect(reject(snap, 0, { type: 'play', card: id })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).temperature = t;
    snap = act(snap, 0, { type: 'play', card: id });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(1);
    expect(P0(snap).tr).toBe(21);
  });

  it('Corporate Stronghold: production and a city tile', () => {
    let snap = mine(clean());
    P0(snap).prod.energy = 1;
    snap = play(snap, '182');
    expect(P0(snap).prod).toMatchObject({ energy: 0, mc: 3 });
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'space' });
    const sp = firstOption(snap);
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).tiles[sp]).toMatchObject({ kind: 'city', owner: 0 });
  });

  it('Plantation: 2 science tags, greenery raises oxygen', () => {
    let snap = mine(clean());
    P0(snap).played = ['196'];
    P0(snap).hand.push('193');
    expect(reject(snap, 0, { type: 'play', card: '193' })).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('207');
    snap = act(snap, 0, { type: 'play', card: '193' });
    const sp = firstOption(snap);
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).tiles[sp]).toMatchObject({ kind: 'greenery', owner: 0 });
    expect(st(snap).oxygen).toBe(1);
    expect(P0(snap).tr).toBe(21);
  });

  it('Restricted Area: special tile; action pays 2 M€ to draw 1', () => {
    let snap = play(clean(), '199');
    const sp = firstOption(snap);
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).tiles[sp]).toMatchObject({ kind: 'special', owner: 0, card: '199' });
    snap = use(snap, '199');
    expect(P0(snap).res.mc).toBe(100 - 11 - 2);
    expect(P0(snap).hand).toHaveLength(1);
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '199' })).toBe('ACTION_USED');
    const poor = mine(clean(2, 0));
    P0(poor).played = ['199'];
    expect(reject(poor, 0, { type: 'cardAction', card: '199' })).toBe('CANNOT_AFFORD');
  });

  it('Immigrant City: +1 M€ production for every city placed by anyone, including its own', () => {
    let snap = mine(clean());
    P0(snap).prod.energy = 1;
    snap = play(snap, '200');
    expect(P0(snap).prod.mc).toBe(-2);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(P0(snap).prod.mc).toBe(-1);
    // opponent's standard project city
    st(snap).current = 1; st(snap).actionsTaken = 0;
    snap = act(snap, 1, { type: 'project', project: 'city' });
    snap = act(snap, 1, { type: 'respond', space: firstOption(snap, 1) });
    expect(P0(snap).prod.mc).toBe(0);
    // greenery does not count
    snap = mine(snap);
    P0(snap).res.plants = 8;
    snap = act(snap, 0, { type: 'convertPlants' });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(P0(snap).prod.mc).toBe(0);
  });

  it('Flooding: ocean, then optionally remove up to 4 M€ from an adjacent tile owner (not yourself)', () => {
    let snap = clean();
    const ocean = MARS.find((x) => x.ocean && ADJ[x.id]!.some((a) => !SPACE_OCEAN(a)))!.id;
    const land = ADJ[ocean]!.filter((a) => !SPACE_OCEAN(a));
    st(snap).tiles[land[0]!] = { kind: 'city', owner: 1 };
    if (land[1]) st(snap).tiles[land[1]] = { kind: 'greenery', owner: 0 };
    P1(snap).res.mc = 3;
    snap = play(snap, '188');
    expect(reject(snap, 0, { type: 'respond', space: land[0] })).toBe('BAD_SPACE');
    snap = act(snap, 0, { type: 'respond', space: ocean });
    expect(st(snap).oceans).toBe(1);
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'player', options: [1], optional: true });
    expect(reject(snap, 0, { type: 'respond', seat: 0 })).toBe('BAD_TARGET');
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).res.mc).toBe(0);
    expect(P0(snap).res.mc).toBe(93); // the removed M€ is not gained
    expect(cardsVp(snap)).toBe(-1);
  });

  it('Flooding: no prompt without adjacent opponent tiles; skip allowed', () => {
    let snap = play(clean(), '188');
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).queue).toHaveLength(0);
    let s2 = clean();
    const ocean = MARS.find((x) => x.ocean && ADJ[x.id]!.some((a) => !SPACE_OCEAN(a)))!.id;
    st(s2).tiles[ADJ[ocean]!.find((a) => !SPACE_OCEAN(a))!] = { kind: 'city', owner: 1 };
    s2 = play(s2, '188');
    s2 = act(s2, 0, { type: 'respond', space: ocean });
    s2 = act(s2, 0, { type: 'respond', skip: true });
    expect(P1(s2).res.mc).toBe(100);
  });
});
const SPACE_OCEAN = (id: string) => MARS.find((x) => x.id === id)?.ocean ?? true;

describe('terraforming-mars set6: blue actions', () => {
  it('Water Splitting Plant: 2 oceans; 3 energy → +1 oxygen', () => {
    let snap = mine(clean());
    st(snap).oceans = 1;
    P0(snap).hand.push('177');
    expect(reject(snap, 0, { type: 'play', card: '177' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oceans = 2;
    snap = act(snap, 0, { type: 'play', card: '177' });
    P0(snap).res.energy = 2;
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '177' })).toBe('CANNOT_USE');
    P0(snap).res.energy = 4;
    snap = use(snap, '177');
    expect(P0(snap).res.energy).toBe(1);
    expect(st(snap).oxygen).toBe(1);
    expect(P0(snap).tr).toBe(21);
  });

  it('Livestock: oxygen 9%, −1 plant / +2 M€ production, action adds an animal, 1 VP each', () => {
    let snap = mine(clean());
    st(snap).oxygen = 9;
    P0(snap).hand.push('184');
    expect(reject(snap, 0, { type: 'play', card: '184' })).toBe('PRODUCTION_TOO_LOW');
    P0(snap).prod.plants = 1;
    st(snap).oxygen = 8;
    expect(reject(snap, 0, { type: 'play', card: '184' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 9;
    snap = act(snap, 0, { type: 'play', card: '184' });
    expect(P0(snap).prod).toMatchObject({ plants: 0, mc: 2 });
    snap = use(snap, '184');
    expect(P0(snap).cardRes['184']).toBe(1);
    expect(cardsVp(snap)).toBe(1);
  });

  it('Aquifer Pumping: 8 M€ for an ocean, steel may pay', () => {
    let snap = mine(clean(2, 18));
    snap = play(snap, '187');
    expect(P0(snap).res.mc).toBe(0);
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '187' })).toBe('CANNOT_AFFORD');
    P0(snap).res.steel = 3; P0(snap).res.mc = 2;
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '187', pay: { titanium: 1, mc: 2, steel: 2 } })).toBe('BAD_PAYMENT');
    snap = use(snap, '187', { mc: 2, steel: 3 });
    expect(P0(snap).res).toMatchObject({ mc: 0, steel: 0 });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(1);
    expect(P0(snap).tr).toBe(21);
    const full = mine(clean());
    P0(full).played = ['187'];
    st(full).oceans = 9;
    expect(reject(full, 0, { type: 'cardAction', card: '187' })).toBe('CANNOT_USE');
  });

  it('Power Infrastructure: spend X energy for X M€', () => {
    let snap = play(clean(), '194');
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '194' })).toBe('CANNOT_USE');
    P0(snap).res.energy = 5;
    snap = use(snap, '194');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'amount' });
    expect(reject(snap, 0, { type: 'respond', amount: 6 })).toBe('BAD_AMOUNT');
    expect(reject(snap, 0, { type: 'respond', amount: 0 })).toBe('BAD_AMOUNT');
    snap = act(snap, 0, { type: 'respond', amount: 4 });
    expect(P0(snap).res).toMatchObject({ energy: 1, mc: 100 - 4 + 4 });
  });

  it('Underground Detonations: 10 M€ for 2 heat production', () => {
    const snap = use(play(clean(), '202'), '202');
    expect(P0(snap).prod.heat).toBe(2);
    expect(P0(snap).res.mc).toBe(100 - 6 - 10);
  });

  it('AI Central: 3 science tags, −1 energy production, action draws 2', () => {
    let snap = mine(clean());
    P0(snap).prod.energy = 1;
    P0(snap).played = ['196', '207'];
    P0(snap).hand.push('208');
    expect(reject(snap, 0, { type: 'play', card: '208' })).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('199');
    snap = act(snap, 0, { type: 'play', card: '208' });
    expect(P0(snap).prod.energy).toBe(0);
    snap = use(snap, '208');
    expect(P0(snap).hand).toHaveLength(2);
  });
});

describe('terraforming-mars set6: events', () => {
  it('Local Heat Trapping: 5 heat for 4 plants (no animal card: no choice); needs 5 heat', () => {
    let snap = mine(clean());
    P0(snap).res.heat = 4;
    P0(snap).hand.push('190');
    expect(reject(snap, 0, { type: 'play', card: '190' })).toBe('NOT_ENOUGH_RESOURCES');
    P0(snap).res.heat = 5;
    snap = act(snap, 0, { type: 'play', card: '190' });
    expect(P0(snap).res).toMatchObject({ heat: 0, plants: 4 });
    expect(st(snap).queue).toHaveLength(0);
  });

  it('Local Heat Trapping: with an animal card, choose 2 animals', () => {
    let snap = mine(clean());
    P0(snap).res.heat = 6;
    P0(snap).played = ['184'];
    snap = play(snap, '190');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'choice' });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', card: '184' });
    expect(P0(snap).cardRes['184']).toBe(2);
    expect(P0(snap).res).toMatchObject({ heat: 1, plants: 0 });
  });

  it('Invention Contest: look at 3, keep 1, discard 2', () => {
    let snap = clean();
    const top = st(snap).deck.slice(0, 3);
    const disc = st(snap).discard.length;
    snap = play(snap, '192');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'cards', options: top });
    expect(reject(snap, 0, { type: 'respond', cards: top.slice(0, 2) })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'respond', cards: [top[1]] });
    expect(P0(snap).hand).toEqual([top[1]]);
    expect(st(snap).discard.length).toBe(disc + 2);
  });

  it('Indentured Workers: next card only costs 8 less', () => {
    let snap = play(clean(), '195');
    expect(P0(snap).nextDiscount).toBe(8);
    snap = play(snap, '203');
    expect(P0(snap).res.mc).toBe(100 - 27);
    snap = play(snap, '196');
    expect(P0(snap).res.mc).toBe(100 - 27 - 9);
    expect(cardsVp(snap)).toBe(-1 + 1);
  });

  it('Special Design: next card ignores global requirements by 2 steps, only once', () => {
    let snap = mine(clean());
    st(snap).temperature = -2;
    P0(snap).hand.push('181', '191');
    expect(reject(snap, 0, { type: 'play', card: '181' })).toBe('REQUIREMENTS_NOT_MET');
    snap = play(snap, '206');
    snap = act(mine(snap), 0, { type: 'play', card: '181' });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    st(snap).temperature = -12;
    expect(reject(mine(snap), 0, { type: 'play', card: '191' })).toBe('REQUIREMENTS_NOT_MET');
  });
});

describe('terraforming-mars set6: Olympus Conference', () => {
  it('adds a science resource for itself, then offers add / remove-to-draw per science tag', () => {
    let snap = play(clean(), '185');
    expect(P0(snap).cardRes['185']).toBe(1);
    expect(st(snap).queue).toHaveLength(0);
    snap = play(snap, '196');
    expect(hints(snap, 0)[0]).toMatchObject({ kind: 'choice' });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(P0(snap).cardRes['185']).toBe(0);
    expect(P0(snap).hand).toHaveLength(2); // Lagrange draw + Olympus draw
    // science event counts; no resource -> add without asking
    snap = play(snap, '204');
    expect(P0(snap).cardRes['185']).toBe(1);
    snap = play(snap, '206');
    snap = act(snap, 0, { type: 'respond', index: 0 });
    expect(P0(snap).cardRes['185']).toBe(2);
    expect(cardsVp(snap)).toBe(1 + 1);
  });

  it('opponent science tags do not trigger it', () => {
    let snap = play(clean(), '185');
    st(snap).current = 1; st(snap).actionsTaken = 0;
    P1(snap).hand.push('196');
    snap = act(snap, 1, { type: 'play', card: '196' });
    expect(P0(snap).cardRes['185']).toBe(1);
    expect(st(snap).queue).toHaveLength(0);
  });
});

