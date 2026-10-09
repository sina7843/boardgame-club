import { describe, expect, it } from 'vitest';
import { CARD, SPACE, score, terraformingMarsModule, type TmState } from '@bg/game-terraforming-mars';
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
/** `seat` to act with a fresh turn. */
const turn = (snap: EngineSnapshot, seat = 0) => { Object.assign(st(snap), { current: seat, actionsTaken: 0 }); return snap; };
const firstOption = (snap: EngineSnapshot, seat = 0) => (hints(snap, seat).find((x) => x.type === 'respond')!.options as string[])[0]!;
const P = (snap: EngineSnapshot, seat = 0) => st(snap).players[seat]!;
const play = (snap: EngineSnapshot, card: string) => { P(snap).hand.push(card); return act(turn(snap), 0, { type: 'play', card }); };
const cardsVp = (snap: EngineSnapshot, seat = 0) => score(st(snap), seat).cards;

const IDS = ['143', '144', '145', '146', '147', '148', '149', '150', '151', '154', '155', '156', '157', '158', '159', '160', '161', '162',
  '163', '164', '165', '166', '167', '168', '169', '170', '171', '172', '173', '174', '175', '176'];
const CE = ['144', '149', '150', '151', '154', '156', '160', '173', '175'];

describe('terraforming-mars set5: data', () => {
  it('all 32 cards are defined with official numbers, CE flags and Persian text', () => {
    for (const id of IDS) {
      const c = CARD[id]!;
      expect(c, id).toBeDefined();
      expect(!!c.ce, id).toBe(CE.includes(id));
      expect(c.textFa, id).not.toMatch(/[0-9]/);
      expect(c.nameFa, id).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('terraforming-mars set5: production and simple cards', () => {
  it.each([
    ['144', { titanium: 1 }, {}], ['158', { energy: 1, steel: 1 }, {}], ['164', { heat: 1 }, {}], ['162', { heat: 1 }, { heat: 3 }],
    ['167', { heat: 2 }, {}], ['151', { mc: -1 }, { mc: 107 }]
  ] as const)('%s production/resources', (id, prod, res) => {
    const snap = play(clean(), id);
    for (const [r, n] of Object.entries(prod)) expect(P(snap).prod[r as 'mc']).toBe(n);
    for (const [r, n] of Object.entries(res)) expect(P(snap).res[r as 'mc']).toBe(n);
  });

  it('Investment Loan is refused at −5 M€ production', () => {
    const snap = turn(clean());
    P(snap).prod.mc = -5; P(snap).hand.push('151');
    expect(reject(snap, 0, { type: 'play', card: '151' })).toBe('PRODUCTION_TOO_LOW');
  });

  it('Magnetic Field Generators / Dome: energy decrease is mandatory; TR +3 / +1', () => {
    let snap = turn(clean());
    P(snap).prod.energy = 3; P(snap).hand.push('165');
    expect(reject(snap, 0, { type: 'play', card: '165' })).toBe('PRODUCTION_TOO_LOW');
    P(snap).prod.energy = 4;
    snap = act(snap, 0, { type: 'play', card: '165' });
    expect(P(snap).prod).toMatchObject({ energy: 0, plants: 2 });
    expect(P(snap).tr).toBe(23);
    snap = turn(snap);
    P(snap).hand.push('171');
    expect(reject(snap, 0, { type: 'play', card: '171' })).toBe('PRODUCTION_TOO_LOW');
    P(snap).prod.energy = 2;
    snap = act(snap, 0, { type: 'play', card: '171' });
    expect(P(snap).prod).toMatchObject({ energy: 0, plants: 3 });
    expect(P(snap).tr).toBe(24);
  });

  it('global requirements: min and max accepted/rejected without mutation', () => {
    const cases: [string, Partial<TmState>, Partial<TmState>][] = [
      ['159', { temperature: -26 }, { temperature: -24 }], ['169', { temperature: -8 }, { temperature: -6 }],
      ['176', { temperature: -22 }, { temperature: -20 }], ['155', { temperature: -12 }, { temperature: -14 }],
      ['168', { oxygen: 6 }, { oxygen: 7 }], ['148', { oxygen: 5 }, { oxygen: 6 }], ['166', { oxygen: 4 }, { oxygen: 5 }],
      ['146', { oceans: 2 }, { oceans: 3 }], ['154', { temperature: -2 }, { temperature: 0 }]
    ];
    for (const [id, bad, good] of cases) {
      const snap = turn(clean());
      P(snap).hand.push(id); P(snap).res.plants = 2; P(snap).prod.energy = 1;
      Object.assign(st(snap), bad);
      expect(reject(snap, 0, { type: 'play', card: id }), id).toBe('REQUIREMENTS_NOT_MET');
      Object.assign(st(snap), good);
      expect(() => act(snap, 0, { type: 'play', card: id }), id).not.toThrow();
    }
  });

  it('Lichen, Designed Microorganisms, Tundra Farming, Noctis Farming, Windmills effects and VP', () => {
    let snap = clean();
    st(snap).temperature = -20; snap = play(snap, '159');
    expect(P(snap).prod.plants).toBe(1);
    st(snap).temperature = -20; snap = play(snap, '176');
    expect(P(snap).prod.mc).toBe(1); expect(P(snap).res.plants).toBe(2);
    expect(cardsVp(snap)).toBe(1);
    st(snap).temperature = -6; snap = play(snap, '169');
    expect(P(snap).prod).toMatchObject({ plants: 2, mc: 3 }); expect(P(snap).res.plants).toBe(3);
    expect(cardsVp(snap)).toBe(3);
    st(snap).temperature = -30; snap = play(snap, '155');
    expect(P(snap).prod.plants).toBe(4);
    st(snap).oxygen = 7; snap = play(snap, '168');
    expect(P(snap).prod.energy).toBe(1);
    expect(cardsVp(snap)).toBe(4);
  });

  it('Nitrophilic Moss: needs 2 plants to lose; plant production +2', () => {
    let snap = turn(clean());
    st(snap).oceans = 3; P(snap).res.plants = 1; P(snap).hand.push('146');
    expect(reject(snap, 0, { type: 'play', card: '146' })).toBe('NOT_ENOUGH_RESOURCES');
    P(snap).res.plants = 3;
    snap = act(snap, 0, { type: 'play', card: '146' });
    expect(P(snap).res.plants).toBe(1); expect(P(snap).prod.plants).toBe(2);
  });

  it('Tectonic Stress Power needs 2 science tags: energy +3, 1 VP', () => {
    let snap = turn(clean());
    P(snap).hand.push('145'); P(snap).played.push('115');
    expect(reject(snap, 0, { type: 'play', card: '145' })).toBe('REQUIREMENTS_NOT_MET');
    P(snap).played.push('153');
    snap = act(snap, 0, { type: 'play', card: '145' });
    expect(P(snap).prod.energy).toBe(3); expect(cardsVp(snap)).toBe(2); // 153 Adaptation Technology is 1 VP
  });

  it('Insects: plant production per plant tag; Satellites: M€ production per space tag including this', () => {
    let snap = clean();
    st(snap).oxygen = 6; P(snap).played.push('159', '159');
    snap = play(snap, '148');
    expect(P(snap).prod.plants).toBe(2);
    P(snap).played.push('025');
    snap = play(snap, '175');
    expect(P(snap).prod.mc).toBe(2);
  });
});

describe('terraforming-mars set5: oceans, tiles and events', () => {
  it('Convoy From Europa: 1 ocean (TR) and 1 card', () => {
    let snap = play(clean(), '161');
    expect(P(snap).hand).toHaveLength(1);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(1); expect(P(snap).tr).toBe(21);
  });

  it('Large Convoy without animal cards: 5 plants, 2 cards, 1 ocean, 2 VP', () => {
    let snap = play(clean(), '143');
    expect(P(snap).res.plants).toBe(5); expect(P(snap).hand).toHaveLength(2);
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(st(snap).oceans).toBe(1); expect(st(snap).queue).toHaveLength(0);
    expect(cardsVp(snap)).toBe(2);
  });

  it('Large Convoy with an animal card: choose plants or 4 animals on that card', () => {
    const base = clean();
    P(base).played.push('052');
    let snap = play(base, '143');
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    const plants = act(snap, 0, { type: 'respond', index: 0 });
    expect(P(plants).res.plants).toBe(5); expect(P(plants).cardRes['052'] ?? 0).toBe(0);
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', card: '052' });
    expect(P(snap).cardRes['052']).toBe(4); expect(P(snap).res.plants).toBe(0);
  });

  it('Imported Nitrogen: TR +1, 4 plants, 3 microbes and 2 animals to other cards', () => {
    const base = clean();
    P(base).played.push('035', '052');
    let snap = play(base, '163');
    expect(P(snap).tr).toBe(21); expect(P(snap).res.plants).toBe(4);
    snap = act(snap, 0, { type: 'respond', card: '035' });
    snap = act(snap, 0, { type: 'respond', card: '052' });
    expect(P(snap).cardRes).toMatchObject({ '035': 3, '052': 2 });
    const none = play(clean(), '163');
    expect(st(none).queue).toHaveLength(0); expect(P(none).res.plants).toBe(4);
  });

  it('Aerobraked Ammonia Asteroid: heat +3, plants +1, 2 microbes to another card (skipped without one)', () => {
    const base = clean();
    P(base).played.push('035');
    let snap = play(base, '170');
    expect(P(snap).prod).toMatchObject({ heat: 3, plants: 1 });
    snap = act(snap, 0, { type: 'respond', card: '035' });
    expect(P(snap).cardRes['035']).toBe(2);
    expect(st(play(clean(), '170')).queue).toHaveLength(0);
  });

  it('Protected Valley: greenery on an ocean area (oxygen + TR), M€ production +2', () => {
    let snap = play(clean(), '174');
    expect(P(snap).prod.mc).toBe(2);
    const opts = hints(snap, 0).find((x) => x.type === 'respond')!.options as string[];
    expect(opts.every((id) => SPACE[id]!.ocean)).toBe(true);
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(st(snap).tiles[opts[0]!]).toMatchObject({ kind: 'greenery', owner: 0 });
    expect(st(snap).oxygen).toBe(1); expect(P(snap).tr).toBe(21);
  });
});

describe('terraforming-mars set5: blue cards', () => {
  it("CEO's Favorite Project needs a card with a resource; adds 1 there", () => {
    let snap = turn(clean());
    P(snap).hand.push('149'); P(snap).played.push('052', '035');
    expect(reject(snap, 0, { type: 'play', card: '149' })).toBe('CANNOT_PLAY');
    P(snap).cardRes['052'] = 1;
    snap = act(snap, 0, { type: 'play', card: '149' });
    expect(hints(snap, 0).find((x) => x.type === 'respond')!.options).toEqual(['052']);
    snap = act(snap, 0, { type: 'respond', card: '052' });
    expect(P(snap).cardRes['052']).toBe(2);
  });

  it('Anti-Gravity Technology: 7 science tags; all cards 2 M€ cheaper; 3 VP', () => {
    let snap = turn(clean());
    P(snap).hand.push('150'); P(snap).played.push(...Array(6).fill('115'));
    expect(reject(snap, 0, { type: 'play', card: '150' })).toBe('REQUIREMENTS_NOT_MET');
    P(snap).played.push('115');
    snap = act(snap, 0, { type: 'play', card: '150' });
    expect(P(snap).res.mc).toBe(86); expect(cardsVp(snap)).toBe(3);
    snap = play(snap, '144');
    expect(P(snap).res.mc).toBe(81);
  });

  it('Shuttles: energy −1 (mandatory), M€ +2, space cards 2 cheaper, 1 VP', () => {
    let snap = turn(clean());
    st(snap).oxygen = 5; P(snap).hand.push('166');
    expect(reject(snap, 0, { type: 'play', card: '166' })).toBe('PRODUCTION_TOO_LOW');
    P(snap).prod.energy = 1;
    snap = act(snap, 0, { type: 'play', card: '166' });
    expect(P(snap).prod).toMatchObject({ energy: 0, mc: 2 }); expect(P(snap).res.mc).toBe(90);
    expect(cardsVp(snap)).toBe(1);
    snap = play(snap, '167'); expect(P(snap).res.mc).toBe(83);
    snap = play(snap, '164'); expect(P(snap).res.mc).toBe(80);
  });

  it('Caretaker Contract: spend 8 heat for 1 TR, once per generation', () => {
    let snap = clean();
    st(snap).temperature = 0;
    snap = play(snap, '154');
    P(snap).res.heat = 7;
    expect(reject(turn(snap), 0, { type: 'cardAction', card: '154' })).toBe('CANNOT_USE');
    P(snap).res.heat = 9;
    snap = act(turn(snap), 0, { type: 'cardAction', card: '154' });
    expect(P(snap).res.heat).toBe(1); expect(P(snap).tr).toBe(21);
    expect(reject(turn(snap), 0, { type: 'cardAction', card: '154' })).toBe('ACTION_USED');
  });

  it('Standard Technology: +3 M€ after a paid standard project, not after selling patents', () => {
    let snap = play(clean(), '156');
    expect(P(snap).res.mc).toBe(94);
    snap = act(turn(snap), 0, { type: 'project', project: 'powerPlant' });
    expect(P(snap).res.mc).toBe(86);
    P(snap).hand.push('164');
    snap = act(turn(snap), 0, { type: 'project', project: 'sellPatents', cards: ['164'] });
    expect(P(snap).res.mc).toBe(87);
    snap = act(turn(snap, 1), 1, { type: 'project', project: 'powerPlant' });
    expect(P(snap).res.mc).toBe(87);
  });

  it('Nitrite Reducing Bacteria: 3 microbes; add 1, or remove 3 for 1 TR', () => {
    let snap = play(clean(), '157');
    expect(P(snap).cardRes['157']).toBe(3);
    snap = act(turn(snap), 0, { type: 'cardAction', card: '157' });
    const added = act(snap, 0, { type: 'respond', index: 0 });
    expect(P(added).cardRes['157']).toBe(4);
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(P(snap).cardRes['157']).toBe(0); expect(P(snap).tr).toBe(21);
    P(snap).used = [];
    snap = act(turn(snap), 0, { type: 'cardAction', card: '157' });
    expect(st(snap).queue).toHaveLength(0); expect(P(snap).cardRes['157']).toBe(1);
  });

  it('Power Supply Consortium: 2 power tags; decrease any energy production, own +1', () => {
    let snap = turn(clean());
    P(snap).hand.push('160'); P(snap).played.push('141');
    expect(reject(snap, 0, { type: 'play', card: '160' })).toBe('REQUIREMENTS_NOT_MET');
    P(snap).played.push('141');
    expect(reject(snap, 0, { type: 'play', card: '160' })).toBe('ACCEPTED'); // its own +1 energy production makes the owner a legal target
    P(snap, 1).prod.energy = 1;
    snap = act(snap, 0, { type: 'play', card: '160' });
    expect(P(snap).prod.energy).toBe(1);
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P(snap, 1).prod.energy).toBe(0);
  });

  it('Herbivores: 8% oxygen, 1 animal, any plant production −1, +1 animal per own greenery, 1 VP per 2', () => {
    let snap = turn(clean());
    P(snap).hand.push('147'); st(snap).oxygen = 7; P(snap, 1).prod.plants = 1;
    expect(reject(snap, 0, { type: 'play', card: '147' })).toBe('REQUIREMENTS_NOT_MET');
    st(snap).oxygen = 8; P(snap, 1).prod.plants = 0;
    expect(reject(snap, 0, { type: 'play', card: '147' })).toBe('NO_TARGET');
    P(snap, 1).prod.plants = 1;
    snap = act(snap, 0, { type: 'play', card: '147' });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P(snap, 1).prod.plants).toBe(0); expect(P(snap).cardRes['147']).toBe(1);
    expect(cardsVp(snap)).toBe(0);
    snap = act(turn(snap), 0, { type: 'project', project: 'greenery' });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(P(snap).cardRes['147']).toBe(2); expect(cardsVp(snap)).toBe(1);
    snap = act(turn(snap, 1), 1, { type: 'project', project: 'greenery' });
    snap = act(snap, 1, { type: 'respond', space: firstOption(snap, 1) });
    expect(P(snap).cardRes['147']).toBe(2);
    snap = play(snap, '174');
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(P(snap).cardRes['147']).toBe(3);
  });

  it('Pets: 1 animal, +1 for any city by any player, keeps resources, 1 VP per 2', () => {
    let snap = play(clean(), '172');
    expect(P(snap).cardRes['172']).toBe(1); expect(CARD['172']!.keepsResources).toBe(true);
    snap = act(turn(snap), 0, { type: 'project', project: 'city' });
    snap = act(snap, 0, { type: 'respond', space: firstOption(snap) });
    expect(P(snap).cardRes['172']).toBe(2); expect(cardsVp(snap)).toBe(1);
    snap = act(turn(snap, 1), 1, { type: 'project', project: 'city' });
    snap = act(snap, 1, { type: 'respond', space: firstOption(snap, 1) });
    expect(P(snap).cardRes['172']).toBe(3);
  });

  it("Protected Habitats: Asteroid cannot remove the protected player's plants; Ants cannot take their microbes", () => {
    let snap = turn(clean());
    P(snap, 1).played.push('173', '157'); P(snap, 1).cardRes['157'] = 3; P(snap, 1).res.plants = 5;
    snap = play(snap, '009');
    expect(st(snap).queue).toHaveLength(0); expect(P(snap, 1).res.plants).toBe(5);
    P(snap).played.push('035');
    expect(reject(turn(snap), 0, { type: 'cardAction', card: '035' })).toBe('CANNOT_USE');
    // Without protection the Asteroid may target them.
    let open = turn(clean());
    P(open, 1).res.plants = 5;
    open = play(open, '009');
    open = act(open, 0, { type: 'respond', seat: 1 });
    expect(P(open, 1).res.plants).toBe(2);
  });
});
