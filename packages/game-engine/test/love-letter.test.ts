import { describe, expect, it } from 'vitest';
import { loveLetterModule, mustPlayCountess, targetsFor, tokensToWin, type LoveLetterState, type LoveLetterView } from '@bg/game-love-letter';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = loveLetterModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as LoveLetterState;
const game = (players = 3, seed = 1, options: Record<string, unknown> = {}) => startGame(m, { playerCount: players, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
/** A 3-player round with fixed hands; seat 0 to play holding `mine`. */
function fixed(mine: number[], others: number[], deck = [1, 2, 4, 1, 5, 1]) {
  const snap = game(3);
  const s = st(snap);
  s.current = 0; s.hands = [mine, [others[0]!], [others[1]!]]; s.deck = deck.slice();
  s.inRound = [true, true, true]; s.protectedSeats = [false, false, false]; s.discards = [[], [], []]; s.seen = [null, null, null];
  return snap;
}

describe('love letter rules', () => {
  it('setup: one card set aside, three face up with two players; the first player holds two cards', () => {
    const s2 = st(game(2));
    expect(s2.faceUp).toHaveLength(3);
    expect(s2.hands[s2.current]).toHaveLength(2);
    expect(s2.deck.length + 1 + 3 + 3).toBe(16);
    expect([2, 3, 4].map(tokensToWin)).toEqual([7, 5, 4]);
  });

  it('guard: a correct guess knocks the target out; a wrong guess does nothing', () => {
    let snap = fixed([1, 4], [3, 6]);
    expect(reject(snap, 0, { type: 'play', card: 1, target: 1 })).toBe('GUESS_REQUIRED');
    snap = act(snap, 0, { type: 'play', card: 1, target: 1, guess: 3 });
    expect(st(snap).inRound).toEqual([true, false, true]);
    expect(st(snap).discards[1]).toEqual([3]);
    let miss = fixed([1, 4], [3, 6]);
    miss = act(miss, 0, { type: 'play', card: 1, target: 2, guess: 5 });
    expect(st(miss).inRound).toEqual([true, true, true]);
  });

  it('priest shows a hand only to the player; baron knocks out the lower hand', () => {
    let snap = fixed([2, 4], [3, 6]);
    snap = act(snap, 0, { type: 'play', card: 2, target: 2 });
    expect((projectFor(m, snap, p(0)).view as LoveLetterView).seen).toMatchObject({ seat: 2, card: 6 });
    expect((projectFor(m, snap, p(1)).view as LoveLetterView).seen).toBeNull();
    let baron = fixed([3, 5], [4, 2]);
    baron = act(baron, 0, { type: 'play', card: 3, target: 2 });
    expect(st(baron).inRound[2]).toBe(false);
  });

  it('handmaid protects; prince makes a player discard and draw; discarding the princess is out; king swaps', () => {
    let hm = fixed([4, 1], [3, 6]);
    hm = act(hm, 0, { type: 'play', card: 4 });
    expect(st(hm).protectedSeats[0]).toBe(true);
    const s = st(hm);
    expect(targetsFor({ ...s, current: 1 }, 1)).not.toContain(0);
    let pr = fixed([5, 1], [8, 6]);
    pr = act(pr, 0, { type: 'play', card: 5, target: 1 });
    expect(st(pr).inRound[1]).toBe(false);
    let king = fixed([6, 2], [3, 7]);
    king = act(king, 0, { type: 'play', card: 6, target: 1 });
    expect(st(king).hands[0]).toEqual([3]);
  });

  it('the countess must be played with a king or prince', () => {
    expect(mustPlayCountess([7, 5])).toBe(true);
    expect(mustPlayCountess([7, 1])).toBe(false);
    expect(reject(fixed([7, 6], [3, 4]), 0, { type: 'play', card: 6, target: 1 })).toBe('COUNTESS_REQUIRED');
  });

  it('hidden information: hands and the deck stay private', () => {
    const snap = game(3);
    const v = projectFor(m, snap, p(1)).view as LoveLetterView;
    expect(v.hand).toHaveLength(st(snap).current === 1 ? 2 : 1);
    expect(v).not.toHaveProperty('hands');
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('setAside');
  });

  it('rounds award tokens; timeouts play a legal card; tutorial ends in a win', () => {
    let snap = game(3);
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).log.some((e) => e.t === 'play')).toBe(true);
    const t = loveLetterModule.tutorial;
    let tut = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      tut = act(tut, 0, step.expected);
      if (step.reply) tut = act(tut, 1, step.reply);
    }
    expect(st(tut).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games keep 16 cards per round and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 2 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: { length: 'short' } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type === 'play');
        const h = hints[rng.nextInt(hints.length)]!;
        const ts = h.targets as number[];
        const action: Record<string, unknown> = { type: 'play', card: h.card };
        if (ts.length) action.target = ts[rng.nextInt(ts.length)];
        if (h.card === 1 && ts.length) action.guess = 2 + rng.nextInt(7);
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        if (!a.outcome) {
          const count = a.deck.length + (a.setAside === null ? 0 : 1) + a.faceUp.length + a.hands.flat().length + a.discards.flat().length;
          expect(count).toBe(16);
        }
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
