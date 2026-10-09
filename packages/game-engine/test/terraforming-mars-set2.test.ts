import { describe, expect, it } from 'vitest';
import { CARD, legalSpaces, score, terraformingMarsModule, type TmState } from '@bg/game-terraforming-mars';
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
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** Rejected and the state is untouched. */
const refused = (snap: EngineSnapshot, action: unknown, code: string) => {
  const before = JSON.stringify(st(snap));
  expect(reject(snap, 0, action)).toBe(code);
  expect(JSON.stringify(st(snap))).toBe(before);
};
const game = (players = 2, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
function begin(players = 2, seed = 1) {
  let snap = game(players, seed);
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
const again = (snap: EngineSnapshot) => { Object.assign(st(snap), { current: 0, actionsTaken: 0 }); return snap; };
const prompt = (snap: EngineSnapshot, seat = 0) => hints(snap, seat).find((x) => x.type === 'respond');
const me = (snap: EngineSnapshot) => st(snap).players[0]!;
const zero = { mc: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0 };

describe('terraforming-mars set2: card data', () => {
  it('ids, names, Corporate Era flags', () => {
    const ids = ['040', '041', '042', '043', '044', '045', '046', '047', '048', '049', '050', '051', '053', '054', '055', '056', '057', '058', '059',
      '060', '061', '062', '063', '064', '065', '066', '067', '068', '069', '070', '071', '072'];
    const ce = ['046', '049', '050', '051', '056', '057', '061', '062', '064', '065', '066', '068', '069', '070', '071'];
    for (const id of ids) {
      expect(CARD[id], id).toBeDefined();
      expect(!!CARD[id]!.ce, id).toBe(ce.includes(id));
      expect(CARD[id]!.textFa).not.toMatch(/[0-9]/);
    }
  });

  it.each([
    ['040', {}, { titanium: 2 }, 2],
    ['041', { plants: 1 }, { plants: 0, mc: 4 }, 1],
    ['043', { energy: 1 }, { energy: 0, heat: 3 }, 0],
    ['045', {}, { mc: -2, energy: 3 }, 0],
    ['048', {}, { plants: 1 }, 0],
    ['056', {}, { steel: 1 }, 0],
    ['057', {}, { titanium: 1 }, 1],
    ['065', { energy: 1 }, { energy: 0, steel: 2 }, 0],
    ['068', {}, { mc: 2 }, 0]
  ] as const)('%s production and VP', (id, start, after, vp) => {
    let snap = clean();
    Object.assign(me(snap).prod, start);
    me(snap).hand = [id];
    snap = act(snap, 0, { type: 'play', card: id });
    expect(me(snap).prod).toEqual({ ...zero, ...start, ...after });
    expect(score(st(snap), 0).cards).toBe(vp);
  });

  it('mandatory production decreases refuse the card without mutating', () => {
    for (const id of ['041', '043', '065']) {
      const snap = clean();
      me(snap).hand = [id];
      refused(snap, { type: 'play', card: id }, 'PRODUCTION_TOO_LOW');
    }
    const snap = clean();
    me(snap).prod.mc = -4;
    me(snap).hand = ['045'];
    refused(snap, { type: 'play', card: '045' }, 'PRODUCTION_TOO_LOW');
  });
});

describe('terraforming-mars set2: requirements', () => {
  const cases: [string, (s: TmState) => void, (s: TmState) => void][] = [
    ['042', (s) => { s.temperature = -16; }, (s) => { s.temperature = -18; }],
    ['044', (s) => { s.oxygen = 5; }, (s) => { s.oxygen = 4; }],
    ['046', (s) => { s.players[0]!.played = ['115', '071']; }, (s) => { s.players[0]!.played = ['115', '071', '044']; }],
    ['047', (s) => { s.oceans = 4; }, (s) => { s.oceans = 5; }],
    ['053', (s) => { s.temperature = -2; }, (s) => { s.temperature = 0; }],
    ['054', (s) => { s.oxygen = 5; s.players[1]!.prod.plants = 1; }, (s) => { s.oxygen = 6; s.players[1]!.prod.plants = 1; }],
    ['055', (s) => { s.oceans = 5; }, (s) => { s.oceans = 6; }],
    ['058', (s) => { s.players[0]!.played = []; }, (s) => { s.players[0]!.played = ['040']; }],
    ['059', (s) => { s.temperature = 2; }, (s) => { s.temperature = 4; }],
    ['060', (s) => { s.temperature = -6; }, (s) => { s.temperature = -4; }],
    ['061', (s) => { s.players[0]!.prod.steel = 0; s.players[1]!.prod.steel = 1; }, (s) => { s.players[0]!.prod.steel = 1; }],
    ['069', (s) => { s.oxygen = 9; s.players[0]!.prod.energy = 1; }, (s) => { s.oxygen = 8; s.players[0]!.prod.energy = 1; }],
    ['072', (s) => { s.oxygen = 12; s.players[1]!.prod.plants = 2; }, (s) => { s.oxygen = 13; s.players[1]!.prod.plants = 2; }]
  ];
  it.each(cases)('%s: refused below its requirement, accepted at it', (id, bad, good) => {
    const snap = clean();
    me(snap).hand = [id];
    bad(st(snap));
    refused(snap, { type: 'play', card: id }, 'REQUIREMENTS_NOT_MET');
    good(st(snap));
    expect(reject(snap, 0, { type: 'play', card: id })).toBe('ACCEPTED');
  });
});

describe('terraforming-mars set2: effects', () => {
  it('Algae, Kelp Farming, Trees: plants and plant production', () => {
    let snap = clean();
    Object.assign(st(snap), { oceans: 6, temperature: -4 });
    me(snap).hand = ['047', '055', '060'];
    snap = act(snap, 0, { type: 'play', card: '047' });
    snap = act(snap, 0, { type: 'play', card: '055' });
    snap = act(again(snap), 0, { type: 'play', card: '060' });
    expect(me(snap).res.plants).toBe(1 + 2 + 1);
    expect(me(snap).prod).toMatchObject({ plants: 2 + 3 + 3, mc: 2 });
    expect(score(st(snap), 0).cards).toBe(2);
  });

  it('Miranda Resort: 1 M€ production per earth tag', () => {
    let snap = clean();
    me(snap).played = ['068', '070'];
    me(snap).hand = ['051'];
    snap = act(snap, 0, { type: 'play', card: '051' });
    expect(me(snap).prod.mc).toBe(2);
    expect(score(st(snap), 0).cards).toBe(1 + 2);
  });

  it('Beam From A Thorium Asteroid: 3 heat and 3 energy production', () => {
    let snap = clean();
    me(snap).played = ['057'];
    me(snap).hand = ['058'];
    snap = act(snap, 0, { type: 'play', card: '058' });
    expect(me(snap).prod).toMatchObject({ heat: 3, energy: 3 });
    expect(score(st(snap), 0).cards).toBe(2);
  });

  it('Natural Preserve: isolated special tile, 1 M€ production; no isolated area means it cannot be played', () => {
    let snap = clean();
    st(snap).tiles['33'] = { kind: 'greenery', owner: 1 };
    me(snap).hand = ['044'];
    snap = act(snap, 0, { type: 'play', card: '044' });
    const opts = prompt(snap)!.options as string[];
    expect(opts).not.toContain('33');
    expect(opts).not.toContain('34');
    expect(reject(snap, 0, { type: 'respond', space: '34' })).toBe('BAD_SPACE');
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(st(snap).tiles['05']).toEqual({ kind: 'special', owner: 0, card: '044' });
    expect(me(snap).prod.mc).toBe(1);
    expect(score(st(snap), 0).cards).toBe(1);

    const full = clean();
    for (let i = 3; i <= 63; i += 2) st(full).tiles[String(i).padStart(2, '0')] = { kind: 'greenery', owner: 1 };
    st(full).players[0]!.hand = ['044'];
    expect(legalSpaces(st(full), 0, 'isolated')).toEqual([]);
    refused(full, { type: 'play', card: '044' }, 'NO_SPACE');
  });

  it('Lake Marineris: 2 oceans with TR; only the remaining one near the cap', () => {
    let snap = clean();
    st(snap).temperature = 0;
    me(snap).hand = ['053'];
    snap = act(snap, 0, { type: 'play', card: '053' });
    snap = act(snap, 0, { type: 'respond', space: '07' });
    snap = act(snap, 0, { type: 'respond', space: '13' });
    expect(st(snap).oceans).toBe(2);
    expect(me(snap).tr).toBe(22);
    expect(score(st(snap), 0).cards).toBe(2);

    let late = clean();
    Object.assign(st(late), { temperature: 0, oceans: 8 });
    st(late).players[0]!.hand = ['053'];
    late = act(late, 0, { type: 'play', card: '053' });
    late = act(late, 0, { type: 'respond', space: '07' });
    expect(st(late).oceans).toBe(9);
    expect(st(late).queue).toHaveLength(0);
  });

  it('Mangrove: greenery on an ocean area raises oxygen and pays the area bonus', () => {
    let snap = clean();
    st(snap).temperature = 4;
    me(snap).hand = ['059'];
    snap = act(snap, 0, { type: 'play', card: '059' });
    expect(reject(snap, 0, { type: 'respond', space: '05' })).toBe('BAD_SPACE');
    snap = act(snap, 0, { type: 'respond', space: '04' });
    expect(st(snap).tiles['04']).toMatchObject({ kind: 'greenery', owner: 0 });
    expect(st(snap).oxygen).toBe(1);
    expect(st(snap).oceans).toBe(0);
    expect(me(snap).tr).toBe(21);
    expect(me(snap).res.steel).toBe(2);
    expect(score(st(snap), 0).cards).toBe(1);
  });

  it('Great Escarpment Consortium: own steel production +1 and any player loses 1', () => {
    let snap = clean();
    me(snap).prod.steel = 1;
    st(snap).players[1]!.prod.steel = 2;
    me(snap).hand = ['061'];
    snap = act(snap, 0, { type: 'play', card: '061' });
    expect(prompt(snap)).toMatchObject({ kind: 'player', options: [0, 1], optional: false });
    expect(reject(snap, 0, { type: 'respond', skip: true })).toBe('NOT_OPTIONAL');
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(me(snap).prod.steel).toBe(2);
    expect(st(snap).players[1]!.prod.steel).toBe(1);
  });

  it('Mineral Deposit and Mining Expedition', () => {
    let snap = clean();
    st(snap).players[1]!.res.plants = 5;
    me(snap).hand = ['062', '063'];
    snap = act(snap, 0, { type: 'play', card: '062' });
    expect(me(snap).res.steel).toBe(5);
    snap = act(snap, 0, { type: 'play', card: '063' });
    expect(st(snap).oxygen).toBe(1);
    expect(me(snap).tr).toBe(21);
    expect(me(snap).res.steel).toBe(7);
    expect(prompt(snap)).toMatchObject({ kind: 'player', options: [1], optional: true });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.res.plants).toBe(3);
    expect(st(snap).players[0]!.res.plants).toBe(0);
  });

  it('Mining Rights: steel or titanium area, production of that resource', () => {
    let snap = clean();
    me(snap).hand = ['067'];
    snap = act(snap, 0, { type: 'play', card: '067' });
    const opts = prompt(snap)!.options as string[];
    expect(opts.sort()).toEqual(['03', '09', '20', '21', '53', '58', '59', '60']);
    expect(reject(snap, 0, { type: 'respond', space: '05' })).toBe('BAD_SPACE');
    snap = act(snap, 0, { type: 'respond', space: '58' });
    expect(st(snap).tiles['58']).toEqual({ kind: 'special', owner: 0, card: '067' });
    expect(me(snap).prod).toMatchObject({ titanium: 1, steel: 0 });
    expect(me(snap).res.titanium).toBe(1);

    let steel = clean();
    st(steel).players[0]!.hand = ['067'];
    steel = act(steel, 0, { type: 'play', card: '067' });
    steel = act(steel, 0, { type: 'respond', space: '03' });
    expect(me(steel).prod).toMatchObject({ titanium: 0, steel: 1 });
    expect(me(steel).res.steel).toBe(2);
    // An opponent's later tile placement does not trigger it again.
    st(again(steel)).current = 1;
    steel = act(steel, 1, { type: 'project', project: 'greenery' });
    steel = act(steel, 1, { type: 'respond', space: '60' });
    expect(me(steel).prod.steel).toBe(1);
  });

  it('Mining Area: needs an own adjacent tile on a steel/titanium area', () => {
    const none = clean();
    st(none).players[0]!.hand = ['064'];
    refused(none, { type: 'play', card: '064' }, 'NO_SPACE');

    let snap = clean();
    st(snap).tiles['53'] = { kind: 'greenery', owner: 0 };
    st(snap).tiles['57'] = { kind: 'greenery', owner: 0 };
    st(snap).tiles['54'] = { kind: 'greenery', owner: 1 };
    me(snap).hand = ['064'];
    snap = act(snap, 0, { type: 'play', card: '064' });
    expect((prompt(snap)!.options as string[]).sort()).toEqual(['58', '59']);
    snap = act(snap, 0, { type: 'respond', space: '58' });
    expect(me(snap).prod.titanium).toBe(1);
    expect(st(snap).tiles['58']).toMatchObject({ kind: 'special', card: '064' });
  });

  it('Land Claim: reserves an area that only the claimer may use', () => {
    let snap = clean();
    me(snap).hand = ['066'];
    snap = act(snap, 0, { type: 'play', card: '066' });
    expect(reject(snap, 0, { type: 'respond', space: '04' })).toBe('BAD_SPACE');
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(st(snap).claims['05']).toBe(0);
    expect(st(snap).tiles['05']).toBeUndefined();
    expect(legalSpaces(st(snap), 1, 'land')).not.toContain('05');
    expect(legalSpaces(st(snap), 0, 'land')).toContain('05');
  });

  it('Earth Catapult: cards cost 2 M€ less; Advanced Alloys: steel 3, titanium 4', () => {
    let snap = clean(2, 30);
    me(snap).hand = ['070', '071', '003', '040'];
    snap = act(snap, 0, { type: 'play', card: '070' });
    expect(me(snap).res.mc).toBe(7);
    expect(hints(snap, 0).find((h) => h.type === 'play' && h.card === '071')).toMatchObject({ cost: 7 });
    snap = act(snap, 0, { type: 'play', card: '071' });
    expect(me(snap).res.mc).toBe(0);
    again(snap);
    Object.assign(me(snap).res, { mc: 1, steel: 4, titanium: 7 });
    expect(reject(snap, 0, { type: 'play', card: '003', pay: { mc: 1, steel: 3 } })).toBe('BAD_PAYMENT'); // 1 + 9 < 11
    snap = act(snap, 0, { type: 'play', card: '003', pay: { steel: 4 } });
    expect(me(snap).res.steel).toBe(0); // 13 − 2 = 11 ≤ 4 × 3
    snap = act(snap, 0, { type: 'play', card: '040', pay: { titanium: 7 } }); // 30 − 2 = 28 ≤ 7 × 4
    expect(me(snap).res.titanium).toBe(0);
    expect(score(st(snap), 0).cards).toBe(2 + 2);
  });

  it('Electro Catapult: spend a plant or a steel for 7 M€ once per generation', () => {
    let snap = clean();
    me(snap).prod.energy = 1;
    me(snap).hand = ['069'];
    snap = act(snap, 0, { type: 'play', card: '069' });
    expect(me(snap).prod.energy).toBe(0);
    expect(score(st(snap), 0).cards).toBe(1);
    again(snap);
    refused(snap, { type: 'cardAction', card: '069' }, 'CANNOT_USE');
    me(snap).res.plants = 1;
    const mc = me(snap).res.mc;
    snap = act(snap, 0, { type: 'cardAction', card: '069' });
    expect(me(snap).res).toMatchObject({ plants: 0, mc: mc + 7 });
    me(snap).res.plants = 1;
    again(snap);
    expect(reject(snap, 0, { type: 'cardAction', card: '069' })).toBe('ACTION_USED');

    again(snap);
    me(snap).used = [];
    me(snap).res.steel = 2;
    snap = act(snap, 0, { type: 'cardAction', card: '069' });
    expect(prompt(snap)).toMatchObject({ kind: 'choice', options: [0, 1] });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(me(snap).res).toMatchObject({ plants: 1, steel: 1, mc: mc + 14 });
  });

  it('Tardigrades: action adds a microbe; 1 VP per 4', () => {
    let snap = clean();
    me(snap).hand = ['049'];
    snap = act(snap, 0, { type: 'play', card: '049' });
    snap = act(snap, 0, { type: 'cardAction', card: '049' });
    again(snap);
    expect(me(snap).cardRes['049']).toBe(1);
    expect(reject(snap, 0, { type: 'cardAction', card: '049' })).toBe('ACTION_USED');
    me(snap).cardRes['049'] = 7;
    expect(score(st(snap), 0).cards).toBe(1);
    me(snap).cardRes['049'] = 8;
    expect(score(st(snap), 0).cards).toBe(2);
  });

  it('Small Animals and Birds: mandatory plant production loss, animal action, VP', () => {
    let snap = clean();
    st(snap).oxygen = 13;
    st(snap).players[1]!.prod.plants = 2;
    me(snap).prod.plants = 1;
    me(snap).hand = ['054', '072'];
    snap = act(snap, 0, { type: 'play', card: '054' });
    expect(prompt(snap)).toMatchObject({ kind: 'player', options: [0, 1] });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.prod.plants).toBe(1);
    st(snap).players[1]!.prod.plants = 2;
    snap = act(snap, 0, { type: 'play', card: '072' });
    expect(prompt(snap)).toMatchObject({ kind: 'player', options: [1] }); // seat 0 has only 1 plant production
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.prod.plants).toBe(0);
    again(snap);
    snap = act(snap, 0, { type: 'cardAction', card: '054' });
    snap = act(snap, 0, { type: 'cardAction', card: '072' });
    expect(me(snap).cardRes).toMatchObject({ '054': 1, '072': 1 });
    again(snap);
    expect(reject(snap, 0, { type: 'cardAction', card: '072' })).toBe('ACTION_USED');
    me(snap).cardRes = { '054': 5, '072': 3 };
    expect(score(st(snap), 0).cards).toBe(2 + 3);

    const none = clean();
    st(none).oxygen = 13;
    st(none).players[1]!.prod.plants = 1;
    st(none).players[0]!.hand = ['072'];
    refused(none, { type: 'play', card: '072' }, 'NO_TARGET');
    st(none).players[1]!.prod.plants = 0;
    st(none).players[0]!.hand = ['054'];
    refused(none, { type: 'play', card: '054' }, 'NO_TARGET');
  });

  it('Virus: choose animals or plants; only options with a target; protection respected', () => {
    let snap = clean();
    const opp = st(snap).players[1]!;
    opp.played = ['054']; opp.cardRes = { '054': 3 }; opp.res.plants = 7;
    me(snap).hand = ['050'];
    snap = act(snap, 0, { type: 'play', card: '050' });
    expect(prompt(snap)).toMatchObject({ kind: 'choice', options: [0, 1] });
    snap = act(snap, 0, { type: 'respond', index: 0 });
    expect(prompt(snap)).toMatchObject({ kind: 'card', options: ['054'], optional: true });
    snap = act(snap, 0, { type: 'respond', card: '054' });
    expect(st(snap).players[1]!.cardRes['054']).toBe(1);

    let plants = clean();
    st(plants).players[1]!.res.plants = 7;
    st(plants).players[0]!.hand = ['050'];
    plants = act(plants, 0, { type: 'play', card: '050' });
    expect(prompt(plants)).toMatchObject({ kind: 'player', options: [1], optional: true });
    plants = act(plants, 0, { type: 'respond', seat: 1 });
    expect(st(plants).players[1]!.res.plants).toBe(2);

    let own = clean();
    st(own).players[0]!.played = ['072'];
    st(own).players[0]!.cardRes = { '072': 2 };
    st(own).players[0]!.hand = ['050'];
    own = act(own, 0, { type: 'play', card: '050' });
    expect(prompt(own)).toMatchObject({ kind: 'card', options: ['072'] }); // any card, own included
    own = act(own, 0, { type: 'respond', skip: true });
    expect(me(own).cardRes['072']).toBe(2);

    let empty = clean();
    st(empty).players[0]!.hand = ['050'];
    empty = act(empty, 0, { type: 'play', card: '050' });
    expect(st(empty).queue).toHaveLength(0);
    expect(st(empty).players[0]!.played).toContain('050');

    // Protected Habitats-style protection and Pets-style cards are skipped.
    const saved = { ...CARD['048']! };
    const savedBirds = { ...CARD['072']! };
    try {
      CARD['048'] = { ...saved, protects: true };
      CARD['072'] = { ...savedBirds, keepsResources: true };
      let prot = clean();
      const o = st(prot).players[1]!;
      o.played = ['048', '054']; o.cardRes = { '054': 2 }; o.res.plants = 5;
      st(prot).players[0]!.played = ['072'];
      st(prot).players[0]!.cardRes = { '072': 2 };
      st(prot).players[0]!.hand = ['050'];
      prot = act(prot, 0, { type: 'play', card: '050' });
      expect(st(prot).queue).toHaveLength(0);
    } finally {
      CARD['048'] = saved;
      CARD['072'] = savedBirds;
    }
  });
});
