import { describe, expect, it } from 'vitest';
import { gaiaProjectModule, gaiaformersFree, incomeOf, type GaiaState } from '@bg/game-gaia-project';
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
const own = (s: GaiaState, seat: number) => s.hexes.flatMap((h, i) => (h.owner === seat ? [i] : []));
const emptyBoard = (s: GaiaState) => s.hexes.forEach((h) => { h.owner = null; h.building = null; h.extra = null; h.sats = []; h.feds = []; });
const d = (s: GaiaState, a: number, b: number) => {
  const x = s.hexes[a]!, y = s.hexes[b]!;
  return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2;
};
const lcg = (seed: number) => { let x = seed >>> 0; return (n: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; }; };

/** Everyone passes (first booster) until the next round starts. */
function nextRound(snap: EngineSnapshot): EngineSnapshot {
  const r = st(snap).round;
  for (let g = 0; g < 20 && st(snap).round === r; g++) {
    const seat = actor(snap);
    snap = act(snap, seat, legal(snap, seat).find((a) => a.type === 'pass')!);
  }
  return snap;
}

describe("gaia-project factions-b: Bal T'aks", () => {
  it('start gaia 1 with a gaiaformer; free action sends it to the gaia area for 1 QIC; it returns next gaia phase', () => {
    let snap = ready(['bal-taks', 'firaks']);
    const b = seatOf(snap, 'bal-taks');
    snap = turnOf(snap, b);
    let s = st(snap);
    expect(s.pl[b]!.research.gaia).toBe(1);
    expect(s.pl[b]!.gf).toBe(1);
    const q = s.pl[b]!.q;
    snap = act(snap, b, { type: 'convert', id: 'baltaks-gf' });
    s = st(snap);
    expect(s.pl[b]!.q).toBe(q + 1);
    expect(s.pl[b]!.gfGaia).toBe(1);
    expect(gaiaformersFree(s, b)).toBe(0);
    expect(actor(snap)).toBe(b); // free action: still Bal T'aks' turn
    const before = structuredClone(s);
    expect(reject(snap, b, { type: 'convert', id: 'baltaks-gf' })).toBe('NOT_ENOUGH_RESOURCES');
    const transdim = s.hexes.findIndex((h) => h.planet === 'm' && h.owner === null);
    expect(reject(snap, b, { type: 'gaiaform', hex: transdim })).toBe('NO_PIECES');
    expect(st(snap)).toEqual(before);
    snap = nextRound(snap);
    expect(st(snap).pl[b]!.gfGaia).toBe(0);
    expect(gaiaformersFree(st(snap), b)).toBe(1);
  });

  it('navigation research blocked until the PI', () => {
    let snap = ready(['bal-taks', 'firaks']);
    const b = seatOf(snap, 'bal-taks');
    snap = turnOf(snap, b);
    const s = st(snap);
    s.pl[b]!.k = 15;
    const before = structuredClone(s);
    expect(reject(snap, b, { type: 'research', track: 'nav' })).toBe('RESEARCH_BLOCKED');
    expect(st(snap)).toEqual(before);
    s.hexes[own(s, b)[0]!]!.building = 'pi';
    snap = act(snap, b, { type: 'research', track: 'nav' });
    expect(st(snap).pl[b]!.research.nav).toBe(1);
  });
});

describe('gaia-project factions-b: Gleens', () => {
  it('start: no QIC of their own, navigation 1 gives a real QIC at set-up; afterwards QIC becomes ore until the QIC academy', () => {
    let snap = ready(['gleens', 'geodens']);
    const g = seatOf(snap, 'gleens');
    let s = st(snap);
    expect(s.pl[g]!.research.nav).toBe(1);
    expect(s.pl[g]!.q).toBeGreaterThanOrEqual(1); // the set-up QIC is a real QIC
    snap = turnOf(snap, g);
    s = st(snap);
    Object.assign(s.pl[g]!, { q: 0, o: 5, k: 15 });
    snap = act(snap, g, { type: 'research', track: 'ai' }); // AI level 1 = 1 QIC -> 1 ore
    expect(st(snap).pl[g]).toMatchObject({ q: 0, o: 6 });
    snap = turnOf(snap, g);
    s = st(snap);
    s.hexes[own(s, g)[0]!]!.building = 'ac2';
    snap = act(snap, g, { type: 'special', id: 'ac2' }); // with the QIC academy: a real QIC
    expect(st(snap).pl[g]).toMatchObject({ q: 1, o: 6 });
  });

  it('a mine on a gaia planet costs 1 ore instead of 1 QIC and scores +2 VP', () => {
    let snap = ready(['gleens', 'geodens']);
    const g = seatOf(snap, 'gleens');
    snap = turnOf(snap, g);
    const s = st(snap);
    const home = own(s, g)[0]!;
    const hex = s.hexes.findIndex((h, i) => h.owner === null && h.planet !== 'e' && d(s, home, i) === 1);
    s.hexes[hex]!.planet = 'g';
    Object.assign(s.pl[g]!, { q: 0, o: 5, c: 5 });
    const seq = s.seq;
    snap = act(snap, g, { type: 'mine', hex });
    const after = st(snap);
    expect(after.hexes[hex]).toMatchObject({ owner: g, building: 'mine' });
    expect(after.pl[g]).toMatchObject({ q: 0, o: 3, c: 3 });
    expect(after.log.filter((e) => e.seq > seq && e.t === 'vp' && e.why === 'faction').map((e) => (e as { n: number }).n)).toEqual([2]);
  });

  it('PI: takes the Gleens federation token immediately; PI income is 4 charge + 1 ore', () => {
    let snap = ready(['gleens', 'geodens']);
    const g = seatOf(snap, 'gleens');
    snap = turnOf(snap, g);
    const s = st(snap);
    const [a] = own(s, g);
    s.hexes[a!]!.building = 'ts';
    Object.assign(s.pl[g]!, { c: 10, o: 10, k: 3, q: 0 });
    snap = act(snap, g, { type: 'upgrade', hex: a, to: 'pi' });
    const pl = st(snap).pl[g]!;
    expect(pl.feds).toEqual([{ id: 'gleens', green: true }]);
    expect(pl).toMatchObject({ c: 10 - 6 + 2, o: 10 - 4 + 1, k: 4 });
    const base = incomeOf(st(snap), g);
    st(snap).hexes[a!]!.building = 'ts';
    const without = incomeOf(st(snap), g);
    expect((base.o ?? 0) - (without.o ?? 0)).toBe(1);
    expect((base.pw ?? 0) - (without.pw ?? 0)).toBe(4);
  });
});

describe('gaia-project factions-b: official board numbers', () => {
  it("Bal T'aks start without QIC with bowls 2/2/0 and their QIC academy gives 4 credits; Ambas earn 2 ore + 1 knowledge base income", () => {
    let snap = startGame(m, { playerCount: 2, seed: 1, options: {} }).snapshot;
    const first = actor(snap);
    snap = act(snap, first, { type: 'faction', faction: 'bal-taks' });
    snap = act(snap, 1 - first, { type: 'faction', faction: 'ambas' });
    const s = st(snap);
    expect(s.pl[first]).toMatchObject({ q: 0, c: 15, o: 4, k: 3 });
    expect(s.pl[first]!.power).toMatchObject({ b1: 2, b2: 2, b3: 0 });
    snap = ready(['bal-taks', 'ambas']);
    const b = seatOf(snap, 'bal-taks');
    const a = seatOf(snap, 'ambas');
    snap = turnOf(snap, b);
    st(snap).hexes[own(st(snap), b)[0]!]!.building = 'ac2';
    const c = st(snap).pl[b]!.c, q = st(snap).pl[b]!.q;
    snap = act(snap, b, { type: 'special', id: 'ac2' });
    expect(st(snap).pl[b]).toMatchObject({ c: c + 4, q });
    const s2 = st(snap);
    s2.pl[a]!.booster = null;
    const inc = incomeOf(s2, a);
    expect(inc.k).toBe(1);
    expect(inc.o).toBe(2 + 2); // base 2 ore + two set-up mines
  });
});

describe('gaia-project factions-b: Ambas', () => {
  it('PI income 4 charge + 2 tokens; swap PI and a mine: no events, no leech, federation marks stay', () => {
    let snap = ready(['ambas', 'geodens']);
    const a = seatOf(snap, 'ambas');
    const o = 1 - a;
    snap = turnOf(snap, a);
    const s = st(snap);
    const [pi, mine] = own(s, a);
    const before = structuredClone(s);
    expect(reject(snap, a, { type: 'special', id: 'faction:ambas', hex: mine })).toBe('NOT_ENOUGH_RESOURCES');
    expect(st(snap)).toEqual(before);
    s.hexes[pi!]!.building = 'pi';
    s.hexes[pi!]!.feds = [a];
    expect(incomeOf(s, a)).toMatchObject({ pw: 4, t: 2 });
    // an opponent structure next to the mine would receive leech on a real build
    const near = s.hexes.findIndex((h, i) => h.owner === null && h.planet !== 'e' && d(s, mine!, i) === 1);
    if (near >= 0) Object.assign(s.hexes[near]!, { owner: o, building: 'mine' });
    expect(legal(snap, a).filter((x) => x.id === 'faction:ambas').map((x) => x.hex)).toEqual([mine]);
    expect(reject(snap, a, { type: 'special', id: 'faction:ambas', hex: pi })).toBe('ILLEGAL_PLACEMENT');
    const seq = s.seq;
    const vps = s.pl.map((pl) => pl.vp);
    snap = act(snap, a, { type: 'special', id: 'faction:ambas', hex: mine });
    const t = st(snap);
    expect(t.hexes[pi!]).toMatchObject({ building: 'mine', owner: a, feds: [a] });
    expect(t.hexes[mine!]).toMatchObject({ building: 'pi', owner: a, feds: [] });
    expect(t.pending).toEqual([]);
    expect(t.log.filter((e) => e.seq > seq).map((e) => e.t)).toEqual(['special']);
    expect(t.pl.map((pl) => pl.vp)).toEqual(vps);
    snap = turnOf(snap, a);
    expect(reject(snap, a, { type: 'special', id: 'faction:ambas', hex: pi })).toBe('ACTION_TAKEN');
  });
});

describe('gaia-project factions-b: Taklons', () => {
  /** Taklons trading station next to an opponent mine; returns the snapshot after the opponent's upgrade. */
  function leechSetup(withPI: boolean, power: GaiaState['pl'][number]['power']) {
    let snap = ready(['taklons', 'geodens']);
    const t = seatOf(snap, 'taklons');
    const o = 1 - t;
    snap = turnOf(snap, o);
    const s = st(snap);
    expect(s.pl[t]!.power.brain).toBe(1);
    emptyBoard(s);
    const a = s.hexes.findIndex((h) => h.planet === 'v');
    const near = s.hexes.findIndex((h, i) => i !== a && h.planet !== 'e' && d(s, a, i) === 2);
    const far = s.hexes.findIndex((h, i) => h.planet !== 'e' && d(s, a, i) > 4);
    Object.assign(s.hexes[a]!, { owner: o, building: 'mine' });
    Object.assign(s.hexes[near]!, { owner: t, building: 'ts' });
    if (withPI) Object.assign(s.hexes[far]!, { owner: t, building: 'pi' });
    Object.assign(s.pl[o]!, { c: 30, o: 15 });
    s.pl[t]!.power = power;
    s.pl[t]!.vp = 10;
    snap = act(snap, o, { type: 'upgrade', hex: a, to: 'ts' });
    expect(st(snap).pending[0]).toMatchObject({ kind: 'leech', seat: t, amount: 2 });
    return { snap, t };
  }

  it('without the PI: plain accept/decline', () => {
    const { snap, t } = leechSetup(false, { b1: 2, b2: 4, b3: 0, gaia: 0, brain: 1 });
    expect(legal(snap, t).filter((a) => a.type === 'decide').map((a) => a.choice)).toEqual(['accept', 'decline']);
    expect(reject(snap, t, { type: 'decide', choice: 'token-first' })).not.toBe('ACCEPTED');
    const s = st(act(snap, t, { type: 'decide', choice: 'accept' }));
    // brainstone moves first (I→II), then one token I→II
    expect(s.pl[t]!.power).toMatchObject({ b1: 1, b2: 5, brain: 2 });
    expect(s.pl[t]!.vp).toBe(9);
  });

  it('with the PI: token before or after charging changes the result; decline does nothing', () => {
    const power = { b1: 0, b2: 1, b3: 5, gaia: 0, brain: 3 as const };
    const { snap, t } = leechSetup(true, power);
    expect(legal(snap, t).filter((a) => a.type === 'decide').map((a) => a.choice)).toEqual(['decline', 'token-first', 'charge-first']);
    const first = st(act(snap, t, { type: 'decide', choice: 'token-first' })).pl[t]!;
    expect(first.power).toMatchObject({ b1: 0, b2: 1, b3: 6 });
    expect(first.vp).toBe(9);
    const after = st(act(snap, t, { type: 'decide', choice: 'charge-first' })).pl[t]!;
    expect(after.power).toMatchObject({ b1: 1, b2: 0, b3: 6 });
    expect(after.vp).toBe(10);
    const no = st(act(snap, t, { type: 'decide', choice: 'decline' })).pl[t]!;
    expect(no.power).toEqual(power);
  });

  it('a leech timeout declines (PI choice offered)', () => {
    const power = { b1: 2, b2: 4, b3: 0, gaia: 0, brain: 1 as const };
    const { snap, t } = leechSetup(true, power);
    const r = applyTimeout(m, snap, 0) as StepResult;
    const s = st(r.snapshot);
    expect(s.pending.some((x) => x.kind === 'leech' && x.seat === t)).toBe(false);
    expect(s.pl[t]!.power).toEqual(power);
    expect(s.log.some((e) => e.t === 'decline' && e.seat === t)).toBe(true);
  });
});

describe('gaia-project factions-b: random games', () => {
  it('seeded random games with these factions terminate with a valid outcome', () => {
    for (const [factions, seed] of [[['bal-taks', 'gleens', 'ambas'], 1], [['taklons', 'bal-taks', 'gleens'], 2], [['gleens', 'taklons'], 3]] as const) {
      const rnd = lcg(seed * 7919);
      let snap = ready([...factions], seed);
      let free = 0;
      for (let step = 0; step < 6000 && !st(snap).outcome; step++) {
        const seat = actor(snap);
        const all = legal(snap, seat).filter((a) => a.type !== 'resign');
        const main = all.filter((a) => a.type !== 'convert' && a.type !== 'burn' && a.type !== 'pass');
        const passes = all.filter((a) => a.type === 'pass');
        const frees = all.filter((a) => a.type === 'convert' || a.type === 'burn');
        let pick;
        if (frees.length && free < 2 && rnd(6) === 0) { pick = frees[rnd(frees.length)]; free++; }
        else if (main.length && (passes.length === 0 || rnd(8) !== 0)) { pick = main[rnd(main.length)]; free = 0; }
        else { pick = passes[rnd(passes.length)] ?? all[0]; free = 0; }
        snap = act(snap, seat, pick);
      }
      const s = st(snap);
      expect(s.outcome, `${factions.join(',')} round ${s.round}`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(factions.length);
      expect(s.round).toBe(6);
    }
  }, 120_000);
});
