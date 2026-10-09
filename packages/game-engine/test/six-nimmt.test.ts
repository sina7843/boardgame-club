import { describe, expect, it } from 'vitest';
import { bullheads, rowFor, sixNimmtModule, type SixNimmtState, type SixNimmtView } from '@bg/game-six-nimmt';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = sixNimmtModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SixNimmtState;
const game = (players = 3, options: Record<string, unknown> = {}, seed = 1) => startGame(m, { playerCount: players, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

describe('6 nimmt! rules', () => {
  it('bullheads per card; 104 cards dealt 10 each with four starting rows', () => {
    expect([55, 11, 22, 10, 20, 5, 15, 1, 104].map(bullheads)).toEqual([7, 5, 5, 3, 3, 2, 2, 1, 1]);
    expect(Array.from({ length: 104 }, (_, k) => bullheads(k + 1)).reduce((a, b) => a + b, 0)).toBe(171);
    const s = st(game(4));
    expect(s.hands.every((h) => h.length === 10)).toBe(true);
    expect(s.rows.map((r) => r.length)).toEqual([1, 1, 1, 1]);
  });

  it('simultaneous choice: hidden until everyone has chosen, then placed lowest first', () => {
    let snap = game(2);
    const s = st(snap);
    s.rows = [[10], [20], [30], [40]];
    s.hands = [[25, 60, 61, 62, 63, 64, 65, 66, 67, 68], [21, 70, 71, 72, 73, 74, 75, 76, 77, 78]];
    snap = act(snap, 0, { type: 'play', card: 25 });
    expect(reject(snap, 0, { type: 'play', card: 60 })).toBe('ALREADY_CHOSEN');
    const v1 = projectFor(m, snap, p(1)).view as SixNimmtView;
    expect(v1.chosen).toEqual([true, false]);
    expect(v1.hand).not.toContain(25);
    snap = act(snap, 1, { type: 'play', card: 21 });
    expect(st(snap).rows[1]).toEqual([20, 21, 25]);
    expect(st(snap).reveal.map((r) => r.card)).toEqual([21, 25]);
  });

  it('the sixth card takes the row; a card below every row forces a row choice', () => {
    expect(rowFor([[10], [20]], 5)).toBeNull();
    let snap = game(2);
    const s = st(snap);
    s.rows = [[12], [20], [30, 31, 32, 33, 34], [40]];
    s.hands = [[3, 90, 91, 92, 93, 94, 95, 96, 97, 98], [35, 80, 81, 82, 83, 84, 85, 86, 87, 88]];
    snap = act(snap, 0, { type: 'play', card: 3 });
    snap = act(snap, 1, { type: 'play', card: 35 });
    expect(st(snap).phase).toBe('takeRow');
    expect(reject(snap, 1, { type: 'takeRow', row: 0 })).toBe('NOT_YOUR_TURN');
    const v = projectFor(m, snap, p(1)).view as SixNimmtView;
    expect(v.upcoming.map((u) => u.card)).toEqual([3, 35]);
    snap = act(snap, 0, { type: 'takeRow', row: 0 });
    expect(st(snap).rows[0]).toEqual([3]);
    expect(st(snap).rows[2]).toEqual([35]);
    expect(st(snap).taken).toEqual([[12], [30, 31, 32, 33, 34]]);
    // Penalties of the running round are private.
    expect((projectFor(m, snap, p(0)).view as SixNimmtView).myRound).toBe(1);
  });

  it('rounds are scored after ten turns; the game ends at 66 (or after one round on request)', () => {
    let snap = game(2, { length: 'oneRound' });
    for (let t = 0; t < 10; t++) {
      for (const seat of [0, 1]) if (!st(snap).outcome && st(snap).phase === 'choose') snap = act(snap, seat, { type: 'play', card: st(snap).hands[seat]![0] });
      while (st(snap).phase === 'takeRow') snap = act(snap, st(snap).queue[0]!.seat, { type: 'takeRow', row: 0 });
    }
    expect(st(snap).outcome?.reason).toBe('score');
    let long = game(2);
    st(long).totals = [65, 10];
    for (let t = 0; t < 10 && !st(long).outcome; t++) {
      for (const seat of [0, 1]) if (!st(long).outcome && st(long).phase === 'choose') long = act(long, seat, { type: 'play', card: st(long).hands[seat]![0] });
      while (st(long).phase === 'takeRow') long = act(long, st(long).queue[0]!.seat, { type: 'takeRow', row: 0 });
    }
    // Either seat 0 crossed 66 (game over) or a new round was dealt.
    expect(st(long).outcome !== null || st(long).round === 2).toBe(true);
  });

  it('timeouts play the lowest card for everyone pending; resign ends the game', () => {
    let snap = game(3);
    const lows = st(snap).hands.map((h) => h[0]);
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).hands.every((h, k) => !h.includes(lows[k]!))).toBe(true);
    const r = act(game(3), 1, { type: 'resign' });
    expect(st(r).outcome?.placements.find((x) => x.seat === 1)?.place).toBe(3);
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = sixNimmtModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 1 }, { seat: 1, place: 2, score: 16 }], reason: 'score' });
    expect(st(snap).rows).toEqual([[10, 50], [30, 55, 66], [5], [70, 72]]);
  });

  it('random games conserve the 104 cards and replay deterministically', () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng({ s: 8 + g });
      const players = 2 + (g % 9);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        let seat: number; let action: Record<string, unknown>;
        if (s.phase === 'takeRow') { seat = s.queue[0]!.seat; action = { type: 'takeRow', row: rng.nextInt(4) }; }
        else { seat = s.chosen.findIndex((c) => c === null); action = { type: 'play', card: s.hands[seat]![rng.nextInt(s.hands[seat]!.length)] }; }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        if (!a.outcome && a.phase === 'choose' && a.chosen.every((c) => c === null)) {
          const inPlay = a.hands.flat().length + a.rows.flat().length + a.taken.flat().length;
          expect(inPlay).toBe(players * 10 + 4);
        }
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
