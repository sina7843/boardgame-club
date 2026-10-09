import { describe, expect, it } from 'vitest';
import {
  ADJ, AWARD_COSTS, AWARDS, CARD, CARDS, MARS, MILESTONE_COST, MILESTONES, PROJECTS, SPACE, awardPoints, legalSpaces, score, terraformingMarsModule, type TmState, type TmView
} from '@bg/game-terraforming-mars';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput } from '../src/index.ts';

const m = terraformingMarsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TmState;
const view = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).view as TmView;
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
const game = (players = 2, seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: players, seed, options }).snapshot;
/** Everyone takes their first offered corporation and no cards; returns the action-phase snapshot. */
function begin(players = 2, seed = 1, options: Record<string, unknown> = {}) {
  let snap = game(players, seed, options);
  for (let k = 0; k < players; k++) snap = act(snap, k, { type: 'corp', corp: st(snap).players[k]!.corpOffer[0], cards: [] });
  return snap;
}
/** A clean action-phase state: corporation-free players with given money, seat 0 to act. */
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
const firstSpace = (snap: EngineSnapshot, seat: number) => {
  const h = hints(snap, seat).find((x) => x.type === 'respond')!;
  return (h.options as string[])[0]!;
};

describe('terraforming-mars: board and setup', () => {
  it('Tharsis has 61 areas, 12 ocean areas and symmetric hex adjacency', () => {
    expect(MARS).toHaveLength(61);
    expect(MARS.filter((x) => x.ocean)).toHaveLength(12);
    for (const a of MARS) for (const b of ADJ[a.id]!) expect(ADJ[b]).toContain(a.id);
    expect(ADJ['03']).toHaveLength(3); // corner
    expect(ADJ['33']).toHaveLength(6); // centre of the middle row
    expect(SPACE['31']!.name).toBe('noctis');
    expect(SPACE['03']!.bonus).toEqual(['steel', 'steel']);
  });

  it.each([2, 3, 4, 5])('setup for %i players: 2 corporations + 10 cards each, TR 20, cold Mars', (n) => {
    const s = st(game(n, 3));
    expect(s.phase).toBe('corp');
    expect(s.temperature).toBe(-30); expect(s.oxygen).toBe(0); expect(s.oceans).toBe(0);
    const corps = s.players.flatMap((x) => x.corpOffer);
    expect(new Set(corps).size).toBe(2 * n);
    for (const pl of s.players) { expect(pl.tr).toBe(20); expect(pl.corpOffer).toHaveLength(2); expect(pl.offer.length).toBeLessThanOrEqual(10); }
    expect(corps).not.toContain('R00');
    expect(() => game(1)).toThrow();
    expect(() => game(6)).toThrow();
  });

  it('without Corporate Era: no CE cards or corporations and everyone starts with 1 production of each resource', () => {
    const s = st(game(5, 4, { corporateEra: false }));
    const all = [...s.deck, ...s.players.flatMap((x) => [...x.offer, ...x.corpOffer])];
    expect(all.some((id) => CARD[id]!.ce)).toBe(false);
    expect(s.players[0]!.prod).toEqual({ mc: 1, steel: 1, titanium: 1, plants: 1, energy: 1, heat: 1 });
    expect(st(game(2, 4)).players[0]!.prod.mc).toBe(0);
  });

  it('corporation choice is simultaneous and secret; cards cost 3 M€ each from the starting money', () => {
    let snap = game(2, 5);
    const s = st(snap);
    s.players[0]!.corpOffer = ['R08', 'R18'];
    const cards = s.players[0]!.offer.slice(0, 3);
    expect(reject(snap, 0, { type: 'corp', corp: 'R30', cards: [] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'corp', corp: 'R08', cards });
    expect(reject(snap, 0, { type: 'corp', corp: 'R08', cards })).toBe('ALREADY_CHOSEN');
    expect(view(snap, 1).players[0]!.corp).toBeNull();
    expect(view(snap, 1).players[0]!.ready).toBe(true);
    expect(JSON.stringify(view(snap, 1))).not.toContain('"R08"');
    expect(terraformingMarsModule.pendingSeats(st(snap))).toEqual([1]);
    snap = act(snap, 1, { type: 'corp', corp: st(snap).players[1]!.corpOffer[1], cards: [] });
    const t = st(snap);
    expect(t.phase).toBe('action');
    expect(t.players[0]!.corp).toBe('R08');
    expect(t.players[0]!.res.mc).toBe(57 - 9);
    expect(t.players[0]!.hand).toEqual(cards);
    expect(t.current).toBe(t.firstPlayer);
  });
});

describe('terraforming-mars: turns, parameters and tiles', () => {
  it('a turn is 1 or 2 actions; pass leaves the generation; production then a new research phase', () => {
    let snap = clean(2);
    const s = st(snap);
    s.players[0]!.prod = { mc: 3, steel: 1, titanium: 0, plants: 2, energy: 2, heat: 1 };
    s.players[0]!.res.energy = 4;
    snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    expect(st(snap).current).toBe(0);
    expect(reject(snap, 1, { type: 'pass' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'endTurn' });
    expect(st(snap).current).toBe(1);
    expect(reject(snap, 1, { type: 'endTurn' })).toBe('NO_ACTION_TAKEN');
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).current).toBe(0); // a lone player keeps taking turns
    snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    expect(st(snap).current).toBe(0);
    expect(st(snap).actionsTaken).toBe(0);
    snap = act(snap, 0, { type: 'pass' });
    const t = st(snap);
    expect(t.generation).toBe(2);
    expect(t.phase).toBe('research');
    expect(t.firstPlayer).toBe(1);
    const me = t.players[0]!;
    expect(me.res.energy).toBe(2 + 3); // energy became heat, then production 2+3 power plants
    expect(me.res.heat).toBe(4 + 1);
    expect(me.res.mc).toBe(100 - 33 + 3 + 20);
    expect(me.res.plants).toBe(2);
    expect(me.offer).toHaveLength(4);
    expect(reject(snap, 0, { type: 'research', cards: [st(snap).players[1]!.offer[0]] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'research', cards: me.offer.slice(0, 2) });
    snap = act(snap, 1, { type: 'research', cards: [] });
    expect(st(snap).phase).toBe('action');
    expect(st(snap).players[0]!.hand).toHaveLength(2);
    expect(st(snap).players[0]!.res.mc).toBe(90 - 6);
    expect(st(snap).current).toBe(1);
  });

  it('temperature bonuses: heat production at −24 and −20, an ocean at 0 °C; oxygen 8 % raises temperature; maxed gives no TR', () => {
    let snap = clean(2);
    snap = act(snap, 0, { type: 'project', project: 'asteroid' });
    snap = act(snap, 0, { type: 'project', project: 'asteroid' });
    expect(st(snap).temperature).toBe(-26);
    expect(st(snap).players[0]!.prod.heat).toBe(0);
    st(snap).temperature = -26;
    snap = act(snap, 1, { type: 'project', project: 'asteroid' });
    expect(st(snap).players[1]!.prod.heat).toBe(1);
    expect(st(snap).players[1]!.tr).toBe(21);
    st(snap).temperature = -2;
    snap = act(snap, 1, { type: 'project', project: 'asteroid' });
    expect(st(snap).temperature).toBe(0);
    expect(st(snap).queue[0]).toMatchObject({ kind: 'space', tile: 'ocean', seat: 1 });
    expect(reject(snap, 1, { type: 'pass' })).toBe('ANSWER_PENDING');
    snap = act(snap, 1, { type: 'respond', space: '06' });
    expect(st(snap).oceans).toBe(1);
    expect(st(snap).players[1]!.tr).toBe(20 + 2 + 1); // 2 temperature steps + the 0 °C ocean
    expect(st(snap).current).toBe(0);
    const s = st(snap);
    s.oxygen = 7; s.players[0]!.res.plants = 8;
    snap = act(snap, 0, { type: 'convertPlants' });
    snap = act(snap, 0, { type: 'respond', space: firstSpace(snap, 0) });
    expect(st(snap).oxygen).toBe(8);
    expect(st(snap).temperature).toBe(2);
    expect(st(snap).players[0]!.tr).toBe(20 + 2 + 2);
    st(snap).temperature = 8;
    st(snap).players[0]!.res.heat = 8;
    expect(reject(snap, 0, { type: 'convertHeat' })).toBe('CANNOT_CONVERT');
    expect(reject(snap, 0, { type: 'project', project: 'asteroid' })).toBe('PARAMETER_MAXED');
  });

  it('placement rules: oceans only on ocean areas, cities apart, greenery next to own tiles, bonuses and ocean adjacency', () => {
    let snap = clean(2);
    const s = st(snap);
    expect(legalSpaces(s, 0, 'ocean').every((id) => SPACE[id]!.ocean)).toBe(true);
    expect(legalSpaces(s, 0, 'city')).not.toContain('31');
    snap = act(snap, 0, { type: 'project', project: 'city' });
    expect(reject(snap, 0, { type: 'respond', space: '04' })).toBe('BAD_SPACE'); // ocean area
    snap = act(snap, 0, { type: 'respond', space: '03' }); // 2 steel bonus
    expect(st(snap).players[0]!.res.steel).toBe(2);
    expect(st(snap).players[0]!.prod.mc).toBe(1);
    expect(legalSpaces(st(snap), 1, 'city')).not.toContain('08'); // next to the city
    snap = act(snap, 0, { type: 'project', project: 'aquifer' });
    snap = act(snap, 0, { type: 'respond', space: '04' }); // ocean next to the city: 2 steel bonus too
    expect(st(snap).players[0]!.res.steel).toBe(4);
    const greenery = legalSpaces(st(snap), 0, 'greenery');
    expect(greenery.every((id) => ADJ[id]!.some((a) => st(snap).tiles[a]?.owner === 0))).toBe(true);
    snap = act(snap, 1, { type: 'project', project: 'greenery' });
    const g = '09';
    expect(legalSpaces(st(snap), 1, 'greenery')).toContain(g);
    const before = st(snap).players[1]!.res.mc;
    snap = act(snap, 1, { type: 'respond', space: g }); // next to ocean 04? no: 09 neighbours 03,04
    expect(st(snap).players[1]!.res.mc).toBe(before + 2);
    expect(st(snap).oxygen).toBe(1);
    expect(score(st(snap), 0).city).toBe(1); // city 03 is next to greenery 09
  });

  it('standard projects: costs, sell patents, Standard project effects', () => {
    let snap = clean(2);
    const s = st(snap);
    s.players[0]!.hand = ['141', '003', '152'];
    snap = act(snap, 0, { type: 'project', project: 'sellPatents', cards: ['141', '003'] });
    expect(st(snap).players[0]!.res.mc).toBe(102);
    expect(st(snap).players[0]!.hand).toEqual(['152']);
    expect(reject(snap, 0, { type: 'project', project: 'sellPatents', cards: ['141'] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    expect(st(snap).players[0]!.res.mc).toBe(91);
    expect(st(snap).players[0]!.prod.energy).toBe(1);
    st(snap).players[1]!.res.mc = 13;
    expect(reject(snap, 1, { type: 'project', project: 'asteroid' })).toBe('CANNOT_AFFORD');
  });
});

describe('terraforming-mars: cards and effects', () => {
  it('requirements, payment with steel/titanium, discounts and tolerance; rejected plays do not mutate', () => {
    let snap = clean(2, 10);
    const s = st(snap);
    s.players[0]!.hand = ['008', '003', '009', '153', '025'];
    expect(reject(snap, 0, { type: 'play', card: '008' })).toBe('REQUIREMENTS_NOT_MET');
    const before = JSON.stringify(st(snap));
    expect(reject(snap, 0, { type: 'play', card: '003' })).toBe('CANNOT_AFFORD');
    expect(JSON.stringify(st(snap))).toBe(before);
    s.players[0]!.res.steel = 2;
    expect(reject(snap, 0, { type: 'play', card: '003', pay: { mc: 10, steel: 1 } })).toBe('BAD_PAYMENT');
    snap = act(snap, 0, { type: 'play', card: '003', pay: { mc: 9, steel: 2 } });
    expect(st(snap).temperature).toBe(-28);
    expect(st(snap).players[0]!.prod.energy).toBe(1);
    st(snap).players[0]!.res.mc = 100;
    snap = act(snap, 0, { type: 'play', card: '025' });
    expect(st(snap).players[0]!.res.mc).toBe(90);
    st(snap).current = 0; st(snap).actionsTaken = 0;
    st(snap).players[0]!.res.titanium = 2;
    snap = act(snap, 0, { type: 'play', card: '009' }); // 14 − 2 = 12 = 2 titanium + 6 M€
    expect(st(snap).players[0]!.res.mc).toBe(84);
    expect(st(snap).players[0]!.res.titanium).toBe(2); // spent 2, gained 2
    st(snap).current = 0; st(snap).actionsTaken = 0;
    st(snap).oceans = 2;
    expect(reject(snap, 0, { type: 'play', card: '008' })).toBe('REQUIREMENTS_NOT_MET');
    snap = act(snap, 0, { type: 'play', card: '153' });
    st(snap).players[0]!.prod.energy = 2; // Capital needs 2 energy production to lower
    snap = act(snap, 0, { type: 'play', card: '008' }); // 4 oceans needed, 2 with tolerance 2
    expect(st(snap).queue[0]).toMatchObject({ kind: 'space', tile: 'city', card: '008' });
    snap = act(snap, 0, { type: 'respond', space: '05' });
    expect(st(snap).tiles['05']).toMatchObject({ kind: 'city', owner: 0, card: '008' });
    expect(st(snap).players[0]!.prod).toMatchObject({ energy: 0, mc: 5 });
    st(snap).tiles['04'] = { kind: 'ocean', owner: null };
    expect(score(st(snap), 0).cards).toBe(1 + 1 + 1); // Space Station 1, Adaptation 1, Capital 1 ocean
  });

  it('prompts: removeAny (optional), anyProd, choice, amount, look-and-keep, card target', () => {
    let snap = clean(3, 100);
    const s = st(snap);
    s.players[1]!.res.plants = 5;
    s.players[2]!.prod.plants = 1;
    s.players[0]!.hand = ['009', '052', '115', '152', '111', '035'];
    snap = act(snap, 0, { type: 'play', card: '009' });
    expect(hints(snap, 0)[0]).toMatchObject({ type: 'respond', kind: 'player', options: [1], optional: true });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.res.plants).toBe(2);
    st(snap).temperature = 2;
    expect(reject(snap, 0, { type: 'play', card: '052' })).toBe('ACCEPTED');
    snap = act(snap, 0, { type: 'play', card: '052' });
    expect(reject(snap, 0, { type: 'respond', seat: 0 })).toBe('BAD_TARGET');
    snap = act(snap, 0, { type: 'respond', seat: 2 });
    expect(st(snap).players[2]!.prod.plants).toBe(0);
    expect(st(snap).current).toBe(1);
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    st(snap).players.forEach((x) => { x.prod.plants = 0; });
    st(snap).players[0]!.hand.push('052');
    st(snap).players[0]!.played = st(snap).players[0]!.played.filter((x) => x !== '052');
    expect(reject(snap, 0, { type: 'play', card: '052' })).toBe('NO_TARGET');
    snap = act(snap, 0, { type: 'play', card: '115' });
    snap = act(snap, 0, { type: 'respond', index: 1 });
    expect(st(snap).players[0]!.prod.energy).toBe(2);
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    st(snap).players[0]!.prod.heat = 3;
    snap = act(snap, 0, { type: 'play', card: '152' });
    expect(reject(snap, 0, { type: 'respond', amount: 4 })).toBe('BAD_AMOUNT');
    snap = act(snap, 0, { type: 'respond', amount: 2 });
    expect(st(snap).players[0]!.prod).toMatchObject({ heat: 1, mc: 2 });
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    st(snap).deck = ['141', '003', '078', '025', '153'];
    const deck = st(snap).deck.slice(0, 4);
    const hand = st(snap).players[0]!.hand.length;
    snap = act(snap, 0, { type: 'play', card: '111' });
    expect(view(snap, 1).prompt).toBeNull();
    expect(view(snap, 1).promptSeat).toBe(0);
    expect(JSON.stringify(view(snap, 1))).not.toContain(`"cards":["${deck[0]}"`);
    expect(reject(snap, 0, { type: 'respond', cards: [deck[0]] })).toBe('BAD_CARDS');
    snap = act(snap, 0, { type: 'respond', cards: [deck[0], deck[3]] });
    expect(st(snap).players[0]!.hand).toHaveLength(hand - 1 + 2);
    expect(st(snap).discard.slice(-2)).toEqual([deck[1], deck[2]]);
  });

  it('card actions once per generation; Ants takes from any card; Water Import pays with titanium; Decomposers and Arctic Algae trigger', () => {
    let snap = clean(2, 100);
    const s = st(snap);
    s.oxygen = 4;
    s.players[0]!.hand = ['131', '035', '012', '023'];
    snap = act(snap, 0, { type: 'play', card: '131' }); // microbe tag: Decomposers gets 1 microbe (including this)
    expect(st(snap).players[0]!.cardRes['131']).toBe(1);
    snap = act(snap, 0, { type: 'play', card: '035' });
    expect(st(snap).players[0]!.cardRes['131']).toBe(2);
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    snap = act(snap, 0, { type: 'cardAction', card: '035' });
    snap = act(snap, 0, { type: 'respond', card: '131' });
    expect(st(snap).players[0]!.cardRes).toMatchObject({ '131': 1, '035': 1 });
    expect(reject(snap, 0, { type: 'cardAction', card: '035' })).toBe('ACTION_USED');
    snap = act(snap, 0, { type: 'play', card: '012' });
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    st(snap).players[0]!.res.titanium = 4;
    st(snap).players[1]!.played = ['023'];
    snap = act(snap, 0, { type: 'cardAction', card: '012', pay: { titanium: 4 } });
    snap = act(snap, 0, { type: 'respond', space: '07' });
    expect(st(snap).players[0]!.res.titanium).toBe(0);
    expect(st(snap).players[1]!.res.plants).toBe(2);
    expect(score(st(snap), 0).cards).toBe(1); // Water Import: 1 jovian; Ants 1 microbe → 0; Decomposers 1 → 0
  });

  it('a card whose tile has no legal area cannot be played', () => {
    const snap = clean(2, 100);
    const s = st(snap);
    s.oceans = 4;
    s.players[0]!.prod.energy = 2;
    s.players[0]!.hand = ['008'];
    for (const sp of MARS) if (!sp.ocean) s.tiles[sp.id] = { kind: 'greenery', owner: 1 };
    expect(reject(snap, 0, { type: 'play', card: '008' })).toBe('NO_SPACE');
  });

  it('Power Grid counts its own power tag', () => {
    let snap = clean(2, 100);
    st(snap).players[0]!.played = ['141'];
    st(snap).players[0]!.hand = ['102'];
    snap = act(snap, 0, { type: 'play', card: '102' });
    expect(st(snap).players[0]!.prod.energy).toBe(2);
  });
});

describe('terraforming-mars: corporations', () => {
  const withCorp = (corp: string, mc = 50) => {
    const snap = clean(2, mc);
    st(snap).players[0]!.corp = corp;
    return snap;
  };

  it('Helion pays with heat, Ecoline greens for 7, PhoboLog titanium is worth 4, Thorgate and Teractor discounts', () => {
    let snap = withCorp('R18', 5);
    st(snap).players[0]!.res.heat = 10;
    snap = act(snap, 0, { type: 'project', project: 'powerPlant', pay: { mc: 5, heat: 6 } });
    expect(st(snap).players[0]!.res).toMatchObject({ mc: 0, heat: 4 });
    snap = withCorp('R17');
    st(snap).players[0]!.res.plants = 7;
    snap = act(snap, 0, { type: 'convertPlants' });
    expect(st(snap).players[0]!.res.plants).toBe(0);
    snap = withCorp('R09', 0);
    st(snap).players[0]!.res.titanium = 4;
    st(snap).players[0]!.hand = ['009'];
    snap = act(snap, 0, { type: 'play', card: '009' });
    expect(st(snap).players[0]!.res.titanium).toBe(0 + 2);
    snap = withCorp('R13', 8);
    snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    expect(st(snap).players[0]!.res.mc).toBe(0);
    snap = withCorp('R30', 4);
    st(snap).players[0]!.hand = ['111'];
    snap = act(snap, 0, { type: 'play', card: '111' });
    expect(st(snap).players[0]!.res.mc).toBe(0);
  });

  it('Tharsis Republic must place a city first and earns from cities; Inventrix draws 3', () => {
    let snap = game(2, 9);
    st(snap).players[0]!.corpOffer = ['R31', 'R43'];
    st(snap).players[1]!.corpOffer = ['R43', 'R08'];
    snap = act(snap, 0, { type: 'corp', corp: 'R31', cards: [] });
    snap = act(snap, 1, { type: 'corp', corp: 'R43', cards: [] });
    Object.assign(st(snap), { current: 0 });
    expect(reject(snap, 0, { type: 'project', project: 'powerPlant' })).toBe('FIRST_ACTION_REQUIRED');
    expect(hints(snap, 0).map((h) => h.type)).toEqual(['firstAction', 'resign']);
    snap = act(snap, 0, { type: 'firstAction' });
    snap = act(snap, 0, { type: 'respond', space: '10' });
    expect(st(snap).players[0]!.prod.mc).toBe(1);
    expect(st(snap).players[0]!.res.mc).toBe(40 + 3);
    snap = act(snap, 0, { type: 'endTurn' });
    snap = act(snap, 1, { type: 'firstAction' });
    expect(st(snap).players[1]!.hand).toHaveLength(3);
  });

  it('UNMI action needs a TR raise this generation; CrediCor refunds 4 on 20+; Interplanetary Cinematics +2 per event; Mining Guild steel bonus; Saturn Systems jovian', () => {
    let snap = withCorp('R32', 50);
    expect(reject(snap, 0, { type: 'cardAction', card: 'R32' })).toBe('CANNOT_USE');
    snap = act(snap, 0, { type: 'project', project: 'asteroid' });
    snap = act(snap, 0, { type: 'cardAction', card: 'R32' });
    expect(st(snap).players[0]!.tr).toBe(22);
    snap = withCorp('R08', 30);
    snap = act(snap, 0, { type: 'project', project: 'greenery' });
    expect(st(snap).players[0]!.res.mc).toBe(30 - 23 + 4);
    snap = withCorp('R19', 30);
    st(snap).players[0]!.hand = ['078'];
    snap = act(snap, 0, { type: 'play', card: '078' });
    expect(st(snap).players[0]!.res.mc).toBe(30 - 23 + 2);
    snap = withCorp('R24', 30);
    snap = act(snap, 0, { type: 'project', project: 'city' });
    snap = act(snap, 0, { type: 'respond', space: '03' });
    expect(st(snap).players[0]!.prod.steel).toBe(1);
    snap = withCorp('R03', 30);
    st(snap).players[1]!.hand = ['012'];
    Object.assign(st(snap), { current: 1 });
    snap = act(snap, 1, { type: 'play', card: '012' });
    expect(st(snap).players[0]!.prod.mc).toBe(1);
  });
});

describe('terraforming-mars: milestones, awards and the end', () => {
  it('milestones cost 8 (max 3); awards cost 8/14/20 (max 3) and score 5/2 with ties', () => {
    let snap = clean(3, 100);
    const s = st(snap);
    s.players[0]!.tr = 35;
    expect(reject(snap, 1, { type: 'milestone', id: 'terraformer' })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'milestone', id: 'mayor' })).toBe('MILESTONE_NOT_REACHED');
    snap = act(snap, 0, { type: 'milestone', id: 'terraformer' });
    expect(st(snap).players[0]!.res.mc).toBe(92);
    snap = act(snap, 0, { type: 'award', id: 'banker' });
    snap = act(snap, 1, { type: 'award', id: 'thermalist' });
    expect(st(snap).players[1]!.res.mc).toBe(86);
    expect(reject(snap, 1, { type: 'award', id: 'thermalist' })).toBe('AWARD_TAKEN');
    snap = act(snap, 1, { type: 'award', id: 'miner' });
    expect(st(snap).players[1]!.res.mc).toBe(66);
    expect(reject(snap, 2, { type: 'award', id: 'scientist' })).toBe('AWARD_TAKEN');
    const t = st(snap);
    t.players[0]!.res.heat = 5; t.players[1]!.res.heat = 3; t.players[2]!.res.heat = 3;
    expect(awardPoints(t, 'thermalist')).toEqual([5, 2, 2]);
    t.players[1]!.res.heat = 5;
    expect(awardPoints(t, 'thermalist')).toEqual([5, 5, 0]);
    t.playerCount = 2; t.players.pop();
    t.players[1]!.res.heat = 4;
    expect(awardPoints(t, 'thermalist')).toEqual([5, 0]);
    expect(score(t, 0)).toMatchObject({ tr: 35, milestones: 5 });
  });

  it('when all parameters are maxed the generation ends with a final greenery round, then most points win (M€ breaks ties)', () => {
    let snap = clean(2, 10);
    const s = st(snap);
    Object.assign(s, { temperature: 8, oxygen: 14, oceans: 9 });
    s.players[0]!.res.plants = 8;
    s.players[1]!.res.mc = 11;
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).phase).toBe('final');
    expect(st(snap).current).toBe(0);
    expect(hints(snap, 0).map((h) => h.type)).toEqual(['convertPlants', 'pass', 'resign']);
    snap = act(snap, 0, { type: 'convertPlants' });
    snap = act(snap, 0, { type: 'respond', space: firstSpace(snap, 0) });
    const t = st(snap);
    expect(t.oxygen).toBe(14);
    expect(t.outcome?.reason).toBe('score');
    expect(t.outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 21 });
    expect(terraformingMarsModule.pendingSeats(t)).toEqual([]);
    // tie on points: more M€ wins; equal M€ shares the place
    let tie = clean(2, 10);
    Object.assign(st(tie), { temperature: 8, oxygen: 14, oceans: 9 });
    tie = act(tie, 0, { type: 'pass' });
    tie = act(tie, 1, { type: 'pass' });
    expect(st(tie).outcome?.placements.map((x) => x.place)).toEqual([1, 1]);
  });

  it('timeouts: corporation, research and action phases; resign puts the resigner last', () => {
    let snap = game(3, 2);
    snap = act(snap, 0, { type: 'corp', corp: st(snap).players[0]!.corpOffer[1], cards: [] });
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).phase).toBe('action');
    expect(st(snap).players[1]!.corp).toBe(st(game(3, 2)).players[1]!.corpOffer[0]);
    expect(st(snap).timeouts).toEqual([0, 1, 1]);
    const cur = st(snap).current;
    st(snap).players.forEach((x) => { x.firstActionDone = true; });
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).players[cur]!.passed).toBe(true);
    // a pending prompt is answered with its first option before passing
    let q = clean(2, 100);
    q = act(q, 0, { type: 'project', project: 'city' });
    q = applyTimeout(m, q, 0).snapshot;
    expect(Object.values(st(q).tiles)).toHaveLength(1);
    expect(st(q).players[0]!.passed).toBe(true);
    const r = act(begin(3, 4), 1, { type: 'resign' });
    expect(st(r).outcome?.reason).toBe('resign');
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 1, place: 3 });
    expect(reject(r, 0, { type: 'pass' })).toBe('GAME_FINISHED');
  });

  it('projection hides hands, offers, deck order and other prompts from opponents and spectators', () => {
    const snap = game(3, 6);
    const s = st(snap);
    const other = view(snap, 1);
    const spec = projectFor(m, snap, { kind: 'spectator' }).view as TmView;
    const secret = [...s.players[0]!.offer, ...s.players[0]!.corpOffer];
    for (const v of [other, spec]) {
      const json = JSON.stringify(v);
      for (const id of secret) expect(json).not.toContain(`"${id}"`);
      expect(v.deck).toBe(s.deck.length);
      expect(json).not.toContain('"rng"');
    }
    expect(spec.me).toBeNull();
    expect(view(snap, 0).me!.offer).toEqual(s.players[0]!.offer);
    expect(projectFor(m, snap, { kind: 'spectator' }).legalActions).toEqual([]);
    expect(hints(snap, 1).map((h) => h.type)).toEqual(['corp', 'resign']);
  });

  it('draft: 4 cards, pick one and pass, the last card is taken automatically', () => {
    let snap = begin(3, 8, { draft: true });
    const s = st(snap);
    s.players.forEach((x) => { x.firstActionDone = true; });
    for (let k = 0; k < 3; k++) snap = act(snap, st(snap).current, { type: 'pass' });
    expect(st(snap).phase).toBe('draft');
    const packs = st(snap).players.map((x) => x.pack.slice());
    for (let round = 0; round < 3; round++) for (let k = 0; k < 3; k++) snap = act(snap, k, { type: 'draft', card: st(snap).players[k]!.pack[0] });
    const t = st(snap);
    expect(t.phase).toBe('research');
    expect(t.players.map((x) => x.offer.length)).toEqual([4, 4, 4]);
    expect(t.players[0]!.offer[0]).toBe(packs[0]![0]); // own first pick
    // generation 2 passes to the next seat: seat 0's second pick comes from seat 2's pack
    expect(packs[2]).toContain(t.players[0]!.offer[1]);
  });
});

/** Simple test policy: terraform when possible, otherwise play/act randomly, else pass. */
function botAction(snap: EngineSnapshot, seat: number, rng: { nextInt(n: number): number }): unknown {
  const hs = hints(snap, seat).filter((h) => h.type !== 'resign');
  const v = view(snap, seat);
  const h0 = hs[0]!;
  if (h0.type === 'corp') {
    const cards = (h0.cards as string[]).filter(() => rng.nextInt(4) === 0).slice(0, 3);
    return { type: 'corp', corp: (h0.corps as string[])[rng.nextInt(2)], cards };
  }
  if (h0.type === 'draft') { const c = h0.cards as string[]; return { type: 'draft', card: c[rng.nextInt(c.length)] }; }
  if (h0.type === 'research') return { type: 'research', cards: (h0.cards as string[]).slice(0, Math.min(h0.max as number, rng.nextInt(3))) };
  if (h0.type === 'respond') {
    const q = v.prompt!;
    if (q.optional && rng.nextInt(3) === 0) return { type: 'respond', skip: true };
    const o = h0.options as (string | number)[];
    const pick = o[rng.nextInt(o.length)];
    switch (q.kind) {
      case 'space': return { type: 'respond', space: pick };
      case 'player': return { type: 'respond', seat: pick };
      case 'card': return { type: 'respond', card: pick };
      case 'choice': return { type: 'respond', index: pick };
      case 'cards': return { type: 'respond', cards: q.cards.slice(0, q.min) };
      case 'amount': return { type: 'respond', amount: q.min + rng.nextInt(q.max - q.min + 1) };
    }
  }
  const prefer = hs.filter((h) => h.type === 'convertHeat' || h.type === 'convertPlants' || (h.type === 'project' && ['asteroid', 'aquifer', 'greenery'].includes(h.project as string)));
  const other = hs.filter((h) => ['play', 'cardAction', 'milestone', 'award'].includes(h.type) || (h.type === 'project' && h.project !== 'sellPatents'));
  const pool = prefer.length && rng.nextInt(3) ? prefer : other.length && rng.nextInt(4) ? other : hs.filter((h) => h.type === 'pass' || h.type === 'endTurn' || h.type === 'firstAction' || h.type === 'convertPlants');
  const h = pool[rng.nextInt(pool.length)] ?? hs.find((x) => x.type === 'pass')!;
  if (h.type === 'play') return { type: 'play', card: h.card };
  if (h.type === 'cardAction') return { type: 'cardAction', card: h.card };
  if (h.type === 'project') return { type: 'project', project: h.project };
  if (h.type === 'milestone' || h.type === 'award') return { type: h.type, id: h.id };
  return { type: h.type };
}

describe('terraforming-mars: random games', () => {
  it('seeded random games terminate with a valid outcome and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 101 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: 500 + g, options: { draft: g % 3 === 0, corporateEra: g % 5 !== 4 } };
      let snap = startGame(m, setup).snapshot;
      const inputs: ReplayInput[] = [];
      let n = 0;
      for (; n < 20000 && !st(snap).outcome; n++) {
        const seat = terraformingMarsModule.pendingSeats(st(snap))[0]!;
        if (rng.nextInt(400) === 0) {
          snap = applyTimeout(m, snap, n).snapshot;
          inputs.push({ kind: 'timeout', logicalTime: n });
          continue;
        }
        const action = botAction(snap, seat, rng);
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: n });
      }
      const s = st(snap);
      expect(s.outcome, `game ${g} after ${n} steps, generation ${s.generation}`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(players);
      expect(s.temperature).toBe(8);
      expect(s.oxygen).toBe(14);
      expect(s.oceans).toBe(9);
      expect(Object.values(s.tiles).filter((t) => t.kind === 'ocean')).toHaveLength(9);
      if (g % 3 === 0) expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 300_000);

  it('every registered card has a unique id, Persian name and text; ids are official numbers', () => {
    for (const c of CARDS) {
      expect(c.id).toMatch(c.kind === 'corporation' ? /^R\d\d$/ : /^\d{3}$/);
      expect(c.nameFa.length).toBeGreaterThan(0);
      expect(c.textFa.length).toBeGreaterThan(0);
    }
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe('terraforming-mars: content registry is the complete base game', () => {
  it('all 208 numbered project cards exactly once, 71 of them Corporate Era', () => {
    const projects = CARDS.filter((c) => c.kind !== 'corporation');
    const want = Array.from({ length: 208 }, (_, i) => String(i + 1).padStart(3, '0'));
    expect(projects.map((c) => c.id).sort()).toEqual(want);
    expect(projects.filter((c) => c.ce)).toHaveLength(71);
    for (const c of projects) expect(['automated', 'active', 'event']).toContain(c.kind);
  });

  it('all base corporations (CE: Saturn Systems, Teractor) plus the Beginner Corporation', () => {
    const corps = CARDS.filter((c) => c.kind === 'corporation');
    expect(corps.map((c) => c.name).sort()).toEqual([
      'Beginner Corporation', 'CrediCor', 'Ecoline', 'Helion', 'Interplanetary Cinematics', 'Inventrix', 'Mining Guild', 'PhoboLog',
      'Saturn Systems', 'Teractor', 'Tharsis Republic', 'Thorgate', 'United Nations Mars Initiative'
    ]);
    expect(corps.filter((c) => c.ce).map((c) => c.name).sort()).toEqual(['Saturn Systems', 'Teractor']);
  });

  it('Tharsis milestones and awards, and the six standard projects', () => {
    expect(MILESTONES.map((x) => x.name)).toEqual(['Terraformer', 'Mayor', 'Gardener', 'Builder', 'Planner']);
    expect(MILESTONES.map((x) => x.need)).toEqual([35, 3, 3, 8, 16]);
    expect(AWARDS.map((x) => x.name)).toEqual(['Landlord', 'Banker', 'Scientist', 'Thermalist', 'Miner']);
    expect(MILESTONE_COST).toBe(8);
    expect(AWARD_COSTS).toEqual([8, 14, 20]);
    expect(PROJECTS).toEqual({ sellPatents: 0, powerPlant: 11, asteroid: 14, aquifer: 18, greenery: 23, city: 25 });
  });
});

describe('terraforming-mars: closed engine gaps', () => {
  it('Helion pays research and Inventors\' Guild / Business Network purchases with heat', () => {
    let snap = clean(2, 2);
    const s = st(snap);
    s.players[0]!.corp = 'R18';
    s.players[0]!.res.heat = 5;
    s.players[0]!.played = ['006'];
    s.deck = ['141', '003', '009', '025', ...s.deck];
    snap = act(snap, 0, { type: 'cardAction', card: '006' });
    expect(view(snap, 0).prompt).toMatchObject({ kind: 'cards', max: 1 });
    snap = act(snap, 0, { type: 'respond', cards: ['141'] });
    expect(st(snap).players[0]!.res).toMatchObject({ mc: 0, heat: 4 });
    expect(st(snap).players[0]!.hand).toEqual(['141']);
    st(snap).players[0]!.res.heat = 6;
    st(snap).players[0]!.res.mc = 0;
    st(snap).players[0]!.prod.mc = -5; st(snap).players[0]!.tr = 5; // production leaves exactly 0 M€
    snap = act(snap, 0, { type: 'pass' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).phase).toBe('research');
    const offer = st(snap).players[0]!.offer;
    expect(hints(snap, 0)[0]).toMatchObject({ type: 'research', max: 2 });
    expect(reject(snap, 0, { type: 'research', cards: offer.slice(0, 3) })).toBe('CANNOT_AFFORD');
    snap = act(snap, 0, { type: 'research', cards: offer.slice(0, 2) });
    snap = act(snap, 1, { type: 'research', cards: [] });
    expect(st(snap).players[0]!.res.heat).toBe(0);
  });

  it('Mars University keeps offering after a skipped discard (Research has 2 science tags)', () => {
    let snap = clean(2, 100);
    const s = st(snap);
    s.players[0]!.played = ['073'];
    s.players[0]!.hand = ['090', '141', '003'];
    snap = act(snap, 0, { type: 'play', card: '090' });
    expect(view(snap, 0).prompt).toMatchObject({ kind: 'card', optional: true });
    snap = act(snap, 0, { type: 'respond', skip: true });
    expect(view(snap, 0).prompt).toMatchObject({ kind: 'card', optional: true });
    const n = st(snap).players[0]!.hand.length;
    snap = act(snap, 0, { type: 'respond', card: '141' });
    expect(st(snap).players[0]!.hand).not.toContain('141');
    expect(st(snap).players[0]!.hand).toHaveLength(n);
    expect(st(snap).queue).toHaveLength(0);
  });

  it('"decrease any production" counts the card\'s own production: Energy Tapping can target yourself', () => {
    const snap = clean(2, 100);
    st(snap).players[0]!.hand = ['201'];
    expect(reject(snap, 0, { type: 'play', card: '201' })).toBe('ACCEPTED');
    const s2 = act(snap, 0, { type: 'play', card: '201' });
    expect(view(s2, 0).prompt).toMatchObject({ kind: 'player', options: [0] });
    st(snap).players[0]!.hand = ['052'];
    st(snap).temperature = 2;
    expect(reject(snap, 0, { type: 'play', card: '052' })).toBe('NO_TARGET'); // Fish: no plant production anywhere
  });

  it('Robotic Workforce copies Mining Rights production from its placed tile', () => {
    let snap = clean(2, 100);
    const s = st(snap);
    s.players[0]!.hand = ['067', '086'];
    snap = act(snap, 0, { type: 'play', card: '067' });
    const sp = (hints(snap, 0)[0]!.options as string[]).find((id) => SPACE[id]!.bonus.includes('titanium'))!;
    snap = act(snap, 0, { type: 'respond', space: sp });
    expect(st(snap).players[0]!.prod.titanium).toBe(1);
    Object.assign(st(snap), { current: 0, actionsTaken: 0 });
    snap = act(snap, 0, { type: 'play', card: '086' });
    snap = act(snap, 0, { type: 'respond', card: '067' });
    expect(st(snap).players[0]!.prod.titanium).toBe(2);
  });

  it('Robotic Workforce copying Heat Trappers also decreases any heat production 2 steps (and needs a target)', () => {
    let snap = clean(2, 100);
    const s = st(snap);
    s.players[0]!.played = ['178'];
    s.players[0]!.hand = ['086'];
    // Nobody has 2 heat production: Heat Trappers' box cannot be copied, so Robotic Workforce has no target.
    expect(reject(snap, 0, { type: 'play', card: '086' })).toBe('CANNOT_PLAY');
    s.players[1]!.prod.heat = 3;
    snap = act(snap, 0, { type: 'play', card: '086' });
    snap = act(snap, 0, { type: 'respond', card: '178' });
    expect(st(snap).players[0]!.prod.energy).toBe(1);
    expect(view(snap, 0).prompt).toMatchObject({ kind: 'player', options: [1] });
    snap = act(snap, 0, { type: 'respond', seat: 1 });
    expect(st(snap).players[1]!.prod.heat).toBe(1);
  });

  it('the public log keeps at most the last 30 entries, standard projects included', () => {
    let snap = clean(2, 1000);
    for (let i = 0; i < 40; i++) {
      Object.assign(st(snap), { current: 0, actionsTaken: 0 });
      snap = act(snap, 0, { type: 'project', project: 'powerPlant' });
    }
    expect(st(snap).log).toHaveLength(30);
    expect(st(snap).log.at(-1)).toMatchObject({ kind: 'project', detail: 'powerPlant' });
  });

  it('Search For Life cannot be used when deck and discard are both empty', () => {
    const snap = clean(2, 100);
    st(snap).players[0]!.played = ['005'];
    st(snap).deck = []; st(snap).discard = [];
    expect(reject(snap, 0, { type: 'cardAction', card: '005' })).toBe('CANNOT_USE');
  });
});

describe('terraforming-mars: redaction in play', () => {
  it('hands, draft packs, research offers and private prompts stay with their owner', () => {
    let snap = begin(3, 11, { draft: true });
    const s = st(snap);
    s.players.forEach((x) => { x.firstActionDone = true; });
    s.players[0]!.hand = ['141', '003'];
    s.players[0]!.played = ['006'];
    Object.assign(s, { current: 0, actionsTaken: 0 });
    const top = s.deck[0]!;
    snap = act(snap, 0, { type: 'cardAction', card: '006' });
    for (const v of [view(snap, 1), projectFor(m, snap, { kind: 'spectator' }).view as TmView]) {
      const json = JSON.stringify(v);
      expect(json).not.toContain('"141"');
      expect(json).not.toContain(`"${top}"`);
      expect(v.prompt).toBeNull();
      expect(v.promptSeat).toBe(0);
      expect(v.players[0]!.hand).toBe(2);
    }
    expect(view(snap, 0).prompt).toMatchObject({ kind: 'cards', cards: [top] });
    snap = act(snap, 0, { type: 'respond', cards: [] });
    for (let k = 0; k < 3; k++) snap = act(snap, st(snap).current, { type: 'pass' });
    expect(st(snap).phase).toBe('draft');
    const pack = st(snap).players[2]!.pack;
    const json = JSON.stringify(view(snap, 0));
    for (const id of pack) expect(json).not.toContain(`"${id}"`);
    expect(view(snap, 2).me!.pack).toEqual(pack);
    expect(json).not.toContain('timeouts');
  });
});

describe('terraforming-mars: tutorial', () => {
  it('the scripted teaching game ends with the learner winning 39 to 34', () => {
    const tu = terraformingMarsModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    expect(tu.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    expect(terraformingMarsModule.pendingSeats(st(snap))).toEqual([0]);
    for (const step of tu.steps) {
      expect(st(snap).outcome).toBeNull();
      expect(terraformingMarsModule.pendingSeats(st(snap))).toEqual([0]);
      snap = act(snap, 0, step.expected);
      if (step.reply) {
        expect(terraformingMarsModule.pendingSeats(st(snap))).toContain(1);
        snap = act(snap, 1, step.reply);
      }
    }
    const s = st(snap);
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 39 }, { seat: 1, place: 2, score: 34 }] });
    expect(score(s, 0)).toMatchObject({ tr: 28, milestones: 5, greenery: 3, city: 3, cards: 0 });
    expect(score(s, 1)).toMatchObject({ tr: 30, greenery: 1, city: 1, cards: 2 });
    expect(s.temperature).toBe(8); expect(s.oxygen).toBe(14); expect(s.oceans).toBe(9);
  });

  it('the teaching option only applies to tutorial tables; normal setup ignores unknown options', () => {
    expect(st(game(2, 1, {})).phase).toBe('corp');
    expect(st(game(3, 1, { deal: 'tutorial' })).phase).toBe('corp');
  });
});

describe('terraforming-mars: plain terraforming through hints only (mirrors the API / e2e policy)', () => {
  it('first corporation, no cards, parameter projects and conversions finish a 2-player game', () => {
    for (const seed of [3, 4]) {
      let snap = game(2, seed);
      let n = 0;
      for (; n < 3000 && !st(snap).outcome; n++) {
        const seat = terraformingMarsModule.pendingSeats(st(snap))[0]!;
        const hs = hints(snap, seat);
        const h = (t: string) => hs.find((a) => a.type === t);
        let a: unknown;
        if (h('corp')) a = { type: 'corp', corp: (h('corp')!.corps as string[])[0], cards: [] };
        else if (h('research')) a = { type: 'research', cards: [] };
        else if (h('respond')) {
          const r = h('respond')!;
          const q = view(snap, seat).prompt!;
          const o = (r.options as (string | number)[])[0];
          a = r.optional ? { type: 'respond', skip: true }
            : q.kind === 'space' ? { type: 'respond', space: o } : q.kind === 'player' ? { type: 'respond', seat: o } : q.kind === 'card' ? { type: 'respond', card: o }
              : q.kind === 'choice' ? { type: 'respond', index: o } : q.kind === 'cards' ? { type: 'respond', cards: q.cards.slice(0, q.min) } : { type: 'respond', amount: o };
        } else {
          const proj = ['asteroid', 'aquifer', 'greenery'].find((pr) => hs.some((x) => x.type === 'project' && x.project === pr));
          a = h('firstAction') ? { type: 'firstAction' } : h('convertHeat') ? { type: 'convertHeat' } : h('convertPlants') ? { type: 'convertPlants' } : proj ? { type: 'project', project: proj } : { type: 'pass' };
        }
        snap = act(snap, seat, a);
      }
      const s = st(snap);
      expect(s.outcome, `seed ${seed}: ${n} steps, generation ${s.generation}`).not.toBeNull();
      expect(n).toBeLessThan(1500);
      expect(s.outcome!.placements.map((x) => x.score)).toEqual(s.outcome!.placements.map((x) => score(s, x.seat).total));
    }
  });
});
