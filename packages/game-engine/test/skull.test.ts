import { describe, expect, it } from 'vitest';
import { skullModule, type SkullState, type SkullView } from '@bg/game-skull';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = skullModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SkullState;
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
/** Everyone places their first disc (`discs[seat]`), starting from the current player. */
function firstRound(snap: EngineSnapshot, discs: string[]) {
  while (st(snap).phase === 'first') snap = act(snap, st(snap).current, { type: 'place', disc: discs[st(snap).current] });
  return snap;
}

describe('skull rules', () => {
  it('everyone places one disc first; then place or bid; no bidding before everyone has placed', () => {
    let snap = game(3);
    const first = st(snap).current;
    expect(reject(snap, first, { type: 'bid', n: 1 })).toBe('WRONG_PHASE');
    snap = firstRound(snap, ['rose', 'rose', 'rose']);
    expect(st(snap).phase).toBe('place');
    expect(st(snap).current).toBe(first);
    expect(reject(snap, first, { type: 'bid', n: 4 })).toBe('BAD_BID');
  });

  it('bidding: raise or pass; the challenger turns their own discs first, then chooses others', () => {
    let snap = firstRound(game(3), ['rose', 'rose', 'rose']);
    const c = st(snap).current;
    snap = act(snap, c, { type: 'bid', n: 2 });
    const n1 = st(snap).current;
    expect(reject(snap, n1, { type: 'bid', n: 2 })).toBe('BAD_BID');
    snap = act(snap, n1, { type: 'pass' });
    snap = act(snap, st(snap).current, { type: 'pass' });
    expect(st(snap).phase).toBe('reveal');
    expect(st(snap).turned).toEqual([{ seat: c, disc: 'rose' }]);
    expect(reject(snap, c, { type: 'flip', seat: c })).toBe('OWN_DISCS_FIRST');
    snap = act(snap, c, { type: 'flip', seat: (c + 1) % 3 });
    expect(st(snap).points[c]).toBe(1);
    expect(st(snap).phase).toBe('first');
  });

  it('hitting a skull loses a disc at random; only the loser learns its type; two points win', () => {
    let snap = game(3, 4);
    const c = st(snap).current;
    const victim = (c + 1) % 3;
    snap = firstRound(snap, [0, 1, 2].map((k) => (k === victim ? 'skull' : 'rose')));
    snap = act(snap, c, { type: 'bid', n: 2 });
    snap = act(snap, st(snap).current, { type: 'pass' });
    snap = act(snap, st(snap).current, { type: 'pass' });
    snap = act(snap, c, { type: 'flip', seat: victim });
    expect(st(snap).owned[c]).toBe(3);
    expect(st(snap).current).toBe(victim); // the skull's owner starts
    const mine = projectFor(m, snap, p(c)).view as SkullView;
    const theirs = projectFor(m, snap, p(victim)).view as SkullView;
    expect(mine.lostLast).not.toBeNull();
    expect(theirs.lostLast).toBeNull();
    expect(theirs.hand).toHaveLength(4);
    expect(theirs).not.toHaveProperty('hands');
  });

  it('a player with no discs is out; the last one standing wins; timeouts and resign', () => {
    let snap = game(2);
    st(snap).owned = [1, 4];
    st(snap).hands = [['skull'], ['rose', 'rose', 'rose', 'skull']];
    snap = firstRound(snap, ['skull', 'rose']);
    const c = st(snap).current;
    snap = act(snap, c, { type: 'bid', n: 1 });
    if (c === 0) { expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 }); }
    let t = game(3);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).stacks.flat()).toEqual(['rose']);
    const r = act(game(2), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = skullModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 2 }, { seat: 1, place: 2, score: 1 }]);
    expect(st(snap).owned).toEqual([4, 3]);
  });

  it('random games conserve discs and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 4 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'bid' ? { type: 'bid', n: (h.min as number) + rng.nextInt((h.max as number) - (h.min as number) + 1) } : h.type === 'place' ? { type: 'place', disc: h.disc } : h.type === 'flip' ? { type: 'flip', seat: h.seat } : { type: h.type };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const a = st(snap);
        a.owned.forEach((o, k) => expect(a.hands[k]!.length + a.stacks[k]!.length).toBe(o));
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
