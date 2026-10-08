// Go («گو»): Chinese-style area scoring. Black first; a stone without liberties is captured; suicide is illegal;
// positional superko (no move may recreate an earlier whole-board position). Two passes in a row open the scoring
// phase: players mark dead groups (any change clears acceptance), both accept to finish, or either resumes play.
// Score = stones on the board (dead ones removed) + empty points surrounded only by that colour; white gets komi.
// Board: index = y * size + x, y 0 = the top row as seen by black.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { go } from './definition.ts';

export type Stone = 'b' | 'w';
export interface GoState {
  size: number;
  komi: number;
  board: (Stone | null)[];
  turn: Stone;
  /** colors[seat] */
  colors: [Stone, Stone];
  captures: { b: number; w: number };
  /** Board hashes of every earlier position (positional superko). Not projected. */
  seen: string[];
  passes: number;
  phase: 'play' | 'scoring' | 'end';
  /** Scoring phase: indices of stones marked dead, and who accepted the current marking. */
  dead: number[];
  accepted: [boolean, boolean];
  history: { seat: number; at: number | null; captured: number[] }[];
  timeouts: [number, number];
  score: { b: number; w: number; territory: (Stone | null)[] } | null;
  end: { kind: 'score' | 'resign' | 'timeout' } | null;
  outcome: Outcome | null;
}
export type GoView = Omit<GoState, 'seen' | 'timeouts'> & { current: number | null; last: GoState['history'][number] | null; ko: number | null };

const pt = z.number().int().min(0).max(360);
export const goAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), at: pt }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('mark'), at: pt }),
  z.strictObject({ type: z.literal('accept') }),
  z.strictObject({ type: z.literal('resume') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type GoAction = z.infer<typeof goAction>;

const other = (s: Stone): Stone => (s === 'b' ? 'w' : 'b');
export const neighbors = (i: number, size: number) => {
  const x = i % size, y = Math.floor(i / size);
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < size - 1) out.push(i + 1);
  if (y > 0) out.push(i - size);
  if (y < size - 1) out.push(i + size);
  return out;
};

/** The group containing i and its liberties. */
export function group(board: (Stone | null)[], size: number, i: number): { stones: number[]; liberties: Set<number> } {
  const color = board[i];
  const stones: number[] = [];
  const liberties = new Set<number>();
  const seen = new Set([i]);
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    stones.push(j);
    for (const n of neighbors(j, size)) {
      if (board[n] === null) liberties.add(n);
      else if (board[n] === color && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
  }
  return { stones, liberties };
}

const hash = (board: (Stone | null)[]) => board.map((s) => s ?? '.').join('');

/** Result of playing `color` at `at`, or an error code. */
export function play(board: (Stone | null)[], size: number, at: number, color: Stone, seen: string[]): { board: (Stone | null)[]; captured: number[] } | { error: string } {
  if (board[at] !== null) return { error: 'POINT_TAKEN' };
  const b = board.slice();
  b[at] = color;
  const captured: number[] = [];
  for (const n of neighbors(at, size)) {
    if (b[n] === other(color)) {
      const g = group(b, size, n);
      if (g.liberties.size === 0) for (const s of g.stones) { b[s] = null; captured.push(s); }
    }
  }
  if (group(b, size, at).liberties.size === 0) return { error: 'SUICIDE' };
  if (seen.includes(hash(b))) return { error: 'KO' };
  return { board: b, captured };
}

/** Area score with dead stones removed. Territory = empty regions bordered by one colour only. */
export function areaScore(board: (Stone | null)[], size: number, dead: number[], komi: number) {
  const b = board.slice();
  for (const d of dead) b[d] = null;
  const territory: (Stone | null)[] = Array(b.length).fill(null);
  const seen = new Set<number>();
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== null || seen.has(i)) continue;
    const region: number[] = [];
    const borders = new Set<Stone>();
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const j = stack.pop()!;
      region.push(j);
      for (const n of neighbors(j, size)) {
        if (b[n] === null) { if (!seen.has(n)) { seen.add(n); stack.push(n); } }
        else borders.add(b[n]!);
      }
    }
    if (borders.size === 1) { const owner = [...borders][0]!; for (const j of region) territory[j] = owner; }
  }
  const count = (c: Stone) => b.filter((s) => s === c).length + territory.filter((t) => t === c).length;
  return { b: count('b'), w: count('w') + komi, territory };
}

// ---------- module ----------

type Events = Transition<GoState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const seatOf = (s: GoState, c: Stone) => (s.colors[0] === c ? 0 : 1);
const finish = (s: GoState, events: Events): Transition<GoState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function endByScore(s: GoState) {
  const sc = areaScore(s.board, s.size, s.dead, s.komi);
  s.score = sc;
  s.phase = 'end';
  s.end = { kind: 'score' };
  const win = sc.b > sc.w ? 'b' : 'w';
  s.outcome = {
    placements: [0, 1].map((seat) => ({ seat, place: s.colors[seat] === win ? 1 : 2, score: s.colors[seat] === 'b' ? sc.b : sc.w })),
    reason: 'score'
  };
}

function lose(s: GoState, seat: number, kind: 'resign' | 'timeout') {
  s.phase = 'end';
  s.end = { kind };
  s.outcome = { placements: [{ seat: 1 - seat, place: 1 }, { seat, place: 2 }], reason: kind };
}

/** Seats whose decision the game is waiting for. */
const waiting = (s: GoState) => (s.outcome ? [] : s.phase === 'scoring' ? [0, 1].filter((k) => !s.accepted[k]) : [seatOf(s, s.turn)]);

export const goModule: GameModule<GoState, GoAction, GoView> = {
  manifest: go.manifest,
  actionSchema: goAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('go needs exactly 2 players');
    const size = [9, 13, 19].includes(Number(options.size)) ? Number(options.size) : 9;
    const komi = typeof options.komi === 'number' ? options.komi : Number(options.komi ?? 7.5) || 7.5;
    const drawn = rng.nextInt(2);
    const blackSeat = options.firstMove === 'host' ? 0 : drawn;
    const board: (Stone | null)[] = Array(size * size).fill(null);
    if (options.deal === 'tutorial') {
      // 9×9 teaching position: a white stone in atari near the top corner, another one on the left edge.
      for (const i of [1, 9, 11, 27, 45]) board[i] = 'b';
      for (const i of [10, 36]) board[i] = 'w';
    }
    return {
      size, komi, board, turn: 'b', colors: blackSeat === 0 ? ['b', 'w'] : ['w', 'b'], captures: { b: 0, w: 0 },
      seen: [hash(board)], passes: 0, phase: 'play', dead: [], accepted: [false, false], history: [], timeouts: [0, 0],
      score: null, end: null, outcome: null
    };
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.phase === 'scoring') {
      if (a.type === 'mark') return s.board[a.at] ? { ok: true } : { ok: false, errorCode: 'NO_STONE' };
      if (a.type === 'accept') return s.accepted[actor.seat] ? { ok: false, errorCode: 'ALREADY_ACCEPTED' } : { ok: true };
      if (a.type === 'resume') return { ok: true };
      return { ok: false, errorCode: 'WRONG_PHASE' };
    }
    if (a.type === 'mark' || a.type === 'accept' || a.type === 'resume') return { ok: false, errorCode: 'WRONG_PHASE' };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'pass') return { ok: true };
    if (a.at >= s.size * s.size) return { ok: false, errorCode: 'OFF_BOARD' };
    const r = play(s.board, s.size, a.at, s.turn, s.seen);
    return 'error' in r ? { ok: false, errorCode: r.error } : { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { lose(s, seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'mark') {
      // Toggle the whole group; any change needs both players to accept again.
      const g = group(s.board, s.size, a.at).stones;
      const isDead = s.dead.includes(a.at);
      s.dead = isDead ? s.dead.filter((d) => !g.includes(d)) : [...s.dead, ...g];
      s.accepted = [false, false];
    } else if (a.type === 'accept') {
      s.accepted[seat] = true;
      if (s.accepted[0] && s.accepted[1]) endByScore(s);
    } else if (a.type === 'resume') {
      // Play continues with the opponent of the player who resumed.
      s.phase = 'play'; s.dead = []; s.accepted = [false, false]; s.passes = 0;
      s.turn = other(s.colors[seat]!);
    } else if (a.type === 'pass') {
      s.history.push({ seat, at: null, captured: [] });
      s.passes += 1;
      s.turn = other(s.turn);
      if (s.passes >= 2) { s.phase = 'scoring'; s.dead = []; s.accepted = [false, false]; }
    } else {
      const r = play(s.board, s.size, a.at, s.turn, s.seen) as { board: (Stone | null)[]; captured: number[] };
      s.board = r.board;
      s.captures[s.turn] += r.captured.length;
      s.seen.push(hash(s.board));
      s.history.push({ seat, at: a.at, captured: r.captured });
      s.passes = 0;
      s.turn = other(s.turn);
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { seen: _s, timeouts: _t, ...rest } = s;
    void _s; void _t;
    const last = s.history.at(-1) ?? null;
    // Simple ko marker: the point just captured (single stone) is forbidden for the side to move.
    const ko = last && last.captured.length === 1 && s.phase === 'play' && 'error' in play(s.board, s.size, last.captured[0]!, s.turn, s.seen) ? last.captured[0]! : null;
    return { ...structuredClone(rest), current: s.phase === 'play' && !s.outcome ? seatOf(s, s.turn) : null, last, ko };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (s.phase === 'scoring') {
      out.push({ type: 'mark' }, { type: 'resume' });
      if (!s.accepted[viewer.seat]) out.push({ type: 'accept' });
    } else if (s.colors[viewer.seat] === s.turn) {
      // Empty points are all candidates; the renderer marks illegal ones with legal() below. One hint is enough.
      out.push({ type: 'place' }, { type: 'pass' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    if (s.phase === 'scoring') {
      // Absent players accept the current marking.
      s.accepted = [true, true];
      endByScore(s);
      return finish(s, [{ type: 'timed-out' }]);
    }
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { lose(s, seat, 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    // Passive play: pass.
    s.history.push({ seat, at: null, captured: [] });
    s.passes += 1;
    s.turn = other(s.turn);
    if (s.passes >= 2) { s.phase = 'scoring'; s.dead = []; s.accepted = [false, false]; }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => waiting(s),

  tutorial: {
    seed: 8,
    options: { firstMove: 'host', deal: 'tutorial', size: 9, komi: 0.5 },
    introFa: 'شما سیاه هستید. هر سنگ «آزادی» دارد: نقطه‌های خالی کنارش (بالا، پایین، چپ، راست). وقتی همه آزادی‌های یک سنگ یا گروه پر شود، از صفحه برداشته می‌شود.',
    steps: [
      { instructionFa: 'سنگ سفید بالای صفحه فقط یک آزادی دارد (زیرش). روی آن نقطه بگذارید تا سنگ سفید را بگیرید.', expected: { type: 'place', at: 19 }, reply: { type: 'pass' } },
      { instructionFa: 'سنگ سفید لبه چپ هم فقط یک آزادی (سمت راستش) دارد. آن را هم بگیرید.', expected: { type: 'place', at: 37 }, reply: { type: 'pass' } },
      { instructionFa: 'سفید پاس داد. شما هم «پاس» بزنید تا شمارش شروع شود.', expected: { type: 'pass' }, reply: { type: 'accept' } },
      { instructionFa: 'در شمارش، سنگ‌های مرده را علامت می‌زنید؛ اینجا سنگ مرده‌ای نیست. «تأیید شمارش» را بزنید.', expected: { type: 'accept' }, reply: null }
    ],
    completedFa: 'بردید! امتیاز هر رنگ = سنگ‌هایش روی صفحه + نقطه‌های خالی‌ای که فقط آن رنگ دورشان را گرفته؛ سفید چند امتیاز جبرانی (کومی) هم می‌گیرد.'
  }
};
