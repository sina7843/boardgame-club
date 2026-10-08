import { describe, expect, it } from 'vitest';
import { CARDS, VEG, pointSaladModule, ruleScore, scores, type PointSaladState, type Veg } from '@bg/game-point-salad';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = pointSaladModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as PointSaladState;
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
const c = (x: Partial<Record<Veg, number>>) => ({ ...Object.fromEntries(VEG.map((v) => [v, 0])), ...x }) as Record<Veg, number>;
const total = (s: PointSaladState) => s.piles.flat().length + s.market.filter((x) => x !== null).length + s.rules.flat().length + s.veggies.flat().length;

describe('point salad rules', () => {
  it('108 cards, 18 of each vegetable; 3 per vegetable per player in play', () => {
    expect(CARDS).toHaveLength(108);
    expect(VEG.map((v) => CARDS.filter((x) => x.veg === v).length)).toEqual([18, 18, 18, 18, 18, 18]);
    expect(total(st(game(2)))).toBe(36);
    expect(total(st(game(6)))).toBe(108);
  });

  it('scores the rule families', () => {
    const me = c({ tomato: 3, onion: 2, lettuce: 1 });
    const other = c({ tomato: 1, onion: 4 });
    expect(ruleScore({ k: 'each', terms: [['tomato', 2], ['onion', -1]] }, 0, [me, other])).toBe(4);
    expect(ruleScore({ k: 'combo', veg: ['tomato', 'lettuce'], pts: 5 }, 0, [me, other])).toBe(5);
    expect(ruleScore({ k: 'combo', veg: ['tomato', 'tomato'], pts: 5 }, 0, [me, other])).toBe(5);
    expect(ruleScore({ k: 'parity', veg: 'onion' }, 0, [me, other])).toBe(7);
    expect(ruleScore({ k: 'most', veg: 'tomato' }, 0, [me, other])).toBe(10);
    expect(ruleScore({ k: 'fewest', veg: 'onion' }, 0, [me, other])).toBe(7);
    expect(ruleScore({ k: 'set' }, 0, [me, other])).toBe(0);
    expect(ruleScore({ k: 'mostTotal' }, 0, [me, other])).toBe(10);
  });

  it('take a rule or two vegetables; flip a rule; the market refills from the pile above', () => {
    let snap = game(2, 3);
    const s = st(snap);
    s.current = 0;
    const top = s.piles[0]![0]!;
    expect(reject(snap, 0, { type: 'veg', slots: [0] })).toBe('TAKE_TWO');
    expect(reject(snap, 1, { type: 'rule', pile: 0 })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'rule', pile: 0 });
    expect(st(snap).rules[0]).toEqual([top]);
    const [a, b] = [st(snap).market[0], st(snap).market[1]];
    snap = act(snap, 1, { type: 'veg', slots: [0, 1] });
    expect(st(snap).veggies[1]).toEqual([a, b]);
    expect(st(snap).market[0]).not.toBeNull();
    snap = act(snap, 0, { type: 'veg', slots: [2, 3], flip: top });
    expect(st(snap).rules[0]).toEqual([]);
    expect(st(snap).veggies[0]).toContain(top);
    expect(reject(snap, 1, { type: 'veg', slots: [4, 5], flip: top })).toBe('NOT_YOUR_RULE');
  });

  it('timeouts take vegetables; resign ends with the resigner last; the deck stays hidden', () => {
    let t = game(3);
    const cur = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).veggies[cur]).toHaveLength(2);
    expect(st(t).timeouts[cur]).toBe(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('piles');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = pointSaladModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 6 });
  });

  it('random games use every card and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 43 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const n0 = total(st(snap));
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const flip = s.rules[seat]!.length && rng.nextInt(4) === 0 ? { flip: s.rules[seat]![0] } : {};
        const action = h.type === 'rule' ? { type: 'rule', pile: h.pile, ...flip } : { type: 'veg', slots: (h.slots as number[]).slice(0, h.need as number), ...flip };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(n0);
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      expect(s.outcome!.placements[0]!.score).toBe(Math.max(...scores(s)));
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
