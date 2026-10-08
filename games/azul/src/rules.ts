// Azul («کاشی‌کار»), 2–4 players. 100 tiles (5 colours × 20) drawn from a bag into 5/7/9 factories of four. A turn:
// take every tile of one colour from a factory (the rest goes to the centre) or from the centre (the first to do so
// also takes the first-player marker onto their floor), then put them on one pattern line (line n holds n tiles, one
// colour, not a colour already on that wall row) — overflow, or a direct choice, goes to the floor (−1 −1 −2 −2 −2 −3
// −3; further tiles are discarded). When the factories and centre are empty, each full line moves one tile to its
// fixed wall spot and scores 1, or the length of the touching horizontal plus vertical runs; leftover tiles go to the
// lid; the marker holder starts the next round. The game ends after a round in which a wall row is completed. Bonus:
// rows +2, columns +7, complete colours +10. Tie → more complete rows, else shared. Hidden: bag order only.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { azul } from './definition.ts';

export const COLORS = ['b', 'y', 'r', 'k', 'w'] as const;
export type Color = (typeof COLORS)[number];
/** Colour of wall cell (row, col). */
export const wallColor = (row: number, col: number) => COLORS[(col - row + 5) % 5]!;
export const wallCol = (row: number, c: Color) => (COLORS.indexOf(c) + row) % 5;
export const FLOOR = [-1, -1, -2, -2, -2, -3, -3];

export interface Board { lines: { color: Color | null; n: number }[]; wall: boolean[][]; floor: (Color | 'first')[]; score: number }
export interface AzulState {
  players: number;
  bag: Color[];
  lid: Color[];
  factories: Color[][];
  center: Color[];
  firstInCenter: boolean;
  boards: Board[];
  current: number;
  nextStarter: number;
  round: number;
  last: { seat: number; color: Color; count: number; from: number | 'center'; line: number | 'floor' } | { kind: 'round'; gains: number[][] } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type AzulView = Omit<AzulState, 'bag' | 'lid' | 'timeouts'> & { bagCount: number; lidCount: number };

const color = z.enum(COLORS);
export const azulAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('take'), from: z.union([z.number().int().min(0).max(8), z.literal('center')]), color, line: z.union([z.number().int().min(0).max(4), z.literal('floor')]) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type AzulAction = z.infer<typeof azulAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const emptyBoard = (): Board => ({ lines: Array.from({ length: 5 }, () => ({ color: null, n: 0 })), wall: Array.from({ length: 5 }, () => Array(5).fill(false)), floor: [], score: 0 });

export function canLine(b: Board, line: number, c: Color) {
  const l = b.lines[line]!;
  if (b.wall[line]![wallCol(line, c)]) return false;
  if (l.n >= line + 1) return false;
  return l.color === null || l.color === c;
}

/** Points for placing a tile at (r, c) on `wall` (already set). */
export function placeScore(wall: boolean[][], r: number, c: number) {
  const run = (dr: number, dc: number) => { let n = 0; for (let i = r + dr, j = c + dc; i >= 0 && i < 5 && j >= 0 && j < 5 && wall[i]![j]; i += dr, j += dc) n++; return n; };
  const h = run(0, -1) + run(0, 1);
  const v = run(-1, 0) + run(1, 0);
  return h === 0 && v === 0 ? 1 : (h ? h + 1 : 0) + (v ? v + 1 : 0);
}
export const floorPenalty = (n: number) => FLOOR.slice(0, Math.min(n, 7)).reduce((a, b) => a + b, 0);
export function endBonus(wall: boolean[][]) {
  const rows = wall.filter((r) => r.every(Boolean)).length;
  const cols = [0, 1, 2, 3, 4].filter((c) => wall.every((r) => r[c])).length;
  const colors = COLORS.filter((col) => [0, 1, 2, 3, 4].every((r) => wall[r]![wallCol(r, col)])).length;
  return { rows, cols, colors, points: rows * 2 + cols * 7 + colors * 10 };
}

// ---------- module ----------

type Events = Transition<AzulState>['internalEvents'];
const finish = (s: AzulState, events: Events): Transition<AzulState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: AzulState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, sc: s.boards[seat]!.score, rows: endBonus(s.boards[seat]!.wall).rows })).sort((a, b) => b.sc - a.sc || b.rows - a.rows);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.sc === x.sc && q.rows === x.rows ? out[i - 1]!.place : i + 1, score: x.sc }); });
  return out;
}

function draw(s: AzulState, rng: EngineRng): Color | null {
  if (!s.bag.length) { s.bag = shuffle(rng, s.lid); s.lid = []; }
  return s.bag.shift() ?? null;
}
function fill(s: AzulState, rng: EngineRng) {
  const n = 2 * s.players + 1;
  s.factories = Array.from({ length: n }, () => {
    const f: Color[] = [];
    for (let i = 0; i < 4; i++) { const t = draw(s, rng); if (t) f.push(t); }
    return f;
  });
  s.center = [];
  s.firstInCenter = true;
}

function tiling(s: AzulState, rng: EngineRng) {
  const gains: number[][] = [];
  s.boards.forEach((b) => {
    const g: number[] = [];
    b.lines.forEach((l, r) => {
      if (l.color && l.n === r + 1) {
        const c = wallCol(r, l.color);
        b.wall[r]![c] = true;
        const pts = placeScore(b.wall, r, c);
        b.score += pts; g.push(pts);
        for (let i = 0; i < r; i++) s.lid.push(l.color);
        b.lines[r] = { color: null, n: 0 };
      }
    });
    const pen = floorPenalty(b.floor.length);
    if (pen) g.push(pen);
    b.score = Math.max(0, b.score + pen);
    for (const t of b.floor) if (t !== 'first') s.lid.push(t);
    b.floor = [];
    gains.push(g);
  });
  s.last = { kind: 'round', gains };
  if (s.boards.some((b) => b.wall.some((r) => r.every(Boolean)))) {
    for (const b of s.boards) b.score += endBonus(b.wall).points;
    s.outcome = { placements: rank(s, s.boards.map((_, k) => k)), reason: 'score' };
    return;
  }
  s.round += 1;
  s.current = s.nextStarter;
  fill(s, rng);
}

const roundOver = (s: AzulState) => s.factories.every((f) => !f.length) && !s.center.length;

export function options(s: AzulState) {
  const out: { from: number | 'center'; color: Color }[] = [];
  s.factories.forEach((f, i) => { for (const c of new Set(f)) out.push({ from: i, color: c }); });
  for (const c of new Set(s.center)) out.push({ from: 'center', color: c });
  return out;
}

export const azulModule: GameModule<AzulState, AzulAction, AzulView> = {
  manifest: azul.manifest,
  actionSchema: azulAction,

  setup({ playerCount, rng, options: opts }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('azul needs 2–4 players');
    const s: AzulState = {
      players: playerCount, bag: shuffle(rng, COLORS.flatMap((c) => Array<Color>(20).fill(c))), lid: [], factories: [], center: [], firstInCenter: true,
      boards: Array.from({ length: playerCount }, emptyBoard), current: rng.nextInt(playerCount), nextStarter: 0, round: 1, last: null, seq: 0,
      timeouts: Array(playerCount).fill(0), outcome: null
    };
    fill(s, rng);
    if (opts.deal === 'tutorial') {
      // The learner's top wall row misses only blue; one factory holds the last tiles of the round.
      s.current = 0;
      const b = s.boards[0]!;
      for (let c = 1; c < 5; c++) b.wall[0]![c] = true;
      b.wall[1]![1] = true; b.wall[1]![2] = true;
      b.score = 14;
      const o = s.boards[1]!;
      o.wall[2]![2] = true; o.wall[3]![3] = true;
      o.score = 9;
      s.bag.push(...s.factories.flat());
      s.factories = s.factories.map((_, i) => (i === 0 ? ['b', 'k', 'k', 'r'] : []));
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const src = a.from === 'center' ? s.center : s.factories[a.from];
    if (!src || !src.includes(a.color)) return { ok: false, errorCode: 'NO_SUCH_TILES' };
    if (a.line !== 'floor' && !canLine(s.boards[actor.seat]!, a.line, a.color)) return { ok: false, errorCode: 'LINE_NOT_ALLOWED' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.boards.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.boards[seat]!.score }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const b = s.boards[seat]!;
    let tiles: Color[];
    if (a.from === 'center') {
      tiles = s.center.filter((t) => t === a.color);
      s.center = s.center.filter((t) => t !== a.color);
      if (s.firstInCenter) { s.firstInCenter = false; b.floor.push('first'); s.nextStarter = seat; }
    } else {
      const f = s.factories[a.from]!;
      tiles = f.filter((t) => t === a.color);
      s.center.push(...f.filter((t) => t !== a.color));
      s.factories[a.from] = [];
    }
    let rest = tiles.length;
    if (a.line !== 'floor') {
      const l = b.lines[a.line]!;
      const put = Math.min(rest, a.line + 1 - l.n);
      l.color = a.color; l.n += put; rest -= put;
    }
    for (let i = 0; i < rest; i++) { if (b.floor.length < 7) b.floor.push(a.color); else s.lid.push(a.color); }
    s.last = { seat, color: a.color, count: tiles.length, from: a.from, line: a.line };
    if (roundOver(s)) tiling(s, ctx.rng);
    else s.current = (seat + 1) % s.players;
    return finish(s, [{ type: 'take', seat }]);
  },

  project(s) {
    return {
      players: s.players, bagCount: s.bag.length, lidCount: s.lid.length, factories: s.factories.map((f) => f.slice()), center: s.center.slice(), firstInCenter: s.firstInCenter,
      boards: structuredClone(s.boards), current: s.current, nextStarter: s.nextStarter, round: s.round, last: s.last ? structuredClone(s.last) : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      const b = s.boards[viewer.seat]!;
      for (const o of options(s)) out.push({ type: 'take', from: o.from, color: o.color, lines: [0, 1, 2, 3, 4].filter((l) => canLine(b, l, o.color)) });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    // Passive play: the smallest group, onto the first line that takes it (else the floor).
    const count = (o: { from: number | 'center'; color: Color }) => (o.from === 'center' ? s.center : s.factories[o.from]!).filter((t) => t === o.color).length;
    const o = options(s).sort((x, y) => count(x) - count(y))[0]!;
    const line = [0, 1, 2, 3, 4].find((l) => canLine(s.boards[seat]!, l, o.color));
    const t = azulModule.apply(s, { kind: 'player', seat }, { type: 'take', from: o.from, color: o.color, line: line ?? 'floor' }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 33,
    options: { deal: 'tutorial' },
    introFa: 'سطر بالای دیوار شما فقط یک کاشی آبی کم دارد. وقتی همهٔ کاشی‌ها برداشته شود، ردیف‌های پر به دیوار می‌روند — و با اولین سطر کامل، بازی تمام می‌شود.',
    steps: [
      { instructionFa: 'کاشی آبی کارگاه را بردارید و در ردیف ۱ بگذارید (باقی کاشی‌ها به وسط میز می‌رود).', expected: { type: 'take', from: 0, color: 'b', line: 0 }, reply: { type: 'take', from: 'center', color: 'k', line: 'floor' } },
      { instructionFa: 'حریف سیاه‌ها را از وسط برداشت. کاشی قرمز آخر را در ردیف ۲ بگذارید.', expected: { type: 'take', from: 'center', color: 'r', line: 1 }, reply: null }
    ],
    completedFa: 'بردید! آبی به دیوار رفت، سطر کامل شد (۵ امتیاز + ۲ پاداش) و بازی تمام شد.'
  }
};
