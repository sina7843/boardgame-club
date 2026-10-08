// Patchwork («چهل‌تکه»), two players, perfect information. 33 patches in a circle (a generated set following the
// original's sizes, button costs 0–10, time costs 1–6 and button incomes 0–3; not a piece-for-piece copy), a 9×9 quilt
// each, a 53-space time track. The player behind on the track moves (on a tie, whoever arrived last). A turn: buy one
// of the three patches after the neutral token (pay buttons, place it rotated/flipped, advance by its time; the token
// moves to its spot), or advance to one space past the opponent taking one button per space. Passing an income space
// (5, 11, …, 53) pays the buttons printed on your quilt; the first to pass a leather space (20, 26, 32, 38, 44) must
// place a 1×1 patch. The first to complete a 7×7 square gets +7. End when both reach 53: buttons − 2 × empty squares.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { patchwork } from './definition.ts';

export const END = 53;
export const INCOME = [5, 11, 17, 23, 29, 35, 41, 47, 53];
export const LEATHER = [20, 26, 32, 38, 44];
export interface Patch { id: number; cells: [number, number][]; cost: number; time: number; buttons: number }

const RAW: [string, number, number, number][] = [
  ['XX', 2, 1, 0], ['XXX', 2, 2, 0], ['XX/X.', 1, 3, 0], ['XX/XX', 6, 5, 2], ['XXXX', 3, 3, 1], ['XXX/X..', 4, 2, 1],
  ['XXX/.X.', 2, 2, 0], ['XX./.XX', 3, 2, 1], ['XXXXX', 7, 1, 1], ['X../XXX/..X', 2, 3, 0], ['.X./XXX/.X.', 5, 4, 2], ['XXX/X.X', 3, 6, 2],
  ['XXXX/X...', 10, 3, 2], ['XXX/XX.', 2, 2, 0], ['XX../.XXX', 4, 2, 0], ['XXX/XXX', 8, 6, 3], ['.XX./XXXX', 7, 4, 2], ['X..X/XXXX', 1, 5, 1],
  ['XXXX/.XX.', 7, 5, 3], ['.X../XXXX/.X..', 0, 3, 1], ['X.X/XXX/X.X', 2, 3, 0], ['.X./XXX/X.X', 1, 2, 0], ['XX./.X./.XX', 3, 1, 0], ['X../XX./.XX', 10, 4, 3],
  ['.X/XX/X.', 3, 4, 1], ['XXX./..XX', 1, 2, 0], ['X.../XXXX', 3, 3, 1], ['.XX./XXXX/.XX.', 5, 3, 1], ['XXXX/XXXX', 10, 5, 3], ['X..../XXXXX', 7, 2, 2],
  ['.X./.X./XXX/.X.', 2, 2, 0], ['XXX/.X./.X.', 5, 5, 2], ['XX/X./XX', 1, 4, 1]
];
export const PATCHES: Patch[] = RAW.map(([shape, cost, time, buttons], id) => ({
  id, cost, time, buttons, cells: shape.split('/').flatMap((row, r) => [...row].map((ch, c) => (ch === 'X' ? [r, c] as [number, number] : null)).filter((x): x is [number, number] => !!x))
}));

/** Cells of a patch rotated (0–3 quarter turns) and optionally mirrored, normalised to start at (0, 0). */
export function orient(cells: [number, number][], rot: number, flip: boolean): [number, number][] {
  let out = cells.map(([r, c]) => [r, flip ? -c : c] as [number, number]);
  for (let i = 0; i < rot; i++) out = out.map(([r, c]) => [c, -r]);
  const mr = Math.min(...out.map((x) => x[0])), mc = Math.min(...out.map((x) => x[1]));
  return out.map(([r, c]) => [r - mr, c - mc]);
}

export interface PatchworkState {
  circle: number[];
  token: number;
  pos: number[];
  buttons: number[];
  quilts: (number | null)[][][];
  income: number[];
  leatherLeft: number[];
  pendingLeather: number[];
  bonus7: number | null;
  current: number;
  last: { seat: number; kind: 'advance' | 'buy' | 'leather'; patch?: number; gained?: number; income?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type PatchworkView = Omit<PatchworkState, 'timeouts'>;

const place = z.object({ rot: z.number().int().min(0).max(3), flip: z.boolean(), row: z.number().int().min(0).max(8), col: z.number().int().min(0).max(8) });
export const patchworkAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('advance') }),
  z.strictObject({ type: z.literal('buy'), patch: z.number().int().min(0).max(32), ...place.shape }),
  z.strictObject({ type: z.literal('leather'), row: z.number().int().min(0).max(8), col: z.number().int().min(0).max(8) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type PatchworkAction = z.infer<typeof patchworkAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const offered = (s: Pick<PatchworkState, 'circle' | 'token'>) => [0, 1, 2].map((k) => s.circle[(s.token + k) % s.circle.length]).filter((x, i, a): x is number => x !== undefined && a.indexOf(x) === i);
export const emptyCount = (q: (number | null)[][]) => q.flat().filter((x) => x === null).length;
export const score = (s: Pick<PatchworkState, 'buttons' | 'quilts' | 'bonus7'>, k: number) => s.buttons[k]! - 2 * emptyCount(s.quilts[k]!) + (s.bonus7 === k ? 7 : 0);

export function fits(q: (number | null)[][], cells: [number, number][], row: number, col: number) {
  return cells.every(([r, c]) => row + r < 9 && col + c < 9 && q[row + r]![col + c] === null);
}
function has7x7(q: (number | null)[][]) {
  for (let r = 0; r <= 2; r++) for (let c = 0; c <= 2; c++) {
    let ok = true;
    for (let i = 0; i < 7 && ok; i++) for (let j = 0; j < 7 && ok; j++) if (q[r + i]![c + j] === null) ok = false;
    if (ok) return true;
  }
  return false;
}

// ---------- module ----------

type Events = Transition<PatchworkState>['internalEvents'];
const finish = (s: PatchworkState, events: Events): Transition<PatchworkState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

/** Move `seat` from its position by `steps`, collecting income and leather; returns income paid. */
function move(s: PatchworkState, seat: number, to: number) {
  const from = s.pos[seat]!;
  const target = Math.min(END, to);
  let paid = 0;
  for (const sp of INCOME) if (sp > from && sp <= target) { s.buttons[seat]! += s.income[seat]!; paid += s.income[seat]!; }
  for (const sp of LEATHER) if (sp > from && sp <= target && s.leatherLeft.includes(sp)) { s.leatherLeft = s.leatherLeft.filter((x) => x !== sp); s.pendingLeather.push(seat); }
  s.pos[seat] = target;
  return paid;
}

function next(s: PatchworkState, mover: number) {
  if (s.pendingLeather.length) { s.current = s.pendingLeather[0]!; return; }
  const [a, b] = s.pos as [number, number];
  if (a >= END && b >= END) {
    const sc = [score(s, 0), score(s, 1)] as [number, number];
    // Tie: the player who reached the end first wins (the other one arrived on top) — here the non-mover.
    const w = sc[0] !== sc[1] ? (sc[0] > sc[1] ? 0 : 1) : 1 - mover;
    s.outcome = { placements: [{ seat: w, place: 1, score: sc[w]! }, { seat: 1 - w, place: 2, score: sc[1 - w]! }], reason: 'score' };
    return;
  }
  s.current = a < b ? 0 : b < a ? 1 : mover;
}

function claim7(s: PatchworkState, seat: number) { if (s.bonus7 === null && has7x7(s.quilts[seat]!)) s.bonus7 = seat; }

export const patchworkModule: GameModule<PatchworkState, PatchworkAction, PatchworkView> = {
  manifest: patchwork.manifest,
  actionSchema: patchworkAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('patchwork is a two-player game');
    // The smallest patch sits right after the neutral token, the rest are shuffled.
    const s: PatchworkState = {
      circle: [...shuffle(rng, PATCHES.slice(1).map((p) => p.id)), 0], token: 0, pos: [0, 0], buttons: [5, 5],
      quilts: [0, 1].map(() => Array.from({ length: 9 }, () => Array<number | null>(9).fill(null))), income: [0, 0], leatherLeft: LEATHER.slice(),
      pendingLeather: [], bonus7: null, current: rng.nextInt(2), last: null, seq: 0, timeouts: [0, 0], outcome: null
    };
    s.token = s.circle.length - 1;
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.pos = [49, 53];
      s.buttons = [12, 9];
      s.leatherLeft = [];
      s.income = [6, 4];
      // Pre-sewn quilts: the learner has a 3-cell gap shaped like the offered L patch.
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { s.quilts[0]![r]![c] = 99; s.quilts[1]![r]![c] = (r * 9 + c) % 5 ? 98 : null; }
      s.quilts[0]![4]![4] = null; s.quilts[0]![4]![5] = null; s.quilts[0]![5]![4] = null;
      s.circle = [2, 0, 1, 3, 4];
      s.token = 0;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const q = s.quilts[seat]!;
    if (s.pendingLeather.length) {
      if (a.type !== 'leather') return { ok: false, errorCode: 'PLACE_LEATHER' };
      return q[a.row]![a.col] === null ? { ok: true } : { ok: false, errorCode: 'OCCUPIED' };
    }
    if (a.type === 'leather') return { ok: false, errorCode: 'NO_LEATHER' };
    if (a.type === 'advance') return { ok: true };
    if (!offered(s).includes(a.patch)) return { ok: false, errorCode: 'NOT_OFFERED' };
    if (PATCHES[a.patch]!.cost > s.buttons[seat]!) return { ok: false, errorCode: 'CANNOT_AFFORD' };
    return fits(q, orient(PATCHES[a.patch]!.cells, a.rot, a.flip), a.row, a.col) ? { ok: true } : { ok: false, errorCode: 'DOES_NOT_FIT' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [{ seat: 1 - seat, place: 1, score: score(s, 1 - seat) }, { seat, place: 2, score: score(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'leather') {
      s.quilts[seat]![a.row]![a.col] = -1;
      s.pendingLeather.shift();
      claim7(s, seat);
      s.last = { seat, kind: 'leather' };
    } else if (a.type === 'advance') {
      const to = s.pos[1 - seat]! + 1;
      const gained = Math.min(END, to) - s.pos[seat]!;
      s.buttons[seat]! += gained;
      const income = move(s, seat, to);
      s.last = { seat, kind: 'advance', gained, income };
    } else {
      const p = PATCHES[a.patch]!;
      for (const [r, c] of orient(p.cells, a.rot, a.flip)) s.quilts[seat]![a.row + r]![a.col + c] = p.id;
      s.buttons[seat]! -= p.cost;
      s.income[seat]! += p.buttons;
      const idx = s.circle.indexOf(a.patch);
      s.circle.splice(idx, 1);
      s.token = s.circle.length ? idx % s.circle.length : 0;
      claim7(s, seat);
      const income = move(s, seat, s.pos[seat]! + p.time);
      s.last = { seat, kind: 'buy', patch: p.id, income };
    }
    next(s, seat);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = structuredClone(s);
    return rest;
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      if (s.pendingLeather.length) out.push({ type: 'leather' });
      else {
        out.push({ type: 'advance' });
        for (const id of offered(s)) if (PATCHES[id]!.cost <= s.buttons[seat]!) out.push({ type: 'buy', patch: id });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    let a: PatchworkAction = { type: 'advance' };
    if (s.pendingLeather.length) {
      const q = s.quilts[seat]!;
      const i = q.flat().findIndex((x) => x === null);
      a = { type: 'leather', row: Math.floor(i / 9), col: i % 9 };
    }
    const t = patchworkModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 37,
    options: { deal: 'tutorial' },
    introFa: 'لحاف شما تقریباً کامل است؛ فقط یک جای خالی سه‌خانه‌ای مانده. حریف به آخر مسیر زمان رسیده و شما چهار خانه عقب‌ترید، پس نوبت شماست.',
    steps: [
      { instructionFa: 'تکهٔ سه‌خانه‌ای L را بخرید و در جای خالی بدوزید (خانهٔ ردیف ۵، ستون ۵).', expected: { type: 'buy', patch: 2, rot: 0, flip: false, row: 4, col: 4 }, reply: null },
      { instructionFa: 'هنوز عقب‌ترید: «جلو رفتن» را بزنید تا به آخر مسیر برسید و دکمه بگیرید.', expected: { type: 'advance' }, reply: null }
    ],
    completedFa: 'بردید! لحاف کامل، پاداش ۷×۷ و دکمه‌های بیشتر — حریف جای خالی زیادی داشت.'
  }
};
