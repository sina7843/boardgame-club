import { describe, expect, it } from 'vitest';
import { CONTENT, TRACKS, gaiaProjectModule, incomeOf, type GaiaState, type Planet } from '@bg/game-gaia-project';
import { applyAction, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput } from '../src/index.ts';

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
const emptyBoard = (s: GaiaState) => s.hexes.forEach((h) => { h.owner = null; h.building = null; h.extra = null; h.sats = []; h.feds = []; });

/** Seat 0 to act on an empty board; round tiles that never fire in these tests (r3 = mines only). */
function table(): EngineSnapshot {
  const snap = turnOf(ready(['geodens', 'firaks']), 0);
  const s = st(snap);
  emptyBoard(s);
  s.roundTiles = s.roundTiles.map(() => 'r3');
  s.pl[0]!.booster = 'b1';
  return snap;
}
/** Place seat-0 structures; picks hexes by predicate, distinct each time. */
function place(s: GaiaState, n: number, building: 'mine' | 'ts' | 'lab', ok: (i: number) => boolean) {
  const out: number[] = [];
  for (let i = 0; i < s.hexes.length && out.length < n; i++) {
    const h = s.hexes[i]!;
    if (h.owner === null && h.planet !== 'e' && h.planet !== 'm' && h.planet !== 'l' && ok(i)) {
      Object.assign(h, { owner: 0, building });
      out.push(i);
    }
  }
  expect(out).toHaveLength(n);
  return out;
}
/** Take a standard tile from a free space (no track advance; a free research decision follows). */
function takeStd(snap: EngineSnapshot, id: string) {
  const s = st(snap);
  const pos = s.techBoard.std.indexOf(id);
  [s.techBoard.std[pos], s.techBoard.std[6]] = [s.techBoard.std[6]!, id];
  s.pending = [{ kind: 'tech', seat: 0 }];
  snap = act(snap, 0, { type: 'decide', choice: id });
  expect(st(snap).pending[0]).toMatchObject({ kind: 'research', seat: 0 });
  return snap;
}
/** Take an advanced tile: level 4 on its track, one green federation, covers std2 (level 5 then blocked). */
function takeAdv(snap: EngineSnapshot, id: string) {
  const s = st(snap);
  if (!(id in s.advPos) || s.techBoard.adv[s.advPos[id]!] !== id) { s.techBoard.adv[0] = id; s.advPos[id] = 0; }
  s.pl[0]!.research[TRACKS[s.advPos[id]!]!] = 4;
  s.pl[0]!.feds.push({ id: 'fed2', green: true });
  s.pl[0]!.techs.push({ id: 'std2', covered: false });
  s.pending = [{ kind: 'tech', seat: 0 }];
  snap = act(snap, 0, { type: 'decide', choice: id });
  expect(st(snap).pending[0]).toMatchObject({ kind: 'cover', seat: 0, adv: id });
  snap = act(snap, 0, { type: 'decide', choice: 'std2' });
  expect(st(snap).pl[0]!.techs).toEqual(expect.arrayContaining([{ id: 'std2', covered: true }, { id, covered: false }]));
  return snap;
}
const typesOf = (s: GaiaState, types: Planet[]) => (i: number) => types.includes(s.hexes[i]!.planet);

describe('gaia-project tech tiles: registry', () => {
  it('all 9 standard and 15 advanced tiles exist with Persian labels', () => {
    const all = Object.values(CONTENT.techs);
    expect(all.filter((t) => t.kind === 'std').map((t) => t.id).sort()).toEqual(Array.from({ length: 9 }, (_, i) => `std${i + 1}`).sort());
    expect(all.filter((t) => t.kind === 'adv').map((t) => t.id).sort()).toEqual(Array.from({ length: 15 }, (_, i) => `adv${i + 1}`).sort());
    for (const t of all) expect(t.labelFa).toMatch(/[؀-ۿ]/);
    const s = st(startGame(m, { playerCount: 2, seed: 4, options: {} }).snapshot);
    expect(s.techBoard.std.every(Boolean)).toBe(true);
    expect(s.techBoard.adv.filter(Boolean)).toHaveLength(6);
  });
});

describe('gaia-project standard tiles', () => {
  it('std2: immediately 7 VP', () => {
    let snap = table();
    const vp = st(snap).pl[0]!.vp;
    snap = takeStd(snap, 'std2');
    expect(st(snap).pl[0]!.vp).toBe(vp + 7);
  });

  it('std4: immediately 1 knowledge per colonized planet type (gaiaformers do not count)', () => {
    let snap = table();
    const s = st(snap);
    place(s, 2, 'mine', typesOf(s, ['r']));
    place(s, 1, 'ts', typesOf(s, ['o']));
    place(s, 1, 'mine', typesOf(s, ['g']));
    const tr = s.hexes.findIndex((h) => h.planet === 'm' && h.owner === null);
    Object.assign(s.hexes[tr]!, { owner: 0, building: 'gf' });
    s.pl[0]!.k = 0;
    snap = takeStd(snap, 'std4');
    expect(st(snap).pl[0]!.k).toBe(3);
  });

  it('std6 / std8: income while held; a covered tile no longer pays; the income phase really pays it', () => {
    const snap = table();
    const s = st(snap);
    const base = incomeOf(s, 0);
    s.pl[0]!.techs.push({ id: 'std6', covered: false }, { id: 'std8', covered: false });
    const withTiles = incomeOf(s, 0);
    expect((withTiles.k ?? 0) - (base.k ?? 0)).toBe(1);
    expect((withTiles.c ?? 0) - (base.c ?? 0)).toBe(5);
    s.pl[0]!.techs.find((t) => t.id === 'std8')!.covered = true;
    expect((incomeOf(s, 0).c ?? 0) - (base.c ?? 0)).toBe(1);
    s.pl[0]!.techs.find((t) => t.id === 'std6')!.covered = true;
    expect(incomeOf(s, 0)).toEqual(base);
  });

  it('income phase pays std8 4 credits at the start of the next round', () => {
    let snap = table();
    st(snap).pl[0]!.techs.push({ id: 'std8', covered: false });
    for (let g = 0; g < 4 && st(snap).round === 1; g++) {
      const seat = actor(snap);
      st(snap).pending = [];
      st(snap).pl[seat]!.c = 0;
      snap = act(snap, seat, { type: 'pass', booster: st(snap).boosters[0] });
    }
    const s = st(snap);
    expect(s.round).toBe(2);
    expect(s.pl[0]!.c).toBe(incomeOf(s, 0).c);
    s.pl[0]!.techs[0]!.covered = true;
    expect((incomeOf(s, 0).c ?? 0)).toBe((s.pl[0]!.c) - 4);
  });
});

describe('gaia-project advanced tiles: immediate', () => {
  it('adv5: 4 VP per trading station', () => {
    let snap = table();
    const s = st(snap);
    place(s, 2, 'ts', () => true);
    place(s, 1, 'lab', () => true);
    const vp = s.pl[0]!.vp;
    snap = takeAdv(snap, 'adv5');
    expect(st(snap).pl[0]!.vp).toBe(vp + 8);
  });

  it('adv6: 5 VP per federation token held (spent ones count)', () => {
    let snap = table();
    st(snap).pl[0]!.feds.push({ id: 'fed1', green: false }, { id: 'fed4', green: false });
    const vp = st(snap).pl[0]!.vp;
    snap = takeAdv(snap, 'adv6'); // + the green token spent on this tile = 3 tokens
    expect(st(snap).pl[0]!.vp).toBe(vp + 15);
  });

  it('adv7 / adv8: 2 VP and 1 ore per sector you are in', () => {
    for (const [id, check] of [
      ['adv7', (a: GaiaState, b: GaiaState) => expect(b.pl[0]!.vp - a.pl[0]!.vp).toBe(6)],
      ['adv8', (a: GaiaState, b: GaiaState) => expect(b.pl[0]!.o - a.pl[0]!.o).toBe(3)]
    ] as const) {
      let snap = table();
      const s = st(snap);
      const sectors = [...new Set(s.hexes.map((h) => h.sector))].slice(0, 3);
      for (const sec of sectors) place(s, 2, 'mine', (i) => s.hexes[i]!.sector === sec);
      s.pl[0]!.o = 0;
      const before = structuredClone(s);
      snap = takeAdv(snap, id);
      check(before, st(snap));
    }
  });

  it('adv9: 2 VP per colonized gaia planet', () => {
    let snap = table();
    const s = st(snap);
    const gaia = s.hexes.flatMap((h, i) => (h.planet === 'g' ? [i] : [])).slice(0, 2);
    expect(gaia).toHaveLength(2);
    for (const i of gaia) Object.assign(s.hexes[i]!, { owner: 0, building: 'mine' });
    place(s, 1, 'mine', typesOf(s, ['r']));
    const vp = s.pl[0]!.vp;
    snap = takeAdv(snap, 'adv9');
    expect(st(snap).pl[0]!.vp).toBe(vp + 4);
  });
});

describe('gaia-project advanced tiles: pass', () => {
  it('adv2: 3 VP per research lab when passing; adv3: 1 VP per planet type', () => {
    let snap = table();
    const s = st(snap);
    place(s, 2, 'lab', typesOf(s, ['r']));
    place(s, 1, 'mine', typesOf(s, ['o']));
    s.pl[0]!.techs.push({ id: 'adv2', covered: false }, { id: 'adv3', covered: false });
    const vp = s.pl[0]!.vp;
    snap = act(snap, 0, { type: 'pass', booster: s.boosters[0] });
    expect(st(snap).pl[0]!.vp).toBe(vp + 6 + 2);
    expect(st(snap).log.filter((e) => e.t === 'vp' && e.why === 'tech').map((e) => (e as { n: number }).n)).toEqual([6, 2]);
  });

  it('adv2 also scores when passing in round 6', () => {
    let snap = table();
    const s = st(snap);
    s.round = 6;
    place(s, 1, 'lab', () => true);
    s.pl[0]!.techs.push({ id: 'adv2', covered: false });
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).log.some((e) => e.t === 'vp' && e.why === 'tech' && e.n === 3)).toBe(true);
  });
});

describe('gaia-project advanced tiles: special actions', () => {
  for (const [id, res] of [['adv10', { q: 1, c: 5 }], ['adv11', { o: 3 }], ['adv12', { k: 3 }]] as const) {
    it(`${id}: once per round, gives ${JSON.stringify(res)}`, () => {
      let snap = table();
      const s = st(snap);
      Object.assign(s.pl[0]!, { c: 0, o: 0, k: 0, q: 0 });
      s.pl[0]!.techs.push({ id, covered: false });
      expect(legal(snap, 0)).toContainEqual({ type: 'special', id: `tech:${id}` });
      snap = act(snap, 0, { type: 'special', id: `tech:${id}` });
      expect(st(snap).pl[0]).toMatchObject({ c: 0, o: 0, k: 0, q: 0, ...res });
      snap = turnOf(snap, 0);
      expect(reject(snap, 0, { type: 'special', id: `tech:${id}` })).toBe('ACTION_TAKEN');
    });
  }

  it('taking adv11 makes its action available the same round', () => {
    let snap = takeAdv(table(), 'adv11');
    snap = turnOf(snap, 0);
    st(snap).turnDone = false;
    st(snap).pl[0]!.o = 0;
    snap = act(snap, 0, { type: 'special', id: 'tech:adv11' });
    expect(st(snap).pl[0]!.o).toBe(3);
  });
});

describe('gaia-project advanced tiles: triggers', () => {
  it('adv13: 3 VP for each trading station built (not for labs)', () => {
    let snap = table();
    const s = st(snap);
    const [a, b] = place(s, 2, 'mine', () => true);
    Object.assign(s.pl[0]!, { c: 30, o: 15 });
    s.pl[0]!.techs.push({ id: 'adv13', covered: false });
    const vp = s.pl[0]!.vp;
    snap = act(snap, 0, { type: 'upgrade', hex: a!, to: 'ts' });
    expect(st(snap).pl[0]!.vp).toBe(vp + 3);
    snap = turnOf(snap, 0);
    snap = act(snap, 0, { type: 'upgrade', hex: b!, to: 'ts' });
    expect(st(snap).pl[0]!.vp).toBe(vp + 6);
    snap = turnOf(snap, 0);
    snap = act(snap, 0, { type: 'upgrade', hex: a!, to: 'lab' });
    expect(st(snap).pl[0]!.vp).toBe(vp + 6);
  });

  it('adv15: 2 VP for every research step, paid or free', () => {
    let snap = table();
    const s = st(snap);
    s.pl[0]!.k = 15;
    s.pl[0]!.techs.push({ id: 'adv15', covered: false });
    const vp = s.pl[0]!.vp;
    snap = act(snap, 0, { type: 'research', track: 'eco' });
    expect(st(snap).pl[0]!.vp).toBe(vp + 2);
    snap = turnOf(snap, 0);
    snap = takeStd(snap, 'std6'); // free research step from a free space
    snap = act(snap, 0, { type: 'decide', choice: 'sci' });
    expect(st(snap).pl[0]!.vp).toBe(vp + 4);
  });

  it('adv15 taken by covering: the track step it grants scores 2 VP', () => {
    let snap = table();
    const s = st(snap);
    s.pl[0]!.techs.push({ id: 'std8', covered: false });
    s.techBoard.adv[2] = 'adv15'; s.advPos.adv15 = 2; // AI track
    s.pl[0]!.research.ai = 3;
    s.pl[0]!.feds.push({ id: 'fed2', green: true });
    // level 3 on its track is not enough
    s.pending = [{ kind: 'tech', seat: 0 }];
    expect(reject(snap, 0, { type: 'decide', choice: 'adv15' })).not.toBe('ACCEPTED');
    s.pl[0]!.research.ai = 4;
    const vp = s.pl[0]!.vp;
    snap = act(snap, 0, { type: 'decide', choice: 'adv15' });
    snap = act(snap, 0, { type: 'decide', choice: 'std8' });
    // level 5 is blocked (the only green token was spent): no step, no VP
    expect(st(snap).pl[0]!.research.ai).toBe(4);
    expect(st(snap).pl[0]!.vp).toBe(vp);
  });
});

// Deterministic test RNG for random play.
const lcg = (seed: number) => { let x = seed >>> 0; return (n: number) => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % n; }; };

function playRandom(players: number, seed: number) {
  const rnd = lcg(seed * 104729 + players);
  let snap = startGame(m, { playerCount: players, seed, options: { factions: 'random' } }).snapshot;
  const inputs: ReplayInput[] = [];
  for (let step = 0; step < 6000 && !st(snap).outcome; step++) {
    const seat = actor(snap);
    const all = legal(snap, seat).filter((a) => a.type !== 'resign');
    const main = all.filter((a) => a.type !== 'convert' && a.type !== 'burn' && a.type !== 'pass');
    const passes = all.filter((a) => a.type === 'pass');
    // Prefer tech-tile choices and tech actions so the tiles really get exercised.
    const tech = main.filter((a) => (a.type === 'decide' && /^(std|adv)\d+$/.test(String(a.choice))) || (a.type === 'special' && String(a.id).startsWith('tech:'))
      || (a.type === 'upgrade' && a.to === 'lab'));
    let pick;
    if (tech.length && rnd(2) === 0) pick = tech[rnd(tech.length)];
    else if (main.length && (passes.length === 0 || rnd(8) !== 0)) pick = main[rnd(main.length)];
    else pick = passes[rnd(passes.length)] ?? all[0];
    inputs.push({ kind: 'action', actor: p(seat), action: pick, logicalTime: step });
    snap = act(snap, seat, pick);
  }
  return { snap, inputs };
}

describe('gaia-project tech tiles: random games', () => {
  it('seeded random games taking tech tiles terminate with a valid outcome and replay deterministically', () => {
    const taken = new Set<string>();
    for (const [players, seed] of [[2, 11], [3, 12], [4, 13]] as const) {
      const { snap, inputs } = playRandom(players, seed);
      const s = st(snap);
      expect(s.outcome, `players ${players} seed ${seed}`).not.toBeNull();
      expect(s.outcome!.placements).toHaveLength(players);
      for (const e of s.log) if (e.t === 'tech') taken.add(e.tech);
      if (players === 2) expect(replay(m, { playerCount: players, seed, options: { factions: 'random' } }, inputs).state).toEqual(s);
    }
    expect([...taken].filter((t) => ['std2', 'std4', 'std6', 'std8'].includes(t)).length).toBeGreaterThan(0);
  }, 120_000);
});
