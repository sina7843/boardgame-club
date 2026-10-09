import { describe, expect, it } from 'vitest';
import { LADDERS, SNAKES, snakesModule, step, type SnakesState } from '@bg/game-snakes-ladders';
import { ludoModule, movablePieces, target, trackSquare, type LudoState } from '@bg/game-ludo';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const p = (seat: number) => ({ kind: 'player' as const, seat });
const act = (m: never, snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const rejectCode = (m: never, snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

// ---------------- Snakes and Ladders ----------------
const sm = snakesModule as never;
const ss = (s: EngineSnapshot) => s.state as SnakesState;
const snakesWith = (o: Partial<SnakesState>, opts: Record<string, unknown> = {}): EngineSnapshot => {
  const snap = startGame(sm, { playerCount: 2, seed: 2, options: opts }).snapshot;
  return { ...snap, state: { ...ss(snap), current: 0, ...o } };
};

describe('snakes and ladders', () => {
  it('board: ladders go up, snakes go down, nothing overlaps', () => {
    for (const [a, b] of Object.entries(LADDERS)) expect(b).toBeGreaterThan(Number(a));
    for (const [a, b] of Object.entries(SNAKES)) expect(b).toBeLessThan(Number(a));
    expect(Object.keys(LADDERS).filter((k) => k in SNAKES)).toEqual([]);
  });

  it('a step follows ladders and snakes; exact finish stays, bounce counts back', () => {
    const s = ss(snakesWith({ pos: [70, 0] }));
    expect(step(s, 0, 1)).toMatchObject({ to: 91, via: 'ladder', landed: 71 });
    s.pos[0] = 90;
    expect(step(s, 0, 3)).toMatchObject({ to: 73, via: 'snake' });
    s.pos[0] = 97;
    expect(step(s, 0, 5)).toMatchObject({ to: 97, via: 'stay' });
    s.finish = 'bounce';
    expect(step(s, 0, 5)).toMatchObject({ to: 78, via: 'snake', landed: 98 }); // 97+5 → 102 → 98 → snake to 78
  });

  it('turns rotate; only the current player rolls; reaching 100 wins and ranks the rest by position', () => {
    let snap = startGame(sm, { playerCount: 3, seed: 4, options: {} }).snapshot;
    const first = ss(snap).current;
    expect(rejectCode(sm, snap, (first + 1) % 3, { type: 'roll' })).toBe('NOT_YOUR_TURN');
    snap = act(sm, snap, first, { type: 'roll' });
    expect(ss(snap).current).toBe((first + 1) % 3);
    snap = { ...snap, state: { ...ss(snap), pos: [99, 50, 30], current: 0, script: [1] } };
    snap = act(sm, snap, 0, { type: 'roll' });
    expect(ss(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }, { seat: 2, place: 3 }] });
  });

  it('six again option keeps the turn; timeouts roll for you and three in a row remove you', () => {
    let snap = snakesWith({ script: [6] }, { sixAgain: true });
    snap = { ...snap, state: { ...ss(snap), sixAgain: true } };
    snap = act(sm, snap, 0, { type: 'roll' });
    expect(ss(snap).current).toBe(0);
    let t = snakesWith({});
    for (let i = 0; i < 5; i++) t = (applyTimeout(sm, t, 0) as StepResult).snapshot;
    expect(ss(t).outcome?.reason).toBe('resign');
    expect(ss(t).outcome?.placements[0]).toEqual({ seat: 1, place: 1 });
  });

  it('the view hides tutorial dice and timeouts; the tutorial wins via the ladder on 80', () => {
    const t = snakesModule.tutorial;
    let snap = startGame(sm, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    expect(JSON.stringify(projectFor(sm, snap, { kind: 'spectator' }).view)).not.toContain('script');
    for (const s of t.steps) { snap = act(sm, snap, 0, s.expected); if (s.reply) snap = act(sm, snap, 1, s.reply); }
    expect(ss(snap).pos).toEqual([100, 26]);
    expect(ss(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const setup = { playerCount: 2 + (g % 5), seed: g, options: g % 2 ? { finish: 'bounce', sixAgain: true } : {} };
      let snap = startGame(sm, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 5000 && !ss(snap).outcome; n++) {
        const seat = ss(snap).current;
        snap = act(sm, snap, seat, { type: 'roll' });
        inputs.push({ kind: 'action', actor: p(seat), action: { type: 'roll' }, logicalTime: 0 });
      }
      expect(ss(snap).outcome).not.toBeNull();
      expect(replay(sm, setup, inputs)).toEqual(snap);
    }
  });
});

// ---------------- Ludo ----------------
const lm = ludoModule as never;
const ls = (s: EngineSnapshot) => s.state as LudoState;
const ludoWith = (players: number, o: Partial<LudoState>): EngineSnapshot => {
  const snap = startGame(lm, { playerCount: players, seed: 3, options: {} }).snapshot;
  const state = { ...ls(snap), current: 0, phase: 'roll' as const, die: null, tries: 1, ...o };
  return { ...snap, state };
};

describe('ludo (منچ)', () => {
  it('two players sit opposite; everyone starts in the yard with three tries to roll a 6', () => {
    const s = ls(startGame(lm, { playerCount: 2, seed: 1, options: {} }).snapshot);
    expect(s.slots).toEqual([0, 2]);
    expect(s.pieces).toEqual([[-1, -1, -1, -1], [-1, -1, -1, -1]]);
    expect(s.tries).toBe(3);
    expect(trackSquare(2, 0)).toBe(20);
  });

  it('entering needs a 6, a 6 rolls again, three failed tries pass the turn', () => {
    let snap = ludoWith(2, { tries: 3, script: [2, 3, 1] });
    snap = act(lm, snap, 0, { type: 'roll' });
    snap = act(lm, snap, 0, { type: 'roll' });
    expect(ls(snap).current).toBe(0);
    snap = act(lm, snap, 0, { type: 'roll' });
    expect(ls(snap).current).toBe(1);
    let six = ludoWith(2, { tries: 3, script: [6] });
    six = act(lm, six, 0, { type: 'roll' }); // all four can enter → choose
    expect(ls(six).phase).toBe('move');
    expect(movablePieces(ls(six), 0, 6)).toEqual([0, 1, 2, 3]);
    six = act(lm, six, 0, { type: 'move', piece: 2 });
    expect(ls(six).pieces[0]).toEqual([-1, -1, 0, -1]);
    expect(ls(six)).toMatchObject({ current: 0, phase: 'roll' }); // the 6 earns another roll
  });

  it('captures send the opponent home; own pieces block; the goal needs an exact count without jumping', () => {
    // Seat 0 piece at 5 rolls 3 onto square 8 where seat 1 (slot 2, start 20) stands at progress 28.
    let snap = ludoWith(2, { pieces: [[5, -1, -1, -1], [28, -1, -1, -1]], script: [3] });
    snap = act(lm, snap, 0, { type: 'roll' }); // single legal move → played automatically
    expect(ls(snap).pieces).toEqual([[8, -1, -1, -1], [-1, -1, -1, -1]]);
    expect(ls(snap).log.some((e) => e.t === 'move' && e.captured?.seat === 1)).toBe(true);
    const s = ls(ludoWith(2, { pieces: [[10, 12, 38, 41], [-1, -1, -1, -1]] }));
    expect(target(s, 0, 0, 2)).toBeNull(); // own piece on 12
    expect(target(s, 0, 2, 3)).toBeNull(); // 38+3 = 41 is occupied by own piece
    expect(target(s, 0, 2, 4)).toBeNull(); // would jump over own piece on 41
    expect(target(s, 0, 2, 2)).toBe(40);
    expect(target(s, 0, 3, 3)).toBeNull(); // past the end of the goal
    expect(target(s, 0, 3, 2)).toBe(43);
  });

  it('first to bring all four home wins; others ranked by progress; resign and timeouts', () => {
    let snap = ludoWith(3, { pieces: [[41, 42, 43, 38], [10, -1, -1, -1], [20, 5, -1, -1]], script: [2] });
    snap = act(lm, snap, 0, { type: 'roll' });
    expect(ls(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 3 }, { seat: 2, place: 2 }] });
    let r = ludoWith(2, {});
    r = act(lm, r, 1, { type: 'resign' });
    expect(ls(r).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    let t = ludoWith(2, { tries: 3 });
    for (let i = 0; i < 12 && !ls(t).outcome; i++) t = (applyTimeout(lm, t, 0) as StepResult).snapshot;
    expect(ls(t).outcome?.reason).toBe('resign');
  });

  it('tutorial: forced capture with a bonus 6, a chosen goal entry, a blocked roll, then an exact roll wins', () => {
    const t = ludoModule.tutorial;
    let snap = startGame(lm, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    for (const s of t.steps) { snap = act(lm, snap, 0, s.expected); if (s.reply) snap = act(lm, snap, 1, s.reply); }
    expect(ls(snap).outcome?.placements).toEqual([{ seat: 0, place: 1 }, { seat: 1, place: 2 }]);
    expect(ls(snap).pieces).toEqual([[43, 42, 40, 41], [-1, 31, -1, -1]]);
    expect(ls(snap).log.filter((e) => e.t === 'move' && e.captured)).toHaveLength(1);
    expect(ls(snap).log.filter((e) => e.t === 'noMove')).toHaveLength(1);
  });

  it('random 2–4 player games end, never stack pieces on the track, and replay deterministically', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 500 + g });
      const setup = { playerCount: 2 + (g % 3), seed: g, options: {} };
      let snap = startGame(lm, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !ls(snap).outcome; n++) {
        const seat = ls(snap).current;
        const hints = projectFor(lm, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'move' ? { type: 'move', piece: h.piece } : { type: 'roll' };
        snap = act(lm, snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = ls(snap);
        const squares = s.pieces.flatMap((ps, seatX) => ps.filter((x) => x >= 0 && x < 40).map((x) => trackSquare(s.slots[seatX]!, x)));
        expect(new Set(squares).size).toBe(squares.length);
      }
      expect(ls(snap).outcome).not.toBeNull();
      expect(replay(lm, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
