import { describe, expect, it } from 'vitest';
import { azulModule, endBonus, floorPenalty, placeScore, wallCol, type AzulState, type Color } from '@bg/game-azul';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = azulModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as AzulState;
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
const tileCount = (s: AzulState) => s.bag.length + s.lid.length + s.factories.flat().length + s.center.length
  + s.boards.reduce((a, b) => a + b.lines.reduce((x, l) => x + l.n, 0) + b.wall.flat().filter(Boolean).length + b.floor.filter((t) => t !== 'first').length, 0);

describe('azul rules', () => {
  it('scores placements, floors and end bonuses', () => {
    const w = Array.from({ length: 5 }, () => Array(5).fill(false));
    w[0]![0] = true;
    expect(placeScore(w, 0, 0)).toBe(1);
    w[0]![1] = true; w[1]![1] = true;
    expect(placeScore(w, 1, 1)).toBe(2);
    w[2]![1] = true; w[1]![0] = true; w[1]![2] = true;
    expect(placeScore(w, 1, 1)).toBe(3 + 3);
    expect(floorPenalty(3)).toBe(-4);
    expect(floorPenalty(9)).toBe(-14);
    const full = Array.from({ length: 5 }, () => Array(5).fill(true));
    expect(endBonus(full)).toMatchObject({ rows: 5, cols: 5, colors: 5, points: 10 + 35 + 50 });
  });

  it('setup: 5/7/9 factories of four', () => {
    expect(st(game(2)).factories.map((f) => f.length)).toEqual([4, 4, 4, 4, 4]);
    expect(st(game(4)).factories).toHaveLength(9);
    expect(tileCount(st(game(3)))).toBe(100);
  });

  it('taking from a factory sends the rest to the centre; centre first-taker gets the marker; lines and overflow', () => {
    let snap = game(2);
    const s = st(snap);
    s.current = 0;
    s.factories[0] = ['b', 'b', 'r', 'y'];
    snap = act(snap, 0, { type: 'take', from: 0, color: 'b', line: 0 });
    let t = st(snap);
    expect(t.boards[0]!.lines[0]).toEqual({ color: 'b', n: 1 });
    expect(t.boards[0]!.floor).toEqual(['b']);
    expect(t.center.sort()).toEqual(['r', 'y']);
    expect(reject(snap, 1, { type: 'take', from: 0, color: 'b', line: 0 })).toBe('NO_SUCH_TILES');
    snap = act(snap, 1, { type: 'take', from: 'center', color: 'r', line: 2 });
    t = st(snap);
    expect(t.boards[1]!.floor).toEqual(['first']);
    expect(t.nextStarter).toBe(1);
    expect(reject(snap, 0, { type: 'take', from: 'center', color: 'y', line: 0 })).toBe('LINE_NOT_ALLOWED'); // line 0 holds blue
    t.boards[0]!.wall[1]![wallCol(1, 'y')] = true;
    expect(reject(snap, 0, { type: 'take', from: 'center', color: 'y', line: 1 })).toBe('LINE_NOT_ALLOWED'); // yellow already on wall row 2
  });

  it('a round tiles full lines to the wall, keeps 100 tiles, and the marker holder starts', () => {
    let snap = game(2, 3);
    for (let guard = 0; guard < 60 && st(snap).round === 1; guard++) {
      const s = st(snap);
      const h = projectFor(m, snap, p(s.current)).legalActions.find((x) => x.type === 'take')!;
      const lines = h.lines as number[];
      snap = act(snap, s.current, { type: 'take', from: h.from, color: h.color, line: lines.length ? lines[lines.length - 1] : 'floor' });
    }
    const s = st(snap);
    expect(s.round).toBe(2);
    expect(s.current).toBe(s.nextStarter);
    expect(s.boards.some((b) => b.wall.flat().some(Boolean))).toBe(true);
    expect(tileCount(s)).toBe(100);
  });

  it('timeouts take the smallest group; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).timeouts[c]).toBe(1);
    expect(st(t).current).toBe((c + 1) % 3);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = azulModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 25 }, { seat: 1, place: 2, score: 10 }]);
  });

  it('random games keep 100 tiles, end on a full row and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 23 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const seat = st(snap).current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'take');
        const h = hints[rng.nextInt(hints.length)]!;
        const lines = h.lines as number[];
        const action = { type: 'take', from: h.from, color: h.color as Color, line: lines.length && rng.nextInt(6) ? lines[rng.nextInt(lines.length)] : 'floor' };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(tileCount(st(snap))).toBe(100);
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      expect(s.boards.some((b) => b.wall.some((r) => r.every(Boolean)))).toBe(true);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
