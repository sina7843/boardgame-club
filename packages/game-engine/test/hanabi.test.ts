import { describe, expect, it } from 'vitest';
import { CARDS, hanabiModule, type HanabiState, type HanabiView } from '@bg/game-hanabi';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = hanabiModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as HanabiState;
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
const find = (c: string, r: number, nth = 0) => CARDS.map((x, i) => (x.c === c && x.r === r ? i : -1)).filter((i) => i >= 0)[nth]!;
const fresh = (id: number) => ({ id, color: null, rank: null, notColors: [], notRanks: [] });

describe('hanabi rules', () => {
  it('50 cards; hands of 5 or 4; you never see your own cards', () => {
    expect(CARDS).toHaveLength(50);
    expect(st(game(3)).hands[0]).toHaveLength(5);
    expect(st(game(4)).hands[0]).toHaveLength(4);
    const snap = game(3);
    const v = projectFor(m, snap, p(1)).view as HanabiView;
    expect(v.hands[1]!.every((h) => h.card === null && h.id === -1)).toBe(true);
    expect(v.hands[0]![0]!.card).toEqual(CARDS[st(snap).hands[0]![0]!.id]);
    expect(v).not.toHaveProperty('deck');
  });

  it('clues mark matching and non-matching cards and cost a token; clues must touch a card', () => {
    let snap = game(2, 2);
    const s = st(snap);
    s.current = 0;
    s.hands[1] = [fresh(find('r', 1)), fresh(find('b', 1)), fresh(find('r', 3))];
    expect(reject(snap, 0, { type: 'clue', to: 1, color: 'g' })).toBe('TOUCHES_NOTHING');
    expect(reject(snap, 0, { type: 'clue', to: 1, color: 'r', rank: 1 })).toBe('COLOUR_OR_NUMBER');
    snap = act(snap, 0, { type: 'clue', to: 1, color: 'r' });
    const h = st(snap).hands[1]!;
    expect(h.map((x) => x.color)).toEqual(['r', null, 'r']);
    expect(h[1]!.notColors).toEqual(['r']);
    expect(st(snap).clues).toBe(7);
    expect(st(snap).last?.touched).toEqual([0, 2]);
  });

  it('plays build stacks or burn fuses; discards regain clues; three fuses lose for the team', () => {
    let snap = game(2, 3);
    const s = st(snap);
    s.current = 0; s.clues = 5;
    s.hands[0] = [fresh(find('g', 1)), fresh(find('g', 3)), fresh(find('y', 2))];
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).stacks.g).toBe(1);
    expect(st(snap).hands[0]).toHaveLength(3); // drew a replacement
    snap = act(snap, 1, { type: 'discard', index: 0 });
    expect(st(snap).clues).toBe(6);
    st(snap).fuses = 1;
    st(snap).hands[0]![0] = fresh(find('w', 4));
    snap = act(snap, 0, { type: 'play', index: 0 });
    expect(st(snap).outcome?.placements.every((x) => x.place === 2)).toBe(true);
  });

  it('the deck running out gives everyone one more turn; timeouts discard; resign loses', () => {
    let snap = game(2, 4);
    const s = st(snap);
    s.current = 0; s.clues = 5;
    s.deck = s.deck.slice(0, 1);
    snap = act(snap, 0, { type: 'discard', index: 0 });
    expect(st(snap).finalLeft).toBe(2);
    snap = act(snap, 1, { type: 'discard', index: 0 });
    snap = act(snap, 0, { type: 'discard', index: 0 });
    expect(st(snap).outcome?.reason).toBe('win');
    let t = game(3, 5);
    st(t).clues = 7;
    const c = st(t).current;
    t = (applyTimeout(m, t, 0) as StepResult).snapshot;
    expect(st(t).discard).toHaveLength(1);
    expect(st(t).timeouts[c]).toBe(1);
    expect(reject(game(3), st(game(3)).current, { type: 'discard', index: 0 })).toBe('CLUES_FULL');
    const r = act(game(3), 0, { type: 'resign' });
    expect(st(r).outcome?.placements.every((x) => x.place === 2)).toBe(true);
  });

  it('tutorial script is legal and ends in a team win', () => {
    const tu = hanabiModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step of tu.steps) {
      snap = act(snap, 0, step.expected);
      if (step.reply) snap = act(snap, 1, step.reply);
    }
    expect(st(snap).outcome).toMatchObject({ reason: 'win', placements: [{ seat: 0, place: 1, score: 6 }, { seat: 1, place: 1, score: 6 }] });
  });

  it('random games end and replay deterministically', () => {
    for (let g = 0; g < 25; g++) {
      const rng = createRng({ s: 67 + g });
      const players = 2 + (g % 4);
      const setup = { playerCount: players, seed: g, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: { kind: 'action'; actor: ReturnType<typeof p>; action: unknown; logicalTime: number }[] = [];
      for (let n = 0; n < 2000 && !st(snap).outcome; n++) {
        const s = st(snap);
        const seat = s.current;
        const k = rng.nextInt(3);
        const to = (seat + 1) % players;
        let action: unknown;
        if (k === 0 && s.clues > 0) action = { type: 'clue', to, rank: CARDS[s.hands[to]![0]!.id]!.r };
        else if (k === 1 && s.clues < 8) action = { type: 'discard', index: rng.nextInt(s.hands[seat]!.length) };
        else {
          const playable = s.hands[seat]!.findIndex((h) => s.stacks[CARDS[h.id]!.c] === CARDS[h.id]!.r - 1);
          action = { type: 'play', index: playable >= 0 && rng.nextInt(4) ? playable : rng.nextInt(s.hands[seat]!.length) };
        }
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
        const t = st(snap);
        expect(t.deck.length + t.hands.flat().length + t.discard.length + Object.values(t.stacks).reduce((a, b) => a + b, 0)).toBe(50);
      }
      expect(st(snap).outcome).not.toBeNull();
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);
});
