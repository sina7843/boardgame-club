import { describe, expect, it } from 'vitest';
import { count, flips, legalSquares, othelloModule, startBoard, type Disc, type OthelloState, type OthelloView } from '@bg/game-othello';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = othelloModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as OthelloState;
const game = (options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: 2, seed, options: { firstMove: 'host', ...options } }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const sq = (n: string) => (Number(n[1]) - 1) * 8 + (n.charCodeAt(0) - 97);
const board = (b: string[], w: string[]) => {
  const out: (Disc | null)[] = Array(64).fill(null);
  for (const s of b) out[sq(s)] = 'b';
  for (const s of w) out[sq(s)] = 'w';
  return out;
};

describe('othello rules', () => {
  it('standard start: four discs, black has four symmetric moves', () => {
    const b = startBoard();
    expect(count(b)).toEqual({ b: 2, w: 2 });
    expect(legalSquares(b, 'b').sort((x, y) => x - y)).toEqual([sq('d3'), sq('c4'), sq('f5'), sq('e6')].sort((x, y) => x - y));
    const snap = game();
    expect(reject(snap, 1, { type: 'place', sq: sq('d3') })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, 0, { type: 'place', sq: sq('a1') })).toBe('ILLEGAL_MOVE');
    expect(reject(snap, 0, { type: 'place', sq: sq('d4') })).toBe('SQUARE_TAKEN');
  });

  it('a move flips every outflanked line, in all eight directions', () => {
    // Black on d4 surrounded by white with black anchors at the end of three lines.
    const b = board(['a4', 'd1', 'g7'], ['b4', 'c4', 'd2', 'd3', 'e5', 'f6']);
    expect(flips(b, sq('d4'), 'b').sort((x, y) => x - y)).toEqual([sq('b4'), sq('c4'), sq('d2'), sq('d3'), sq('e5'), sq('f6')].sort((x, y) => x - y));
    // A line that ends on an empty square or the edge flips nothing.
    expect(flips(board([], ['b1']), sq('a1'), 'b')).toEqual([]);
    let snap = game();
    snap = act(snap, 0, { type: 'place', sq: sq('d3') });
    expect(count(st(snap).board)).toEqual({ b: 4, w: 1 });
    expect(st(snap).turn).toBe('w');
  });

  it('a player without moves passes automatically; the game ends when nobody can move, empties go to the winner', () => {
    // White's only disc b1 can be taken; afterwards white has nothing → game over.
    let snap = game();
    Object.assign(st(snap), { board: board(['a1'], ['b1']) });
    snap = act(snap, 0, { type: 'place', sq: sq('c1') });
    expect(st(snap).end).toEqual({ kind: 'board', score: [64, 0] });
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 64 }, { seat: 1, place: 2, score: 0 }], reason: 'score' });
    // Pass: after black plays, white has no move but black still does → black moves again.
    let pass = game();
    Object.assign(st(pass), { board: board(['a1', 'h8'], ['b1', 'g8', 'h7']) });
    pass = act(pass, 0, { type: 'place', sq: sq('c1') });
    expect(st(pass).turn).toBe('b');
    expect(st(pass).passes).toEqual([{ seat: 1, after: 1 }]);
  });

  it('equal discs at the end is a draw', () => {
    let snap = game();
    // Black takes b1 → 3 vs 3 and neither side can move: a draw, the empty squares go to nobody.
    Object.assign(st(snap), { board: board(['a1'], ['b1', 'h1', 'h2', 'h3']) });
    snap = act(snap, 0, { type: 'place', sq: sq('c1') });
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 3 }, { seat: 1, place: 1, score: 3 }], reason: 'draw' });
  });

  it('resign and timeout lose; the view hides only the timeout counters', () => {
    expect(st(act(game(), 1, { type: 'resign' })).outcome?.placements[0]!.seat).toBe(0);
    const t = (applyTimeout(m, game(), 0) as StepResult).snapshot;
    expect(st(t).outcome).toMatchObject({ reason: 'timeout', placements: [{ seat: 1, place: 1 }, { seat: 0, place: 2 }] });
    const v = projectFor(m, act(game(), 0, { type: 'place', sq: sq('d3') }), p(1)).view as OthelloView;
    expect(v.counts).toEqual({ b: 4, w: 1 });
    expect(v.last).toMatchObject({ seat: 0, sq: sq('d3'), flipped: [sq('d4')] });
    expect(v).not.toHaveProperty('timeouts');
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = othelloModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 64 }, { seat: 1, place: 2, score: 0 }]);
    expect(st(snap).passes).toEqual([{ seat: 1, after: 3 }]);
  });

  it('random games fill the board consistently and replay deterministically', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 70 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      while (!st(snap).outcome) {
        const s = st(snap);
        const seat = s.colors.indexOf(s.turn);
        const moves = legalSquares(s.board, s.turn);
        const action = { type: 'place', sq: moves[rng.nextInt(moves.length)] };
        const before = count(s.board);
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const after = count(st(snap).board);
        expect(after.b + after.w).toBe(before.b + before.w + 1);
      }
      const o = st(snap).outcome!;
      expect(o.placements.reduce((a, x) => a + (x.score ?? 0), 0)).toBeLessThanOrEqual(64);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
