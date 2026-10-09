import { describe, expect, it } from 'vitest';
import { allMoves, flats, moveOk, road, takModule, type Stone, type TakState, type TakView } from '@bg/game-tak';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = takModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TakState;
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
const F = (c: 'w' | 'b'): Stone => ({ c, t: 'F' });
const S = (c: 'w' | 'b'): Stone => ({ c, t: 'S' });
const C = (c: 'w' | 'b'): Stone => ({ c, t: 'C' });
/** A started 5×5 game after the opening (ply 2), white to move, with given stacks. */
function midgame(stacks: Record<number, Stone[]>) {
  const snap = game();
  const s = st(snap);
  s.ply = 2;
  s.board = Array.from({ length: 25 }, (_, i) => (stacks[i] ? stacks[i]!.map((x) => ({ ...x })) : []));
  return snap;
}

describe('tak rules', () => {
  it('opening: each player first places a flat of the opponent', () => {
    let snap = game();
    expect(st(snap).reserve.w).toEqual({ stones: 21, caps: 1 });
    expect(reject(snap, 0, { type: 'place', at: 0, kind: 'S' })).toBe('FIRST_MOVE_FLAT');
    snap = act(snap, 0, { type: 'place', at: 0, kind: 'F' });
    expect(st(snap).board[0]).toEqual([F('b')]);
    expect(st(snap).reserve.b.stones).toBe(20);
    expect(reject(snap, 1, { type: 'move', from: 0, dir: 'n', drops: [1] })).toBe('FIRST_MOVE_FLAT');
    snap = act(snap, 1, { type: 'place', at: 24, kind: 'F' });
    expect(st(snap).board[24]).toEqual([F('w')]);
    expect(st(snap).turn).toBe('w');
  });

  it('moves: carry limit, at least one per square, walls and capstones block, a lone capstone flattens a wall', () => {
    const s = st(midgame({ 0: [F('b'), F('w'), F('w')], 2: [S('b')], 5: [C('b')], 12: [C('w')], 13: [S('b')] }));
    expect(moveOk(s, 'w', 0, 'e', [1, 1, 1])).toBe(false); // the wall on 2
    expect(moveOk(s, 'w', 0, 'e', [2, 1])).toBe(false); // passes 1, then 2 is a wall
    expect(moveOk(s, 'w', 0, 'e', [3])).toBe(true); // the whole stack (incl. the black flat under it) moves together
    expect(moveOk(s, 'w', 0, 'e', [4])).toBe(false); // more than the stack holds
    expect(moveOk(s, 'w', 0, 'e', [2])).toBe(true);
    expect(moveOk(s, 'w', 0, 'n', [1])).toBe(false); // capstone on 5
    expect(moveOk(s, 'b', 0, 'e', [1])).toBe(false); // not black's stack
    expect(moveOk(s, 'w', 12, 'e', [1])).toBe(true); // lone capstone onto a wall
    let snap = midgame({ 12: [C('w')], 13: [S('b')], 24: [F('b')] });
    snap = act(snap, 0, { type: 'move', from: 12, dir: 'e', drops: [1] });
    expect(st(snap).board[13]).toEqual([F('b'), C('w')]);
  });

  it('roads connect opposite edges with flats and capstones; walls do not count; the mover wins double roads', () => {
    const b = Array.from({ length: 25 }, (): Stone[] => []);
    for (const i of [0, 5, 10, 15, 20]) b[i] = [F('w')];
    expect(road(b, 5, 'w')?.sort((x, y) => x - y)).toEqual([0, 5, 10, 15, 20]);
    b[10] = [S('w')];
    expect(road(b, 5, 'w')).toBeNull();
    b[10] = [F('b'), C('w')];
    expect(road(b, 5, 'w')).not.toBeNull();
    // Placing the last flat of a row wins.
    let snap = midgame({ 0: [F('w')], 1: [F('w')], 2: [F('w')], 3: [F('w')], 24: [F('b')] });
    snap = act(snap, 0, { type: 'place', at: 4, kind: 'F' });
    expect(st(snap).end?.kind).toBe('road');
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('board full or a reserve empty → most top flats wins (equal is a draw)', () => {
    const b: Stone[][] = Array.from({ length: 25 }, (_, i) => [i % 2 ? F('w') : S('b')]);
    expect(flats(b)).toEqual({ w: 12, b: 0 });
    let snap = midgame({});
    const s = st(snap);
    s.board = Array.from({ length: 25 }, (_, i) => (i === 24 ? [] : [i % 3 === 0 ? S('b') : i % 3 === 1 ? S('w') : F('b')]));
    snap = act(snap, 0, { type: 'place', at: 24, kind: 'F' });
    expect(st(snap).end?.kind).toBe('flats');
    expect(st(snap).outcome?.reason).toBe('score');
  });

  it('timeouts place a flat; three lose; resign loses', () => {
    let snap = game();
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).board.filter((x) => x.length)).toHaveLength(1);
    let t = game();
    for (let k = 0; k < 3 && !st(t).outcome; k++) {
      t = (applyTimeout(m, t, 0) as StepResult).snapshot;
      if (!st(t).outcome) t = act(t, 1, { type: 'place', at: st(t).board.findIndex((x) => !x.length), kind: 'F' });
    }
    expect(['timeout', 'road', 'flats']).toContain(st(t).end?.kind);
    expect(st(act(game(), 1, { type: 'resign' })).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('view is public; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, game(), p(1)).view as TakView).not.toHaveProperty('timeouts');
    const t = takModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      expect(st(snap).outcome).toBeNull();
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    // The stack spread captured c1 and d1; the capstone flattened the wall on e1 and completed row 1.
    expect(s.board[2]!.map((x) => x.c + x.t)).toEqual(['bF', 'wF']);
    expect(s.board[4]!.map((x) => x.c + x.t)).toEqual(['bF', 'wC']);
    expect(s.end).toEqual({ kind: 'road', road: [4, 3, 2, 1, 0] });
    expect(s.outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('random games conserve stones and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 40 + g });
      const setup = { playerCount: 2, seed: g, options: { size: [4, 5, 6][g % 3] } };
      let snap = startGame(m, setup).snapshot;
      const total = (s: TakState) => s.board.reduce((a, x) => a + x.length, 0) + s.reserve.w.stones + s.reserve.w.caps + s.reserve.b.stones + s.reserve.b.caps;
      const start = total(st(snap));
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 600 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.colors.indexOf(s.turn);
        const empty = s.board.map((x, i) => (x.length ? -1 : i)).filter((i) => i >= 0);
        const moves = s.ply >= 2 ? allMoves(s, s.turn) : [];
        let action: Record<string, unknown>;
        if (empty.length && (!moves.length || rng.nextInt(2))) {
          const r = s.reserve[s.ply < 2 ? (s.turn === 'w' ? 'b' : 'w') : s.turn];
          const kind = s.ply < 2 ? 'F' : r.caps && rng.nextInt(8) === 0 ? 'C' : r.stones ? (rng.nextInt(5) === 0 ? 'S' : 'F') : 'C';
          action = { type: 'place', at: empty[rng.nextInt(empty.length)], kind };
          if ((kind === 'C' && !r.caps) || (kind !== 'C' && !r.stones)) action = { type: 'move', ...moves[rng.nextInt(moves.length)] };
        } else action = { type: 'move', ...moves[rng.nextInt(moves.length)] };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(start);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
