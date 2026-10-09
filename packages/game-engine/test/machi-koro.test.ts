import { describe, expect, it } from 'vitest';
import { machiModule, type MachiState } from '@bg/game-machi-koro';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = machiModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as MachiState;
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
/** Rolls until the dice show `want` (the engine RNG decides; we retry from the same snapshot with other seeds). */
function rolled(players: number, want: number, setup: (s: MachiState) => void, dice: 1 | 2 = 1) {
  for (let seed = 0; seed < 200; seed++) {
    let snap = game(players, seed);
    setup(st(snap));
    const cur = st(snap).current;
    snap = act(snap, cur, { type: 'roll', dice });
    if (st(snap).dice.reduce((a, b) => a + b, 0) === want) return snap;
  }
  throw new Error('no seed rolled ' + want);
}

describe('machi koro rules', () => {
  it('setup: wheat field, bakery and 3 coins; two dice need the station', () => {
    const snap = game(3);
    const s = st(snap);
    expect(s.cards[0]!.wheat).toBe(1);
    expect(s.cards[0]!.bakery).toBe(1);
    expect(s.coins).toEqual([3, 3, 3]);
    expect(reject(snap, s.current, { type: 'roll', dice: 2 })).toBe('NEED_STATION');
    expect(reject(snap, s.current, { type: 'pass' })).toBe('NOT_NOW');
  });

  it('a 1 pays every wheat field; a 3 lets the café owner take from the roller', () => {
    const one = rolled(3, 1, (s) => { s.current = 0; });
    expect(st(one).coins).toEqual([4, 4, 4]);
    const three = rolled(2, 3, (s) => { s.current = 0; s.cards[1]!.cafe = 1; });
    expect(st(three).coins).toEqual([3 - 1 + 1, 3 + 1]); // roller pays 1 to the café, then bakery +1
  });

  it('building buys from the supply; majors once each; landmarks; four landmarks win', () => {
    let snap = rolled(2, 1, (s) => { s.current = 0; s.coins[0] = 30; });
    snap = act(snap, 0, { type: 'build', card: 'stadium' });
    expect(st(snap).cards[0]!.stadium).toBe(1);
    expect(st(snap).supply.stadium).toBe(1);
    let t = rolled(2, 1, (s) => { s.current = 0; s.coins[0] = 30; s.cards[0]!.tv = 1; });
    expect(reject(t, 0, { type: 'build', card: 'tv' })).toBe('ONE_MAJOR_EACH');
    t = act(t, 0, { type: 'build', landmark: 'station' });
    expect(st(t).landmarks[0]!.station).toBe(true);
    const w = rolled(2, 1, (s) => { s.current = 0; s.coins[0] = 30; s.landmarks[0] = { station: true, mall: true, park: true, radio: false }; s.landmarks[0].radio = false; });
    expect(st(w).phase).toBe('build');
    const done = act(w, 0, { type: 'build', landmark: 'radio' });
    expect(st(done).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('radio tower allows one reroll; TV station takes 5 from a chosen player', () => {
    let snap = game(2, 3);
    st(snap).current = 0;
    st(snap).landmarks[0]!.radio = true;
    snap = act(snap, 0, { type: 'roll', dice: 1 });
    expect(st(snap).phase).toBe('reroll');
    snap = act(snap, 0, { type: 'roll', dice: 1 });
    expect(st(snap).phase).not.toBe('reroll');
    const six = rolled(2, 6, (s) => { s.current = 0; s.cards[0]!.tv = 1; s.coins[1] = 9; });
    expect(st(six).phase).toBe('tv');
    const after = act(six, 0, { type: 'tv', target: 1 });
    expect(st(after).coins[1]).toBe(4);
    expect(st(after).phase).toBe('build');
  });

  it('timeouts roll and pass; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).not.toBe(c);
    expect(st(t).timeouts[c]).toBe(1);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
    expect(projectFor(m, game(), p(0)).view).not.toHaveProperty('timeouts');
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = machiModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 4 }, { seat: 1, place: 2, score: 0 }], reason: 'win' });
    // 4 − 2 (rival's Family Restaurant) + 3 (Apple Orchard) − 1 (Ranch) + 9 (Cheese Factory × 3 Ranches) − 10 (Mall).
    expect(st(snap).coins).toEqual([3, 5]);
    expect(st(snap).cards[0]!.ranch).toBe(3);
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 15; g++) {
      const rng = createRng({ s: 73 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        let action: unknown;
        if (s.phase === 'roll' || s.phase === 'reroll') action = s.phase === 'reroll' && rng.nextInt(2) ? { type: 'keep' } : { type: 'roll', dice: s.landmarks[seat]!.station && rng.nextInt(2) ? 2 : 1 };
        else if (s.phase === 'tv') action = { type: 'tv', target: (seat + 1) % players };
        else if (s.phase === 'swap') action = { type: 'noSwap' };
        else {
          const lm = hints.find((h) => h.type === 'build' && h.landmark);
          const builds = hints.filter((h) => h.type === 'build');
          action = lm ? { type: 'build', landmark: lm.landmark } : builds.length && rng.nextInt(2) ? { type: 'build', card: builds[rng.nextInt(builds.length)]!.card } : { type: 'pass' };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(st(snap).coins.every((c) => c >= 0)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
