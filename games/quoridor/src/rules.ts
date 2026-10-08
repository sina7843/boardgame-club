// Quoridor («کوریدور»): 9×9 board, 2–4 players (3 is an unofficial but common variant). Each pawn starts in the middle
// of its own edge and wins by reaching the opposite edge. A turn is a pawn step or a wall. Walls are two cells long,
// may not overlap or cross, and may never cut off any pawn's last path to its goal. An adjacent pawn may be jumped
// straight over; if a wall or the edge is behind it, the jump goes diagonally to either side instead.
//
// Cells: index = r * 9 + c, r 0 = the bottom edge (seat 0's start). Walls are anchored at (r, c) with r, c in 0..7:
//   'h' lies between rows r and r+1 across columns c and c+1; 'v' lies between columns c and c+1 across rows r and r+1.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { quoridor } from './definition.ts';

export const N = 9;
export type Orient = 'h' | 'v';
export interface Wall { r: number; c: number; o: Orient }
/** Start edge per seat position: bottom, left, top, right (clockwise). */
export type Side = 'bottom' | 'left' | 'top' | 'right';

export interface QuoridorState {
  players: number;
  sides: Side[];
  pawns: number[];
  wallsLeft: number[];
  walls: Wall[];
  active: boolean[];
  current: number;
  timeouts: number[];
  log: ({ seq: number; seat: number } & ({ t: 'move'; from: number; to: number } | { t: 'wall'; wall: Wall } | { t: 'out'; why: 'timeout' | 'resign' }))[];
  seq: number;
  winner: number | null;
  outcome: Outcome | null;
}
export type QuoridorView = Omit<QuoridorState, 'timeouts' | 'seq'> & { distances: (number | null)[] };

const cell = z.number().int().min(0).max(80);
const anchor = z.number().int().min(0).max(7);
export const quoridorAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), to: cell }),
  z.strictObject({ type: z.literal('wall'), r: anchor, c: anchor, o: z.enum(['h', 'v']) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type QuoridorAction = z.infer<typeof quoridorAction>;

const rc = (i: number) => [Math.floor(i / N), i % N] as const;
const idx = (r: number, c: number) => r * N + c;
const inside = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

export const START: Record<Side, number> = { bottom: idx(0, 4), top: idx(8, 4), left: idx(4, 0), right: idx(4, 8) };
export const atGoal = (side: Side, i: number) => {
  const [r, c] = rc(i);
  return side === 'bottom' ? r === 8 : side === 'top' ? r === 0 : side === 'left' ? c === 8 : c === 0;
};

const hasWall = (walls: Wall[], r: number, c: number, o: Orient) => walls.some((w) => w.r === r && w.c === c && w.o === o);
/** Is the step from (r, c) by (dr, dc) blocked by a wall or the edge? */
export function blocked(walls: Wall[], r: number, c: number, dr: number, dc: number): boolean {
  const r2 = r + dr, c2 = c + dc;
  if (!inside(r2, c2)) return true;
  if (dr === 1) return hasWall(walls, r, c, 'h') || hasWall(walls, r, c - 1, 'h');
  if (dr === -1) return hasWall(walls, r - 1, c, 'h') || hasWall(walls, r - 1, c - 1, 'h');
  if (dc === 1) return hasWall(walls, r, c, 'v') || hasWall(walls, r - 1, c, 'v');
  return hasWall(walls, r, c - 1, 'v') || hasWall(walls, r - 1, c - 1, 'v');
}
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Shortest number of steps to the goal ignoring pawns (null = no path). */
export function distance(walls: Wall[], from: number, side: Side): number | null {
  const seen = new Map<number, number>([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const i = queue.shift()!;
    if (atGoal(side, i)) return seen.get(i)!;
    const [r, c] = rc(i);
    for (const [dr, dc] of STEPS) {
      if (blocked(walls, r, c, dr, dc)) continue;
      const j = idx(r + dr, c + dc);
      if (!seen.has(j)) { seen.set(j, seen.get(i)! + 1); queue.push(j); }
    }
  }
  return null;
}

/** Cells the pawn of `seat` may move to (steps and jumps). */
export function pawnMoves(s: Pick<QuoridorState, 'pawns' | 'walls' | 'active'>, seat: number): number[] {
  const occupied = new Set(s.pawns.filter((_, k) => s.active[k] && k !== seat));
  const [r, c] = rc(s.pawns[seat]!);
  const out = new Set<number>();
  for (const [dr, dc] of STEPS) {
    if (blocked(s.walls, r, c, dr, dc)) continue;
    const n = idx(r + dr, c + dc);
    if (!occupied.has(n)) { out.add(n); continue; }
    // Jump straight over, or diagonally when a wall or the edge is behind the other pawn.
    if (!blocked(s.walls, r + dr, c + dc, dr, dc) && !occupied.has(idx(r + 2 * dr, c + 2 * dc))) { out.add(idx(r + 2 * dr, c + 2 * dc)); continue; }
    for (const [sr, sc] of dr === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]]) {
      if (blocked(s.walls, r + dr, c + dc, sr!, sc!)) continue;
      const d = idx(r + dr + sr!, c + dc + sc!);
      if (!occupied.has(d)) out.add(d);
    }
  }
  return [...out];
}

/** Can this wall be placed (no overlap, no cross, every active pawn keeps a path)? */
export function wallOk(s: Pick<QuoridorState, 'pawns' | 'walls' | 'active' | 'sides'>, w: Wall): boolean {
  if (w.r < 0 || w.r > 7 || w.c < 0 || w.c > 7) return false;
  for (const x of s.walls) {
    if (x.r === w.r && x.c === w.c) return false; // same slot or crossing
    if (x.o === w.o && w.o === 'h' && x.r === w.r && Math.abs(x.c - w.c) === 1) return false;
    if (x.o === w.o && w.o === 'v' && x.c === w.c && Math.abs(x.r - w.r) === 1) return false;
  }
  const walls = [...s.walls, w];
  return s.pawns.every((p, k) => !s.active[k] || distance(walls, p, s.sides[k]!) !== null);
}

// ---------- module ----------

type Events = Transition<QuoridorState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const finish = (s: QuoridorState, events: Events): Transition<QuoridorState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const log = (s: QuoridorState, e: Record<string, unknown>) => { s.log.push({ ...e, seq: ++s.seq } as QuoridorState['log'][number]); if (s.log.length > 30) s.log.shift(); };

function nextTurn(s: QuoridorState) {
  for (let k = 1; k <= s.players; k++) {
    const n = (s.current + k) % s.players;
    if (s.active[n]) { s.current = n; return; }
  }
}

/** Places: winner first, then the others by distance to goal, players who left last. */
function end(s: QuoridorState, winner: number, reason: Outcome['reason']) {
  s.winner = winner;
  const rest = s.pawns.map((p, seat) => ({ seat, d: s.active[seat] ? distance(s.walls, p, s.sides[seat]!) ?? 99 : 999 })).filter((x) => x.seat !== winner).sort((a, b) => a.d - b.d);
  const placements = [{ seat: winner, place: 1 }];
  let place = 2;
  rest.forEach((x, k) => { if (k > 0 && x.d !== rest[k - 1]!.d) place = k + 2; placements.push({ seat: x.seat, place }); });
  s.outcome = { placements, reason };
}

function leave(s: QuoridorState, seat: number, why: 'timeout' | 'resign') {
  s.active[seat] = false;
  log(s, { t: 'out', seat, why });
  const left = s.active.map((a, k) => (a ? k : -1)).filter((k) => k >= 0);
  if (left.length === 1) { end(s, left[0]!, why); return; }
  if (s.current === seat) nextTurn(s);
}

export const quoridorModule: GameModule<QuoridorState, QuoridorAction, QuoridorView> = {
  manifest: quoridor.manifest,
  actionSchema: quoridorAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('quoridor needs 2–4 players');
    const sides: Side[] = playerCount === 2 ? ['bottom', 'top'] : playerCount === 3 ? ['bottom', 'left', 'top'] : ['bottom', 'left', 'top', 'right'];
    const per = playerCount === 2 ? 10 : playerCount === 3 ? 7 : 5;
    const s: QuoridorState = {
      players: playerCount, sides, pawns: sides.map((x) => START[x]), wallsLeft: sides.map(() => per), walls: [],
      active: sides.map(() => true), current: options.firstMove === 'host' ? 0 : rng.nextInt(playerCount),
      timeouts: sides.map(() => 0), log: [], seq: 0, winner: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // Both pawns are one step from their goal; it is the learner's turn: block first, then win.
      s.current = 0;
      s.pawns = [idx(7, 4), idx(1, 4)];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || !s.active[actor.seat]) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'move') return pawnMoves(s, actor.seat).includes(a.to) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
    if (s.wallsLeft[actor.seat]! <= 0) return { ok: false, errorCode: 'NO_WALLS_LEFT' };
    return wallOk(s, a) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_WALL' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { leave(s, seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'move') {
      log(s, { t: 'move', seat, from: s.pawns[seat], to: a.to });
      s.pawns[seat] = a.to;
      if (atGoal(s.sides[seat]!, a.to)) { end(s, seat, 'win'); return finish(s, [{ type: 'won', seat }]); }
    } else {
      const wall = { r: a.r, c: a.c, o: a.o };
      s.walls.push(wall);
      s.wallsLeft[seat]! -= 1;
      log(s, { t: 'wall', seat, wall });
    }
    nextTurn(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { timeouts: _t, seq: _q, ...rest } = s;
    void _t; void _q;
    return { ...structuredClone(rest), distances: s.pawns.map((p, k) => (s.active[k] ? distance(s.walls, p, s.sides[k]!) : null)) };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) {
      for (const to of pawnMoves(s, viewer.seat)) out.push({ type: 'move', to });
      // Walls are checked on the client with wallOk(); one hint says walls may be placed.
      if (s.wallsLeft[viewer.seat]! > 0) out.push({ type: 'wall' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { leave(s, seat, 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    // Passive play: step along a shortest path.
    const moves = pawnMoves(s, seat);
    const best = moves.map((to) => ({ to, d: distance(s.walls, to, s.sides[seat]!) ?? 99 })).sort((x, y) => x.d - y.d)[0];
    if (best) {
      log(s, { t: 'move', seat, from: s.pawns[seat], to: best.to });
      s.pawns[seat] = best.to;
      if (atGoal(s.sides[seat]!, best.to)) { end(s, seat, 'win'); return finish(s, [{ type: 'timed-out', seat }]); }
    }
    nextTurn(s);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 6,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'مهره شما (پایین) باید به ردیف بالای صفحه برسد و مهره حریف به ردیف پایین. در هر نوبت یا مهره را یک خانه حرکت می‌دهید یا یک دیوار می‌گذارید.',
    steps: [
      { instructionFa: 'حریف فقط یک قدم تا پیروزی فاصله دارد! «دیوار» را انتخاب کنید و دیوار افقی را زیر مهره حریف بگذارید (نقطه روشن).', expected: { type: 'wall', r: 0, c: 4, o: 'h' }, reply: { type: 'move', to: 12 } },
      { instructionFa: 'حریف مجبور شد دور بزند. حالا مهره‌تان را یک خانه بالا ببرید تا به ردیف آخر برسید.', expected: { type: 'move', to: 76 }, reply: null }
    ],
    completedFa: 'بردید! دیوارها مسیر حریف را طولانی می‌کنند، اما هرگز نباید راه کسی را کاملاً ببندند. با دو نفر هر بازیکن ۱۰ دیوار دارد.'
  }
};
