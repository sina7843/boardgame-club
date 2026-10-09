// Yahtzee («یاتزی»), 2–6 players. A turn: up to three rolls of five dice; after the first roll any dice may be kept and
// the rest rerolled. The turn ends by writing the dice into one empty box of the 13-box sheet (0 if they do not fit).
// Upper boxes 1–6 score the sum of that number; upper total ≥ 63 adds 35. Three/four of a kind: sum of all dice;
// full house 25; small straight (4 in a row) 30; large straight 40; Yahtzee 50; chance: sum. Extra Yahtzee with the
// Yahtzee box at 50 → +100 each; with the Yahtzee box filled (50 or 0) the forced joker rule applies: the matching
// upper box if empty, else any empty lower box at full value, else 0 in any empty upper box. The game ends when every
// sheet is full (13 rounds); highest total wins, equal totals share the place. Hidden: nothing but the RNG (and the
// tutorial's scripted dice).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { yahtzee } from './definition.ts';

export const CATS = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes', 'threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'yahtzee', 'chance'] as const;
export type Cat = (typeof CATS)[number];
export const UPPER = CATS.slice(0, 6) as Cat[];
export const LOWER = CATS.slice(6) as Cat[];
export const UPPER_BONUS = 35, UPPER_TARGET = 63, YAHTZEE_BONUS = 100;
export type Sheet = Partial<Record<Cat, number>>;

export interface YahtzeeState {
  players: number;
  current: number;
  dice: number[]; // 5 values 1–6, empty before the first roll of a turn
  rolls: number; // rolls made this turn (0–3)
  sheets: Sheet[];
  bonusYahtzees: number[]; // extra Yahtzees scored at +100
  last: { seat: number; cat: Cat; points: number; bonus: boolean } | null;
  seq: number;
  /** Tutorial only: the scripted die values, consumed before the RNG. Never projected. */
  script: number[];
  outcome: Outcome | null;
}
export type YahtzeeView = Omit<YahtzeeState, 'script'> & { totals: Totals[] };

export const yahtzeeAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll'), keep: z.array(z.boolean()).length(5) }),
  z.strictObject({ type: z.literal('score'), cat: z.enum(CATS) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type YahtzeeAction = z.infer<typeof yahtzeeAction>;

const counts = (d: number[]) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of d) c[v]!++; return c; };
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
export const isYahtzee = (d: number[]) => d.length === 5 && d.every((v) => v === d[0]);
const run = (d: number[], n: number) => { const has = new Set(d); for (let s = 1; s + n - 1 <= 6; s++) if (Array.from({ length: n }, (_, i) => s + i).every((v) => has.has(v))) return true; return false; };

/** Points of `dice` in `cat`; `joker` gives the lower fixed-value boxes their full value. */
export function boxScore(cat: Cat, dice: number[], joker = false): number {
  const c = counts(dice);
  const i = UPPER.indexOf(cat);
  if (i >= 0) return c[i + 1]! * (i + 1);
  const most = Math.max(...c);
  switch (cat) {
    case 'threeKind': return most >= 3 ? sum(dice) : 0;
    case 'fourKind': return most >= 4 ? sum(dice) : 0;
    case 'fullHouse': return joker || (c.includes(3) && c.includes(2)) ? 25 : 0;
    case 'smallStraight': return joker || run(dice, 4) ? 30 : 0;
    case 'largeStraight': return joker || run(dice, 5) ? 40 : 0;
    case 'yahtzee': return most === 5 ? 50 : 0;
    default: return sum(dice);
  }
}

/** Boxes the current dice may be written into, with their points (forced joker rule). */
export function scoreOptions(sheet: Sheet, dice: number[]): { cat: Cat; points: number }[] {
  const open = CATS.filter((k) => sheet[k] === undefined);
  if (!isYahtzee(dice) || sheet.yahtzee === undefined) return open.map((cat) => ({ cat, points: boxScore(cat, dice) }));
  const upper = UPPER[dice[0]! - 1]!;
  if (sheet[upper] === undefined) return [{ cat: upper, points: boxScore(upper, dice) }];
  const lower = LOWER.filter((k) => sheet[k] === undefined);
  if (lower.length) return lower.map((cat) => ({ cat, points: boxScore(cat, dice, true) }));
  return UPPER.filter((k) => sheet[k] === undefined).map((cat) => ({ cat, points: 0 }));
}

export interface Totals { upper: number; upperBonus: number; lower: number; yahtzeeBonus: number; total: number }
export function totals(sheet: Sheet, bonusYahtzees: number): Totals {
  const upper = UPPER.reduce((a, k) => a + (sheet[k] ?? 0), 0);
  const lower = LOWER.reduce((a, k) => a + (sheet[k] ?? 0), 0);
  const upperBonus = upper >= UPPER_TARGET ? UPPER_BONUS : 0;
  const yahtzeeBonus = bonusYahtzees * YAHTZEE_BONUS;
  return { upper, upperBonus, lower, yahtzeeBonus, total: upper + upperBonus + lower + yahtzeeBonus };
}
const full = (sheet: Sheet) => CATS.every((k) => sheet[k] !== undefined);
const totalOf = (s: YahtzeeState, seat: number) => totals(s.sheets[seat]!, s.bonusYahtzees[seat]!).total;

function rank(s: YahtzeeState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, sc: totalOf(s, seat) })).sort((a, b) => b.sc - a.sc);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.sc === x.sc ? out[i - 1]!.place : i + 1, score: x.sc }); });
  return out;
}

const die = (s: YahtzeeState, rng: EngineRng) => s.script.shift() ?? rng.nextInt(6) + 1;

type Events = Transition<YahtzeeState>['internalEvents'];
const step = (s: YahtzeeState, events: Events, newTurn: boolean): Transition<YahtzeeState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : newTurn ? [{ kind: 'set', deadlineKey: 'turn' }] : [] });

/** Write `cat` for the current player, then pass the turn (or finish). */
function score(s: YahtzeeState, seat: number, cat: Cat): Events {
  const sheet = s.sheets[seat]!;
  const points = scoreOptions(sheet, s.dice).find((o) => o.cat === cat)!.points;
  const bonus = isYahtzee(s.dice) && sheet.yahtzee === 50;
  if (bonus) s.bonusYahtzees[seat]! += 1;
  sheet[cat] = points;
  s.last = { seat, cat, points, bonus };
  s.seq += 1;
  s.dice = []; s.rolls = 0;
  if (s.sheets.every(full)) s.outcome = { placements: rank(s, s.sheets.map((_, k) => k)), reason: 'score' };
  else {
    // Seats with a full sheet are skipped (only possible in the tutorial's teaching position).
    let n = seat;
    do n = (n + 1) % s.players; while (full(s.sheets[n]!));
    s.current = n;
  }
  return [{ type: 'score', seat, cat, points, bonus }];
}

export const yahtzeeModule: GameModule<YahtzeeState, YahtzeeAction, YahtzeeView> = {
  manifest: yahtzee.manifest,
  actionSchema: yahtzeeAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('yahtzee needs 2–6 players');
    const s: YahtzeeState = {
      players: playerCount, current: rng.nextInt(playerCount), dice: [], rolls: 0,
      sheets: Array.from({ length: playerCount }, () => ({})), bonusYahtzees: Array(playerCount).fill(0),
      last: null, seq: 0, script: [], outcome: null
    };
    if (options.deal === 'tutorial') {
      // The learner's last two boxes: large straight and sixes. Upper so far 40 (needs 23 more for the bonus),
      // Yahtzee box already at 50; the opponent's sheet is complete at 226. Scripted dice: 5,5,2,5,3 → keep the fives →
      // 6,5 → keep → 5 (an extra Yahtzee, fives filled: joker into large straight), then 6,6,3,6,2 → keep → 6,1.
      s.current = 0;
      s.sheets[0] = { ones: 3, twos: 6, threes: 9, fours: 12, fives: 10, threeKind: 20, fourKind: 0, fullHouse: 25, smallStraight: 30, yahtzee: 50, chance: 21 };
      s.sheets[1] = { ones: 2, twos: 6, threes: 9, fours: 12, fives: 15, sixes: 18, threeKind: 24, fourKind: 22, fullHouse: 25, smallStraight: 30, largeStraight: 40, yahtzee: 0, chance: 23 };
      s.script = [5, 5, 2, 5, 3, 6, 5, 5, 6, 6, 3, 6, 2, 6, 1];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'roll') return s.rolls < 3 ? { ok: true } : { ok: false, errorCode: 'NO_ROLLS_LEFT' };
    if (!s.rolls) return { ok: false, errorCode: 'ROLL_FIRST' };
    const sheet = s.sheets[actor.seat]!;
    if (sheet[a.cat] !== undefined) return { ok: false, errorCode: 'CELL_OCCUPIED' };
    return scoreOptions(sheet, s.dice).some((o) => o.cat === a.cat) ? { ok: true } : { ok: false, errorCode: 'JOKER_RULE' };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.sheets.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: totalOf(s, seat) }], reason: 'resign' };
      return step(s, [{ type: 'resigned', seat }], true);
    }
    if (a.type === 'roll') {
      s.dice = Array.from({ length: 5 }, (_, i) => (s.rolls > 0 && a.keep[i] ? s.dice[i]! : die(s, ctx.rng)));
      s.rolls += 1;
      s.seq += 1;
      return step(s, [{ type: 'roll', seat, dice: s.dice.slice() }], false);
    }
    return step(s, score(s, seat, a.cat), true);
  },

  project(s) {
    return {
      players: s.players, current: s.current, dice: s.dice.slice(), rolls: s.rolls, sheets: s.sheets.map((x) => ({ ...x })),
      bonusYahtzees: s.bonusYahtzees.slice(), last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome,
      totals: s.sheets.map((x, k) => totals(x, s.bonusYahtzees[k]!))
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      if (s.rolls < 3) out.push({ type: 'roll' });
      if (s.rolls) for (const o of scoreOptions(s.sheets[viewer.seat]!, s.dice)) out.push({ type: 'score', cat: o.cat, points: o.points });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const rolled = s.rolls ? [] : yahtzeeModule.apply(s, { kind: 'player', seat }, { type: 'roll', keep: [false, false, false, false, false] }, ctx).internalEvents;
    // Highest-scoring allowed box; ties → first in sheet order (sort is stable).
    const best = scoreOptions(s.sheets[seat]!, s.dice).sort((x, y) => y.points - x.points)[0]!;
    return step(s, [{ type: 'timed-out', seat }, ...rolled, ...score(s, seat, best.cat)], true);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'دو نوبت آخر بازی است و حریف جدولش را با ۲۲۶ امتیاز تمام کرده. برای شما فقط دو خانه مانده: ردیف بزرگ و شش‌ها. جمع بخش بالای شما ۴۰ است، پس برای پاداش ۳۵ امتیازی هنوز ۲۳ امتیاز (چهار شش) لازم دارید. خانهٔ یاتزی‌تان را قبلاً با ۵۰ پر کرده‌اید. هر نوبت تا ۳ بار تاس می‌ریزید و بعد یک خانه را پر می‌کنید.',
    steps: [
      { instructionFa: 'نوبت شماست. «بریز» را بزنید تا هر ۵ تاس ریخته شود.', expected: { type: 'roll', keep: [false, false, false, false, false] }, reply: null },
      { instructionFa: 'سه پنج آمد. هر سه تاس ۵ را با زدن رویشان نگه دارید و دو تاس دیگر را دوباره بریزید.', expected: { type: 'roll', keep: [true, true, false, true, false] }, reply: null },
      { instructionFa: 'حالا چهار پنج دارید. هر چهار پنج را نگه دارید و آخرین ریختن نوبت را با یک تاس امتحان کنید.', expected: { type: 'roll', keep: [true, true, false, true, true] }, reply: null },
      { instructionFa: 'یاتزی! چون خانهٔ یاتزی‌تان ۵۰ دارد، ۱۰۰ امتیاز پاداش می‌گیرید. خانهٔ پنج‌ها پر است، پس قانون جوکر می‌گوید یک خانهٔ خالی بخش پایین را با امتیاز کامل پر کنید: ردیف بزرگ را انتخاب کنید و ۴۰ بگیرید.', expected: { type: 'score', cat: 'largeStraight' }, reply: null },
      { instructionFa: 'نوبت آخر: فقط شش‌ها مانده. «بریز» را بزنید.', expected: { type: 'roll', keep: [false, false, false, false, false] }, reply: null },
      { instructionFa: 'سه شش آمد. شش‌ها را نگه دارید و دو تاس دیگر را دوباره بریزید.', expected: { type: 'roll', keep: [true, true, false, true, false] }, reply: null },
      { instructionFa: 'چهار شش یعنی ۲۴ امتیاز؛ بخش بالا به ۶۴ می‌رسد که از ۶۳ بیشتر است. لازم نیست بار سوم بریزید: شش‌ها را ثبت کنید.', expected: { type: 'score', cat: 'sixes' }, reply: null }
    ],
    completedFa: 'بردید! بخش بالا ۶۴ شد و ۳۵ امتیاز پاداش گرفت (۹۹). بخش پایین با ردیف بزرگ جوکری ۴۰ به ۱۸۶ رسید و یاتزی اضافه ۱۰۰ امتیاز پاداش داد. امتیاز نهایی ۳۸۵ در برابر ۲۲۶.'
  }
};
