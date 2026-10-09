// Hive («کندو»), base game (no expansions). Each side: 1 Queen Bee, 2 Spiders, 2 Beetles, 3 Grasshoppers,
// 3 Soldier Ants. White starts. Placement: the first piece goes in the centre, the second next to it; afterwards a new
// piece must touch your own pieces and no enemy piece (top colours count). The Queen must be placed by your fourth
// turn, and no piece may move before your Queen is placed. Moves must keep the hive in one piece (One Hive) and
// ground pieces must be able to slide (Freedom to Move). Surround the enemy Queen on all six sides to win (both at
// once = draw). A player with no legal action passes. House limit: 300 turns without a result is a draw.
// Coordinates are axial (q, r); key = "q,r".
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { hive } from './definition.ts';

export type Color = 'w' | 'b';
export type Bug = 'Q' | 'S' | 'B' | 'G' | 'A';
export interface Piece { c: Color; t: Bug }
export type Hex = [number, number];
export const START_RESERVE: Record<Bug, number> = { Q: 1, S: 2, B: 2, G: 3, A: 3 };
export const DIRS: Hex[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MAX_TURNS = 300;

export interface HiveState {
  /** Stacks bottom → top, keyed "q,r". Empty stacks are deleted. */
  stacks: Record<string, Piece[]>;
  colors: [Color, Color];
  turn: Color;
  turnNo: number;
  placed: Record<Color, number>;
  reserve: Record<Color, Record<Bug, number>>;
  history: ({ seat: number } & ({ t: 'place'; bug: Bug; to: Hex } | { t: 'move'; from: Hex; to: Hex } | { t: 'pass' }))[];
  passes: number;
  timeouts: [number, number];
  end: { kind: 'queen' | 'draw' | 'resign' | 'timeout' | 'limit'; surrounded?: Color[] } | null;
  outcome: Outcome | null;
}
export type HiveView = Omit<HiveState, 'timeouts'> & { current: number | null };

const coord = z.number().int().min(-60).max(60);
const hex = z.tuple([coord, coord]);
export const hiveAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), bug: z.enum(['Q', 'S', 'B', 'G', 'A']), to: hex }),
  z.strictObject({ type: z.literal('move'), from: hex, to: hex }),
  z.strictObject({ type: z.literal('resign') })
]);
export type HiveAction = z.infer<typeof hiveAction>;

export const key = ([q, r]: Hex) => `${q},${r}`;
export const parse = (k: string): Hex => k.split(',').map(Number) as Hex;
export const around = ([q, r]: Hex): Hex[] => DIRS.map(([dq, dr]) => [q + dq, r + dr]);
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const top = (st: Record<string, Piece[]>, h: Hex) => st[key(h)]?.at(-1);
const height = (st: Record<string, Piece[]>, h: Hex) => st[key(h)]?.length ?? 0;
const occupied = (st: Record<string, Piece[]>, h: Hex) => height(st, h) > 0;
const same = (a: Hex, b: Hex) => a[0] === b[0] && a[1] === b[1];

/** The two hexes adjacent to both a and b (a, b adjacent). */
function commons(a: Hex, b: Hex): [Hex, Hex] {
  const na = around(a), nb = around(b).map(key);
  const c = na.filter((h) => nb.includes(key(h)));
  return [c[0]!, c[1]!];
}

/** Can a ground piece slide from a to the empty neighbour b (Freedom to Move + keeps touching the hive)? */
function slides(st: Record<string, Piece[]>, a: Hex, b: Hex): boolean {
  if (occupied(st, b)) return false;
  const [c1, c2] = commons(a, b);
  return occupied(st, c1) !== occupied(st, c2);
}

/** Is the hive still one piece after lifting the top piece at h? */
export function oneHiveWithout(st: Record<string, Piece[]>, h: Hex): boolean {
  if (height(st, h) > 1) return true;
  const cells = Object.keys(st).filter((k) => k !== key(h));
  if (!cells.length) return true;
  const seen = new Set([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length) {
    const k = queue.shift()!;
    for (const n of around(parse(k))) { const nk = key(n); if (nk !== key(h) && st[nk] && !seen.has(nk)) { seen.add(nk); queue.push(nk); } }
  }
  return seen.size === cells.length;
}

const without = (st: Record<string, Piece[]>, h: Hex): Record<string, Piece[]> => {
  const copy = { ...st };
  const stack = copy[key(h)]!.slice(0, -1);
  if (stack.length) copy[key(h)] = stack; else delete copy[key(h)];
  return copy;
};

/** Destinations for the piece on top of `from` (assumes it belongs to the player to move). */
export function destinations(s: Pick<HiveState, 'stacks'>, from: Hex): Hex[] {
  const piece = top(s.stacks, from);
  if (!piece || !oneHiveWithout(s.stacks, from)) return [];
  const st = without(s.stacks, from);
  const touches = (h: Hex) => around(h).some((n) => occupied(st, n));
  const out = new Map<string, Hex>();
  const add = (h: Hex) => { if (!same(h, from) && touches(h)) out.set(key(h), h); };
  if (piece.t === 'Q') for (const n of around(from)) { if (slides(st, from, n)) add(n); }
  if (piece.t === 'B') {
    const h1 = height(st, from);
    for (const n of around(from)) {
      const [c1, c2] = commons(from, n);
      const h2 = height(st, n);
      if (h1 === 0 && h2 === 0) { if (slides(st, from, n)) add(n); continue; }
      // Climbing gate: cannot pass between two stacks taller than both ends.
      if (Math.min(height(st, c1), height(st, c2)) > Math.max(h1, h2)) continue;
      add(n);
    }
  }
  if (piece.t === 'G') {
    for (const [dq, dr] of DIRS) {
      let h: Hex = [from[0] + dq, from[1] + dr];
      if (!occupied(st, h)) continue;
      while (occupied(st, h)) h = [h[0] + dq, h[1] + dr];
      add(h);
    }
  }
  if (piece.t === 'A') {
    const seen = new Set([key(from)]);
    const queue: Hex[] = [from];
    while (queue.length) {
      const h = queue.shift()!;
      for (const n of around(h)) {
        if (seen.has(key(n)) || !slides(st, h, n)) continue;
        seen.add(key(n)); queue.push(n); add(n);
      }
    }
  }
  if (piece.t === 'S') {
    const walk = (h: Hex, path: string[]) => {
      if (path.length === 4) { add(h); return; }
      for (const n of around(h)) if (!path.includes(key(n)) && slides(st, h, n)) walk(n, [...path, key(n)]);
    };
    walk(from, [key(from)]);
  }
  return [...out.values()];
}

/** Hexes where `color` may place a new piece now. */
export function placements(s: Pick<HiveState, 'stacks' | 'placed'>, color: Color): Hex[] {
  const cells = Object.keys(s.stacks);
  if (!cells.length) return [[0, 0]];
  const empties = new Map<string, Hex>();
  for (const k of cells) for (const n of around(parse(k))) if (!occupied(s.stacks, n)) empties.set(key(n), n);
  if (s.placed[color] === 0 && cells.length === 1) return [...empties.values()];
  return [...empties.values()].filter((h) => {
    const tops = around(h).map((n) => top(s.stacks, n)).filter(Boolean) as Piece[];
    return tops.some((p) => p.c === color) && tops.every((p) => p.c === color);
  });
}

const queenPlaced = (s: HiveState, c: Color) => s.reserve[c].Q === 0;
const mustPlaceQueen = (s: HiveState, c: Color) => !queenPlaced(s, c) && s.placed[c] === 3;

/** Every legal action for the side to move (placements and moves). */
export function legalActions(s: HiveState): HiveAction[] {
  const c = s.turn;
  const out: HiveAction[] = [];
  const spots = placements(s, c);
  const bugs = (Object.keys(s.reserve[c]) as Bug[]).filter((b) => s.reserve[c][b] > 0 && (!mustPlaceQueen(s, c) || b === 'Q'));
  for (const b of bugs) for (const to of spots) out.push({ type: 'place', bug: b, to });
  if (queenPlaced(s, c)) {
    for (const k of Object.keys(s.stacks)) {
      const from = parse(k);
      if (top(s.stacks, from)!.c !== c) continue;
      for (const to of destinations(s, from)) out.push({ type: 'move', from, to });
    }
  }
  return out;
}

const surrounded = (s: HiveState, c: Color) => {
  const q = Object.entries(s.stacks).find(([, st]) => st.some((p) => p.c === c && p.t === 'Q'));
  return !!q && around(parse(q[0])).every((n) => occupied(s.stacks, n));
};

// ---------- module ----------

type Events = Transition<HiveState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const seatOf = (s: HiveState, c: Color) => (s.colors[0] === c ? 0 : 1);
const finish = (s: HiveState, events: Events): Transition<HiveState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const draw = (s: HiveState, end: HiveState['end']) => { s.end = end; s.outcome = { placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' }; };
const win = (s: HiveState, c: Color, end: HiveState['end'], reason: Outcome['reason']) => {
  s.end = end;
  s.outcome = { placements: [{ seat: seatOf(s, c), place: 1 }, { seat: 1 - seatOf(s, c), place: 2 }], reason };
};

function doAction(s: HiveState, seat: number, a: Exclude<HiveAction, { type: 'resign' }>) {
  const c = s.turn;
  if (a.type === 'place') {
    (s.stacks[key(a.to)] ??= []).push({ c, t: a.bug });
    s.reserve[c][a.bug] -= 1;
    s.placed[c] += 1;
    s.history.push({ seat, t: 'place', bug: a.bug, to: a.to });
  } else {
    const piece = s.stacks[key(a.from)]!.pop()!;
    if (!s.stacks[key(a.from)]!.length) delete s.stacks[key(a.from)];
    (s.stacks[key(a.to)] ??= []).push(piece);
    s.history.push({ seat, t: 'move', from: a.from, to: a.to });
  }
  s.passes = 0;
  afterTurn(s);
}

function afterTurn(s: HiveState) {
  const sw = surrounded(s, 'w'), sb = surrounded(s, 'b');
  if (sw && sb) { draw(s, { kind: 'draw', surrounded: ['w', 'b'] }); return; }
  if (sw || sb) { win(s, sw ? 'b' : 'w', { kind: 'queen', surrounded: [sw ? 'w' : 'b'] }, 'win'); return; }
  s.turnNo += 1;
  if (s.turnNo >= MAX_TURNS) { draw(s, { kind: 'limit' }); return; }
  s.turn = other(s.turn);
  // Forced passes: a player with nothing to do passes; two in a row is a draw.
  if (!legalActions(s).length) {
    s.history.push({ seat: seatOf(s, s.turn), t: 'pass' });
    s.passes += 1;
    if (s.passes >= 2) { draw(s, { kind: 'draw' }); return; }
    s.turn = other(s.turn);
  }
}

const sameAction = (a: HiveAction, b: HiveAction) => JSON.stringify(a) === JSON.stringify(b);

export const hiveModule: GameModule<HiveState, HiveAction, HiveView> = {
  manifest: hive.manifest,
  actionSchema: hiveAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('hive needs exactly 2 players');
    const whiteSeat = options.firstMove === 'host' ? 0 : rng.nextInt(2);
    const s: HiveState = {
      stacks: {}, colors: whiteSeat === 0 ? ['w', 'b'] : ['b', 'w'], turn: 'w', turnNo: 0, placed: { w: 0, b: 0 },
      reserve: { w: { ...START_RESERVE }, b: { ...START_RESERVE } }, history: [], passes: 0, timeouts: [0, 0], end: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // Mid-game teaching position. The black Queen at (0,0) already touches its own Spider, Ant and the white Queen;
      // the learner fills the other three sides with a Grasshopper jump, a Spider walk and a Soldier Ant run, pinning
      // the black Ant with the Beetle on the way. Both Queens are on the board, so every piece may move.
      const put = (q: number, r: number, c: Color, t: Bug) => { s.stacks[key([q, r])] = [{ c, t }]; s.reserve[c][t] -= 1; s.placed[c] += 1; };
      put(0, 0, 'b', 'Q'); put(0, -1, 'b', 'S'); put(-1, 0, 'b', 'A'); put(-1, -1, 'b', 'G');
      put(1, -1, 'w', 'Q'); put(-2, 0, 'w', 'G'); put(-2, 1, 'w', 'B'); put(2, -2, 'w', 'S');
      s.turnNo = 8;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.colors[actor.seat] !== s.turn) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'move' && !queenPlaced(s, s.turn)) return { ok: false, errorCode: 'QUEEN_FIRST' };
    if (a.type === 'place' && mustPlaceQueen(s, s.turn) && a.bug !== 'Q') return { ok: false, errorCode: 'QUEEN_BY_FOURTH_TURN' };
    return legalActions(s).some((x) => sameAction(x, a)) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { win(s, other(s.colors[seat]!), { kind: 'resign' }, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    doAction(s, seat, a);
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
    // Placements and moves are computed on the client with placements()/destinations(); hints mark the turn.
    if (s.colors[viewer.seat] === s.turn) out.push({ type: 'place' }, ...(queenPlaced(s, s.turn) ? [{ type: 'move' }] : []));
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = seatOf(s, s.turn);
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { win(s, other(s.turn), { kind: 'timeout' }, 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    doAction(s, seat, pick(s, ctx.rng));
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [seatOf(s, s.turn)]),

  tutorial: {
    seed: 12,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'شما سفید هستید و هر دو ملکه روی میزند، پس همهٔ مهره‌ها می‌توانند حرکت کنند. ملکهٔ سیاه از سه طرف گیر افتاده: عنکبوت و مورچهٔ سیاه و ملکهٔ سفید شما. اگر سه خانهٔ خالی دیگرِ کنارش را هم پر کنید (با مهره‌ای از هر رنگ)، برنده‌اید. در هر نوبت یا یک مهرهٔ تازه می‌گذارید یا یک مهره را حرکت می‌دهید.',
    steps: [
      { instructionFa: 'عنکبوت سفید را بزنید و به خانهٔ روشن کنار ملکهٔ سیاه ببرید. عنکبوت همیشه دقیقاً سه خانه دور لبهٔ کندو سُر می‌خورد، نه کمتر و نه بیشتر، و به خانه‌ای که از آن گذشته برنمی‌گردد.', expected: { type: 'move', from: [2, -2], to: [0, 1] }, reply: { type: 'place', bug: 'A', to: [0, -2] } },
      { instructionFa: 'حالا ملخ سفید را بزنید. ملخ سُر نمی‌خورد، بلکه در یک خط راست از روی یک یا چند مهرهٔ پشت سر هم می‌پرد و در اولین خانهٔ خالی فرود می‌آید. از روی مورچه و ملکهٔ سیاه بپرید و در خانهٔ روشن آن طرف ملکه بنشینید.', expected: { type: 'move', from: [-2, 0], to: [1, 0] }, reply: { type: 'move', from: [0, -2], to: [1, -2] } },
      { instructionFa: 'حریف مورچه‌اش را کنار ملکهٔ شما آورد. یک «مورچه» تازه از ذخیره‌تان بگذارید، در خانهٔ روشن. مهرهٔ تازه باید به مهره‌های خودتان بچسبد و به هیچ مهرهٔ حریف نچسبد.', expected: { type: 'place', bug: 'A', to: [2, 0] }, reply: { type: 'place', bug: 'G', to: [-1, -2] } },
      { instructionFa: 'سوسک را بزنید و روی مورچهٔ سیاهِ کنار ملکه ببرید. سوسک یک خانه حرکت می‌کند ولی می‌تواند از مهره‌ها بالا برود. مهره‌ای که زیر سوسک است نمی‌تواند حرکت کند؛ حالا مورچهٔ سیاه نمی‌تواند از کنار ملکه‌اش فرار کند و راه را باز کند.', expected: { type: 'move', from: [-2, 1], to: [-1, 0] }, reply: { type: 'place', bug: 'B', to: [-2, -1] } },
      { instructionFa: 'فقط یک خانهٔ خالی کنار ملکهٔ سیاه مانده. مورچه هر چند خانه که بخواهد دور کندو سُر می‌خورد: مورچهٔ تازه‌تان را بزنید و دور کندو تا آخرین خانهٔ خالی کنار ملکهٔ سیاه ببرید.', expected: { type: 'move', from: [2, 0], to: [-1, 1] }, reply: null }
    ],
    completedFa: 'بردید! هر شش خانهٔ کنار ملکهٔ سیاه پر شد: عنکبوت، ملخ و مورچهٔ شما، ملکهٔ سفیدتان، سوسکتان روی مورچهٔ سیاه، و عنکبوت خود سیاه. مهره‌های هر رنگی در محاصره حساب می‌شوند. یادتان باشد: کندو هرگز نباید دو تکه شود، پس مهره‌ای که برداشتنش کندو را جدا می‌کند قفل است؛ و مهره‌های روی زمین از شکافی که برایشان تنگ است رد نمی‌شوند.'
  }
};

function pick(s: HiveState, rng: EngineRng): Exclude<HiveAction, { type: 'resign' }> {
  const all = legalActions(s) as Exclude<HiveAction, { type: 'resign' }>[];
  return all[rng.nextInt(all.length)]!;
}
