import { describe, expect, it } from 'vitest';
import { forSaleModule, type ForSaleState, type ForSaleView } from '@bg/game-for-sale';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = forSaleModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as ForSaleState;
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

describe('for sale rules', () => {
  it('setup: decks by player count, coins, one property per player on the table', () => {
    const s3 = st(game(3));
    expect(s3.props.length + s3.market.length).toBe(24);
    expect(s3.cheques).toHaveLength(24);
    expect(s3.coins).toEqual([18, 18, 18]);
    expect(s3.market).toHaveLength(3);
    const s5 = st(game(5));
    expect(s5.coins[0]).toBe(14);
    expect(s5.props.length + s5.market.length).toBe(30);
  });

  it('bidding: raise above the high bid; passing takes the cheapest card and refunds half; the last pays in full', () => {
    let snap = game(3);
    const s = st(snap);
    s.current = 0; s.market = [4, 17, 25];
    expect(reject(snap, 1, { type: 'pass' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'bid', amount: 3 });
    expect(reject(snap, 1, { type: 'bid', amount: 3 })).toBe('BAD_BID');
    expect(reject(snap, 1, { type: 'bid', amount: 19 })).toBe('INVALID_ACTION');
    snap = act(snap, 1, { type: 'bid', amount: 5 });
    snap = act(snap, 2, { type: 'pass' }); // bid 0: takes 4 free
    expect(st(snap).owned[2]).toEqual([4]);
    expect(st(snap).current).toBe(0);
    snap = act(snap, 0, { type: 'pass' }); // bid 3: pays 2, takes 17; seat 1 pays 5 for 25
    expect(st(snap).coins).toEqual([16, 13, 18]);
    expect(st(snap).owned).toEqual([[17], [25], [4]]);
    expect(st(snap).current).toBe(1);
    expect(st(snap).market).toHaveLength(3);
    expect(st(snap).bids).toEqual([0, 0, 0]);
  });

  it('selling: hidden simultaneous picks; highest property takes the highest cheque; score and tie-break', () => {
    let snap = game(2);
    const s = st(snap);
    Object.assign(s, { phase: 'sell', props: [], cheques: [], market: [0, 9], owned: [[3], [20]], coins: [5, 14], chosen: [null, null] });
    snap = act(snap, 0, { type: 'sell', card: 3 });
    const v = projectFor(m, snap, p(1)).view as ForSaleView;
    expect(v.chosen).toEqual([true, false]);
    expect(v.owned[0]).toEqual([]);
    expect(reject(snap, 0, { type: 'sell', card: 3 })).toBe('ALREADY_CHOSEN');
    snap = act(snap, 1, { type: 'sell', card: 20 });
    expect(st(snap).won).toEqual([[0], [9]]);
    expect(st(snap).outcome?.placements).toEqual([{ seat: 1, place: 1, score: 23 }, { seat: 0, place: 2, score: 5 }]);
    let t = game(2);
    Object.assign(st(t), { phase: 'sell', props: [], cheques: [], market: [5, 5], owned: [[1], [2]], coins: [3, 3], chosen: [null, null] });
    t = act(act(t, 0, { type: 'sell', card: 1 }), 1, { type: 'sell', card: 2 });
    expect(st(t).outcome?.placements.map((x) => x.place)).toEqual([1, 1]);
  });

  it('timeouts pass or sell the cheapest; resign ends with the resigner last', () => {
    let t = game(3);
    const cur = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).passed[cur]).toBe(true);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = forSaleModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 32 }, { seat: 1, place: 2, score: 23 }]);
    expect(st(snap).coins).toEqual([14, 13]);
    expect(st(snap).won).toEqual([[15, 3], [0, 10]]);
  });

  it('random games conserve cards and coins and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 3 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const props = st(snap).props.length + st(snap).market.length;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const waiting = forSaleModule.pendingSeats(st(snap));
        const seat = waiting[rng.nextInt(waiting.length)]!;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'bid' ? { type: 'bid', amount: (h.min as number) + rng.nextInt(Math.min(3, (h.max as number) - (h.min as number) + 1)) } : h.type === 'sell' ? { type: 'sell', card: h.card } : { type: h.type };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = st(snap);
        if (s.phase === 'buy') expect(s.props.length + s.market.length + s.owned.flat().length).toBe(props);
        expect(s.coins.every((c) => c >= 0)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(st(snap).owned.flat()).toEqual([]);
      expect(st(snap).won.flat()).toHaveLength(props);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
