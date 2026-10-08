import { describe, expect, it } from 'vitest';
import { TILES, carcModule, edgeAt, feature, fits, key, placements, segments, type CarcState, type CarcView, type Placed } from '@bg/game-carcassonne';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = carcModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CarcState;
const game = (players = 2, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** Puts a chosen tile on top of the stack. */
const withTop = (snap: EngineSnapshot, t: string): EngineSnapshot => {
  const s = structuredClone(st(snap));
  s.stack.splice(s.stack.indexOf(t), 1);
  s.stack.unshift(t);
  return { ...snap, state: s };
};

describe('carcassonne rules', () => {
  it('72 tiles; start tile on the board, 71 in the stack; each player 7 followers', () => {
    expect(Object.values(TILES).reduce((n, t) => n + t.count, 0)).toBe(72);
    const s = st(game(3));
    expect(s.stack.length + s.discarded).toBe(71);
    expect(s.board[key(0, 0)]).toMatchObject({ t: 'D', rot: 0 });
    expect(s.meeplesLeft).toEqual([7, 7, 7]);
  });

  it('edges rotate clockwise and placement must match every neighbour', () => {
    expect(edgeAt('E', 0, 0)).toBe('C');
    expect(edgeAt('E', 1, 1)).toBe('C');
    expect(edgeAt('E', 2, 2)).toBe('C');
    const board: Record<string, Placed> = { [key(0, 0)]: { t: 'D', rot: 0, meeples: {} } };
    expect(fits(board, 'E', 0, -1, 2)).toBe(true);
    expect(fits(board, 'E', 0, -1, 0)).toBe(false);
    expect(fits(board, 'E', 5, 5, 0)).toBe(false);
    expect(placements(board, 'B').every((x) => !(x.x === 0 && x.y === -1))).toBe(true);
  });

  it('completed city scores 2 per tile and pennant; follower returns; occupied features refuse followers', () => {
    let snap = withTop(game(2, 4), 'E');
    const seat = st(snap).current;
    snap = withTop(snap, 'E');
    expect(reject(snap, seat, { type: 'place', x: 0, y: -1, rot: 0 })).toBe('DOES_NOT_FIT');
    snap = act(snap, seat, { type: 'place', x: 0, y: -1, rot: 2, meeple: 'c0' });
    const s = st(snap);
    expect(s.scores[seat]).toBe(4);
    expect(s.meeplesLeft[seat]).toBe(7);
    expect(s.board[key(0, -1)]!.meeples).toEqual({});
    expect(s.last?.scored).toEqual([{ seat, pts: 4, kind: 'city' }]);
    // Road through the start tile: a follower on the east road blocks a second one on the same road.
    let r = withTop(game(2, 5), 'U');
    const a = st(r).current;
    r = act(r, a, { type: 'place', x: 1, y: 0, rot: 1, meeple: 'r0' });
    r = withTop(r, 'U');
    expect(reject(r, 1 - a, { type: 'place', x: -1, y: 0, rot: 1, meeple: 'r0' })).toBe('OCCUPIED');
    expect(feature(st(r).board, 0, 0, 'r0').meeples).toEqual([a]);
  });

  it('monastery scores 9 when surrounded; end scoring counts unfinished features', () => {
    const board: Record<string, Placed> = {};
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) board[key(dx, dy)] = { t: 'B', rot: 0, meeples: {} };
    expect(segments('B')).toEqual(['m']);
    expect(segments('L')).toEqual(['c0', 'r0', 'r1', 'r2']);
    const big = feature({ [key(0, 0)]: { t: 'C', rot: 0, meeples: { c0: 1 } } }, 0, 0, 'c0');
    expect(big).toMatchObject({ open: 4, shields: 1, meeples: [1] });
  });

  it('the stack order is hidden; only the drawn tile and count are public', () => {
    const snap = game(3, 2);
    const v = projectFor(m, snap, p(1)).view as CarcView;
    expect(v).not.toHaveProperty('stack');
    expect(v.tile).toBe(st(snap).stack[0]);
    expect(v.stackCount).toBe(st(snap).stack.length);
  });

  it('timeouts place without a follower; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(Object.keys(st(t).board)).toHaveLength(2);
    expect(st(t).meeplesLeft[c]).toBe(7);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = carcModule.tutorial!;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      expect(st(snap).current).toBe(0);
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 6 });
  });

  it('random games use every tile and replay deterministically', () => {
    for (let g = 0; g < 8; g++) {
      const rng = createRng({ s: 31 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 200 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const opts = placements(s.board, s.stack[0]!);
        const pl = opts[rng.nextInt(opts.length)]!;
        const segs = segments(s.stack[0]!);
        const action = { type: 'place', ...pl, ...(s.meeplesLeft[seat] && rng.nextInt(2) ? { meeple: segs[rng.nextInt(segs.length)] } : {}) };
        const r = applyAction(m, snap, p(seat), action, 0);
        const used = 'ok' in r ? { type: 'place', ...pl } : action;
        snap = act(snap, seat, used);
        inputs.push({ kind: 'action', actor: p(seat), action: used, logicalTime: 0 });
        const t = st(snap);
        const onBoard = Object.values(t.board).reduce((k, b) => k + Object.keys(b.meeples).length, 0);
        expect(onBoard + t.meeplesLeft.reduce((a, b) => a + b, 0)).toBe(7 * players);
      }
      const t = st(snap);
      expect(t.outcome).not.toBeNull();
      expect(Object.keys(t.board).length + t.discarded).toBe(72);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
