// Kingdomino («قلمرو»), 2–4 players. 48 dominoes (a generated set following the original's terrain mix — wheat,
// forest, lake, grassland, swamp, mine — with crowns concentrated on rarer terrain and higher numbers; not a copy).
// 2 players use 24 dominoes and two kings each, 3 players 36 and lines of three, 4 players all 48. Each round a line
// is drawn and sorted by number; kings pick in the order of the line they stand on (the first line in random order).
// On your turn you place the domino your king stands on — one half next to the castle or a matching terrain, the
// kingdom within 5×5; discard only if it cannot be placed — and pick from the next line. Score: each region's size ×
// its crowns. Tie: largest region, then most crowns. Hidden: the deck order only.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { kingdomino } from './definition.ts';

export const TERRAINS = ['W', 'F', 'L', 'G', 'S', 'M'] as const;
export type Terrain = (typeof TERRAINS)[number];
export interface Half { t: Terrain; c: number }
export interface Cell { t: Terrain | 'C'; c: number }
const RAW = [
  'W W', 'W W', 'F F', 'F F', 'F F', 'F F', 'L L', 'L L', 'L L', 'G G', 'G G', 'S S', 'W F', 'W L', 'W G', 'W S',
  'F L', 'F G', 'W1 F', 'W1 L', 'W1 G', 'W1 S', 'W1 M', 'F1 W', 'F1 W', 'F1 W', 'F1 W', 'F1 L', 'F1 G', 'L1 W', 'L1 W', 'L1 F',
  'L1 F', 'L1 F', 'L1 F', 'W G1', 'L G1', 'W S1', 'G S1', 'M1 W', 'W G2', 'L G2', 'W S2', 'G S2', 'M2 W', 'S M2', 'S M2', 'W M3'
];
const half = (s: string): Half => ({ t: s[0] as Terrain, c: Number(s.slice(1) || 0) });
export const DOMINOES: [Half, Half][] = RAW.map((r) => { const [a, b] = r.split(' '); return [half(a!), half(b!)]; });
export const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const N = 9, MID = 4;

export interface Slot { dom: number; owner: number | null }
export interface KingdominoState {
  players: number;
  deck: number[];
  current: Slot[];
  next: Slot[];
  phase: 'pick' | 'play';
  pickOrder: number[];
  idx: number;
  kingdoms: (Cell | null)[][][];
  discarded: number[];
  last: { seat: number; dom: number; placed: { r: number; c: number; dir: number } | null } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type KingdominoView = Omit<KingdominoState, 'deck' | 'timeouts'> & { deckCount: number; actor: number | null };

const placeSchema = z.strictObject({ r: z.number().int().min(0).max(8), c: z.number().int().min(0).max(8), dir: z.number().int().min(0).max(3) });
export const kingdominoAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pick'), slot: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('play'), place: placeSchema.nullable(), slot: z.number().int().min(0).max(3).optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type KingdominoAction = z.infer<typeof kingdominoAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const lineSize = (players: number) => (players === 3 ? 3 : 4);
const emptyKingdom = () => { const k: (Cell | null)[][] = Array.from({ length: N }, () => Array<Cell | null>(N).fill(null)); k[MID]![MID] = { t: 'C', c: 0 }; return k; };

/** Whether domino `dom` fits at (r, c) facing `dir` in kingdom `k`. */
export function canPlace(k: (Cell | null)[][], dom: number, r: number, c: number, dir: number) {
  const [dr, dc] = DIRS[dir]!;
  const cells: [number, number, Half][] = [[r, c, DOMINOES[dom]![0]], [r + dr, c + dc, DOMINOES[dom]![1]]];
  if (cells.some(([y, x]) => y < 0 || x < 0 || y >= N || x >= N || k[y]![x])) return false;
  let minR = r, maxR = r, minC = c, maxC = c;
  k.forEach((row, y) => row.forEach((cell, x) => { if (cell) { minR = Math.min(minR, y); maxR = Math.max(maxR, y); minC = Math.min(minC, x); maxC = Math.max(maxC, x); } }));
  for (const [y, x] of cells) { minR = Math.min(minR, y); maxR = Math.max(maxR, y); minC = Math.min(minC, x); maxC = Math.max(maxC, x); }
  if (maxR - minR > 4 || maxC - minC > 4) return false;
  return cells.some(([y, x, h]) => DIRS.some(([a, b]) => { const n = k[y + a]?.[x + b]; return !!n && (n.t === 'C' || n.t === h.t); }));
}
export function placements(k: (Cell | null)[][], dom: number) {
  const out: { r: number; c: number; dir: number }[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (let dir = 0; dir < 4; dir++) if (canPlace(k, dom, r, c, dir)) out.push({ r, c, dir });
  return out;
}

export function scoreKingdom(k: (Cell | null)[][]) {
  const seen = new Set<string>();
  let total = 0, largest = 0, crowns = 0;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const cell = k[r]![c];
    if (!cell || cell.t === 'C' || seen.has(`${r},${c}`)) continue;
    let size = 0, cr = 0;
    const stack = [[r, c]];
    seen.add(`${r},${c}`);
    while (stack.length) {
      const [y, x] = stack.pop()!;
      size++; cr += k[y!]![x!]!.c;
      for (const [a, b] of DIRS) {
        const ny = y! + a, nx = x! + b;
        if (k[ny]?.[nx]?.t === cell.t && !seen.has(`${ny},${nx}`)) { seen.add(`${ny},${nx}`); stack.push([ny, nx]); }
      }
    }
    total += size * cr; largest = Math.max(largest, size); crowns += cr;
  }
  return { total, largest, crowns };
}

// ---------- module ----------

type Events = Transition<KingdominoState>['internalEvents'];
const finish = (s: KingdominoState, events: Events): Transition<KingdominoState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: KingdominoState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, ...scoreKingdom(s.kingdoms[seat]!) })).sort((a, b) => b.total - a.total || b.largest - a.largest || b.crowns - a.crowns);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.total === x.total && q.largest === x.largest && q.crowns === x.crowns ? out[i - 1]!.place : i + 1, score: x.total }); });
  return out;
}

function draw(s: KingdominoState): Slot[] {
  return s.deck.splice(0, lineSize(s.players)).sort((a, b) => a - b).map((dom) => ({ dom, owner: null }));
}
export const actorOf = (s: Pick<KingdominoState, 'phase' | 'pickOrder' | 'idx' | 'current' | 'outcome'>) =>
  (s.outcome ? null : s.phase === 'pick' ? s.pickOrder[s.idx]! : s.current[s.idx]!.owner!);

function advance(s: KingdominoState) {
  s.idx += 1;
  const size = s.phase === 'pick' ? s.pickOrder.length : s.current.length;
  if (s.idx < size) return;
  if (s.phase === 'play' && !s.next.length) { s.outcome = { placements: rank(s, s.kingdoms.map((_, k) => k)), reason: 'score' }; return; }
  s.phase = 'play';
  s.current = s.next;
  s.next = draw(s);
  s.idx = 0;
}

export const kingdominoModule: GameModule<KingdominoState, KingdominoAction, KingdominoView> = {
  manifest: kingdomino.manifest,
  actionSchema: kingdominoAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('kingdomino needs 2–4 players');
    const n = playerCount === 2 ? 24 : playerCount === 3 ? 36 : 48;
    const kings = playerCount === 2 ? [0, 0, 1, 1] : Array.from({ length: playerCount }, (_, k) => k);
    const s: KingdominoState = {
      players: playerCount, deck: shuffle(rng, DOMINOES.map((_, i) => i)).slice(0, n), current: [], next: [], phase: 'pick',
      pickOrder: shuffle(rng, kings), idx: 0, kingdoms: Array.from({ length: playerCount }, emptyKingdom), discarded: [], last: null, seq: 0,
      timeouts: Array(playerCount).fill(0), outcome: null
    };
    s.next = draw(s);
    if (options.deal === 'tutorial') {
      s.deck = [];
      s.phase = 'play';
      s.current = [{ dom: 47, owner: 0 }, { dom: 2, owner: 1 }, { dom: 18, owner: 0 }, { dom: 3, owner: 1 }];
      s.next = [];
      const k = s.kingdoms[0]!;
      k[4]![3] = { t: 'W', c: 1 }; k[4]![2] = { t: 'W', c: 0 }; k[3]![3] = { t: 'W', c: 0 }; k[3]![2] = { t: 'W', c: 0 };
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actorOf(s) !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'pick') {
      if (s.phase !== 'pick') return { ok: false, errorCode: 'PLACE_FIRST' };
      return s.next[a.slot] && s.next[a.slot]!.owner === null ? { ok: true } : { ok: false, errorCode: 'TAKEN' };
    }
    if (s.phase !== 'play') return { ok: false, errorCode: 'PICK_FIRST' };
    const k = s.kingdoms[actor.seat]!;
    const dom = s.current[s.idx]!.dom;
    if (a.place) { if (!canPlace(k, dom, a.place.r, a.place.c, a.place.dir)) return { ok: false, errorCode: 'CANNOT_PLACE' }; }
    else if (placements(k, dom).length) return { ok: false, errorCode: 'MUST_PLACE' };
    if (s.next.length) return a.slot !== undefined && s.next[a.slot]?.owner === null ? { ok: true } : { ok: false, errorCode: 'PICK_NEXT' };
    return a.slot === undefined ? { ok: true } : { ok: false, errorCode: 'NO_NEXT_LINE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.kingdoms.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: scoreKingdom(s.kingdoms[seat]!).total }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'pick') { s.next[a.slot]!.owner = seat; s.last = null; }
    else {
      const dom = s.current[s.idx]!.dom;
      if (a.place) {
        const [dr, dc] = DIRS[a.place.dir]!;
        const [h1, h2] = DOMINOES[dom]!;
        s.kingdoms[seat]![a.place.r]![a.place.c] = { ...h1 };
        s.kingdoms[seat]![a.place.r + dr]![a.place.c + dc] = { ...h2 };
      } else s.discarded.push(dom);
      if (a.slot !== undefined) s.next[a.slot]!.owner = seat;
      s.last = { seat, dom, placed: a.place };
    }
    advance(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { deck, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, deckCount: deck.length, actor: actorOf(s) };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (actorOf(s) === viewer.seat) {
      const free = s.next.map((x, i) => (x.owner === null ? i : -1)).filter((i) => i >= 0);
      if (s.phase === 'pick') out.push({ type: 'pick', slots: free });
      else out.push({ type: 'play', dom: s.current[s.idx]!.dom, canPlace: placements(s.kingdoms[viewer.seat]!, s.current[s.idx]!.dom).length > 0, slots: free });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = actorOf(s)!;
    const missed = s.timeouts[seat]! + 1;
    const free = s.next.findIndex((x) => x.owner === null);
    const a: KingdominoAction = s.phase === 'pick' ? { type: 'pick', slot: free }
      : { type: 'play', place: placements(s.kingdoms[seat]!, s.current[s.idx]!.dom)[0] ?? null, ...(s.next.length ? { slot: free } : {}) };
    const t = kingdominoModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => { const a = actorOf(s); return a === null ? [] : [a]; },

  tutorial: {
    seed: 39,
    options: { deal: 'tutorial' },
    introFa: 'دور آخر است. گندم‌زار شما یک تاج دارد؛ هر خانهٔ گندم‌زار وصل‌شده امتیازش را بالا می‌برد. امتیاز هر ناحیه = تعداد خانه‌ها × تعداد تاج‌ها.',
    steps: [
      { instructionFa: 'دومینوی «گندم‌زار + معدن ۳ تاج» را بگذارید: گندم‌زار زیر خانهٔ تاج‌دار و معدن کنارش.', expected: { type: 'play', place: { r: 5, c: 3, dir: 2 } }, reply: { type: 'play', place: { r: 4, c: 5, dir: 0 } } },
      { instructionFa: 'حالا «گندم‌زار تاج‌دار + جنگل» را زیر قلعه بگذارید تا گندم‌زارها وصل شوند.', expected: { type: 'play', place: { r: 5, c: 4, dir: 1 } }, reply: { type: 'play', place: { r: 3, c: 5, dir: 0 } } }
    ],
    completedFa: 'بردید! شش خانه گندم‌زار با دو تاج (۱۲) به‌علاوهٔ معدن سه‌تاجی (۳). جنگل‌های بی‌تاج حریف امتیازی نداشت.'
  }
};
