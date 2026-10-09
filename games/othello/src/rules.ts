// Othello («اتللو»), World Othello Federation rules: 8×8, black moves first from the standard centre; a move must
// outflank at least one line of the opponent's discs, which are flipped. A player with no legal move passes
// (automatically); the game ends when neither can move. Most discs wins; empty squares go to the winner.
// Board: index = row * 8 + col, row 0 = rank 1 (a1 = 0, h8 = 63).
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { othello } from './definition.ts';

export type Disc = 'b' | 'w';
export interface OthelloState {
  board: (Disc | null)[];
  turn: Disc;
  /** colors[seat] */
  colors: [Disc, Disc];
  history: { seat: number; sq: number; flipped: number[] }[];
  /** Seats that had to pass, newest last (for the "no move" notice). */
  passes: { seat: number; after: number }[];
  timeouts: [number, number];
  end: { kind: 'board' | 'resign' | 'timeout'; score?: [number, number] } | null;
  outcome: Outcome | null;
}
export interface OthelloView extends Omit<OthelloState, 'timeouts'> {
  current: number | null;
  counts: { b: number; w: number };
  last: OthelloState['history'][number] | null;
}

export const othelloAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), sq: z.number().int().min(0).max(63) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type OthelloAction = z.infer<typeof othelloAction>;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const other = (d: Disc): Disc => (d === 'b' ? 'w' : 'b');

export function startBoard(): (Disc | null)[] {
  const b: (Disc | null)[] = Array(64).fill(null);
  // d4 and e5 white, d5 and e4 black.
  b[27] = 'w'; b[36] = 'w'; b[28] = 'b'; b[35] = 'b';
  return b;
}

/** Discs flipped by placing `d` on `sq` (empty if the move is illegal). */
export function flips(board: (Disc | null)[], sq: number, d: Disc): number[] {
  if (board[sq]) return [];
  const r0 = Math.floor(sq / 8), c0 = sq % 8;
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === other(d)) { line.push(r * 8 + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === d) out.push(...line);
  }
  return out;
}

export const legalSquares = (board: (Disc | null)[], d: Disc) => board.map((_, i) => i).filter((i) => flips(board, i, d).length > 0);
export const count = (board: (Disc | null)[]) => ({ b: board.filter((x) => x === 'b').length, w: board.filter((x) => x === 'w').length });

// ---------- module ----------

type Events = Transition<OthelloState>['internalEvents'];
const MAX_TIMEOUTS = 1;
const seatOf = (s: OthelloState, d: Disc) => (s.colors[0] === d ? 0 : 1);
const finish = (s: OthelloState, events: Events): Transition<OthelloState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

/** After a move: pass if the next player cannot move; end the game if neither can. */
function advance(s: OthelloState) {
  const next = other(s.turn);
  if (legalSquares(s.board, next).length) { s.turn = next; return; }
  if (legalSquares(s.board, s.turn).length) { s.passes.push({ seat: seatOf(s, next), after: s.history.length }); return; }
  const c = count(s.board);
  const empty = 64 - c.b - c.w;
  // WOF: empty squares are awarded to the winner.
  const score: Record<Disc, number> = { b: c.b + (c.b > c.w ? empty : 0), w: c.w + (c.w > c.b ? empty : 0) };
  const seats = [0, 1].map((seat) => ({ seat, score: score[s.colors[seat]!] }));
  const draw = seats[0]!.score === seats[1]!.score;
  const best = Math.max(seats[0]!.score, seats[1]!.score);
  s.end = { kind: 'board', score: [seats[0]!.score, seats[1]!.score] };
  s.outcome = { placements: seats.map((x) => ({ seat: x.seat, place: draw || x.score === best ? 1 : 2, score: x.score })), reason: draw ? 'draw' : 'score' };
}

export const othelloModule: GameModule<OthelloState, OthelloAction, OthelloView> = {
  manifest: othello.manifest,
  actionSchema: othelloAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('othello needs exactly 2 players');
    const drawn = rng.nextInt(2);
    const blackSeat = options.firstMove === 'host' ? 0 : drawn;
    let board = startBoard();
    if (options.deal === 'tutorial') {
      // Three small fights: b1 (taken from c1 along rank 1); e6/d7 (white's g6 grows the e6 row, then d6 flips the row
      // and d7 at once); b7 on the a8 diagonal (white has no move left, passes, and c6 takes the last disc).
      board = Array(64).fill(null);
      board[0] = 'b'; board[1] = 'w';
      board[44] = 'w'; board[45] = 'b'; board[47] = 'b'; board[51] = 'w'; board[59] = 'b';
      board[49] = 'w'; board[56] = 'b';
    }
    return { board, turn: 'b', colors: blackSeat === 0 ? ['b', 'w'] : ['w', 'b'], history: [], passes: [], timeouts: [0, 0], end: null, outcome: null };
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (s.board[a.sq]) return { ok: false, errorCode: 'SQUARE_TAKEN' };
    return flips(s.board, a.sq, s.turn).length ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.end = { kind: 'resign' };
      s.outcome = { placements: [{ seat: 1 - seat, place: 1 }, { seat, place: 2 }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    const flipped = flips(s.board, a.sq, s.turn);
    s.board[a.sq] = s.turn;
    for (const i of flipped) s.board[i] = s.turn;
    s.history.push({ seat, sq: a.sq, flipped });
    s.timeouts[seat] = 0;
    advance(s);
    return finish(s, [{ type: 'placed', seat, sq: a.sq }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = s;
    void _t;
    return { ...structuredClone(rest), current: s.outcome ? null : seatOf(s, s.turn), counts: count(s.board), last: s.history.at(-1) ?? null };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (s.colors[viewer.seat] === s.turn) for (const sq of legalSquares(s.board, s.turn)) out.push({ type: 'place', sq });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      s.end = { kind: 'timeout' };
      s.outcome = { placements: [{ seat: 1 - seat, place: 1 }, { seat, place: 2 }], reason: 'timeout' };
    }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.turn)]),

  tutorial: {
    seed: 5,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'شما سیاه هستید و اول بازی می‌کنید. هر حرکت یعنی گذاشتن یک مهره در خانهٔ خالی، به شرطی که دست‌کم یک ردیف پیوسته از مهره‌های سفید بین مهرهٔ تازه و یکی از مهره‌های سیاه شما گیر بیفتد؛ در خط افقی، عمودی یا مورب. همهٔ مهره‌های گیرافتاده سیاه می‌شوند. روی صفحه سه درگیری کوچک هست.',
    steps: [
      { instructionFa: 'سفید b1 کنار a1 شماست. روی c1 بگذارید: b1 بین c1 و a1 گیر می‌افتد و سیاه می‌شود. خانه‌های نقطه‌دار حرکت‌های مجاز شما هستند.', expected: { type: 'place', sq: 2 }, reply: { type: 'place', sq: 46 } },
      { instructionFa: 'حریف g6 را گذاشت و f6 شما را گرفت؛ حالا e6، f6 و g6 سفیدند. روی d6 بگذارید: هر سه مهرهٔ سفید ردیف ششم بین d6 و h6 گیر می‌افتند و هم‌زمان d7 هم بین d6 و d8. یک حرکت می‌تواند در چند جهت با هم مهره بگیرد.', expected: { type: 'place', sq: 43 }, reply: null },
      { instructionFa: 'سفید فقط b7 را دارد و هیچ حرکت مجازی ندارد، پس نوبتش خودکار رد شد و دوباره نوبت شماست. روی c6 بگذارید: b7 در خط مورب بین c6 و a8 گیر می‌افتد.', expected: { type: 'place', sq: 42 }, reply: null }
    ],
    completedFa: 'بردید! با c6 آخرین مهرهٔ سفید هم برگشت و هیچ‌کدام حرکتی نداشتید، پس بازی تمام شد. ۱۳ مهرهٔ سیاه روی صفحه بود و طبق قانون، ۵۱ خانهٔ خالی هم به برنده رسید: ۶۴ به ۰. در بازی معمولی هم بازی وقتی تمام می‌شود که هیچ‌کس حرکت مجاز نداشته باشد و هر که مهرهٔ بیشتری دارد می‌برد.'
  }
};
