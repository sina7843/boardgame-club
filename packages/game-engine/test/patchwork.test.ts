import { describe, expect, it } from 'vitest';
import { PATCHES, fits, offered, orient, patchworkModule, score, type PatchworkState } from '@bg/game-patchwork';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = patchworkModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as PatchworkState;
const game = (seed = 1) => startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const key = (cells: [number, number][]) => cells.map(([r, c]) => `${r},${c}`).sort().join(' ');

describe('patchwork rules', () => {
  it('33 patches; orientation keeps size and normalises; the smallest patch is offered first', () => {
    expect(PATCHES).toHaveLength(33);
    const l = PATCHES[2]!.cells;
    expect(key(orient(l, 1, false))).not.toBe(key(l));
    expect(key(orient(l, 4 % 4, false))).toBe(key(l));
    expect(orient(PATCHES[12]!.cells, 3, true).every(([r, c]) => r >= 0 && c >= 0)).toBe(true);
    expect(offered(st(game()))[0]).toBe(0);
  });

  it('the player behind moves; advancing earns a button per space and passes income spaces', () => {
    let snap = game(2);
    const s = st(snap);
    s.current = 0; s.pos = [3, 7]; s.income = [2, 0];
    expect(reject(snap, 1, { type: 'advance' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'advance' });
    const t = st(snap);
    expect(t.pos[0]).toBe(8);
    expect(t.buttons[0]).toBe(5 + 5 + 2); // five spaces, income space 5
    expect(t.current).toBe(1);
  });

  it('buying pays buttons, places the oriented patch, moves the token and time; a tie lets the mover go again', () => {
    let snap = game(3);
    const s = st(snap);
    s.current = 0; s.pos = [0, 1];
    const id = offered(s)[0]!;
    const patch = PATCHES[id]!;
    expect(reject(snap, 0, { type: 'buy', patch: 99, rot: 0, flip: false, row: 0, col: 0 })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'buy', patch: id, rot: 0, flip: false, row: 8, col: 8 })).toBe('DOES_NOT_FIT');
    snap = act(snap, 0, { type: 'buy', patch: id, rot: 0, flip: false, row: 0, col: 0 });
    const t = st(snap);
    expect(t.buttons[0]).toBe(5 - patch.cost);
    expect(t.quilts[0]!.flat().filter((x) => x === id)).toHaveLength(patch.cells.length);
    expect(t.pos[0]).toBe(patch.time);
    expect(t.circle).not.toContain(id);
    if (patch.time === 1) expect(t.current).toBe(0);
  });

  it('the first to pass a leather space places a 1×1 patch; a full 7×7 earns 7', () => {
    let snap = game(4);
    const s = st(snap);
    s.current = 0; s.pos = [18, 22];
    snap = act(snap, 0, { type: 'advance' });
    expect(st(snap).pendingLeather).toEqual([0]);
    expect(reject(snap, 0, { type: 'advance' })).toBe('PLACE_LEATHER');
    snap = act(snap, 0, { type: 'leather', row: 0, col: 0 });
    expect(st(snap).quilts[0]![0]![0]).toBe(-1);
    expect(st(snap).leatherLeft).not.toContain(20);
    const q = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r < 7 && c < 7 && !(r === 6 && c === 6) ? 5 : null)));
    expect(fits(q, [[0, 0]], 6, 6)).toBe(true);
    expect(score({ buttons: [10], quilts: [q], bonus7: null }, 0)).toBe(10 - 2 * (81 - 48));
  });

  it('timeouts advance; resign loses', () => {
    let t = game(5);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).pos[c]).toBe(1);
    expect(st(t).timeouts[c]).toBe(1);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('timeouts');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = patchworkModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).bonus7).toBe(0);
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games end at 53 and replay deterministically', () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng({ s: 31 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const q = s.quilts[seat]!;
        let action: unknown = { type: 'advance' };
        if (s.pendingLeather.length) { const i = q.flat().indexOf(null); action = { type: 'leather', row: Math.floor(i / 9), col: i % 9 }; }
        else if (rng.nextInt(3)) {
          search: for (const id of offered(s)) {
            if (PATCHES[id]!.cost > s.buttons[seat]!) continue;
            for (let rot = 0; rot < 4; rot++) for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
              if (fits(q, orient(PATCHES[id]!.cells, rot, false), r, c)) { action = { type: 'buy', patch: id, rot, flip: false, row: r, col: c }; break search; }
            }
          }
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.circle.length + t.quilts.flat(2).filter((x) => x !== null && x >= 0).length).toBeGreaterThan(0);
        expect(t.buttons.every((b) => b >= 0)).toBe(true);
      }
      const t = st(snap);
      expect(t.outcome).not.toBeNull();
      expect(t.pos).toEqual([53, 53]);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
