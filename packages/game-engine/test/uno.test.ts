import { describe, expect, it } from 'vitest';
import { buildDeck, canPlay, cardPoints, unoModule, type Card, type UnoState, type UnoView } from '@bg/game-uno';
import { applyAction, applyTimeout, projectFor, replay, startGame, type EngineSnapshot, type StepResult } from '../src/index.ts';

const m = unoModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as UnoState;
const view = (s: EngineSnapshot, seat: number | null) =>
  projectFor(m, s, seat === null ? { kind: 'spectator' } : p(seat)).view as UnoView;
const legal = (s: EngineSnapshot, seat: number) => projectFor(m, s, p(seat)).legalActions;
const card = (id: string): Card => buildDeck().find((c) => c.id === id)!;

function act(snap: EngineSnapshot, seat: number, action: unknown): StepResult {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(r.errorCode);
  return r;
}
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};

/** A started game with hands, discard top, draw pile (last = next drawn) and turn set explicitly. */
function arrange(players: number, o: { hands: string[][]; top: string; draw?: string[]; current?: number; color?: UnoState['color']; options?: Record<string, unknown> }): EngineSnapshot {
  const snap = startGame(m, { playerCount: players, seed: 5, options: o.options ?? { matchLength: 'points500' } }).snapshot;
  const s = structuredClone(st(snap));
  const used = new Set([...o.hands.flat(), o.top, ...(o.draw ?? [])]);
  s.hands = o.hands.map((h) => h.map(card));
  s.discard = [card(o.top)];
  s.draw = [...buildDeck().filter((c) => !used.has(c.id)), ...(o.draw ?? []).map(card)];
  s.color = o.color ?? card(o.top).color;
  s.current = o.current ?? 0;
  s.direction = 1;
  s.phase = 'play';
  s.wd4 = null;
  s.unoWindow = null;
  return { ...snap, state: s };
}

describe('uno deck and matching', () => {
  it('108 cards: per colour one 0, two of 1–9, two Skip/Reverse/Draw 2; four Wild and four Wild Draw 4', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
    for (const color of ['r', 'y', 'g', 'b']) expect(deck.filter((c) => c.color === color)).toHaveLength(25);
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'wd4')).toHaveLength(4);
    expect(deck.reduce((a, c) => a + cardPoints(c), 0)).toBe(4 * (45 * 2) + 4 * 6 * 20 + 8 * 50);
  });

  it('match by colour, number or symbol; Wild cards always', () => {
    expect(canPlay(card('r3a'), card('r7a'), 'r')).toBe(true);
    expect(canPlay(card('g7a'), card('r7a'), 'r')).toBe(true);
    expect(canPlay(card('g8a'), card('r7a'), 'r')).toBe(false);
    expect(canPlay(card('gskipa'), card('rskipb'), 'r')).toBe(true);
    expect(canPlay(card('gd2a'), card('rskipb'), 'r')).toBe(false);
    expect(canPlay(card('wd41'), card('r7a'), 'r')).toBe(true);
    // After a Wild the chosen colour counts, not the Wild's own (none).
    expect(canPlay(card('b2a'), card('wild1'), 'b')).toBe(true);
    expect(canPlay(card('g2a'), card('wild1'), 'b')).toBe(false);
  });
});

describe('uno setup', () => {
  it('deals 7 to each of 2–10 players, never starts on Wild Draw 4, is deterministic per seed', () => {
    for (const n of [2, 4, 10]) {
      const s = st(startGame(m, { playerCount: n, seed: 21, options: {} }).snapshot);
      expect(s.hands.every((h) => h.length === 7 || h.length === 9)).toBe(true); // 9 = start Draw 2 victim
      expect(s.discard.at(-1)!.kind).not.toBe('wd4');
      expect(s.hands.flat().length + s.draw.length + s.discard.length).toBe(108);
    }
    for (let seed = 0; seed < 300; seed++) expect(st(startGame(m, { playerCount: 3, seed, options: {} }).snapshot).discard.at(-1)!.kind).not.toBe('wd4');
    expect(startGame(m, { playerCount: 3, seed: 9, options: {} }).snapshot).toEqual(startGame(m, { playerCount: 3, seed: 9, options: {} }).snapshot);
    expect(() => startGame(m, { playerCount: 11, seed: 1 })).toThrow();
  });

  it('start-card effects follow the rulebook', () => {
    const kinds = new Map<string, UnoState>();
    for (let seed = 0; seed < 2000 && kinds.size < 5; seed++) {
      const s = st(startGame(m, { playerCount: 4, seed, options: {} }).snapshot);
      const k = s.discard[0]!.kind;
      if (!kinds.has(k)) kinds.set(k, s);
    }
    const left = (s: UnoState, from: number) => (from + 1) % 4;
    const d2 = kinds.get('d2')!;
    expect(d2.hands[left(d2, d2.dealer)]).toHaveLength(9);
    expect(d2.current).toBe(left(d2, left(d2, d2.dealer)));
    const skip = kinds.get('skip')!;
    expect(skip.current).toBe(left(skip, left(skip, skip.dealer)));
    const rev = kinds.get('rev')!;
    expect(rev.direction).toBe(-1);
    expect(rev.current).toBe((rev.dealer + 3) % 4); // player to the dealer's right
    const wild = kinds.get('wild')!;
    expect(wild.phase).toBe('chooseColor');
    expect(wild.current).toBe(left(wild, wild.dealer));
  });
});

describe('uno turns', () => {
  it('plays a matching card, rejects mismatches, out-of-turn moves and missing/extra colours', () => {
    const s = arrange(3, { hands: [['r3a', 'g8a', 'wild1', 'b2a'], ['y1a'], ['y2a']], top: 'r7a' });
    expect(reject(s, 0, { type: 'play', card: 'g8a' })).toBe('CARD_DOES_NOT_MATCH');
    expect(reject(s, 1, { type: 'play', card: 'y1a' })).toBe('NOT_YOUR_TURN');
    expect(reject(s, 0, { type: 'play', card: 'wild1' })).toBe('COLOR_REQUIRED');
    expect(reject(s, 0, { type: 'play', card: 'r3a', color: 'g' })).toBe('COLOR_NOT_ALLOWED');
    expect(reject(s, 0, { type: 'play', card: 'y1a' })).toBe('CARD_NOT_IN_HAND');
    const r = act(s, 0, { type: 'play', card: 'wild1', color: 'g' });
    expect(st(r.snapshot)).toMatchObject({ color: 'g', current: 1 });
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
  });

  it('draw: an unplayable card passes; a playable one may be played (only it) or kept', () => {
    const passing = act(arrange(3, { hands: [['g8a', 'b9a'], ['y1a'], ['y2a']], top: 'r7a', draw: ['y3a'] }), 0, { type: 'draw' });
    expect(st(passing.snapshot)).toMatchObject({ current: 1, phase: 'play' });
    expect(st(passing.snapshot).hands[0]).toHaveLength(3);

    const drawn = act(arrange(3, { hands: [['r1a', 'b9a'], ['y1a'], ['y2a']], top: 'r7a', draw: ['r4a'] }), 0, { type: 'draw' });
    expect(st(drawn.snapshot)).toMatchObject({ phase: 'drawn', drawnId: 'r4a', current: 0 });
    expect(view(drawn.snapshot, 0).drawnId).toBe('r4a');
    expect(view(drawn.snapshot, 1).drawnId).toBeNull(); // only the drawer learns it
    expect(reject(drawn.snapshot, 0, { type: 'play', card: 'r1a' })).toBe('ONLY_DRAWN_CARD');
    expect(st(act(drawn.snapshot, 0, { type: 'play', card: 'r4a' }).snapshot).current).toBe(1);
    expect(st(act(drawn.snapshot, 0, { type: 'keep' }).snapshot)).toMatchObject({ current: 1, phase: 'play' });
  });

  it('Skip, Reverse and Draw 2 with three players', () => {
    const base = { hands: [['rskipa', 'rreva', 'rd2a', 'r1a'], ['y1a', 'y2a'], ['y3a', 'y4a']], top: 'r7a' };
    expect(st(act(arrange(3, base), 0, { type: 'play', card: 'rskipa' }).snapshot).current).toBe(2);
    const rev = st(act(arrange(3, base), 0, { type: 'play', card: 'rreva' }).snapshot);
    expect(rev).toMatchObject({ direction: -1, current: 2 });
    const d2 = st(act(arrange(3, base), 0, { type: 'play', card: 'rd2a' }).snapshot);
    expect(d2.hands[1]).toHaveLength(4);
    expect(d2.current).toBe(2);
  });

  it('two players: Reverse and Skip let you play again; after Draw 2 play is back to you', () => {
    const base = { hands: [['rskipa', 'rreva', 'rd2a', 'r1a'], ['y1a', 'y2a']], top: 'r7a' };
    expect(st(act(arrange(2, base), 0, { type: 'play', card: 'rskipa' }).snapshot).current).toBe(0);
    expect(st(act(arrange(2, base), 0, { type: 'play', card: 'rreva' }).snapshot).current).toBe(0);
    const d2 = st(act(arrange(2, base), 0, { type: 'play', card: 'rd2a' }).snapshot);
    expect(d2.hands[1]).toHaveLength(4);
    expect(d2.current).toBe(0);
  });

  it('reshuffles the discard pile (keeping its top card) when the draw pile is empty', () => {
    const s = arrange(2, { hands: [['g8a'], ['y1a']], top: 'r7a' });
    const state = structuredClone(st(s));
    state.discard = [card('b1a'), card('b2a'), card('r7a')];
    state.draw = [];
    const r = st(act({ ...s, state }, 0, { type: 'draw' }).snapshot);
    expect(r.discard.map((c) => c.id)).toEqual(['r7a']);
    expect(r.hands[0]).toHaveLength(2);
    expect(r.draw).toHaveLength(1);
  });
});

describe('uno Wild Draw 4 and challenges', () => {
  // Seat 0 plays Wild Draw 4 on red 7 while holding (legal) or not holding (illegal) another red card.
  const setup = (legalPlay: boolean) => {
    const s = arrange(3, { hands: [legalPlay ? ['wd41', 'g1a', 'b2a'] : ['wd41', 'r1a', 'b2a'], ['y1a', 'y2a'], ['y3a', 'y4a']], top: 'r7a' });
    return act(s, 0, { type: 'play', card: 'wd41', color: 'b' });
  };

  it('target decides: accepting draws 4 and loses the turn', () => {
    const r = setup(true);
    expect(st(r.snapshot)).toMatchObject({ phase: 'wd4', current: 1 });
    expect(legal(r.snapshot, 1).map((a) => a.type)).toEqual(expect.arrayContaining(['accept', 'challenge']));
    expect(reject(r.snapshot, 2, { type: 'challenge' })).toBe('NOT_YOUR_TURN'); // only the victim may challenge
    const a = st(act(r.snapshot, 1, { type: 'accept' }).snapshot);
    expect(a.hands[1]).toHaveLength(6);
    expect(a.current).toBe(2);
  });

  it('challenge of a legal play: challenger draws 6 and loses the turn; sees the hand privately', () => {
    const c = act(setup(true).snapshot, 1, { type: 'challenge' });
    const s = st(c.snapshot);
    expect(s.hands[1]).toHaveLength(8);
    expect(s.current).toBe(2);
    expect(view(c.snapshot, 1).reveal?.cards.map((x) => x.id).sort()).toEqual(['b2a', 'g1a']);
    expect(view(c.snapshot, 2).reveal).toBeNull();
    expect(view(c.snapshot, null).reveal).toBeNull();
  });

  it('challenge of an illegal play: offender draws 4 and the challenger plays normally', () => {
    const s = st(act(setup(false).snapshot, 1, { type: 'challenge' }).snapshot);
    expect(s.hands[0]).toHaveLength(6);
    expect(s.hands[1]).toHaveLength(2);
    expect(s.current).toBe(1);
  });
});

describe('uno call and catch', () => {
  const twoLeft = () => arrange(3, { hands: [['r1a', 'r2a'], ['y1a', 'y2a'], ['y3a', 'y4a']], top: 'r7a', draw: ['b5a', 'b6a', 'b7a', 'b8a', 'g9a'] });

  it('calling UNO with the next-to-last card leaves nothing to catch', () => {
    const r = act(twoLeft(), 0, { type: 'play', card: 'r1a', uno: true });
    expect(st(r.snapshot).unoWindow).toBeNull();
    expect(legal(r.snapshot, 1).some((a) => a.type === 'catch')).toBe(false);
  });

  it('forgetting UNO: another player can catch before the next turn begins → penalty cards (4 by default)', () => {
    const r = act(twoLeft(), 0, { type: 'play', card: 'r1a' });
    expect(view(r.snapshot, 2).unoWindow).toBe(0);
    expect(legal(r.snapshot, 2)).toContainEqual({ type: 'catch', seat: 0 });
    const caught = act(r.snapshot, 2, { type: 'catch', seat: 0 });
    expect(st(caught.snapshot).hands[0]).toHaveLength(5);
    expect(caught.scheduleChanges).toEqual([]); // the current player's clock keeps running
  });

  it('the penalty variant can be 2 cards', () => {
    const s = arrange(3, { hands: [['r1a', 'r2a'], ['y1a'], ['y3a']], top: 'r7a', options: { unoPenalty: 2 } });
    const r = act(act(s, 0, { type: 'play', card: 'r1a' }).snapshot, 1, { type: 'catch', seat: 0 });
    expect(st(r.snapshot).hands[0]).toHaveLength(3);
  });

  it('catching yourself first is safe; the window closes once the next player begins', () => {
    const r = act(twoLeft(), 0, { type: 'play', card: 'r1a' });
    const self = act(r.snapshot, 0, { type: 'callUno' });
    expect(reject(self.snapshot, 2, { type: 'catch', seat: 0 })).toBe('CANNOT_CATCH');
    const begun = act(r.snapshot, 1, { type: 'draw' });
    expect(reject(begun.snapshot, 2, { type: 'catch', seat: 0 })).toBe('CANNOT_CATCH');
  });
});

describe('uno hands, scoring and match end', () => {
  it('going out scores the cards left in the other hands, then a new hand is dealt by the next dealer', () => {
    const s = arrange(3, { hands: [['r1a'], ['yskipa', 'y5a'], ['wild1', 'g9a']], top: 'r7a' });
    const r = st(act(s, 0, { type: 'play', card: 'r1a' }).snapshot);
    expect(r.scores).toEqual([20 + 5 + 50 + 9, 0, 0]);
    expect(r.hand).toBe(2);
    expect(r.hands.flat().length + r.draw.length + r.discard.length).toBe(108);
    expect(r.log.some((e) => e.t === 'handEnd' && e.winner === 0 && e.points === 84)).toBe(true);
  });

  it('a final Draw 2 still makes the next player draw before scoring', () => {
    const s = arrange(2, { hands: [['rd2a'], ['y5a']], top: 'r7a', draw: ['g1a', 'g2a'], options: { matchLength: 'oneHand' } });
    const r = act(s, 0, { type: 'play', card: 'rd2a' });
    expect(st(r.snapshot).scores[0]).toBe(5 + 1 + 2);
    expect(r.outcome).toMatchObject({ reason: 'score', placements: [{ seat: 0, place: 1 }, { seat: 1, place: 2 }] });
  });

  it('reaching the target ends the match ranked by score', () => {
    const s = arrange(3, { hands: [['r1a'], ['wild1'], ['g1a']], top: 'r7a', options: { matchLength: 'points200' } });
    const state = structuredClone(st(s));
    state.scores = [180, 150, 10];
    const r = act({ ...s, state }, 0, { type: 'play', card: 'r1a' });
    expect(r.outcome?.placements).toEqual([{ seat: 0, score: 231, place: 1 }, { seat: 1, score: 150, place: 2 }, { seat: 2, score: 10, place: 3 }]);
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
  });
});

describe('uno timeouts, leaving and hidden information', () => {
  it('timeout draws a card and passes; three in a row removes the player; last one standing wins', () => {
    let snap = arrange(3, { hands: [['g8a'], ['y1a'], ['y2a']], top: 'r7a' });
    const t1 = applyTimeout(m, snap, 0);
    expect(st(t1.snapshot)).toMatchObject({ current: 1 });
    expect(st(t1.snapshot).hands[0]).toHaveLength(2);
    const state = structuredClone(st(snap));
    state.timeouts = [2, 0, 0];
    snap = { ...snap, state };
    const out = st(applyTimeout(m, snap, 0).snapshot);
    expect(out.active).toEqual([false, true, true]);
    expect(out.hands[0]).toEqual([]);
    const r = act({ ...snap, state: out }, 1, { type: 'resign' });
    expect(r.outcome?.placements.find((x) => x.place === 1)?.seat).toBe(2);
  });

  it('a timeout on a pending Wild Draw 4 means accepting it', () => {
    const s = act(arrange(3, { hands: [['wd41', 'g1a'], ['y1a'], ['y3a']], top: 'r7a' }), 0, { type: 'play', card: 'wd41', color: 'b' });
    const t = st(applyTimeout(m, s.snapshot, 0).snapshot);
    expect(t.hands[1]).toHaveLength(5);
    expect(t.current).toBe(2);
  });

  it('views never contain other hands, the draw pile order or the drawn card of someone else', () => {
    const snap = startGame(m, { playerCount: 4, seed: 33, options: {} }).snapshot;
    const s = st(snap);
    for (const seat of [0, 1, 2, 3, null]) {
      const v = view(snap, seat);
      const json = JSON.stringify(v);
      expect(json).not.toContain('"draw":');
      expect(json).not.toContain('"hands"');
      for (let other = 0; other < 4; other++) {
        if (other === seat) continue;
        // No card id unique to another hand appears in this view (except the public discard/log top card).
        const publicIds = new Set([s.discard.at(-1)!.id]);
        for (const c of s.hands[other]!) if (!publicIds.has(c.id)) expect(json).not.toContain(`"${c.id}"`);
      }
      expect(v.handCounts.reduce((a, b) => a + b, 0)).toBe(s.hands.flat().length);
    }
    expect(view(snap, null).myHand).toBeNull();
  });
});

describe('uno determinism and tutorial', () => {
  it('replay from seed + inputs reproduces the exact state', () => {
    let snap = startGame(m, { playerCount: 3, seed: 77, options: {} }).snapshot;
    const inputs: Parameters<typeof replay>[2] = [];
    for (let i = 0; i < 40 && !st(snap).outcome; i++) {
      const s = st(snap);
      const seat = s.current;
      const hints = legal(snap, seat).filter((a) => a.type !== 'resign' && a.type !== 'callUno' && a.type !== 'catch' && a.type !== 'challenge');
      const h = hints[0]!;
      const action = h.type === 'play' ? { type: 'play', card: h.card, ...(h.needsColor ? { color: 'g' } : {}), uno: true } : { type: h.type, ...(h.color ? { color: h.color } : {}) };
      snap = act(snap, seat, action).snapshot;
      inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: 0 });
    }
    expect(replay(m, { playerCount: 3, seed: 77, options: {} }, inputs)).toEqual(snap);
  });

  it('the scripted tutorial is legal step by step and ends with the learner winning', () => {
    const t = unoModule.tutorial;
    let snap = startGame(m, { playerCount: 2, seed: t.seed, options: t.options }).snapshot;
    for (const step of t.steps) {
      snap = act(snap, 0, step.expected).snapshot;
      if (step.reply) snap = act(snap, 1, step.reply).snapshot;
    }
    expect(st(snap).outcome?.placements.find((x) => x.place === 1)?.seat).toBe(0);
  });
});
