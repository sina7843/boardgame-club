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
const prompt = (snap: EngineSnapshot, seat = 0) => hints(snap, seat).find((x) => x.type === 'respond');
const options = (snap: EngineSnapshot, seat = 0) => prompt(snap, seat)!.options as (string | number)[];
const P0 = (snap: EngineSnapshot) => st(snap).players[0]!;
const P1 = (snap: EngineSnapshot) => st(snap).players[1]!;
const play = (snap: EngineSnapshot, card: string) => { P0(snap).hand.push(card); return act(mine(snap), 0, { type: 'play', card }); };
const use = (snap: EngineSnapshot, card: string) => act(mine(snap), 0, { type: 'cardAction', card });
const cardsVp = (snap: EngineSnapshot, seat = 0) => score(st(snap), seat).cards;
/** Try a card in hand: rejected (unchanged state) with code. */
const refuse = (snap: EngineSnapshot, card: string) => { mine(snap); if (!P0(snap).hand.includes(card)) P0(snap).hand.push(card); return reject(snap, 0, { type: 'play', card }); };
const OCEAN = MARS.filter((x) => x.ocean).map((x) => x.id);
const LAND = MARS.filter((x) => !x.ocean && !x.offMap && x.id !== '31').map((x) => x.id);

describe('terraforming-mars set4: data', () => {
  it('all 32 cards are defined with official numbers, CE flags and costs', () => {
    const cost: Record<string, number> = {
      107: 8, 108: 23, 109: 6, 110: 4, 112: 7, 113: 11, 114: 11, 116: 15, 117: 11, 118: 16, 119: 2, 120: 10, 121: 1, 122: 4, 123: 4, 124: 1,
      125: 3, 126: 11, 127: 11, 128: 12, 129: 13, 130: 8, 132: 14, 133: 4, 134: 13, 135: 11, 136: 12, 137: 8, 138: 25, 139: 8, 140: 18, 142: 20
    };
    const ce = ['107', '109', '110', '112', '121', '123', '124', '125', '137'];
    for (const [id, c] of Object.entries(cost)) {
      expect(CARD[id], id).toBeDefined();
      expect(CARD[id]!.cost, id).toBe(c);
      expect(!!CARD[id]!.ce, id).toBe(ce.includes(id));
      expect(CARD[id]!.textFa).not.toMatch(/[0-9]/);
    }
    expect(['112', '121', '124', '127', '140'].every((id) => CARD[id]!.kind === 'event')).toBe(true);
  });
});

describe('terraforming-mars set4: production cards', () => {
  it.each([
    ['113', { energy: 1 }, 1], ['117', { energy: 2 }, 0], ['126', { energy: 0, heat: 4 }, 0], ['142', { heat: 4 }, 0]
  ] as const)('%s production and VP', (id, prod, vp) => {
    let snap = clean();
    P0(snap).prod.energy = 1;
    snap = play(snap, id);
    if (prompt(snap)) snap = act(snap, 0, { type: 'respond', space: options(snap)[0] });
    for (const [r, n] of Object.entries(prod)) expect(P0(snap).prod[r as 'mc'], r).toBe(n + (r === 'energy' && id !== '126' ? 1 : 0));
    expect(cardsVp(snap)).toBe(vp);
  });

  it('negative production that cannot be paid is refused without mutation (GHG, Open City, Urbanized, Hackers, Strip Mine, Business Network)', () => {
    const snap = clean();
    st(snap).oxygen = 12;
    st(snap).tiles['20'] = { kind: 'city', owner: 1 }; st(snap).tiles[ADJ['20']![0]!] = { kind: 'city', owner: 1 };
    for (const id of ['126', '108', '120', '125', '138']) expect(refuse(snap, id), id).toBe('PRODUCTION_TOO_LOW');
    P0(snap).prod.mc = -5;
    expect(refuse(snap, '110')).toBe('PRODUCTION_TOO_LOW');
    P0(snap).prod.energy = 1;
    expect(refuse(snap, '138')).toBe('PRODUCTION_TOO_LOW');
  });

  it('Fusion Power needs 2 power tags (events never count) and gives 3 energy production', () => {
    const snap = clean();
    P0(snap).played = ['113'];
    expect(refuse(snap, '132')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).played.push('117');
    const s2 = act(snap, 0, { type: 'play', card: '132' });
    expect(P0(s2).prod.energy).toBe(3);
  });

  it('Great Dam (4 oceans) and Wave Power (3 oceans)', () => {
    let snap = clean();
    st(snap).oceans = 3;
    expect(refuse(snap, '136')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    snap = play(snap, '139');
    expect(P0(snap).prod.energy).toBe(1);
    st(snap).oceans = 2;
    expect(refuse(snap, '139')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oceans = 4;
    snap = play(snap, '136');
    expect(P0(snap).prod.energy).toBe(3);
    expect(cardsVp(snap)).toBe(2);
  });

  it('Farming: temperature 4 °C; 2 M€ prod, 2 plant prod, 2 plants, 2 VP', () => {
    let snap = clean();
    st(snap).temperature = 2;
    expect(refuse(snap, '118')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).temperature = 4;
    snap = play(snap, '118');
    expect(P0(snap).prod).toMatchObject({ mc: 2, plants: 2 });
    expect(P0(snap).res.plants).toBe(2);
    expect(cardsVp(snap)).toBe(2);
  });

  it('Moss: 3 oceans and 1 plant to lose; plant production +1', () => {
    let snap = clean();
    st(snap).oceans = 3;
    expect(refuse(snap, '122')).toBe('NOT_ENOUGH_RESOURCES');
    st(snap).oceans = 2; P0(snap).res.plants = 1;
    expect(refuse(snap, '122')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oceans = 3;
    snap = play(snap, '122');
    expect(P0(snap).res.plants).toBe(0);
    expect(P0(snap).prod.plants).toBe(1);
  });

  it('Strip Mine: production and oxygen +2 with TR', () => {
    let snap = clean();
    P0(snap).prod.energy = 2;
    snap = play(snap, '138');
    expect(P0(snap).prod).toMatchObject({ energy: 0, steel: 2, titanium: 1 });
    expect(st(snap).oxygen).toBe(2);
    expect(P0(snap).tr).toBe(22);
  });

  it('Zeppelins: 5% oxygen; 1 M€ production per city on Mars (all players, not off-map)', () => {
    let snap = clean();
    st(snap).oxygen = 4;
    expect(refuse(snap, '129')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oxygen = 5;
    st(snap).tiles['20'] = { kind: 'city', owner: 1 };
    st(snap).tiles['40'] = { kind: 'city', owner: 0 };
    st(snap).tiles['01'] = { kind: 'city', owner: 0 }; // Ganymede Colony: off Mars
    snap = play(snap, '129');
    expect(P0(snap).prod.mc).toBe(2);
    expect(cardsVp(snap)).toBe(1);
  });

  it('Worms: 4% oxygen; 1 plant production per 2 microbe tags including this', () => {
    let snap = clean();
    st(snap).oxygen = 3;
    expect(refuse(snap, '130')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oxygen = 4;
    snap = play(snap, '130');
    expect(P0(snap).prod.plants).toBe(0);
    P0(snap).played.push('133', '134');
    snap = play(snap, '130');
    expect(P0(snap).prod.plants).toBe(2); // 4 microbe tags
  });

  it('Cartel: 1 M€ production per earth tag including this', () => {
    let snap = clean();
    P0(snap).played = ['109', '112']; // the event's earth tag does not count
    snap = play(snap, '137');
    expect(P0(snap).prod.mc).toBe(2);
  });
});

describe('terraforming-mars set4: VP-only and requirement cards', () => {
  it('Breathing Filters 7% oxygen, 2 VP', () => {
    let snap = clean();
    st(snap).oxygen = 6;
    expect(refuse(snap, '114')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oxygen = 7;
    snap = play(snap, '114');
    expect(cardsVp(snap)).toBe(2);
  });

  it('Dust Seals: at most 3 oceans, 1 VP', () => {
    let snap = clean();
    st(snap).oceans = 4;
    expect(refuse(snap, '119')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oceans = 3;
    snap = play(snap, '119');
    expect(cardsVp(snap)).toBe(1);
  });

  it('Advanced Ecosystems needs a plant, a microbe and an animal tag already in play; 3 VP', () => {
    let snap = clean();
    P0(snap).played = ['118', '130'];
    expect(refuse(snap, '135')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    P0(snap).played.push('128');
    snap = play(snap, '135');
    expect(score(st(snap), 0).cards).toBe(2 + 3 + 1); // Farming 2 + Advanced Ecosystems 3 + Ecological Zone (its plant+animal tags added 2 animals)
  });

  it('Bribed Committee: TR +2, -2 VP', () => {
    const snap = play(clean(), '112');
    expect(P0(snap).tr).toBe(22);
    expect(P0(snap).trRaised).toBe(true);
    expect(cardsVp(snap)).toBe(-2);
  });
});

describe('terraforming-mars set4: events', () => {
  it('Media Archives: 1 M€ per event played by anyone', () => {
    const snap = clean();
    P0(snap).played = ['112']; P1(snap).played = ['121', '127', '113'];
    const s2 = play(snap, '107');
    expect(P0(s2).res.mc).toBe(100 - 8 + 3);
  });

  it('Media Group: +3 M€ after you play an event (not opponents, not non-events)', () => {
    let snap = clean();
    snap = play(snap, '109');
    expect(P0(snap).res.mc).toBe(94);
    snap = play(snap, '113');
    expect(P0(snap).res.mc).toBe(83);
    snap = play(snap, '112');
    expect(P0(snap).res.mc).toBe(83 - 7 + 3);
    st(snap).current = 1; st(snap).actionsTaken = 0;
    P1(snap).hand.push('112');
    snap = act(snap, 1, { type: 'play', card: '112' });
    expect(P0(snap).res.mc).toBe(79);
  });

  it('Sabotage: choose titanium / steel / M€ and an optional target', () => {
    let snap = clean();
    P1(snap).res = { mc: 5, steel: 6, titanium: 2, plants: 0, energy: 0, heat: 0 };
    snap = play(snap, '121');
    expect(prompt(snap)!.kind ?? 'choice').toBeDefined();
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(options(snap)).toEqual([1]);
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).res.steel).toBe(2);
    expect(P0(snap).res.steel).toBe(0);
    snap = play(snap, '121');
    snap = act(snap, 0, { type: 'respond', index: 2 });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).res.mc).toBe(0);
    expect(P0(snap).res.mc).toBe(98);
    snap = play(snap, '121');
    snap = act(snap, 0, { type: 'respond', index: 0 });
    snap = act(snap, 0, { type: 'respond', skip: true });
    expect(P1(snap).res.titanium).toBe(2);
    expect(prompt(snap)).toBeUndefined();
  });

  it('Hired Raiders: steal up to 2 steel or up to 3 M€', () => {
    let snap = clean();
    P1(snap).res = { mc: 2, steel: 5, titanium: 0, plants: 0, energy: 0, heat: 0 };
    snap = play(snap, '124');
    snap = act(snap, 0, { type: 'respond', index: 0 });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).res.steel).toBe(3);
    expect(P0(snap).res.steel).toBe(2);
    snap = play(snap, '124');
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).res.mc).toBe(0);
    expect(P0(snap).res.mc).toBe(100 - 1 - 1 + 2);
  });

  it('Hackers: energy -1, any player M€ -2, own M€ +2, -1 VP', () => {
    let snap = clean();
    expect(refuse(snap, '125')).toBe('PRODUCTION_TOO_LOW');
    P0(snap).hand = [];
    P0(snap).prod.energy = 1;
    for (const pl of st(snap).players) pl.prod.mc = -4;
    expect(refuse(snap, '125')).toBe('ACCEPTED'); // its own +2 M€ production makes the owner a legal target
    P0(snap).hand = [];
    P1(snap).prod.mc = 3;
    snap = play(snap, '125');
    expect(options(snap)).toEqual([0, 1]); // own production already rose to −2, so seat 0 may also be chosen
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(P1(snap).prod.mc).toBe(1);
    expect(P0(snap).prod).toMatchObject({ mc: -2, energy: 0 });
    expect(cardsVp(snap)).toBe(-1);
  });

  it('Subterranean Reservoir: one ocean with TR', () => {
    let snap = play(clean(), '127');
    snap = act(snap, 0, { type: 'respond', space: options(snap)[0] });
    expect(st(snap).oceans).toBe(1);
    expect(P0(snap).tr).toBe(21);
  });

  it('Lava Flows: volcanic areas only, temperature +2; unplayable when all are taken', () => {
    let snap = clean();
    snap = play(snap, '140');
    expect(st(snap).temperature).toBe(-26);
    expect(P0(snap).tr).toBe(22);
    expect([...options(snap)].sort()).toEqual(['09', '14', '21', '29']);
    snap = act(snap, 0, { type: 'respond', space: '14' });
    expect(st(snap).tiles['14']).toMatchObject({ kind: 'special', owner: 0, card: '140' });
    for (const id of ['09', '21', '29']) st(snap).tiles[id] = { kind: 'greenery', owner: 1 };
    expect(refuse(snap, '140')).toBe('NO_SPACE');
  });
});

describe('terraforming-mars set4: tiles', () => {
  it('Open City: 12% oxygen; production, 2 plants, a city, 1 VP', () => {
    let snap = clean();
    P0(snap).prod.energy = 1;
    st(snap).oxygen = 11;
    expect(refuse(snap, '108')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).oxygen = 12;
    snap = play(snap, '108');
    expect(P0(snap).prod).toMatchObject({ energy: 0, mc: 4 });
    const sp = options(snap)[0] as string;
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).tiles[sp]).toMatchObject({ kind: 'city', owner: 0 });
    expect(P0(snap).res.plants).toBeGreaterThanOrEqual(2);
    expect(cardsVp(snap)).toBe(1);
  });

  it('Artificial Lake: -6 °C; ocean on a land area; skipped once 9 oceans are out', () => {
    let snap = clean();
    st(snap).temperature = -8;
    expect(refuse(snap, '116')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).temperature = -6;
    snap = play(snap, '116');
    const opts = options(snap) as string[];
    expect(opts.some((x) => OCEAN.includes(x))).toBe(false);
    expect(opts).toContain(LAND[0]);
    snap = act(snap, 0, { type: 'respond', space: LAND[0] });
    expect(st(snap).tiles[LAND[0]!]).toMatchObject({ kind: 'ocean', owner: null });
    expect(st(snap).oceans).toBe(1);
    expect(P0(snap).tr).toBe(21);
    expect(cardsVp(snap)).toBe(1);
    st(snap).oceans = 9;
    snap = play(snap, '116');
    expect(prompt(snap)).toBeUndefined();
    expect(cardsVp(snap)).toBe(2);
  });

  it('Urbanized Area: city next to at least 2 cities; refused otherwise', () => {
    let snap = clean();
    P0(snap).prod.energy = 1;
    expect(refuse(snap, '120')).toBe('NO_SPACE');
    P0(snap).hand = [];
    // two cities sharing a common neighbour
    const a = '20';
    const b = ADJ[a]!.find((x) => LAND.includes(x) && ADJ[x]!.some((y) => ADJ[a]!.includes(y) && LAND.includes(y)))!;
    st(snap).tiles[a] = { kind: 'city', owner: 1 };
    st(snap).tiles[b] = { kind: 'city', owner: 1 };
    snap = play(snap, '120');
    const opts = options(snap) as string[];
    expect(opts.length).toBeGreaterThan(0);
    for (const sp of opts) expect(ADJ[sp]!.filter((x) => st(snap).tiles[x]?.kind === 'city').length).toBeGreaterThanOrEqual(2);
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(st(snap).tiles[opts[0]!]!.kind).toBe('city');
    expect(P0(snap).prod).toMatchObject({ energy: 0, mc: 2 });
  });

  it('Industrial Center: next to a city; action 7 M€ for 1 steel production', () => {
    let snap = clean();
    expect(refuse(snap, '123')).toBe('NO_SPACE');
    P0(snap).hand = [];
    st(snap).tiles['20'] = { kind: 'city', owner: 1 };
    snap = play(snap, '123');
    const opts = options(snap) as string[];
    for (const sp of opts) expect(ADJ[sp]).toContain('20');
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(st(snap).tiles[opts[0]!]).toMatchObject({ kind: 'special', card: '123' });
    const mc = P0(snap).res.mc;
    snap = use(snap, '123');
    expect(P0(snap).prod.steel).toBe(1);
    expect(P0(snap).res.mc).toBe(mc - 7);
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '123' })).toBe('ACTION_USED');
    P0(snap).used = []; P0(snap).res.mc = 6;
    expect(reject(snap, 0, { type: 'cardAction', card: '123' })).toBe('CANNOT_AFFORD');
  });

  it('Mohole Area: ocean-reserved area only, heat production 4', () => {
    let snap = play(clean(), '142');
    const opts = options(snap) as string[];
    expect([...opts].sort()).toEqual([...OCEAN].sort());
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(st(snap).tiles[opts[0]!]).toMatchObject({ kind: 'special', card: '142' });
    expect(st(snap).oceans).toBe(0);
    expect(P0(snap).prod.heat).toBe(4);
  });

  it('Ecological Zone: needs own greenery, tile next to a greenery, animals per animal/plant tag including its own 2', () => {
    let snap = clean();
    st(snap).tiles['20'] = { kind: 'greenery', owner: 1 };
    expect(refuse(snap, '128')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).tiles['40'] = { kind: 'greenery', owner: 0 };
    snap = play(snap, '128');
    const opts = options(snap) as string[];
    for (const sp of opts) expect(ADJ[sp]!.some((x) => st(snap).tiles[x]?.kind === 'greenery')).toBe(true);
    snap = act(snap, 0, { type: 'respond', space: opts[0] });
    expect(P0(snap).cardRes['128']).toBe(2);
    expect(cardsVp(snap)).toBe(1);
    st(snap).temperature = 4;
    snap = play(snap, '118'); // plant tag
    expect(P0(snap).cardRes['128']).toBe(3);
    snap = play(snap, '113'); // no tag
    expect(P0(snap).cardRes['128']).toBe(3);
    expect(cardsVp(snap)).toBe(1 + 2 + 1);
  });
});

describe('terraforming-mars set4: blue actions', () => {
  it('Business Network: buy the top card for 3 M€ or discard it', () => {
    let snap = play(clean(), '110');
    expect(P0(snap).prod.mc).toBe(-1);
    let top = st(snap).deck[0]!;
    snap = use(snap, '110');
    expect(prompt(snap)).toMatchObject({ kind: 'cards' });
    snap = act(snap, 0, { type: 'respond', cards: [top] });
    expect(P0(snap).hand).toContain(top);
    expect(P0(snap).res.mc).toBe(100 - 4 - 3);
    P0(snap).used = [];
    top = st(snap).deck[0]!;
    snap = use(snap, '110');
    snap = act(snap, 0, { type: 'respond', cards: [] });
    expect(P0(snap).hand).not.toContain(top);
    expect(st(snap).discard).toContain(top);
    // with less than 3 M€ the card cannot be bought
    P0(snap).used = []; P0(snap).res.mc = 2;
    top = st(snap).deck[0]!;
    snap = use(snap, '110');
    expect(reject(snap, 0, { type: 'respond', cards: [top] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'respond', cards: [] });
    expect(st(snap).discard).toContain(top);
    expect(P0(snap).res.mc).toBe(2);
  });

  it('Symbiotic Fungus: -14 °C; needs another microbe card; adds 1 microbe to it', () => {
    let snap = clean();
    st(snap).temperature = -16;
    expect(refuse(snap, '133')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).temperature = -14;
    snap = play(snap, '133');
    expect(reject(mine(snap), 0, { type: 'cardAction', card: '133' })).toBe('CANNOT_USE');
    P0(snap).played.push('035');
    snap = use(snap, '133');
    expect(options(snap)).toEqual(['035']);
    snap = act(snap, 0, { type: 'respond', card: '035' });
    expect(P0(snap).cardRes['035']).toBe(1);
  });

  it('Extreme-Cold Fungus: max -10 °C; 1 plant, or 2 microbes on another card', () => {
    let snap = clean();
    st(snap).temperature = -8;
    expect(refuse(snap, '134')).toBe('REQUIREMENTS_NOT_MET');
    P0(snap).hand = [];
    st(snap).temperature = -10;
    snap = play(snap, '134');
    snap = use(snap, '134');
    expect(P0(snap).res.plants).toBe(1);
    expect(prompt(snap)).toBeUndefined();
    P0(snap).used = []; P0(snap).played.push('035');
    snap = use(snap, '134');
    snap = act(snap, 0, { type: 'respond', index: 1 });
    snap = act(snap, 0, { type: 'respond', card: '035' });
    expect(P0(snap).cardRes['035']).toBe(2);
    P0(snap).used = [];
    snap = use(snap, '134');
    snap = act(snap, 0, { type: 'respond', index: 0 });
    expect(P0(snap).res.plants).toBe(2);
  });
});
