import { describe, expect, it } from 'vitest';
import { lineThreeModule, type LineThreeState } from '@bg/game-line-three';
import { applyAction, applyTimeout, projectFor, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = lineThreeModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });

function start(seed = 42) {
  return startGame(m, { playerCount: 2, seed }).snapshot;
}
function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(r.errorCode);
  return r;
}
const st = (s: EngineSnapshot) => s.state as LineThreeState;
function play(seed: number, cells: number[]) {
  let snap = start(seed);
  let last: StepResult | undefined;
  for (const cell of cells) { last = act(snap, st(snap).current, { type: 'place', cell }); snap = last.snapshot; }
  return { snap, last: last! };
}

describe('line-three rules', () => {
  it('setup: empty board, seeded first actor plays X, deterministic per seed', () => {
    const firsts = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const s = st(start(seed));
      expect(s.board.every((c) => c === null)).toBe(true);
      expect(s.symbols[s.current]).toBe('X');
      firsts.add(s.current);
      expect(st(start(seed))).toEqual(s);
    }
    expect(firsts).toEqual(new Set([0, 1]));
  });

  it('rejects wrong actor, occupied cell, bad cell, unknown action and actions after finish; state untouched', () => {
    const snap = start();
    const cur = st(snap).current;
    expect(applyAction(m, snap, p(1 - cur), { type: 'place', cell: 0 }, 0)).toEqual({ ok: false, errorCode: 'NOT_YOUR_TURN' });
    const after = act(snap, cur, { type: 'place', cell: 0 }).snapshot;
    expect(applyAction(m, after, p(1 - cur), { type: 'place', cell: 0 }, 0)).toEqual({ ok: false, errorCode: 'CELL_OCCUPIED' });
    expect(applyAction(m, after, p(1 - cur), { type: 'place', cell: 9 }, 0)).toEqual({ ok: false, errorCode: 'INVALID_ACTION' });
    expect(applyAction(m, after, p(1 - cur), { type: 'fly' }, 0)).toEqual({ ok: false, errorCode: 'INVALID_ACTION' });
    expect(applyAction(m, after, { kind: 'engine' }, { type: 'place', cell: 1 }, 0)).toEqual({ ok: false, errorCode: 'NOT_A_PLAYER' });
    expect(st(snap).board.every((c) => c === null)).toBe(true);
  });

  it('three in a row wins (row, column, diagonal) and clears the deadline', () => {
    for (const cells of [[0, 3, 1, 4, 2], [0, 1, 3, 4, 6], [0, 1, 4, 2, 8], [2, 0, 4, 1, 6]]) {
      const { snap, last } = play(42, cells);
      const first = st(start(42)).current;
      expect(last.outcome).toEqual({ placements: [{ seat: first, place: 1 }, { seat: 1 - first, place: 2 }], reason: 'win' });
      expect(last.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
      expect(applyAction(m, snap, p(1 - first), { type: 'place', cell: 5 }, 0)).toEqual({ ok: false, errorCode: 'GAME_FINISHED' });
    }
  });

  it('full board without a line is a draw with shared placement', () => {
    const { last } = play(42, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(last.outcome).toEqual({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' });
  });

  it('a normal move sets the next turn deadline', () => {
    expect(play(42, [4]).last.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
  });

  it('timeout: current actor loses; resignation: resigning actor loses (even off-turn)', () => {
    const snap = start();
    const cur = st(snap).current;
    expect(applyTimeout(m, snap, 0).outcome).toEqual({ placements: [{ seat: 1 - cur, place: 1 }, { seat: cur, place: 2 }], reason: 'timeout' });
    expect(act(snap, 1 - cur, { type: 'resign' }).outcome).toEqual({ placements: [{ seat: cur, place: 1 }, { seat: 1 - cur, place: 2 }], reason: 'resign' });
  });

  it('projection is public, identical for every viewer, and never contains RNG state', () => {
    const snap = play(42, [4, 0]).snap;
    const a = projectFor(m, snap, p(0)).view;
    expect(projectFor(m, snap, p(1)).view).toEqual(a);
    expect(projectFor(m, snap, { kind: 'spectator' }).view).toEqual(a);
    expect(JSON.stringify(a)).not.toContain(String(snap.rng.s));
    expect(projectFor(m, snap, { kind: 'spectator' }).legalActions).toEqual([]);
  });

  it('tutorial script is playable: learner moves first and wins on the scripted line', () => {
    const t = lineThreeModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed }).snapshot;
    expect(st(snap).current).toBe(0);
    let last: StepResult | undefined;
    for (const step of t.steps) {
      last = act(snap, 0, step.expected); snap = last.snapshot;
      if (step.reply) { last = act(snap, 1, step.reply); snap = last.snapshot; }
    }
    expect(last!.outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });
});
