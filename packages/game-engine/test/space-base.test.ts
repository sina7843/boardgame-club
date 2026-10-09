import { describe, expect, it } from 'vitest';
import { GOAL, SHIPS, sbModule, sectorsFor, type SbState, type SbView } from '@bg/game-space-base';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = sbModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SbState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
const edit = (snap: EngineSnapshot, f: (s: SbState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };

describe('space base rules', () => {
  it('12 starting ships each, 72 shop ships in three levels, 6 face up per level', () => {
    expect(SHIPS.filter((x) => x.level === 0)).toHaveLength(12);
    expect([1, 2, 3].map((l) => SHIPS.filter((x) => x.level === l).length)).toEqual([24, 24, 24]);
    const s = st(game(3));
    expect(s.shop.map((r) => r.length)).toEqual([6, 6, 6]);
    expect(s.boards.every((b) => b.station.length === 12)).toBe(true);
    expect(sectorsFor([3, 4], 'separate')).toEqual([3, 4]);
    expect(sectorsFor([3, 4], 'sum')).toEqual([7]);
  });

  it('roll → choose → buy; blue for the roller, red for the others; buying deploys the old station', () => {
    let snap = edit(game(3, 2), (s) => { s.current = 0; s.fixedDice = [[2, 5]]; s.boards[1]!.deployed[6]!.push(SHIPS[6]!.id); });
    expect(reject(snap, 0, { type: 'choose', use: 'sum' })).toBe('ROLL_FIRST');
    snap = act(snap, 0, { type: 'roll' });
    const before = st(snap).boards.map((b) => b.credits);
    snap = act(snap, 0, { type: 'choose', use: 'sum' });
    const s = st(snap);
    expect(s.boards[0]!.credits - before[0]!).toBe(SHIPS[6]!.blue.credits);
    expect(s.boards[1]!.credits - before[1]!).toBe(1);
    expect(s.boards[2]!.credits).toBe(before[2]);
    const ship = s.shop[0]!.find((id) => SHIPS[id]!.cost <= s.boards[0]!.credits)!;
    snap = act(snap, 0, { type: 'buy', ship });
    const t = st(snap);
    const sec = SHIPS[ship]!.sector;
    expect(t.boards[0]!.station[sec - 1]).toBe(ship);
    expect(t.boards[0]!.deployed[sec - 1]).toHaveLength(1);
    expect(t.shop[0]).toHaveLength(6);
    expect(t.current).toBe(1);
  });

  it('credits rise to income at end of turn; the goal ends the game', () => {
    let snap = edit(game(2, 3), (s) => { s.current = 0; s.fixedDice = [[1, 1]]; s.boards[0]!.income = 6; s.boards[0]!.credits = 0; });
    snap = act(snap, 0, { type: 'roll' });
    snap = act(snap, 0, { type: 'choose', use: 'separate' });
    snap = act(snap, 0, { type: 'pass' });
    expect(st(snap).boards[0]!.credits).toBe(6);
    snap = edit(snap, (s) => { s.boards[1]!.vp = GOAL; });
    snap = act(snap, 1, { type: 'roll' });
    snap = act(snap, 1, { type: 'choose', use: 'sum' });
    snap = act(snap, 1, { type: 'pass' });
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('decks are hidden; boards are public', () => {
    const v = projectFor(m, game(3), p(0)).view as SbView;
    expect(v).not.toHaveProperty('decks');
    expect(v.deckCounts).toEqual([18, 18, 18]);
  });

  it('timeouts roll, use the sum and pass; resign ends with the resigner last', () => {
    let t = game(3);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).current).toBe((c + 1) % 3);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = sbModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) { snap = act(snap, 0, step.expected); if (step.reply) snap = act(snap, 1, step.reply); }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 40 }, { seat: 1, place: 2, score: 34 }]);
    expect(s.boards[0]!.credits).toBe(4); // 9 − 7 = 2, raised to the income of 4 at the end of the turn
    expect(s.boards[0]!.deployed[4]).toEqual([4]); // the starting sector-5 ship was deployed
    expect(s.boards[1]!.credits).toBe(7); // red rewards on the learner's turn: +1 credit, +1 VP
    expect(s.shop.flat().length + s.decks.flat().length).toBe(SHIPS.filter((x) => x.level > 0).length - 4);
  });

  it('random games reach the goal and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 2 + g });
      const setup = { playerCount: 2 + (g % 4), seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const legal = projectFor(m, snap, p(s.current)).legalActions.filter((h) => h.type !== 'resign');
        const buys = legal.filter((h) => h.type === 'buy').sort((a, b) => SHIPS[b.ship as number]!.cost - SHIPS[a.ship as number]!.cost);
        const pick = buys.length && rng.nextInt(4) ? buys[0]! : legal[rng.nextInt(legal.length)]!;
        const { type, ...rest } = pick;
        const action = { type, ...rest };
        snap = act(snap, s.current, action);
        inputs.push({ kind: 'action', actor: p(s.current), action, logicalTime: 0 });
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(Math.max(...st(snap).boards.map((b) => b.vp))).toBeGreaterThanOrEqual(GOAL);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
