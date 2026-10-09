import { describe, expect, it } from 'vitest';
import { coupModule, legalFor, type CoupState, type CoupView, type Role } from '@bg/game-coup';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = coupModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CoupState;
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
/** A fixed 3-player table: seat 0 to act, hands as given. */
function rig(hands: [Role, Role][], coins = [2, 2, 2]) {
  const snap = game(hands.length);
  const s = st(snap);
  s.current = 0;
  s.cards = hands.map((h) => h.map((role) => ({ role, revealed: false })));
  s.coins = coins.slice(0, hands.length);
  s.deck = (['duke', 'assassin', 'captain', 'ambassador', 'contessa'] as Role[]).flatMap((r) => [r, r, r]);
  for (const r of hands.flat()) s.deck.splice(s.deck.indexOf(r), 1);
  return snap;
}
const passAll = (snap: EngineSnapshot) => { while (st(snap).phase === 'respond') snap = act(snap, st(snap).pending!.responders[0]!, { type: 'pass' }); return snap; };
const roleCount = (s: CoupState) => {
  const all = [...s.deck, ...s.cards.flat().map((c) => c.role), ...(s.exchange ? s.exchange.options.slice(s.exchange.keep) : [])];
  return all.reduce<Record<string, number>>((a, r) => ({ ...a, [r]: (a[r] ?? 0) + 1 }), {});
};

describe('coup rules', () => {
  it('setup: two cards and two coins each; 2-player first player starts with one coin', () => {
    const s = st(game(4));
    expect(s.cards.every((c) => c.length === 2)).toBe(true);
    expect(s.deck).toHaveLength(7);
    expect(s.coins).toEqual([2, 2, 2, 2]);
    const two = st(game(2));
    expect(two.coins[two.current]).toBe(1);
  });

  it('income is immediate; foreign aid can be blocked by a claimed Duke; tax resolves when nobody challenges', () => {
    let snap = rig([['contessa', 'contessa'], ['captain', 'captain'], ['assassin', 'assassin']]);
    snap = act(snap, 0, { type: 'act', act: 'income' });
    expect(st(snap).coins[0]).toBe(3);
    expect(st(snap).current).toBe(1);
    snap = act(snap, 1, { type: 'act', act: 'foreignAid' });
    expect(reject(snap, 0, { type: 'challenge' })).toBe('ILLEGAL_ACTION'); // no claim to challenge
    snap = act(snap, 2, { type: 'block', role: 'duke' });
    snap = passAll(snap);
    expect(st(snap).coins[1]).toBe(2);
    expect(st(snap).current).toBe(2);
    snap = act(snap, 2, { type: 'act', act: 'tax' });
    snap = passAll(snap);
    expect(st(snap).coins[2]).toBe(5);
  });

  it('a true claim costs the challenger an influence and the claimer redraws; a false one costs the claimer', () => {
    let snap = rig([['duke', 'contessa'], ['captain', 'captain'], ['assassin', 'ambassador']]);
    snap = act(snap, 0, { type: 'act', act: 'tax' });
    snap = act(snap, 1, { type: 'challenge' });
    expect(st(snap).phase).toBe('lose'); // challenger chooses which card
    snap = act(snap, 1, { type: 'lose', card: 0 });
    expect(st(snap).cards[1]![0]!.revealed).toBe(true);
    expect(st(snap).coins[0]).toBe(5);
    expect(roleCount(st(snap))).toEqual({ duke: 3, assassin: 3, captain: 3, ambassador: 3, contessa: 3 });
    // Seat 1 (one card left) bluffs a Duke and is caught: eliminated.
    snap = act(snap, 1, { type: 'act', act: 'tax' });
    snap = act(snap, 2, { type: 'challenge' });
    expect(st(snap).cards[1]!.every((c) => c.revealed)).toBe(true);
    expect(st(snap).coins[1]).toBe(2);
    expect(st(snap).current).toBe(2);
  });

  it('assassination: Contessa blocks, a failed Assassin claim refunds, and coup is forced at ten coins', () => {
    let snap = rig([['assassin', 'duke'], ['contessa', 'captain'], ['duke', 'duke']], [3, 2, 10]);
    snap = act(snap, 0, { type: 'act', act: 'assassinate', target: 1 });
    expect(st(snap).coins[0]).toBe(0);
    snap = act(snap, 1, { type: 'block', role: 'contessa' });
    snap = passAll(snap);
    expect(st(snap).cards[1]!.some((c) => c.revealed)).toBe(false);
    snap = act(snap, 1, { type: 'act', act: 'income' });
    expect(reject(snap, 2, { type: 'act', act: 'income' })).toBe('MUST_COUP');
    snap = act(snap, 2, { type: 'act', act: 'coup', target: 0 });
    snap = act(snap, 0, { type: 'lose', card: 1 });
    expect(st(snap).coins[2]).toBe(3);
    let b = rig([['duke', 'duke'], ['contessa', 'captain'], ['duke', 'duke']], [3, 2, 2]);
    b = act(b, 0, { type: 'act', act: 'assassinate', target: 1 });
    b = act(b, 1, { type: 'challenge' });
    b = act(b, 0, { type: 'lose', card: 0 });
    expect(st(b).coins[0]).toBe(3);
    expect(st(b).cards[1]!.some((c) => c.revealed)).toBe(false);
  });

  it('steal takes up to two coins; the target may still block after a lost challenge', () => {
    let snap = rig([['captain', 'duke'], ['contessa', 'ambassador'], ['duke', 'duke']], [2, 1, 2]);
    snap = act(snap, 0, { type: 'act', act: 'steal', target: 1 });
    snap = act(snap, 2, { type: 'challenge' });
    snap = act(snap, 2, { type: 'lose', card: 0 });
    expect(st(snap).pending?.stage).toBe('blockOnly');
    expect(st(snap).pending?.responders).toEqual([1]);
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).coins).toEqual([3, 0, 2]);
  });

  it('exchange: the Ambassador sees two extra cards privately and keeps as many as before', () => {
    let snap = rig([['ambassador', 'duke'], ['contessa', 'captain'], ['duke', 'duke']]);
    snap = act(snap, 0, { type: 'act', act: 'exchange' });
    snap = passAll(snap);
    const ex = st(snap).exchange!;
    expect(ex.options).toHaveLength(4);
    expect((projectFor(m, snap, p(1)).view as CoupView).exchange?.options).toEqual([]);
    expect(reject(snap, 0, { type: 'keep', roles: [ex.options[2]] })).toBe('ILLEGAL_ACTION');
    snap = act(snap, 0, { type: 'keep', roles: [ex.options[2], ex.options[3]] });
    expect(st(snap).cards[0]!.map((c) => c.role)).toEqual([ex.options[2], ex.options[3]]);
    expect(roleCount(st(snap))).toEqual({ duke: 3, assassin: 3, captain: 3, ambassador: 3, contessa: 3 });
  });

  it('hides other players’ face-down cards and the deck', () => {
    const snap = rig([['ambassador', 'duke'], ['contessa', 'captain'], ['duke', 'duke']]);
    const v = projectFor(m, snap, p(1)).view as CoupView;
    expect(v.myCards?.map((c) => c.role)).toEqual(['contessa', 'captain']);
    expect(v.cards[0]).toEqual({ revealed: [], hidden: 2 });
    expect(JSON.stringify(v)).not.toContain('ambassador');
    expect(v).not.toHaveProperty('deck');
  });

  it('timeouts play passively and resign eliminates', () => {
    let t = rig([['captain', 'duke'], ['contessa', 'ambassador'], ['duke', 'duke']]);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).coins[0]).toBe(3);
    t = act(t, 1, { type: 'act', act: 'tax' });
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).coins[1]).toBe(5);
    const r = act(game(2), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = coupModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) {
        expect(st(snap).outcome).toBeNull();
        snap = act(snap, 1, step.reply);
      }
      // The learner always acts next (the platform plays only one scripted reply per step).
      if (!st(snap).outcome) expect(legalFor(st(snap), 0).length).toBeGreaterThan(0);
    }
    const s = st(snap);
    expect(s.outcome).toEqual({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }], reason: 'win' });
    expect(s.cards[1]!.map((c) => [c.role, c.revealed])).toEqual([['captain', true], ['assassin', true]]);
    expect(s.coins).toEqual([4, 0]);
    expect(roleCount(s)).toEqual({ duke: 3, assassin: 3, captain: 3, ambassador: 3, contessa: 3 });
  });

  it('random games keep the court deck intact and replay deterministically', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 9 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 5000 && !st(snap).outcome; n++) {
        const waiting = coupModule.pendingSeats(st(snap));
        const seat = waiting[rng.nextInt(waiting.length)]!;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const { targets, options, keep, ...base } = h as Record<string, unknown>;
        const action = targets ? { ...base, target: (targets as number[])[rng.nextInt((targets as number[]).length)] }
          : options ? { type: 'keep', roles: (options as Role[]).slice().sort(() => 0).slice(0, keep as number) } : base;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = st(snap);
        expect(roleCount(s)).toEqual({ duke: 3, assassin: 3, captain: 3, ambassador: 3, contessa: 3 });
        expect(s.coins.every((c) => c >= 0)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
