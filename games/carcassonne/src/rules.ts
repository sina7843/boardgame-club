// Carcassonne («قلعه‌سازان»), 2–5 players, base game without farmers (the beginner rule; fields are not scored).
// 72 tiles (24 types A–X); the start tile (D) is in the middle. A turn: place the drawn tile so every touching edge
// matches (unplaceable tiles are discarded), optionally put one of your 7 followers on a road, city or monastery of
// that tile whose road/city has no follower yet. Completed roads score 1 per tile, cities 2 per tile and pennant,
// monasteries 9 when surrounded; the most followers take the points (ties all) and followers return. At the end,
// unfinished roads 1 per tile, cities 1 per tile and pennant, monasteries 1 + neighbours. Perfect information apart
// from the stack order (the drawn tile is public).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { carcassonne } from './definition.ts';

export type Edge = 'C' | 'R' | 'F';
export interface TileType { key: string; edges: Edge[]; cities: number[][]; roads: number[][]; monastery: boolean; shield: boolean; count: number }
const T = (key: string, e: string, cities: number[][], roads: number[][], monastery: boolean, shield: boolean, count: number): TileType =>
  ({ key, edges: e.split('') as Edge[], cities, roads, monastery, shield, count });
// Directions: 0 N, 1 E, 2 S, 3 W.
export const TILES: Record<string, TileType> = Object.fromEntries([
  T('A', 'FFRF', [], [[2]], true, false, 2), T('B', 'FFFF', [], [], true, false, 4), T('C', 'CCCC', [[0, 1, 2, 3]], [], false, true, 1),
  T('D', 'CRFR', [[0]], [[1, 3]], false, false, 4), T('E', 'CFFF', [[0]], [], false, false, 5), T('F', 'FCFC', [[1, 3]], [], false, true, 2),
  T('G', 'CFCF', [[0, 2]], [], false, false, 1), T('H', 'FCFC', [[1], [3]], [], false, false, 3), T('I', 'FCCF', [[1], [2]], [], false, false, 2),
  T('J', 'CRRF', [[0]], [[1, 2]], false, false, 3), T('K', 'CFRR', [[0]], [[2, 3]], false, false, 3), T('L', 'CRRR', [[0]], [[1], [2], [3]], false, false, 3),
  T('M', 'CFFC', [[0, 3]], [], false, true, 2), T('N', 'CFFC', [[0, 3]], [], false, false, 3), T('O', 'CRRC', [[0, 3]], [[1, 2]], false, true, 2),
  T('P', 'CRRC', [[0, 3]], [[1, 2]], false, false, 3), T('Q', 'CCFC', [[0, 1, 3]], [], false, true, 1), T('R', 'CCFC', [[0, 1, 3]], [], false, false, 3),
  T('S', 'CCRC', [[0, 1, 3]], [[2]], false, true, 2), T('T', 'CCRC', [[0, 1, 3]], [[2]], false, false, 1), T('U', 'RFRF', [], [[0, 2]], false, false, 8),
  T('V', 'FFRR', [], [[2, 3]], false, false, 9), T('W', 'FRRR', [], [[1], [2], [3]], false, false, 4), T('X', 'RRRR', [], [[0], [1], [2], [3]], false, false, 1)
].map((t) => [t.key, t]));
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const key = (x: number, y: number) => `${x},${y}`;

export interface Placed { t: string; rot: number; meeples: Record<string, number> }
export interface CarcState {
  players: number;
  board: Record<string, Placed>;
  stack: string[];
  scores: number[];
  meeplesLeft: number[];
  current: number;
  last: { seat: number; x: number; y: number; scored: { seat: number; pts: number; kind: string }[] } | null;
  discarded: number;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type CarcView = Omit<CarcState, 'stack' | 'timeouts'> & { tile: string | null; stackCount: number };

export const carcAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), x: z.number().int().min(-80).max(80), y: z.number().int().min(-80).max(80), rot: z.number().int().min(0).max(3), meeple: z.string().regex(/^(m|c\d|r\d)$/).optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CarcAction = z.infer<typeof carcAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Edge of a rotated tile facing direction d. */
export const edgeAt = (t: string, rot: number, d: number) => TILES[t]!.edges[(d - rot + 4) % 4]!;
/** Segment groups of a rotated tile, as directions. */
export const groups = (t: string, rot: number, kind: 'c' | 'r') => (kind === 'c' ? TILES[t]!.cities : TILES[t]!.roads).map((g) => g.map((d) => (d + rot) % 4));
export const segments = (t: string): string[] => [...TILES[t]!.cities.map((_, i) => `c${i}`), ...TILES[t]!.roads.map((_, i) => `r${i}`), ...(TILES[t]!.monastery ? ['m'] : [])];

export function fits(board: Record<string, Placed>, t: string, x: number, y: number, rot: number) {
  if (board[key(x, y)]) return false;
  let touches = false;
  for (let d = 0; d < 4; d++) {
    const n = board[key(x + DX[d]!, y + DY[d]!)];
    if (!n) continue;
    touches = true;
    if (edgeAt(n.t, n.rot, (d + 2) % 4) !== edgeAt(t, rot, d)) return false;
  }
  return touches;
}
export function placements(board: Record<string, Placed>, t: string) {
  const seen = new Set<string>();
  const out: { x: number; y: number; rot: number }[] = [];
  for (const k of Object.keys(board)) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d]!, ny = y + DY[d]!;
      if (seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      for (let rot = 0; rot < 4; rot++) if (fits(board, t, nx, ny, rot)) out.push({ x: nx, y: ny, rot });
    }
  }
  return out;
}

export interface Feature { kind: 'c' | 'r'; nodes: { k: string; seg: string }[]; tiles: Set<string>; open: number; shields: number; meeples: number[] }
export function feature(board: Record<string, Placed>, x: number, y: number, seg: string): Feature {
  const kind = seg[0] as 'c' | 'r';
  const f: Feature = { kind, nodes: [], tiles: new Set(), open: 0, shields: 0, meeples: [] };
  const seen = new Set<string>();
  const stack = [{ x, y, seg }];
  while (stack.length) {
    const n = stack.pop()!;
    const id = `${n.x},${n.y},${n.seg}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const p = board[key(n.x, n.y)]!;
    f.nodes.push({ k: key(n.x, n.y), seg: n.seg });
    if (!f.tiles.has(key(n.x, n.y))) { f.tiles.add(key(n.x, n.y)); if (kind === 'c' && TILES[p.t]!.shield) f.shields += 1; }
    if (p.meeples[n.seg] !== undefined) f.meeples.push(p.meeples[n.seg]!);
    for (const d of groups(p.t, p.rot, kind)[Number(n.seg.slice(1))]!) {
      const nx = n.x + DX[d]!, ny = n.y + DY[d]!;
      const q = board[key(nx, ny)];
      if (!q) { f.open += 1; continue; }
      const back = (d + 2) % 4;
      const gi = groups(q.t, q.rot, kind).findIndex((g) => g.includes(back));
      if (gi >= 0) stack.push({ x: nx, y: ny, seg: `${kind}${gi}` });
    }
  }
  return f;
}
const around = (x: number, y: number) => [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => key(x + dx, y + dy)));
export const monasteryCount = (board: Record<string, Placed>, x: number, y: number) => around(x, y).filter((k) => board[k]).length;

// ---------- module ----------

type Events = Transition<CarcState>['internalEvents'];
const finish = (s: CarcState, events: Events): Transition<CarcState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: CarcState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.scores[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function award(s: CarcState, meeples: number[], pts: number, kind: string, log: { seat: number; pts: number; kind: string }[]) {
  if (!meeples.length || pts <= 0) return;
  const counts = s.scores.map((_, k) => meeples.filter((m) => m === k).length);
  const best = Math.max(...counts);
  counts.forEach((c, k) => { if (c === best) { s.scores[k]! += pts; log.push({ seat: k, pts, kind }); } });
}
function release(s: CarcState, nodes: { k: string; seg: string }[]) {
  for (const n of nodes) { const p = s.board[n.k]!; const m = p.meeples[n.seg]; if (m !== undefined) { s.meeplesLeft[m]! += 1; delete p.meeples[n.seg]; } }
}

function scoreAfter(s: CarcState, x: number, y: number) {
  const log: { seat: number; pts: number; kind: string }[] = [];
  const p = s.board[key(x, y)]!;
  for (const seg of segments(p.t).filter((g) => g !== 'm')) {
    const f = feature(s.board, x, y, seg);
    if (f.open === 0 && f.meeples.length) { award(s, f.meeples, f.kind === 'c' ? 2 * (f.tiles.size + f.shields) : f.tiles.size, f.kind === 'c' ? 'city' : 'road', log); release(s, f.nodes); }
  }
  for (const k of around(x, y)) {
    const q = s.board[k];
    if (!q || q.meeples.m === undefined) continue;
    const [mx, my] = k.split(',').map(Number) as [number, number];
    if (monasteryCount(s.board, mx, my) === 9) { award(s, [q.meeples.m], 9, 'monastery', log); release(s, [{ k, seg: 'm' }]); }
  }
  return log;
}

function finalScoring(s: CarcState) {
  const done = new Set<string>();
  for (const [k, p] of Object.entries(s.board)) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    for (const seg of Object.keys(p.meeples)) {
      if (done.has(`${k},${seg}`) || p.meeples[seg] === undefined) continue;
      if (seg === 'm') { award(s, [p.meeples.m!], monasteryCount(s.board, x, y), 'monastery', []); done.add(`${k},m`); continue; }
      const f = feature(s.board, x, y, seg);
      f.nodes.forEach((n) => done.add(`${n.k},${n.seg}`));
      award(s, f.meeples, f.kind === 'c' ? f.tiles.size + f.shields : f.tiles.size, f.kind, []);
    }
  }
  s.outcome = { placements: rank(s, s.scores.map((_, k) => k)), reason: 'score' };
}

function ensurePlaceable(s: CarcState) {
  while (s.stack.length && !placements(s.board, s.stack[0]!).length) { s.stack.shift(); s.discarded += 1; }
  if (!s.stack.length) finalScoring(s);
}

export const carcModule: GameModule<CarcState, CarcAction, CarcView> = {
  manifest: carcassonne.manifest,
  actionSchema: carcAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('carcassonne needs 2–5 players');
    const all = Object.values(TILES).flatMap((t) => Array<string>(t.key === 'D' ? t.count - 1 : t.count).fill(t.key));
    const s: CarcState = {
      players: playerCount, board: { [key(0, 0)]: { t: 'D', rot: 0, meeples: {} } }, stack: shuffle(rng, all), scores: Array(playerCount).fill(0),
      meeplesLeft: Array(playerCount).fill(7), current: rng.nextInt(playerCount), last: null, discarded: 0, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.board[key(0, 0)]!.meeples = { c0: 0 };
      s.meeplesLeft = [6, 7];
      s.stack = ['E', 'U', 'B'];
    }
    ensurePlaceable(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const t = s.stack[0]!;
    if (!fits(s.board, t, a.x, a.y, a.rot)) return { ok: false, errorCode: 'DOES_NOT_FIT' };
    if (a.meeple) {
      if (!s.meeplesLeft[actor.seat]) return { ok: false, errorCode: 'NO_FOLLOWERS' };
      if (!segments(t).includes(a.meeple)) return { ok: false, errorCode: 'NO_SUCH_FEATURE' };
      if (a.meeple !== 'm') {
        const trial = { ...s.board, [key(a.x, a.y)]: { t, rot: a.rot, meeples: {} } };
        if (feature(trial, a.x, a.y, a.meeple).meeples.length) return { ok: false, errorCode: 'OCCUPIED' };
      }
    }
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.scores.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.scores[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const t = s.stack.shift()!;
    s.board[key(a.x, a.y)] = { t, rot: a.rot, meeples: a.meeple ? { [a.meeple]: seat } : {} };
    if (a.meeple) s.meeplesLeft[seat]! -= 1;
    const scored = scoreAfter(s, a.x, a.y);
    s.last = { seat, x: a.x, y: a.y, scored };
    s.current = (seat + 1) % s.players;
    ensurePlaceable(s);
    return finish(s, [{ type: 'place', seat }]);
  },

  project(s) {
    const { stack, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, tile: s.outcome ? null : stack[0] ?? null, stackCount: stack.length };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) out.push({ type: 'place', options: placements(s.board, s.stack[0]!) });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const p = placements(s.board, s.stack[0]!)[0]!;
    const t = carcModule.apply(s, { kind: 'player', seat }, { type: 'place', ...p }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 71,
    options: { deal: 'tutorial' },
    introFa: 'کاشی شروع یک تکه شهر دارد و پیرو شما روی آن است. کاشی شما هم یک تکه شهر دارد: آن را بالای کاشی شروع بگذارید تا شهر بسته شود.',
    steps: [
      { instructionFa: 'کاشی را بالای کاشی شروع بگذارید (شهر رو به پایین): شهر دوکاشی کامل می‌شود.', expected: { type: 'place', x: 0, y: -1, rot: 2 }, reply: { type: 'place', x: 0, y: 1, rot: 1 } },
      { instructionFa: 'آخرین کاشی صومعه است: پایین جاده بگذارید و پیرو را روی صومعه قرار دهید.', expected: { type: 'place', x: 0, y: 2, rot: 0, meeple: 'm' }, reply: null }
    ],
    completedFa: 'بردید! شهر کامل ۴ امتیاز داد و صومعهٔ نیمه‌تمام هم در پایان امتیاز گرفت.'
  }
};
