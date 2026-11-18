// Regression tests for the independent rules audit of Gaia Project (federation grouping, Ivits growing federation,
// end-game power burning).
import { describe, expect, it } from 'vitest';
import { fedPlan, fedThreshold, upgradeCost, gaiaPlanets, gaiaProjectModule, joinFederation, minePlan, planetTypes, suggestFederations, type GaiaState } from '@bg/game-gaia-project';
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
// Fresh turn for `seat` (a finished main action holds the turn until `end`, RULES E10).
const turnOf = (snap: EngineSnapshot, seat: number) => { st(snap).current = seat; st(snap).pending = []; st(snap).turnDone = false; return snap; };
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

describe('gaia-project audit: unused free terraforming steps are lost (RULES E15)', () => {
  it('power action / booster steps may build on a gaia or home-type planet; the steps are wasted', () => {
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
      expect(minePlan(s, 0, gaia, { freeSteps: 1 })).toMatchObject({ steps: 0, cost: { c: 2, o: 1, q: 1 } });
      expect(legal(snap, 0).some((a) => a.type === 'power' && a.hex === gaia)).toBe(true);
    }
    expect(home).toBeGreaterThanOrEqual(0);
    expect(minePlan(s, 0, home, { freeSteps: 2 })).toMatchObject({ steps: 0, cost: { c: 2, o: 1 } });
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

describe('gaia-project audit: end-game resources (RULES E12)', () => {
  it('only credits, ore and knowledge score; power and QIC are not converted automatically', () => {
    let snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    s.round = 6;
    Object.assign(s.pl[0]!, { c: 4, o: 1, k: 0, q: 5 });
    // 5 credits/ore → 1 point; 5 QIC and 6 power in bowl III are ignored.
    s.pl[0]!.power = { b1: 0, b2: 4, b3: 6, gaia: 0, brain: null };
    for (let g = 0; g < 4 && !st(snap).outcome; g++) { st(snap).pending = []; snap = act(snap, actor(snap), { type: 'pass' }); }
    const t = st(snap);
    const res = t.log.filter((e) => e.t === 'vp' && e.seat === 0 && e.why === 'resources').reduce((a, e) => a + (e as { n: number }).n, 0);
    expect(t.phase).toBe('finished');
    expect(t.pl[0]!.power.b2).toBe(4);
    expect(res).toBe(1);
  });
});

// ---------------- RULES.md «تفاوت موتور با دفترچه» (handoff v1.7) ----------------

describe('gaia-project RULES E1: advanced tile → one step on any track', () => {
  it('after covering a standard tile the player picks any open track', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    const s = st(snap);
    s.pl[0]!.techs = [{ id: 'std1', covered: false }];
    s.pending = [{ kind: 'cover', seat: 0, adv: 'adv1' }];
    snap = act(snap, 0, { type: 'decide', choice: 'std1' });
    const t = st(snap);
    expect(t.pl[0]!.techs[0]!.covered).toBe(true);
    expect(t.pending[0]).toMatchObject({ kind: 'research', seat: 0, tracks: null });
    const before = t.pl[0]!.research.sci;
    snap = act(snap, 0, { type: 'decide', choice: 'sci' });
    expect(st(snap).pl[0]!.research.sci).toBe(before + 1);
  });
});

describe('gaia-project RULES E2: Lantids shared mines do not count as planet types or gaia planets', () => {
  it('planetTypes / gaiaPlanets skip extra mines', () => {
    const s = st(ready(['lantids', 'geodens']));
    emptyBoard(s);
    const g = s.hexes.findIndex((h) => h.planet === 'g');
    const own = s.hexes.findIndex((h) => h.planet !== 'e' && h.planet !== 'g');
    Object.assign(s.hexes[g]!, { owner: 1, building: 'mine', extra: 0 });
    Object.assign(s.hexes[own]!, { owner: 0, building: 'mine' });
    expect(planetTypes(s, 0)).toBe(1);
    expect(gaiaPlanets(s, 0)).toBe(0);
    expect(gaiaPlanets(s, 1)).toBe(1);
  });
});

describe('gaia-project RULES E3: base turn order', () => {
  it('the first to pass starts the next round, the others follow clockwise', () => {
    let snap = ready(['geodens', 'firaks', 'xenos']);
    st(snap).pl.forEach((pl) => { pl.k = 12; });
    const [o0, o1, o2] = st(snap).order as [number, number, number];
    const research = (seat: number) => { snap = act(snap, seat, legal(snap, seat).find((a) => a.type === 'research')); };
    const pass = (seat: number) => { snap = act(snap, seat, legal(snap, seat).find((a) => a.type === 'pass')); };
    research(o0); pass(o1); research(o2); pass(o0); pass(o2);
    expect(st(snap).round).toBe(2);
    expect(st(snap).order).toEqual([o1, (o1 + 1) % 3, (o1 + 2) % 3]);
  });
});

describe('gaia-project RULES E4: no federation that stays valid without a structure and a satellite', () => {
  it('rejects a redundant structure + satellite, accepts the minimal one', () => {
    const s = st(ready(['geodens', 'firaks']));
    emptyBoard(s);
    const { A, E, B, C } = chain(s);
    s.pl[0]!.power = { b1: 3, b2: 0, b3: 0, gaia: 0, brain: null };
    Object.assign(s.hexes[A]!, { owner: 0, building: 'lab' }); // 2, reached through satellite E
    Object.assign(s.hexes[B]!, { owner: 0, building: 'pi' }); // 3
    Object.assign(s.hexes[C]!, { owner: 0, building: 'lab' }); // 2: B + C = 5, A + E needed
    expect(fedPlan(s, 0, [A, E, B])).toMatchObject({ value: 7 });
    s.hexes[C]!.building = 'ac1'; // B + C = 6: still needs A
    expect(fedPlan(s, 0, [A, E, B])).toMatchObject({ value: 8 });
    s.hexes[A]!.building = 'mine';
    const D = near(s, C).find((x) => x !== B && d(s, x, A) > 2 && d(s, x, E) > 1);
    expect(D).toBeDefined();
    if (D === undefined) return;
    Object.assign(s.hexes[D]!, { owner: 0, building: 'mine' }); // B + C + D = 7 without A and E
    expect(fedPlan(s, 0, [A, E, B])).toBe('FEDERATION_INVALID');
    expect(fedPlan(s, 0, [B])).toMatchObject({ value: 7, sats: [] });
  });
});

describe('gaia-project RULES E5: Ivits threshold ignores the terraforming level-5 token', () => {
  it('7 × (tokens − terra token + 1)', () => {
    const s = st(ready(['ivits', 'geodens']));
    const seat = s.pl.findIndex((pl) => pl.faction === 'ivits');
    s.pl[seat]!.feds = [{ id: 'fed1', green: false }];
    expect(fedThreshold(s, seat)).toBe(14);
    s.pl[seat]!.mark.terraFed = true;
    expect(fedThreshold(s, seat)).toBe(7);
  });
});

describe("gaia-project RULES E8: Lantids on another player's Lost Planet", () => {
  it('Lantids may add a mine; other factions may not', () => {
    const s = st(ready(['lantids', 'geodens']));
    emptyBoard(s);
    const lost = s.hexes.findIndex((h) => h.planet === 'e');
    Object.assign(s.hexes[lost]!, { planet: 'l', owner: 1, building: 'mine' });
    Object.assign(s.hexes[near(s, lost)[0]!]!, { owner: 0, building: 'mine' });
    Object.assign(s.pl[0]!, { c: 10, o: 10, q: 5 });
    expect(minePlan(s, 0, lost)).toMatchObject({ extra: true, steps: 0 });
    expect(minePlan(s, 1, lost)).toBe('ILLEGAL_PLACEMENT');
  });
});

describe('gaia-project RULES E11: satellites on an Ivits space station', () => {
  it('another player may put a satellite on the station hex', () => {
    const s = st(ready(['geodens', 'ivits']));
    emptyBoard(s);
    const { A, E, B, C } = chain(s);
    Object.assign(s.hexes[A]!, { owner: 0, building: 'pi' });
    Object.assign(s.hexes[B]!, { owner: 0, building: 'lab' });
    Object.assign(s.hexes[C]!, { owner: 0, building: 'lab' });
    Object.assign(s.hexes[E]!, { owner: 1, building: 'station' });
    s.pl[0]!.power = { b1: 3, b2: 0, b3: 0, gaia: 0, brain: null };
    expect(fedPlan(s, 0, [A, E, B])).toMatchObject({ value: 7, sats: [E] });
    expect(fedPlan(s, 1, [E])).toBe('FEDERATION_INVALID');
  });
});

describe('gaia-project RULES E7: income order of power charge and tokens', () => {
  it('asks only when the order changes the bowls; the gaia phase waits for the answer', () => {
    let snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    const seat = s.order[0]!;
    // Next income: PI gives 4 charge + 1 token. Bowls 0/0/5 → token first ends in bowl III, charge first leaves it in I.
    const home = s.hexes.findIndex((h) => h.owner === seat && h.building === 'mine');
    s.hexes[home]!.building = 'pi';
    s.pl[seat]!.power = { b1: 0, b2: 0, b3: 5, gaia: 2, brain: null };
    for (let g = 0; g < 4 && st(snap).round === 1; g++) {
      st(snap).pending = [];
      const a = actor(snap);
      snap = act(snap, a, legal(snap, a).find((x) => x.type === 'pass'));
    }
    let t = st(snap);
    expect(t.round).toBe(2);
    const d = t.pending.find((x) => x.kind === 'income' && x.seat === seat);
    expect(d).toMatchObject({ kind: 'income', pw: 4, t: 1 });
    while (st(snap).pending[0]!.seat !== seat || st(snap).pending[0]!.kind !== 'income') {
      const h = st(snap).pending[0]!;
      snap = act(snap, h.seat, { type: 'decide', choice: legal(snap, h.seat).find((x) => x.type === 'decide')!.choice });
    }
    expect(st(snap).pl[seat]!.power.gaia).toBe(2); // gaia phase not run yet
    snap = act(snap, seat, { type: 'decide', choice: 'token-first' });
    t = st(snap);
    // token: 1/0/5, charge 4: 1→II→III (2), nothing left in II: 0/0/6, then gaia tokens return to bowl I: 2/0/6
    expect(t.pl[seat]!.power).toMatchObject({ b1: 2, b2: 0, b3: 6, gaia: 0 });
  });
});

describe('gaia-project RULES E13: the player picks the bowls for Gaia Project tokens', () => {
  it('gaiaform takes tokens from the chosen bowls; a wrong pick is rejected', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    const s = st(snap);
    emptyBoard(s);
    const base = s.hexes.findIndex((h) => h.planet !== 'e' && h.planet !== 'm');
    const close = s.hexes.findIndex((h, i) => h.planet === 'm' && d(s, base, i) <= 1);
    const t = close >= 0 ? close : s.hexes.findIndex((h) => h.planet === 'm');
    Object.assign(s.hexes[base]!, { owner: 0, building: 'mine' });
    Object.assign(s.pl[0]!, { gf: 1, q: 5 });
    s.pl[0]!.research.nav = 5;
    s.pl[0]!.power = { b1: 2, b2: 3, b3: 3, gaia: 0, brain: null };
    const r = applyAction(m, snap, p(0), { type: 'gaiaform', hex: t, from: [3, 3, 0] }, 0);
    expect('ok' in r && r.errorCode).toBe('ILLEGAL_CHOICE'); // only 2 tokens in bowl I
    snap = act(snap, 0, { type: 'gaiaform', hex: t, from: [0, 3, 3] });
    expect(st(snap).pl[0]!.power).toMatchObject({ b1: 2, b2: 0, b3: 0, gaia: 6 });
  });
});

describe('gaia-project RULES E10: free actions after the main action', () => {
  it('the turn stays open for free actions until `end`; a second main action is rejected', () => {
    let snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    const me = s.current, other = 1 - me;
    s.pl[me]!.k = 12;
    snap = act(snap, me, legal(snap, me).find((a) => a.type === 'research'));
    expect(st(snap).current).toBe(me);
    expect(gaiaProjectModule.pendingSeats(st(snap))).toEqual([other]);
    expect(legal(snap, me).map((a) => a.type)).toContain('end');
    expect(legal(snap, me).some((a) => a.type === 'research' || a.type === 'mine')).toBe(false);
    const r = applyAction(m, snap, p(me), { type: 'research', track: 'sci' }, 0); // a second main action
    expect('ok' in r && r.errorCode).toBe('WRONG_PHASE');
    const k = st(snap).pl[me]!.k;
    snap = act(snap, me, { type: 'convert', id: 'k-c' }); // free action after the main action
    expect(st(snap).pl[me]!.k).toBe(k - 1);
    expect(st(snap).current).toBe(me);
    snap = act(snap, me, { type: 'end' });
    expect(st(snap).current).toBe(other);
    expect(gaiaProjectModule.project(st(snap), p(me)).held).toBe(false);
  });

  it('the next player acting ends a held turn (nobody can stall the table)', () => {
    let snap = ready(['geodens', 'firaks']);
    const me = st(snap).current, other = 1 - me;
    st(snap).pl[me]!.k = 12;
    snap = act(snap, me, legal(snap, me).find((a) => a.type === 'research'));
    snap = act(snap, other, legal(snap, other).find((a) => a.type === 'pass'));
    expect(st(snap).pl[other]!.passed).toBe(true);
    expect(st(snap).current).toBe(me);
    expect(st(snap).turnDone).toBe(false);
  });
});

describe('gaia-project RULES E6: Taklons brainstone', () => {
  it('counts as a token for a Gaia Project and goes to the gaia area when the pick takes it', () => {
    let snap = turnOf(ready(['taklons', 'geodens']), 0);
    const s = st(snap);
    const seat = s.pl.findIndex((pl) => pl.faction === 'taklons');
    turnOf(snap, seat);
    emptyBoard(s);
    const base = s.hexes.findIndex((h) => h.planet !== 'e' && h.planet !== 'm');
    const t = s.hexes.findIndex((h, i) => h.planet === 'm' && d(s, base, i) <= 4);
    Object.assign(s.hexes[base]!, { owner: seat, building: 'mine' });
    Object.assign(s.pl[seat]!, { gf: 1, q: 5 });
    s.pl[seat]!.research.nav = 5;
    // 5 plain tokens + the brainstone in bowl II = 6, exactly what gaia level 0 needs.
    s.pl[seat]!.power = { b1: 3, b2: 2, b3: 0, gaia: 0, brain: 2 };
    snap = act(snap, seat, { type: 'gaiaform', hex: t, from: [3, 3, 0] });
    expect(st(snap).pl[seat]!.power).toMatchObject({ b1: 0, b2: 0, gaia: 5, brain: 0 });
  });

  it('the player decides whether a power action spends the brainstone', () => {
    const snap = ready(['taklons', 'geodens']);
    const seat = st(snap).pl.findIndex((pl) => pl.faction === 'taklons');
    turnOf(snap, seat);
    st(snap).pl[seat]!.power = { b1: 0, b2: 0, b3: 4, gaia: 0, brain: 3 };
    const keep = act(snap, seat, { type: 'power', id: 'pw4', brain: false }); // 4 plain tokens
    expect(st(keep).pl[seat]!.power).toMatchObject({ b1: 4, b3: 0, brain: 3 });
    const spend = act(snap, seat, { type: 'power', id: 'pw4', brain: true }); // brainstone (3) + 1 token
    expect(st(spend).pl[seat]!.power).toMatchObject({ b1: 1, b3: 3, brain: 1 });
    st(snap).pl[seat]!.power = { b1: 0, b2: 0, b3: 4, gaia: 0, brain: 1 };
    const r = applyAction(m, snap, p(seat), { type: 'power', id: 'pw4', brain: true }, 0);
    expect('ok' in r && r.errorCode).toBe('ILLEGAL_CHOICE');
  });
});

describe('gaia-project RULES E9: Bescods board', () => {
  it('only the PI and academy spaces are swapped: paths and printed costs stay standard (PI 6c 4o, academy 6c 6o)', () => {
    const s = st(ready(['bescods', 'geodens']));
    const seat = s.pl.findIndex((pl) => pl.faction === 'bescods');
    emptyBoard(s);
    const [a, b] = s.hexes.flatMap((h, i) => (h.planet !== 'e' ? [i] : [])) as [number, number];
    Object.assign(s.hexes[a]!, { owner: seat, building: 'ts' });
    Object.assign(s.hexes[b]!, { owner: seat, building: 'lab' });
    Object.assign(s.pl[seat]!, { c: 20, o: 15 });
    expect(upgradeCost(s, seat, a, 'pi')).toEqual({ c: 6, o: 4 });
    expect(upgradeCost(s, seat, b, 'ac1')).toEqual({ c: 6, o: 6 });
    expect(upgradeCost(s, seat, a, 'ac1')).toBe('ILLEGAL_PLACEMENT');
  });
});
