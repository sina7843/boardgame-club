// Cryptid («کریپتید»), 3–5 players (2 only on the tutorial table). Six double-sided map tiles (6×3 hexes each) form a
// 12×9 board of forest/desert/swamp/mountain/water with bear and cougar territories; standing stones and abandoned shacks
// in white/green/blue (+ black in advanced mode) are placed on land. Every player gets a secret clue (on one of two
// terrains; within 1 of a terrain or any animal territory; within 2 of a stone/shack/bear/cougar territory; within 3 of
// a structure colour; advanced mode adds «not …» clues). The engine generates the setup so the clues together allow
// exactly one cell, and every clue is needed. Opening: in seat order from the first player, everyone places a cube on a
// cell their clue rules out, twice. A turn: ask another player about a cell (the server answers from their clue: disc =
// yes, cube = no; on no the asker must also place a cube where their own clue says no), or search a cell your clue
// allows (your disc, then each other player in seat order confirms with a disc or refutes with a cube; the first cube
// stops it and the searcher places a cube). A cube may only go where its owner's clue rules the cell out, so a cube can
// never land on the answer. First successful search wins. Hidden: every clue (own clue only) and the answer.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { cryptid } from './definition.ts';

export const TERRAINS = ['forest', 'desert', 'swamp', 'mountain', 'water'] as const;
export type Terrain = (typeof TERRAINS)[number];
export type Animal = 'bear' | 'cougar';
export type StructKind = 'stone' | 'shack';
export const COLORS = ['white', 'green', 'blue', 'black'] as const;
export type SColor = (typeof COLORS)[number];
export interface Cell { terrain: Terrain; animal: Animal | null; structure: { kind: StructKind; color: SColor } | null }
export type Target = Terrain | 'animal' | Animal | StructKind | SColor;
/** d = 0: on terrain a or b; d = 1..3: within d spaces of a feature (a cell counts as within 0 of itself). */
export interface Clue { d: 0 | 1 | 2 | 3; a: Target; b?: Terrain; not: boolean }
export interface TilePlace { id: number; side: 0 | 1; rot: boolean }

export const COLS = 12, ROWS = 9, CELLS = COLS * ROWS;
const T: Record<string, Terrain> = { F: 'forest', D: 'desert', S: 'swamp', M: 'mountain', W: 'water' };
/** Six tiles, two printed sides each (rows of 6 hexes, top to bottom). Tiles 1–3 carry a bear territory, 4–6 a cougar one. */
const TILES: [string, string][] = [
  ['WWWWFF' + 'SSWDFF' + 'SSSDDF', 'FFWWWS' + 'FMMWSS' + 'MMDDSS'],
  ['SFFFFF' + 'SSDDFF' + 'SDDMMM', 'DDDSSW' + 'MDSSWW' + 'MMFFWW'],
  ['SSMMMM' + 'SSMMDD' + 'SWWWDD', 'WWSSFF' + 'WSSFFM' + 'DDDMMM'],
  ['DDDMMM' + 'DDWWMM' + 'WWWFFF', 'MMSSSD' + 'MFFSDD' + 'FFFWWD'],
  ['SSSMMM' + 'DDSSMM' + 'DDWWWF', 'FFDDDW' + 'FMMDWW' + 'SSMMWW'],
  ['DDSSSS' + 'MDDSFF' + 'MMWWFF', 'WWFFDD' + 'WMFFSD' + 'MMMSSS']
];
const ANIMAL_CELLS: [number[], number[]] = [[0, 1, 6], [11, 16, 17]];

export function buildCells(tiles: TilePlace[], structures: { cell: number; kind: StructKind; color: SColor }[]): Cell[] {
  const cells: Cell[] = Array.from({ length: CELLS });
  tiles.forEach((tp, pos) => {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const li = tp.rot ? (2 - r) * 6 + (5 - c) : r * 6 + c;
      const g = (Math.floor(pos / 2) * 3 + r) * COLS + (pos % 2) * 6 + c;
      cells[g] = { terrain: T[TILES[tp.id]![tp.side][li]!]!, animal: ANIMAL_CELLS[tp.side].includes(li) ? (tp.id < 3 ? 'bear' : 'cougar') : null, structure: null };
    }
  });
  for (const s of structures) cells[s.cell]!.structure = { kind: s.kind, color: s.color };
  return cells;
}

// Flat-top hexes, odd columns shifted down half a hex ("odd-q").
const axial = (i: number) => { const q = i % COLS, r = Math.floor(i / COLS); return [q, r - (q - (q & 1)) / 2] as const; };
export function dist(a: number, b: number) {
  const [qa, za] = axial(a), [qb, zb] = axial(b);
  const dq = qa - qb, dz = za - zb;
  return Math.max(Math.abs(dq), Math.abs(dz), Math.abs(dq + dz));
}
const DIST = Array.from({ length: CELLS }, (_, a) => Array.from({ length: CELLS }, (_, b) => dist(a, b)));

function has(c: Cell, t: Target) {
  if ((TERRAINS as readonly string[]).includes(t)) return c.terrain === t;
  if (t === 'animal') return c.animal !== null;
  if (t === 'bear' || t === 'cougar') return c.animal === t;
  if (t === 'stone' || t === 'shack') return c.structure?.kind === t;
  return c.structure?.color === t;
}
export function fits(cells: Cell[], clue: Clue, i: number): boolean {
  const hit = clue.d === 0 ? cells[i]!.terrain === clue.a || cells[i]!.terrain === clue.b : cells.some((c, j) => DIST[i]![j]! <= clue.d && has(c, clue.a));
  return hit !== clue.not;
}

/** Every clue of the base game (negatives and black structures only in advanced mode). */
export function allClues(advanced: boolean): Clue[] {
  const out: Clue[] = [];
  TERRAINS.forEach((a, i) => TERRAINS.slice(i + 1).forEach((b) => out.push({ d: 0, a, b, not: false })));
  for (const a of [...TERRAINS, 'animal'] as const) out.push({ d: 1, a, not: false });
  for (const a of ['stone', 'shack', 'bear', 'cougar'] as const) out.push({ d: 2, a, not: false });
  for (const a of COLORS.slice(0, advanced ? 4 : 3)) out.push({ d: 3, a, not: false });
  return advanced ? [...out, ...out.map((c) => ({ ...c, not: true }))] : out;
}

// 108-cell masks as four 32-bit words.
type Mask = Uint32Array;
const maskOf = (cells: Cell[], clue: Clue): Mask => { const m = new Uint32Array(4); for (let i = 0; i < CELLS; i++) if (fits(cells, clue, i)) m[i >> 5]! |= 1 << (i & 31); return m; };
const pop = (x: number) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
function andCount(ms: Mask[], skip = -1) {
  let n = 0;
  for (let w = 0; w < 4; w++) { let v = 0xffffffff; ms.forEach((m, k) => { if (k !== skip) v &= m[w]!; }); n += pop(v >>> 0); }
  return n;
}

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Random map + structures + one clue per player such that exactly one cell fits all clues and no clue is redundant. */
export function generate(rng: EngineRng, n: number, advanced: boolean) {
  for (;;) {
    const tiles: TilePlace[] = shuffle(rng, [0, 1, 2, 3, 4, 5]).map((id) => ({ id, side: rng.nextInt(2) as 0 | 1, rot: rng.nextInt(2) === 1 }));
    let cells = buildCells(tiles, []);
    const land = shuffle(rng, cells.map((c, i) => (c.terrain === 'water' ? -1 : i)).filter((i) => i >= 0));
    const structures = COLORS.slice(0, advanced ? 4 : 3).flatMap((color, k) => (['stone', 'shack'] as const).map((kind, j) => ({ cell: land[k * 2 + j]!, kind, color })));
    cells = buildCells(tiles, structures);
    const pool = allClues(advanced).map((clue) => ({ clue, mask: maskOf(cells, clue) })).filter((x) => { const c = andCount([x.mask]); return c > 0 && c < CELLS; });
    for (let t = 0; t < 4000; t++) {
      const pick = shuffle(rng, pool.map((_, i) => i)).slice(0, n).map((i) => pool[i]!);
      const ms = pick.map((p) => p.mask);
      if (andCount(ms) !== 1 || ms.some((_, k) => andCount(ms, k) === 1)) continue;
      const answer = cells.findIndex((_, i) => pick.every((p) => fits(cells, p.clue, i)));
      return { tiles, structures, cells, clues: pick.map((p) => p.clue), answer };
    }
  }
}

// ---------- state ----------

export type LogEntry =
  | { t: 'cube'; seat: number; cell: number; opening: boolean; auto?: boolean }
  | { t: 'question'; seat: number; target: number; cell: number; yes: boolean }
  | { t: 'search'; seat: number; cell: number; results: { seat: number; yes: boolean }[] }
  | { t: 'skip'; seat: number }
  | { t: 'out'; seat: number; why: 'resign' | 'timeout' };

export interface CryptidState {
  players: number;
  advanced: boolean;
  tiles: TilePlace[];
  cells: Cell[];
  clues: Clue[];
  answer: number;
  discs: number[][];
  cubes: (number | null)[];
  phase: 'opening' | 'turn' | 'penalty';
  first: number;
  current: number;
  openingPlaced: number[];
  active: boolean[];
  misses: number[];
  log: LogEntry[];
  seq: number;
  outcome: Outcome | null;
}
export interface CryptidView {
  players: number;
  advanced: boolean;
  tiles: TilePlace[];
  cells: Cell[];
  discs: number[][];
  cubes: (number | null)[];
  phase: CryptidState['phase'];
  current: number;
  openingPlaced: number[];
  active: boolean[];
  log: LogEntry[];
  seq: number;
  outcome: Outcome | null;
  /** The viewer's own clue (players only). */
  myClue: Clue | null;
  /** Revealed only when the game is over. */
  reveal: { clues: Clue[]; answer: number } | null;
}

const cell = z.number().int().min(0).max(CELLS - 1);
export const cryptidAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('question'), target: z.number().int().min(0).max(4), cell }),
  z.strictObject({ type: z.literal('search'), cell }),
  z.strictObject({ type: z.literal('placeCube'), cell }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CryptidAction = z.infer<typeof cryptidAction>;

const LOG_MAX = 40;
const push = (s: CryptidState, e: LogEntry) => { s.log.push(e); if (s.log.length > LOG_MAX) s.log.shift(); };

/** Cells where `seat` may place a cube: no cube yet and their own clue rules the cell out. */
export const cubeCells = (s: CryptidState, seat: number) => s.cells.flatMap((_, i) => (s.cubes[i] === null && !fits(s.cells, s.clues[seat]!, i) ? [i] : []));
/** Cells `seat` may search: no cube and their own clue allows the cell. */
export const searchCells = (s: CryptidState, seat: number) => s.cells.flatMap((_, i) => (s.cubes[i] === null && fits(s.cells, s.clues[seat]!, i) ? [i] : []));
/** Cells you may ask `target` about: no cube and `target` has not answered there yet (public). */
export const askCells = (s: { cubes: (number | null)[]; discs: number[][] }, target: number) => s.cubes.flatMap((c, i) => (c === null && !s.discs[i]!.includes(target) ? [i] : []));

const nextSeat = (s: CryptidState, from: number, ok: (k: number) => boolean) => {
  for (let k = 1; k <= s.players; k++) { const x = (from + k) % s.players; if (ok(x)) return x; }
  return -1;
};

/** Next player in the opening who still owes a cube (and can place one), or start the regular turns. */
function advanceOpening(s: CryptidState) {
  for (let guard = 0; guard < 2 * s.players + 1; guard++) {
    const x = nextSeat(s, s.current, (k) => s.active[k]! && s.openingPlaced[k]! < 2);
    if (x < 0) break;
    s.current = x;
    if (cubeCells(s, x).length) return;
    s.openingPlaced[x] = 2;
  }
  s.phase = 'turn';
  s.current = s.active[s.first] ? s.first : nextSeat(s, s.first, (k) => s.active[k]!);
}
function nextTurn(s: CryptidState) {
  s.phase = 'turn';
  s.current = nextSeat(s, s.current, (k) => s.active[k]!);
}

function placements(s: CryptidState, winner: number): Outcome['placements'] {
  const others = s.active.flatMap((a, k) => (a && k !== winner ? [k] : []));
  const out = s.active.flatMap((a, k) => (!a && k !== winner ? [k] : []));
  return [{ seat: winner, place: 1 }, ...others.map((seat) => ({ seat, place: 2 })), ...out.map((seat) => ({ seat, place: 2 + others.length }))];
}

/** A player leaves (resign or repeated timeouts). Their clue keeps answering; one player left wins. */
function remove(s: CryptidState, seat: number, why: 'resign' | 'timeout') {
  s.active[seat] = false;
  push(s, { t: 'out', seat, why });
  const left = s.active.flatMap((a, k) => (a ? [k] : []));
  if (left.length === 1) { s.outcome = { placements: placements(s, left[0]!), reason: why }; return; }
  if (s.current !== seat) return;
  if (s.phase === 'opening') advanceOpening(s); else nextTurn(s);
}

type Events = Transition<CryptidState>['internalEvents'];
const done = (s: CryptidState, events: Events, newTurn: boolean): Transition<CryptidState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : newTurn ? [{ kind: 'set', deadlineKey: 'turn' }] : [] });

function check(s: CryptidState, seat: number, a: CryptidAction): string | null {
  if (a.type === 'resign') return null;
  if (s.current !== seat) return 'NOT_YOUR_TURN';
  if (a.type === 'placeCube') {
    if (s.phase === 'turn') return 'WRONG_PHASE';
    if (s.cubes[a.cell] !== null) return 'CELL_OCCUPIED';
    return fits(s.cells, s.clues[seat]!, a.cell) ? 'CLUE_FORBIDS' : null;
  }
  if (s.phase !== 'turn') return 'WRONG_PHASE';
  if (s.cubes[a.cell] !== null) return 'CELL_OCCUPIED';
  if (a.type === 'question') {
    if (a.target === seat || a.target >= s.players) return 'INVALID_TARGET';
    return s.discs[a.cell]!.includes(a.target) ? 'ALREADY_ANSWERED' : null;
  }
  return fits(s.cells, s.clues[seat]!, a.cell) ? null : 'CLUE_FORBIDS';
}

// ---------- tutorial: a fixed two-player teaching position ----------

// Map, structures and both clues are fixed. Learner (seat 0): «within 1 space of forest»; tutor (seat 1): «within 3 spaces
// of a blue structure». Together they allow exactly cell 40 (column 5, row 4: a mountain next to a forest).
export const TUTORIAL = {
  tiles: [0, 1, 2, 3, 4, 5].map((id) => ({ id, side: (id % 2) as 0 | 1, rot: id === 3 })),
  structures: [
    { cell: 30, kind: 'stone', color: 'white' }, { cell: 27, kind: 'shack', color: 'white' },
    { cell: 42, kind: 'stone', color: 'green' }, { cell: 105, kind: 'shack', color: 'green' },
    { cell: 49, kind: 'stone', color: 'blue' }, { cell: 60, kind: 'shack', color: 'blue' }
  ] as { cell: number; kind: StructKind; color: SColor }[],
  clues: [{ d: 1, a: 'forest', not: false }, { d: 3, a: 'blue', not: false }] as Clue[],
  /** Opening cubes already on the board: [seat, cell]. */
  cubes: [[0, 39], [1, 43], [0, 64], [1, 88]] as [number, number][]
};

export const cryptidModule: GameModule<CryptidState, CryptidAction, CryptidView> = {
  manifest: cryptid.manifest,
  actionSchema: cryptidAction,

  setup({ playerCount, options, rng }) {
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    if (!tutorial && (playerCount < 3 || playerCount > 5)) throw new Error('cryptid needs 3–5 players');
    const advanced = !tutorial && options.mode === 'advanced';
    const g = tutorial
      ? (() => { const cells = buildCells(TUTORIAL.tiles, TUTORIAL.structures); return { tiles: TUTORIAL.tiles, cells, clues: TUTORIAL.clues, answer: cells.findIndex((_, i) => TUTORIAL.clues.every((c) => fits(cells, c, i))) }; })()
      : generate(rng, playerCount, advanced);
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const s: CryptidState = {
      players: playerCount, advanced, tiles: g.tiles, cells: g.cells, clues: g.clues, answer: g.answer,
      discs: Array.from({ length: CELLS }, () => []), cubes: Array<number | null>(CELLS).fill(null),
      phase: 'opening', first, current: first, openingPlaced: Array<number>(playerCount).fill(0),
      active: Array<boolean>(playerCount).fill(true), misses: Array<number>(playerCount).fill(0), log: [], seq: 0, outcome: null
    };
    if (tutorial) {
      for (const [seat, c] of TUTORIAL.cubes) { s.cubes[c] = seat; s.openingPlaced[seat]! += 1; push(s, { t: 'cube', seat, cell: c, opening: true }); }
      s.phase = 'turn';
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.active[actor.seat]) return { ok: false, errorCode: 'ALREADY_RESIGNED' };
    const err = check(s, actor.seat, a);
    return err ? { ok: false, errorCode: err } : { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      // Only restart the turn clock if the resign moved the turn (another player's resign must not refill the current timer).
      const was = `${s.current}/${s.phase}`;
      remove(s, seat, 'resign');
      return done(s, [{ type: 'resigned', seat }], `${s.current}/${s.phase}` !== was);
    }
    s.misses[seat] = 0;
    if (a.type === 'placeCube') {
      s.cubes[a.cell] = seat;
      push(s, { t: 'cube', seat, cell: a.cell, opening: s.phase === 'opening' });
      if (s.phase === 'opening') { s.openingPlaced[seat]! += 1; advanceOpening(s); } else nextTurn(s);
      return done(s, [{ type: 'cube', seat, cell: a.cell }], true);
    }
    if (a.type === 'question') {
      const yes = fits(s.cells, s.clues[a.target]!, a.cell);
      if (yes) s.discs[a.cell]!.push(a.target); else s.cubes[a.cell] = a.target;
      push(s, { t: 'question', seat, target: a.target, cell: a.cell, yes });
      if (yes || !cubeCells(s, seat).length) nextTurn(s); else s.phase = 'penalty';
      return done(s, [{ type: 'question', seat, target: a.target, cell: a.cell, yes }], s.phase === 'turn');
    }
    // search
    if (!s.discs[a.cell]!.includes(seat)) s.discs[a.cell]!.push(seat);
    const results: { seat: number; yes: boolean }[] = [];
    for (let k = 1; k < s.players; k++) {
      const o = (seat + k) % s.players;
      const yes = s.discs[a.cell]!.includes(o) || fits(s.cells, s.clues[o]!, a.cell);
      results.push({ seat: o, yes });
      if (!yes) { s.cubes[a.cell] = o; break; }
      if (!s.discs[a.cell]!.includes(o)) s.discs[a.cell]!.push(o);
    }
    push(s, { t: 'search', seat, cell: a.cell, results });
    const found = results.every((r) => r.yes);
    if (found) s.outcome = { placements: placements(s, seat), reason: 'win' };
    else if (cubeCells(s, seat).length) s.phase = 'penalty';
    else nextTurn(s);
    return done(s, [{ type: 'search', seat, cell: a.cell, found }], found || s.phase === 'turn');
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    return {
      players: s.players, advanced: s.advanced, tiles: s.tiles.map((t) => ({ ...t })), cells: structuredClone(s.cells),
      discs: s.discs.map((d) => d.slice()), cubes: s.cubes.slice(), phase: s.phase, current: s.current, openingPlaced: s.openingPlaced.slice(),
      active: s.active.slice(), log: structuredClone(s.log), seq: s.seq, outcome: s.outcome,
      myClue: me === null ? null : { ...s.clues[me]! },
      reveal: s.outcome ? { clues: structuredClone(s.clues), answer: s.answer } : null
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      if (s.phase === 'turn') {
        for (let k = 1; k < s.players; k++) { const target = (seat + k) % s.players; out.push({ type: 'question', target, cells: askCells(s, target) }); }
        out.push({ type: 'search', cells: searchCells(s, seat) });
      } else out.push({ type: 'placeCube', cells: cubeCells(s, seat) });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.seq += 1;
    if (s.phase !== 'turn') {
      // A cube is owed: the first cell (board order) the player's clue rules out.
      const c = cubeCells(s, seat)[0]!;
      s.cubes[c] = seat;
      push(s, { t: 'cube', seat, cell: c, opening: s.phase === 'opening', auto: true });
      if (s.phase === 'opening') { s.openingPlaced[seat]! += 1; advanceOpening(s); } else nextTurn(s);
      return done(s, [{ type: 'timed-out', seat }], true);
    }
    s.misses[seat]! += 1;
    if (s.misses[seat]! >= 2) remove(s, seat, 'timeout');
    else { push(s, { t: 'skip', seat }); nextTurn(s); }
    return done(s, [{ type: 'timed-out', seat }], true);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'جانور در یکی از ۱۰۸ خانهٔ نقشه پنهان است. سرنخ مخفی شما: «در فاصلهٔ ۱ خانه از جنگل» (۴۹ خانه با آن جور است). حریف آموزشی سرنخ دیگری دارد و فقط یک خانه با هر دو سرنخ جور است. مکعب‌های شروع بازی (دو تا برای هر نفر) از قبل گذاشته شده‌اند. در هر نوبت یا از دیگری دربارهٔ یک خانه می‌پرسید، یا یک خانه را جست‌وجو می‌کنید.',
    steps: [
      { instructionFa: 'از حریف دربارهٔ خانهٔ بیابانی ستون ۵، ردیف ۳ بپرسید (این خانه با سرنخ شما جور است). جواب منفی است: حریف مکعب می‌گذارد، پس سرنخ او این خانه را رد می‌کند.', expected: { type: 'question', target: 1, cell: 28 }, reply: null },
      { instructionFa: 'بعد از جواب منفی، شما هم باید یک مکعب بگذارید؛ فقط روی خانه‌ای که سرنخ خودتان رد می‌کند. خانهٔ بیابانی ستون ۵، ردیف ۵ از هیچ جنگلی یک خانه فاصله ندارد؛ مکعب را آنجا بگذارید.', expected: { type: 'placeCube', cell: 52 }, reply: { type: 'question', target: 0, cell: 41 } },
      { instructionFa: 'حریف دربارهٔ کوهستان ستون ۶، ردیف ۴ از شما پرسید و چون کنار جنگل است دیسک شما خودکار آنجا نشست. حالا خانهٔ جنگلی ستون ۶، ردیف ۳ را جست‌وجو کنید تا ببینید چه می‌شود.', expected: { type: 'search', cell: 29 }, reply: null },
      { instructionFa: 'حریف جست‌وجو را رد کرد و مکعبش را گذاشت. پس از جست‌وجوی ردشده هم باید یک مکعب بگذارید: کوهستان ستون ۴، ردیف ۵ را انتخاب کنید که از جنگل دور است.', expected: { type: 'placeCube', cell: 51 }, reply: { type: 'question', target: 0, cell: 16 } },
      { instructionFa: 'مکعب‌های حریف کنار جنگل‌ها نشان می‌دهد سرنخ او دربارهٔ چیز دیگری است. از او دربارهٔ کوهستان ستون ۵، ردیف ۴ بپرسید.', expected: { type: 'question', target: 1, cell: 40 }, reply: { type: 'question', target: 0, cell: 17 } },
      { instructionFa: 'حریف دیسک گذاشت: این خانه با هر دو سرنخ جور است. حالا همان خانه را جست‌وجو کنید؛ چون حریف قبلاً آنجا دیسک دارد، جست‌وجو تأیید می‌شود.', expected: { type: 'search', cell: 40 }, reply: null }
    ],
    completedFa: 'بردید! جانور در کوهستان ستون ۵، ردیف ۴ بود. سرنخ حریف «در فاصلهٔ ۳ خانه از سازهٔ آبی» بود (۲۹ خانه) و فقط همین خانه با هر دو سرنخ جور بود. در این آموزش ۲ پرسش، ۲ جست‌وجو و ۲ مکعب اجباری را تمرین کردید.'
  }
};
