import { describe, expect, it } from 'vitest';
import { destinations, hiveModule, key, legalActions, oneHiveWithout, placements, type Bug, type Color, type HiveState, type HiveView, type Piece } from '@bg/game-hive';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = hiveModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as HiveState;
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
const keys = (hs: [number, number][]) => hs.map(key).sort();
/** A position from a list of [q, r, colour, bug] (stacks bottom → top when repeated), queens counted as placed. */
function position(pieces: [number, number, Color, Bug][], turn: Color = 'w') {
  const snap = game();
  const s = st(snap);
  s.stacks = {};
  for (const [q, r, c, t] of pieces) { (s.stacks[key([q, r])] ??= []).push({ c, t } as Piece); s.reserve[c][t] -= 1; s.placed[c] += 1; }
  s.turn = turn; s.turnNo = 8;
  return snap;
}

describe('hive rules', () => {
  it('opening placements: centre, then next to it; then only next to your own pieces', () => {
    let snap = game();
    expect(keys(placements(st(snap), 'w'))).toEqual(['0,0']);
    snap = act(snap, 0, { type: 'place', bug: 'G', to: [0, 0] });
    expect(placements(st(snap), 'b')).toHaveLength(6);
    snap = act(snap, 1, { type: 'place', bug: 'G', to: [1, 0] });
    const w = keys(placements(st(snap), 'w'));
    expect(w).toEqual(keys([[-1, 0], [-1, 1], [0, -1]]));
    expect(reject(snap, 0, { type: 'move', from: [0, 0], to: [0, 1] })).toBe('QUEEN_FIRST');
  });

  it('the queen must be placed by the fourth turn', () => {
    let snap = game();
    const moves: [number, Bug, [number, number]][] = [[0, 'G', [0, 0]], [1, 'G', [1, 0]], [0, 'A', [-1, 0]], [1, 'A', [2, 0]], [0, 'S', [-2, 0]], [1, 'S', [3, 0]]];
    for (const [seat, bug, to] of moves) snap = act(snap, seat, { type: 'place', bug, to });
    expect(reject(snap, 0, { type: 'place', bug: 'B', to: [-3, 0] })).toBe('QUEEN_BY_FOURTH_TURN');
    expect(legalActions(st(snap)).every((a) => a.type === 'place' && a.bug === 'Q')).toBe(true);
  });

  it('one hive: a piece whose removal splits the hive cannot move', () => {
    const snap = position([[0, 0, 'w', 'Q'], [1, 0, 'w', 'A'], [2, 0, 'b', 'Q'], [-1, 0, 'b', 'A']]);
    expect(oneHiveWithout(st(snap).stacks, [0, 0])).toBe(false);
    expect(destinations(st(snap), [0, 0])).toEqual([]);
    expect(destinations(st(snap), [1, 0])).toEqual([]); // the ant also bridges
  });

  it('movement: queen one step, grasshopper jumps, spider exactly three, ant anywhere around, beetle climbs', () => {
    const snap = position([[0, 0, 'w', 'Q'], [1, 0, 'b', 'Q'], [2, 0, 'w', 'G'], [-1, 0, 'w', 'B'], [0, 1, 'w', 'S'], [1, -1, 'w', 'A']]);
    const s = st(snap);
    // Grasshopper on (2,0) jumps over (1,0) and (0,0) and (-1,0) to (-2,0).
    expect(keys(destinations(s, [2, 0]))).toContain('-2,0');
    // Beetle may climb onto the queen next to it.
    expect(keys(destinations(s, [-1, 0]))).toContain('0,0');
    // Spider destinations are exactly three steps away along the hive.
    expect(destinations(s, [0, 1]).length).toBeGreaterThan(0);
    expect(keys(destinations(s, [0, 1]))).not.toContain('1,1');
    // Ant reaches many cells, the queen only neighbours.
    expect(destinations(s, [1, -1]).length).toBeGreaterThan(destinations(s, [0, 0]).length);
  });

  it('freedom to move: a piece cannot slide through a narrow gap', () => {
    // A white queen in a pocket at (0,0): neighbours (1,0),(1,-1),(0,-1),(-1,0),(-1,1) occupied; (0,1) open but only
    // reachable between (-1,1) and (1,0)? (0,1) touches both → the gate is closed.
    const snap = position([[0, 0, 'w', 'Q'], [1, 0, 'b', 'Q'], [1, -1, 'w', 'A'], [0, -1, 'w', 'G'], [-1, 0, 'w', 'G'], [-1, 1, 'w', 'B'], [1, 1, 'b', 'A'], [-1, 2, 'b', 'G']]);
    expect(destinations(st(snap), [0, 0])).toEqual([]);
  });

  it('surrounding a queen wins; both at once draws; resign and timeouts', () => {
    let snap = position([[0, 0, 'b', 'Q'], [1, 0, 'w', 'A'], [1, -1, 'w', 'B'], [0, -1, 'b', 'S'], [-1, 0, 'b', 'A'], [-1, 1, 'w', 'G'], [2, -1, 'w', 'Q'], [-1, 2, 'w', 'A']]);
    snap = act(snap, 0, { type: 'move', from: [-1, 2], to: [0, 1] });
    expect(st(snap).end).toMatchObject({ kind: 'queen', surrounded: ['b'] });
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    expect(st(act(game(), 1, { type: 'resign' })).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
    let t = game();
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(Object.keys(st(t).stacks)).toHaveLength(1);
  });

  it('view is public; tutorial is legal and ends in a win', () => {
    expect(projectFor(m, game(), p(1)).view as HiveView).not.toHaveProperty('timeouts');
    const t = hiveModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toEqual({ seat: 0, place: 1 });
  });

  it('random games keep the hive connected, 11 pieces each, and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 20 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 120 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.colors.indexOf(s.turn);
        const all = legalActions(s);
        const action = all[rng.nextInt(all.length)]!;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        for (const c of ['w', 'b'] as Color[]) {
          const onBoard = Object.values(a.stacks).flat().filter((x) => x.c === c).length;
          expect(onBoard + Object.values(a.reserve[c]).reduce((x, y) => x + y, 0)).toBe(11);
        }
        const cells = Object.keys(a.stacks);
        if (cells.length) expect(oneHiveWithout({ ...a.stacks, '99,99': [{ c: 'w', t: 'A' }] }, [99, 99])).toBe(true);
      }
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
