import { describe, expect, it } from 'vitest';
import {
  CONTENT, POWER_ACTIONS, TRACKS, conversions, gaiaProject, gaiaProjectModule, incomeOf, minePlan, powerValue, rankPoints, spendable, upgradeCost, validMap, fedPlan,
  type GaiaState, type Track
} from '@bg/game-gaia-project';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

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

/** Give seat N the faction factions[N] (in turn order), place set-up structures on the first legal hex, take the first booster. */
function ready(factions: string[], seed = 1): EngineSnapshot {
  let snap = startGame(m, { playerCount: factions.length, seed, options: {} }).snapshot;
  for (let guard = 0; guard < 60 && st(snap).phase !== 'actions'; guard++) {
    const seat = actor(snap);
    const s = st(snap);
    if (s.phase === 'faction') snap = act(snap, seat, { type: 'faction', faction: factions[seat] });
    else snap = act(snap, seat, legal(snap, seat).find((a) => a.type !== 'resign'));
  }
  return snap;
}
/** Put the seat in front, clear decisions (direct state edit for focused rule tests). */
const turnOf = (snap: EngineSnapshot, seat: number) => { st(snap).current = seat; st(snap).pending = []; return snap; };
const emptyBoard = (s: GaiaState) => s.hexes.forEach((h) => { h.owner = null; h.building = null; h.extra = null; h.sats = []; h.feds = []; });
/** A home-planet hex at exactly distance d from `from` (or -1). */
const findHex = (s: GaiaState, ok: (i: number) => boolean) => s.hexes.findIndex((_, i) => ok(i));
const d = (s: GaiaState, a: number, b: number) => {
  const x = s.hexes[a]!, y = s.hexes[b]!;
  return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2;
};

// Deterministic test RNG for random play.
const lcg = (seed: number) => { let x = seed >>> 0; return (n: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; }; };

function playRandom(players: number, seed: number) {
  const rnd = lcg(seed * 7919 + players);
  let snap = startGame(m, { playerCount: players, seed, options: { factions: 'random' } }).snapshot;
  const inputs: ReplayInput[] = [];
  let free = 0;
  for (let step = 0; step < 6000 && !st(snap).outcome; step++) {
    const seat = actor(snap);
    const all = legal(snap, seat).filter((a) => a.type !== 'resign');
    const main = all.filter((a) => a.type !== 'convert' && a.type !== 'burn' && a.type !== 'pass');
    const passes = all.filter((a) => a.type === 'pass');
    const frees = all.filter((a) => a.type === 'convert' || a.type === 'burn');
    let pick;
    if (frees.length && free < 2 && rnd(10) === 0) { pick = frees[rnd(frees.length)]; free++; }
    else if (main.length && (passes.length === 0 || rnd(8) !== 0)) { pick = main[rnd(main.length)]; free = 0; }
    else { pick = passes[rnd(passes.length)] ?? all[0]; free = 0; }
    inputs.push({ kind: 'action', actor: p(seat), action: pick, logicalTime: step });
    snap = act(snap, seat, pick);
  }
  return { snap, inputs };
}

describe('gaia-project setup', () => {
  it('builds a legal map: 7 sectors for 2 players, 10 for 3–4; no touching same home planets', () => {
    for (const [n, sectors] of [[2, 7], [3, 10], [4, 10]] as const) {
      const s = st(startGame(m, { playerCount: n, seed: 5, options: {} }).snapshot);
      expect(s.placements).toHaveLength(sectors);
      expect(s.hexes).toHaveLength(sectors * 19);
      expect(new Set(s.hexes.map((h) => `${h.q},${h.r}`)).size).toBe(sectors * 19);
      expect(validMap(s.hexes)).toBe(true);
      expect(s.boosters).toHaveLength(Math.min(n + 3, Object.keys(CONTENT.boosters).length));
      expect(s.roundTiles).toHaveLength(6);
      expect(s.finalTiles).toHaveLength(2);
      expect(s.techBoard.adv.filter(Boolean).length).toBe(Math.min(6, Object.values(CONTENT.techs).filter((t) => t.kind === 'adv').length));
      expect(s.terraFed).not.toBeNull();
      expect(s.phase).toBe('faction');
      expect(s.pl.every((pl) => pl.vp === 10)).toBe(true);
    }
    expect(() => gaiaProjectModule.setup({ playerCount: 1, options: {}, rng: { nextInt: () => 0 } })).toThrow();
  });

  it('factions: one per home planet; set-up mines snake (Xenos third mine last); boosters in reverse order', () => {
    let snap = startGame(m, { playerCount: 2, seed: 3, options: {} }).snapshot;
    const first = actor(snap);
    snap = act(snap, first, { type: 'faction', faction: 'xenos' });
    const second = actor(snap);
    expect(second).toBe(1 - first);
    expect(legal(snap, second).some((a) => a.faction === 'xenos')).toBe(false);
    snap = act(snap, second, { type: 'faction', faction: 'hadsch-hallas' });
    const s = st(snap);
    expect(s.phase).toBe('setup');
    expect(s.setupQueue.map((q) => q.seat)).toEqual([first, second, second, first, first]);
    expect(s.pl[first]!.research.ai).toBe(1);
    expect(s.pl[second]!.research.eco).toBe(1);
    const before = structuredClone(st(snap));
    expect(reject(snap, first, { type: 'place', hex: s.hexes.findIndex((h) => h.planet !== 'd') })).toBe('ILLEGAL_PLACEMENT');
    expect(st(snap)).toEqual(before);
    for (let k = 0; k < 5; k++) snap = act(snap, actor(snap), legal(snap, actor(snap))[0]);
    expect(st(snap).phase).toBe('booster');
    expect(actor(snap)).toBe(second);
    snap = act(snap, second, { type: 'booster', booster: st(snap).boosters[0] });
    snap = act(snap, first, { type: 'booster', booster: st(snap).boosters[0] });
    expect(st(snap).phase).toBe('actions');
    expect(st(snap).round).toBe(1);
    expect(actor(snap)).toBe(first);
  });

  it('random faction option deals distinct home planets', () => {
    const s = st(startGame(m, { playerCount: 4, seed: 9, options: { factions: 'random' } }).snapshot);
    const homes = s.pl.map((pl) => CONTENT.factions[pl.faction!]!.home);
    expect(new Set(homes).size).toBe(4);
    expect(s.phase).toBe('setup');
  });
});

describe('gaia-project actions', () => {
  it('income: base, mines, booster, research; first round already paid', () => {
    const snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    const g = incomeOf(s, 0);
    // Geodens: base 1 ore 1 knowledge, 2 mines → 2 ore, + booster
    const b = CONTENT.boosters[s.pl[0]!.booster!]!.income;
    expect(g.o).toBe(3 + (b.o ?? 0));
    expect(g.k).toBe(1 + (b.k ?? 0));
  });

  it('mine cost: 2 credits + 1 ore + terraforming ore per step; QIC for range; rejected actions do not mutate', () => {
    const snap = turnOf(ready(['geodens', 'firaks']), 0);
    const s = st(snap);
    const own = findHex(s, (i) => s.hexes[i]!.owner === 0);
    // Geodens (volcanic) start at terraforming 1 → 3 ore per step. Desert is 1 step from volcanic.
    const desert = findHex(s, (i) => s.hexes[i]!.planet === 'd' && s.hexes[i]!.owner === null && d(s, own, i) <= 1);
    const ice = findHex(s, (i) => s.hexes[i]!.planet === 'i' && s.hexes[i]!.owner === null);
    if (desert >= 0) {
      const plan = minePlan(s, 0, desert);
      expect(plan).toMatchObject({ cost: { c: 2, o: 4 }, steps: 1 });
    }
    s.pl[0]!.o = 0;
    const before = structuredClone(st(snap));
    expect(reject(snap, 0, { type: 'mine', hex: ice })).toBe('NOT_ENOUGH_RESOURCES');
    expect(reject(snap, 1, { type: 'mine', hex: ice })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'mine', hex: own })).toBe('CELL_OCCUPIED');
    expect(st(snap)).toEqual(before);
    // Far away: QIC needed (range 1 at navigation 0, each QIC +2)
    s.pl[0]!.o = 15; s.pl[0]!.c = 30; s.pl[0]!.q = 0;
    const far = findHex(s, (i) => s.hexes[i]!.planet === 'v' && s.hexes[i]!.owner === null
      && Math.min(...s.hexes.flatMap((h, j) => (h.owner === 0 ? [d(s, i, j)] : []))) === 3);
    if (far >= 0) {
      expect(minePlan(s, 0, far)).toBe('NOT_ENOUGH_RESOURCES');
      s.pl[0]!.q = 1;
      expect(minePlan(s, 0, far)).toMatchObject({ cost: { c: 2, o: 1, q: 1 } });
    }
  });

  it('upgrades: trading station 3 or 6 credits, lab takes a tech tile, PI; leech is offered and costs VP', () => {
    const snap0 = turnOf(ready(['geodens', 'firaks']), 0);
    let s = st(snap0);
    emptyBoard(s);
    const a = findHex(s, (i) => s.hexes[i]!.planet === 'v');
    const near = findHex(s, (i) => i !== a && s.hexes[i]!.planet !== 'e' && d(s, a, i) <= 2);
    const far = findHex(s, (i) => s.hexes[i]!.planet !== 'e' && d(s, a, i) > 4);
    Object.assign(s.hexes[a]!, { owner: 0, building: 'mine' });
    Object.assign(s.hexes[far]!, { owner: 1, building: 'mine' });
    Object.assign(s.pl[0]!, { c: 30, o: 15, k: 0 });
    expect(upgradeCost(s, 0, a, 'ts')).toEqual({ c: 6, o: 2 });
    Object.assign(s.hexes[near]!, { owner: 1, building: 'ts' });
    expect(upgradeCost(s, 0, a, 'ts')).toEqual({ c: 3, o: 2 });
    expect(upgradeCost(s, 0, a, 'lab')).toBe('ILLEGAL_PLACEMENT');
    s.pl[1]!.power = { b1: 2, b2: 4, b3: 0, gaia: 0, brain: null };
    const vp1 = s.pl[1]!.vp;
    let snap = act(snap0, 0, { type: 'upgrade', hex: a, to: 'ts' });
    s = st(snap);
    expect(s.hexes[a]!.building).toBe('ts');
    expect(s.pl[0]!.c).toBe(27);
    expect(s.pending[0]).toMatchObject({ kind: 'leech', seat: 1, amount: 2 });
    expect(actor(snap)).toBe(1);
    snap = act(snap, 1, { type: 'decide', choice: 'accept' });
    s = st(snap);
    expect(s.pl[1]!.vp).toBe(vp1 - 1);
    expect(s.pl[1]!.power).toMatchObject({ b1: 0, b2: 6 });
    // lab → tech tile decision for the builder before anyone else acts
    snap = turnOf(snap, 0);
    snap = act(snap, 0, { type: 'upgrade', hex: a, to: 'lab' });
    s = st(snap);
    expect(s.pending[0]).toMatchObject({ kind: 'tech', seat: 0 });
    const tile = legal(snap, 0)[0]!.choice as string;
    snap = act(snap, 0, { type: 'decide', choice: tile });
    expect(st(snap).pl[0]!.techs.map((t) => t.id)).toContain(tile);
  });

  it('research: 4 knowledge, level 3 charges 3 power, level 5 needs a green federation and is exclusive', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    let s = st(snap);
    Object.assign(s.pl[0]!, { k: 15 });
    s.pl[0]!.power = { b1: 5, b2: 0, b3: 0, gaia: 0, brain: null };
    s.pl[0]!.research.sci = 2;
    snap = act(snap, 0, { type: 'research', track: 'sci' });
    s = st(snap);
    expect(s.pl[0]!.k).toBe(11);
    expect(s.pl[0]!.research.sci).toBe(3);
    expect(s.pl[0]!.power).toMatchObject({ b1: 2, b2: 3 });
    snap = turnOf(snap, 0);
    st(snap).pl[0]!.research.sci = 4;
    expect(reject(snap, 0, { type: 'research', track: 'sci' })).toBe('RESEARCH_BLOCKED');
    st(snap).pl[0]!.feds.push({ id: 'fed2', green: true });
    snap = act(snap, 0, { type: 'research', track: 'sci' });
    s = st(snap);
    expect(s.pl[0]!.research.sci).toBe(5);
    expect(s.pl[0]!.feds[0]!.green).toBe(false);
    expect(s.pl[0]!.k).toBe(15); // 7 − 4 + 9, capped at 15
    snap = turnOf(snap, 1);
    Object.assign(st(snap).pl[1]!, { k: 10 });
    st(snap).pl[1]!.research.sci = 4;
    st(snap).pl[1]!.feds.push({ id: 'fed2', green: true });
    expect(reject(snap, 1, { type: 'research', track: 'sci' })).toBe('RESEARCH_BLOCKED');
  });

  it('terraforming 5 takes the federation token; navigation, AI and gaia rewards', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    const s = st(snap);
    const tok = s.terraFed!;
    Object.assign(s.pl[0]!, { k: 15, q: 0 });
    s.pl[0]!.research.terra = 4;
    s.pl[0]!.feds.push({ id: 'fed6', green: true });
    snap = act(snap, 0, { type: 'research', track: 'terra' });
    expect(st(snap).terraFed).toBeNull();
    expect(st(snap).pl[0]!.feds.map((f) => f.id)).toContain(tok);
    snap = turnOf(snap, 0);
    snap = act(snap, 0, { type: 'research', track: 'ai' });
    expect(st(snap).pl[0]!.q).toBe(1 + (CONTENT.feds[tok]!.gain.q ?? 0));
    snap = turnOf(snap, 0);
    st(snap).pl[0]!.k = 8;
    snap = act(snap, 0, { type: 'research', track: 'gaia' });
    expect(st(snap).pl[0]!.gf).toBe(1);
    snap = turnOf(snap, 0);
    snap = act(snap, 0, { type: 'research', track: 'gaia' });
    expect(st(snap).pl[0]!.power.b1).toBeGreaterThanOrEqual(3);
  });

  it('power actions: once per round for everyone; QIC action 3 scores planet types', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    st(snap).pl[0]!.power = { b1: 0, b2: 0, b3: 10, gaia: 0, brain: null };
    st(snap).pl[1]!.power = { b1: 0, b2: 0, b3: 10, gaia: 0, brain: null };
    const k = st(snap).pl[0]!.k;
    snap = act(snap, 0, { type: 'power', id: 'pw1' });
    expect(st(snap).pl[0]!.k).toBe(Math.min(15, k + 3));
    expect(st(snap).pl[0]!.power).toMatchObject({ b1: 7, b3: 3 });
    snap = turnOf(snap, 1);
    expect(reject(snap, 1, { type: 'power', id: 'pw1' })).toBe('ACTION_TAKEN');
    st(snap).pl[1]!.q = 2;
    const vp = st(snap).pl[1]!.vp;
    snap = act(snap, 1, { type: 'power', id: 'qic3' });
    expect(st(snap).pl[1]!.vp).toBe(vp + 3 + 1);
    expect(st(snap).pl[1]!.q).toBe(0);
  });

  it('free actions: conversions and burning power do not end the turn', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    st(snap).pl[0]!.power = { b1: 0, b2: 4, b3: 1, gaia: 0, brain: null };
    const c = st(snap).pl[0]!.c;
    snap = act(snap, 0, { type: 'convert', id: 'pw-c' });
    expect(st(snap).pl[0]!.c).toBe(c + 1);
    snap = act(snap, 0, { type: 'burn' });
    expect(st(snap).pl[0]!.power).toMatchObject({ b1: 1, b2: 2, b3: 1 });
    expect(actor(snap)).toBe(0);
    expect(reject(snap, 0, { type: 'convert', id: 'nope' })).toBe('NOT_ENOUGH_RESOURCES');
  });

  it('gaiaforming: tokens to the gaia area, planet turns gaia in the next gaia phase, then a mine without QIC', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    let s = st(snap);
    emptyBoard(s);
    const m0 = findHex(s, (i) => s.hexes[i]!.planet === 'm' && s.hexes.some((h, j) => h.planet !== 'e' && h.planet !== 'm' && d(s, i, j) === 1));
    const home = findHex(s, (i) => s.hexes[i]!.planet !== 'e' && s.hexes[i]!.planet !== 'm' && d(s, m0, i) === 1);
    Object.assign(s.hexes[home]!, { owner: 0, building: 'mine' });
    s.pl[0]!.gf = 1; s.pl[0]!.research.gaia = 1;
    s.pl[0]!.power = { b1: 6, b2: 0, b3: 0, gaia: 0, brain: null };
    snap = act(snap, 0, { type: 'gaiaform', hex: m0 });
    s = st(snap);
    expect(s.hexes[m0]).toMatchObject({ owner: 0, building: 'gf', planet: 'm' });
    expect(s.pl[0]!.power).toMatchObject({ b1: 0, gaia: 6 });
    // everybody passes → next round's gaia phase
    for (let g = 0; g < 4 && st(snap).round === 1; g++) {
      const seat = actor(snap);
      st(snap).pending = [];
      snap = act(snap, seat, { type: 'pass', booster: st(snap).boosters[0] });
    }
    s = st(snap);
    expect(s.round).toBe(2);
    expect(s.hexes[m0]!.planet).toBe('g');
    expect(s.pl[0]!.power.gaia).toBe(0);
    s.pl[0]!.q = 0;
    expect(minePlan(s, 0, m0)).toMatchObject({ cost: { c: 2, o: 1 } });
  });

  it('federations: connected, value ≥ 7, satellites cost power tokens and are minimal', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 0);
    let s = st(snap);
    emptyBoard(s);
    // find a straight-ish pair: building A, an empty hex E adjacent to A, building B adjacent to E but not to A
    let A = -1, E = -1, B = -1;
    outer: for (let a = 0; a < s.hexes.length; a++) {
      if (s.hexes[a]!.planet === 'e') continue;
      for (let e = 0; e < s.hexes.length; e++) {
        if (s.hexes[e]!.planet !== 'e' || d(s, a, e) !== 1) continue;
        for (let b = 0; b < s.hexes.length; b++) {
          if (b !== a && s.hexes[b]!.planet !== 'e' && d(s, e, b) === 1 && d(s, a, b) === 2) { A = a; E = e; B = b; break outer; }
        }
      }
    }
    expect(A).toBeGreaterThanOrEqual(0);
    Object.assign(s.hexes[A]!, { owner: 0, building: 'pi' });
    Object.assign(s.hexes[B]!, { owner: 0, building: 'lab' });
    s.pl[0]!.power = { b1: 3, b2: 0, b3: 0, gaia: 0, brain: null };
    expect(fedPlan(s, 0, [A, B])).toBe('FEDERATION_INVALID'); // not connected
    expect(fedPlan(s, 0, [A, E, B])).toBe('FEDERATION_INVALID'); // value 5 < 7
    s.hexes[B]!.building = 'ac1';
    expect(fedPlan(s, 0, [A, E, B])).toBe('FEDERATION_INVALID'); // value 6 < 7
    s.pl[0]!.techs.push({ id: 'std3', covered: false }); // PI/academies worth 4
    expect(powerValue(s, 0, A)).toBe(4);
    expect(fedPlan(s, 0, [A, E, B])).toMatchObject({ value: 8, sats: [E] });
    const vp = s.pl[0]!.vp;
    snap = act(snap, 0, { type: 'federation', hexes: [A, E, B], token: 'fed1' });
    s = st(snap);
    expect(s.pl[0]!.vp).toBeGreaterThanOrEqual(vp + 12);
    expect(s.pl[0]!.power.b1).toBe(2);
    expect(s.hexes[E]!.sats).toEqual([0]);
    expect(s.pl[0]!.satellites).toBe(1);
    expect([A, E, B].every((i) => s.hexes[i]!.feds.includes(0))).toBe(true);
    expect(s.fedSupply.fed1).toBe(CONTENT.feds.fed1!.copies - 1 - (st(ready(['geodens', 'firaks'])).terraFed === 'fed1' ? 1 : 0));
  });

  it('pass: booster swap, pass order becomes next round order, round 6 passes end the game with final scoring', () => {
    let snap = ready(['geodens', 'firaks', 'xenos']);
    const order = st(snap).order;
    const passFirst = order[1]!;
    snap = turnOf(snap, passFirst);
    const old = st(snap).pl[passFirst]!.booster!;
    const pick = st(snap).boosters[0]!;
    snap = act(snap, passFirst, { type: 'pass', booster: pick });
    expect(st(snap).pl[passFirst]!.booster).toBe(pick);
    expect(st(snap).boosters).toContain(old);
    expect(reject(snap, passFirst, { type: 'mine', hex: 0 })).toBe('NOT_YOUR_TURN');
    for (let g = 0; g < 6 && st(snap).round === 1; g++) {
      const seat = actor(snap);
      st(snap).pending = [];
      snap = act(snap, seat, { type: 'pass', booster: st(snap).boosters[0] });
    }
    expect(st(snap).round).toBe(2);
    expect(st(snap).order[0]).toBe(passFirst);
    // jump to round 6
    st(snap).round = 6;
    const seat = actor(snap);
    expect(reject(snap, seat, { type: 'pass', booster: st(snap).boosters[0] })).toBe('BOOSTER_UNAVAILABLE');
    for (let g = 0; g < 6 && !st(snap).outcome; g++) { st(snap).pending = []; snap = act(snap, actor(snap), { type: 'pass' }); }
    const s = st(snap);
    expect(s.phase).toBe('finished');
    expect(s.outcome!.reason).toBe('score');
    expect(s.outcome!.placements).toHaveLength(3);
    expect(s.log.some((e) => e.t === 'vp' && e.why.startsWith('final:'))).toBe(true);
  });

  it('final scoring: 18/12/6 shared on ties; neutral player in 2-player games; research and resources', () => {
    expect(rankPoints([5, 3, 1])).toEqual([18, 12, 6]);
    expect(rankPoints([5, 5, 1])).toEqual([15, 15, 6]);
    expect(rankPoints([2, 2, 2])).toEqual([12, 12, 12]);
    expect(rankPoints([4, 4, 4, 1])).toEqual([12, 12, 12, 0]);
    expect(rankPoints([1, 0, 0, 0])).toEqual([18, 6, 6, 6]);
    let snap = ready(['geodens', 'firaks']);
    const s = st(snap);
    s.round = 6;
    s.finalTiles = ['f1', 'f3'];
    const r: Record<Track, number> = { terra: 3, nav: 4, ai: 5, gaia: 0, eco: 0, sci: 0 };
    s.pl[0]!.research = r;
    Object.assign(s.pl[0]!, { c: 5, o: 2, k: 2, q: 0, vp: 20 });
    s.pl[0]!.power = { b1: 0, b2: 0, b3: 0, gaia: 0, brain: null };
    Object.assign(s.pl[1]!, { vp: 20 });
    expect(spendable(s, 0)).toBe(0);
    for (let g = 0; g < 4 && !st(snap).outcome; g++) { st(snap).pending = []; snap = act(snap, actor(snap), { type: 'pass' }); }
    const t = st(snap);
    // player 0: research 4 + 8 + 12, resources 9/3 = 3; structures 2 vs neutral 11 → 3rd (6); planet types 1 vs neutral 5 → shares
    const why = (seat: number, w: string) => t.log.filter((e) => e.t === 'vp' && e.seat === seat && e.why === w).reduce((a, e) => a + (e as { n: number }).n, 0);
    expect(why(0, 'research:terra') + why(0, 'research:nav') + why(0, 'research:ai')).toBe(24);
    expect(why(0, 'resources')).toBe(3);
    expect(why(0, 'final:f1')).toBe(9); // tied with the other player on 2 structures, neutral (11) first → (12+6)/2
    expect(t.outcome!.placements.map((pl) => pl.place).sort()).toEqual(t.pl[0]!.vp === t.pl[1]!.vp ? [1, 1] : [1, 2]);
  });
});

describe('gaia-project worked content examples', () => {
  it('Hadsch Hallas PI conversions; Xenos federation threshold 6 with PI; Geodens 3 knowledge for a new planet type', () => {
    let snap = turnOf(ready(['hadsch-hallas', 'xenos']), 0);
    let s = st(snap);
    s.pl[0]!.c = 10;
    expect(legal(snap, 0).some((a) => a.id === 'hh-q')).toBe(false);
    const own = findHex(s, (i) => s.hexes[i]!.owner === 0);
    s.hexes[own]!.building = 'pi';
    snap = act(snap, 0, { type: 'convert', id: 'hh-q' });
    expect(st(snap).pl[0]!.c).toBe(6);
    s = st(snap);
    expect(fedPlan(s, 1, [])).toBe('FEDERATION_INVALID');
    const xs = { s, seat: 1 };
    expect(CONTENT.factions.xenos!.effects!.fedThreshold!(xs, 7)).toBe(7);
    const x1 = findHex(s, (i) => s.hexes[i]!.owner === 1);
    s.hexes[x1]!.building = 'pi';
    expect(CONTENT.factions.xenos!.effects!.fedThreshold!(xs, 7)).toBe(6);
    expect(incomeOf(s, 1).q).toBeGreaterThanOrEqual(1);
  });

  it('Firaks PI action downgrades a lab and grants a research step; tech std9 action charges 4 power once per round', () => {
    let snap = turnOf(ready(['geodens', 'firaks']), 1);
    const s = st(snap);
    const own = s.hexes.flatMap((h, i) => (h.owner === 1 ? [i] : []));
    s.hexes[own[0]!]!.building = 'pi';
    s.hexes[own[1]!]!.building = 'lab';
    s.pl[1]!.techs.push({ id: 'std9', covered: false });
    s.pl[1]!.power = { b1: 4, b2: 0, b3: 0, gaia: 0, brain: null };
    snap = act(snap, 1, { type: 'special', id: 'faction:firaks', hex: own[1] });
    expect(st(snap).hexes[own[1]!]!.building).toBe('ts');
    expect(st(snap).pending[0]).toMatchObject({ kind: 'research', seat: 1 });
    snap = act(snap, 1, { type: 'decide', choice: 'eco' });
    expect(st(snap).pl[1]!.research.eco).toBe(1);
    snap = turnOf(snap, 1);
    snap = act(snap, 1, { type: 'special', id: 'tech:std9' });
    expect(st(snap).pl[1]!.power).toMatchObject({ b1: 0, b2: 4 });
    snap = turnOf(snap, 1);
    expect(reject(snap, 1, { type: 'special', id: 'tech:std9' })).toBe('ACTION_TAKEN');
  });
});

describe('gaia-project timeouts, resign, projection, full games', () => {
  it('timeout: declines leech / passes; the third consecutive timeout removes the player', () => {
    let snap = ready(['geodens', 'firaks', 'xenos']);
    const seat = actor(snap);
    let r = applyTimeout(m, snap, 0) as StepResult;
    expect(st(r.snapshot).pl[seat]!.passed).toBe(true);
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    snap = r.snapshot;
    st(snap).pl[actor(snap)]!.timeouts = 2;
    const loser = actor(snap);
    r = applyTimeout(m, snap, 0) as StepResult;
    expect(st(r.snapshot).active[loser]).toBe(false);
    expect(st(r.snapshot).left).toEqual([loser]);
    expect(st(r.snapshot).outcome).toBeNull();
  });

  it('resign: two-player game ends, resigner last', () => {
    const snap = ready(['geodens', 'firaks']);
    const r = applyAction(m, snap, p(1), { type: 'resign' }, 0) as StepResult;
    expect(r.outcome).toMatchObject({ reason: 'resign', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    expect(reject(r.snapshot, 0, { type: 'pass' })).toBe('GAME_FINISHED');
  });

  it('projection: same public view for opponent and spectator, no engine internals or RNG; spectators get no actions', () => {
    const snap = ready(['geodens', 'firaks']);
    const a = projectFor(m, snap, p(0));
    const b = projectFor(m, snap, p(1));
    const spec = projectFor(m, snap, { kind: 'spectator' });
    expect(a.view).toEqual(spec.view);
    expect(b.view).toEqual(spec.view);
    const json = JSON.stringify(spec.view);
    expect(json).not.toMatch(/"ins"|"turnDone"|"rng"/);
    expect(spec.legalActions).toEqual([]);
    expect(projectFor(m, snap, p(1 - actor(snap))).legalActions).toEqual([{ type: 'resign' }]);
  });

  it('seeded random games for 2–4 players terminate with a valid outcome and replay deterministically', () => {
    for (const players of [2, 3, 4]) {
      for (const seed of [1, 2, 3]) {
        const { snap, inputs } = playRandom(players, seed);
        const s = st(snap);
        expect(s.outcome, `players ${players} seed ${seed} round ${s.round}`).not.toBeNull();
        expect(s.outcome!.placements).toHaveLength(players);
        expect(s.round).toBe(6);
        expect(s.hexes.filter((h) => h.building).length).toBeGreaterThan(players * 3); // the bots really built
        if (seed === 1) expect(replay(m, { playerCount: players, seed, options: { factions: 'random' } }, inputs).state).toEqual(s);
      }
    }
  }, 120_000);
});

describe('gaia-project simple policy (API / e2e driver)', () => {
  it('decline-or-first, mines in rounds 1–2, otherwise pass: every seat count reaches the final scoring', () => {
    for (const players of [2, 3, 4]) {
      let snap = startGame(m, { playerCount: players, seed: 21 + players, options: {} }).snapshot;
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const seat = actor(snap);
        const a = legal(snap, seat).filter((x) => x.type !== 'resign');
        const decide = a.filter((x) => x.type === 'decide');
        const mine = a.find((x) => x.type === 'mine');
        const pick = decide.length ? decide.find((x) => x.choice === 'decline') ?? decide[0]
          : mine && st(snap).round <= 2 ? mine
            : a.find((x) => x.type === 'pass') ?? a.find((x) => x.type !== 'convert' && x.type !== 'burn') ?? a[0];
        snap = act(snap, seat, pick);
      }
      const s = st(snap);
      expect(s.outcome?.reason).toBe('score');
      expect(s.round).toBe(6);
      expect(s.outcome!.placements).toHaveLength(players);
    }
  });
});

describe('gaia-project tutorial', () => {
  it('the scripted tutorial plays to the learner win with the exact final score', () => {
    const t = gaiaProjectModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    expect(st(snap).round).toBe(6);
    expect(actor(snap)).toBe(0);
    for (const step of t.steps) {
      expect(legal(snap, 0), JSON.stringify(step.expected)).toContainEqual(step.expected);
      snap = act(snap, 0, step.expected);
      if (step.reply && !st(snap).outcome && gaiaProjectModule.pendingSeats(st(snap)).includes(1)) snap = act(snap, 1, step.reply);
      expect(st(snap).pending).toEqual([]);
    }
    const s = st(snap);
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 107 }, { seat: 1, place: 2, score: 102 }] });
    const why = (seat: number, w: string) => s.log.filter((e) => e.t === 'vp' && e.seat === seat && e.why === w).reduce((a, e) => a + (e as { n: number }).n, 0);
    expect([why(0, 'round'), why(0, 'booster'), why(0, 'final:f1'), why(0, 'final:f3'), why(0, 'research:eco'), why(0, 'resources')]).toEqual([2, 2, 9, 9, 4, 3]);
    expect(s.pl[0]!.feds).toEqual([{ id: 'fed1', green: false }]);
    expect(s.hexes[14]!.sats).toEqual([0]);
    expect(s.pl[0]!.research.eco).toBe(3);
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(t.steps.length).toBeLessThanOrEqual(8);
  });
});

describe('gaia-project content registry', () => {
  it('holds every base-game item exactly once with a Persian label', () => {
    expect(Object.keys(CONTENT.factions).sort()).toEqual([
      'ambas', 'bal-taks', 'bescods', 'firaks', 'geodens', 'gleens', 'hadsch-hallas', 'itars', 'ivits', 'lantids', 'nevlas',
      'taklons', 'terrans', 'xenos'
    ]);
    // two factions per home planet type
    const homes = Object.values(CONTENT.factions).map((f) => f.home);
    for (const h of ['r', 'o', 'v', 'd', 's', 't', 'i']) expect(homes.filter((x) => x === h)).toHaveLength(2);
    const techs = Object.values(CONTENT.techs);
    expect(techs.filter((t) => t.kind === 'std').map((t) => t.id).sort()).toEqual(Array.from({ length: 9 }, (_, i) => `std${i + 1}`).sort());
    expect(techs.filter((t) => t.kind === 'adv').map((t) => t.id).sort()).toEqual(Array.from({ length: 15 }, (_, i) => `adv${i + 1}`).sort());
    expect(Object.keys(CONTENT.boosters)).toHaveLength(10);
    expect(Object.keys(CONTENT.rounds)).toHaveLength(10);
    expect(Object.keys(CONTENT.finals)).toHaveLength(6);
    expect(Object.values(CONTENT.feds).filter((f) => f.copies > 0)).toHaveLength(6);
    expect(Object.values(CONTENT.feds).map((f) => f.id)).toContain('gleens');
    expect(POWER_ACTIONS.map((a) => a.id)).toEqual(['pw1', 'pw2', 'pw3', 'pw4', 'pw5', 'pw6', 'pw7', 'qic1', 'qic2', 'qic3']);
    expect(TRACKS).toEqual(['terra', 'nav', 'ai', 'gaia', 'eco', 'sci']);
    const persian = /[؀-ۿ]/;
    for (const f of Object.values(CONTENT.factions)) for (const t of [f.nameFa, f.abilityFa, f.piFa]) expect(t).toMatch(persian);
    for (const x of [...techs, ...Object.values(CONTENT.boosters), ...Object.values(CONTENT.rounds), ...Object.values(CONTENT.finals), ...Object.values(CONTENT.feds)]) expect(x.labelFa).toMatch(persian);
  });

  it('Nevlas PI hides the wasteful 1 -> credit and 3 -> ore free actions', () => {
    const snap = ready(['nevlas', 'geodens']);
    const s = st(snap);
    const seat = s.pl.findIndex((pl) => pl.faction === 'nevlas');
    expect(conversions(s, seat).map((c) => c.id)).toContain('pw-c');
    s.hexes.find((h) => h.owner === seat)!.building = 'pi';
    const ids = conversions(s, seat).map((c) => c.id);
    expect(ids).not.toContain('pw-c');
    expect(ids).not.toContain('pw-o');
    expect(ids).toEqual(expect.arrayContaining(['pw-q', 'nev-2c', 'nev-oc', 'nev-2o']));
  });

  it('catalog: complete rules guide sections; the tutorial option is not a host option', () => {
    const c = gaiaProject.catalog;
    expect(c.nameFa).toBe('گایا پراجکت');
    expect(c.nameOriginal).toBe('Gaia Project');
    const sections = c.rulesFa.filter((l) => l.startsWith('## '));
    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const h of ['هدف', 'آماده‌سازی', 'امتیاز', 'پایان بازی', 'نکته']) expect(sections.join(' ')).toContain(h);
    const text = c.rulesFa.join('\n');
    for (const f of Object.values(CONTENT.factions)) for (const t of [f.nameFa, f.abilityFa, f.piFa]) expect(text).toContain(t);
    for (const x of [...Object.values(CONTENT.techs), ...Object.values(CONTENT.boosters), ...Object.values(CONTENT.rounds), ...Object.values(CONTENT.finals)]) expect(text).toContain(x.labelFa);
    for (const f of Object.values(CONTENT.feds).filter((x) => x.copies > 0)) expect(text).toContain(f.labelFa);
    // numbers quoted in the guide that come from the engine tables
    expect(text).toContain('۳، ۳، ۲، ۱، ۱، ۱ سنگ معدن');
    expect(text).toContain('۱، ۱، ۲، ۲، ۳، ۴');
    expect(text).toMatch(/۱۸.*۱۲.*۶/);
    expect(gaiaProject.manifest.options.map((o) => o.key)).toEqual(['factions']);
    expect(gaiaProject.manifest.playerCounts).toEqual({ min: 2, max: 4 });
  });

  it('many more seeded random games end validly; projection never carries internals', () => {
    for (const players of [2, 3, 4]) {
      for (const seed of [4, 5, 6, 7]) {
        const { snap } = playRandom(players, seed);
        const s = st(snap);
        expect(s.outcome, `players ${players} seed ${seed}`).not.toBeNull();
        const places = s.outcome!.placements;
        expect(places.map((x) => x.seat).sort()).toEqual(Array.from({ length: players }, (_, i) => i));
        for (const x of places) expect(x.place).toBe(1 + places.filter((y) => (y.score ?? 0) > (x.score ?? 0)).length);
        const view = projectFor(m, snap, { kind: 'spectator' }).view as Record<string, unknown>;
        expect(view).not.toHaveProperty('ins');
        expect(view).not.toHaveProperty('turnDone');
      }
    }
  }, 240_000);
});
