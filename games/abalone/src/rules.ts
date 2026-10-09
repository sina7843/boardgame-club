// Abalone («آبالون»): hexagonal board of 61 cells (side 5), 14 marbles each in the standard layout, black first.
// A move shifts 1–3 of your marbles that stand in a line by one cell: in-line (along their own line) or broadside
// (sideways, every target cell empty). In-line moves may push ("sumito") a smaller group of enemy marbles directly in
// front — 2 push 1, 3 push 1 or 2 — if the cell behind them is empty or off the board (a marble pushed off is lost).
// Pushing off six enemy marbles wins. House rule to keep games finite: after 200 moves the side that pushed off more
// marbles wins (equal = draw).
// Cells use axial coordinates (q, r) with |q|, |r|, |q + r| ≤ 4; `CELLS[i]` lists them row by row from r = -4.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { abalone } from './definition.ts';

export type Color = 'b' | 'w';
export const CELLS: [number, number][] = [];
for (let r = -4; r <= 4; r++) for (let q = Math.max(-4, -4 - r); q <= Math.min(4, 4 - r); q++) CELLS.push([q, r]);
const INDEX = new Map(CELLS.map(([q, r], i) => [`${q},${r}`, i]));
export const cellAt = (q: number, r: number) => INDEX.get(`${q},${r}`) ?? null;
/** Six directions (axial). Opposite of d is (d + 3) % 6. */
export const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const neighbor = (i: number, d: number) => cellAt(CELLS[i]![0] + DIRS[d]![0], CELLS[i]![1] + DIRS[d]![1]);
export const WIN = 6;
const MAX_PLIES = 200;

export interface AbaloneState {
  board: (Color | null)[];
  colors: [Color, Color];
  turn: Color;
  ply: number;
  off: Record<Color, number>;
  history: { seat: number; marbles: number[]; dir: number; pushed: number[]; lost: number }[];
  timeouts: [number, number];
  end: { kind: 'six' | 'limit' | 'resign' | 'timeout' } | null;
  outcome: Outcome | null;
}
export type AbaloneView = Omit<AbaloneState, 'timeouts'> & { current: number | null };

export const abaloneAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), marbles: z.array(z.number().int().min(0).max(60)).min(1).max(3), dir: z.number().int().min(0).max(5) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type AbaloneAction = z.infer<typeof abaloneAction>;

const other = (c: Color): Color => (c === 'b' ? 'w' : 'b');

export function startBoard(): (Color | null)[] {
  const b: (Color | null)[] = Array(CELLS.length).fill(null);
  CELLS.forEach(([q, r], i) => {
    if (r >= 3 || (r === 2 && q >= -2 && q <= 0)) b[i] = 'b';
    if (r <= -3 || (r === -2 && q >= 0 && q <= 2)) b[i] = 'w';
  });
  return b;
}

/** Marbles in a line, sorted along `axis` (direction index 0..2), or null if they are not a contiguous line. */
function lineOf(marbles: number[]): { cells: number[]; axis: number | null } | null {
  if (marbles.length === 1) return { cells: marbles, axis: null };
  for (let axis = 0; axis < 3; axis++) {
    const sorted = [...marbles].sort((a, b) => {
      const [qa, ra] = CELLS[a]!, [qb, rb] = CELLS[b]!;
      return (qa - qb) * DIRS[axis]![0] + (ra - rb) * DIRS[axis]![1] || (qa - qb) || (ra - rb);
    });
    if (sorted.every((c, k) => k === 0 || neighbor(sorted[k - 1]!, axis) === c)) return { cells: sorted, axis };
  }
  return null;
}

/** Result of moving `marbles` in direction `d` for `color`, or null if illegal. */
export function tryMove(board: (Color | null)[], color: Color, marbles: number[], d: number): { board: (Color | null)[]; pushed: number[]; lost: number } | null {
  if (new Set(marbles).size !== marbles.length || marbles.some((m) => board[m] !== color)) return null;
  const line = lineOf(marbles);
  if (!line) return null;
  const inline = line.axis === null || d % 3 === line.axis;
  const b = board.slice();
  if (!inline) {
    // Broadside: every target empty.
    const targets = line.cells.map((c) => neighbor(c, d));
    if (targets.some((t) => t === null || b[t] !== null)) return null;
    for (const c of line.cells) b[c] = null;
    for (const t of targets) b[t!] = color;
    return { board: b, pushed: [], lost: 0 };
  }
  // In-line: walk from the leading marble.
  const lead = line.axis === null ? line.cells[0]! : (d === line.axis ? line.cells[line.cells.length - 1]! : line.cells[0]!);
  let at = neighbor(lead, d);
  const enemy: number[] = [];
  while (at !== null && b[at] === other(color)) { enemy.push(at); at = neighbor(at, d); }
  if (at !== null && b[at] === color) return null; // own marble behind the enemy (or directly in front) blocks
  if (!enemy.length && at === null) return null; // cannot step off the board
  if (enemy.length && enemy.length >= marbles.length) return null; // sumito needs superiority
  let lost = 0;
  if (enemy.length) {
    if (at === null) lost = 1; else b[at] = other(color);
    b[enemy[0]!] = null; // the front enemy cell is taken by our lead marble below
  }
  const tail = line.axis === null ? line.cells[0]! : (d === line.axis ? line.cells[0]! : line.cells[line.cells.length - 1]!);
  b[tail] = null;
  b[neighbor(lead, d)!] = color;
  return { board: b, pushed: enemy, lost };
}

/** Every legal move for `color` (groups of 1–3 in a line × 6 directions). */
export function legalMoves(board: (Color | null)[], color: Color): { marbles: number[]; dir: number }[] {
  const out: { marbles: number[]; dir: number }[] = [];
  const groups: number[][] = [];
  board.forEach((c, i) => {
    if (c !== color) return;
    groups.push([i]);
    for (let axis = 0; axis < 3; axis++) {
      const a = neighbor(i, axis);
      if (a === null || board[a] !== color) continue;
      groups.push([i, a]);
      const b2 = neighbor(a, axis);
      if (b2 !== null && board[b2] === color) groups.push([i, a, b2]);
    }
  });
  for (const g of groups) for (let d = 0; d < 6; d++) if (tryMove(board, color, g, d)) out.push({ marbles: g, dir: d });
  return out;
}

// ---------- module ----------

type Events = Transition<AbaloneState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const seatOf = (s: AbaloneState, c: Color) => (s.colors[0] === c ? 0 : 1);
const finish = (s: AbaloneState, events: Events): Transition<AbaloneState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const winner = (s: AbaloneState, c: Color, kind: NonNullable<AbaloneState['end']>['kind'], reason: Outcome['reason']) => {
  s.end = { kind };
  s.outcome = { placements: [0, 1].map((seat) => ({ seat, place: s.colors[seat] === c ? 1 : 2, score: s.off[other(s.colors[seat]!)] })), reason };
};

function doMove(s: AbaloneState, seat: number, marbles: number[], dir: number) {
  const r = tryMove(s.board, s.turn, marbles, dir)!;
  s.board = r.board;
  s.off[other(s.turn)] += r.lost;
  s.history.push({ seat, marbles, dir, pushed: r.pushed, lost: r.lost });
  s.ply += 1;
  if (s.off[other(s.turn)] >= WIN) { winner(s, s.turn, 'six', 'win'); return; }
  if (s.ply >= MAX_PLIES) {
    if (s.off.w === s.off.b) { s.end = { kind: 'limit' }; s.outcome = { placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' }; return; }
    winner(s, s.off.w > s.off.b ? 'b' : 'w', 'limit', 'score');
    return;
  }
  s.turn = other(s.turn);
}

const randomMove = (s: AbaloneState, rng: EngineRng) => { const all = legalMoves(s.board, s.turn); return all[rng.nextInt(all.length)]!; };

export const abaloneModule: GameModule<AbaloneState, AbaloneAction, AbaloneView> = {
  manifest: abalone.manifest,
  actionSchema: abaloneAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('abalone needs exactly 2 players');
    const blackSeat = options.firstMove === 'host' ? 0 : rng.nextInt(2);
    const s: AbaloneState = { board: startBoard(), colors: blackSeat === 0 ? ['b', 'w'] : ['w', 'b'], turn: 'b', ply: 0, off: { b: 0, w: 0 }, history: [], timeouts: [0, 0], end: null, outcome: null };
    if (options.deal === 'tutorial') {
      // White has already lost four. Black: a pair facing a white marble on the edge of the middle row, a lone marble
      // that White will push twice, and three marbles that line up (one sideways step) against two white ones.
      s.board = Array(CELLS.length).fill(null);
      const put = (q: number, r: number, c: Color) => { s.board[cellAt(q, r)!] = c; };
      put(2, 0, 'b'); put(3, 0, 'b'); put(4, 0, 'w');
      put(3, -3, 'b'); put(1, -3, 'w'); put(2, -3, 'w');
      put(-3, 2, 'b'); put(-2, 1, 'b'); put(-1, 1, 'b'); put(0, 2, 'w'); put(1, 2, 'w');
      s.off = { b: 0, w: 4 };
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    return tryMove(s.board, s.turn, a.marbles, a.dir) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { winner(s, other(s.colors[seat]!), 'resign', 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    doMove(s, seat, a.marbles, a.dir);
    return finish(s, [{ type: 'moved', seat }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = s;
    void _t;
    return { ...structuredClone(rest), current: s.outcome ? null : seatOf(s, s.turn) };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    // Moves are enumerated on the client with legalMoves(); one hint says a move is due.
    if (s.colors[viewer.seat] === s.turn) out.push({ type: 'move' });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { winner(s, other(s.turn), 'timeout', 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    const m = randomMove(s, ctx.rng);
    doMove(s, seat, m.marbles, m.dir);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.turn)]),

  tutorial: {
    seed: 11,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'شما سیاه هستید و حریف تا حالا ۴ گوی سفید از دست داده؛ اولین کسی که ۶ گوی حریف را بیرون بیندازد برنده است. در هر نوبت ۱ تا ۳ گوی هم‌خطِ خودتان را انتخاب می‌کنید (روی گوی‌های چشمک‌زن بزنید) و با زدن یکی از پیکان‌ها همه را با هم یک خانه حرکت می‌دهید.',
    steps: [
      { instructionFa: 'هل دادن (سومیتو): دو گوی سیاه شما پشت یک گوی سفید در لبهٔ صفحه هم‌خط‌اند. هر دو را انتخاب کنید و پیکان چشمک‌زن (در امتداد همان خط) را بزنید. ۲ در برابر ۱ برتری است و چون پشت گوی سفید بیرون صفحه است، از بازی خارج می‌شود.', expected: { type: 'move', marbles: [cellAt(2, 0)!, cellAt(3, 0)!], dir: 0 }, reply: { type: 'move', marbles: [cellAt(1, -3)!, cellAt(2, -3)!], dir: 0 } },
      { instructionFa: 'سفید ۵ گوی از دست داده، ولی حریف هم همین قانون را دارد: دو گوی سفید گوی تنهای شما را یک خانه هل دادند و حالا لبهٔ صفحه است. حرکت از پهلو: دو گوی کنار هم را انتخاب کنید و با پیکان چشمک‌زن کنارِ گوی سیاه سوم ببرید. در حرکت از پهلو هر دو خانهٔ مقصد باید خالی باشند و هل دادن ممکن نیست.', expected: { type: 'move', marbles: [cellAt(-2, 1)!, cellAt(-1, 1)!], dir: 5 }, reply: { type: 'move', marbles: [cellAt(2, -3)!, cellAt(3, -3)!], dir: 0 } },
      { instructionFa: 'سفید گوی تنهای شما را از لبه بیرون انداخت؛ این بار شما یک گوی باختید. حالا سه گوی سیاه هم‌خط دارید و جلویشان دو گوی سفید است. هر سه را انتخاب کنید و پیکان چشمک‌زن را بزنید: ۳ در برابر ۲ برتری است و چون پشت سفیدها خالی است، هر دو یک خانه عقب می‌روند.', expected: { type: 'move', marbles: [cellAt(-3, 2)!, cellAt(-2, 2)!, cellAt(-1, 2)!], dir: 0 }, reply: { type: 'move', marbles: [cellAt(3, -3)!], dir: 3 } },
      { instructionFa: 'دو گوی سفید حالا در لبهٔ صفحه‌اند. همان سه گوی را یک بار دیگر در همان جهت ببرید تا گوی سفیدِ لبه بیرون بیفتد. (اگر سفیدها سه تا بودند، ۳ در برابر ۳ هل دادن ممکن نبود.)', expected: { type: 'move', marbles: [cellAt(-2, 2)!, cellAt(-1, 2)!, cellAt(0, 2)!], dir: 0 }, reply: null }
    ],
    completedFa: 'بردید! ششمین گوی سفید از صفحه بیرون افتاد: یکی با هل دادن ۲ در برابر ۱ و یکی با ۳ در برابر ۲، روی ۴ گویی که سفید از قبل از دست داده بود. سفید فقط ۱ گوی شما را بیرون انداخت، پس نتیجه ۶ به ۱ شد. یادتان باشد هل دادن فقط در امتداد خط و با برتری عددی ممکن است (۲ در برابر ۱، ۳ در برابر ۱ یا ۲) و گوی خودتان پشت گوی‌های حریف جلوی هل دادن را می‌گیرد.'
  }
};
