// Tak («تاک»), standard rules. Each player's first turn places one of the OPPONENT's flat stones. Then a turn is:
// place a stone on an empty square (flat, standing wall, or capstone), or move a stack you control (your stone on
// top): lift up to `size` stones, move in a straight line and drop at least one stone on every square passed. Walls
// and capstones block; a capstone moving alone onto a wall flattens it. A road (flats and capstones) connecting two
// opposite edges wins — if a move makes roads for both, the mover wins. Otherwise, when the board is full or a
// player has placed all stones, the most top flats wins (equal = draw).
// Board: index = r * size + c, r 0 = bottom (white's side).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { tak } from './definition.ts';

export type Color = 'w' | 'b';
export type Kind = 'F' | 'S' | 'C';
export interface Stone { c: Color; t: Kind }
export type Dir = 'n' | 's' | 'e' | 'w';
export const PIECES: Record<number, { stones: number; caps: number }> = { 4: { stones: 15, caps: 0 }, 5: { stones: 21, caps: 1 }, 6: { stones: 30, caps: 1 } };

export interface TakState {
  size: number;
  /** Stacks bottom → top. */
  board: Stone[][];
  /** colors[seat] */
  colors: [Color, Color];
  turn: Color;
  ply: number;
  reserve: Record<Color, { stones: number; caps: number }>;
  history: ({ seat: number } & ({ t: 'place'; at: number; kind: Kind; color: Color } | { t: 'move'; from: number; dir: Dir; drops: number[] }))[];
  timeouts: [number, number];
  end: { kind: 'road' | 'flats' | 'resign' | 'timeout'; road?: number[]; flats?: Record<Color, number> } | null;
  outcome: Outcome | null;
}
export type TakView = Omit<TakState, 'timeouts'> & { current: number | null };

const sq = z.number().int().min(0).max(35);
export const takAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), at: sq, kind: z.enum(['F', 'S', 'C']) }),
  z.strictObject({ type: z.literal('move'), from: sq, dir: z.enum(['n', 's', 'e', 'w']), drops: z.array(z.number().int().min(1).max(6)).min(1).max(5) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type TakAction = z.infer<typeof takAction>;

const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const top = (st: Stone[]) => st[st.length - 1];
export const step = (i: number, dir: Dir, size: number): number | null => {
  const r = Math.floor(i / size), c = i % size;
  const [r2, c2] = dir === 'n' ? [r + 1, c] : dir === 's' ? [r - 1, c] : dir === 'e' ? [r, c + 1] : [r, c - 1];
  return r2 >= 0 && r2 < size && c2 >= 0 && c2 < size ? r2 * size + c2 : null;
};

/** Is this move legal for `color` (who controls the stack)? */
export function moveOk(s: Pick<TakState, 'board' | 'size'>, color: Color, from: number, dir: Dir, drops: number[]): boolean {
  const stack = s.board[from]!;
  const lift = drops.reduce((a, b) => a + b, 0);
  if (!stack.length || top(stack)!.c !== color || lift > s.size || lift > stack.length || drops.some((d) => d < 1)) return false;
  const carried = stack.slice(stack.length - lift);
  let at = from;
  let left = lift;
  for (let k = 0; k < drops.length; k++) {
    const nxt = step(at, dir, s.size);
    if (nxt === null) return false;
    const t = top(s.board[nxt]!);
    if (t?.t === 'C') return false;
    if (t?.t === 'S') {
      // Only a lone capstone, as the very last drop, may flatten a wall.
      const lastDrop = k === drops.length - 1;
      if (!(lastDrop && drops[k] === 1 && carried[carried.length - 1]!.t === 'C')) return false;
    }
    left -= drops[k]!;
    at = nxt;
  }
  return left === 0;
}

/** Every legal move for `color` (used by tests, the client and timeouts). */
export function allMoves(s: Pick<TakState, 'board' | 'size'>, color: Color): { from: number; dir: Dir; drops: number[] }[] {
  const out: { from: number; dir: Dir; drops: number[] }[] = [];
  const parts = (n: number): number[][] => (n === 0 ? [[]] : Array.from({ length: n }, (_, k) => k + 1).flatMap((d) => parts(n - d).map((rest) => [d, ...rest])));
  for (let from = 0; from < s.board.length; from++) {
    const st = s.board[from]!;
    if (!st.length || top(st)!.c !== color) continue;
    for (let lift = 1; lift <= Math.min(st.length, s.size); lift++) {
      for (const dir of ['n', 's', 'e', 'w'] as Dir[]) {
        for (const drops of parts(lift)) if (moveOk(s, color, from, dir, drops)) out.push({ from, dir, drops });
      }
    }
  }
  return out;
}

/** Road squares for `color` connecting opposite edges, or null. */
export function road(board: Stone[][], size: number, color: Color): number[] | null {
  const owns = (i: number) => { const t = top(board[i]!); return !!t && t.c === color && t.t !== 'S'; };
  const search = (starts: number[], goal: (i: number) => boolean) => {
    const prev = new Map<number, number>();
    const queue = starts.filter(owns);
    for (const q of queue) prev.set(q, -1);
    while (queue.length) {
      const i = queue.shift()!;
      if (goal(i)) { const path = [i]; let p = prev.get(i)!; while (p !== -1) { path.push(p); p = prev.get(p)!; } return path; }
      for (const d of ['n', 's', 'e', 'w'] as Dir[]) {
        const j = step(i, d, size);
        if (j !== null && owns(j) && !prev.has(j)) { prev.set(j, i); queue.push(j); }
      }
    }
    return null;
  };
  const idx = Array.from({ length: size }, (_, k) => k);
  return search(idx.map((c) => c), (i) => Math.floor(i / size) === size - 1)
    ?? search(idx.map((r) => r * size), (i) => i % size === size - 1);
}

export const flats = (board: Stone[][]) => {
  const n: Record<Color, number> = { w: 0, b: 0 };
  for (const st of board) { const t = top(st); if (t?.t === 'F') n[t.c]++; }
  return n;
};

// ---------- module ----------

type Events = Transition<TakState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const seatOf = (s: TakState, c: Color) => (s.colors[0] === c ? 0 : 1);
const finish = (s: TakState, events: Events): Transition<TakState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const winner = (s: TakState, c: Color, end: TakState['end'], reason: Outcome['reason']) => {
  s.end = end;
  s.outcome = { placements: [{ seat: seatOf(s, c), place: 1 }, { seat: 1 - seatOf(s, c), place: 2 }], reason };
};

function checkEnd(s: TakState, mover: Color) {
  const mine = road(s.board, s.size, mover);
  const theirs = road(s.board, s.size, other(mover));
  if (mine || theirs) { winner(s, mine ? mover : other(mover), { kind: 'road', road: mine ?? theirs! }, 'win'); return; }
  const full = s.board.every((st) => st.length > 0);
  const out = (['w', 'b'] as Color[]).some((c) => s.reserve[c].stones === 0 && s.reserve[c].caps === 0);
  if (!full && !out) return;
  const f = flats(s.board);
  if (f.w === f.b) {
    s.end = { kind: 'flats', flats: f };
    s.outcome = { placements: [{ seat: 0, place: 1, score: f[s.colors[0]] }, { seat: 1, place: 1, score: f[s.colors[1]] }], reason: 'draw' };
    return;
  }
  const w: Color = f.w > f.b ? 'w' : 'b';
  s.end = { kind: 'flats', flats: f };
  s.outcome = { placements: [0, 1].map((seat) => ({ seat, place: s.colors[seat] === w ? 1 : 2, score: f[s.colors[seat]!] })), reason: 'score' };
}

function doPlace(s: TakState, seat: number, at: number, kind: Kind) {
  // Opening: each player's first stone is a flat of the opponent's colour.
  const color = s.ply < 2 ? other(s.turn) : s.turn;
  const r = s.reserve[color];
  if (kind === 'C') r.caps -= 1; else r.stones -= 1;
  s.board[at] = [{ c: color, t: kind }];
  s.history.push({ seat, t: 'place', at, kind, color });
}

function doMove(s: TakState, seat: number, from: number, dir: Dir, drops: number[]) {
  const stack = s.board[from]!;
  const lift = drops.reduce((a, b) => a + b, 0);
  const carried = stack.splice(stack.length - lift, lift);
  let at = from;
  for (const d of drops) {
    at = step(at, dir, s.size)!;
    const t = top(s.board[at]!);
    if (t?.t === 'S') t.t = 'F'; // flattened by the capstone
    s.board[at]!.push(...carried.splice(0, d));
  }
  s.history.push({ seat, t: 'move', from, dir, drops });
}

function advance(s: TakState, mover: Color) {
  s.ply += 1;
  checkEnd(s, mover);
  if (!s.outcome) s.turn = other(s.turn);
}

function passiveAction(s: TakState, rng: EngineRng): TakAction {
  const empty = s.board.map((st, i) => (st.length ? -1 : i)).filter((i) => i >= 0);
  if (empty.length && (s.ply < 2 || s.reserve[s.turn].stones > 0)) return { type: 'place', at: empty[rng.nextInt(empty.length)]!, kind: 'F' };
  const moves = allMoves(s, s.turn);
  return { type: 'move', ...moves[rng.nextInt(moves.length)]! };
}

export const takModule: GameModule<TakState, TakAction, TakView> = {
  manifest: tak.manifest,
  actionSchema: takAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('tak needs exactly 2 players');
    const size = [4, 5, 6].includes(Number(options.size)) ? Number(options.size) : 5;
    const whiteSeat = options.firstMove === 'host' ? 0 : rng.nextInt(2);
    const p = PIECES[size]!;
    const s: TakState = {
      size, board: Array.from({ length: size * size }, () => []), colors: whiteSeat === 0 ? ['w', 'b'] : ['b', 'w'], turn: 'w', ply: 0,
      reserve: { w: { ...p }, b: { ...p } }, history: [], timeouts: [0, 0], end: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // 5×5: white flats a1–d1 (one short of a road); black flats a3–d3 threaten the same along row 3.
      for (const c of [0, 1, 2, 3]) { s.board[c] = [{ c: 'w', t: 'F' }]; s.board[10 + c] = [{ c: 'b', t: 'F' }]; }
      s.reserve = { w: { stones: 17, caps: 1 }, b: { stones: 17, caps: 1 } };
      s.ply = 8;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'place') {
      if (a.at >= s.board.length) return { ok: false, errorCode: 'OFF_BOARD' };
      if (s.board[a.at]!.length) return { ok: false, errorCode: 'SQUARE_TAKEN' };
      if (s.ply < 2 && a.kind !== 'F') return { ok: false, errorCode: 'FIRST_MOVE_FLAT' };
      const r = s.reserve[s.ply < 2 ? other(s.turn) : s.turn];
      return (a.kind === 'C' ? r.caps : r.stones) > 0 ? { ok: true } : { ok: false, errorCode: 'NO_PIECES_LEFT' };
    }
    if (s.ply < 2) return { ok: false, errorCode: 'FIRST_MOVE_FLAT' };
    return a.from < s.board.length && moveOk(s, s.turn, a.from, a.dir, a.drops) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { winner(s, other(s.colors[seat]!), { kind: 'resign' }, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    const mover = s.turn;
    if (a.type === 'place') doPlace(s, seat, a.at, a.kind); else doMove(s, seat, a.from, a.dir, a.drops);
    advance(s, mover);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = s;
    void _t;
    return { ...structuredClone(rest), current: s.outcome ? null : seatOf(s, s.turn) };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    // Placements and moves are checked on the client with moveOk/allMoves; hints only say what kind of turn is due.
    if (s.colors[viewer.seat] === s.turn) out.push({ type: 'place' }, ...(s.ply >= 2 ? [{ type: 'move' }] : []));
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { winner(s, other(s.turn), { kind: 'timeout' }, 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    const a = passiveAction(s, ctx.rng);
    const mover = s.turn;
    if (a.type === 'place') doPlace(s, seat, a.at, a.kind); else if (a.type === 'move') doMove(s, seat, a.from, a.dir, a.drops);
    advance(s, mover);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.turn)]),

  tutorial: {
    seed: 10,
    options: { firstMove: 'host', deal: 'tutorial', size: 5 },
    introFa: 'شما سفید هستید. «جاده» یعنی زنجیره‌ای از سنگ‌های تخت (یا سنگ سرستون) شما که دو لبه روبه‌روی صفحه را به هم وصل کند. سیاه هم یک خانه تا جاده‌اش فاصله دارد!',
    steps: [
      { instructionFa: 'جاده سیاه را ببندید: «دیوار» را انتخاب کنید و در خانه روشن ردیف سوم بگذارید. دیوار جزو جاده حساب نمی‌شود و نمی‌شود رویش رفت.', expected: { type: 'place', at: 14, kind: 'S' }, reply: { type: 'place', at: 24, kind: 'F' } },
      { instructionFa: 'حالا «سنگ تخت» را در خانه روشن ردیف اول بگذارید تا جاده‌تان کامل شود.', expected: { type: 'place', at: 4, kind: 'F' }, reply: null }
    ],
    completedFa: 'بردید! در تاک می‌توانید پشته‌ها را هم جابه‌جا کنید: سنگ‌های بالای پشته‌ای که مال شماست را بردارید و در یک خط، روی هر خانه دست‌کم یکی بگذارید.'
  }
};
