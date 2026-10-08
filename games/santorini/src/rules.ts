// Santorini («سانتورینی»), base game for 2 players (no god powers). Setup: the first player places both workers,
// then the second. A turn: move one of your workers to an adjacent square (8 directions; not occupied, not domed, at
// most one level up — down any amount), then build on a square adjacent to that worker (+1 level; on level 3 a dome).
// Moving up onto level 3 wins at once. A player who cannot take a whole turn (move + build) loses.
// Pieces are limited as in the box: 22 / 18 / 14 blocks and 18 domes.
// Board: index = r * 5 + c, r 0 = the first player's side (bottom).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { santorini } from './definition.ts';

export interface SantoriniState {
  /** 0–3 = block level, 4 = domed. */
  height: number[];
  /** workers[seat] = squares of that player's workers (placed so far). */
  workers: [number[], number[]];
  supply: { 1: number; 2: number; 3: number; dome: number };
  phase: 'setup' | 'play';
  current: number;
  first: number;
  history: { seat: number; from: number | null; to: number; build: number | null }[];
  timeouts: [number, number];
  end: { kind: 'climb' | 'stuck' | 'resign' | 'timeout' } | null;
  outcome: Outcome | null;
}
export type SantoriniView = Omit<SantoriniState, 'timeouts'>;

const sq = z.number().int().min(0).max(24);
export const santoriniAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), at: sq }),
  z.strictObject({ type: z.literal('turn'), from: sq, to: sq, build: sq.optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SantoriniAction = z.infer<typeof santoriniAction>;

export const adjacent = (a: number, b: number) => a !== b && Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) <= 1 && Math.abs((a % 5) - (b % 5)) <= 1;
const around = (a: number) => Array.from({ length: 25 }, (_, i) => i).filter((i) => adjacent(a, i));

type Board = Pick<SantoriniState, 'height' | 'workers' | 'supply'>;
const occupied = (s: Board, i: number) => s.workers[0].includes(i) || s.workers[1].includes(i);
const canBuildOn = (s: Board, i: number) => {
  const h = s.height[i]!;
  if (h >= 4) return false;
  return h === 3 ? s.supply.dome > 0 : s.supply[(h + 1) as 1 | 2 | 3] > 0;
};

/** Squares a worker on `from` may move to. */
export function moveTargets(s: Board, from: number): number[] {
  return around(from).filter((i) => !occupied(s, i) && s.height[i]! < 4 && s.height[i]! <= s.height[from]! + 1);
}
/** Squares a worker that has moved from `from` to `to` may build on (the vacated square counts as free). */
export function buildTargets(s: Board, from: number, to: number): number[] {
  return around(to).filter((i) => (i === from || !occupied(s, i)) && canBuildOn(s, i));
}
/** Every complete turn for `seat`: winning moves need no build. */
export function turns(s: Board, seat: number): { from: number; to: number; build?: number }[] {
  const out: { from: number; to: number; build?: number }[] = [];
  for (const from of s.workers[seat as 0 | 1]) {
    for (const to of moveTargets(s, from)) {
      if (s.height[to] === 3 && s.height[from] === 2) { out.push({ from, to }); continue; }
      for (const build of buildTargets(s, from, to)) out.push({ from, to, build });
    }
  }
  return out;
}

// ---------- module ----------

type Events = Transition<SantoriniState>['internalEvents'];
const MAX_TIMEOUTS = 3;
const finish = (s: SantoriniState, events: Events): Transition<SantoriniState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const win = (s: SantoriniState, seat: number, kind: NonNullable<SantoriniState['end']>['kind'], reason: Outcome['reason']) => {
  s.end = { kind };
  s.outcome = { placements: [{ seat, place: 1 }, { seat: 1 - seat, place: 2 }], reason };
};

/** Pass the turn; the next player loses at once if no whole turn is possible. */
function next(s: SantoriniState) {
  s.current = 1 - s.current;
  if (s.phase === 'play' && !turns(s, s.current).length) win(s, 1 - s.current, 'stuck', 'win');
}

function doTurn(s: SantoriniState, seat: number, t: { from: number; to: number; build?: number }) {
  const ws = s.workers[seat as 0 | 1];
  ws[ws.indexOf(t.from)] = t.to;
  if (s.height[t.to] === 3 && s.height[t.from] === 2) {
    s.history.push({ seat, from: t.from, to: t.to, build: null });
    win(s, seat, 'climb', 'win');
    return;
  }
  const b = t.build!;
  const h = s.height[b]!;
  if (h === 3) s.supply.dome -= 1; else s.supply[(h + 1) as 1 | 2 | 3] -= 1;
  s.height[b] = h + 1;
  s.history.push({ seat, from: t.from, to: t.to, build: b });
  next(s);
}

/** Setup: place a worker; after both of a player's workers, the other places; then the first player moves. */
function place(s: SantoriniState, seat: number, at: number) {
  s.workers[seat as 0 | 1].push(at);
  s.history.push({ seat, from: null, to: at, build: null });
  if (s.workers[seat as 0 | 1].length < 2) return;
  if (s.workers[1 - seat as 0 | 1].length < 2) { s.current = 1 - seat; return; }
  s.phase = 'play';
  s.current = s.first;
  if (!turns(s, s.current).length) win(s, 1 - s.current, 'stuck', 'win');
}

function randomTurn(s: SantoriniState, seat: number, rng: EngineRng) {
  const all = turns(s, seat);
  return all.find((t) => t.build === undefined) ?? all[rng.nextInt(all.length)]!;
}

export const santoriniModule: GameModule<SantoriniState, SantoriniAction, SantoriniView> = {
  manifest: santorini.manifest,
  actionSchema: santoriniAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('santorini needs exactly 2 players');
    const first = options.firstMove === 'host' ? 0 : rng.nextInt(2);
    const s: SantoriniState = {
      height: Array(25).fill(0), workers: [[], []], supply: { 1: 22, 2: 18, 3: 14, dome: 18 },
      phase: 'setup', current: first, first, history: [], timeouts: [0, 0], end: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // Your worker stands on a level-2 terrace next to another level-2 terrace and a level-2 tower.
      s.height[12] = 2; s.height[7] = 2; s.height[13] = 2;
      s.supply = { 1: 19, 2: 15, 3: 14, dome: 18 };
      s.workers = [[12, 0], [24, 20]];
      s.phase = 'play'; s.current = 0; s.first = 0;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'place') {
      if (s.phase !== 'setup') return { ok: false, errorCode: 'WRONG_PHASE' };
      return occupied(s, a.at) ? { ok: false, errorCode: 'SQUARE_TAKEN' } : { ok: true };
    }
    if (s.phase !== 'play') return { ok: false, errorCode: 'WRONG_PHASE' };
    const ok = turns(s, actor.seat).some((t) => t.from === a.from && t.to === a.to && t.build === a.build);
    return ok ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a, ctx) {
    void ctx;
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { win(s, 1 - seat, 'resign', 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'place') { place(s, seat, a.at); return finish(s, [{ type: 'placed', seat }]); }
    doTurn(s, seat, a);
    return finish(s, [{ type: 'turn', seat }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = s;
    void _t;
    return structuredClone(rest);
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    // Placements and turns are computed on the client from the public view (moveTargets / buildTargets).
    if (viewer.seat === s.current) out.push({ type: s.phase === 'setup' ? 'place' : 'turn' });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { win(s, 1 - seat, 'timeout', 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    if (s.phase === 'setup') {
      const free = Array.from({ length: 25 }, (_, i) => i).filter((i) => !occupied(s, i));
      place(s, seat, free[ctx.rng.nextInt(free.length)]!);
    } else doTurn(s, seat, randomTurn(s, seat, ctx.rng));
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 9,
    options: { firstMove: 'host', deal: 'tutorial' },
    introFa: 'شما کارگرهای سفید هستید. در هر نوبت یک کارگر را یک خانه (هر جهت) جابه‌جا می‌کنید و بعد کنار همان کارگر یک طبقه می‌سازید. کسی که به طبقه سوم برود می‌برد.',
    steps: [
      { instructionFa: 'کارگر وسط صفحه (روی طبقه ۲) را بزنید و به سکوی طبقه ۲ روشن‌شده ببرید؛ بعد روی برج طبقه ۲ روشن‌شده بسازید تا طبقه ۳ شود.', expected: { type: 'turn', from: 12, to: 7, build: 13 }, reply: { type: 'turn', from: 24, to: 19, build: 24 } },
      { instructionFa: 'حالا کارگرتان را روی برج طبقه ۳ ببرید و برنده شوید!', expected: { type: 'turn', from: 7, to: 13 }, reply: null }
    ],
    completedFa: 'بردید! بالا رفتن فقط یک طبقه در هر حرکت ممکن است، ولی پایین آمدن هر چند طبقه آزاد است. روی طبقه سوم می‌شود گنبد گذاشت تا کسی بالا نرود.'
  }
};
