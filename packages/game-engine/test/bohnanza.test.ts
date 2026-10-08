import { describe, expect, it } from 'vitest';
import { BEANS, BEAN_INFO, beanModule, canHarvest, payout, type BeanState, type BeanView } from '@bg/game-bohnanza';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = beanModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as BeanState;
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
const edit = (snap: EngineSnapshot, f: (s: BeanState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const total = (s: BeanState) => s.deck.length + s.discard + s.coins.reduce((a, b) => a + b, 0) + s.hands.flat().length + s.faceUp.length + s.pending.flat().length + s.fields.flat().reduce((a, f) => a + f.n, 0);

describe('bohnanza rules', () => {
  it('150 cards of ten beans; five cards each; beanometer payouts', () => {
    expect(BEANS.reduce((n, b) => n + BEAN_INFO[b].count, 0)).toBe(150);
    const s = st(game(4));
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.deck).toHaveLength(130);
    expect([payout('coffee', 3), payout('coffee', 4), payout('coffee', 12), payout('garden', 2), payout('garden', 3), payout('red', 5)]).toEqual([0, 1, 4, 2, 3, 4]);
  });

  it('plant the first card (must), a second (may), then flip; fields hold one bean type', () => {
    let snap = edit(game(3, 2), (s) => { s.current = 0; s.hands[0] = ['red', 'soy', 'blue']; s.fields[0] = [{ bean: 'blue', n: 2 }, { bean: null, n: 0 }]; });
    expect(reject(snap, 0, { type: 'flip' })).toBe('MUST_PLANT');
    expect(reject(snap, 0, { type: 'plant', field: 0 })).toBe('FIELD_TAKEN');
    expect(reject(snap, 1, { type: 'plant', field: 1 })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'plant', field: 1 });
    expect(reject(snap, 0, { type: 'plant', field: 1 })).toBe('FIELD_TAKEN');
    expect(reject(snap, 0, { type: 'harvest', field: 1 })).toBe('CANNOT_HARVEST');
    snap = act(snap, 0, { type: 'harvest', field: 0 });
    snap = act(snap, 0, { type: 'plant', field: 0 });
    expect(reject(snap, 0, { type: 'plant', field: 0 })).toBe('NOTHING_TO_PLANT');
    snap = act(snap, 0, { type: 'flip' });
    expect(st(snap)).toMatchObject({ phase: 'trade' });
    expect(st(snap).faceUp).toHaveLength(2);
  });

  it('single-bean fields are protected; harvesting pays coins and discards the rest; third field costs 3', () => {
    const f = [{ bean: 'red' as const, n: 1 }, { bean: 'soy' as const, n: 4 }];
    expect([canHarvest(f, 0), canHarvest(f, 1)]).toEqual([false, true]);
    let snap = edit(game(3), (s) => { s.fields[1] = [{ bean: 'soy', n: 6 }, { bean: null, n: 0 }]; });
    expect(reject(snap, 1, { type: 'buyField' })).toBe('CANNOT_BUY');
    snap = act(snap, 1, { type: 'harvest', field: 0 });
    expect(st(snap).coins[1]).toBe(3);
    expect(st(snap).discard).toBe(3);
    snap = act(snap, 1, { type: 'buyField' });
    expect(st(snap).fields[1]).toHaveLength(3);
    expect(st(snap).coins[1]).toBe(0);
  });

  it('trades: offer, accept moves cards to the planting area; leftover face-up go to the active player', () => {
    let snap = edit(game(3, 3), (s) => { s.current = 0; s.hands[0] = ['red', 'wax']; s.hands[1] = ['coffee', 'green', 'soy']; s.deck.unshift('chili', 'stink'); });
    const before = total(st(snap));
    snap = act(snap, 0, { type: 'plant', field: 0 });
    snap = act(snap, 0, { type: 'flip' });
    expect(reject(snap, 0, { type: 'offer', to: 0, faceUp: [0], hand: [], want: [] })).toBe('BAD_TARGET');
    snap = act(snap, 0, { type: 'offer', to: 1, faceUp: [0], hand: [0], want: ['soy'] });
    expect(beanModule.pendingSeats(st(snap))).toEqual([1]);
    expect(reject(snap, 0, { type: 'endTrade' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 1, { type: 'accept' });
    const s = st(snap);
    expect(s.pending[1]).toEqual(['chili', 'wax']);
    expect(s.pending[0]).toEqual(['soy']);
    expect(s.hands[1]).toEqual(['coffee', 'green']);
    snap = act(snap, 0, { type: 'offer', to: 2, faceUp: [], hand: [], want: ['coffee', 'coffee', 'coffee', 'coffee', 'coffee', 'coffee'] });
    expect(reject(snap, 2, { type: 'accept' })).toBe('MISSING_CARDS');
    snap = act(snap, 2, { type: 'decline' });
    snap = act(snap, 0, { type: 'endTrade' });
    expect(st(snap).pending[0]).toEqual(['soy', 'stink']);
    expect(beanModule.pendingSeats(st(snap))).toEqual([0, 1]);
    expect(total(st(snap))).toBe(before);
  });

  it('hands and deck are hidden; counts are public', () => {
    const snap = game(3, 2);
    const v = projectFor(m, snap, p(1)).view as BeanView;
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('hands');
    expect(v.hand).toEqual(st(snap).hands[1]);
    expect(v.handCounts).toEqual([5, 5, 5]);
  });

  it('timeouts plant and move on; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('trade');
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('settle');
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe((c + 1) % 3);
    expect(total(st(t))).toBe(150);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = beanModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 2 });
  });

  it('random games run the deck out and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 41 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 5000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = beanModule.pendingSeats(s)[0]!;
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign' && h.type !== 'buyField');
        let action: unknown;
        const offer = legal.find((h) => h.type === 'offer');
        if (offer && s.faceUp.length && rng.nextInt(3) === 0) action = { type: 'offer', to: (seat + 1 + rng.nextInt(players - 1)) % players, faceUp: [0], hand: [], want: rng.nextInt(2) ? [BEANS[rng.nextInt(10)]] : [] };
        else {
          const pick = legal.filter((h) => h.type !== 'offer' && h.type !== 'harvest');
          const h = pick.length ? pick[rng.nextInt(pick.length)]! : legal.find((x) => x.type === 'harvest')!;
          const { type, ...rest } = h;
          action = { type, ...rest };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(150);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
