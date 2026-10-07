import { describe, expect, it } from 'vitest';
// Map geometry is renderer data (not exported by the package); the test checks it matches the rule adjacencies.
import {
  ADJ, BORDER_PAIRS, CARD_COUNT, CONTINENT_OF, STARTING_ARMIES, T, TERRITORY_FA, TERRITORY_IDS, TUTORIAL_PLACE,
  cardKind, income, isSet, riskModule, setValue, territoriesOf,
  type Phase, type RiskState, type RiskView, type TerritoryId
} from '@bg/game-risk';
import { REGIONS, SEA_LANES, WRAP_LANE, touches } from '../../../games/risk/src/geometry.ts';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = riskModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as RiskState;
const view = (s: EngineSnapshot, seat: number | null) =>
  projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as RiskView;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;

function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

/**
 * Mid-game position: territory t belongs to seat t % players with 3 armies unless overridden; `current` in `phase`.
 * The deck holds every card not in a hand (card conservation).
 */
function arrange(o: {
  players?: number; set?: Partial<Record<TerritoryId, [number, number]>>; owner?: (t: number) => number; armies?: number;
  hands?: number[][]; current?: number; phase?: Phase; available?: number; options?: Record<string, unknown>; fixedDice?: number[];
}): EngineSnapshot {
  const players = o.players ?? 3;
  const snap = startGame(m, { playerCount: players, seed: 5, options: o.options ?? {} }).snapshot;
  const s = structuredClone(st(snap));
  s.owner = TERRITORY_IDS.map((_, t) => (o.owner ? o.owner(t) : t % players));
  s.armies = TERRITORY_IDS.map(() => o.armies ?? 3);
  for (const [id, [seat, k]] of Object.entries(o.set ?? {}) as [TerritoryId, [number, number]][]) { s.owner[T[id]] = seat; s.armies[T[id]] = k; }
  s.hands = Array.from({ length: players }, (_, i) => [...(o.hands?.[i] ?? [])]);
  s.deck = Array.from({ length: CARD_COUNT }, (_, c) => c).filter((c) => !s.hands.some((h) => h.includes(c)));
  s.discard = [];
  s.setupLeft = s.setupLeft.map(() => 0);
  s.current = o.current ?? 0;
  s.turn = 4;
  s.phase = o.phase ?? 'attack';
  s.available = o.available ?? 0;
  s.fixedDice = o.fixedDice ?? [];
  return { ...snap, state: s };
}

describe('risk map', () => {
  it('42 territories, 83 symmetric borders, continents 9/4/7/6/12/4, one connected graph, Persian names', () => {
    expect(TERRITORY_IDS).toHaveLength(42);
    expect(BORDER_PAIRS).toHaveLength(83);
    ADJ.forEach((ns, a) => { for (const b of ns) expect(ADJ[b]).toContain(a); expect(ns).not.toContain(a); });
    expect(['na', 'sa', 'eu', 'af', 'as', 'au'].map((c) => CONTINENT_OF.filter((x) => x === c).length)).toEqual([9, 4, 7, 6, 12, 4]);
    const seen = new Set([0]), queue = [0];
    while (queue.length) for (const n of ADJ[queue.shift()!]!) if (!seen.has(n)) { seen.add(n); queue.push(n); }
    expect(seen.size).toBe(42);
    for (const pair of [['alaska', 'kamchatka'], ['brazil', 'northAfrica'], ['greenland', 'iceland'], ['siam', 'indonesia'], ['egypt', 'middleEast']] as const) {
      expect(ADJ[T[pair[0]]]).toContain(T[pair[1]]);
    }
    expect(TERRITORY_IDS.every((id) => TERRITORY_FA[id].length > 1)).toBe(true);
  });

  it('drawn map shows exactly the rule adjacencies: shared land border or a sea lane, nothing else', () => {
    expect(REGIONS.every((r) => r && r.poly.length >= 3)).toBe(true);
    const lanes = new Set([...SEA_LANES.map((l) => `${l.a}-${l.b}`), WRAP_LANE.join('-')]);
    for (let a = 0; a < 42; a++) for (let b = a + 1; b < 42; b++) {
      const adj = ADJ[a]!.includes(b);
      if (touches(a, b)) expect(adj, `${TERRITORY_IDS[a]}–${TERRITORY_IDS[b]} share a border but are not adjacent`).toBe(true);
      else expect(lanes.has(`${a}-${b}`), `${TERRITORY_IDS[a]}–${TERRITORY_IDS[b]}`).toBe(adj);
    }
  });

  it('cards: 14 of each kind + 2 wild; sets; escalating values', () => {
    const kinds = Array.from({ length: CARD_COUNT }, (_, c) => cardKind(c));
    expect(['infantry', 'cavalry', 'artillery', 'wild'].map((k) => kinds.filter((x) => x === k).length)).toEqual([14, 14, 14, 2]);
    expect(isSet([0, 3, 6])).toBe(true); // three infantry
    expect(isSet([0, 1, 2])).toBe(true); // one of each
    expect(isSet([0, 3, 42])).toBe(true); // two + wild
    expect(isSet([0, 3, 1])).toBe(false);
    expect(isSet([0, 0, 3])).toBe(false);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(setValue)).toEqual([4, 6, 8, 10, 12, 15, 20, 25]);
  });
});

describe('risk setup', () => {
  it('random deal with 1 army each, starting armies per player count, deterministic per seed', () => {
    for (const players of [3, 4, 5, 6]) {
      const s = st(startGame(m, { playerCount: players, seed: 9, options: {} }).snapshot);
      const counts = Array.from({ length: players }, (_, seat) => territoriesOf(s, seat));
      expect(counts.reduce((a, b) => a + b, 0)).toBe(42);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
      expect(s.armies.every((k) => k === 1)).toBe(true);
      counts.forEach((c, seat) => expect(c + s.setupLeft[seat]!).toBe(STARTING_ARMIES[players]));
      expect(s).toMatchObject({ phase: 'setup', current: s.first, available: s.setupLeft[s.first] });
    }
    expect(STARTING_ARMIES).toMatchObject({ 3: 35, 4: 30, 5: 25, 6: 20 });
    expect(startGame(m, { playerCount: 4, seed: 3, options: {} })).toEqual(startGame(m, { playerCount: 4, seed: 3, options: {} }));
    expect(st(startGame(m, { playerCount: 4, seed: 3 }).snapshot).owner).not.toEqual(st(startGame(m, { playerCount: 4, seed: 4 }).snapshot).owner);
    expect(() => startGame(m, { playerCount: 2, seed: 1 })).toThrow();
    expect(() => startGame(m, { playerCount: 7, seed: 1 })).toThrow();
  });

  it('each player places all starting armies in one action, then the first player reinforces', () => {
    let snap = startGame(m, { playerCount: 3, seed: 2, options: {} }).snapshot;
    const first = st(snap).first;
    for (let i = 0; i < 3; i++) {
      const s = st(snap), seat = s.current;
      expect(seat).toBe((first + i) % 3);
      const mine = TERRITORY_IDS.filter((_, t) => s.owner[t] === seat);
      const foreign = TERRITORY_IDS.find((_, t) => s.owner[t] !== seat)!;
      expect(reject(snap, (seat + 1) % 3, { type: 'place', armies: { [mine[0]!]: s.available } })).toBe('NOT_YOUR_TURN');
      expect(reject(snap, seat, { type: 'place', armies: { [mine[0]!]: s.available - 1 } })).toBe('WRONG_ARMY_COUNT');
      expect(reject(snap, seat, { type: 'place', armies: { [foreign]: s.available } })).toBe('NOT_YOUR_TERRITORY');
      expect(reject(snap, seat, { type: 'place', armies: { atlantis: s.available } })).toBe('NOT_YOUR_TERRITORY');
      const r = act(snap, seat, { type: 'place', armies: { [mine[0]!]: s.available - 2, [mine[1]!]: 2 } });
      expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
      snap = r.snapshot;
    }
    const s = st(snap);
    expect(s.armies.reduce((a, b) => a + b, 0)).toBe(3 * 35);
    expect(s).toMatchObject({ phase: 'reinforce', current: first, turn: 1, available: income(s, first) });
  });
});

describe('risk reinforcements and cards', () => {
  it('territories / 3 (at least 3) plus complete continents', () => {
    const base = arrange({ owner: (t) => (t < 11 ? 0 : 1 + (t % 2)) });
    expect(income(st(base), 0)).toBe(3 + 5); // 11 territories incl. all of North America (0–8)
    const s = st(arrange({ owner: (t) => (t < 8 ? 0 : 1 + (t % 2)) }));
    expect(income(s, 0)).toBe(3);
    s.owner[T.venezuela] = 0; s.owner[T.peru] = 0; s.owner[T.brazil] = 0; s.owner[T.argentina] = 0;
    expect(income(s, 0)).toBe(4 + 2); // 12 territories + South America
    const asia = st(arrange({ owner: (t) => (CONTINENT_OF[t] === 'as' ? 0 : 1) }));
    expect(income(asia, 0)).toBe(4 + 7);
    expect(income(asia, 1)).toBe(10 + 5 + 2 + 5 + 3 + 2);
  });

  it('trading: escalating values, +2 on an owned pictured territory at most once per turn', () => {
    // Seat 0 owns alaska (card 0) and alberta (card 3); westernUS (card 6) belongs to seat 1.
    let snap = arrange({ phase: 'reinforce', available: 3, hands: [[0, 3, 6, 1, 4, 7]], set: { westernUS: [1, 3], alaska: [0, 3], alberta: [0, 3] } });
    st(snap).trades = 4;
    expect(reject(snap, 0, { type: 'trade', cards: [0, 3, 1] })).toBe('NOT_A_SET');
    expect(reject(snap, 0, { type: 'trade', cards: [0, 3, 9] })).toBe('CARD_NOT_IN_HAND');
    let r = act(snap, 0, { type: 'trade', cards: [6, 3, 0] });
    expect(st(r.snapshot)).toMatchObject({ available: 3 + 12, trades: 5, bonusTaken: true });
    expect(st(r.snapshot).armies[T.alaska]).toBe(5); // lowest owned pictured territory
    expect(st(r.snapshot).discard).toEqual([6, 3, 0]);
    const tradeLog = view(r.snapshot, 2).log.at(-1)!;
    expect(tradeLog).toMatchObject({ t: 'trade', value: 12, bonus: T.alaska });
    snap = r.snapshot;
    st(snap).owner[T.northwestTerritory] = 0; // card 1 pictured and owned, but the bonus was already received
    r = act(snap, 0, { type: 'trade', cards: [1, 4, 7] });
    expect(st(r.snapshot).available).toBe(3 + 12 + 15);
    expect(st(r.snapshot).armies[T.northwestTerritory]).toBe(3);
    expect(view(r.snapshot, 1).nextSetValue).toBe(20);
  });

  it('5+ cards must be traded before placing; fewer is optional', () => {
    const snap = arrange({ phase: 'reinforce', available: 4, hands: [[0, 3, 6, 9, 12]] });
    expect(reject(snap, 0, { type: 'place', armies: { alaska: 4 } })).toBe('MUST_TRADE');
    expect(legal(snap, 0).map((h) => h.type)).not.toContain('place');
    expect(view(snap, 1).mustTrade).toBe(true);
    const r = act(snap, 0, { type: 'trade', cards: [0, 3, 6] });
    expect(legal(r.snapshot, 0).map((h) => h.type)).toContain('place');
    const opt = arrange({ phase: 'reinforce', available: 4, hands: [[0, 3, 6, 9]] });
    expect(legal(opt, 0).filter((h) => h.type === 'trade').length).toBeGreaterThan(0);
    const placed = act(opt, 0, { type: 'place', armies: { alaska: 1, westernUS: 3 } });
    expect(st(placed.snapshot)).toMatchObject({ phase: 'attack', available: 0 });
    expect(st(placed.snapshot).armies[T.westernUS]).toBe(6);
    expect(reject(placed.snapshot, 0, { type: 'trade', cards: [0, 3, 6] })).toBe('WRONG_PHASE');
  });
});

describe('risk battles', () => {
  // brazil (seat 0) attacks northAfrica (seat 1).
  const battle = (attackers: number, defenders: number, dice: number[]) =>
    arrange({ set: { brazil: [0, attackers], northAfrica: [1, defenders] }, fixedDice: dice });

  it('dice limits, adjacency and ownership are enforced', () => {
    const snap = battle(3, 2, []);
    expect(reject(snap, 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 })).toBe('TOO_MANY_DICE');
    expect(reject(snap, 0, { type: 'attack', from: 'brazil', to: 'egypt', dice: 1 })).not.toBe('ACCEPTED');
    st(snap).owner[T.egypt] = 1;
    expect(reject(snap, 0, { type: 'attack', from: 'brazil', to: 'egypt', dice: 1 })).toBe('NOT_ADJACENT');
    st(snap).owner[T.peru] = 0;
    expect(reject(snap, 0, { type: 'attack', from: 'brazil', to: 'peru', dice: 1 })).toBe('NOT_ENEMY');
    st(snap).armies[T.brazil] = 1;
    expect(reject(snap, 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 1 })).toBe('TOO_FEW_ARMIES');
    expect(reject(snap, 1, { type: 'attack', from: 'northAfrica', to: 'brazil', dice: 1 })).toBe('NOT_YOUR_TURN');
  });

  it('highest dice compared pairwise, ties go to the defender; the defender rolls 2 when it can', () => {
    const r = act(battle(5, 4, [3, 3, 1, 3, 2]), 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 });
    // attacker 3,3,1 vs defender 3,2: 3=3 defender wins, 3>2 attacker wins.
    expect(st(r.snapshot).lastBattle).toMatchObject({ att: [3, 3, 1], def: [3, 2], lossA: 1, lossD: 1, conquered: false });
    expect([st(r.snapshot).armies[T.brazil], st(r.snapshot).armies[T.northAfrica]]).toEqual([4, 3]);
    expect(st(r.snapshot).phase).toBe('attack');
    expect(view(r.snapshot, 2).lastBattle).toMatchObject({ att: [3, 3, 1], def: [3, 2] }); // dice are public
    const one = act(battle(5, 1, [2, 2]), 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 1 });
    expect(st(one.snapshot).lastBattle).toMatchObject({ att: [2], def: [2], lossA: 1, lossD: 0 });
  });

  it('conquest: occupy at least the dice rolled, at most all but one; auto-move when only one count is possible', () => {
    const r = act(battle(8, 1, [6, 6, 6, 1]), 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 });
    expect(st(r.snapshot)).toMatchObject({ phase: 'occupy', conquered: true });
    expect(st(r.snapshot).owner[T.northAfrica]).toBe(0);
    expect(view(r.snapshot, 1).occupy).toEqual({ from: T.brazil, to: T.northAfrica, min: 3, max: 7 });
    expect(reject(r.snapshot, 0, { type: 'occupy', armies: 2 })).toBe('WRONG_ARMY_COUNT');
    expect(reject(r.snapshot, 0, { type: 'occupy', armies: 8 })).toBe('WRONG_ARMY_COUNT');
    expect(reject(r.snapshot, 0, { type: 'endAttack' })).toBe('WRONG_PHASE');
    const o = act(r.snapshot, 0, { type: 'occupy', armies: 7 });
    expect([st(o.snapshot).armies[T.brazil], st(o.snapshot).armies[T.northAfrica], st(o.snapshot).phase]).toEqual([1, 7, 'attack']);
    const auto = act(battle(3, 1, [6, 6, 1]), 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 2 });
    expect(st(auto.snapshot).phase).toBe('attack');
    expect([st(auto.snapshot).armies[T.brazil], st(auto.snapshot).armies[T.northAfrica]]).toEqual([1, 2]);
  });

  it('blitz repeats maximum-dice rolls until conquest or one army is left', () => {
    const win = act(battle(10, 3, [6, 6, 6, 1, 1, 6, 6, 6, 1]), 0, { type: 'blitz', from: 'brazil', to: 'northAfrica' });
    expect(st(win.snapshot).lastBattle).toMatchObject({ rounds: 2, lossA: 0, lossD: 3, conquered: true, att: [6, 6, 6], def: [1] });
    expect(view(win.snapshot, 0).occupy).toMatchObject({ min: 3, max: 9 });
    const lose = act(battle(3, 5, Array<number>(20).fill(1)), 0, { type: 'blitz', from: 'brazil', to: 'northAfrica' });
    expect(st(lose.snapshot).armies[T.brazil]).toBe(1);
    expect(st(lose.snapshot).owner[T.northAfrica]).toBe(1);
    expect(st(lose.snapshot).phase).toBe('attack');
  });

  it('eliminating a player takes their cards; with 6+ the conqueror trades down to 4 and places, then attacks on', () => {
    // Seat 2 holds only northAfrica and 4 cards; seat 0 holds 3 cards → 7 cards.
    const snap = arrange({ owner: (t) => (t % 2), set: { brazil: [0, 9], northAfrica: [2, 1] }, hands: [[0, 3, 7], [], [1, 4, 6, 9]], fixedDice: [6, 6, 6, 1] });
    let r = act(snap, 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 });
    expect(st(r.snapshot).status[2]).toBe('out');
    expect(st(r.snapshot).hands[0]).toHaveLength(7);
    expect(view(r.snapshot, 1).log.find((e) => e.t === 'eliminate')).toMatchObject({ seat: 2, by: 0, cards: 4 });
    r = act(r.snapshot, 0, { type: 'occupy', armies: 3 });
    expect(st(r.snapshot)).toMatchObject({ phase: 'reinforce', elimTrade: true, available: 0 });
    expect(reject(r.snapshot, 0, { type: 'endAttack' })).toBe('WRONG_PHASE');
    expect(reject(r.snapshot, 0, { type: 'place', armies: {} })).toBe('MUST_TRADE');
    r = act(r.snapshot, 0, { type: 'trade', cards: [0, 3, 6] }); // 7 → 4 cards
    expect(reject(r.snapshot, 0, { type: 'trade', cards: [1, 4, 7] })).toBe('NO_TRADE_NEEDED');
    expect(st(r.snapshot).available).toBe(4);
    r = act(r.snapshot, 0, { type: 'place', armies: { northAfrica: 4 } });
    expect(st(r.snapshot)).toMatchObject({ phase: 'attack', elimTrade: false });
    expect(st(r.snapshot).leftOrder).toEqual([2]);
  });
});

describe('risk fortify, cards and winning', () => {
  it('fortify through a chain of own territories (or only to a neighbour), leaving one army; ends the turn', () => {
    // Seat 0 holds the Americas chain alaska → … → argentina.
    const owner = (t: number) => (t <= 12 && t !== T.greenland ? 0 : 1 + (t % 2));
    const snap = arrange({ owner, phase: 'fortify', set: { alaska: [0, 6] } });
    expect(reject(snap, 0, { type: 'fortify', from: 'alaska', to: 'argentina', armies: 6 })).toBe('WRONG_ARMY_COUNT');
    expect(reject(snap, 0, { type: 'fortify', from: 'alaska', to: 'iceland', armies: 1 })).toBe('NOT_YOUR_TERRITORY');
    const r = act(snap, 0, { type: 'fortify', from: 'alaska', to: 'argentina', armies: 5 });
    expect([st(r.snapshot).armies[T.alaska], st(r.snapshot).armies[T.argentina]]).toEqual([1, 8]);
    expect(st(r.snapshot)).toMatchObject({ current: 1, phase: 'reinforce' });
    const adj = arrange({ owner, phase: 'fortify', set: { alaska: [0, 6] }, options: { fortify: 'adjacent' } });
    expect(reject(adj, 0, { type: 'fortify', from: 'alaska', to: 'argentina', armies: 1 })).toBe('NOT_CONNECTED');
    expect(reject(adj, 0, { type: 'fortify', from: 'alaska', to: 'alberta', armies: 1 })).toBe('ACCEPTED');
    // A gap in the chain blocks a connected move too.
    const gap = arrange({ owner: (t) => (t === T.centralAmerica ? 1 : owner(t)), phase: 'fortify', set: { alaska: [0, 6] } });
    expect(reject(gap, 0, { type: 'fortify', from: 'alaska', to: 'argentina', armies: 1 })).toBe('NOT_CONNECTED');
  });

  it('a card is earned only after conquering this turn; the discard pile is reshuffled when the deck is empty', () => {
    const quiet = act(arrange({ phase: 'fortify' }), 0, { type: 'endTurn' });
    expect(st(quiet.snapshot).hands[0]).toHaveLength(0);
    const conquered = arrange({ phase: 'fortify' });
    st(conquered).conquered = true;
    const r = act(conquered, 0, { type: 'endTurn' });
    expect(st(r.snapshot).hands[0]).toHaveLength(1);
    expect(st(r.snapshot).deck).toHaveLength(CARD_COUNT - 1);
    expect(view(r.snapshot, 1).log.at(-2)).toMatchObject({ t: 'card', seat: 0 });
    const empty = arrange({ phase: 'fortify' });
    st(empty).conquered = true;
    st(empty).discard = st(empty).deck.splice(0);
    const rs = act(empty, 0, { type: 'endTurn' });
    expect(st(rs.snapshot).deck.length + st(rs.snapshot).discard.length).toBe(CARD_COUNT - 1);
    expect(st(rs.snapshot).discard).toHaveLength(0);
  });

  it('world domination: taking the 42nd territory wins at once', () => {
    const snap = arrange({ owner: (t) => (t === T.northAfrica ? 1 : 0), set: { brazil: [0, 5], northAfrica: [1, 1] }, fixedDice: [6, 6, 6, 1] });
    st(snap).status[2] = 'out'; st(snap).leftOrder = [2];
    const r = act(snap, 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 });
    expect(r.outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1, score: 42 }, { seat: 1, place: 2, score: 0 }, { seat: 2, place: 3, score: 0 }] });
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    expect(st(r.snapshot).armies.every((k) => k >= 1)).toBe(true);
  });

  it('majority goal: 30 territories at the end of your own turn', () => {
    const owner = (t: number) => (t < 30 ? 0 : 1 + (t % 2));
    const world = act(arrange({ owner, phase: 'fortify' }), 0, { type: 'endTurn' });
    expect(world.outcome).toBeNull();
    const maj = arrange({ owner, phase: 'fortify', options: { goal: 'majority' } });
    // The opponent's turn does not count for seat 0.
    expect(act({ ...maj, state: { ...st(maj), current: 1 } }, 1, { type: 'endTurn' }).outcome).toBeNull();
    const r = act(maj, 0, { type: 'endTurn' });
    expect(r.outcome).toMatchObject({ reason: 'win', placements: [{ seat: 0, place: 1, score: 30 }, { seat: 1, place: 2, score: 6 }, { seat: 2, place: 2, score: 6 }] });
  });
});

describe('risk timeouts, resign and redaction', () => {
  it('setup timeout places all armies on the front line and passes on', () => {
    const snap = startGame(m, { playerCount: 3, seed: 2, options: {} }).snapshot;
    const s = st(snap);
    const r = applyTimeout(m, snap, 0);
    const placed = st(r.snapshot).armies.map((k, t) => k - s.armies[t]!);
    expect(placed.filter((k) => k > 0)).toEqual([s.setupLeft[s.current]]);
    expect(st(r.snapshot).owner[placed.findIndex((k) => k > 0)]).toBe(s.current);
    expect(st(r.snapshot).current).toBe((s.current + 1) % 3);
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
  });

  it('reinforce timeout trades if forced, places on the territory facing most enemy armies, and ends the turn', () => {
    const snap = arrange({ phase: 'reinforce', available: 5, hands: [[0, 3, 6, 9, 12]], set: { siam: [0, 3], indonesia: [1, 40], newGuinea: [1, 3] } });
    const r = applyTimeout(m, snap, 0);
    const s = st(r.snapshot);
    expect(s.hands[0]).toHaveLength(2);
    expect(s.armies[T.siam]).toBe(3 + 5 + 4);
    expect(s).toMatchObject({ current: 1, phase: 'reinforce' });
    expect(s.timeouts[0]).toBe(1);
  });

  it('occupy timeout moves the minimum; attack timeout ends the turn (card if something was conquered)', () => {
    const occ = arrange({ set: { brazil: [0, 9], northAfrica: [1, 1] }, fixedDice: [6, 6, 6, 1] });
    const conquered = act(occ, 0, { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 });
    const r = applyTimeout(m, conquered.snapshot, 0);
    expect(st(r.snapshot).armies[T.northAfrica]).toBe(3);
    expect(st(r.snapshot).hands[0]).toHaveLength(1);
    expect(st(r.snapshot).current).toBe(1);
    const att = applyTimeout(m, arrange({}), 0);
    expect(st(att.snapshot)).toMatchObject({ current: 1, phase: 'reinforce' });
    expect(st(att.snapshot).hands[0]).toHaveLength(0);
  });

  it('three timeouts in a row remove the player; their armies stay passive and can be conquered', () => {
    let snap = arrange({ hands: [[0, 3], [], []] });
    for (let i = 0; i < 9 && st(snap).status[0] === 'active'; i++) snap = applyTimeout(m, snap, 0).snapshot;
    const s = st(snap);
    expect(s.status[0]).toBe('abandoned');
    expect(s.hands[0]).toEqual([]);
    expect(territoriesOf(s, 0)).toBe(14);
    expect(s.log.some((e) => e.t === 'left' && e.seat === 0 && e.reason === 'timeout')).toBe(true);
    expect(s.current).not.toBe(0);
    expect(reject(snap, 0, { type: 'endTurn' })).toBe('NOT_IN_GAME');
  });

  it('resign: the turn passes, territories stay; the last active player wins; placements follow who left last', () => {
    let r = act(arrange({ phase: 'reinforce', available: 3 }), 0, { type: 'resign' });
    expect(st(r.snapshot)).toMatchObject({ current: 1, phase: 'reinforce' });
    expect(st(r.snapshot).status).toEqual(['abandoned', 'active', 'active']);
    expect(r.outcome).toBeNull();
    r = act(r.snapshot, 2, { type: 'resign' });
    expect(r.outcome).toEqual({ reason: 'resign', placements: [{ seat: 1, place: 1, score: 14 }, { seat: 2, place: 2, score: 14 }, { seat: 0, place: 3, score: 14 }] });
  });

  it('views never contain other hands, the deck order or the RNG', () => {
    const snap = arrange({ hands: [[0, 5], [10, 20, 43], []] });
    for (const seat of [0, 2, null]) {
      const v = view(snap, seat);
      const json = JSON.stringify(v);
      expect(json).not.toContain('"hands"');
      expect(json).not.toContain('"deck"');
      expect(json).not.toContain('"discard"');
      expect(json).not.toContain('fixedDice');
      expect(json).not.toContain('rng');
      expect(v.handCounts).toEqual([2, 3, 0]);
      expect(v.deckCount).toBe(CARD_COUNT - 5);
    }
    expect(view(snap, 0).myHand).toEqual([0, 5]);
    expect(view(snap, null).myHand).toBeNull();
    expect(legal(snap, 1).map((h) => h.type)).toEqual(['resign']);
    // Drawing a card is logged without the card (only the internal event has it).
    const drawn = arrange({ phase: 'fortify' });
    st(drawn).conquered = true;
    const r = act(drawn, 0, { type: 'endTurn' });
    expect(r.internalEvents).toContainEqual({ type: 'card-drawn', seat: 0, card: st(r.snapshot).hands[0]![0] });
    expect(Object.keys(view(r.snapshot, 1).log.find((e) => e.t === 'card')!).sort()).toEqual(['seat', 'seq', 't']);
  });
});

describe('risk tutorial', () => {
  it('the scripted turn plays to a win', () => {
    let snap = startGame(m, { playerCount: 2, seed: riskModule.tutorial.seed, options: riskModule.tutorial.options }).snapshot;
    expect(st(snap)).toMatchObject({ current: 0, phase: 'reinforce', available: TUTORIAL_PLACE - 4 });
    for (const step of riskModule.tutorial.steps) {
      expect(step.reply).toBeNull();
      snap = act(snap, 0, step.expected).snapshot;
    }
    expect(st(snap).outcome?.placements.find((x) => x.place === 1)?.seat).toBe(0);
    expect(territoriesOf(st(snap), 0)).toBe(30);
  });
});

// ---------- random play ----------

const rnd = (seed: number) => { let x = seed || 1; return (n: number) => { x = (x * 1103515245 + 12345) % 2147483648; return Math.floor((x / 2147483648) * n); }; };
type Hint = { type: string; [k: string]: unknown };

/** A simple bot that only uses its own view and legal actions. */
function choose(v: RiskView, hints: Hint[], r: (n: number) => number): unknown {
  const of = (t: string) => hints.filter((h) => h.type === t);
  const pick = <X>(xs: X[]) => xs[r(xs.length)]!;
  const trades = of('trade');
  if (trades.length && (v.mustTrade || r(2))) return { type: 'trade', cards: pick(trades).cards };
  const place = of('place')[0];
  if (place) {
    // Concentrate on one or two border territories.
    const ids = place.territories as TerritoryId[];
    const border = ids.filter((id) => ADJ[T[id]]!.some((n) => v.owner[n] !== v.current));
    const armies: Record<string, number> = {};
    let left = place.available as number;
    while (left > 0) { const k = r(2) ? left : 1 + r(left); const id = pick(border.length ? border : ids); armies[id] = (armies[id] ?? 0) + k; left -= k; }
    return { type: 'place', armies };
  }
  const occ = of('occupy')[0];
  if (occ) return { type: 'occupy', armies: (occ.min as number) + r((occ.max as number) - (occ.min as number) + 1) };
  const attacks = of('attack').filter((h) => v.armies[T[h.from as TerritoryId]]! >= v.armies[T[h.to as TerritoryId]]!);
  if (attacks.length && r(12)) {
    const a = pick(attacks);
    return r(2) === 0 ? { type: 'blitz', from: a.from, to: a.to } : { type: 'attack', from: a.from, to: a.to, dice: 1 + r(a.maxDice as number) };
  }
  if (of('endAttack').length) return { type: 'endAttack' };
  const forts = of('fortify');
  if (forts.length && r(2)) { const f = pick(forts); return { type: 'fortify', from: f.from, to: pick(f.to as string[]), armies: 1 + r(f.max as number) }; }
  if (of('endTurn').length) return { type: 'endTurn' };
  throw new Error(`bot has nothing to do: ${JSON.stringify(hints)}`);
}

function randomGame(seed: number, players: number, options: Record<string, unknown>): { snap: EngineSnapshot; inputs: ReplayInput[] } {
  const r = rnd(seed);
  let snap = startGame(m, { playerCount: players, seed, options }).snapshot;
  const inputs: ReplayInput[] = [];
  for (let steps = 0; steps < 30000 && !st(snap).outcome; steps++) {
    if (r(300) === 0) { snap = applyTimeout(m, snap, 0).snapshot; inputs.push({ kind: 'timeout', logicalTime: 0 }); }
    else {
      const seat = riskModule.pendingSeats(st(snap))[0]!;
      const action = choose(view(snap, seat), legal(snap, seat), r);
      const res = applyAction(m, snap, p(seat), action, 0);
      if ('ok' in res) throw new Error(`seed ${seed} step ${steps}: ${JSON.stringify(action)} → ${res.errorCode}`);
      snap = res.snapshot;
      inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
    }
    // Invariants: cards conserved, every territory held by a seat still on the map with ≥1 army (the territory being
    // occupied excepted), eliminated seats own nothing.
    const s = st(snap);
    expect(s.deck.length + s.discard.length + s.hands.reduce((a, h) => a + h.length, 0)).toBe(CARD_COUNT);
    s.armies.forEach((k, t) => { if (!(s.phase === 'occupy' && s.occupy?.to === t)) expect(k).toBeGreaterThanOrEqual(1); });
    s.owner.forEach((o) => expect(s.status[o]).not.toBe('out'));
    if (steps % 50 === 0) {
      for (let o = 0; o < players; o++) {
        const json = JSON.stringify(view(snap, o));
        expect(json).not.toContain('"deck"');
        expect(json).not.toContain('"hands"');
      }
    }
  }
  return { snap, inputs };
}

describe('risk random play', () => {
  it('20 random 3–6 player games finish, keep the invariants and replay deterministically', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const players = 3 + (seed % 4);
      const options = seed % 5 === 0 ? { goal: 'world', fortify: seed % 2 ? 'adjacent' : 'connected' } : { goal: 'majority' };
      const { snap, inputs } = randomGame(seed, players, options);
      const s = st(snap);
      expect(s.outcome, `seed ${seed} did not finish`).not.toBeNull();
      const w = s.outcome!.placements.find((x) => x.place === 1)!.seat;
      expect(s.outcome!.placements).toHaveLength(players);
      if (s.outcome!.reason === 'win' && s.status.filter((x) => x === 'active').length > 1) {
        expect(territoriesOf(s, w)).toBeGreaterThanOrEqual(options.goal === 'world' ? 42 : 30);
      }
      if (seed <= 4) expect(replay(m, { playerCount: players, seed, options }, inputs)).toEqual(snap);
    }
  }, 180_000);
});
