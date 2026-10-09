import { describe, expect, it } from 'vitest';
import {
  CONTENT, distanceFrom, fedThreshold, gaiaProjectModule, incomeOf, minePlan, powerValue, qicFor, type GaiaState
} from '@bg/game-gaia-project';
import { applyAction, applyTimeout, projectFor, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = gaiaProjectModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as GaiaState;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const legal = (snap: EngineSnapshot, seat: number) => projectFor(m, snap, p(seat)).legalActions;
const actor = (snap: EngineSnapshot) => gaiaProjectModule.pendingSeats(st(snap))[0]!;

function ready(factions: string[], seed = 1): EngineSnapshot {
  let snap = startGame(m, { playerCount: factions.length, seed, options: {} }).snapshot;
  let i = 0;
  for (let guard = 0; guard < 60 && st(snap).phase !== 'actions'; guard++) {
    const seat = actor(snap);
    if (st(snap).phase === 'faction') snap = act(snap, seat, { type: 'faction', faction: factions[i++] });
    else snap = act(snap, seat, legal(snap, seat).find((a) => a.type !== 'resign'));
  }
  return snap;
}
const turnOf = (snap: EngineSnapshot, seat: number) => { st(snap).current = seat; st(snap).pending = []; return snap; };
const seatOf = (snap: EngineSnapshot, f: string) => st(snap).pl.findIndex((pl) => pl.faction === f);
/** Everyone passes until the next round starts (stops at any open decision). */
function passRound(snap: EngineSnapshot) {
  const r = st(snap).round;
  for (let g = 0; g < 10 && st(snap).round === r && !st(snap).pending.length; g++) {
    snap = act(snap, actor(snap), { type: 'pass', booster: st(snap).boosters[0] });
  }
  return snap;
}

const lcg = (seed: number) => { let x = seed >>> 0; return (n: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; }; };
function playRandom(factions: string[], seed: number) {
  const rnd = lcg(seed * 7919 + factions.length);
  let snap = startGame(m, { playerCount: factions.length, seed, options: {} }).snapshot;
  let i = 0, free = 0;
  for (let step = 0; step < 6000 && !st(snap).outcome; step++) {
    const seat = actor(snap);
    if (st(snap).phase === 'faction') { snap = act(snap, seat, { type: 'faction', faction: factions[i++] }); continue; }
    const all = legal(snap, seat).filter((a) => a.type !== 'resign');
    const main = all.filter((a) => a.type !== 'convert' && a.type !== 'burn' && a.type !== 'pass');
    const passes = all.filter((a) => a.type === 'pass');
    const frees = all.filter((a) => a.type === 'convert' || a.type === 'burn');
    let pick;
    if (frees.length && free < 2 && rnd(10) === 0) { pick = frees[rnd(frees.length)]; free++; }
    else if (main.length && (passes.length === 0 || rnd(8) !== 0)) { pick = main[rnd(main.length)]; free = 0; }
    else { pick = passes[rnd(passes.length)] ?? all[0]; free = 0; }
    snap = act(snap, seat, pick);
  }
  return snap;
}

describe('gaia-project factions-a: Terrans', () => {
  it('start: gaia project 1 (one gaiaformer), bowls 4/4/0, default resources', () => {
    let snap = startGame(m, { playerCount: 2, seed: 1, options: {} }).snapshot;
    const seat = actor(snap);
    snap = act(snap, seat, { type: 'faction', faction: 'terrans' });
    const t = st(snap).pl[seat]!;
    expect(t.research.gaia).toBe(1);
    expect(t.gf).toBe(1);
    expect(t.power).toMatchObject({ b1: 4, b2: 4, b3: 0, gaia: 0 });
    expect(t).toMatchObject({ c: 15, o: 4, k: 3, q: 1 });
  });

  it('gaia phase without PI: tokens return to bowl II, no spending decision', () => {
    let snap = ready(['terrans', 'xenos']);
    const seat = seatOf(snap, 'terrans');
    st(snap).pl[seat]!.power.gaia = 4;
    snap = passRound(snap);
    const t = st(snap).pl[seat]!;
    expect(st(snap).round).toBe(2);
    expect(t.power.gaia).toBe(0);
    expect(st(snap).pending).toHaveLength(0);
    expect(t.mark.terransPw).toBeUndefined();
  });

  it('PI: gaia tokens become a budget spent at power-conversion rates, re-asked until done', () => {
    let snap = ready(['terrans', 'xenos']);
    const seat = seatOf(snap, 'terrans');
    const s = st(snap);
    s.hexes.find((h) => h.owner === seat && h.building === 'mine')!.building = 'pi';
    s.pl[seat]!.power.gaia = 6;
    snap = passRound(snap);
    expect(st(snap).round).toBe(2);
    expect(actor(snap)).toBe(seat);
    let d = projectFor(m, snap, p(seat)).view as { decision: { key: string; options: string[] } };
    expect(d.decision.key).toBe('spend');
    expect(d.decision.options).toEqual(['done', 'q', 'k', 'o', 'c']);
    expect(st(snap).pl[seat]!.power.gaia).toBe(0); // tokens already went to bowl II
    const before = structuredClone(st(snap).pl[seat]!);
    expect(reject(snap, seat, { type: 'decide', choice: 'x' })).toBe('ILLEGAL_CHOICE');
    expect(st(snap).pl[seat]).toEqual(before);
    snap = act(snap, seat, { type: 'decide', choice: 'q' }); // 6 → 2
    expect(st(snap).pl[seat]!.q).toBe(before.q + 1);
    d = projectFor(m, snap, p(seat)).view as typeof d;
    expect(d.decision.options).toEqual(['done', 'c']);
    snap = act(snap, seat, { type: 'decide', choice: 'c' });
    snap = act(snap, seat, { type: 'decide', choice: 'c' }); // budget 0
    expect(st(snap).pl[seat]!.c).toBe(before.c + 2);
    expect(st(snap).pending).toHaveLength(0);
    expect(st(snap).pl[seat]!.mark.terransPw).toBeUndefined();
    expect(st(snap).pl[seat]!.power).toEqual(before.power); // spending the budget never touches the bowls
  });

  it('PI budget: ore costs 3, "done" forfeits the rest; timeout picks done', () => {
    let snap = ready(['terrans', 'xenos']);
    const seat = seatOf(snap, 'terrans');
    st(snap).hexes.find((h) => h.owner === seat && h.building === 'mine')!.building = 'pi';
    st(snap).pl[seat]!.power.gaia = 3;
    snap = passRound(snap);
    const o = st(snap).pl[seat]!.o;
    const r = applyTimeout(m, snap, 0) as StepResult;
    snap = r.snapshot;
    expect(st(snap).pending).toHaveLength(0);
    expect(st(snap).pl[seat]!.o).toBe(o);
    expect(st(snap).pl[seat]!.mark.terransPw).toBeUndefined();
    expect(st(snap).pl[seat]!.timeouts).toBe(1);
  });
});

describe('gaia-project factions-a: Lantids', () => {
  const setupShare = () => {
    const snap = turnOf(ready(['lantids', 'xenos']), 0);
    const seat = seatOf(snap, 'lantids');
    const other = 1 - seat;
    turnOf(snap, seat);
    const s = st(snap);
    const target = s.hexes.findIndex((h) => h.owner === other && h.building === 'mine');
    Object.assign(s.pl[seat]!, { c: 20, o: 10, q: 10 });
    return { snap, seat, other, target };
  };

  it('start: 13 credits, bowls 4/0/0; PI income is 4 charge without a token', () => {
    const { snap, seat } = setupShare();
    let fresh = startGame(m, { playerCount: 2, seed: 1, options: {} }).snapshot;
    const first = actor(fresh);
    fresh = act(fresh, first, { type: 'faction', faction: 'lantids' });
    expect(st(fresh).pl[first]).toMatchObject({ c: 13, o: 4, k: 3, q: 1, power: { b1: 4, b2: 0, b3: 0 } });
    const s = st(snap);
    const base = incomeOf(s, seat);
    s.hexes.find((h) => h.owner === seat && h.building === 'mine')!.building = 'pi';
    const withPi = incomeOf(s, seat);
    expect((withPi.pw ?? 0) - (base.pw ?? 0)).toBe(4);
    expect(withPi.t ?? 0).toBe(base.t ?? 0);
  });

  it('builds on another player\'s planet: no terraforming, 2c + 1o (+QIC), owner may leech, no knowledge without PI', () => {
    const { snap, seat, other, target } = setupShare();
    const s = st(snap);
    const plan = minePlan(s, seat, target);
    expect(typeof plan).toBe('object');
    expect(plan).toMatchObject({ steps: 0, extra: true });
    const q = qicFor(s, seat, target);
    const before = structuredClone(s.pl[seat]!);
    const next = act(snap, seat, { type: 'mine', hex: target });
    const n = st(next);
    expect(n.hexes[target]).toMatchObject({ owner: other, building: 'mine', extra: seat });
    expect(n.pl[seat]!.c).toBe(before.c - 2);
    expect(n.pl[seat]!.o).toBe(before.o - 1);
    expect(n.pl[seat]!.q).toBe(before.q - q);
    expect(n.pl[seat]!.k).toBe(before.k);
    expect(n.pending.some((d) => d.kind === 'leech' && d.seat === other)).toBe(true);
    // a second Lantids mine on the same planet is not possible
    turnOf(next, seat);
    expect(reject(next, seat, { type: 'mine', hex: target })).toBe('CELL_OCCUPIED');
  });

  it('PI: +2 knowledge per mine on another player\'s planet', () => {
    const { snap, seat, target } = setupShare();
    st(snap).hexes.find((h) => h.owner === seat && h.building === 'mine')!.building = 'pi';
    const k = st(snap).pl[seat]!.k;
    const next = act(snap, seat, { type: 'mine', hex: target });
    expect(st(next).pl[seat]!.k).toBe(k + 2);
  });

  it('cannot share a planet holding a gaiaformer; rejection leaves the state unchanged', () => {
    const { snap, seat, other } = setupShare();
    const s = st(snap);
    const gf = s.hexes.findIndex((h) => h.owner === null && h.planet !== 'e');
    Object.assign(s.hexes[gf]!, { planet: 'm', owner: other, building: 'gf' });
    const before = structuredClone(s);
    expect(reject(snap, seat, { type: 'mine', hex: gf })).toBe('CELL_OCCUPIED');
    expect(st(snap)).toEqual(before);
  });

  it('a non-Lantids faction cannot share planets', () => {
    const { snap, seat, other } = setupShare();
    turnOf(snap, other);
    const own = st(snap).hexes.findIndex((h) => h.owner === seat && h.building === 'mine');
    Object.assign(st(snap).pl[other]!, { c: 20, o: 10, q: 10 });
    expect(reject(snap, other, { type: 'mine', hex: own })).toBe('CELL_OCCUPIED');
  });
});

describe('gaia-project factions-a: Ivits', () => {
  const setupIvits = () => {
    const snap = ready(['ivits', 'xenos']);
    const seat = seatOf(snap, 'ivits');
    turnOf(snap, seat);
    return { snap, seat };
  };

  it('set-up: only the PI (placed after every mine), no research, bowls 2/2/0, 1 QIC base income', () => {
    let snap = startGame(m, { playerCount: 2, seed: 4, options: {} }).snapshot;
    const first = actor(snap);
    snap = act(snap, first, { type: 'faction', faction: 'ivits' });
    snap = act(snap, 1 - first, { type: 'faction', faction: 'xenos' });
    const s = st(snap);
    expect(s.setupQueue.at(-1)).toEqual({ seat: first, what: 'pi' });
    expect(s.setupQueue.filter((q) => q.seat === first)).toHaveLength(1);
    const pl = s.pl[first]!;
    expect(pl.power).toMatchObject({ b1: 2, b2: 2, b3: 0 });
    expect(Object.values(pl.research).every((v) => v === 0)).toBe(true);
    expect(pl.q).toBe(1);
    snap = ready(['ivits', 'xenos'], 4);
    const seat = seatOf(snap, 'ivits');
    expect(st(snap).hexes.filter((h) => h.owner === seat).map((h) => h.building)).toEqual(['pi']);
    const inc = incomeOf(st(snap), seat);
    const booster = CONTENT.boosters[st(snap).pl[seat]!.booster!]!.income;
    expect((inc.q ?? 0) - (booster.q ?? 0)).toBe(1);
    expect((inc.pw ?? 0) - (booster.pw ?? 0)).toBe(4);
    expect((inc.t ?? 0) - (booster.t ?? 0)).toBe(1);
  });

  it('federation threshold is 7 × (federation tokens + 1)', () => {
    const { snap, seat } = setupIvits();
    const s = st(snap);
    expect(fedThreshold(s, seat)).toBe(7);
    s.pl[seat]!.feds.push({ id: 'fed1', green: false });
    expect(fedThreshold(s, seat)).toBe(14);
    s.pl[seat]!.feds.push({ id: 'fed2', green: true });
    expect(fedThreshold(s, seat)).toBe(21);
  });

  it('PI action: space station on empty space in range (free), once per round; extends range and is a federation node', () => {
    const { snap, seat } = setupIvits();
    const s = st(snap);
    const opts = legal(snap, seat).filter((a) => a.type === 'special' && a.id === 'faction:ivits');
    expect(opts.length).toBeGreaterThan(0);
    const hex = opts.map((a) => a.hex as number).find((i) => qicFor(s, seat, i) === 0)!;
    expect(s.hexes[hex]!.planet).toBe('e');
    const q = s.pl[seat]!.q;
    const next = act(snap, seat, { type: 'special', id: 'faction:ivits', hex });
    const n = st(next);
    expect(n.hexes[hex]).toMatchObject({ owner: seat, building: 'station' });
    expect(n.pl[seat]!.q).toBe(q);
    expect(n.pl[seat]!.used).toContain('faction:ivits');
    expect(distanceFrom(n, seat, hex)).toBe(0);
    expect(powerValue(n, seat, hex, true)).toBe(1);
    expect(powerValue(n, seat, hex)).toBe(0);
    expect(CONTENT.finals.f6!.value(n, seat)).toBe(1);
    turnOf(next, seat);
    const other = opts.map((a) => a.hex as number).find((i) => i !== hex && n.hexes[i]!.owner === null)!;
    expect(reject(next, seat, { type: 'special', id: 'faction:ivits', hex: other })).toBe('ACTION_TAKEN');
  });

  it('PI action: QIC extends the range; planets and unreachable hexes are rejected without change', () => {
    const { snap, seat } = setupIvits();
    const s = st(snap);
    s.pl[seat]!.q = 1;
    const far = s.hexes.findIndex((h, i) => h.planet === 'e' && h.owner === null && qicFor(s, seat, i) === 1);
    const tooFar = s.hexes.findIndex((h, i) => h.planet === 'e' && h.owner === null && qicFor(s, seat, i) >= 2);
    const planet = s.hexes.findIndex((h) => h.planet !== 'e' && h.owner === null);
    const before = structuredClone(s);
    expect(reject(snap, seat, { type: 'special', id: 'faction:ivits', hex: planet })).toBe('ILLEGAL_PLACEMENT');
    if (tooFar >= 0) expect(reject(snap, seat, { type: 'special', id: 'faction:ivits', hex: tooFar })).toBe('ILLEGAL_PLACEMENT');
    expect(reject(snap, seat, { type: 'special', id: 'faction:ivits' })).toBe('ILLEGAL_PLACEMENT');
    expect(st(snap)).toEqual(before);
    const next = act(snap, seat, { type: 'special', id: 'faction:ivits', hex: far });
    expect(st(next).pl[seat]!.q).toBe(0);
    expect(st(next).hexes[far]!.building).toBe('station');
  });

  it('PI action unavailable without the PI', () => {
    const { snap, seat } = setupIvits();
    st(snap).hexes.find((h) => h.owner === seat && h.building === 'pi')!.building = 'mine';
    const hex = st(snap).hexes.findIndex((h) => h.planet === 'e');
    expect(reject(snap, seat, { type: 'special', id: 'faction:ivits', hex })).toBe('NOT_ENOUGH_RESOURCES');
  });
});

describe('gaia-project factions-a: random games', () => {
  it('3–4 player games with Terrans, Lantids and Ivits terminate with a valid outcome', () => {
    const lineups = [['terrans', 'ivits', 'geodens'], ['lantids', 'ivits', 'xenos', 'firaks'], ['ivits', 'terrans', 'xenos', 'firaks']];
    lineups.forEach((f, k) => {
      for (const seed of [1, 2]) {
        const s = st(playRandom(f, seed + 10 * k));
        expect(s.outcome).not.toBeNull();
        expect(s.outcome!.placements).toHaveLength(f.length);
        expect(s.pending).toHaveLength(0);
      }
    });
  }, 120_000);
});
