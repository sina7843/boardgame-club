import { describe, expect, it } from 'vitest';
import { theMindModule, type TheMindState, type TheMindView } from '@bg/game-the-mind';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = theMindModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as TheMindState;
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

describe('the mind rules', () => {
  it('setup: level 1, one card each, lives = players, one star, levels by player count', () => {
    const s = st(game(3));
    expect(s.hands.map((h) => h.length)).toEqual([1, 1, 1]);
    expect([s.lives, s.stars, s.levels]).toEqual([3, 1, 10]);
    expect(st(game(2)).levels).toBe(12);
    expect(st(game(4)).levels).toBe(8);
  });

  it('anyone plays their lowest card at any time; a wrong order costs a life and discards lower cards', () => {
    let snap = game(3);
    st(snap).hands = [[10, 40], [20], [30, 50]];
    snap = act(snap, 2, { type: 'play' }); // 30 while 10 and 20 are held
    const s = st(snap);
    expect(s.lives).toBe(2);
    expect(s.hands).toEqual([[40], [], [50]]);
    expect(s.last).toMatchObject({ kind: 'mistake', seat: 2, card: 30, lost: [{ seat: 0, card: 10 }, { seat: 1, card: 20 }] });
    expect(reject(snap, 1, { type: 'play' })).toBe('NO_CARDS');
    snap = act(snap, 0, { type: 'play' });
    expect(st(snap).lives).toBe(2);
  });

  it('a throwing star needs everyone holding cards; finishing a level deals the next with rewards', () => {
    let snap = game(2);
    Object.assign(st(snap), { level: 2, hands: [[5, 70], [9]], stars: 1 });
    snap = act(snap, 0, { type: 'star', on: true });
    expect(st(snap).hands).toEqual([[5, 70], [9]]);
    snap = act(snap, 1, { type: 'star', on: true });
    expect(st(snap).hands).toEqual([[70], []]);
    expect(st(snap).stars).toBe(0);
    expect(reject(snap, 0, { type: 'star', on: true })).toBe('NO_STARS');
    snap = act(snap, 0, { type: 'play' });
    const s = st(snap);
    expect(s.level).toBe(3);
    expect(s.stars).toBe(1); // reward after level 2
    expect(s.hands.map((h) => h.length)).toEqual([3, 3]);
  });

  it('team outcome: losing the last life loses for everyone; hands stay private; timeouts play the lowest card', () => {
    let snap = game(2);
    Object.assign(st(snap), { lives: 1, hands: [[3], [90]] });
    snap = act(snap, 1, { type: 'play' });
    expect(st(snap).outcome?.placements.map((x) => x.place)).toEqual([2, 2]);
    let t = game(3, 4);
    const v = projectFor(m, t, p(1)).view as TheMindView;
    expect(v.hand).toEqual(st(t).hands[1]);
    expect(v).not.toHaveProperty('hands');
    const low = Math.min(...st(t).hands.flat());
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).pile.at(-1) ?? st(t).last?.card).toBe(low);
    expect(st(t).lives).toBe(3);
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.every((x) => x.place === 2)).toBe(true);
  });

  it('tutorial script is legal and ends in a team win', () => {
    const tu = theMindModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply && theMindModule.pendingSeats(st(snap)).includes(1)) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome).toEqual({ reason: 'win', placements: [{ seat: 0, place: 1, score: 1 }, { seat: 1, place: 1, score: 1 }] });
    expect(st(snap).pile).toEqual([9, 25, 47, 52, 85, 96]);
    expect([st(snap).lives, st(snap).stars]).toEqual([1, 0]);
  });

  it('random games end and replay deterministically; perfect play wins', () => {
    for (let g = 0; g < 30; g++) {
      const rng = createRng({ s: 17 + g });
      const players = 2 + (g % 3);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const perfect = g % 3 === 0;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 5000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const holders = theMindModule.pendingSeats(s);
        const seat = perfect ? holders.sort((a, b) => s.hands[a]![0]! - s.hands[b]![0]!)[0]! : holders[rng.nextInt(holders.length)]!;
        const action = !perfect && rng.nextInt(10) === 0 ? { type: 'star', on: !s.votes[seat] } : { type: 'play' };
        if (action.type === 'star' && action.on && s.stars < 1) continue;
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.lives).toBeGreaterThanOrEqual(0);
        expect(t.stars).toBeGreaterThanOrEqual(0);
      }
      const o = st(snap).outcome!;
      expect(o).not.toBeNull();
      if (perfect) expect(o.reason).toBe('win');
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
