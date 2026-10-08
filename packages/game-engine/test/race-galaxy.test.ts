import { describe, expect, it } from 'vitest';
import { CARDS, military, priceOf, rgModule, vpOf, type RgState, type RgView } from '@bg/game-race-galaxy';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = rgModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as RgState;
const game = (players = 3, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => { const r = applyAction(m, snap, p(seat), action, 0); return 'ok' in r ? r.errorCode : 'ACCEPTED'; };
const edit = (snap: EngineSnapshot, f: (s: RgState) => void): EngineSnapshot => { const s = structuredClone(st(snap)); f(s); return { ...snap, state: s }; };
const byName = (n: string) => CARDS.find((c) => c.name === n)!.id;
const total = (s: RgState) => s.deck.length + s.discard.length + s.players.reduce((n, e) => n + e.hand.length + e.tableau.length + e.drawn.length, 0);

describe('race for the galaxy rules', () => {
  it('55 cards: 3 starts, 32 worlds, 20 developments; a start world and 4 cards each', () => {
    expect(CARDS).toHaveLength(55);
    expect(CARDS.filter((c) => c.start)).toHaveLength(3);
    const s = st(game(3));
    expect(s.players.every((e) => e.tableau.length === 1 && e.hand.length === 4)).toBe(true);
    expect(s.pool).toBe(36);
  });

  it('phases are chosen secretly and only the chosen ones run, in order', () => {
    let snap = game(2, 2);
    snap = act(snap, 0, { type: 'choose', phase: 'produce' });
    expect((projectFor(m, snap, p(1)).view as RgView).empires[0]!.chose).toBe(true);
    expect((projectFor(m, snap, p(1)).view as RgView).myChoice).toBeNull();
    expect(reject(snap, 0, { type: 'choose', phase: 'explore' })).toBe('NOT_SELECTING');
    snap = act(snap, 1, { type: 'choose', phase: 'explore' });
    const s = st(snap);
    expect(s.stage).toBe('explore');
    expect(s.queue).toEqual(['produce']);
    expect(s.players[1]!.drawn).toHaveLength(4);
    expect(s.players[0]!.drawn).toHaveLength(2);
    expect(rgModule.pendingSeats(s)).toEqual([0, 1]);
    snap = act(snap, 0, { type: 'keep', card: s.players[0]!.drawn[0] });
    snap = act(snap, 1, { type: 'keep', card: s.players[1]!.drawn[1] });
    expect(st(snap)).toMatchObject({ stage: 'select', round: 2 });
    expect(st(snap).players.map((e) => e.hand.length)).toEqual([5, 5]);
  });

  it('settling pays in cards (picker draws one); military worlds need strength; production fills goods; consume scores', () => {
    const world = byName('جهان آبی');
    const mil = byName('پایگاه دزدان');
    let snap = edit(game(2, 3), (s) => { s.players[0]!.hand = [world, mil, byName('ماه یخی'), byName('ماه آهنی')]; s.players[0]!.tableau = [byName('زمین قدیم')]; });
    expect(priceOf(st(snap), 0, mil, 'settle')).toBeNull();
    expect(military(st(snap).players[0]!)).toBe(0);
    snap = act(snap, 0, { type: 'choose', phase: 'settle' });
    snap = act(snap, 1, { type: 'choose', phase: 'produce' });
    expect(reject(snap, 0, { type: 'place', card: world, pay: [1] })).toBe('BAD_PAY');
    expect(reject(snap, 0, { type: 'place', card: mil, pay: [] })).toBe('WRONG_PHASE_OR_MILITARY');
    const before = total(st(snap));
    snap = act(snap, 0, { type: 'place', card: world, pay: [2, 3] });
    if (st(snap).stage === 'settle') snap = act(snap, 1, { type: 'place', card: -1, pay: [] });
    const s = st(snap);
    expect(s.players[0]!.tableau).toContain(world);
    expect(s.players[0]!.hand).toEqual([mil, expect.any(Number)]);
    expect(s.players[0]!.goods).toEqual(expect.arrayContaining([world, byName('زمین قدیم')]));
    expect(total(s)).toBe(before);
    snap = act(snap, 0, { type: 'choose', phase: 'consume' });
    snap = act(snap, 1, { type: 'choose', phase: 'consume' });
    expect(st(snap).players[0]!.chips).toBe(4);
    expect(vpOf(st(snap).players[0]!)).toBe(4 + 1 + 1);
  });

  it('hands, drawn cards and other players\' choices are hidden', () => {
    const snap = act(game(3, 2), 1, { type: 'choose', phase: 'develop' });
    const v = projectFor(m, snap, p(0)).view as RgView;
    expect(v).not.toHaveProperty('players');
    expect(v).not.toHaveProperty('deck');
    expect(v.empires.map((e) => e.chose)).toEqual([false, true, false]);
    expect(JSON.stringify(v)).not.toContain('"develop"');
  });

  it('timeouts act for every waiting player; resign ends with the resigner last', () => {
    let t = game(3);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).round).toBe(2);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = rgModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply && rgModule.pendingSeats(st(snap)).includes(1)) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements[0]).toMatchObject({ seat: 0, place: 1 });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 12; g++) {
      const rng = createRng({ s: 1 + g });
      const setup = { playerCount: 2 + (g % 3), seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const size = total(st(snap));
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 6000 && !st(snap).outcome; n++) {
        const seat = rgModule.pendingSeats(st(snap))[0]!;
        const s = st(snap);
        const legal = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        let action: unknown;
        const places = legal.filter((h) => h.type === 'place' && (h.card as number) >= 0);
        if (places.length) {
          const h = places[rng.nextInt(places.length)]!;
          const hand = s.players[seat]!.hand;
          action = { type: 'place', card: h.card, pay: hand.map((c, i) => (c === h.card ? -1 : i)).filter((i) => i >= 0).slice(0, h.price as number) };
        } else {
          const { type, ...rest } = legal.filter((h) => h.type !== 'place' || rng.nextInt(4) === 0)[0] ?? legal[0]!;
          action = type === 'choose' ? { type, phase: (['explore', 'develop', 'settle', 'consume', 'produce'] as const)[rng.nextInt(5)] } : { type, ...rest };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(size);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
