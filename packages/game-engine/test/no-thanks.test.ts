import { describe, expect, it } from 'vitest';
import { cardPoints, noThanksModule, runs, type NoThanksState, type NoThanksView } from '@bg/game-no-thanks';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = noThanksModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as NoThanksState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

describe('no thanks rules', () => {
  it('setup: 24 of the 33 cards in play, chips by player count', () => {
    const s = st(game(3));
    expect(s.deck.length + 1 + s.removed.length).toBe(33);
    expect(s.removed).toHaveLength(9);
    expect(s.chips).toEqual([11, 11, 11]);
    expect(st(game(6)).chips[0]).toBe(9);
    expect(st(game(7)).chips[0]).toBe(7);
  });

  it('scoring: only the lowest card of each run counts, chips subtract', () => {
    expect(cardPoints([24, 26, 25, 3, 10, 11])).toBe(24 + 3 + 10);
    expect(runs([5, 7, 6, 9])).toEqual([[5, 6, 7], [9]]);
  });

  it('pass costs a chip and moves on; take collects card and chips and keeps the turn', () => {
    let snap = game(3);
    const cur = st(snap).current;
    expect(reject(snap, (cur + 1) % 3, { type: 'take' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, cur, { type: 'pass' });
    expect(st(snap).chips[cur]).toBe(10);
    expect(st(snap).pot).toBe(1);
    const nxt = st(snap).current;
    expect(nxt).toBe((cur + 1) % 3);
    const card = st(snap).card!;
    snap = act(snap, nxt, { type: 'take' });
    expect(st(snap).cards[nxt]).toContain(card);
    expect(st(snap).chips[nxt]).toBe(12);
    expect(st(snap).current).toBe(nxt);
    // No chips → must take.
    st(snap).chips[nxt] = 0;
    expect(reject(snap, nxt, { type: 'pass' })).toBe('NO_CHIPS');
  });

  it('hidden information: other players chips and the deck are never projected', () => {
    const snap = game(3);
    const v = projectFor(m, snap, p(1)).view as NoThanksView;
    expect(v.chips).toEqual([null, 11, null]);
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('removed');
    expect(v.deckCount).toBe(23);
  });

  it('the game ends when the deck runs out; lowest score wins; resign drops to last', () => {
    let snap = game(3);
    while (!st(snap).outcome) snap = act(snap, st(snap).current, { type: 'take' });
    const s = st(snap);
    expect(s.scores).toHaveLength(3);
    const best = Math.min(...s.scores!);
    expect(s.outcome!.placements.filter((x) => x.place === 1).map((x) => s.scores![x.seat])).toEqual(expect.arrayContaining([best]));
    const v = projectFor(m, snap, p(0)).view as NoThanksView;
    expect(v.chips.every((c) => c !== null)).toBe(true);
    let r = game(3);
    r = act(r, 1, { type: 'resign' });
    expect(st(r).active).toEqual([true, false, true]);
  });

  it('timeouts refuse while chips last', () => {
    let snap = game(3);
    const cur = st(snap).current;
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).chips[cur]).toBe(10);
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = noThanksModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    expect(st(snap).chips.reduce((a, b) => a + b, 0) + st(snap).pot).toBe(22);
    for (const step of t.steps) {
      expect(st(snap).outcome).toBeNull();
      expect(st(snap).current).toBe(0);
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.cards).toEqual([[20, 22, 21, 23], [6, 7, 15, 35]]);
    expect(s.chips).toEqual([19, 3]);
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 1 }, { seat: 1, place: 2, score: 53 }] });
  });

  it('random games conserve chips and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 3 + g });
      const players = 2 + (g % 6);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const total = st(snap).chips.reduce((a, b) => a + b, 0);
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      while (!st(snap).outcome) {
        const s = st(snap);
        const action = { type: s.chips[s.current]! > 0 && rng.nextInt(3) ? 'pass' : 'take' };
        const seat = s.current;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(st(snap).chips.reduce((a, b) => a + b, 0) + st(snap).pot).toBe(total);
      }
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  });
});
