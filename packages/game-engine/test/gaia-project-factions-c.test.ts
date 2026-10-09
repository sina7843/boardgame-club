import { describe, expect, it } from 'vitest';
import { CONTENT, gaiaProjectModule, incomeOf, powerValue, spendable, type GaiaState } from '@bg/game-gaia-project';
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
const seatOf = (s: GaiaState, f: string) => s.pl.findIndex((x) => x.faction === f);
const own = (s: GaiaState, seat: number) => s.hexes.flatMap((h, i) => (h.owner === seat ? [i] : []));
const total = (s: GaiaState, seat: number) => { const pw = s.pl[seat]!.power; return pw.b1 + pw.b2 + pw.b3 + pw.gaia; };
/** Everyone passes (first booster) so the next round's income and gaia phases run. */
function endRound(snap: EngineSnapshot): EngineSnapshot {
  const r = st(snap).round;
  for (let g = 0; g < 10 && st(snap).round === r && !st(snap).pending.length; g++) {
    const seat = actor(snap);
    snap = act(snap, seat, legal(snap, seat).find((a) => a.type === 'pass'));
  }
  return snap;
}

describe('gaia-project factions-c: Bescods', () => {
  it('income swap: base +1 ore only, stations give knowledge, labs 3/4/5 credits, PI 4 charge + 2 tokens', () => {
    const snap = ready(['bescods', 'geodens']);
    const s = st(snap);
    const b = seatOf(s, 'bescods');
    s.pl[b]!.booster = null;
    s.pl[b]!.research.eco = 0; s.pl[b]!.research.sci = 0;
    const [m1, m2] = own(s, b);
    expect(incomeOf(s, b)).toEqual({ o: 3 }); // base 1 + 2 mines
    s.hexes[m1!]!.building = 'ts';
    expect(incomeOf(s, b)).toEqual({ o: 2, k: 1 });
    s.hexes[m2!]!.building = 'lab';
    expect(incomeOf(s, b)).toEqual({ o: 1, k: 1, c: 3 });
    s.hexes[m1!]!.building = 'lab';
    expect(incomeOf(s, b)).toEqual({ o: 1, c: 7 });
    s.hexes[m1!]!.building = 'pi';
    expect(incomeOf(s, b)).toEqual({ o: 1, c: 3, pw: 4, t: 2 });
  });

  it('special action: one free level on a lowest track, once per round; other tracks rejected without change', () => {
    let snap = ready(['bescods', 'geodens']);
    const b = seatOf(st(snap), 'bescods');
    snap = turnOf(snap, b);
    const s = st(snap);
    s.pl[b]!.research = { terra: 1, nav: 1, ai: 0, gaia: 1, eco: 0, sci: 2 };
    const k = s.pl[b]!.k;
    snap = act(snap, b, { type: 'special', id: 'faction:bescods' });
    expect(st(snap).pending[0]).toMatchObject({ kind: 'research', seat: b, tracks: ['ai', 'eco'] });
    const before = JSON.stringify(st(snap));
    expect(reject(snap, b, { type: 'decide', choice: 'terra' })).not.toBe('ACCEPTED');
    expect(JSON.stringify(st(snap))).toBe(before);
    snap = act(snap, b, { type: 'decide', choice: 'eco' });
    expect(st(snap).pl[b]!.research.eco).toBe(1);
    expect(st(snap).pl[b]!.k).toBe(k); // free: no knowledge paid
    snap = turnOf(snap, b);
    expect(reject(snap, b, { type: 'special', id: 'faction:bescods' })).toBe('ACTION_TAKEN');
  });

  it('special action unavailable when every lowest track is blocked (all at level 4 without a green token)', () => {
    let snap = ready(['bescods', 'geodens']);
    const b = seatOf(st(snap), 'bescods');
    snap = turnOf(snap, b);
    st(snap).pl[b]!.research = { terra: 4, nav: 4, ai: 4, gaia: 4, eco: 4, sci: 4 };
    expect(legal(snap, b).some((a) => a.type === 'special' && a.id === 'faction:bescods')).toBe(false);
    expect(reject(snap, b, { type: 'special', id: 'faction:bescods' })).toBe('NOT_ENOUGH_RESOURCES');
  });

  it('PI: +1 power value on titanium planets only (stacks with std3)', () => {
    const snap = ready(['bescods', 'geodens']);
    const s = st(snap);
    const b = seatOf(s, 'bescods');
    const [t1, t2] = own(s, b);
    const other = s.hexes.findIndex((h) => h.owner === null && h.planet === 'r');
    Object.assign(s.hexes[other]!, { owner: b, building: 'mine' });
    expect(powerValue(s, b, t1!)).toBe(1);
    s.hexes[t2!]!.building = 'pi';
    expect(powerValue(s, b, t1!)).toBe(2);
    expect(powerValue(s, b, other)).toBe(1);
    expect(powerValue(s, b, t2!)).toBe(4);
    s.pl[b]!.techs.push({ id: 'std3', covered: false });
    expect(powerValue(s, b, t2!)).toBe(5);
  });
});

describe('gaia-project factions-c: Itars', () => {
  it('start 5 ore and bowls 4/4/0; income +1 token; knowledge academy 3; burning sends a token to the gaia area', () => {
    let snap = ready(['itars', 'geodens']);
    const it_ = seatOf(st(snap), 'itars');
    const s = st(snap);
    expect(CONTENT.factions.itars!.start).toMatchObject({ o: 5, b1: 4 });
    s.pl[it_]!.booster = null;
    expect(incomeOf(s, it_)).toEqual({ o: 3, k: 1, t: 1 });
    s.hexes[own(s, it_)[0]!]!.building = 'ac1';
    expect(incomeOf(s, it_)).toEqual({ o: 2, k: 4, t: 1 });
    snap = turnOf(snap, it_);
    st(snap).pl[it_]!.power = { b1: 0, b2: 4, b3: 0, gaia: 0, brain: null };
    snap = act(snap, it_, { type: 'burn' });
    expect(st(snap).pl[it_]!.power).toMatchObject({ b2: 2, b3: 1, gaia: 1 });
  });

  it('PI: in the gaia phase 4 gaia tokens buy a tech tile, asked again while 4 remain; the rest return to bowl I', () => {
    let snap = ready(['itars', 'geodens']);
    const it_ = seatOf(st(snap), 'itars');
    let s = st(snap);
    s.hexes[own(s, it_)[0]!]!.building = 'pi';
    s.pl[it_]!.power.gaia = 9;
    snap = endRound(snap);
    s = st(snap);
    expect(s.round).toBe(2);
    expect(s.pending[0]).toMatchObject({ kind: 'custom', seat: it_, source: 'faction:itars', key: 'tech' });
    expect(s.pl[it_]!.power.gaia).toBe(0);
    expect(s.pl[it_]!.mark.itarsAside).toBe(8);
    const start = total(s, it_) + 8;
    snap = act(snap, it_, { type: 'decide', choice: 'yes' });
    expect(st(snap).pending[0]).toMatchObject({ kind: 'tech', seat: it_ });
    const tile = legal(snap, it_).find((a) => a.type === 'decide')!.choice as string;
    snap = act(snap, it_, { type: 'decide', choice: tile });
    while (st(snap).pending[0]?.kind === 'research') snap = act(snap, it_, legal(snap, it_).find((a) => a.type === 'decide'));
    expect(st(snap).pl[it_]!.techs.map((t) => t.id)).toContain(tile);
    expect(st(snap).pending[0]).toMatchObject({ kind: 'custom', key: 'tech' });
    snap = act(snap, it_, { type: 'decide', choice: 'no' });
    s = st(snap);
    expect(s.pl[it_]!.mark.itarsAside).toBe(0);
    expect(total(s, it_)).toBe(start - 4);
  });

  it('PI decision timeout picks "no": all set-aside tokens return to bowl I', () => {
    let snap = ready(['itars', 'geodens']);
    const it_ = seatOf(st(snap), 'itars');
    st(snap).hexes[own(st(snap), it_)[0]!]!.building = 'pi';
    st(snap).pl[it_]!.power.gaia = 5;
    snap = endRound(snap);
    const before = st(snap).pl[it_]!.power.b1;
    expect(st(snap).pl[it_]!.mark.itarsAside).toBe(4);
    const r = applyTimeout(m, snap, 0) as StepResult;
    const s = st(r.snapshot);
    expect(s.pl[it_]!.power.b1).toBe(before + 4);
    expect(s.pl[it_]!.techs).toHaveLength(0);
    expect(s.pending.some((d) => d.kind === 'custom')).toBe(false);
  });

  it('no decision without the PI or with fewer than 4 gaia tokens', () => {
    let snap = ready(['itars', 'geodens']);
    const it_ = seatOf(st(snap), 'itars');
    st(snap).pl[it_]!.power.gaia = 6;
    snap = endRound(snap);
    expect(st(snap).pending.some((d) => d.kind === 'custom')).toBe(false);
    expect(st(snap).pl[it_]!.power.gaia).toBe(0);
  });
});

describe('gaia-project factions-c: Nevlas', () => {
  it('start: science 1, 2 knowledge; labs give 2 power charge instead of knowledge', () => {
    const snap = ready(['nevlas', 'geodens']);
    const s = st(snap);
    const n = seatOf(s, 'nevlas');
    expect(s.pl[n]!.research.sci).toBe(1);
    s.pl[n]!.booster = null;
    s.hexes[own(s, n)[0]!]!.building = 'lab';
    expect(incomeOf(s, n)).toEqual({ o: 2, k: 2, pw: 2 });
  });

  it('free action: bowl III token to the gaia area for 1 knowledge; rejected with an empty bowl III', () => {
    let snap = ready(['nevlas', 'geodens']);
    const n = seatOf(st(snap), 'nevlas');
    snap = turnOf(snap, n);
    st(snap).pl[n]!.power = { b1: 2, b2: 2, b3: 0, gaia: 0, brain: null };
    const before = JSON.stringify(st(snap));
    expect(reject(snap, n, { type: 'convert', id: 'nev-k' })).toBe('NOT_ENOUGH_RESOURCES');
    expect(JSON.stringify(st(snap))).toBe(before);
    st(snap).pl[n]!.power.b3 = 2;
    const k = st(snap).pl[n]!.k;
    snap = act(snap, n, { type: 'convert', id: 'nev-k' });
    expect(st(snap).pl[n]!.power).toMatchObject({ b3: 1, gaia: 1 });
    expect(st(snap).pl[n]!.k).toBe(k + 1);
    expect(st(snap).current).toBe(n); // free action
  });

  it('PI: bowl III tokens count double for power actions and conversions; PI-only conversions', () => {
    let snap = ready(['nevlas', 'geodens']);
    const n = seatOf(st(snap), 'nevlas');
    snap = turnOf(snap, n);
    let s = st(snap);
    s.pl[n]!.power = { b1: 0, b2: 0, b3: 3, gaia: 0, brain: null };
    expect(spendable(s, n)).toBe(3);
    expect(reject(snap, n, { type: 'convert', id: 'nev-oc' })).toBe('NOT_ENOUGH_RESOURCES');
    s.hexes[own(s, n)[0]!]!.building = 'pi';
    expect(spendable(s, n)).toBe(6);
    const o = s.pl[n]!.o, c = s.pl[n]!.c;
    snap = act(snap, n, { type: 'convert', id: 'nev-oc' });
    s = st(snap);
    expect(s.pl[n]!.power).toMatchObject({ b1: 2, b3: 1 });
    expect([s.pl[n]!.o, s.pl[n]!.c]).toEqual([o + 1, c + 1]);
    s.pl[n]!.power = { b1: 0, b2: 0, b3: 4, gaia: 0, brain: null };
    const k = s.pl[n]!.k;
    snap = act(snap, n, { type: 'power', id: 'pw1' }); // 7 power = 4 tokens
    expect(st(snap).pl[n]!.power).toMatchObject({ b1: 4, b3: 0 });
    expect(st(snap).pl[n]!.k).toBe(k + 3);
  });
});

// ---------- seeded random games with these factions ----------
const lcg = (seed: number) => { let x = seed >>> 0; return (k: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % k; }; };

function playRandom(factions: string[], seed: number) {
  const rnd = lcg(seed * 7919 + factions.length);
  const setup = { playerCount: factions.length, seed, options: {} };
  let snap = startGame(m, setup).snapshot;
  const inputs: ReplayInput[] = [];
  let free = 0, fi = 0;
  for (let step = 0; step < 6000 && !st(snap).outcome; step++) {
    const seat = actor(snap);
    const all = legal(snap, seat).filter((a) => a.type !== 'resign');
    let pick;
    if (st(snap).phase === 'faction') pick = { type: 'faction', faction: factions[fi++] };
    else {
      const main = all.filter((a) => a.type !== 'convert' && a.type !== 'burn' && a.type !== 'pass');
      const passes = all.filter((a) => a.type === 'pass');
      const frees = all.filter((a) => a.type === 'convert' || a.type === 'burn');
      if (frees.length && free < 2 && rnd(6) === 0) { pick = frees[rnd(frees.length)]; free++; }
      else if (main.length && (passes.length === 0 || rnd(8) !== 0)) { pick = main[rnd(main.length)]; free = 0; }
      else { pick = passes[rnd(passes.length)] ?? all[0]; free = 0; }
    }
    inputs.push({ kind: 'action', actor: p(seat), action: pick, logicalTime: step });
    snap = act(snap, seat, pick);
  }
  return { snap, inputs, setup };
}

describe('gaia-project factions-c: random games', () => {
  it('seeded random games with Bescods, Itars and Nevlas terminate with a valid outcome and replay', () => {
    for (const [factions, seed] of [[['bescods', 'itars', 'geodens'], 1], [['nevlas', 'bescods'], 2], [['itars', 'ambas', 'bescods', 'xenos'], 3]] as const) {
      const { snap, inputs, setup } = playRandom([...factions], seed);
      const s = st(snap);
      expect(s.outcome, `${factions.join(',')} round ${s.round}`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(factions.length);
      expect(s.round).toBe(6);
      if (seed === 1) expect(replay(m, setup, inputs).state).toEqual(s);
    }
  }, 120_000);
});
