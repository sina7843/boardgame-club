import { describe, expect, it } from 'vitest';
import { CARDS, beats, scoutModule, showKind, validShows, type HandCard, type ScoutState, type ScoutView } from '@bg/game-scout';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = scoutModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as ScoutState;
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
const card = (up: number, other: number): HandCard => ({ id: CARDS.findIndex(([a, b]) => a === Math.min(up, other) && b === Math.max(up, other)), up });
const oriented = (snap: EngineSnapshot) => { for (let k = 0; k < st(snap).players; k++) snap = act(snap, k, { type: 'orient', flip: false }); return snap; };

describe('scout rules', () => {
  it('45 cards; decks by player count; everyone orients first', () => {
    expect(CARDS).toHaveLength(45);
    expect(st(game(3)).hands.map((h) => h.length)).toEqual([12, 12, 12]);
    expect(st(game(4)).hands[0]).toHaveLength(11);
    expect(st(game(5)).hands[0]).toHaveLength(9);
    const snap = game(3);
    expect(reject(snap, st(snap).current, { type: 'show', from: 0, count: 1 })).toBe('ORIENT_FIRST');
  });

  it('show strength: more cards, then sets over runs, then the higher low card', () => {
    const run3 = showKind([4, 5, 6])!, set2 = showKind([9, 9])!, set3 = showKind([2, 2, 2])!, run2 = showKind([8, 7])!;
    expect(showKind([1, 3])).toBeNull();
    expect(beats(run3, set2)).toBe(true);
    expect(beats(set3, run3)).toBe(true);
    expect(beats(set2, run2)).toBe(true);
    expect(beats(showKind([5, 6])!, showKind([4, 5]))).toBe(true);
    expect(beats(showKind([4, 5])!, showKind([5, 6]))).toBe(false);
  });

  it('flipping the hand reverses it and shows the other numbers', () => {
    let snap = game(3, 2);
    const before = st(snap).hands[0]!.map((h) => h.id);
    snap = act(snap, 0, { type: 'orient', flip: true });
    expect(st(snap).hands[0]!.map((h) => h.id)).toEqual(before.reverse());
    expect((projectFor(m, snap, p(1)).view as ScoutView).hand).toHaveLength(12);
    expect(projectFor(m, snap, p(1)).view).not.toHaveProperty('hands');
  });

  it('a show captures the beaten show; scouting gives the owner a chip and inserts the card', () => {
    let snap = oriented(game(3, 3));
    const s = st(snap);
    s.current = 0;
    s.hands[0] = [card(4, 1), card(4, 2), card(9, 3)];
    s.hands[1] = [card(5, 1), card(6, 1), card(7, 1), card(2, 8)];
    snap = act(snap, 0, { type: 'show', from: 0, count: 2 }); // 4 4
    expect(reject(snap, 1, { type: 'show', from: 0, count: 2 })).toBe('WEAK_SHOW'); // 5 6 run < set
    snap = act(snap, 1, { type: 'scout', end: 'first', flip: false, at: 4 });
    expect(st(snap).chips[0]).toBe(1);
    expect(st(snap).hands[1]!.at(-1)!.up).toBe(4);
    expect(st(snap).table!.cards).toHaveLength(1);
    snap = act(snap, 2, { type: 'scout', end: 'last', flip: true, at: 0, andShow: true });
    expect(st(snap).usedSS[2]).toBe(true);
  });

  it('the round ends when everyone else scouts back to the owner, who keeps their hand; scoring', () => {
    let t = oriented(game(3, 6));
    const u = st(t);
    u.current = 0;
    u.hands[0] = [card(7, 1), card(7, 2), card(3, 4)];
    const sizes = u.hands.map((h) => h.length);
    t = act(t, 0, { type: 'show', from: 0, count: 2 });
    t = act(t, 1, { type: 'scout', end: 'first', flip: false, at: 0 });
    t = act(t, 2, { type: 'scout', end: 'first', flip: false, at: 0 });
    const v = st(t);
    expect(v.round).toBe(2);
    expect(v.roundLog[0]).toEqual([2, -(sizes[1]! + 1), -(sizes[2]! + 1)]); // owner: two chips, no hand penalty
  });

  it('timeouts orient and scout; resign ends with the resigner last', () => {
    let t = game(3);
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).phase).toBe('play');
    expect(st(t).timeouts).toEqual([1, 1, 1]);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.at(-1)).toMatchObject({ seat: 0, place: 3 });
  });

  it('tutorial script is legal and ends in a win', () => {
    const tu = scoutModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    const s = st(snap);
    expect(s.roundLog).toEqual([[4, 2]]);
    expect(s.outcome).toEqual({ placements: [{ seat: 0, place: 1, score: 4 }, { seat: 1, place: 2, score: 2 }], reason: 'score' });
  });

  it('random games keep their cards and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 53 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 4000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = scoutModule.pendingSeats(s)[0]!;
        let action: unknown;
        if (s.phase === 'orient') action = { type: 'orient', flip: !!rng.nextInt(2) };
        else {
          const shows = validShows(s.hands[seat]!, s.table);
          const canScout = s.phase === 'play' && s.table && s.table.owner !== seat;
          if (shows.length && (!canScout || rng.nextInt(2))) { const x = shows[shows.length - 1 - rng.nextInt(Math.min(3, shows.length))]!; action = { type: 'show', ...x }; }
          else action = { type: 'scout', end: rng.nextInt(2) ? 'first' : 'last', flip: !!rng.nextInt(2), at: rng.nextInt(s.hands[seat]!.length + 1), andShow: !s.usedSS[seat] && rng.nextInt(4) === 0 };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        if (!t.outcome && t.phase !== 'orient') {
          const inPlay = t.hands.flat().length + (t.table?.cards.length ?? 0) + t.captured.reduce((a, b) => a + b, 0);
          expect(inPlay).toBeLessThanOrEqual(45);
        }
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(st(snap).roundLog).toHaveLength(st(snap).rounds);
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
