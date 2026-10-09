import { describe, expect, it } from 'vitest';
import { expScore, lostCitiesModule, type LostCitiesState, type LostCitiesView } from '@bg/game-lost-cities';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = lostCitiesModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as LostCitiesState;
const game = (seed = 1, options: Record<string, string> = {}) => startGame(m, { playerCount: 2, seed, options }).snapshot;
const act = (snap: EngineSnapshot, seat: number, action: unknown): EngineSnapshot => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r.snapshot;
};
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const total = (s: LostCitiesState) => s.deck.length + s.hands.flat().length + s.exp.flatMap((e) => Object.values(e).flat()).length + Object.values(s.discard).flat().length;

describe('lost cities rules', () => {
  it('scores expeditions: −20 cost, wagers multiply, eight-card bonus, unstarted is zero', () => {
    expect(expScore([])).toBe(0);
    expect(expScore(['r2', 'r3'])).toBe(-15);
    expect(expScore(['r0', 'r0', 'r6', 'r7', 'r8', 'r9'])).toBe(30);
    expect(expScore(['b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'])).toBe(44 - 20 + 20);
  });

  it('a turn is place then draw; ascending only; wagers before numbers; no drawing back the discard', () => {
    let snap = game();
    const s = st(snap);
    s.current = 0;
    s.hands[0] = ['r0', 'r5', 'r3', 'b4', 'b6', 'g2', 'g3', 'w9'];
    s.exp[0]!.r = [];
    expect(reject(snap, 0, { type: 'draw', from: 'deck' })).toBe('PLACE_FIRST');
    expect(reject(snap, 1, { type: 'play', card: 'r5' })).toBe('NOT_YOUR_TURN');
    snap = act(snap, 0, { type: 'play', card: 'r5' });
    expect(reject(snap, 0, { type: 'play', card: 'r3' })).toBe('DRAW_NOW');
    snap = act(snap, 0, { type: 'draw', from: 'deck' });
    snap = act(snap, 1, { type: 'discard', card: st(snap).hands[1]![0] });
    const pile = Object.entries(st(snap).discard).find(([, v]) => v.length)![0];
    expect(reject(snap, 1, { type: 'draw', from: pile })).toBe('JUST_DISCARDED');
    snap = act(snap, 1, { type: 'draw', from: 'deck' });
    expect(reject(snap, 0, { type: 'play', card: 'r3' })).toBe('NOT_ASCENDING');
    expect(reject(snap, 0, { type: 'play', card: 'r0' })).toBe('NOT_ASCENDING');
    snap = act(snap, 0, { type: 'discard', card: 'r3' });
    snap = act(snap, 0, { type: 'draw', from: 'deck' });
    snap = act(snap, 1, { type: 'discard', card: st(snap).hands[1]![0] });
    snap = act(snap, 1, { type: 'draw', from: 'r' });
    expect(st(snap).hands[1]).toContain('r3');
  });

  it('hands and deck stay hidden', () => {
    const snap = game();
    const v = projectFor(m, snap, p(1)).view as LostCitiesView;
    expect(v.hand).toEqual(st(snap).hands[1]);
    expect(v.handCount).toEqual([8, 8]);
    expect(v).not.toHaveProperty('hands');
    expect(v).not.toHaveProperty('deck');
  });

  it('the round ends with the last deck card; three rounds; timeouts and resign', () => {
    let snap = game(3, { length: 'three' });
    st(snap).deck.splice(1);
    const cur = st(snap).current;
    snap = (applyTimeout(m, snap, 0) as StepResult).snapshot;
    expect(st(snap).timeouts[cur]).toBe(1);
    expect(st(snap).round).toBe(2);
    expect(st(snap).roundScores).toHaveLength(1);
    expect(st(snap).hands.map((h) => h.length)).toEqual([8, 8]);
    const r = act(game(), 0, { type: 'resign' });
    expect(st(r).outcome?.placements[0]).toMatchObject({ seat: 1, place: 1 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const t = lostCitiesModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options ?? {} }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 54 }, { seat: 1, place: 2, score: -3 }]);
    expect(st(snap).scores).toEqual([54, -3]);
  });

  it('random games conserve all 60 cards and replay deterministically', () => {
    for (let g = 0; g < 20; g++) {
      const rng = createRng({ s: 13 + g });
      const setup = { playerCount: 2, seed: g, options: { length: g % 2 ? 'one' : 'three' } };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 3000 && !st(snap).outcome; n++) {
        const seat = st(snap).current;
        const hints = projectFor(m, snap, p(seat)).legalActions.filter((h) => h.type !== 'resign');
        const plays = hints.filter((h) => h.type === 'play');
        const h = plays.length && rng.nextInt(3) ? plays[rng.nextInt(plays.length)]! : hints[rng.nextInt(hints.length)]!;
        const { type, card, from } = h as { type: string; card?: string; from?: string };
        const action = type === 'draw' ? { type, from } : { type, card };
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        expect(total(st(snap))).toBe(60);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(st(snap).roundScores).toHaveLength(g % 2 ? 1 : 3);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
