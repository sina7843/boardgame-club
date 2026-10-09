// Checkers («چکرز»). Default: English/American draughts (WCDF) — 8×8, dark moves first, men move and capture
// diagonally forward, captures are compulsory (any capture sequence may be chosen) and continue while possible,
// a man reaching the last row is crowned and the move ends, kings move/capture one square in any diagonal direction.
// Option "brazilian": the 8×8 international rules — men also capture backwards, flying kings, the sequence that
// captures the most pieces is compulsory, a man is crowned only if it ends its move on the last row.
// Draws: threefold repetition, or 40 moves by each side without a capture or a man's move.
//
// Board: index = row * 8 + col; row 0 is seat-0-dark's back row only when seat 0 plays dark (see `colors`).
// Absolute colours: 'd' (dark, starts on rows 0..2 and moves up) and 'l' (light, rows 5..7, moves down).
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { checkers } from './definition.ts';

export type Color = 'd' | 'l';
/** 'd' / 'l' man, 'D' / 'L' king. */
export type Piece = 'd' | 'l' | 'D' | 'L';
export type Variant = 'english' | 'brazilian';
export interface Move { path: number[]; captured: number[]; crowned: boolean }

export interface CheckersState {
  board: (Piece | null)[];
  turn: Color;
  /** colors[seat] */
  colors: [Color, Color];
  variant: Variant;
  /** Plies since the last capture or man move (draw at 80). */
  quiet: number;
  seen: Record<string, number>;
  history: { seat: number; path: number[]; captured: number[]; crowned: boolean }[];
  timeouts: [number, number];
  end: { kind: 'win' | 'blocked' | 'draw' | 'resign' | 'timeout'; draw?: 'repetition' | 'quiet' | 'agreement' } | null;
  drawOffer: number | null;
  outcome: Outcome | null;
}

export interface CheckersView {
  board: (Piece | null)[];
  turn: Color;
  colors: [Color, Color];
  variant: Variant;
  current: number | null;
  last: CheckersState['history'][number] | null;
  history: CheckersState['history'];
  counts: { d: number; l: number; D: number; L: number };
  quiet: number;
  drawOffer: number | null;
  end: CheckersState['end'];
  outcome: Outcome | null;
}

const sq = z.number().int().min(0).max(63);
export const checkersAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), path: z.array(sq).min(2).max(13), offerDraw: z.boolean().optional() }),
  z.strictObject({ type: z.literal('acceptDraw') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CheckersAction = z.infer<typeof checkersAction>;

// ---------- geometry ----------

export const rowOf = (i: number) => Math.floor(i / 8);
export const colOf = (i: number) => i % 8;
const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
export const isDark = (i: number) => (rowOf(i) + colOf(i)) % 2 === 0;
const colorOf = (p: Piece): Color => (p === 'd' || p === 'D' ? 'd' : 'l');
const isKing = (p: Piece) => p === 'D' || p === 'L';
const other = (c: Color): Color => (c === 'd' ? 'l' : 'd');
const forward = (c: Color) => (c === 'd' ? 1 : -1);
const lastRow = (c: Color) => (c === 'd' ? 7 : 0);
const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export function startBoard(): (Piece | null)[] {
  const b: (Piece | null)[] = Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue;
    if (rowOf(i) <= 2) b[i] = 'd';
    else if (rowOf(i) >= 5) b[i] = 'l';
  }
  return b;
}

// ---------- move generation ----------

function captureSequences(board: (Piece | null)[], from: number, piece: Piece, variant: Variant): Move[] {
  const c = colorOf(piece);
  const king = isKing(piece);
  const flying = king && variant === 'brazilian';
  const out: Move[] = [];
  const walk = (b: (Piece | null)[], pos: number, path: number[], caps: number[]) => {
    let extended = false;
    for (const [dr, dc] of DIRS) {
      // English men capture forward only; Brazilian men capture in every direction.
      if (!king && variant === 'english' && dr !== forward(c)) continue;
      const r = rowOf(pos), cc = colOf(pos);
      let k = 1;
      // Flying kings may approach the captured piece from a distance.
      if (flying) while (at(r + dr * k, cc + dc * k) >= 0 && b[at(r + dr * k, cc + dc * k)] === null) k++;
      const over = at(r + dr * k, cc + dc * k);
      if (over < 0 || !b[over] || colorOf(b[over]!) === c || caps.includes(over)) continue;
      for (let j = k + 1; ; j++) {
        const land = at(r + dr * j, cc + dc * j);
        if (land < 0 || b[land] !== null) break;
        extended = true;
        const nb = b.slice();
        nb[land] = nb[pos]!; nb[pos] = null;
        // Captured pieces stay on the board until the sequence ends (they cannot be jumped twice).
        const crowns = !king && rowOf(land) === lastRow(c);
        if (crowns && variant === 'english') out.push({ path: [...path, land], captured: [...caps, over], crowned: true });
        else walk(nb, land, [...path, land], [...caps, over]);
        if (!flying) break;
      }
    }
    if (!extended && caps.length) out.push({ path, captured: caps, crowned: !king && rowOf(pos) === lastRow(c) });
  };
  walk(board, from, [from], []);
  return out;
}

/** All legal moves for the side to move (captures compulsory; Brazilian: only the longest captures). */
export function legalMoves(board: (Piece | null)[], turn: Color, variant: Variant): Move[] {
  const caps: Move[] = [];
  const quiet: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== turn) continue;
    caps.push(...captureSequences(board, i, p, variant));
    if (caps.length) continue;
    const king = isKing(p);
    for (const [dr, dc] of DIRS) {
      if (!king && dr !== forward(turn)) continue;
      for (let k = 1; ; k++) {
        const to = at(rowOf(i) + dr * k, colOf(i) + dc * k);
        if (to < 0 || board[to] !== null) break;
        quiet.push({ path: [i, to], captured: [], crowned: !king && rowOf(to) === lastRow(turn) });
        if (!(king && variant === 'brazilian')) break;
      }
    }
  }
  if (!caps.length) return quiet;
  if (variant === 'brazilian') { const most = Math.max(...caps.map((m) => m.captured.length)); return caps.filter((m) => m.captured.length === most); }
  return caps;
}

export function applyMove(board: (Piece | null)[], m: Move): (Piece | null)[] {
  const b = board.slice();
  const from = m.path[0]!, to = m.path.at(-1)!;
  let p = b[from]!;
  b[from] = null;
  for (const c of m.captured) b[c] = null;
  if (m.crowned) p = p.toUpperCase() as Piece;
  b[to] = p;
  return b;
}

const key = (board: (Piece | null)[], turn: Color) => `${board.map((p) => p ?? '.').join('')}|${turn}`;
const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// ---------- module ----------

type Events = Transition<CheckersState>['internalEvents'];
const MAX_TIMEOUTS = 1; // like chess: a flag fall loses
const seatOf = (s: CheckersState, c: Color) => (s.colors[0] === c ? 0 : 1);
const win = (winner: number, reason: Outcome['reason']): Outcome => ({ placements: [{ seat: winner, place: 1 }, { seat: 1 - winner, place: 2 }], reason });
const draw = (): Outcome => ({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' });
const finish = (s: CheckersState, events: Events): Transition<CheckersState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

export const checkersModule: GameModule<CheckersState, CheckersAction, CheckersView> = {
  manifest: checkers.manifest,
  actionSchema: checkersAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('checkers needs exactly 2 players');
    const drawn = rng.nextInt(2);
    const darkSeat = options.firstMove === 'host' ? 0 : drawn;
    const variant: Variant = options.variant === 'brazilian' ? 'brazilian' : 'english';
    let board = startBoard();
    if (options.deal === 'tutorial') {
      // Teaching position: one dark man on b2 against four light men (e5, f6, b6, d8). A quiet move invites a double
      // jump, the jumper crowns on f8, and the new king's backward double jump takes the last two men.
      board = Array(64).fill(null);
      board[9] = 'd';
      for (const i of [36, 45, 41, 59]) board[i] = 'l';
    }
    const colors: [Color, Color] = darkSeat === 0 ? ['d', 'l'] : ['l', 'd'];
    return { board, turn: 'd', colors, variant, quiet: 0, seen: { [key(board, 'd')]: 1 }, history: [], timeouts: [0, 0], end: null, drawOffer: null, outcome: null };
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'acceptDraw') return s.drawOffer === 1 - actor.seat ? { ok: true } : { ok: false, errorCode: 'NO_DRAW_OFFER' };
    const p = s.board[a.path[0]!];
    if (!p || colorOf(p) !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_PIECE' };
    const moves = legalMoves(s.board, s.turn, s.variant);
    if (moves.some((m) => samePath(m.path, a.path))) return { ok: true };
    return { ok: false, errorCode: moves.some((m) => m.captured.length) ? 'CAPTURE_REQUIRED' : 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { s.end = { kind: 'resign' }; s.outcome = win(1 - seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    if (a.type === 'acceptDraw') { s.end = { kind: 'draw', draw: 'agreement' }; s.outcome = draw(); return finish(s, [{ type: 'drawAgreed', seat }]); }
    const m = legalMoves(s.board, s.turn, s.variant).find((x) => samePath(x.path, a.path))!;
    const man = !isKing(s.board[m.path[0]!]!);
    s.board = applyMove(s.board, m);
    s.history.push({ seat, path: m.path, captured: m.captured, crowned: m.crowned });
    s.timeouts[seat] = 0;
    s.drawOffer = a.offerDraw ? seat : null;
    s.quiet = m.captured.length || man ? 0 : s.quiet + 1;
    s.turn = other(s.turn);
    const k = key(s.board, s.turn);
    s.seen[k] = (s.seen[k] ?? 0) + 1;
    if (!legalMoves(s.board, s.turn, s.variant).length) {
      const none = !s.board.some((p) => p && colorOf(p) === s.turn);
      s.end = { kind: none ? 'win' : 'blocked' };
      s.outcome = win(seat, 'win');
    } else if (s.seen[k]! >= 3) { s.end = { kind: 'draw', draw: 'repetition' }; s.outcome = draw(); }
    else if (s.quiet >= 80) { s.end = { kind: 'draw', draw: 'quiet' }; s.outcome = draw(); }
    if (s.outcome) s.drawOffer = null;
    return finish(s, [{ type: 'moved', seat, path: m.path }]);
  },

  project(s) {
    const counts = { d: 0, l: 0, D: 0, L: 0 };
    for (const p of s.board) if (p) counts[p]++;
    return {
      board: s.board.slice(), turn: s.turn, colors: [...s.colors] as [Color, Color], variant: s.variant,
      current: s.outcome ? null : seatOf(s, s.turn), last: s.history.at(-1) ?? null, history: s.history.slice(),
      counts, quiet: s.quiet, drawOffer: s.drawOffer, end: s.end, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (s.colors[viewer.seat] === s.turn) {
      for (const m of legalMoves(s.board, s.turn, s.variant)) out.push({ type: 'move', path: m.path });
      if (s.drawOffer === 1 - viewer.seat) out.push({ type: 'acceptDraw' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { s.end = { kind: 'timeout' }; s.outcome = win(1 - seat, 'timeout'); }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.turn)]),

  tutorial: {
    seed: 2,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'پایان یک بازی است. شما مهره‌های تیره هستید و فقط یک مهره در b2 دارید؛ حریف چهار مهرهٔ روشن دارد. مهره‌ها فقط روی خانه‌های تیره و قطری حرکت می‌کنند و مهرهٔ ساده فقط رو به جلو، یعنی به سمت ردیف ۸، می‌رود.',
    steps: [
      {
        instructionFa: 'فعلاً زدنی در کار نیست، پس یک حرکت ساده می‌کنید: مهرهٔ b2 را یک خانه قطری جلو ببرید و در c3 بگذارید.',
        expected: { type: 'move', path: [9, 18] },
        reply: { type: 'move', path: [36, 27] }
      },
      {
        instructionFa: 'حریف به d4 آمد و خانهٔ پشتش (e5) خالی است. زدن اجباری است: از c3 روی d4 بپرید و در e5 فرود بیایید. از آنجا f6 هم زدنی است و پرش باید ادامه پیدا کند تا g7.',
        expected: { type: 'move', path: [18, 36, 54] },
        reply: { type: 'move', path: [41, 34] }
      },
      {
        instructionFa: 'مهرهٔ g7 را به f8 ببرید. ردیف ۸ ردیف آخر است: مهره «شاه» می‌شود و حرکتش همان‌جا تمام می‌شود.',
        expected: { type: 'move', path: [54, 61] },
        reply: { type: 'move', path: [59, 52] }
      },
      {
        instructionFa: 'شاه رو به عقب هم می‌زند. از f8 روی e7 بپرید و در d6 فرود بیایید، بعد روی c5 بپرید و در b4 بنشینید تا آخرین مهره‌های حریف زده شوند.',
        expected: { type: 'move', path: [61, 43, 25] },
        reply: null
      }
    ],
    completedFa: 'بردید! با یک پرش دوتایی دو مهره زدید، در ردیف آخر شاه گرفتید و با پرش دوتایی شاه رو به عقب دو مهرهٔ آخر حریف را هم زدید. حریف دیگر مهره‌ای نداشت؛ نداشتن مهره یا نداشتن هیچ حرکت مجاز یعنی باخت.'
  }
};
