import { describe, expect, it } from 'vitest';
import { allClues, buildCells, cryptid, cryptidModule, dist, fits, CELLS, TUTORIAL, type CryptidState, type CryptidView, type Clue } from '@bg/game-cryptid';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = cryptidModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CryptidState;
const game = (players = 3, seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: players, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const step = (snap: EngineSnapshot, seat: number, action: unknown) => applyAction(m, snap, p(seat), action, 0) as StepResult;
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const all = [...Array(CELLS).keys()];
const candidates = (s: CryptidState) => all.filter((i) => s.clues.every((c) => fits(s.cells, c, i)));
/** Play the opening (each player places 2 cubes on the first cell their clue rules out). */
function opened(snap: EngineSnapshot) {
  while (st(snap).phase === 'opening') {
    const s = st(snap);
    const c = all.find((i) => s.cubes[i] === null && !fits(s.cells, s.clues[s.current]!, i))!;
    snap = act(snap, s.current, { type: 'placeCube', cell: c });
  }
  return snap;
}

describe('cryptid board and clues', () => {
  it('hex distance on the odd-q grid', () => {
    expect(dist(0, 0)).toBe(0);
    expect(dist(0, 1)).toBe(1); // (0,0)–(1,0): odd column sits half a hex lower
    expect(dist(0, 13)).toBe(2); // (0,0)–(1,1)
    expect(dist(1, 12)).toBe(1); // (1,0)–(0,1)
    expect(dist(13, 26)).toBe(1); // (1,1)–(2,2)
    expect(dist(13, 2)).toBe(2); // (1,1)–(2,0)
    expect(dist(0, 11)).toBe(11);
    expect(dist(0, 107)).toBe(Math.max(11, 8 + 6));
  });

  it('within-n clues count the cell itself; negatives invert; the catalogue matches the rules text', () => {
    const cells = buildCells(TUTORIAL.tiles, TUTORIAL.structures);
    const forest = cells.findIndex((c) => c.terrain === 'forest');
    expect(fits(cells, { d: 1, a: 'forest', not: false }, forest)).toBe(true);
    expect(fits(cells, { d: 1, a: 'forest', not: true }, forest)).toBe(false);
    expect(fits(cells, { d: 0, a: 'forest', b: 'water', not: false }, forest)).toBe(true);
    expect(fits(cells, { d: 3, a: 'blue', not: false }, 49)).toBe(true); // the blue stone itself
    expect(fits(cells, { d: 2, a: 'bear', not: false }, 0)).toBe(true);
    expect(allClues(false)).toHaveLength(10 + 6 + 4 + 3);
    expect(allClues(true)).toHaveLength((10 + 6 + 4 + 4) * 2);
    expect(allClues(false).some((c) => c.a === 'black')).toBe(false);
  });

  it('setup for 3–5 players: 108 cells, structures on land, one secret clue each, exactly one answer, no redundant clue', () => {
    for (const players of [3, 4, 5]) for (const mode of ['standard', 'advanced']) for (let seed = 0; seed < 8; seed++) {
      const s = st(game(players, seed, { mode }));
      expect(s.cells).toHaveLength(108);
      expect(s.clues).toHaveLength(players);
      const structs = s.cells.filter((c) => c.structure);
      expect(structs).toHaveLength(mode === 'advanced' ? 8 : 6);
      expect(structs.every((c) => c.terrain !== 'water')).toBe(true);
      expect(structs.some((c) => c.structure!.color === 'black')).toBe(mode === 'advanced');
      expect(s.cells.filter((c) => c.animal === 'bear')).toHaveLength(9);
      expect(s.cells.filter((c) => c.animal === 'cougar')).toHaveLength(9);
      expect(candidates(s)).toEqual([s.answer]);
      s.clues.forEach((_, k) => expect(all.filter((i) => s.clues.every((c, j) => j === k || fits(s.cells, c, i))).length).toBeGreaterThan(1));
      if (mode === 'standard') expect(s.clues.every((c) => !c.not)).toBe(true);
      expect(s.phase).toBe('opening');
      expect(new Set(s.tiles.map((t) => t.id)).size).toBe(6);
    }
    expect(() => game(2)).toThrow();
    expect(() => game(6)).toThrow();
    expect(st(game(3, 4))).toEqual(st(game(3, 4)));
  });
});

describe('cryptid turns', () => {
  it('opening: two cubes each in seat order on cells the own clue rules out, then the first player starts', () => {
    let snap = game(4, 3);
    const s0 = st(snap);
    const first = s0.current;
    const order: number[] = [];
    while (st(snap).phase === 'opening') {
      const s = st(snap);
      order.push(s.current);
      const allowed = all.find((i) => s.cubes[i] === null && fits(s.cells, s.clues[s.current]!, i))!;
      expect(reject(snap, s.current, { type: 'placeCube', cell: allowed })).toBe('CLUE_FORBIDS');
      expect(reject(snap, s.current, { type: 'search', cell: allowed })).toBe('WRONG_PHASE');
      expect(reject(snap, (s.current + 1) % 4, { type: 'placeCube', cell: 0 })).toBe('NOT_YOUR_TURN');
      const c = all.find((i) => s.cubes[i] === null && !fits(s.cells, s.clues[s.current]!, i))!;
      snap = act(snap, s.current, { type: 'placeCube', cell: c });
      expect(reject(snap, st(snap).current, { type: 'placeCube', cell: c })).toBe(st(snap).phase === 'opening' ? 'CELL_OCCUPIED' : 'WRONG_PHASE');
    }
    expect(order).toEqual([0, 1, 2, 3, 0, 1, 2, 3].map((k) => (first + k) % 4));
    expect(st(snap).current).toBe(first);
    expect(st(snap).cubes.filter((c) => c !== null)).toHaveLength(8);
  });

  it('question: yes places the target\'s disc and passes the turn; no places their cube and the asker owes a cube', () => {
    let snap = opened(game(3, 5));
    const s = st(snap);
    const me = s.current, t = (me + 1) % 3;
    const yesCell = all.find((i) => s.cubes[i] === null && fits(s.cells, s.clues[t]!, i))!;
    const before = structuredClone(s);
    expect(reject(snap, me, { type: 'question', target: me, cell: yesCell })).toBe('INVALID_TARGET');
    expect(reject(snap, me, { type: 'question', target: 3, cell: yesCell })).toBe('INVALID_TARGET');
    expect(reject(snap, me, { type: 'question', target: t, cell: 200 })).toBe('INVALID_ACTION');
    const cubed = s.cubes.findIndex((c) => c !== null);
    expect(reject(snap, me, { type: 'question', target: t, cell: cubed })).toBe('CELL_OCCUPIED');
    expect(reject(snap, t, { type: 'question', target: me, cell: yesCell })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, me, { type: 'placeCube', cell: yesCell })).toBe('WRONG_PHASE');
    expect(st(snap)).toEqual(before); // rejections never mutate
    const r = step(snap, me, { type: 'question', target: t, cell: yesCell });
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    snap = r.snapshot;
    expect(st(snap).discs[yesCell]).toEqual([t]);
    expect(st(snap).current).toBe(t);
    expect(st(snap).log.at(-1)).toEqual({ t: 'question', seat: me, target: t, cell: yesCell, yes: true });
    const s2 = st(snap);
    const asker = s2.current, target = me;
    const probe = structuredClone(snap);
    st(probe).discs[yesCell]!.push(me); // `me` already answered there
    expect(reject(probe, asker, { type: 'question', target: me, cell: yesCell })).toBe('ALREADY_ANSWERED');
    const noCell = all.find((i) => s2.cubes[i] === null && !fits(s2.cells, s2.clues[target]!, i))!;
    const r2 = step(snap, asker, { type: 'question', target, cell: noCell });
    expect(r2.scheduleChanges).toEqual([]); // the same player keeps the turn deadline for their cube
    snap = r2.snapshot;
    expect(st(snap).cubes[noCell]).toBe(target);
    expect(st(snap).phase).toBe('penalty');
    expect(st(snap).current).toBe(asker);
    expect(reject(snap, asker, { type: 'question', target, cell: yesCell })).toBe('WRONG_PHASE');
    const own = all.find((i) => st(snap).cubes[i] === null && !fits(s2.cells, s2.clues[asker]!, i))!;
    snap = act(snap, asker, { type: 'placeCube', cell: own });
    expect(st(snap).phase).toBe('turn');
    expect(st(snap).current).toBe((asker + 1) % 3);
  });

  it('search: refuted by the first player in seat order whose clue says no, then the searcher owes a cube', () => {
    let snap = opened(game(4, 8));
    const s = st(snap);
    const me = s.current;
    // a cell my clue allows, that the next player allows but the one after rules out
    const a = (me + 1) % 4, b = (me + 2) % 4;
    const cell = all.find((i) => s.cubes[i] === null && fits(s.cells, s.clues[me]!, i) && fits(s.cells, s.clues[a]!, i) && !fits(s.cells, s.clues[b]!, i))!;
    expect(cell).toBeDefined();
    const notMine = all.find((i) => s.cubes[i] === null && !fits(s.cells, s.clues[me]!, i))!;
    expect(reject(snap, me, { type: 'search', cell: notMine })).toBe('CLUE_FORBIDS');
    snap = act(snap, me, { type: 'search', cell });
    const t = st(snap);
    expect(t.discs[cell]!.sort()).toEqual([me, a].sort());
    expect(t.cubes[cell]).toBe(b);
    expect(t.log.at(-1)).toEqual({ t: 'search', seat: me, cell, results: [{ seat: a, yes: true }, { seat: b, yes: false }] });
    expect(t.phase).toBe('penalty');
    expect(t.outcome).toBeNull();
  });

  it('a successful search wins at once; everyone else shares place 2; clues are revealed', () => {
    let snap = opened(game(3, 11));
    const s = st(snap);
    const r = step(snap, s.current, { type: 'search', cell: s.answer });
    expect(r.outcome?.reason).toBe('win');
    expect(r.outcome?.placements[0]).toEqual({ seat: s.current, place: 1 });
    expect(r.outcome?.placements.slice(1).map((x) => x.place)).toEqual([2, 2]);
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    snap = r.snapshot;
    expect(st(snap).discs[s.answer]).toHaveLength(3);
    const v = projectFor(m, snap, { kind: 'spectator' }).view as CryptidView;
    expect(v.reveal).toEqual({ clues: s.clues, answer: s.answer });
    expect(reject(snap, 0, { type: 'resign' })).toBe('GAME_FINISHED');
  });

  it('a cube can never land on the answer', () => {
    const s = st(opened(game(5, 2)));
    for (let k = 0; k < 5; k++) expect(fits(s.cells, s.clues[k]!, s.answer)).toBe(true);
    expect(s.cubes[s.answer]).toBeNull();
  });
});

describe('cryptid timeouts, resign and projection', () => {
  it('timeouts: an owed cube is auto-placed; a missed turn is skipped; two missed turns in a row remove the player', () => {
    let snap = game(3, 6);
    const first = st(snap).current;
    snap = applyTimeout(m, snap, 0).snapshot;
    const s = st(snap);
    const c = all.find((i) => !fits(s.cells, s.clues[first]!, i))!;
    expect(s.cubes[c]).toBe(first);
    expect(s.log.at(-1)).toMatchObject({ t: 'cube', seat: first, auto: true, opening: true });
    snap = opened(snap);
    const me = st(snap).current;
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).log.at(-1)).toEqual({ t: 'skip', seat: me });
    expect(st(snap).current).toBe((me + 1) % 3);
    snap = applyTimeout(m, snap, 0).snapshot; // next player skipped once
    snap = applyTimeout(m, snap, 0).snapshot; // third player skipped once
    const r = applyTimeout(m, snap, 0); // `me` misses a second time in a row
    expect(st(r.snapshot).active[me]).toBe(false);
    expect(st(r.snapshot).log.at(-1)).toEqual({ t: 'out', seat: me, why: 'timeout' });
    expect(r.outcome).toBeNull();
    // an own action resets the counter
    let s2 = opened(game(3, 6));
    const k = st(s2).current;
    s2 = applyTimeout(m, s2, 0).snapshot;
    expect(st(s2).misses[k]).toBe(1);
  });

  it('resign: the player leaves (last place) but their clue still answers; the last player left wins', () => {
    let snap = opened(game(3, 9));
    const s = st(snap);
    const cur = s.current, other = (cur + 1) % 3, third = (cur + 2) % 3;
    snap = act(snap, other, { type: 'resign' });
    expect(st(snap).active[other]).toBe(false);
    expect(reject(snap, other, { type: 'resign' })).toBe('ALREADY_RESIGNED');
    expect(projectFor(m, snap, p(other)).legalActions).toEqual([]);
    // the resigned player's clue still refutes a search
    const cell = all.find((i) => st(snap).cubes[i] === null && fits(s.cells, s.clues[cur]!, i) && !fits(s.cells, s.clues[other]!, i))!;
    snap = act(snap, cur, { type: 'search', cell });
    expect(st(snap).cubes[cell]).toBe(other);
    // a resign during your own penalty passes the turn to the next active player
    snap = act(snap, cur, { type: 'resign' });
    expect(st(snap).outcome).toEqual({ placements: [{ seat: third, place: 1 }, { seat: other, place: 2 }, { seat: cur, place: 2 }], reason: 'resign' });

    // with 4 players a resign on your own turn passes it on
    let g = opened(game(4, 1));
    const c4 = st(g).current;
    g = act(g, c4, { type: 'resign' });
    expect(st(g).current).toBe((c4 + 1) % 4);
    expect(st(g).phase).toBe('turn');
    g = act(g, st(g).current, { type: 'search', cell: st(g).answer });
    expect(st(g).outcome?.placements.find((x) => x.seat === c4)?.place).toBe(4);
  });

  it('projection: own clue only; no clues, answer or RNG for opponents and spectators until the end', () => {
    const snap = opened(game(4, 12));
    const s = st(snap);
    for (let k = 0; k < 4; k++) {
      const v = projectFor(m, snap, p(k)).view as CryptidView;
      expect(v.myClue).toEqual(s.clues[k]);
      expect(v.reveal).toBeNull();
      const json = JSON.stringify(v);
      expect(json).not.toContain('"clues"');
      expect(json).not.toContain('"answer"');
      expect(json).not.toContain('"misses"');
      expect(json).not.toContain('"rng"');
    }
    const sp = projectFor(m, snap, { kind: 'spectator' });
    expect((sp.view as CryptidView).myClue).toBeNull();
    expect(sp.legalActions).toEqual([]);
    expect(JSON.stringify(sp.view)).not.toMatch(/"clues"|"answer"/);
    // legal actions of a waiting player never list cells derived from someone else's clue
    const waiting = (s.current + 1) % 4;
    expect(projectFor(m, snap, p(waiting)).legalActions).toEqual([{ type: 'resign' }]);
    const mine = projectFor(m, snap, p(s.current)).legalActions;
    const search = mine.find((h) => h.type === 'search')!.cells as number[];
    expect(search).toEqual(all.filter((i) => s.cubes[i] === null && fits(s.cells, s.clues[s.current]!, i)));
    expect(mine.filter((h) => h.type === 'question').map((h) => h.target)).toEqual([1, 2, 3].map((k) => (s.current + k) % 4));
  });
});

describe('cryptid full games and tutorial', () => {
  it('seeded random games terminate with a valid winner and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 77 + g });
      const players = 3 + (g % 3);
      const setup = { playerCount: players, seed: 500 + g, options: { mode: g % 2 ? 'advanced' : 'standard' } };
      let snap = startGame(m, setup).snapshot;
      const inputs: ReplayInput[] = [];
      for (let n = 0; n < 4000 && !st(snap).outcome; n++) {
        const s = st(snap);
        if (n % 97 === 50) { snap = applyTimeout(m, snap, 0).snapshot; inputs.push({ kind: 'timeout', logicalTime: 0 }); continue; }
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign' && (h.cells as number[]).length);
        const searches = hints.filter((h) => h.type === 'search');
        const h = searches.length && rng.nextInt(4) === 0 ? searches[0]! : hints[rng.nextInt(hints.length)]!;
        const cells = h.cells as number[];
        const action = { type: h.type, ...(h.type === 'question' ? { target: h.target } : {}), cell: cells[rng.nextInt(cells.length)] };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.cubes[t.answer]).toBeNull();
      }
      const s = st(snap);
      expect(s.outcome, `game ${g}`).not.toBeNull();
      expect(s.outcome!.placements.filter((x) => x.place === 1)).toHaveLength(1);
      expect(s.outcome!.placements.map((x) => x.seat).sort()).toEqual([...Array(players).keys()]);
      if (s.outcome!.reason === 'win') expect(s.log.at(-1)).toMatchObject({ t: 'search', cell: s.answer });
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);

  it('tutorial script is legal and ends with the learner finding the creature', () => {
    const tu = cryptidModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    expect(tu.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    const s0 = st(snap);
    expect(candidates(s0)).toEqual([40]);
    expect(s0.clues).toEqual([{ d: 1, a: 'forest', not: false }, { d: 3, a: 'blue', not: false }] satisfies Clue[]);
    expect(all.filter((i) => fits(s0.cells, s0.clues[0]!, i))).toHaveLength(49);
    expect(all.filter((i) => fits(s0.cells, s0.clues[1]!, i))).toHaveLength(29);
    expect(s0.current).toBe(0);
    expect(s0.phase).toBe('turn');
    for (const stp of tu.steps) {
      const r = step(snap, 0, stp.expected);
      expect('ok' in r, JSON.stringify(stp.expected)).toBe(false);
      snap = r.snapshot;
      if (stp.reply) {
        expect(r.pendingSeats).toEqual([1]);
        snap = act(snap, 1, stp.reply);
      }
      if (!st(snap).outcome) expect(st(snap).current).toBe(0);
    }
    const s = st(snap);
    expect(s.outcome).toEqual({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }], reason: 'win' });
    expect(s.cubes.filter((c) => c !== null)).toHaveLength(4 + 4);
  });
});

describe('cryptid audit regressions', () => {
  it('another player resigning does not restart the current player\'s turn clock; your own resign does', () => {
    const snap = opened(game(4, 2));
    const cur = st(snap).current;
    const other = step(snap, (cur + 2) % 4, { type: 'resign' });
    expect(other.scheduleChanges).toEqual([]);
    expect(st(other.snapshot).current).toBe(cur);
    const own = step(other.snapshot, cur, { type: 'resign' });
    expect(own.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    expect(step(own.snapshot, st(own.snapshot).current, { type: 'resign' }).scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
  });

  it('tutorial pre-placed opening cubes obey the cube rule (each on a cell its owner\'s clue rules out)', () => {
    const cells = buildCells(TUTORIAL.tiles, TUTORIAL.structures);
    for (const [seat, c] of TUTORIAL.cubes) expect(fits(cells, TUTORIAL.clues[seat]!, c), `seat ${seat} cell ${c}`).toBe(false);
    expect(TUTORIAL.cubes.filter(([s]) => s === 0)).toHaveLength(2);
    expect(TUTORIAL.cubes.filter(([s]) => s === 1)).toHaveLength(2);
  });

  it('rules guide has every required section', () => {
    const heads = cryptid.catalog.rulesFa.filter((l) => l.startsWith('## '));
    for (const h of ['هدف', 'آماده‌سازی', 'نوبت', 'امتیاز', 'پایان بازی', 'نکته‌ها']) expect(heads.some((x) => x.includes(h)), h).toBe(true);
  });

  it('timeout policy covers the owed cube after a refuted search too (engine auto-places it)', () => {
    expect(cryptid.catalog.timeoutPolicyFa).toContain('جست‌وجوی ردشده');
    let snap = opened(game(4, 8));
    const s = st(snap);
    const me = s.current, a = (me + 1) % 4, b = (me + 2) % 4;
    const cell = all.find((i) => s.cubes[i] === null && fits(s.cells, s.clues[me]!, i) && fits(s.cells, s.clues[a]!, i) && !fits(s.cells, s.clues[b]!, i))!;
    snap = act(snap, me, { type: 'search', cell });
    expect(st(snap).phase).toBe('penalty');
    snap = applyTimeout(m, snap, 0).snapshot;
    expect(st(snap).log.at(-1)).toMatchObject({ t: 'cube', seat: me, auto: true, opening: false });
    expect(st(snap).current).toBe(a);
  });

  it('tutorial instructions name the right terrain for every cell they mention', () => {
    const cells = buildCells(TUTORIAL.tiles, TUTORIAL.structures);
    const fa = { forest: 'جنگلی', desert: 'بیابانی', mountain: 'کوهستان' } as Record<string, string>;
    const steps = cryptidModule.tutorial.steps;
    const check = (text: string, cell: number) => {
      expect(text).toContain(fa[cells[cell]!.terrain]!);
      expect(text).toContain(`ستون ${((cell % 12) + 1).toLocaleString('fa-IR')}، ردیف ${(Math.floor(cell / 12) + 1).toLocaleString('fa-IR')}`);
    };
    steps.forEach((s, k) => { if (k !== 2 && s.instructionFa.includes('ستون')) check(s.instructionFa, (s.expected as { cell: number }).cell); });
    check(steps[2]!.instructionFa, (steps[1]!.reply as { cell: number }).cell); // the tutor's question is described in step 3
  });
});
