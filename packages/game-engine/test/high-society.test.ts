import { describe, expect, it } from 'vitest';
import { highSocietyModule, status, MONEY, type HighSocietyState, type HighSocietyView, type StatusCard } from '@bg/game-high-society';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = highSocietyModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as HighSocietyState;
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
/** 3 players, seat 0 to start, the given card up and the given cards next. */
function rig(card: StatusCard, next: StatusCard[] = ['l1', 'l2', 'l3']) {
  const snap = game(3);
  Object.assign(st(snap), { card, deck: next, current: 0, red: 0 });
  return snap;
}

describe('high society rules', () => {
  it('status: luxury sum, passé −5, prestige doubles, scandal halves', () => {
    expect(status(['l4', 'l7', 'passe', 'prestige'])).toBe(12);
    expect(status(['l10', 'scandal'])).toBe(5);
  });

  it('normal auction: raise with money cards, passing takes the bid back, the last bidder pays and starts next', () => {
    let snap = rig('l8');
    expect(reject(snap, 1, { type: 'pass' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'bid', cards: [3] });
    expect(reject(snap, 1, { type: 'bid', cards: [2] })).toBe('BID_TOO_LOW');
    expect(reject(snap, 1, { type: 'bid', cards: [5] })).toBe('NOT_IN_HAND');
    snap = act(snap, 1, { type: 'bid', cards: [4] });
    snap = act(snap, 2, { type: 'pass' });
    snap = act(snap, 0, { type: 'bid', cards: [2] }); // 3 + 2 = 5
    snap = act(snap, 1, { type: 'pass' });
    const s = st(snap);
    expect(s.won[0]).toEqual(['l8']);
    expect(s.spent[0]).toEqual([2, 3]);
    expect(s.hands[1]).toEqual(MONEY);
    expect(s.current).toBe(0);
    expect(s.card).toBe('l1');
  });

  it('disgrace: the first to pass takes it and keeps their money; the others pay', () => {
    let snap = rig('passe');
    snap = act(snap, 0, { type: 'bid', cards: [1] });
    snap = act(snap, 1, { type: 'bid', cards: [2] });
    snap = act(snap, 2, { type: 'pass' });
    const s = st(snap);
    expect(s.won[2]).toEqual(['passe']);
    expect(s.spent).toEqual([[1], [2], []]);
    expect(s.current).toBe(2);
  });

  it('faux pas discards the lowest luxury, or the next one won', () => {
    let snap = rig('faux');
    st(snap).won[0] = ['l2', 'l9'];
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).won[0]).toEqual(['l9', 'faux']);
    let t = rig('faux');
    t = act(t, 0, { type: 'pass' });
    expect(st(t).faux[0]).toBe(true);
    st(t).card = 'l5';
    t = act(act(t, 0, { type: 'bid', cards: [1] }), 1, { type: 'pass' });
    t = act(t, 2, { type: 'pass' });
    expect(st(t).won[0]).toEqual(['faux']);
    expect(st(t).last).toMatchObject({ seat: 0, card: 'l5', lost: 'l5' });
  });

  it('the fourth red card ends the game; the poorest player is out', () => {
    let snap = rig('l10', ['prestige']);
    st(snap).red = 3;
    st(snap).won = [[], ['l1'], ['l2']];
    snap = act(snap, 0, { type: 'bid', cards: [25, 20, 15] });
    snap = act(act(snap, 1, { type: 'pass' }), 2, { type: 'pass' });
    const o = st(snap).outcome!;
    expect(o.placements.map((x) => x.seat)).toEqual([2, 1, 0]); // seat 0 has the best status but the least money
  });

  it('hands stay private; bids are public; timeouts pass; resign ends with the resigner last', () => {
    let snap = rig('l8');
    snap = act(snap, 0, { type: 'bid', cards: [6] });
    const v = projectFor(m, snap, p(1)).view as HighSocietyView;
    expect(v.hand).toEqual(MONEY);
    expect(v.bids[0]).toEqual([6]);
    expect(v).not.toHaveProperty('hands');
    expect(v.money).toBeNull();
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).passed[1]).toBe(true);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = highSocietyModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games conserve money and status cards and replay deterministically', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 5 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s0 = st(snap);
        const seat = s0.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        let action: unknown = { type: 'pass' };
        if (h.type === 'bid') {
          const cards: number[] = [];
          for (const c of s0.hands[seat]!.slice().reverse()) { if (cards.reduce((a, b) => a + b, 0) >= (h.need as number)) break; if (rng.nextInt(2) || c >= (h.need as number)) cards.push(c); }
          if (cards.reduce((a, b) => a + b, 0) >= (h.need as number)) action = { type: 'bid', cards };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = st(snap);
        s.hands.forEach((hand, k) => expect([...hand, ...s.bids[k]!, ...s.spent[k]!].sort((a, b) => a - b)).toEqual(MONEY));
        const lost = s.won.flat().length + s.deck.length + (s.card ? 1 : 0);
        expect(lost).toBeLessThanOrEqual(16);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(st(snap).red).toBe(4);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
