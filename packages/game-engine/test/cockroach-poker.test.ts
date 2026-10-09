import { describe, expect, it } from 'vitest';
import { cockroachModule, type CockroachState, type CockroachView } from '@bg/game-cockroach-poker';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = cockroachModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CockroachState;
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
const total = (s: CockroachState) => s.hands.flat().length + s.table.flat().length + (s.chain ? 1 : 0);

describe('cockroach poker rules', () => {
  it('deals all 64 cards', () => {
    const s = st(game(3));
    expect(total(s)).toBe(64);
    expect(s.hands.map((h) => h.length).sort()).toEqual([21, 21, 22]);
  });

  it('a right call gives the card to the giver; a wrong one to the receiver, who starts next', () => {
    let snap = game(3, 2);
    const s = st(snap);
    s.current = 0;
    s.hands[0] = ['rat', 'bat'];
    snap = act(snap, 0, { type: 'give', card: 'rat', to: 1, claim: 'fly' });
    expect(reject(snap, 2, { type: 'call', truth: true })).toBe('NOT_YOUR_TURN');
    expect((projectFor(m, snap, p(1)).view as CockroachView).chain?.card).toBeNull();
    expect((projectFor(m, snap, p(0)).view as CockroachView).chain?.card).toBe('rat');
    snap = act(snap, 1, { type: 'call', truth: false }); // right: it was a lie
    expect(st(snap).table[0]).toEqual(['rat']);
    expect(st(snap).current).toBe(0);
    snap = act(snap, 0, { type: 'give', card: 'bat', to: 2, claim: 'bat' });
    snap = act(snap, 2, { type: 'call', truth: false }); // wrong
    expect(st(snap).table[2]).toEqual(['bat']);
    expect(st(snap).current).toBe(2);
  });

  it('passing: look, new claim, only to someone who has not seen it; with two players you must call', () => {
    let snap = game(3, 3);
    const s = st(snap);
    s.current = 0;
    const card = s.hands[0]![0]!;
    snap = act(snap, 0, { type: 'give', card, to: 1, claim: card });
    expect(reject(snap, 1, { type: 'pass', to: 0, claim: card })).toBe('BAD_TARGET');
    snap = act(snap, 1, { type: 'peek' });
    expect(reject(snap, 1, { type: 'call', truth: true })).toBe('MUST_PASS');
    snap = act(snap, 1, { type: 'pass', to: 2, claim: 'toad' });
    expect((projectFor(m, snap, p(1)).view as CockroachView).chain?.card).toBe(card);
    expect(projectFor(m, snap, p(2)).legalActions.some((h) => h.type === 'pass')).toBe(false);
    let two = game(2);
    const c2 = st(two).current;
    two = act(two, c2, { type: 'give', card: st(two).hands[c2]![0], to: 1 - c2, claim: 'bat' });
    expect(projectFor(m, two, p(1 - c2)).legalActions.some((h) => h.type === 'pass')).toBe(false);
  });

  it('four of a kind loses; everyone else shares the win; timeouts and resign', () => {
    let snap = game(3, 4);
    const s = st(snap);
    s.current = 0;
    s.hands[0] = ['spider', 'fly'];
    s.table[1] = ['spider', 'spider', 'spider'];
    snap = act(snap, 0, { type: 'give', card: 'spider', to: 1, claim: 'spider' });
    snap = act(snap, 1, { type: 'call', truth: false });
    expect(st(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }, { seat: 2, place: 1 }] });
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).chain?.from).toBe(c);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).chain).toBeNull();
    const r = act(game(3), 2, { type: 'resign' });
    expect(st(r).outcome?.placements.find((x) => x.seat === 2)?.place).toBe(2);
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = cockroachModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1 }, { seat: 1, place: 2 }]);
    expect(s.table).toEqual([['scorpion', 'rat'], ['fly', 'fly', 'fly', 'stinkbug', 'stinkbug', 'stinkbug', 'toad', 'stinkbug']]);
    expect(s.hands).toEqual([['fly', 'fly', 'fly', 'fly', 'fly'], ['cockroach', 'bat', 'toad', 'spider']]);
  });

  it('random games keep all 64 cards and replay deterministically', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 47 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = cockroachModule.pendingSeats(s)[0]!;
        const claim = ['cockroach', 'bat', 'fly', 'toad', 'rat', 'scorpion', 'spider', 'stinkbug'][rng.nextInt(8)];
        const hints = projectFor(m, snap, p(seat)).legalActions;
        let action: unknown;
        const give = hints.find((h) => h.type === 'give');
        const pass = hints.find((h) => h.type === 'pass');
        if (give) action = { type: 'give', card: s.hands[seat]![rng.nextInt(s.hands[seat]!.length)], to: (give.targets as number[])[rng.nextInt((give.targets as number[]).length)], claim };
        else if (pass && (s.chain!.peeked || rng.nextInt(3) === 0)) action = { type: 'pass', to: (pass.targets as number[])[0], claim };
        else if (hints.some((h) => h.type === 'peek') && rng.nextInt(4) === 0) action = { type: 'peek' };
        else action = { type: 'call', truth: !!rng.nextInt(2) };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(64);
      }
      expect(st(snap).outcome?.placements.filter((x) => x.place === 2)).toHaveLength(1);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
