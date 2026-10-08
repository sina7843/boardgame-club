import { describe, expect, it } from 'vitest';
import { CARDS, KINGDOM, domModule, vpOf, type CardId, type DomState, type DomView } from '@bg/game-dominion';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = domModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as DomState;
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
const edit = (snap: EngineSnapshot, f: (s: DomState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const total = (s: DomState) => s.players.reduce((n, q) => n + q.deck.length + q.hand.length + q.discard.length, 0) + s.inPlay.length + s.trash.length + Object.values(s.supply).reduce((a, b) => a + b, 0);
const withHand = (snap: EngineSnapshot, hand: CardId[], deck: CardId[] = ['copper', 'copper', 'copper', 'estate', 'silver']) =>
  edit(snap, (s) => { s.current = 0; s.players[0] = { hand, deck, discard: [] }; });

describe('dominion rules', () => {
  it('setup: 7 copper + 3 estate, five in hand; supply sizes by player count', () => {
    const s = st(game(3));
    expect(s.players.every((q) => q.hand.length === 5 && q.deck.length === 5)).toBe(true);
    expect(s.supply).toMatchObject({ copper: 39, province: 12, smithy: 10 });
    expect(st(game(2)).supply.province).toBe(8);
    expect(KINGDOM).toHaveLength(10);
  });

  it('actions, treasures, buy and cleanup', () => {
    let snap = withHand(game(), ['village', 'smithy', 'copper', 'copper', 'estate']);
    expect(reject(snap, 1, { type: 'endTurn' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap)).toMatchObject({ actions: 2 });
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).players[0]!.hand).toHaveLength(7);
    snap = act(snap, 0, { type: 'treasures' });
    expect(st(snap).coins).toBe(5);
    expect(reject(snap, 0, { type: 'play', index: 0 })).toBe('NO_ACTIONS');
    expect(reject(snap, 0, { type: 'buy', card: 'province' })).toBe('CANNOT_AFFORD');
    snap = act(snap, 0, { type: 'buy', card: 'market' });
    expect(reject(snap, 0, { type: 'buy', card: 'copper' })).toBe('NO_BUYS');
    const before = total(st(snap));
    snap = act(snap, 0, { type: 'endTurn' });
    const s = st(snap);
    expect(s.players[0]!.hand).toHaveLength(5);
    expect(s).toMatchObject({ current: 1, coins: 0, actions: 1, buys: 1, phase: 'action' });
    expect(total(s)).toBe(before);
  });

  it('cellar, workshop, remodel, mine, merchant, market', () => {
    let snap = withHand(game(), ['cellar', 'estate', 'estate', 'copper', 'merchant']);
    snap = act(snap, 0, { type: 'play', index: 0, discard: [1, 2] });
    expect(st(snap).players[0]!.hand).toHaveLength(4);
    snap = act(snap, 0, { type: 'play', index: 1 });
    snap = act(snap, 0, { type: 'treasures' });
    expect(st(snap).coins).toBe(4);
    snap = withHand(game(), ['remodel', 'estate', 'copper', 'copper', 'copper']);
    expect(reject(snap, 0, { type: 'play', index: 0, trash: 1, gain: 'duchy' })).toBe('BAD_GAIN');
    snap = act(snap, 0, { type: 'play', index: 0, trash: 1, gain: 'smithy' });
    expect(st(snap).trash).toEqual(['estate']);
    expect(st(snap).players[0]!.discard).toEqual(['smithy']);
    snap = withHand(game(), ['mine', 'copper', 'estate', 'copper', 'copper']);
    expect(reject(snap, 0, { type: 'play', index: 0, trash: 2, gain: 'silver' })).toBe('BAD_TRASH');
    snap = act(snap, 0, { type: 'play', index: 0, trash: 1, gain: 'silver' });
    expect(st(snap).players[0]!.hand).toContain('silver');
    snap = withHand(game(), ['workshop', 'market', 'copper', 'copper', 'copper']);
    expect(reject(snap, 0, { type: 'play', index: 0, gain: 'duchy' })).toBe('BAD_GAIN');
    snap = act(snap, 0, { type: 'play', index: 1 });
    expect(st(snap)).toMatchObject({ buys: 2, coins: 1, actions: 1 });
    snap = act(snap, 0, { type: 'play', index: 0, gain: 'smithy' });
    expect(st(snap).players[0]!.discard).toEqual(['smithy']);
  });

  it('militia: others discard to three in parallel; moat blocks', () => {
    let snap = edit(game(3, 2), (s) => {
      s.current = 0;
      s.players[0]!.hand = ['militia', 'copper', 'copper', 'copper', 'copper'];
      s.players[2]!.hand = ['moat', 'copper', 'copper', 'estate', 'estate'];
    });
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(domModule.pendingSeats(st(snap))).toEqual([1]);
    expect(reject(snap, 0, { type: 'treasures' })).toBe('WAITING_FOR_DISCARDS');
    expect(reject(snap, 1, { type: 'militiaDiscard', discard: [0] })).toBe('BAD_DISCARD');
    snap = act(snap, 1, { type: 'militiaDiscard', discard: [0, 1] });
    expect(st(snap).players[1]!.hand).toHaveLength(3);
    snap = act(snap, 0, { type: 'treasures' });
    expect(st(snap).coins).toBe(6);
  });

  it('hands and decks are hidden; the top of each discard pile is public', () => {
    const snap = game(3, 2);
    const v = projectFor(m, snap, p(1)).view as DomView;
    expect(v).not.toHaveProperty('players');
    expect(v.hand).toEqual(st(snap).players[1]!.hand);
    expect(v.others.map((o) => o.hand)).toEqual([5, 5, 5]);
    expect(v.vp).toBeNull();
  });

  it('timeouts end the turn; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe((c + 1) % 3);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = domModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1, score: 9 });
  });

  it('random big-money games end and replay deterministically', () => {
    for (let g = 0; g < 10; g++) {
      const rng = createRng({ s: 5 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const start = total(st(snap));
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = domModule.pendingSeats(s)[0]!;
        const legal = projectFor(m, snap, p(seat)).legalActions;
        let action: unknown;
        const md = legal.find((h) => h.type === 'militiaDiscard');
        const plays = legal.filter((h) => h.type === 'play' && ['village', 'smithy', 'market', 'militia', 'moat', 'merchant'].includes(h.card as string));
        if (md) action = { type: 'militiaDiscard', discard: Array.from({ length: md.count as number }, (_, i) => i) };
        else if (plays.length) action = { type: 'play', index: plays[0]!.index };
        else if (legal.some((h) => h.type === 'treasures')) action = { type: 'treasures' };
        else {
          const buys = legal.filter((h) => h.type === 'buy').map((h) => h.card as CardId).sort((a, b) => CARDS[b].cost - CARDS[a].cost);
          const want = buys.find((c) => c !== 'copper' && c !== 'estate' && (c !== 'duchy' || s.supply.province < 4) && (rng.nextInt(3) || CARDS[c].kind !== 'action'));
          action = want && s.buys ? { type: 'buy', card: want } : { type: 'endTurn' };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(start);
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      expect(s.outcome!.placements[0]!.score).toBe(Math.max(...s.players.map((q) => vpOf([...q.deck, ...q.hand, ...q.discard]))));
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
