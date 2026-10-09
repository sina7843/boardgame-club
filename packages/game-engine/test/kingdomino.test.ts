import { describe, expect, it } from 'vitest';
import { DOMINOES, actorOf, canPlace, kingdominoModule, placements, scoreKingdom, type Cell, type KingdominoState } from '@bg/game-kingdomino';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = kingdominoModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as KingdominoState;
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
const blank = () => { const k: (Cell | null)[][] = Array.from({ length: 9 }, () => Array<Cell | null>(9).fill(null)); k[4]![4] = { t: 'C', c: 0 }; return k; };

describe('kingdomino rules', () => {
  it('48 dominoes; deck sizes and line sizes by player count', () => {
    expect(DOMINOES).toHaveLength(48);
    const two = st(game(2));
    expect(two.deck.length + two.next.length).toBe(24);
    expect(two.pickOrder.sort()).toEqual([0, 0, 1, 1]);
    expect(st(game(3)).next).toHaveLength(3);
    expect(st(game(4)).deck.length + 4).toBe(48);
  });

  it('placement: next to the castle or matching terrain, inside 5×5', () => {
    const k = blank();
    const ff = DOMINOES.findIndex(([a, b]) => a.t === 'F' && b.t === 'F');
    expect(canPlace(k, ff, 4, 5, 0)).toBe(true);
    expect(canPlace(k, ff, 0, 0, 0)).toBe(false);
    k[4]![5] = { t: 'F', c: 0 }; k[4]![6] = { t: 'F', c: 0 };
    k[4]![3] = { t: 'F', c: 0 };
    expect(canPlace(k, ff, 4, 2, 2)).toBe(false); // columns 1…6 would be six wide
    const ll = DOMINOES.findIndex(([a, b]) => a.t === 'L' && b.t === 'L');
    expect(canPlace(k, ll, 3, 5, 0)).toBe(false); // lake next to forest only
    expect(canPlace(k, ll, 3, 4, 3)).toBe(true); // touches the castle
  });

  it('scores size × crowns per region', () => {
    const k = blank();
    k[4]![3] = { t: 'W', c: 1 }; k[4]![2] = { t: 'W', c: 0 }; k[3]![3] = { t: 'W', c: 1 };
    k[5]![4] = { t: 'M', c: 2 };
    k[4]![5] = { t: 'F', c: 0 };
    expect(scoreKingdom(k)).toEqual({ total: 3 * 2 + 2, largest: 3, crowns: 4 });
  });

  it('first line: picks in random order; then kings place in line order and pick from the next line', () => {
    let snap = game(2, 3);
    const order = st(snap).pickOrder.slice();
    for (let i = 0; i < 4; i++) snap = act(snap, order[i]!, { type: 'pick', slot: i });
    const s = st(snap);
    expect(s.phase).toBe('play');
    expect(s.current.map((x) => x.owner)).toEqual(order);
    const seat = actorOf(s)!;
    expect(reject(snap, seat, { type: 'play', place: null, slot: 0 })).toBe('MUST_PLACE');
    const pl = placements(s.kingdoms[seat]!, s.current[0]!.dom)[0]!;
    expect(reject(snap, seat, { type: 'play', place: pl })).toBe('PICK_NEXT');
    snap = act(snap, seat, { type: 'play', place: pl, slot: 2 });
    expect(st(snap).next[2]!.owner).toBe(seat);
    expect(st(snap).kingdoms[seat]!.flat().filter(Boolean)).toHaveLength(3);
  });

  it('timeouts place and pick; resign ends with the resigner last', () => {
    let t = game(3);
    const a = actorOf(st(t))!;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).next.some((x) => x.owner === a)).toBe(true);
    expect(st(t).timeouts[a]).toBe(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('deck');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = kingdominoModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 25 }, { seat: 1, place: 2, score: 8 }]);
    expect(st(snap).discarded).toEqual([]);
  });

  it('random games use every domino and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 37 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 500 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = actorOf(s)!;
        const free = s.next.map((x, i) => (x.owner === null ? i : -1)).filter((i) => i >= 0);
        const slot = free.length ? { slot: free[rng.nextInt(free.length)] } : {};
        let action: unknown;
        if (s.phase === 'pick') action = { type: 'pick', ...slot };
        else { const ps = placements(s.kingdoms[seat]!, s.current[s.idx]!.dom); action = { type: 'play', place: ps.length ? ps[rng.nextInt(ps.length)] : null, ...slot }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      const used = s.kingdoms.reduce((a, k) => a + k.flat().filter((c) => c && c.t !== 'C').length, 0) / 2 + s.discarded.length;
      expect(used).toBe(players === 2 ? 24 : players === 3 ? 36 : 48);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
