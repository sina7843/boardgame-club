// Backgammon («تخته‌نرد»): standard rules for two players, 15 checkers each. Server-rolled dice; a whole turn is one
// `play` action (the sequence of checker moves), validated against the "use as many dice as possible / the larger
// die" rules. Optional doubling cube; gammons and backgammons count unless the table turns them off.
//
// Board: points 0..23 (absolute). Seat 0 («سفید») moves 23 → 0 and bears off below 0; its home board is 0..5.
// Seat 1 («سیاه») moves 0 → 23 and bears off above 23; its home board is 18..23. `pts[i]` > 0 = seat 0 checkers,
// < 0 = seat 1 checkers.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { backgammon } from './definition.ts';

export const CHECKERS = 15;
const MAX_TIMEOUTS = 3;

export type From = number | 'bar';
export interface Step { from: From; die: number }
export interface Played { from: From; to: number | 'off'; die: number; hit: boolean }
export interface Pos { pts: number[]; bar: [number, number]; off: [number, number] }

export type WinKind = 'single' | 'gammon' | 'backgammon';
export type LogEntry =
  | { seq: number; t: 'opening'; seat: number; dice: [number, number] }
  | { seq: number; t: 'roll'; seat: number; dice: [number, number] }
  | { seq: number; t: 'play'; seat: number; moves: Played[] }
  | { seq: number; t: 'pass'; seat: number; dice: [number, number] }
  | { seq: number; t: 'double'; seat: number; value: number }
  | { seq: number; t: 'take'; seat: number; value: number }
  | { seq: number; t: 'drop'; seat: number }
  | { seq: number; t: 'timeout'; seat: number }
  | { seq: number; t: 'resign'; seat: number }
  | { seq: number; t: 'win'; seat: number; kind: WinKind; points: number };
type LogBody = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'seq'> : never) : never;

export interface BgState extends Pos {
  current: number;
  phase: 'roll' | 'move' | 'cube' | 'end';
  /** The roll being played (both dice; doubles are played four times). */
  dice: [number, number] | null;
  cube: { value: number; owner: number | null };
  rules: { cube: boolean; gammons: boolean };
  timeouts: [number, number];
  /** Tutorial only: fixed dice, consumed before the RNG. Never projected. */
  script: [number, number][];
  log: LogEntry[];
  seq: number;
  win: { seat: number; kind: WinKind; points: number } | null;
  outcome: Outcome | null;
}

export type BgView = Omit<BgState, 'script' | 'timeouts' | 'seq'> & { pips: [number, number] };

const from = z.union([z.literal('bar'), z.number().int().min(0).max(23)]);
export const backgammonAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('play'), moves: z.array(z.strictObject({ from, die: z.number().int().min(1).max(6) })).max(4) }),
  z.strictObject({ type: z.literal('double') }),
  z.strictObject({ type: z.literal('take') }),
  z.strictObject({ type: z.literal('drop') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BgAction = z.infer<typeof backgammonAction>;

// ---------- board geometry ----------

const dir = (seat: number) => (seat === 0 ? -1 : 1);
const own = (pts: number[], i: number, seat: number) => (seat === 0 ? Math.max(0, pts[i]!) : Math.max(0, -pts[i]!));
const opp = (pts: number[], i: number, seat: number) => own(pts, i, 1 - seat);
const inHome = (i: number, seat: number) => (seat === 0 ? i <= 5 : i >= 18);
/** Distance of point i from bearing off, for the given seat (1..24). */
export const pipOf = (i: number, seat: number) => (seat === 0 ? i + 1 : 24 - i);

export function startPos(): Pos {
  const pts = Array<number>(24).fill(0);
  // Seat 0: 2 on its 24-point, 5 on 13, 3 on 8, 5 on 6. Seat 1 mirrored.
  pts[23] = 2; pts[12] = 5; pts[7] = 3; pts[5] = 5;
  pts[0] = -2; pts[11] = -5; pts[16] = -3; pts[18] = -5;
  return { pts, bar: [0, 0], off: [0, 0] };
}

export function pipCount(p: Pos, seat: number): number {
  let n = p.bar[seat]! * 25;
  for (let i = 0; i < 24; i++) n += own(p.pts, i, seat) * pipOf(i, seat);
  return n;
}

const allHome = (p: Pos, seat: number) => p.bar[seat] === 0 && p.pts.every((_, i) => inHome(i, seat) || own(p.pts, i, seat) === 0);

/** Where a single checker step lands, or null if it is not legal on this position. */
export function target(p: Pos, seat: number, f: From, die: number): number | 'off' | null {
  if (p.bar[seat]! > 0 && f !== 'bar') return null;
  if (f === 'bar') {
    if (p.bar[seat] === 0) return null;
    const to = seat === 0 ? 24 - die : die - 1;
    return opp(p.pts, to, seat) >= 2 ? null : to;
  }
  if (own(p.pts, f, seat) === 0) return null;
  const to = f + dir(seat) * die;
  if (to >= 0 && to <= 23) return opp(p.pts, to, seat) >= 2 ? null : to;
  if (!allHome(p, seat)) return null;
  const exact = seat === 0 ? to === -1 : to === 24;
  if (exact) return 'off';
  // Bearing off with a higher die only from the farthest occupied point.
  const farther = seat === 0 ? [f + 1, 5] : [18, f - 1];
  for (let i = farther[0]!; i <= farther[1]!; i++) if (own(p.pts, i, seat) > 0) return null;
  return 'off';
}

/** Apply one step (assumed legal). Returns the new position and whether a blot was hit. */
export function step(p: Pos, seat: number, s: Step): { pos: Pos; played: Played } {
  const to = target(p, seat, s.from, s.die)!;
  const pts = p.pts.slice();
  const bar: [number, number] = [p.bar[0], p.bar[1]];
  const off: [number, number] = [p.off[0], p.off[1]];
  const sign = seat === 0 ? 1 : -1;
  if (s.from === 'bar') bar[seat]! -= 1; else pts[s.from] = pts[s.from]! - sign;
  let hit = false;
  if (to === 'off') off[seat]! += 1;
  else {
    if (opp(pts, to, seat) === 1) { pts[to] = 0; bar[1 - seat]! += 1; hit = true; }
    pts[to] = pts[to]! + sign;
  }
  return { pos: { pts, bar, off }, played: { from: s.from, to, die: s.die, hit } };
}

const diceList = (d: [number, number]) => (d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]);
const sources = (p: Pos, seat: number): From[] => (p.bar[seat]! > 0 ? ['bar'] : p.pts.map((_, i) => i).filter((i) => own(p.pts, i, seat) > 0));

/** Every complete legal play for this roll (sequences that use the most dice; the larger-die rule applied). */
export function legalPlays(p: Pos, seat: number, dice: [number, number]): Step[][] {
  const out: Step[][] = [];
  const seen = new Set<string>();
  let best = 0;
  const walk = (pos: Pos, left: number[], path: Step[]) => {
    let moved = false;
    const tried = new Set<number>();
    for (let k = 0; k < left.length; k++) {
      const die = left[k]!;
      if (tried.has(die)) continue;
      tried.add(die);
      for (const f of sources(pos, seat)) {
        if (target(pos, seat, f, die) === null) continue;
        moved = true;
        const next = step(pos, seat, { from: f, die }).pos;
        walk(next, [...left.slice(0, k), ...left.slice(k + 1)], [...path, { from: f, die }]);
      }
    }
    if (!moved && path.length >= best) {
      if (path.length > best) { best = path.length; out.length = 0; seen.clear(); }
      const key = path.map((s) => `${s.from}:${s.die}`).join(',');
      if (!seen.has(key)) { seen.add(key); out.push(path); }
    }
  };
  walk(p, diceList(dice), []);
  // Only one die can be played: it must be the larger one when either could be.
  if (best === 1 && dice[0] !== dice[1]) {
    const hi = Math.max(dice[0], dice[1]);
    if (out.some((pl) => pl[0]!.die === hi)) return out.filter((pl) => pl[0]!.die === hi);
  }
  return best === 0 ? [[]] : out;
}

/** Legal next single steps after `done` (prefix of a complete play). Used by the renderer to offer moves. */
export function nextSteps(p: Pos, seat: number, dice: [number, number], done: Step[]): Step[] {
  const key = (s: Step) => `${s.from}:${s.die}`;
  const out = new Map<string, Step>();
  for (const pl of legalPlays(p, seat, dice)) {
    if (pl.length <= done.length) continue;
    if (done.every((s, i) => key(s) === key(pl[i]!))) out.set(key(pl[done.length]!), pl[done.length]!);
  }
  return [...out.values()];
}

const samePlay = (a: Step[], b: Step[]) => a.length === b.length && a.every((s, i) => s.from === b[i]!.from && s.die === b[i]!.die);

// ---------- turn flow ----------

const log = (s: BgState, e: LogBody) => { s.log.push({ ...e, seq: ++s.seq } as LogEntry); if (s.log.length > 40) s.log.shift(); };
const rollDice = (s: BgState, rng: EngineRng): [number, number] => s.script.shift() ?? [1 + rng.nextInt(6), 1 + rng.nextInt(6)];
const canDouble = (s: BgState, seat: number) => s.rules.cube && s.cube.value < 64 && (s.cube.owner === null || s.cube.owner === seat);

/** Start `seat`'s turn: wait for roll/double when the cube is in play, otherwise roll at once. */
function beginTurn(s: BgState, seat: number, rng: EngineRng) {
  s.current = seat;
  s.dice = null;
  if (canDouble(s, seat)) { s.phase = 'roll'; return; }
  roll(s, rng);
}

function roll(s: BgState, rng: EngineRng) {
  // A player with no legal play passes; the guard only matters for a mutual close-out.
  for (let guard = 0; guard < 8; guard++) {
    const seat = s.current;
    s.dice = rollDice(s, rng);
    const plays = legalPlays(s, seat, s.dice);
    if (plays[0]!.length > 0) { log(s, { t: 'roll', seat, dice: s.dice }); s.phase = 'move'; return; }
    log(s, { t: 'pass', seat, dice: s.dice });
    s.current = 1 - seat;
    s.dice = null;
    if (canDouble(s, s.current)) { s.phase = 'roll'; return; }
  }
  s.phase = 'roll';
}

function winKind(s: BgState, winner: number): WinKind {
  const loser = 1 - winner;
  if (!s.rules.gammons || s.off[loser]! > 0) return 'single';
  const stuck = s.bar[loser]! > 0 || s.pts.some((_, i) => inHome(i, winner) && own(s.pts, i, loser) > 0);
  return stuck ? 'backgammon' : 'gammon';
}

function finishGame(s: BgState, winner: number, kind: WinKind, points: number, reason: Outcome['reason']) {
  s.phase = 'end';
  s.dice = null;
  s.win = { seat: winner, kind, points };
  log(s, { t: 'win', seat: winner, kind, points });
  s.outcome = { placements: [{ seat: winner, place: 1, score: points }, { seat: 1 - winner, place: 2, score: 0 }], reason };
}

const KIND_MULT: Record<WinKind, number> = { single: 1, gammon: 2, backgammon: 3 };

function doPlay(s: BgState, seat: number, moves: Step[], rng: EngineRng) {
  const played: Played[] = [];
  let pos: Pos = s;
  for (const m of moves) { const r = step(pos, seat, m); pos = r.pos; played.push(r.played); }
  s.pts = pos.pts; s.bar = pos.bar; s.off = pos.off;
  log(s, { t: 'play', seat, moves: played });
  if (s.off[seat] === CHECKERS) {
    const kind = winKind(s, seat);
    finishGame(s, seat, kind, KIND_MULT[kind] * s.cube.value, 'win');
    return;
  }
  beginTurn(s, 1 - seat, rng);
}

type Events = Transition<BgState>['internalEvents'];
const finish = (s: BgState, events: Events): Transition<BgState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

/** Seat whose decision the game waits on. */
const waitingOn = (s: BgState) => (s.phase === 'cube' ? 1 - s.current : s.current);

export const backgammonModule: GameModule<BgState, BgAction, BgView> = {
  manifest: backgammon.manifest,
  actionSchema: backgammonAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('backgammon needs exactly 2 players');
    const s: BgState = {
      ...startPos(), current: 0, phase: 'move', dice: null,
      cube: { value: 1, owner: null },
      rules: { cube: options.cube === true || options.cube === 'on', gammons: options.gammons !== false && options.gammons !== 'off' },
      timeouts: [0, 0], script: [], log: [], seq: 0, win: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // Endgame: the learner (seat 0) has two checkers left (13 borne off): one still outside home on the 7-point,
      // one on the 3-point. 4-1 brings it home, the opponent bears off with 6-5, then 3-2 bears off both and wins.
      s.pts = Array<number>(24).fill(0);
      s.pts[6] = 1; s.pts[2] = 1; s.pts[20] = -14;
      s.off = [13, 1];
      s.script = [[6, 5], [3, 2]];
      s.dice = [4, 1];
      log(s, { t: 'roll', seat: 0, dice: s.dice });
      return s;
    }
    // Opening roll: one die each, re-rolled on a tie; the higher die moves first using both dice.
    let a = 0, b = 0;
    while (a === b) { a = 1 + rng.nextInt(6); b = 1 + rng.nextInt(6); }
    s.current = a > b ? 0 : 1;
    s.dice = [a, b];
    log(s, { t: 'opening', seat: s.current, dice: s.dice });
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== waitingOn(s)) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'roll': return s.phase === 'roll' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'double': return s.phase === 'roll' && canDouble(s, actor.seat) ? { ok: true } : { ok: false, errorCode: 'CANNOT_DOUBLE' };
      case 'take': case 'drop': return s.phase === 'cube' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'play':
        if (s.phase !== 'move' || !s.dice) return { ok: false, errorCode: 'WRONG_PHASE' };
        return legalPlays(s, actor.seat, s.dice).some((pl) => samePlay(pl, a.moves)) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      log(s, { t: 'resign', seat });
      // Resigning (like losing on time) concedes a single game at the current cube value.
      finishGame(s, 1 - seat, 'single', s.cube.value, 'resign');
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'roll') roll(s, ctx.rng);
    else if (a.type === 'double') { s.phase = 'cube'; log(s, { t: 'double', seat, value: s.cube.value * 2 }); }
    else if (a.type === 'take') {
      s.cube = { value: s.cube.value * 2, owner: seat };
      log(s, { t: 'take', seat, value: s.cube.value });
      roll(s, ctx.rng);
    } else if (a.type === 'drop') {
      log(s, { t: 'drop', seat });
      finishGame(s, s.current, 'single', s.cube.value, 'win');
    } else doPlay(s, seat, a.moves, ctx.rng);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { script: _s, timeouts: _t, seq: _q, ...view } = s;
    void _s; void _t; void _q;
    return { ...structuredClone(view), pips: [pipCount(s, 0), pipCount(s, 1)] };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === waitingOn(s)) {
      if (s.phase === 'roll') { out.push({ type: 'roll' }); if (canDouble(s, viewer.seat)) out.push({ type: 'double' }); }
      if (s.phase === 'cube') out.push({ type: 'take' }, { type: 'drop' });
      // The renderer builds the play step by step with nextSteps(); one hint marks that a play is due.
      if (s.phase === 'move') out.push({ type: 'play' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = waitingOn(s);
    log(s, { t: 'timeout', seat });
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      finishGame(s, 1 - seat, 'single', s.cube.value, 'timeout');
      return finish(s, [{ type: 'timed-out', seat }]);
    }
    // Passive play for the absent player: take a double, roll, or play the first legal sequence.
    if (s.phase === 'cube') { s.cube = { value: s.cube.value * 2, owner: seat }; log(s, { t: 'take', seat, value: s.cube.value }); roll(s, ctx.rng); }
    else if (s.phase === 'roll') roll(s, ctx.rng);
    if (!s.outcome && s.phase === 'move' && s.current === seat) doPlay(s, seat, legalPlays(s, seat, s.dice!)[0]!, ctx.rng);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [waitingOn(s)]),

  tutorial: {
    seed: 4,
    options: { deal: 'tutorial' },
    introFa: 'شما مهره‌های سفید هستید و مهره‌ها را به سمت خانه‌تان (شش خانه پایین سمت راست) می‌برید. ۱۳ مهره را بیرون برده‌اید و دو مهره مانده؛ هر تاس یعنی یک مهره به همان تعداد خانه جلو برود.',
    steps: [
      {
        instructionFa: 'تاس ۴ و ۱ آمده. اول مهره خانه ۷ را بزنید تا با ۴ به خانه ۳ برود؛ بعد مهره خانه ۳ را بزنید تا با ۱ به خانه ۲ برود. حالا هر دو مهره در خانه شما هستند.',
        expected: { type: 'play', moves: [{ from: 6, die: 4 }, { from: 2, die: 1 }] },
        reply: { type: 'play', moves: [{ from: 20, die: 6 }, { from: 20, die: 5 }] }
      },
      {
        instructionFa: 'وقتی همه مهره‌ها در خانه‌اند می‌توانید بیرون ببرید. تاس ۳ و ۲: مهره خانه ۳ را با ۳ و مهره خانه ۲ را با ۲ بیرون ببرید (روی جای مهره‌های بیرون‌برده بزنید) تا برنده شوید.',
        expected: { type: 'play', moves: [{ from: 2, die: 3 }, { from: 1, die: 2 }] },
        reply: null
      }
    ],
    completedFa: 'بردید! در بازی کامل، مهره‌ای که تنها روی یک خانه باشد ممکن است زده شود و به بار برود و باید اول از خانه حریف وارد شود. اگر حریف هیچ مهره‌ای بیرون نبرده باشد «مارس» (۲ امتیاز) است.'
  }
};
