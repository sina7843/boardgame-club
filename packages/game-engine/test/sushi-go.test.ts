import { describe, expect, it } from 'vitest';
import { puddingScores, roundScores, setScore, sushiGoModule, type Kind, type SushiGoState, type SushiGoView } from '@bg/game-sushi-go';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = sushiGoModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SushiGoState;
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
const t = (...ks: Kind[]) => ks.map((kind) => ({ kind }));

describe('sushi go rules', () => {
  it('scores sets: tempura pairs, sashimi triples, dumplings, nigiri on wasabi', () => {
    expect(setScore(t('tempura', 'tempura', 'tempura'))).toBe(5);
    expect(setScore(t('sashimi', 'sashimi', 'sashimi', 'sashimi'))).toBe(10);
    expect(setScore(t('dumpling', 'dumpling', 'dumpling', 'dumpling', 'dumpling', 'dumpling'))).toBe(15);
    expect(setScore([{ kind: 'squid', wasabi: true }, { kind: 'egg' }])).toBe(10);
  });

  it('maki: most 6, second 3; a tie for most splits 6 and gives no second; puddings ±6', () => {
    expect(roundScores([t('maki3'), t('maki2'), t('maki1')])).toEqual([6, 3, 0]);
    expect(roundScores([t('maki3'), t('maki3'), t('maki1')])).toEqual([3, 3, 0]);
    expect(roundScores([t('maki2'), t('maki1', 'maki1'), t()])).toEqual([3, 3, 0]);
    expect(roundScores([t('maki3'), t('maki1'), t('maki1')])).toEqual([6, 1, 1]);
    expect(puddingScores([3, 1, 1])).toEqual([6, -3, -3]);
    expect(puddingScores([2, 0])).toEqual([6, 0]);
    expect(puddingScores([1, 1, 1])).toEqual([0, 0, 0]);
  });

  it('picks are hidden until everyone has picked; then hands pass to the next seat', () => {
    let snap = game(3);
    const hands = st(snap).hands.map((h) => h.slice());
    snap = act(snap, 0, { type: 'pick', card: hands[0]![0] });
    expect(reject(snap, 0, { type: 'pick', card: hands[0]![1] })).toBe('ALREADY_PICKED');
    const v = projectFor(m, snap, p(1)).view as SushiGoView;
    expect(v.picked).toEqual([true, false, false]);
    expect(v.table[0]).toEqual([]);
    expect(v).not.toHaveProperty('hands');
    snap = act(snap, 1, { type: 'pick', card: hands[1]![0] });
    snap = act(snap, 2, { type: 'pick', card: hands[2]![0] });
    const s = st(snap);
    expect(s.table.map((x) => x[0]!.kind)).toEqual([hands[0]![0], hands[1]![0], hands[2]![0]]);
    expect(s.hands[1]).toEqual(hands[0]!.slice(1));
    expect(s.hands[0]).toEqual(hands[2]!.slice(1));
  });

  it('chopsticks take two cards and go back into the passed hand; wasabi triples the next nigiri', () => {
    let snap = game(2);
    const s = st(snap);
    s.hands = [['salmon', 'egg', 'tempura'], ['egg', 'egg', 'egg']];
    s.table = [[{ kind: 'chopsticks' }, { kind: 'wasabi' }], []];
    expect(reject(snap, 1, { type: 'pick', card: 'egg', extra: 'egg' })).toBe('NO_CHOPSTICKS');
    snap = act(snap, 0, { type: 'pick', card: 'salmon', extra: 'egg' });
    snap = act(snap, 1, { type: 'pick', card: 'egg' });
    expect(st(snap).table[0]).toEqual([{ kind: 'wasabi' }, { kind: 'salmon', wasabi: true }, { kind: 'egg' }]);
    expect(st(snap).hands[1]).toEqual(['tempura', 'chopsticks']);
  });

  it('three rounds, puddings kept, end ranking; timeouts and resign', () => {
    let snap = game(2, 7);
    for (let guard = 0; guard < 100 && !st(snap).outcome; guard++) for (const seat of [0, 1]) if (!st(snap).outcome) snap = act(snap, seat, { type: 'pick', card: st(snap).hands[seat]![0] });
    const s = st(snap);
    expect(s.round).toBe(3);
    expect(s.lastRound).toHaveLength(4);
    expect(s.outcome!.placements[0]!.score).toBe(Math.max(...s.scores));
    let tt = game(3);
    tt = (applyTimeout(m, tt, 0) as StepResult).snapshot;
    expect(st(tt).table.every((x) => x.length === 1)).toBe(true);
    const r = act(game(3), 1, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 1, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = sushiGoModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 26 }, { seat: 1, place: 2, score: 9 }]);
    expect(s.lastRound).toEqual([[20, 9], [6, 0]]); // round (nigiri, tempura, maki), then puddings
    expect(s.puddings).toEqual([2, 0]);
  });

  it('random games conserve cards and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 11 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let k = 0; k < 2000 && !st(snap).outcome; k++) {
        const waiting = sushiGoModule.pendingSeats(st(snap));
        const seat = waiting[rng.nextInt(waiting.length)]!;
        const hand = st(snap).hands[seat]!;
        const chop = projectFor(m, snap, p(seat)).legalActions.some((h) => h.type === 'chopsticks');
        const action = chop && rng.nextInt(2) ? { type: 'pick', card: hand[0], extra: hand[1] } : { type: 'pick', card: hand[rng.nextInt(hand.length)] };
        const before = st(snap).hands.flat().length + st(snap).table.flat().length;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const s = st(snap);
        if (s.table.flat().length) expect(s.hands.flat().length + s.table.flat().length).toBe(before);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
