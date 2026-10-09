import { describe, expect, it } from 'vitest';
import { boxScore, CATS, scoreOptions, totals, yahtzeeModule, type Cat, type YahtzeeState } from '@bg/game-yahtzee';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = yahtzeeModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as YahtzeeState;
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
const NONE = [false, false, false, false, false];
/** Snapshot whose current player holds `dice` after one roll. */
const withDice = (dice: number[], sheet: Partial<Record<Cat, number>> = {}, players = 2) => {
  let snap = game(players);
  const seat = st(snap).current;
  snap = act(snap, seat, { type: 'roll', keep: NONE });
  st(snap).dice = dice;
  st(snap).sheets[seat] = { ...sheet };
  return { snap, seat };
};

describe('yahtzee scoring', () => {
  it('scores every box', () => {
    const d = [4, 4, 4, 2, 1];
    expect(boxScore('fours', d)).toBe(12);
    expect(boxScore('ones', d)).toBe(1);
    expect(boxScore('sixes', d)).toBe(0);
    expect(boxScore('threeKind', d)).toBe(15);
    expect(boxScore('fourKind', d)).toBe(0);
    expect(boxScore('fourKind', [3, 3, 3, 3, 6])).toBe(18);
    expect(boxScore('threeKind', [3, 3, 3, 3, 6])).toBe(18);
    expect(boxScore('fullHouse', [2, 2, 5, 5, 5])).toBe(25);
    expect(boxScore('fullHouse', [5, 5, 5, 5, 5])).toBe(0); // only via joker
    expect(boxScore('fullHouse', [2, 2, 5, 5, 6])).toBe(0);
    expect(boxScore('smallStraight', [3, 4, 5, 6, 6])).toBe(30);
    expect(boxScore('smallStraight', [1, 2, 3, 4, 6])).toBe(30);
    expect(boxScore('smallStraight', [1, 2, 3, 5, 6])).toBe(0);
    expect(boxScore('largeStraight', [2, 3, 4, 5, 6])).toBe(40);
    expect(boxScore('largeStraight', [1, 2, 3, 4, 6])).toBe(0);
    expect(boxScore('yahtzee', [6, 6, 6, 6, 6])).toBe(50);
    expect(boxScore('yahtzee', [6, 6, 6, 6, 5])).toBe(0);
    expect(boxScore('chance', [6, 6, 6, 6, 5])).toBe(29);
    expect(boxScore('largeStraight', [5, 5, 5, 5, 5], true)).toBe(40);
  });

  it('totals: upper bonus at 63 and +100 per extra Yahtzee', () => {
    expect(totals({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18 }, 0)).toMatchObject({ upper: 63, upperBonus: 35, total: 98 });
    expect(totals({ ones: 3, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 12 }, 0)).toMatchObject({ upper: 57, upperBonus: 0, total: 57 });
    expect(totals({ yahtzee: 50, chance: 20 }, 2)).toMatchObject({ lower: 70, yahtzeeBonus: 200, total: 270 });
  });

  it('joker rule: matching upper box first, then any lower box at full value, else 0 in an upper box', () => {
    const y = [3, 3, 3, 3, 3];
    expect(scoreOptions({}, y).map((o) => o.cat)).toEqual([...CATS]); // first Yahtzee: free choice
    expect(scoreOptions({ yahtzee: 50 }, y)).toEqual([{ cat: 'threes', points: 15 }]);
    expect(scoreOptions({ yahtzee: 0 }, y)).toEqual([{ cat: 'threes', points: 15 }]);
    const lower = scoreOptions({ yahtzee: 50, threes: 9, fullHouse: 25 }, y);
    expect(lower).toEqual([{ cat: 'threeKind', points: 15 }, { cat: 'fourKind', points: 15 }, { cat: 'smallStraight', points: 30 }, { cat: 'largeStraight', points: 40 }, { cat: 'chance', points: 15 }]);
    expect(scoreOptions({ yahtzee: 50, threes: 9, threeKind: 1, fourKind: 1, fullHouse: 1, smallStraight: 1, largeStraight: 1, chance: 1 }, y))
      .toEqual(['ones', 'twos', 'fours', 'fives', 'sixes'].map((cat) => ({ cat, points: 0 })));
  });
});

describe('yahtzee rules', () => {
  it('setup for 2–6 players: empty sheets, random first player, no dice', () => {
    for (let n = 2; n <= 6; n++) {
      const s = st(game(n, n));
      expect(s.sheets).toHaveLength(n);
      expect(s.sheets.every((x) => Object.keys(x).length === 0)).toBe(true);
      expect(s.current).toBeGreaterThanOrEqual(0);
      expect(s.current).toBeLessThan(n);
      expect(s.dice).toEqual([]);
    }
    expect(() => startGame(m, { playerCount: 1, seed: 1, options: {} })).toThrow();
    expect(() => startGame(m, { playerCount: 7, seed: 1, options: {} })).toThrow();
    expect(st(game(4, 9))).toEqual(st(game(4, 9)));
  });

  it('three rolls with holds; kept dice stay; illegal actions are rejected without mutating', () => {
    let snap = game(2, 5);
    const seat = st(snap).current;
    const other = 1 - seat;
    const before = structuredClone(snap);
    expect(reject(snap, seat, { type: 'score', cat: 'chance' })).toBe('ROLL_FIRST');
    expect(reject(snap, other, { type: 'roll', keep: NONE })).toBe('NOT_YOUR_TURN');
    expect(reject(snap, seat, { type: 'roll', keep: [true] })).toBe('INVALID_ACTION');
    expect(reject(snap, seat, { type: 'score', cat: 'bogus' })).toBe('INVALID_ACTION');
    expect(snap).toEqual(before);
    snap = act(snap, seat, { type: 'roll', keep: [true, true, true, true, true] }); // keep ignored on the first roll
    const d1 = st(snap).dice;
    expect(d1).toHaveLength(5);
    expect(d1.every((v) => v >= 1 && v <= 6)).toBe(true);
    snap = act(snap, seat, { type: 'roll', keep: [true, false, true, false, false] });
    expect(st(snap).dice[0]).toBe(d1[0]);
    expect(st(snap).dice[2]).toBe(d1[2]);
    const d2 = st(snap).dice;
    snap = act(snap, seat, { type: 'roll', keep: [false, true, true, true, true] });
    expect(st(snap).dice.slice(1)).toEqual(d2.slice(1));
    expect(st(snap).rolls).toBe(3);
    expect(reject(snap, seat, { type: 'roll', keep: NONE })).toBe('NO_ROLLS_LEFT');
    expect(projectFor(m, snap, p(seat)).legalActions.some((a) => a.type === 'roll')).toBe(false);
    const dice = st(snap).dice;
    snap = act(snap, seat, { type: 'score', cat: 'chance' });
    expect(st(snap).sheets[seat]!.chance).toBe(dice.reduce((a, b) => a + b, 0));
    expect(st(snap).current).toBe(other);
    expect(st(snap).dice).toEqual([]);
    snap = act(snap, other, { type: 'roll', keep: NONE });
    snap = act(snap, other, { type: 'score', cat: 'chance' });
    snap = act(snap, seat, { type: 'roll', keep: NONE });
    expect(reject(snap, seat, { type: 'score', cat: 'chance' })).toBe('CELL_OCCUPIED');
  });

  it('a mismatching box scores 0; an extra Yahtzee earns +100 and the joker is enforced', () => {
    let { snap, seat } = withDice([1, 2, 3, 5, 6]);
    snap = act(snap, seat, { type: 'score', cat: 'fullHouse' });
    expect(st(snap).sheets[seat]!.fullHouse).toBe(0);

    ({ snap, seat } = withDice([4, 4, 4, 4, 4], { yahtzee: 50 }));
    expect(reject(snap, seat, { type: 'score', cat: 'chance' })).toBe('JOKER_RULE');
    expect(projectFor(m, snap, p(seat)).legalActions.filter((a) => a.type === 'score')).toEqual([{ type: 'score', cat: 'fours', points: 20 }]);
    snap = act(snap, seat, { type: 'score', cat: 'fours' });
    expect(st(snap).bonusYahtzees[seat]).toBe(1);
    expect(st(snap).last).toEqual({ seat, cat: 'fours', points: 20, bonus: true });

    ({ snap, seat } = withDice([2, 2, 2, 2, 2], { yahtzee: 0, twos: 4 }));
    expect(reject(snap, seat, { type: 'score', cat: 'ones' })).toBe('JOKER_RULE');
    snap = act(snap, seat, { type: 'score', cat: 'largeStraight' });
    expect(st(snap).sheets[seat]!.largeStraight).toBe(40);
    expect(st(snap).bonusYahtzees[seat]).toBe(0); // Yahtzee box at 0 → no bonus
  });

  it('turn deadline is set per turn, not per roll, and cleared at the end', () => {
    const snap = game(2, 2);
    const seat = st(snap).current;
    const r = applyAction(m, snap, p(seat), { type: 'roll', keep: NONE }, 0) as StepResult;
    expect(r.scheduleChanges).toEqual([]);
    const s = applyAction(m, r.snapshot, p(seat), { type: 'score', cat: 'chance' }, 0) as StepResult;
    expect(s.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
  });

  it('timeout rolls once if needed and writes the best allowed box', () => {
    let snap = game(3, 4);
    const seat = st(snap).current;
    const tr = applyTimeout(m, snap, 0) as StepResult;
    snap = tr.snapshot;
    // Regression: the automatic roll is logged before the written box.
    expect(tr.internalEvents.map((e) => e.type)).toEqual(['timed-out', 'roll', 'score']);
    const sheet = st(snap).sheets[seat]!;
    expect(Object.keys(sheet)).toHaveLength(1);
    expect(st(snap).current).toBe((seat + 1) % 3);
    const w = withDice([6, 6, 6, 1, 1], { fullHouse: 25 });
    const t = (applyTimeout(m, w.snap, 0) as StepResult).snapshot;
    expect(st(t).sheets[w.seat]!.threeKind).toBe(20); // threeKind 20 = chance 20 > sixes 18: first in sheet order
    expect(st(t).last?.cat).toBe('threeKind');
  });

  it('resign ends the game with the resigner last; others by total, equal totals share', () => {
    const snap = game(3, 1);
    const s = st(snap);
    s.sheets = [{ chance: 20 }, { chance: 20 }, { chance: 30 }];
    const r = st(act(snap, 2, { type: 'resign' }));
    expect(r.outcome).toEqual({ reason: 'resign', placements: [{ seat: 0, place: 1, score: 20 }, { seat: 1, place: 1, score: 20 }, { seat: 2, place: 3, score: 30 }] });
    expect(reject(act(snap, 2, { type: 'resign' }), 0, { type: 'roll', keep: NONE })).toBe('GAME_FINISHED');
  });

  it('final ranking: highest total, ties share the place', () => {
    let snap = game(2, 3);
    const s = st(snap);
    const fullSheet = Object.fromEntries(CATS.map((k) => [k, 0])) as Record<Cat, number>;
    s.sheets = [{ ...fullSheet, chance: 22 }, { ...fullSheet }];
    delete s.sheets[1]!.chance;
    s.current = 1;
    snap = act(snap, 1, { type: 'roll', keep: NONE });
    st(snap).dice = [6, 6, 6, 3, 1];
    snap = act(snap, 1, { type: 'score', cat: 'chance' });
    expect(st(snap).outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 22 }, { seat: 1, place: 1, score: 22 }] });
  });

  it('projection carries public state only, identical for players and spectators', () => {
    const tu = yahtzeeModule.tutorial;
    const snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const viewer of [p(0), p(1), { kind: 'spectator' as const }]) {
      const { view, legalActions } = projectFor(m, snap, viewer);
      const json = JSON.stringify(view);
      expect(view).not.toHaveProperty('script');
      expect(json).not.toMatch(/rng|seed|script/i);
      if (viewer.kind === 'spectator') expect(legalActions).toEqual([]);
    }
    expect(projectFor(m, snap, p(1)).legalActions).toEqual([{ type: 'resign' }]);
    expect(projectFor(m, snap, p(0)).view).toEqual(projectFor(m, snap, { kind: 'spectator' }).view);
  });

  it('tutorial script is legal and ends in a 385–226 win', () => {
    const tu = yahtzeeModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    expect(tu.steps.length).toBeLessThanOrEqual(8);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.sheets[0]!.largeStraight).toBe(40);
    expect(s.sheets[0]!.sixes).toBe(24);
    expect(s.bonusYahtzees[0]).toBe(1);
    expect(totals(s.sheets[0]!, 1)).toEqual({ upper: 64, upperBonus: 35, lower: 186, yahtzeeBonus: 100, total: 385 });
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 385 }, { seat: 1, place: 2, score: 226 }] });
  });

  it('random games of 2–6 players fill 13 rounds and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 41 + g });
      const players = 2 + (g % 5);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: ({ kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number } | { kind: 'timeout'; logicalTime: number })[] = [];
      let n = 0;
      for (; n < 5000 && !st(snap).outcome; n++) {
        const seat = st(snap).current;
        if (rng.nextInt(40) === 0) {
          snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
          inputs.push({ kind: 'timeout', logicalTime: 0 });
          continue;
        }
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const h = hints[rng.nextInt(hints.length)]!;
        const action = h.type === 'roll' ? { type: 'roll', keep: Array.from({ length: 5 }, () => rng.nextInt(2) === 1) } : { type: 'score', cat: h.cat };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      const s = st(snap);
      expect(s.outcome?.reason).toBe('score');
      expect(s.sheets.every((x) => CATS.every((k) => x[k] !== undefined))).toBe(true);
      expect(s.outcome!.placements).toHaveLength(players);
      expect(s.outcome!.placements[0]!.place).toBe(1);
      for (const pl of s.outcome!.placements) expect(pl.score).toBe(totals(s.sheets[pl.seat]!, s.bonusYahtzees[pl.seat]!).total);
      expect(replay(m, setup, inputs as never)).toEqual(snap);
    }
  }, 120_000);
});

describe('yahtzee renderer styles', () => {
  it('uses real theme tokens (live text readable in dark mode) and a sticky row header for wide sheets', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../../../games/yahtzee/src/renderer.css', import.meta.url), 'utf8');
    expect(css).not.toContain('--color-text');
    expect(css).toMatch(/\.yz__live \{[^}]*color: var\(--foreground/);
    expect(css).toMatch(/tbody th, \.yz__sheet tfoot th \{[^}]*position: sticky/);
    expect(css).toMatch(/thead th:first-child \{[^}]*position: sticky/); // regression: header corner stays with the row labels
  });
});
