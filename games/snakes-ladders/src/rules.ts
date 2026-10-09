// Snakes and Ladders (مارپله): 2–6 players race from off the board to square 100. The server rolls one die. A ladder's
// foot carries you up, a snake's head down. Board: the classic 1943 "Chutes and Ladders" layout.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { snakesLadders } from './definition.ts';

export const SIZE = 100;
export const LADDERS: Record<number, number> = { 1: 38, 4: 14, 9: 31, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 80: 100 };
export const SNAKES: Record<number, number> = { 16: 6, 47: 26, 49: 11, 56: 53, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 98: 78 };
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 30;

export type LogEntry =
  | { t: 'roll'; seat: number; die: number; from: number; to: number; via: 'ladder' | 'snake' | 'bounce' | 'stay' | null; landed: number }
  | { t: 'again'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'timeout'; seat: number };

export interface SnakesState {
  players: number;
  pos: number[];
  active: boolean[];
  current: number;
  /** 'exact': an overshooting roll does not move; 'bounce': count back from 100. */
  finish: 'exact' | 'bounce';
  sixAgain: boolean;
  lastDie: number | null;
  timeouts: number[];
  /** Tutorial only: predetermined dice. */
  script: number[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

export const snakesAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SnakesAction = z.infer<typeof snakesAction>;
export type SnakesView = Omit<SnakesState, 'script' | 'timeouts' | 'seq'>;

function log(s: SnakesState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

const nextActive = (s: SnakesState, from: number) => {
  for (let k = 1; k <= s.players; k++) { const seat = (from + k) % s.players; if (s.active[seat]) return seat; }
  return from;
};

/** Final placements: the winner first, then by board position (ties share a place), players who left last. */
function rank(s: SnakesState, winner: number | null): Outcome['placements'] {
  const live = s.pos.map((p, seat) => ({ seat, p })).filter((x) => s.active[x.seat] && x.seat !== winner);
  const out: Outcome['placements'] = winner === null ? [] : [{ seat: winner, place: 1 }];
  const base = out.length;
  for (const x of live) out.push({ seat: x.seat, place: base + 1 + live.filter((o) => o.p > x.p).length });
  const lastPlace = base + live.length + 1;
  for (let seat = 0; seat < s.players; seat++) if (!s.active[seat] && seat !== winner) out.push({ seat, place: lastPlace });
  return out;
}

/** Move one seat by a die value; returns the log entry. */
export function step(s: SnakesState, seat: number, die: number): LogEntry {
  const from = s.pos[seat]!;
  let to = from + die;
  let via: Extract<LogEntry, { t: 'roll' }>['via'] = null;
  if (to > SIZE) {
    if (s.finish === 'exact') { to = from; via = 'stay'; } else { to = SIZE - (to - SIZE); via = 'bounce'; }
  }
  const landed = to;
  if (LADDERS[to]) { to = LADDERS[to]!; via = 'ladder'; } else if (SNAKES[to]) { to = SNAKES[to]!; via = 'snake'; }
  s.pos[seat] = to;
  return { t: 'roll', seat, die, from, to, via, landed };
}

function leave(s: SnakesState, seat: number, reason: 'resign' | 'timeout') {
  s.active[seat] = false;
  log(s, { t: 'left', seat, reason });
  const left = s.active.filter(Boolean).length;
  if (left === 1) {
    const winner = s.active.indexOf(true);
    s.outcome = { reason: 'resign', placements: rank(s, winner) };
  } else if (s.current === seat) s.current = nextActive(s, seat);
}

const finish = (s: SnakesState, events: Transition<SnakesState>['internalEvents']): Transition<SnakesState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function roll(s: SnakesState, seat: number, rng: { nextInt(n: number): number }) {
  const die = s.script.length ? s.script.shift()! : 1 + rng.nextInt(6);
  s.lastDie = die;
  const e = step(s, seat, die);
  log(s, e);
  if (s.pos[seat] === SIZE) { s.outcome = { reason: 'win', placements: rank(s, seat) }; return; }
  if (s.sixAgain && die === 6) { log(s, { t: 'again', seat }); return; }
  s.current = nextActive(s, seat);
}

/** Tutorial: learner on 66, opponent on 10. Learner, opponent alternately: ladder 71→91 / snake 16→6, 97 / ladder
 * 9→31, an overshoot that stays on 97 (exact finish) / ladder 36→44, snake 98→78 / snake 47→26, ladder 80→100. */
export const TUTORIAL_DICE = [5, 6, 6, 3, 5, 5, 1, 3, 2];

export const snakesModule: GameModule<SnakesState, SnakesAction, SnakesView> = {
  manifest: snakesLadders.manifest,
  actionSchema: snakesAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('snakes-ladders needs 2–6 players');
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    // Who starts: drawn by the engine (the board game rolls the die for it).
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    return {
      players: playerCount,
      pos: tutorial ? [66, 10] : Array<number>(playerCount).fill(0),
      active: Array<boolean>(playerCount).fill(true),
      current: first,
      finish: options.finish === 'bounce' ? 'bounce' : 'exact',
      sixAgain: options.sixAgain === true,
      lastDie: null,
      timeouts: Array<number>(playerCount).fill(0),
      script: tutorial ? TUTORIAL_DICE.slice() : [],
      log: [], seq: 0, outcome: null
    };
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.active[actor.seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    if (a.type === 'resign') return { ok: true };
    return actor.seat === s.current ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_TURN' };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { leave(s, seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    roll(s, seat, ctx.rng);
    return finish(s, [{ type: 'rolled', seat, die: s.lastDie }]);
  },

  project(s) {
    const { script: _script, timeouts: _t, seq: _q, ...view } = s;
    void _script; void _t; void _q;
    return structuredClone(view);
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    return [...(viewer.seat === s.current ? [{ type: 'roll' }] : []), { type: 'resign' }] as ActionHint[];
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) leave(s, seat, 'timeout');
    else roll(s, seat, ctx.rng); // the die is rolled for the absent player
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 5,
    options: { deal: 'tutorial' },
    introFa: 'شما روی خانهٔ ۶۶ هستید و حریف روی خانهٔ ۱۰. در هر نوبت فقط تاس می‌ریزید (تاس را سرور می‌ریزد) و مهره‌تان به همان تعداد خانه جلو می‌رود. اگر روی پای نردبان بایستید تا سرش بالا می‌روید و اگر روی سر مار بایستید تا دمش پایین می‌آیید. اولین کسی که به خانهٔ ۱۰۰ برسد می‌برد.',
    steps: [
      { instructionFa: 'دکمهٔ تاس را بزنید. خانهٔ ۷۱ پای یک نردبان بلند است؛ اگر ۵ بیاید رویش می‌ایستید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: '۵ آمد: روی ۷۱، پای نردبان، ایستادید و تا ۹۱ بالا رفتید. حریف با ۶ روی ۱۶ ایستاد که سر مار است و تا ۶ پایین آمد؛ مار و نردبان برای همه یکسان است. دوباره تاس بریزید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: 'با ۶ به ۹۷ رسیدید و حریف از نردبان ۹ تا ۳۱ بالا رفت. حالا دقیقاً ۳ لازم دارید تا به ۱۰۰ برسید: اگر عدد بزرگ‌تری بیاید از جایتان تکان نمی‌خورید (در تنظیمات میز می‌شود به‌جایش «برگشت از ۱۰۰» را انتخاب کرد). تاس بریزید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: '۵ آمد که از ۳ بیشتر است، پس روی ۹۷ ماندید. حریف از نردبان ۳۶ به ۴۴ رسید. مراقب باشید: خانهٔ ۹۸ سر یک مار است. تاس بریزید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: 'بدشانسی! ۱ آمد، روی ۹۸ سر مار ایستادید و تا ۷۸ پایین آمدید. حریف هم روی سر مار ۴۷ ایستاد و به ۲۶ برگشت. از ۷۸ با ۲ به خانهٔ ۸۰ می‌رسید که نردبانش مستقیم به ۱۰۰ می‌رود. تاس بریزید!', expected: { type: 'roll' }, reply: null }
    ],
    completedFa: 'بردید! ۲ آمد، روی ۸۰ ایستادید و نردبان شما را مستقیم به ۱۰۰ رساند. حریف روی ۲۶ ماند و دوم شد؛ در بازی چندنفره بقیه به ترتیب جایشان روی صفحه رتبه می‌گیرند. در بازی واقعی همه از بیرون صفحه (پیش از خانهٔ ۱) شروع می‌کنند و شروع‌کننده تصادفی است.'

  }
};
