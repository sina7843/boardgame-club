import { describe, expect, it } from 'vitest';
import { abaloneModule, CELLS, cellAt, legalMoves, startBoard, tryMove, type AbaloneState, type AbaloneView, type Color } from '@bg/game-abalone';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = abaloneModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as AbaloneState;
const game = (options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: 2, seed, options: { firstMove: 'host', ...options } }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const c = (q: number, r: number) => cellAt(q, r)!;
const board = (b: [number, number][], w: [number, number][]) => {
  const out: (Color | null)[] = Array(CELLS.length).fill(null);
  for (const [q, r] of b) out[c(q, r)] = 'b';
  for (const [q, r] of w) out[c(q, r)] = 'w';
  return out;
};

describe('abalone rules', () => {
  it('61 cells, 14 marbles each in the standard layout; black moves first', () => {
    expect(CELLS).toHaveLength(61);
    const b = startBoard();
    expect(b.filter((x) => x === 'b')).toHaveLength(14);
    expect(b.filter((x) => x === 'w')).toHaveLength(14);
    expect(legalMoves(b, 'b').length).toBeGreaterThan(30);
    expect(st(game()).turn).toBe('b');
  });

  it('in-line and broadside moves; groups must be a contiguous line of up to three', () => {
    const b = board([[0, 0], [1, 0], [2, 0]], [[0, -4]]);
    expect(tryMove(b, 'b', [c(0, 0), c(1, 0), c(2, 0)], 0)).not.toBeNull(); // in-line forward
    expect(tryMove(b, 'b', [c(0, 0), c(1, 0), c(2, 0)], 5)).not.toBeNull(); // broadside
    expect(tryMove(b, 'b', [c(0, 0), c(2, 0)], 0)).toBeNull(); // gap
    const four = board([[-1, 0], [0, 0], [1, 0], [2, 0]], [[0, -4]]);
    expect(legalMoves(four, 'b').every((mv) => mv.marbles.length <= 3)).toBe(true);
    // A marble cannot step off the board on its own.
    expect(tryMove(board([[4, 0]], [[0, -4]]), 'b', [c(4, 0)], 0)).toBeNull();
  });

  it('sumito: 2 push 1, 3 push 2; equal numbers or an own marble behind block; a push off the edge scores', () => {
    const two = board([[0, 0], [1, 0]], [[2, 0]]);
    const r2 = tryMove(two, 'b', [c(0, 0), c(1, 0)], 0)!;
    expect(r2.board[c(3, 0)]).toBe('w');
    expect(r2.board[c(2, 0)]).toBe('b');
    expect(tryMove(board([[0, 0]], [[1, 0]]), 'b', [c(0, 0)], 0)).toBeNull(); // 1 v 1
    expect(tryMove(board([[0, 0], [1, 0]], [[2, 0], [3, 0]]), 'b', [c(0, 0), c(1, 0)], 0)).toBeNull(); // 2 v 2
    expect(tryMove(board([[0, 0], [1, 0], [2, 0]], [[3, 0], [4, 0]]), 'b', [c(0, 0), c(1, 0), c(2, 0)], 0)?.lost).toBe(1); // 3 v 2 off the edge
    expect(tryMove(board([[0, 0], [1, 0], [3, 0]], [[2, 0]]), 'b', [c(0, 0), c(1, 0)], 0)).toBeNull(); // own marble behind
  });

  it('six marbles off wins; the move limit decides by marbles off', () => {
    let snap = game();
    Object.assign(st(snap), { board: board([[1, 0], [2, 0], [3, 0]], [[4, 0], [0, -4]]), off: { b: 0, w: 5 } });
    snap = act(snap, 0, { type: 'move', marbles: [c(1, 0), c(2, 0), c(3, 0)], dir: 0 });
    expect(st(snap).off.w).toBe(6);
    expect(st(snap).end).toEqual({ kind: 'six' });
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
    let lim = game();
    Object.assign(st(lim), { ply: 199, off: { b: 1, w: 2 } });
    lim = act(lim, 0, { type: 'move', ...legalMoves(st(lim).board, 'b')[0]! });
    expect(st(lim).end).toEqual({ kind: 'limit' });
    expect(st(lim).outcome?.placements.find((x) => x.place === 1)?.seat).toBe(0);
  });

  it('timeouts move for the absent player; three lose; resign loses', () => {
    let snap = game();
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).turn).toBe('w');
    let t = game();
    for (let k = 0; k < 3 && !st(t).outcome; k++) {
      t = (applyTimeout(m, t, 0) as StepResult).snapshot;
      if (!st(t).outcome) t = act(t, 1, { type: 'move', ...legalMoves(st(t).board, 'w')[0]! });
    }
    expect(st(t).outcome?.reason).toBe('timeout');
    expect(st(act(game(), 1, { type: 'resign' })).outcome?.placements.find((x) => x.place === 1)?.seat).toBe(0);
  });

  it('view is public; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, game(), p(1)).view as AbaloneView).not.toHaveProperty('timeouts');
    const t = abaloneModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    // 2-push-1 and 3-push-2 off the edge on top of the four lost before; White pushed one black marble off.
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 6 }, { seat: 1, place: 2, score: 1 }], reason: 'win' });
    expect(st(snap).off).toEqual({ b: 1, w: 6 });
  });

  it('random games conserve marbles and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 60 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      while (!st(snap).outcome) {
        const s = st(snap);
        const seat = s.colors.indexOf(s.turn);
        const all = legalMoves(s.board, s.turn);
        // Prefer pushes so games end before the move limit now and then.
        const pushes = all.filter((mv) => tryMove(s.board, s.turn, mv.marbles, mv.dir)!.pushed.length);
        const mv = pushes.length && rng.nextInt(2) ? pushes[rng.nextInt(pushes.length)]! : all[rng.nextInt(all.length)]!;
        const action = { type: 'move', ...mv };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        expect(a.board.filter((x) => x === 'b').length + a.off.b).toBe(14);
        expect(a.board.filter((x) => x === 'w').length + a.off.w).toBe(14);
      }
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
