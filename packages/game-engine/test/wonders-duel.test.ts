import { describe, expect, it } from 'vitest';
import { CARDS, WONDERS, accessible, cardPrice, duelModule, layout, scoreBreakdown, tradeCost, type DuelState, type DuelView } from '@bg/game-wonders-duel';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = duelModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as DuelState;
const game = (seed = 1) => startGame(m, { playerCount: 2, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const edit = (snap: EngineSnapshot, f: (s: DuelState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const id = (n: string) => CARDS.find((c) => c.name === n)!.id;
const pending = (snap: EngineSnapshot) => duelModule.pendingSeats(st(snap))[0]!;
const draft = (snap: EngineSnapshot) => { while (st(snap).phase === 'draft') snap = act(snap, pending(snap), { type: 'draftWonder', wonder: st(snap).draftPool[0] }); return snap; };

describe('wonders duel rules', () => {
  it('card set: 23 + 23 + 20 + 7 guilds; 12 wonders; layouts of 20 with the right accessible cards', () => {
    expect([1, 2, 3].map((a) => CARDS.filter((c) => c.age === a && c.color !== 'purple').length)).toEqual([23, 23, 20]);
    expect(CARDS.filter((c) => c.color === 'purple')).toHaveLength(7);
    expect(WONDERS).toHaveLength(12);
    const ids = Array.from({ length: 20 }, (_, i) => i);
    expect(accessible(layout(1, ids))).toEqual([14, 15, 16, 17, 18, 19]);
    expect(accessible(layout(2, ids))).toEqual([18, 19]);
    expect(accessible(layout(3, ids))).toEqual([18, 19]);
  });

  it('wonder draft: A·B·B then the last to A; B·A·A then the last to B; four each', () => {
    let snap = game(3);
    const a = st(snap).first;
    expect(pending(snap)).toBe(a);
    expect(reject(snap, 1 - a, { type: 'draftWonder', wonder: st(snap).draftPool[0] })).toBe('NOT_YOUR_TURN');
    snap = draft(snap);
    expect(st(snap).wonders.map((w) => w.length)).toEqual([4, 4]);
    expect(st(snap)).toMatchObject({ phase: 'play', current: a });
  });

  it('trading prices follow the opponent production; reserves fix the price at 1; chains are free', () => {
    let snap = draft(game(4));
    snap = edit(snap, (s) => { s.cities = [[id('چوب‌بری')], [id('معدن سنگ'), id('معدن پلکانی')]]; s.coins = [10, 10]; });
    const s = st(snap);
    expect(tradeCost(s, 0, 'SSW', 0)).toBe(10);
    expect(tradeCost(s, 0, 'SSW', 2)).toBe(0);
    s.cities[0]!.push(id('انبار سنگ'));
    expect(tradeCost(s, 0, 'SSW', 0)).toBe(2);
    s.cities[0]!.push(id('کاروانسرا'));
    expect(tradeCost(s, 0, 'SSCW', 0)).toBe(2);
    s.cities[0]!.push(id('محراب'));
    expect(cardPrice(s, 0, id('معبد'))).toEqual({ total: 0, trade: 0, chained: true });
  });

  it('military tokens cost coins and nine is supremacy; science pairs offer progress', () => {
    let snap = draft(game(5));
    snap = edit(snap, (s) => { s.current = 0; s.coins = [30, 9]; const row = [id('برج نگهبانی'), id('کارگاه'), id('آزمایشگاه'), id('زرادخانه'), id('قرارگاه'), ...Array<number>(15).fill(id('معدن سنگ'))]; s.structure = row.map((card, i) => ({ card, row: 0, x: i * 2, up: true, taken: false })); s.military = 2; });
    snap = act(snap, 0, { type: 'build', slot: 0 });
    expect(st(snap).military).toBe(3);
    expect(st(snap).coins[1]).toBe(7);
    snap = act(snap, 1, { type: 'discard', slot: 5 });
    snap = act(snap, 0, { type: 'build', slot: 1 });
    snap = act(snap, 1, { type: 'discard', slot: 6 });
    snap = act(snap, 0, { type: 'build', slot: 2 });
    expect(st(snap).phase).toBe('choose');
    expect(reject(snap, 0, { type: 'build', slot: 3 })).toBe('CHOOSE_FIRST');
    snap = act(snap, 0, { type: 'progress', token: st(snap).progressBoard[0] });
    snap = act(snap, 1, { type: 'discard', slot: 7 });
    snap = act(snap, 0, { type: 'build', slot: 4 });
    expect(st(snap).military).toBe(6);
    snap = act(snap, 1, { type: 'discard', slot: 8 });
    snap = act(snap, 0, { type: 'build', slot: 3 });
    expect(st(snap).outcome).toMatchObject({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }], reason: 'win' });
  });

  it('face-down cards and out-of-game tokens stay hidden', () => {
    const snap = draft(game(2));
    const v = projectFor(m, snap, p(0)).view as DuelView;
    expect(v).not.toHaveProperty('progressOut');
    const down = v.structure.filter((x) => !x.up);
    expect(down.length).toBe(8);
    expect(down.every((x) => x.card === null && x.back === 1)).toBe(true);
    expect(v.accessible).toHaveLength(6);
  });

  it('timeouts draft and discard; resign loses', () => {
    let t = game();
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).draftPick).toBe(1);
    t = draft(t);
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).coins[c]).toBe(9);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a civilian win', () => {
    const tu = duelModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.outcome?.placements).toEqual([{ seat: 0, place: 1, score: 39 }, { seat: 1, place: 2, score: 26 }]);
    expect(s.military).toBe(7);
    expect(s.coins).toEqual([3, 1]);
    expect(s.progress[0]).toEqual(['strategy']);
  });

  it('random games finish and replay deterministically', () => {
    const reasons = new Set<string>();
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 61 + g });
      const setup = { playerCount: 2, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const seat = pending(snap);
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const builds = legal.filter((h) => h.type === 'build' || h.type === 'wonder');
        const pick = builds.length && rng.nextInt(4) ? builds[rng.nextInt(builds.length)]! : legal[rng.nextInt(legal.length)]!;
        const { cost: _c, coins: _k, ...action } = pick;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      reasons.add(s.outcome!.reason);
      expect(s.wonders.flat().filter((w) => w.built).length).toBeLessThanOrEqual(7);
      if (s.outcome!.reason === 'score') expect(s.outcome!.placements.find((x) => x.seat === 0)!.score).toBe(scoreBreakdown(s, 0).total);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
    expect(reasons.has('score')).toBe(true);
  }, 120_000);
});
