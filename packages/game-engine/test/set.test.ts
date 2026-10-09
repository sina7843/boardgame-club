import { describe, expect, it } from 'vitest';
import { attrs, findSet, isSet, set, setModule, third, type SetState, type SetView } from '@bg/game-set';
import { applyAction, applyTimeout, createRng, projectFor, replay, startGame, type EngineSnapshot, type ReplayInput, type StepResult } from '../src/index.ts';

const m = setModule as never;
const p = (seat: number) => ({ kind: 'player' as const, seat });
const st = (s: EngineSnapshot) => s.state as SetState;
const game = (players = 2, seed = 1) => startGame(m, { playerCount: players, seed, options: {} }).snapshot;
const step = (snap: EngineSnapshot, seat: number, action: unknown): StepResult => {
  const r = applyAction(m, snap, p(seat), action, 0);
  if ('ok' in r) throw new Error(`${JSON.stringify(action)}: ${r.errorCode}`);
  return r;
};
const act = (snap: EngineSnapshot, seat: number, action: unknown) => step(snap, seat, action).snapshot;
const reject = (snap: EngineSnapshot, seat: number, action: unknown) => {
  const r = applyAction(m, snap, p(seat), action, 0);
  return 'ok' in r ? r.errorCode : 'ACCEPTED';
};
const claim = (cards: number[]) => ({ type: 'claim', cards: [...cards].sort((a, b) => a - b) });
const notSet = (table: number[]) => {
  for (let i = 0; i < table.length; i++) for (let j = i + 1; j < table.length; j++) for (let k = j + 1; k < table.length; k++)
    if (!isSet(table[i]!, table[j]!, table[k]!)) return [table[i]!, table[j]!, table[k]!];
  throw new Error('every triple is a set');
};
const all = (s: SetState) => [...s.deck, ...s.table, ...s.sets.flat(2)];

describe('set rules', () => {
  it('card maths: 81 cards, each pair has exactly one completing card', () => {
    expect(attrs(80)).toEqual([2, 2, 2, 2]);
    expect(isSet(0, 40, 80)).toBe(true);
    expect(isSet(19, 22, 25)).toBe(true);
    expect(isSet(13, 19, 42)).toBe(false);
    expect(isSet(0, 0, 0)).toBe(false);
    for (let a = 0; a < 81; a++) for (let b = a + 1; b < 81; b++) {
      const c = third(a, b);
      expect(c !== a && c !== b && isSet(a, b, c)).toBe(true);
    }
    expect(findSet([0, 1, 3, 4])).toBeNull(); // 0,1 → 2 missing; 0,3 → 6; no set
    expect(findSet([5, 0, 40, 80])).toEqual([0, 40, 80]);
  });

  it('setup deals 12 (more only when no set) for 2–8 players, shuffled by the seed', () => {
    for (let n = 2; n <= 8; n++) {
      const s = st(game(n, n));
      expect(s.table.length).toBeGreaterThanOrEqual(12);
      expect(s.table.length % 3).toBe(0);
      expect(findSet(s.table)).not.toBeNull();
      expect(all(s).sort((a, b) => a - b)).toEqual(Array.from({ length: 81 }, (_, i) => i));
      expect(s.sets).toHaveLength(n);
      expect(startGame(m, { playerCount: n, seed: n, options: {} }).pendingSeats).toEqual(Array.from({ length: n }, (_, i) => i));
    }
    expect(st(game(2, 1)).table).not.toEqual(st(game(2, 2)).table);
    expect(st(game(2, 5))).toEqual(st(game(2, 5)));
    expect(() => startGame(m, { playerCount: 1, seed: 1 })).toThrow();
    expect(() => startGame(m, { playerCount: 9, seed: 1 })).toThrow();
  });

  it('a valid claim scores, refills the same slots and resets the idle deadline', () => {
    const snap = game(3, 4);
    const s = st(snap);
    const found = findSet(s.table)!;
    const slots = found.map((c) => s.table.indexOf(c));
    const r = step(snap, 2, claim(found));
    const t = st(r.snapshot);
    expect(t.sets[2]).toEqual([[...found].sort((a, b) => a - b)]);
    expect(t.table).toHaveLength(12);
    for (const i of slots) expect(t.table[i]).toBe(s.deck[slots.indexOf(i)]);
    expect(t.deck).toHaveLength(s.deck.length - 3);
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    expect(projectFor(m, r.snapshot, p(0)).view as SetView).toMatchObject({ scores: [0, 0, 1], last: { kind: 'set', seat: 2 } });
  });

  it('a wrong claim costs one point and changes no cards; illegal claims are rejected without mutation', () => {
    const snap = game(2, 6);
    const before = structuredClone(snap);
    const s = st(snap);
    const off = Array.from({ length: 81 }, (_, i) => i).find((c) => !s.table.includes(c))!;
    expect(reject(snap, 0, { type: 'claim', cards: [s.table[0], s.table[1], off] })).toBe('CARD_NOT_ON_TABLE');
    expect(reject(snap, 0, { type: 'claim', cards: [s.table[0], s.table[0], s.table[1]] })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'claim', cards: [s.table[0], s.table[1]] })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'claim', cards: [1, 2, 99] })).toBe('INVALID_ACTION');
    expect(reject(snap, 0, { type: 'claim', cards: [1, 2, 3], actor: 1 })).toBe('INVALID_ACTION');
    expect(reject(snap, 2, claim(findSet(s.table)!))).toBe('NOT_A_PLAYER');
    expect(snap).toEqual(before);
    const r = step(snap, 1, claim(notSet(s.table)));
    const t = st(r.snapshot);
    expect(t.penalties).toEqual([0, 1]);
    expect(t.table).toEqual(s.table);
    expect(r.scheduleChanges).toEqual([]);
    expect((projectFor(m, r.snapshot, p(0)).view as SetView).scores).toEqual([0, -1]);
  });

  it('with more than 12 cards a claim does not refill; with no set three more are dealt', () => {
    const snap = game(2, 8);
    const s = st(snap);
    s.table = [...s.table, ...s.deck.slice(0, 3)];
    s.deck = s.deck.slice(3);
    const deckBefore = s.deck.slice();
    const t = st(act(snap, 0, claim(findSet(s.table)!)));
    if (findSet(t.table)) { expect(t.table).toHaveLength(12); expect(t.deck).toEqual(deckBefore); }
    // 12 left with no set after the refill → +3 are dealt automatically.
    const cap = [0, 1, 3, 4, 9, 10, 12, 13, 27, 28, 30, 31]; // a 12-card cap: no three form a set
    expect(findSet(cap)).toBeNull();
    const snap2 = game(2, 8);
    const s2 = st(snap2);
    s2.table = [...cap.slice(0, 9), 2, 5, 8];
    s2.deck = [...cap.slice(9), ...Array.from({ length: 81 }, (_, i) => i).filter((c) => !cap.includes(c) && ![2, 5, 8].includes(c))];
    const u = st(act(snap2, 1, claim([2, 5, 8])));
    expect(u.table.slice(0, 12)).toEqual(cap);
    expect(u.table.length).toBeGreaterThanOrEqual(15);
    expect(findSet(u.table)).not.toBeNull();
    expect(u.deck).toHaveLength(81 - 12 - 3 - (u.table.length - 12));
    // A miss never deals.
    const snap3 = game(2, 8);
    st(snap3).table = cap.slice(0, 9).concat([2, 5, 8]);
    const v = st(act(snap3, 0, claim([0, 1, 3])));
    expect(v.table).toEqual(st(snap3).table);
    expect(v.penalties[0]).toBe(1);
  });

  it('regression: from 18 cards a set shrinks the table to 15 (no refill), and the rules text says so', () => {
    const cap = [0, 1, 3, 4, 9, 10, 12, 13, 27, 28, 30, 31];
    const snap = game(2, 8);
    const s = st(snap);
    s.table = [...cap, 2, 5, 8, 78, 79, 80];
    s.deck = Array.from({ length: 81 }, (_, i) => i).filter((c) => !s.table.includes(c)).slice(0, 9);
    const deck = s.deck.slice();
    const t = st(act(snap, 0, claim([2, 5, 8])));
    expect(t.table).toEqual([...cap, 78, 79, 80]);
    expect(t.deck).toEqual(deck);
    const rules = set.catalog.rulesFa.join(' ');
    expect(rules).not.toContain('دوباره به ۱۲ کارت برمی‌گردد');
    expect(rules).toContain('۳ کارت کوچک‌تر');
  });

  it('the game ends when the deck is out and no set remains; most points wins, ties share', () => {
    const snap = game(3, 9);
    const s = st(snap);
    s.table = [0, 40, 80, 1, 3, 4]; // one set + a leftover with no set
    s.deck = [];
    s.sets = [[[5, 6, 7]], [[9, 10, 11]], []];
    const r = step(snap, 2, claim([0, 40, 80]));
    expect(r.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 1 }, { seat: 1, place: 1, score: 1 }, { seat: 2, place: 1, score: 1 }] });
    expect(r.scheduleChanges).toEqual([{ kind: 'clear', deadlineKey: 'turn' }]);
    expect(r.pendingSeats).toEqual([]);
    expect(reject(r.snapshot, 0, claim([1, 3, 4]))).toBe('GAME_FINISHED');
    expect(projectFor(m, r.snapshot, p(0)).legalActions).toEqual([]);
    const snap2 = game(3, 9);
    const s2 = st(snap2);
    s2.table = [0, 40, 80, 1, 3, 4]; s2.deck = []; s2.penalties = [0, 2, 0];
    const r2 = step(snap2, 0, claim([0, 40, 80]));
    expect(r2.outcome!.placements).toEqual([{ seat: 0, place: 1, score: 1 }, { seat: 2, place: 2, score: 0 }, { seat: 1, place: 3, score: -2 }]);
  });

  it('idle timeout discards the first set unscored and keeps the game going', () => {
    const snap = game(2, 10);
    const s = st(snap);
    const first = [...findSet(s.table)!].sort((a, b) => a - b);
    const r = applyTimeout(m, snap, 0);
    const t = st(r.snapshot);
    expect(t.table.some((c) => first.includes(c))).toBe(false);
    expect(t.sets).toEqual([[], []]);
    expect(t.penalties).toEqual([0, 0]);
    expect(t.last).toEqual({ kind: 'timeout', seat: null, cards: first });
    expect(r.scheduleChanges).toEqual([{ kind: 'set', deadlineKey: 'turn' }]);
    // Repeated timeouts alone finish the game (each burns 3 cards).
    let x = snap;
    for (let n = 0; n < 40 && !st(x).outcome; n++) x = applyTimeout(m, x, 0).snapshot;
    expect(st(x).outcome?.placements).toEqual([{ seat: 0, place: 1, score: 0 }, { seat: 1, place: 1, score: 0 }]);
  });

  it('resign: the resigner is out and ranked last; the last player standing wins', () => {
    let snap = game(3, 11);
    const r1 = step(snap, 1, { type: 'resign' });
    snap = r1.snapshot;
    expect(r1.outcome).toBeNull();
    expect(r1.pendingSeats).toEqual([0, 2]);
    expect(reject(snap, 1, claim(findSet(st(snap).table)!))).toBe('ALREADY_RESIGNED');
    expect(projectFor(m, snap, p(1)).legalActions).toEqual([]);
    snap = act(snap, 0, claim(findSet(st(snap).table)!));
    const r2 = step(snap, 2, { type: 'resign' });
    expect(r2.outcome).toEqual({ reason: 'resign', placements: [{ seat: 0, place: 1, score: 1 }, { seat: 2, place: 2, score: 0 }, { seat: 1, place: 3, score: 0 }] });
    const two = step(game(2, 1), 0, { type: 'resign' });
    expect(two.outcome?.placements).toEqual([{ seat: 1, place: 1, score: 0 }, { seat: 0, place: 2, score: 0 }]);
  });

  it('projection never reveals the deck order or the sets on the table', () => {
    const snap = game(4, 12);
    const s = st(snap);
    for (const viewer of [p(0), p(3), { kind: 'spectator' as const }]) {
      const { view, legalActions } = projectFor(m, snap, viewer);
      const json = JSON.stringify(view);
      expect(view).not.toHaveProperty('deck');
      expect(json).not.toContain(JSON.stringify(s.deck.slice(0, 3)).slice(1, -1));
      expect((view as SetView).deckCount).toBe(s.deck.length);
      expect((view as SetView).table).toEqual(s.table);
      expect(JSON.stringify(legalActions)).not.toMatch(/\[\d/);
    }
    expect(projectFor(m, snap, { kind: 'spectator' }).legalActions).toEqual([]);
    expect(projectFor(m, snap, p(1)).view).toEqual(projectFor(m, snap, { kind: 'spectator' }).view);
  });

  it('random games (2–8 players, races, misses, timeouts, resigns) terminate validly and replay exactly', () => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng({ s: 900 + g });
      const players = 2 + (g % 7);
      const setup = { playerCount: players, seed: 31 * g + 1, options: {} };
      let snap = startGame(m, setup).snapshot;
      const inputs: ReplayInput[] = [];
      for (let n = 0; n < 400 && !st(snap).outcome; n++) {
        const s = st(snap);
        const live = s.resigned.flatMap((r, i) => (r ? [] : [i]));
        const roll = rng.nextInt(100);
        if (roll < 4) { snap = applyTimeout(m, snap, n).snapshot; inputs.push({ kind: 'timeout', logicalTime: n }); continue; }
        const free = live.filter((i) => !s.locked[i]);
        const seat = (free.length ? free : live)[rng.nextInt((free.length ? free : live).length)]!;
        const action = roll < 6 && g % 5 === 0 ? { type: 'resign' } : roll < 18 ? claim(notSet(s.table)) : claim(findSet(s.table)!);
        snap = act(snap, seat, action);
        inputs.push({ kind: 'action', actor: p(seat), action, logicalTime: n });
        expect(new Set(all(st(snap))).size).toBe(all(st(snap)).length);
      }
      const s = st(snap);
      expect(s.outcome).not.toBeNull();
      expect(s.outcome!.placements.map((x) => x.seat).sort((a, b) => a - b)).toEqual(Array.from({ length: players }, (_, i) => i));
      if (s.outcome!.reason === 'score') { expect(s.deck).toEqual([]); expect(findSet(s.table)).toBeNull(); }
      expect(replay(m, setup, inputs)).toEqual(snap);
    }
  }, 120_000);

  it('regression: a wrong claim locks the claimant out until the board changes, so misses cannot be spammed', () => {
    const snap = game(3, 13);
    const s = st(snap);
    const miss = claim(notSet(s.table));
    let x = act(snap, 1, miss);
    expect(st(x).locked).toEqual([false, true, false]);
    expect(reject(x, 1, miss)).toBe('CLAIM_LOCKED');
    expect(reject(x, 1, claim(findSet(s.table)!))).toBe('CLAIM_LOCKED');
    expect(projectFor(m, x, p(1)).legalActions).toEqual([{ type: 'resign' }]);
    expect((projectFor(m, x, { kind: 'spectator' }).view as SetView).locked).toEqual([false, true, false]);
    // Every active seat missed on this board → everyone is free again.
    x = act(act(x, 0, miss), 2, miss);
    expect(st(x).locked).toEqual([false, false, false]);
    expect(st(x).penalties).toEqual([1, 1, 1]);
    // A set taken (or a timeout) lifts the lock.
    const y = act(snap, 1, miss);
    expect(st(act(y, 0, claim(findSet(s.table)!))).locked).toEqual([false, false, false]);
    expect(st(applyTimeout(m, y, 0).snapshot).locked).toEqual([false, false, false]);
    // Resigning so that only locked seats remain unlocks them.
    const z = act(act(snap, 1, miss), 0, miss);
    expect(st(z).locked).toEqual([true, true, false]);
    expect(st(act(z, 2, { type: 'resign' })).locked).toEqual([false, false, false]);
    expect(set.catalog.rulesFa.join(' ')).toContain('نمی‌توانید دوباره اعلام کنید');
  });

  it('tutorial script is legal and ends with the learner winning 3–0', () => {
    const tu = setModule.tutorial;
    expect(tu.steps.length).toBeGreaterThanOrEqual(3);
    let snap = startGame(m, { playerCount: 2, seed: tu.seed, options: tu.options ?? {} }).snapshot;
    for (const step0 of tu.steps) {
      const r = step(snap, 0, step0.expected);
      snap = r.snapshot;
      if (step0.reply && !r.outcome && r.pendingSeats.includes(1)) snap = act(snap, 1, step0.reply);
    }
    const s = st(snap);
    expect(s.penalties).toEqual([0, 1]);
    expect(s.table).toEqual([70, 13, 57]);
    expect(s.outcome).toEqual({ reason: 'score', placements: [{ seat: 0, place: 1, score: 3 }, { seat: 1, place: 2, score: 0 }] });
  });
});
