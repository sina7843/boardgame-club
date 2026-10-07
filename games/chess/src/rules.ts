// Chess (FIDE Laws of Chess, basic rules): 2 players, public state. Castling, en passant, promotion, check, checkmate,
// stalemate. Draws are applied automatically: threefold repetition, the 50-move rule, insufficient material, or an
// accepted draw offer. Squares use algebraic names ('e4'); board index = rank * 8 + file, rank 0 = White's first rank.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { chess } from './definition.ts';

export type Color = 'w' | 'b';
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
/** e.g. 'wK', 'bP' */
export type Piece = `${Color}${PieceType}`;
export type PromoType = 'Q' | 'R' | 'B' | 'N';

export interface Move { from: number; to: number; promo?: PromoType; flag?: 'ep' | 'castleK' | 'castleQ' | 'double'; captured?: Piece }

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  ep: number | null;
  halfmove: number;
  fullmove: number;
}

export type DrawReason = 'stalemate' | 'repetition' | 'fiftyMove' | 'material' | 'agreement' | 'timeoutMaterial';
export interface HistoryEntry { san: string; from: string; to: string; color: Color }

export interface ChessState {
  pos: Position;
  /** colors[seat] */
  colors: [Color, Color];
  history: HistoryEntry[];
  /** Repetition counts per position key (internal; not projected). */
  seen: Record<string, number>;
  drawOffer: number | null;
  timeouts: number[];
  end: { kind: 'checkmate' | 'draw' | 'resign' | 'timeout'; draw?: DrawReason } | null;
  outcome: Outcome | null;
}

const square = z.string().regex(/^[a-h][1-8]$/);
export const chessAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), from: square, to: square, promotion: z.enum(['Q', 'R', 'B', 'N']).optional(), offerDraw: z.boolean().optional() }),
  z.strictObject({ type: z.literal('acceptDraw') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type ChessAction = z.infer<typeof chessAction>;

export interface ChessView {
  board: (Piece | null)[];
  turn: Color;
  colors: [Color, Color];
  /** Seat to move, or null when the game is over. */
  current: number | null;
  inCheck: boolean;
  lastMove: { from: string; to: string } | null;
  history: HistoryEntry[];
  captured: { w: Piece[]; b: Piece[] };
  drawOffer: number | null;
  halfmove: number;
  end: ChessState['end'];
  outcome: Outcome | null;
}

// ---------- squares ----------

export const sqName = (i: number) => 'abcdefgh'[i % 8]! + String(Math.floor(i / 8) + 1);
export const sqIndex = (n: string) => (n.charCodeAt(1) - 49) * 8 + (n.charCodeAt(0) - 97);
const fileOf = (i: number) => i % 8;
const rankOf = (i: number) => Math.floor(i / 8);
const at = (f: number, r: number) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);
const colorOf = (p: Piece) => p[0] as Color;
const typeOf = (p: Piece) => p[1] as PieceType;
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function fromFen(fen: string): Position {
  const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = Array(64).fill(null);
  placement!.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { f += Number(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
      board[(7 - i) * 8 + f] = `${color}${ch.toUpperCase()}` as Piece;
      f++;
    }
  });
  return {
    board, turn: turn === 'b' ? 'b' : 'w',
    castling: { wK: castle!.includes('K'), wQ: castle!.includes('Q'), bK: castle!.includes('k'), bQ: castle!.includes('q') },
    ep: ep && ep !== '-' ? sqIndex(ep) : null,
    halfmove: Number(half ?? 0), fullmove: Number(full ?? 1)
  };
}

// ---------- attacks and move generation ----------

/** Is square `sq` attacked by any piece of colour `by`? */
export function attacked(board: (Piece | null)[], sq: number, by: Color): boolean {
  const f = fileOf(sq), r = rankOf(sq);
  const pawnRank = by === 'w' ? r - 1 : r + 1;
  for (const df of [-1, 1]) { const s = at(f + df, pawnRank); if (s >= 0 && board[s] === `${by}P`) return true; }
  for (const [df, dr] of KNIGHT) { const s = at(f + df!, r + dr!); if (s >= 0 && board[s] === `${by}N`) return true; }
  for (const [df, dr] of KING) { const s = at(f + df!, r + dr!); if (s >= 0 && board[s] === `${by}K`) return true; }
  const ray = (dirs: number[][], types: PieceType[]) => dirs.some(([df, dr]) => {
    for (let k = 1; ; k++) {
      const s = at(f + df! * k, r + dr! * k);
      if (s < 0) return false;
      const p = board[s];
      if (p) return colorOf(p) === by && types.includes(typeOf(p));
    }
  });
  return ray(ROOK_DIRS, ['R', 'Q']) || ray(BISHOP_DIRS, ['B', 'Q']);
}

const kingSquare = (board: (Piece | null)[], c: Color) => board.indexOf(`${c}K`);
export const inCheck = (pos: Position, c: Color = pos.turn) => attacked(pos.board, kingSquare(pos.board, c), other(c));

function pseudoMoves(pos: Position): Move[] {
  const { board, turn: c } = pos;
  const out: Move[] = [];
  const add = (from: number, to: number, extra: Partial<Move> = {}) => {
    const captured = board[to] ?? undefined;
    out.push({ from, to, ...(captured ? { captured } : {}), ...extra });
  };
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (!p || colorOf(p) !== c) continue;
    const f = fileOf(sq), r = rankOf(sq);
    const t = typeOf(p);
    if (t === 'P') {
      const dir = c === 'w' ? 1 : -1;
      const last = c === 'w' ? 7 : 0;
      const pushPawn = (to: number, extra: Partial<Move> = {}) => {
        if (rankOf(to) === last) for (const promo of ['Q', 'R', 'B', 'N'] as PromoType[]) add(sq, to, { ...extra, promo });
        else add(sq, to, extra);
      };
      const one = at(f, r + dir);
      if (one >= 0 && !board[one]) {
        pushPawn(one);
        const two = at(f, r + 2 * dir);
        if (r === (c === 'w' ? 1 : 6) && !board[two]) add(sq, two, { flag: 'double' });
      }
      for (const df of [-1, 1]) {
        const to = at(f + df, r + dir);
        if (to < 0) continue;
        if (board[to] && colorOf(board[to]!) !== c) pushPawn(to);
        else if (to === pos.ep) out.push({ from: sq, to, flag: 'ep', captured: `${other(c)}P` });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [df, dr] of t === 'N' ? KNIGHT : KING) {
        const to = at(f + df!, r + dr!);
        if (to >= 0 && (!board[to] || colorOf(board[to]!) !== c)) add(sq, to);
      }
      if (t === 'K') {
        const home = c === 'w' ? 4 : 60;
        const opp = other(c);
        if (sq === home && !attacked(board, home, opp)) {
          const rights = c === 'w' ? [pos.castling.wK, pos.castling.wQ] : [pos.castling.bK, pos.castling.bQ];
          if (rights[0] && !board[home + 1] && !board[home + 2] && board[home + 3] === `${c}R`
            && !attacked(board, home + 1, opp) && !attacked(board, home + 2, opp)) out.push({ from: sq, to: home + 2, flag: 'castleK' });
          if (rights[1] && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === `${c}R`
            && !attacked(board, home - 1, opp) && !attacked(board, home - 2, opp)) out.push({ from: sq, to: home - 2, flag: 'castleQ' });
        }
      }
    } else {
      const dirs = t === 'R' ? ROOK_DIRS : t === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [df, dr] of dirs) {
        for (let k = 1; ; k++) {
          const to = at(f + df! * k, r + dr! * k);
          if (to < 0) break;
          if (board[to]) { if (colorOf(board[to]!) !== c) add(sq, to); break; }
          add(sq, to);
        }
      }
    }
  }
  return out;
}

/** Apply a move (no legality check). Returns a new position. */
export function makeMove(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const piece = board[m.from]!;
  const c = colorOf(piece);
  board[m.to] = m.promo ? (`${c}${m.promo}` as Piece) : piece;
  board[m.from] = null;
  if (m.flag === 'ep') board[m.to + (c === 'w' ? -8 : 8)] = null;
  if (m.flag === 'castleK') { board[m.from + 1] = board[m.from + 3]!; board[m.from + 3] = null; }
  if (m.flag === 'castleQ') { board[m.from - 1] = board[m.from - 4]!; board[m.from - 4] = null; }
  const castling = { ...pos.castling };
  if (typeOf(piece) === 'K') { if (c === 'w') { castling.wK = false; castling.wQ = false; } else { castling.bK = false; castling.bQ = false; } }
  for (const s of [m.from, m.to]) {
    if (s === 0) castling.wQ = false;
    if (s === 7) castling.wK = false;
    if (s === 56) castling.bQ = false;
    if (s === 63) castling.bK = false;
  }
  return {
    board, turn: other(c), castling,
    ep: m.flag === 'double' ? (m.from + m.to) / 2 : null,
    halfmove: typeOf(piece) === 'P' || m.captured ? 0 : pos.halfmove + 1,
    fullmove: pos.fullmove + (c === 'b' ? 1 : 0)
  };
}

/** All legal moves for the side to move. */
export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter((m) => !inCheck(makeMove(pos, m), pos.turn));
}

/** Move-path enumeration count (move generator verification). */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(pos, m), depth - 1);
  return n;
}

/** Repetition key: placement, side to move, castling rights and a *capturable* en-passant square. */
function positionKey(pos: Position): string {
  const epLive = pos.ep !== null && legalMoves(pos).some((m) => m.flag === 'ep');
  const c = pos.castling;
  return `${pos.board.map((p) => p ?? '.').join('')}|${pos.turn}|${+c.wK}${+c.wQ}${+c.bK}${+c.bQ}|${epLive ? pos.ep : '-'}`;
}

/** Neither side can possibly checkmate: K v K, K+minor v K, K+B v K+B with bishops on the same colour. */
export function insufficientMaterial(board: (Piece | null)[]): boolean {
  const pieces = board.map((p, i) => ({ p, i })).filter((x) => x.p && typeOf(x.p) !== 'K') as { p: Piece; i: number }[];
  if (pieces.length === 0) return true;
  if (pieces.length === 1) return typeOf(pieces[0]!.p) === 'B' || typeOf(pieces[0]!.p) === 'N';
  if (pieces.every((x) => typeOf(x.p) === 'B')) {
    const shade = (i: number) => (fileOf(i) + rankOf(i)) % 2;
    return pieces.every((x) => shade(x.i) === shade(pieces[0]!.i));
  }
  return false;
}

/** Can colour `c` ever deliver mate with its material? (Used when the opponent runs out of time.) */
export function canMate(board: (Piece | null)[], c: Color): boolean {
  const own = board.filter((p) => p && colorOf(p) === c && typeOf(p) !== 'K') as Piece[];
  if (own.length === 0) return false;
  if (own.length === 1 && (typeOf(own[0]!) === 'B' || typeOf(own[0]!) === 'N')) return false;
  return true;
}

export function san(pos: Position, m: Move, legal: Move[] = legalMoves(pos)): string {
  const piece = pos.board[m.from]!;
  const t = typeOf(piece);
  let s: string;
  if (m.flag === 'castleK') s = 'O-O';
  else if (m.flag === 'castleQ') s = 'O-O-O';
  else {
    const capture = !!m.captured;
    if (t === 'P') s = (capture ? 'abcdefgh'[fileOf(m.from)]! + 'x' : '') + sqName(m.to) + (m.promo ? `=${m.promo}` : '');
    else {
      const rivals = legal.filter((o) => o.to === m.to && o.from !== m.from && pos.board[o.from] === piece);
      let dis = '';
      if (rivals.length) {
        if (!rivals.some((o) => fileOf(o.from) === fileOf(m.from))) dis = 'abcdefgh'[fileOf(m.from)]!;
        else if (!rivals.some((o) => rankOf(o.from) === rankOf(m.from))) dis = String(rankOf(m.from) + 1);
        else dis = sqName(m.from);
      }
      s = t + dis + (capture ? 'x' : '') + sqName(m.to);
    }
  }
  const next = makeMove(pos, m);
  if (inCheck(next)) s += legalMoves(next).length ? '+' : '#';
  return s;
}

// ---------- module ----------

type Events = Transition<ChessState>['internalEvents'];
const MAX_TIMEOUTS = 1; // a flag fall ends the game (FIDE): the side to move loses on time

const seatOf = (s: ChessState, c: Color) => (s.colors[0] === c ? 0 : 1);
const winOutcome = (winner: number, reason: Outcome['reason']): Outcome => ({ placements: [{ seat: winner, place: 1 }, { seat: 1 - winner, place: 2 }], reason });
const drawOutcome = (): Outcome => ({ placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' });

const finish = (s: ChessState, events: Events): Transition<ChessState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function findMove(s: ChessState, a: Extract<ChessAction, { type: 'move' }>): Move | undefined {
  const from = sqIndex(a.from), to = sqIndex(a.to);
  return legalMoves(s.pos).find((m) => m.from === from && m.to === to && (m.promo ?? undefined) === (a.promotion ?? undefined));
}

export const chessModule: GameModule<ChessState, ChessAction, ChessView> = {
  manifest: chess.manifest,
  actionSchema: chessAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('chess needs exactly 2 players');
    // Variant "firstMove" (who plays White): random (default) or the host. The RNG is drawn either way.
    const drawn = rng.nextInt(2);
    const white = options.firstMove === 'host' ? 0 : drawn;
    const pos = fromFen(typeof options.fen === 'string' ? options.fen : START_FEN);
    const colors: [Color, Color] = white === 0 ? ['w', 'b'] : ['b', 'w'];
    return { pos, colors, history: [], seen: { [positionKey(pos)]: 1 }, drawOffer: null, timeouts: [0, 0], end: null, outcome: null };
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.pos.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'acceptDraw') return s.drawOffer === 1 - actor.seat ? { ok: true } : { ok: false, errorCode: 'NO_DRAW_OFFER' };
    const piece = s.pos.board[sqIndex(a.from)];
    if (!piece || colorOf(piece) !== s.pos.turn) return { ok: false, errorCode: 'NOT_YOUR_PIECE' };
    const candidates = legalMoves(s.pos).filter((m) => m.from === sqIndex(a.from) && m.to === sqIndex(a.to));
    if (!candidates.length) return { ok: false, errorCode: 'ILLEGAL_MOVE' };
    if (candidates.some((m) => m.promo) !== !!a.promotion) return { ok: false, errorCode: a.promotion ? 'PROMOTION_NOT_ALLOWED' : 'PROMOTION_REQUIRED' };
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.end = { kind: 'resign' };
      s.outcome = winOutcome(1 - seat, 'resign');
      return finish(s, [{ type: 'resigned', seat }]);
    }
    if (a.type === 'acceptDraw') {
      s.end = { kind: 'draw', draw: 'agreement' };
      s.outcome = drawOutcome();
      return finish(s, [{ type: 'drawAgreed', seat }]);
    }
    const m = findMove(s, a)!;
    const before = s.pos;
    const notation = san(before, m);
    s.pos = makeMove(before, m);
    s.history.push({ san: notation, from: a.from, to: a.to, color: before.turn });
    s.timeouts[seat] = 0;
    // A pending offer lapses when its receiver moves instead of accepting; a new one goes with this move.
    s.drawOffer = a.offerDraw ? seat : null;
    const key = positionKey(s.pos);
    s.seen[key] = (s.seen[key] ?? 0) + 1;
    const events: Events = [{ type: 'moved', seat, san: notation }];
    const replies = legalMoves(s.pos);
    const draw = (reason: DrawReason) => { s.end = { kind: 'draw', draw: reason }; s.outcome = drawOutcome(); s.drawOffer = null; };
    if (!replies.length) {
      if (inCheck(s.pos)) { s.end = { kind: 'checkmate' }; s.outcome = winOutcome(seat, 'win'); s.drawOffer = null; }
      else draw('stalemate');
    } else if (insufficientMaterial(s.pos.board)) draw('material');
    else if (s.seen[key]! >= 3) draw('repetition');
    else if (s.pos.halfmove >= 100) draw('fiftyMove');
    return finish(s, events);
  },

  project(s) {
    const captured = { w: [] as Piece[], b: [] as Piece[] };
    const count = (p: Piece) => s.pos.board.filter((x) => x === p).length;
    const START: Record<PieceType, number> = { K: 1, Q: 1, R: 2, B: 2, N: 2, P: 8 };
    for (const c of ['w', 'b'] as Color[]) {
      for (const t of ['Q', 'R', 'B', 'N', 'P'] as PieceType[]) {
        // Promotions can make counts exceed the start; only missing pieces are shown as captured.
        const missing = START[t] - count(`${c}${t}`);
        for (let i = 0; i < missing; i++) captured[c].push(`${c}${t}`);
      }
    }
    const last = s.history.at(-1);
    return {
      board: s.pos.board.slice(), turn: s.pos.turn, colors: [...s.colors] as [Color, Color],
      current: s.outcome ? null : seatOf(s, s.pos.turn),
      inCheck: inCheck(s.pos),
      lastMove: last ? { from: last.from, to: last.to } : null,
      history: s.history.slice(), captured, drawOffer: s.drawOffer, halfmove: s.pos.halfmove,
      end: s.end, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (s.colors[viewer.seat] === s.pos.turn) {
      for (const m of legalMoves(s.pos)) out.push({ type: 'move', from: sqName(m.from), to: sqName(m.to), ...(m.promo ? { promotion: m.promo } : {}) });
      if (s.drawOffer === 1 - viewer.seat) out.push({ type: 'acceptDraw' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.pos.turn);
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      // FIDE 6.9: a flag fall loses, unless the opponent cannot checkmate by any series of legal moves → draw.
      if (canMate(s.pos.board, other(s.pos.turn))) { s.end = { kind: 'timeout' }; s.outcome = winOutcome(1 - seat, 'timeout'); }
      else { s.end = { kind: 'draw', draw: 'timeoutMaterial' }; s.outcome = drawOutcome(); }
    }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.pos.turn)]),

  tutorial: {
    seed: 3,
    options: { firstMove: 'host' },
    introFa: 'شما با مهره‌های سفید بازی می‌کنید و اول حرکت می‌کنید. هدف «کیش و مات» است: شاه حریف زیر حمله باشد و هیچ راه فراری نداشته باشد.',
    steps: [
      { instructionFa: 'سرباز جلوی شاه را دو خانه جلو ببرید: از e2 به e4. سرباز در اولین حرکتش می‌تواند دو خانه برود.', expected: { type: 'move', from: 'e2', to: 'e4' }, reply: { type: 'move', from: 'e7', to: 'e5' } },
      { instructionFa: 'فیل روی قطرها حرکت می‌کند. فیل f1 را به c4 ببرید تا خانه f7 را نشانه بگیرد.', expected: { type: 'move', from: 'f1', to: 'c4' }, reply: { type: 'move', from: 'b8', to: 'c6' } },
      { instructionFa: 'وزیر قوی‌ترین مهره است و در هر جهت مستقیم یا قطری حرکت می‌کند. وزیر را از d1 به h5 ببرید.', expected: { type: 'move', from: 'd1', to: 'h5' }, reply: { type: 'move', from: 'g8', to: 'f6' } },
      { instructionFa: 'حریف اشتباه کرد! با وزیر سرباز f7 را بزنید (h5 به f7). فیل c4 از وزیر پشتیبانی می‌کند و شاه سیاه راه فرار ندارد.', expected: { type: 'move', from: 'h5', to: 'f7' }, reply: null }
    ],
    completedFa: 'کیش و مات! این «مات چهارحرکتی» است. در بازی واقعی قلعه‌رفتن، آن‌پاسان، ارتقای سرباز و تساوی (پات، تکرار سه‌باره، قانون ۵۰ حرکت) هم وجود دارد.'
  }
};
