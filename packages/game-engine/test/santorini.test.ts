import { describe, expect, it } from 'vitest';
import { buildTargets, moveTargets, santoriniModule, turns, type SantoriniState, type SantoriniView } from '@bg/game-santorini';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = santoriniModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SantoriniState;
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
const at = (r: number, c: number) => r * 5 + c;
const placed = () => {
  let snap = game();
  snap = act(snap, 0, { type: 'place', at: at(1, 1) });
  snap = act(snap, 0, { type: 'place', at: at(1, 3) });
  snap = act(snap, 1, { type: 'place', at: at(3, 1) });
  return act(snap, 1, { type: 'place', at: at(3, 3) });
};

describe('santorini rules', () => {
  it('setup: the first player places both workers, then the other; then the first player moves', () => {
    let snap = game();
    expect(st(snap).phase).toBe('setup');
    expect(reject(snap, 1, { type: 'place', at: 0 })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'place', at: at(1, 1) });
    expect(st(snap).current).toBe(0);
    expect(reject(snap, 0, { type: 'place', at: at(1, 1) })).toBe('SQUARE_TAKEN');
    snap = placed();
    expect(st(snap).phase).toBe('play');
    expect(st(snap).current).toBe(0);
  });

  it('moves: 8 directions, up at most one level, down any, never onto workers or domes', () => {
    const s = st(placed());
    s.height[at(2, 2)] = 1; s.height[at(0, 0)] = 2; s.height[at(2, 1)] = 4;
    const t = moveTargets(s, at(1, 1));
    expect(t).toContain(at(2, 2));
    expect(t).not.toContain(at(0, 0)); // two levels up
    expect(t).not.toContain(at(2, 1)); // dome
    s.height[at(1, 1)] = 3;
    expect(moveTargets(s, at(1, 1))).toContain(at(0, 0)); // down is fine
    // Build may go on the square just left.
    expect(buildTargets(s, at(1, 1), at(2, 2))).toContain(at(1, 1));
  });

  it('a turn moves then builds; level 3 gets a dome; supply is limited', () => {
    let snap = placed();
    expect(reject(snap, 0, { type: 'turn', from: at(1, 1), to: at(2, 2), build: at(4, 4) })).toBe('ILLEGAL_MOVE');
    snap = act(snap, 0, { type: 'turn', from: at(1, 1), to: at(2, 2), build: at(2, 3) });
    expect(st(snap).height[at(2, 3)]).toBe(1);
    expect(st(snap).supply[1]).toBe(21);
    expect(st(snap).current).toBe(1);
    const s = st(snap);
    s.height[at(4, 4)] = 3;
    snap = act(snap, 1, { type: 'turn', from: at(3, 3), to: at(3, 4), build: at(4, 4) });
    expect(st(snap).height[at(4, 4)]).toBe(4);
    expect(st(snap).supply.dome).toBe(17);
  });

  it('climbing onto level 3 wins; a player without a whole turn loses', () => {
    let snap = placed();
    Object.assign(st(snap).height, { [at(1, 1)]: 2, [at(2, 2)]: 3 });
    snap = act(snap, 0, { type: 'turn', from: at(1, 1), to: at(2, 2) });
    expect(st(snap).end).toEqual({ kind: 'climb' });
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    // Seat 1 boxed in by domes after seat 0's turn → seat 1 loses.
    let box = game();
    const s = st(box);
    s.phase = 'play'; s.current = 0; s.workers = [[at(4, 4), at(2, 2)], [at(0, 0), at(0, 1)]];
    for (const i of [at(1, 0), at(1, 1), at(1, 2), at(0, 2)]) s.height[i] = 4;
    expect(turns(s, 1)).toEqual([]);
    box = act(box, 0, { type: 'turn', from: at(4, 4), to: at(4, 3), build: at(4, 4) });
    expect(st(box).end).toEqual({ kind: 'stuck' });
    expect(st(box).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('timeouts play for the absent player; three in a row lose; resign loses', () => {
    let snap = game();
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).workers[0]).toHaveLength(1);
    let t = placed();
    for (let k = 0; k < 3 && !st(t).outcome; k++) {
      t = (applyTimeout(m, t, 0) as StepResult).snapshot;
      if (!st(t).outcome && st(t).current === 1) t = act(t, 1, { type: 'turn', ...turns(st(t), 1).find((x) => x.build !== undefined)! });
    }
    expect(['timeout', 'climb', 'stuck']).toContain(st(t).end?.kind);
    expect(st(act(placed(), 1, { type: 'resign' })).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('view is public; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, placed(), p(1)).view as SantoriniView).not.toHaveProperty('timeouts');
    const t = santoriniModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    expect(st(snap).supply).toEqual({ 1: 14, 2: 13, 3: 12, dome: 18 });
    for (const step of t.steps) {
      expect(st(snap).outcome).toBeNull();
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect([s.height[9], s.height[13], s.height[11]]).toEqual([4, 4, 3]); // two domes, the climbed tower
    expect(s.workers[0]).toEqual([11, 8]);
    expect(s.end).toEqual({ kind: 'climb' });
    expect(s.outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('random games keep the block supply consistent and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 90 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        let action: Record<string, unknown>;
        if (s.phase === 'setup') {
          const free = Array.from({ length: 25 }, (_, i) => i).filter((i) => !s.workers[0].includes(i) && !s.workers[1].includes(i));
          action = { type: 'place', at: free[rng.nextInt(free.length)] };
        } else { const all = turns(s, seat); action = { type: 'turn', ...all[rng.nextInt(all.length)] }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        const used = (lvl: number) => a.height.filter((h) => h >= lvl).length;
        expect(a.supply[1] + used(1)).toBe(22);
        expect(a.supply.dome + used(4)).toBe(18);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
