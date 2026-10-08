import { describe, expect, it } from 'vitest';
import { jaipurModule, type JaipurState, type JaipurView } from '@bg/game-jaipur';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = jaipurModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as JaipurState;
const game = (seed = 1, options: Record<string, string> = {}) => startGame(m, { playerCount: 2, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const cards = (s: JaipurState) => s.deck.length + s.market.length + s.hands.flat().length + s.herds[0]! + s.herds[1]!;
const tokensLeft = (s: JaipurState) => Object.values(s.tokens).flat().length + s.goods.flat().length;

describe('jaipur rules', () => {
  it('setup: market with three camels, five cards each, camels to the herd', () => {
    const s = st(game());
    expect(s.market.filter((c) => c === 'camel').length).toBeGreaterThanOrEqual(3);
    expect(s.hands[0]!.length + s.herds[0]!).toBe(5);
    expect(cards(s)).toBe(55);
  });

  it('take, camels and exchange follow the rules; the market refills', () => {
    let snap = game(2);
    const s = st(snap);
    s.current = 0;
    s.market = ['camel', 'camel', 'diamond', 'cloth', 'spice'];
    s.hands[0] = ['leather', 'leather', 'gold'];
    s.herds[0] = 1;
    expect(reject(snap, 0, { type: 'exchange', take: ['diamond'], give: ['leather'] })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'exchange', take: ['diamond', 'cloth'], give: ['leather', 'camel', 'camel'] })).toBe('SAME_COUNT');
    expect(reject(snap, 0, { type: 'exchange', take: ['diamond', 'cloth'], give: ['camel', 'camel'] })).toBe('NO_CAMELS');
    snap = act(snap, 0, { type: 'exchange', take: ['diamond', 'cloth'], give: ['leather', 'camel'] });
    expect(st(snap).hands[0]!.sort()).toEqual(['cloth', 'diamond', 'gold', 'leather']);
    expect(st(snap).herds[0]).toBe(0);
    expect(st(snap).market.length).toBe(5);
    const camels = st(snap).market.filter((c) => c === 'camel').length;
    const herd = st(snap).herds[1]!;
    snap = act(snap, 1, { type: 'camels' });
    expect(st(snap).herds[1]).toBe(herd + camels);
    expect(st(snap).market.length).toBe(5);
  });

  it('selling takes the top tokens and a bonus for three or more; precious goods need two', () => {
    let snap = game(3);
    const s = st(snap);
    s.current = 0;
    s.hands[0] = ['diamond', 'leather', 'leather', 'leather', 'leather'];
    expect(reject(snap, 0, { type: 'sell', good: 'diamond', count: 1 })).toBe('SELL_TWO');
    snap = act(snap, 0, { type: 'sell', good: 'leather', count: 4 });
    expect(st(snap).goods[0]).toEqual([4, 3, 2, 1]);
    expect(st(snap).bonuses[0]).toHaveLength(1);
    expect(st(snap).bonuses[0]![0]).toBeGreaterThanOrEqual(4);
    const other = projectFor(m, snap, p(1)).view as JaipurView;
    expect(other.bonuses[0]).toBe(1);
    expect(other).not.toHaveProperty('hands');
    expect(other).not.toHaveProperty('deck');
  });

  it('three empty token piles end the round; camels bonus; two seals win; timeouts and resign', () => {
    let snap = game(4);
    const s = st(snap);
    s.current = 0;
    s.tokens.diamond = []; s.tokens.gold = [];
    s.tokens.cloth = [1];
    s.hands[0] = ['cloth', 'spice'];
    s.herds = [4, 2];
    snap = act(snap, 0, { type: 'sell', good: 'cloth', count: 1 });
    const t = st(snap);
    expect(t.roundResults).toHaveLength(1);
    expect(t.roundResults[0]).toMatchObject({ winner: 0, camelBonus: 0 });
    expect(t.seals).toEqual([1, 0]);
    expect(t.round).toBe(2);
    expect(t.current).toBe(1);
    let tt = game(5);
    const c = st(tt).current;
    tt = (applyTimeout(m, tt, 0) as StepResult).snapshot;
    expect(st(tt).timeouts[c]).toBe(1);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = jaipurModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games conserve cards and tokens and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 29 + g });
      const setup = { playerCount: 2, seed: g, options: { length: g % 2 ? 'one' : 'best3' } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const round = s.round;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign' && h.type !== 'exchange');
        const sells = hints.filter((h) => h.type === 'sell');
        const h = sells.length && rng.nextInt(3) === 0 ? sells[rng.nextInt(sells.length)]! : hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'sell' ? { type: 'sell', good: h.good, count: (h.min as number) + rng.nextInt((h.max as number) - (h.min as number) + 1) }
          : h.type === 'take' ? { type: 'take', good: h.good } : { type: h.type };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        if (t.round === round && !t.outcome) { expect(cards(t)).toBeLessThanOrEqual(55); expect(tokensLeft(t)).toBe(38); }
        expect(t.hands.every((x) => x.length <= 7)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
