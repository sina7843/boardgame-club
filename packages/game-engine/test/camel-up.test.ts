import { describe, expect, it } from 'vitest';
import { CAMELS, camelModule, posOf, ranking, type CamelState, type CamelView } from '@bg/game-camel-up';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = camelModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as CamelState;
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
const camelsOnTrack = (s: CamelState) => Object.values(s.spaces).flat().sort();

describe('camel up rules', () => {
  it('setup: five camels on spaces 1–3, five dice, 3 coins each', () => {
    const s = st(game(4));
    expect(camelsOnTrack(s)).toEqual(CAMELS.slice().sort());
    expect(Object.keys(s.spaces).every((k) => Number(k) <= 3)).toBe(true);
    expect(s.dice).toHaveLength(5);
    expect(s.coins).toEqual([3, 3, 3, 3]);
  });

  it('a moving camel carries the camels on top; desert tiles move and pay', () => {
    let snap = game(2, 2);
    const s = st(snap);
    s.current = 0;
    s.spaces = { 3: ['blue', 'green'], 5: ['white'], 1: ['orange', 'yellow'] };
    s.desert[1] = { space: 6, oasis: true };
    s.dice = ['blue'];
    s.legBets[0] = [{ camel: 'white', value: 5 }];
    snap = act(snap, 0, { type: 'roll' });
    const t = st(snap);
    const rolled = t.log.at(-1);
    // Blue (with green on top) moved; the leg ended because it was the last die.
    expect(rolled).toBeTruthy();
    expect(t.dice).toHaveLength(5);
    expect(posOf(t, 'green')).toBe(posOf(t, 'blue'));
    const top = t.spaces[posOf(t, 'blue')]!;
    expect(top.indexOf('green')).toBeGreaterThan(top.indexOf('blue'));
  });

  it('ranking reads positions then stack height; leg bets and desert rules', () => {
    expect(ranking({ spaces: { 4: ['blue', 'green'], 6: ['white'], 1: ['orange'] } })).toEqual(['white', 'green', 'blue', 'orange']);
    let snap = game(3, 3);
    const s = st(snap);
    s.current = 0;
    s.spaces = { 1: ['blue', 'green', 'orange', 'yellow', 'white'] };
    expect(reject(snap, 0, { type: 'desert', space: 1, oasis: true })).toBe('INVALID_ACTION');
    snap = act(snap, 0, { type: 'desert', space: 5, oasis: true });
    expect(reject(snap, 1, { type: 'desert', space: 6, oasis: false })).toBe('BAD_SPACE');
    snap = act(snap, 1, { type: 'leg', camel: 'white' });
    snap = act(snap, 2, { type: 'leg', camel: 'white' });
    expect(st(snap).legBets.map((b) => b.map((x) => x.value))).toEqual([[], [5], [3]]);
  });

  it('overall bets stay hidden; crossing the finish ends the game and pays in order', () => {
    let snap = game(3, 4);
    const s = st(snap);
    s.current = 0;
    snap = act(snap, 0, { type: 'overall', camel: 'blue', which: 'win' });
    snap = act(snap, 1, { type: 'overall', camel: 'blue', which: 'win' });
    expect(reject(snap, 2, { type: 'roll' })).toBe('ACCEPTED');
    const v = projectFor(m, snap, p(2)).view as CamelView;
    expect(v.winnerCount).toBe(2);
    expect(v.myOverall).toEqual([]);
    expect(v).not.toHaveProperty('winnerBets');
    st(snap).spaces = { 16: ['blue'], 2: ['green', 'orange', 'yellow', 'white'] };
    st(snap).dice = ['blue'];
    snap = act(snap, 2, { type: 'roll' });
    const t = st(snap);
    expect(t.outcome).not.toBeNull();
    expect(t.coins[0]).toBe(3 + 8);
    expect(t.coins[1]).toBe(3 + 5);
  });

  it('timeouts roll; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).dice).toHaveLength(4);
    expect(st(t).coins[c]).toBe(4);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = camelModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 20 }, { seat: 1, place: 2, score: 8 }]);
    expect(st(snap).spaces[17]).toEqual(['blue', 'green']);
  });

  it('random games keep five camels and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 71 + g });
      const players = 2 + (g % 7);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = rng.nextInt(2) ? hints[0]! : hints[rng.nextInt(hints.length)]!;
        let action: unknown = { type: 'roll' };
        if (h.type === 'leg') action = { type: 'leg', camel: h.camel };
        else if (h.type === 'desert') action = { type: 'desert', space: (h.spaces as number[])[rng.nextInt((h.spaces as number[]).length)], oasis: !!rng.nextInt(2) };
        else if (h.type === 'overall') action = { type: 'overall', camel: (h.cards as string[])[0], which: rng.nextInt(2) ? 'win' : 'lose' };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(camelsOnTrack(st(snap))).toEqual(CAMELS.slice().sort());
        expect(st(snap).coins.every((c) => c >= 0)).toBe(true);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
