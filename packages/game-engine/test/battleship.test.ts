import { describe, expect, it } from 'vitest';
import { FLEET, SIZE, bsModule, cellsOf, randomFleet, validFleet, type BsState, type BsView, type Ship } from '@bg/game-battleship';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = bsModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as BsState;
const game = (seed = 1) => startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
/** Five ships stacked in rows 0..4, all starting at column 0. */
const ROWS: Ship[] = FLEET.map((_, ship) => ({ ship, x: 0, y: ship, dir: 'h' }));

describe('battleship rules', () => {
  it('fleet validation: five distinct ships, inside the sea, no overlap', () => {
    expect(FLEET.map((f) => f.len)).toEqual([5, 4, 3, 3, 2]);
    expect(validFleet(ROWS)).toBe(true);
    expect(validFleet([...ROWS.slice(0, 4), { ship: 4, x: 0, y: 0, dir: 'v' }])).toBe(false);
    expect(validFleet([...ROWS.slice(0, 4), { ship: 4, x: 9, y: 9, dir: 'h' }])).toBe(false);
    expect(validFleet([...ROWS.slice(0, 4), { ship: 3, x: 0, y: 8, dir: 'h' }])).toBe(false);
    expect(cellsOf({ ship: 0, x: 2, y: 3, dir: 'v' })).toEqual([32, 42, 52, 62, 72]);
    const rng = createRng({ s: 5 });
    for (let i = 0; i < 50; i++) expect(validFleet(randomFleet(rng))).toBe(true);
  });

  it('placement is simultaneous and secret; firing alternates; hits, misses and sinking are reported', () => {
    let snap = game(2);
    expect(bsModule.pendingSeats(st(snap))).toEqual([0, 1]);
    expect(reject(snap, 0, { type: 'place', ships: [...ROWS.slice(0, 4), { ship: 4, x: 0, y: 0, dir: 'v' }] })).toBe('INVALID_FLEET');
    snap = act(snap, 0, { type: 'place', ships: ROWS });
    expect(reject(snap, 0, { type: 'placeRandom' })).toBe('ALREADY_PLACED');
    expect((projectFor(m, snap, p(1)).view as BsView).seas[0]!.ships).toEqual([]);
    snap = act(snap, 1, { type: 'place', ships: ROWS });
    const a = st(snap).first;
    expect(st(snap)).toMatchObject({ phase: 'fire', current: a });
    expect(reject(snap, 1 - a, { type: 'fire', cell: 0 })).toBe('NOT_YOUR_TURN');
    snap = act(snap, a, { type: 'fire', cell: 4 * SIZE });
    expect(st(snap).last).toMatchObject({ hit: true, sunk: null });
    snap = act(snap, 1 - a, { type: 'fire', cell: 99 });
    expect(st(snap).last).toMatchObject({ hit: false });
    expect(reject(snap, a, { type: 'fire', cell: 4 * SIZE })).toBe('ALREADY_SHOT');
    snap = act(snap, a, { type: 'fire', cell: 4 * SIZE + 1 });
    expect(st(snap).last).toMatchObject({ hit: true, sunk: 4 });
    const v = projectFor(m, snap, p(a)).view as BsView;
    expect(v.seas[1 - a]!.sunk).toEqual([4]);
    expect(v.seas[1 - a]!.ships).toHaveLength(1);
    expect(v.seas[1 - a]!.afloat).toBe(4);
  });

  it('sinking the whole fleet wins; resign loses', () => {
    let snap = game(3);
    snap = act(snap, 0, { type: 'place', ships: ROWS });
    snap = act(snap, 1, { type: 'place', ships: ROWS });
    const a = st(snap).first;
    const targets = ROWS.flatMap((s) => cellsOf(s)!);
    let miss = 99;
    for (const cell of targets) {
      snap = act(snap, a, { type: 'fire', cell });
      if (st(snap).outcome) break;
      snap = act(snap, 1 - a, { type: 'fire', cell: miss-- });
    }
    expect(st(snap).outcome).toMatchObject({ placements: [{ seat: a, place: 1 }, { seat: 1 - a, place: 2 }], reason: 'win' });
    expect((projectFor(m, snap, p(a)).view as BsView).seas[1 - a]!.ships).toHaveLength(5);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('timeouts place randomly for both, then fire at the first open cell', () => {
    let t = game(4);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('fire');
    expect(st(t).seas.every((s) => validFleet(s.ships))).toBe(true);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).seas[1 - c]!.shots).toEqual([0]);
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = bsModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 11 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = bsModule.pendingSeats(s)[0]!;
        let action: unknown;
        if (s.phase === 'place') action = { type: 'placeRandom' };
        else { const open = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((c) => !s.seas[1 - seat]!.shots.includes(c)); action = { type: 'fire', cell: open[rng.nextInt(open.length)] }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
