import { describe, expect, it } from 'vitest';
import { blocked, distance, pawnMoves, quoridorModule, wallOk, type QuoridorState, type QuoridorView, type Wall } from '@bg/game-quoridor';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = quoridorModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as QuoridorState;
const game = (players = 2, options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: players, seed, options: { firstMove: 'host', ...options } }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const at = (r: number, c: number) => r * 9 + c;
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('quoridor rules', () => {
  it('setup: pawns in the middle of their edges, walls per player count', () => {
    expect(st(game(2)).pawns).toEqual([at(0, 4), at(8, 4)]);
    expect(st(game(2)).wallsLeft).toEqual([10, 10]);
    expect(st(game(3)).wallsLeft).toEqual([7, 7, 7]);
    expect(st(game(4)).pawns).toEqual([at(0, 4), at(4, 0), at(8, 4), at(4, 8)]);
    expect(st(game(4)).wallsLeft).toEqual([5, 5, 5, 5]);
    expect(sorted(pawnMoves(st(game(2)), 0))).toEqual(sorted([at(1, 4), at(0, 3), at(0, 5)]));
  });

  it('walls block steps on both cells they cover; overlapping and crossing walls are refused', () => {
    const walls: Wall[] = [{ r: 0, c: 4, o: 'h' }];
    expect(blocked(walls, 0, 4, 1, 0)).toBe(true);
    expect(blocked(walls, 0, 5, 1, 0)).toBe(true);
    expect(blocked(walls, 0, 3, 1, 0)).toBe(false);
    expect(blocked(walls, 1, 5, -1, 0)).toBe(true);
    const s = { ...st(game(2)), walls };
    expect(wallOk(s, { r: 0, c: 4, o: 'v' })).toBe(false); // crosses
    expect(wallOk(s, { r: 0, c: 5, o: 'h' })).toBe(false); // overlaps
    expect(wallOk(s, { r: 0, c: 6, o: 'h' })).toBe(true);
    expect(wallOk(s, { r: 0, c: 3, o: 'v' })).toBe(true);
  });

  it('a wall may never cut off a pawn completely', () => {
    // Seat 0 in the corner a1 with a wall above a1–b1: a vertical wall right of b1 would box it in completely.
    let snap = game(2);
    Object.assign(st(snap), { pawns: [at(0, 0), at(8, 4)], walls: [{ r: 0, c: 0, o: 'h' }] });
    expect(distance(st(snap).walls, at(0, 0), 'bottom')).toBe(10);
    expect(reject(snap, 0, { type: 'wall', r: 0, c: 1, o: 'v' })).toBe('ILLEGAL_WALL');
    expect(reject(snap, 1, { type: 'wall', r: 0, c: 1, o: 'v' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'wall', r: 3, c: 3, o: 'h' });
    expect(st(snap).wallsLeft[0]).toBe(9);
  });

  it('jumps: straight over an adjacent pawn, or diagonally when a wall is behind it', () => {
    const s = st(game(2));
    s.pawns = [at(4, 4), at(5, 4)];
    expect(pawnMoves(s, 0)).toContain(at(6, 4));
    expect(pawnMoves(s, 0)).not.toContain(at(5, 4));
    s.walls = [{ r: 5, c: 4, o: 'h' }];
    const ms = pawnMoves(s, 0);
    expect(ms).not.toContain(at(6, 4));
    expect(ms).toEqual(expect.arrayContaining([at(5, 3), at(5, 5)]));
  });

  it('reaching the far edge wins; others are placed by distance', () => {
    let snap = game(4);
    Object.assign(st(snap), { pawns: [at(7, 4), at(4, 0), at(8, 4), at(4, 8)] });
    snap = act(snap, 0, { type: 'move', to: at(8, 3) });
    expect(st(snap).winner).toBe(0);
    const pl = st(snap).outcome!.placements;
    expect(pl[0]).toEqual({ seat: 0, place: 1 });
    expect(pl.map((x) => x.seat).sort()).toEqual([0, 1, 2, 3]);
  });

  it('turn order, resign, three timeouts; the last player standing wins', () => {
    let snap = game(3);
    expect(reject(snap, 1, { type: 'move', to: at(4, 1) })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'move', to: at(1, 4) });
    expect(st(snap).current).toBe(1);
    snap = act(snap, 1, { type: 'resign' });
    expect(st(snap).active).toEqual([true, false, true]);
    expect(st(snap).current).toBe(2);
    for (let k = 0; k < 6 && !st(snap).outcome; k++) {
      if (st(snap).current === 0) snap = act(snap, 0, { type: 'wall', r: k, c: 0, o: 'h' });
      else snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    }
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('view adds distances; tutorial is legal and ends in a win', () => {
    const v = projectFor(m, game(2), p(1)).view as QuoridorView;
    expect(v.distances).toEqual([8, 8]);
    expect(v).not.toHaveProperty('timeouts');
    const t = quoridorModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }], reason: 'win' });
    expect(st(snap).pawns).toEqual([79, 41]);
    expect(st(snap).wallsLeft).toEqual([9, 8]);
    expect(distance(st(snap).walls, 41, 'top')).toBe(4);
  });

  it('random games with walls always keep paths and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 30 + g });
      const setup = { playerCount: 2 + (g % 3), seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 600 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        let action: Record<string, unknown> | null = null;
        if (s.wallsLeft[seat]! > 0 && rng.nextInt(3) === 0) {
          const w = { type: 'wall', r: rng.nextInt(8), c: rng.nextInt(8), o: rng.nextInt(2) ? 'h' : 'v' };
          if (wallOk(s, w as unknown as Wall)) action = w;
        }
        if (!action) {
          // Mostly head for the goal so games finish.
          const moves = pawnMoves(s, seat).map((to) => ({ to, d: distance(s.walls, to, s.sides[seat]!) ?? 99 })).sort((a, b) => a.d - b.d);
          action = { type: 'move', to: (rng.nextInt(4) ? moves[0] : moves[rng.nextInt(moves.length)])!.to };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const after = st(snap);
        after.pawns.forEach((pw, k) => { if (after.active[k]) expect(distance(after.walls, pw, after.sides[k]!)).not.toBeNull(); });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
