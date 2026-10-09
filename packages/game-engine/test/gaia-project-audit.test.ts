// Regression tests for the independent rules audit of Gaia Project (federation grouping, Ivits growing federation,
// end-game power burning).
import { describe, expect, it } from 'vitest';
import { fedPlan, gaiaProjectModule, joinFederation, minePlan, suggestFederations, type GaiaState } from '@bg/game-gaia-project';
import { applyAction, projectFor, startGame, type EngineSnapshot } from '../src/index.ts';

const m = gaiaProjectModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as GaiaState;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const legal = (snap: EngineSnapshot, seat: number) => projectFor(m, snap, p(seat)).legalActions;
const actor = (snap: EngineSnapshot) => gaiaProjectModule.pendingSeats(st(snap))[0]!;
function ready(factions: string[], seed = 1): EngineSnapshot {
  let snap = startGame(m, { playerCount: factions.length, seed, options: {} }).snapshot;
  for (let guard = 0; guard < 60 && st(snap).phase !== 'actions'; guard++) {
    const seat = actor(snap);
    if (st(snap).phase === 'faction') snap = act(snap, seat, { type: 'faction', faction: factions[seat] });
    else snap = act(snap, seat, legal(snap, seat).find((a) => a.type !== 'resign'));
  }
  return snap;
}
const turnOf = (snap: EngineSnapshot, seat: number) => { st(snap).current = seat; st(snap).pending = []; return snap; };
const emptyBoard = (s: GaiaState) => s.hexes.forEach((h) => { h.owner = null; h.building = null; h.extra = null; h.sats = []; h.feds = []; });
const d = (s: GaiaState, a: number, b: number) => {
  const x = s.hexes[a]!, y = s.hexes[b]!;
  return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2;
};
const near = (s: GaiaState, i: number) => s.hexes.flatMap((_, j) => (d(s, i, j) === 1 ? [j] : []));

/** Planet A, empty space E next to A, planet B next to E (distance 2 from A), planet C next to B only. */
function chain(s: GaiaState) {
  for (let a = 0; a < s.hexes.length; a++) {
    if (s.hexes[a]!.planet === 'e') continue;
    for (const e of near(s, a)) {
      if (s.hexes[e]!.planet !== 'e') continue;
      for (const b of near(s, e)) {
        if (b === a || s.hexes[b]!.planet === 'e' || d(s, a, b) !== 2) continue;
        // C may be any hex (structures are placed directly), as long as it touches only B of the chain.
        const c = near(s, b).find((x) => x !== e && d(s, x, a) > 1 && d(s, x, e) > 1);
        if (c !== undefined) return { A: a, E: e, B: b, C: c };
      }
    }
  }
  throw new Error('no chain');
}

describe('gaia-project audit: federations include every connected own structure', () => {
  it('a manual federation that omits an adjacent own structure still contains it (value and marking)', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    let s = st(snap);
    emptyBoard(s);
    const { A, E, B, C } = chain(s);
    Object.assign(s.hexes[A]!, { owner: 0, building: 'pi' });
    Object.assign(s.hexes[B]!, { owner: 0, building: 'lab' });
    Object.assign(s.hexes[C]!, { owner: 0, building: 'lab' });
    s.pl[0]!.power = { b1: 3, b2: 0, b3: 0, gaia: 0, brain: null };
    // 3 + 2 = 5 on the named hexes, but C (2) touches B and belongs to the federation: 7.
    expect(fedPlan(s, 0, [A, E, B])).toMatchObject({ value: 7, sats: [E] });
    const token = Object.keys(s.fedSupply).find((k) => s.fedSupply[k]! > 0)!;
    snap = act(snap, 0, { type: 'federation', hexes: [A, E, B], token });
    s = st(snap);
    expect([A, E, B, C].every((i) => s.hexes[i]!.feds.includes(0))).toBe(true);
    expect(s.hexes[C]!.feds).toEqual([0]);
    expect(s.pl[0]!.satellites).toBe(1);
  });

  it('a structure built next to a federation brings its connected own structures with it', () => {
    const s = st(ready(['geodens', 'firaks']));
    emptyBoard(s);
    const { A, E, B, C } = chain(s);
    s.hexes[A]!.feds = [0];
    Object.assign(s.hexes[A]!, { owner: 0, building: 'pi' });
    Object.assign(s.hexes[C]!, { owner: 0, building: 'mine' }); // touches B only
    Object.assign(s.hexes[E]!, { owner: 0, building: 'station' }); // E touches A and B
    Object.assign(s.hexes[B]!, { owner: 0, building: 'mine' });
    joinFederation(s, 0, E);
    expect([E, B, C].every((i) => s.hexes[i]!.feds.includes(0))).toBe(true);
  });
});

describe('gaia-project audit: Ivits growing federation', () => {
  it('claims the next token once the grown federation reaches 7 × (tokens + 1), without new hexes', () => {
    let snap = ready(['ivits', 'xenos']);
    const seat = st(snap).pl.findIndex((pl) => pl.faction === 'ivits');
    snap = turnOf(snap, seat);
    const s = st(snap);
    emptyBoard(s);
    const X = s.hexes.findIndex((_, i) => near(s, i).length === 6);
    const group = [X, ...near(s, X)];
    // 7 academies (value 3 each) already in the federation: 21 ≥ 14 for the second token.
    for (const i of group) Object.assign(s.hexes[i]!, { owner: seat, building: 'ac1', feds: [seat] });
    s.pl[seat]!.feds = [{ id: 'fed1', green: false }];
    expect(fedPlan(s, seat, [X])).toMatchObject({ buildings: [], sats: [], value: 21 });
    expect(suggestFederations(s, seat).length).toBe(1);
    const fedActs = legal(snap, seat).filter((a) => a.type === 'federation');
    expect(fedActs.length).toBeGreaterThan(0);
    const next = st(act(snap, seat, fedActs[0]));
    expect(next.pl[seat]!.feds).toHaveLength(2);
    expect(group.every((i) => next.hexes[i]!.feds.filter((f) => f === seat).length === 1)).toBe(true);
    // the third token needs 21: reached exactly, but a fourth (28) is not.
    expect(typeof fedPlan(next, seat, [X])).toBe('object');
    next.pl[seat]!.feds.push({ id: 'fed4', green: true });
    expect(fedPlan(next, seat, [X])).toBe('FEDERATION_INVALID');
  });

  it('other factions still cannot name hexes of an existing federation', () => {
    const s = st(ready(['geodens', 'firaks']));
    emptyBoard(s);
    const { A } = chain(s);
    Object.assign(s.hexes[A]!, { owner: 0, building: 'pi', feds: [0] });
    expect(fedPlan(s, 0, [A])).toBe('FEDERATION_INVALID');
  });
});

describe('gaia-project audit: free terraforming steps must terraform', () => {
  it('power action / booster steps cannot build on a gaia or home-type planet', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    const s = st(snap);
    emptyBoard(s);
    const base = s.hexes.findIndex((h) => h.planet !== 'e');
    Object.assign(s.hexes[base]!, { owner: 0, building: 'mine' });
    s.pl[0]!.research.nav = 5; // range 4: everything nearby is reachable without QIC
    Object.assign(s.pl[0]!, { c: 20, o: 15, q: 5 });
    s.pl[0]!.power = { b1: 0, b2: 0, b3: 8, gaia: 0, brain: null };
    const reach = (ok: (p: string) => boolean) => s.hexes.findIndex((h, i) => i !== base && h.owner === null && ok(h.planet) && d(s, base, i) <= 4);
    const gaia = reach((x) => x === 'g'), home = reach((x) => x === 'v'), oneStep = reach((x) => x === 'o' || x === 'd');
    if (gaia >= 0) {
      expect(minePlan(s, 0, gaia)).not.toBeTypeOf('string');
      expect(minePlan(s, 0, gaia, { freeSteps: 1 })).toBe('ILLEGAL_PLACEMENT');
      expect(legal(snap, 0).some((a) => a.type === 'power' && a.hex === gaia)).toBe(false);
    }
    expect(home).toBeGreaterThanOrEqual(0);
    expect(minePlan(s, 0, home, { freeSteps: 2 })).toBe('ILLEGAL_PLACEMENT');
    expect(oneStep).toBeGreaterThanOrEqual(0);
    expect(minePlan(s, 0, oneStep, { freeSteps: 2 })).toMatchObject({ steps: 1, cost: { c: 2, o: 1 } });
    snap = act(snap, 0, { type: 'power', id: 'pw6', hex: oneStep });
    expect(st(snap).hexes[oneStep]!.owner).toBe(0);
  });
});

describe('gaia-project audit: Firaks downgrade is a build', () => {
  it('neighbours within 2 are offered power after the research step', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 1);
    const s = st(snap);
    emptyBoard(s);
    const { A, B, C } = chain(s);
    Object.assign(s.hexes[A]!, { owner: 1, building: 'pi' });
    Object.assign(s.hexes[B]!, { owner: 1, building: 'lab' });
    Object.assign(s.hexes[C]!, { owner: 0, building: 'mine' }); // Geodens mine next to the lab
    s.pl[0]!.power = { b1: 3, b2: 0, b3: 0, gaia: 0, brain: null };
    snap = act(snap, 1, { type: 'special', id: 'faction:firaks', hex: B });
    expect(st(snap).pending.map((x) => x.kind)).toEqual(['research', 'leech']);
    expect(st(snap).pending[1]).toMatchObject({ seat: 0, amount: 1, from: 1 });
  });
});

describe('gaia-project audit: end-game power burning', () => {
  it('burns all burnable power before converting resources to points', () => {
    let snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    s.round = 6;
    Object.assign(s.pl[0]!, { c: 4, o: 0, k: 0, q: 0 });
    // 4 tokens in bowl II: two burns put 2 tokens in bowl III → (4 + 2) / 3 = 2 points (1 without burning).
    s.pl[0]!.power = { b1: 0, b2: 4, b3: 0, gaia: 0, brain: null };
    for (let g = 0; g < 4 && !st(snap).outcome; g++) { st(snap).pending = []; snap = act(snap, actor(snap), { type: 'pass' }); }
    const t = st(snap);
    const res = t.log.filter((e) => e.t === 'vp' && e.seat === 0 && e.why === 'resources').reduce((a, e) => a + (e as { n: number }).n, 0);
    expect(t.phase).toBe('finished');
    expect(t.pl[0]!.power.b2).toBe(0);
    expect(res).toBe(2);
  });
});
