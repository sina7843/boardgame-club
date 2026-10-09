// Ludo / منچ (Mensch ärgere Dich nicht rules): 2–4 players, 4 pieces each, a 40-square track and a 4-square goal
// column per colour. Roll a 6 to enter; a 6 rolls again; landing on an opponent sends it home; no landing on (or
// jumping over, inside the goal) your own pieces; exact count into the goal. With no piece able to move without a 6,
// you get three tries. Pieces: progress -1 = yard, 0..39 = steps from own start, 40..43 = goal squares.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { ludo } from './definition.ts';

export const TRACK = 40;
export const GOAL = 4;
const LAST = TRACK + GOAL - 1; // 43
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 30;

/** Colour slot per seat: 2 players sit opposite (slots 0 and 2). Slot s starts on track square 10·s. */
export const slotsFor = (players: number) => (players === 2 ? [0, 2] : players === 3 ? [0, 1, 2] : [0, 1, 2, 3]);

export type LogEntry =
  | { t: 'roll'; seat: number; die: number }
  | { t: 'move'; seat: number; piece: number; from: number; to: number; captured: { seat: number; piece: number } | null }
  | { t: 'noMove'; seat: number }
  | { t: 'again'; seat: number }
  | { t: 'finished'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'timeout'; seat: number };

export interface LudoState {
  players: number;
  slots: number[];
  /** pieces[seat][i] = progress (-1 yard, 0..39 track, 40..43 goal). */
  pieces: number[][];
  active: boolean[];
  current: number;
  phase: 'roll' | 'move';
  die: number | null;
  /** Rolls left this turn when no piece can move without a 6 (three tries). */
  tries: number;
  timeouts: number[];
  /** Tutorial only: predetermined dice. */
  script: number[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

export const ludoAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('move'), piece: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type LudoAction = z.infer<typeof ludoAction>;
export type LudoView = Omit<LudoState, 'script' | 'timeouts' | 'seq'>;

/** Absolute track square of a progress value for a colour slot. */
export const trackSquare = (slot: number, progress: number) => (slot * 10 + progress) % TRACK;

function log(s: LudoState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

/** Who stands on absolute track square `sq` (pieces in yard/goal are never on the track). */
function occupantAt(s: LudoState, sq: number): { seat: number; piece: number } | null {
  for (let seat = 0; seat < s.players; seat++) {
    if (!s.active[seat]) continue;
    const i = s.pieces[seat]!.findIndex((p) => p >= 0 && p < TRACK && trackSquare(s.slots[seat]!, p) === sq);
    if (i >= 0) return { seat, piece: i };
  }
  return null;
}

/** Target progress for moving `piece` by `die`, or null if illegal. */
export function target(s: LudoState, seat: number, piece: number, die: number): number | null {
  const own = s.pieces[seat]!;
  const from = own[piece]!;
  if (from === -1) {
    if (die !== 6) return null;
    const o = occupantAt(s, trackSquare(s.slots[seat]!, 0));
    return o?.seat === seat ? null : 0;
  }
  const to = from + die;
  if (to > LAST) return null;
  if (to >= TRACK) {
    // No jumping over (or landing on) own pieces inside the goal.
    for (let g = Math.max(from + 1, TRACK); g <= to; g++) if (own.includes(g)) return null;
    return to;
  }
  const o = occupantAt(s, trackSquare(s.slots[seat]!, to));
  return o?.seat === seat ? null : to;
}

export const movablePieces = (s: LudoState, seat: number, die: number) => [0, 1, 2, 3].filter((i) => target(s, seat, i, die) !== null);

/** A goal piece that can never move again: every goal square beyond it is taken by own pieces (or it is at the end). */
function settled(own: number[], p: number) {
  if (p < TRACK) return false;
  for (let g = p + 1; g <= LAST; g++) if (!own.includes(g)) return false;
  return true;
}
/** Three tries apply when nothing can move except by entering with a 6. */
const needsSix = (own: number[]) => own.every((p) => p === -1 || settled(own, p));

const nextActive = (s: LudoState, from: number) => {
  for (let k = 1; k <= s.players; k++) { const seat = (from + k) % s.players; if (s.active[seat]) return seat; }
  return from;
};

function beginTurn(s: LudoState, seat: number) {
  s.current = seat;
  s.phase = 'roll';
  s.die = null;
  s.tries = needsSix(s.pieces[seat]!) ? 3 : 1;
}

/** Ranking: finishers first; then by total progress (pieces in yard count 0); players who left last. */
function rank(s: LudoState, winner: number): Outcome['placements'] {
  const score = (seat: number) => s.pieces[seat]!.reduce((a, p) => a + p + 1, 0);
  const live = s.active.map((a, seat) => ({ a, seat })).filter((x) => x.a && x.seat !== winner);
  const out: Outcome['placements'] = [{ seat: winner, place: 1 }];
  for (const x of live) out.push({ seat: x.seat, place: 2 + live.filter((o) => score(o.seat) > score(x.seat)).length });
  for (let seat = 0; seat < s.players; seat++) if (!s.active[seat] && seat !== winner) out.push({ seat, place: live.length + 2 });
  return out;
}

function doMove(s: LudoState, seat: number, piece: number) {
  const die = s.die!;
  const from = s.pieces[seat]![piece]!;
  const to = target(s, seat, piece, die)!;
  let captured: { seat: number; piece: number } | null = null;
  if (to < TRACK) {
    const o = occupantAt(s, trackSquare(s.slots[seat]!, to));
    if (o && o.seat !== seat) { s.pieces[o.seat]![o.piece] = -1; captured = o; }
  }
  s.pieces[seat]![piece] = to;
  log(s, { t: 'move', seat, piece, from, to, captured });
  if (s.pieces[seat]!.every((p) => p >= TRACK)) {
    log(s, { t: 'finished', seat });
    s.outcome = { reason: 'win', placements: rank(s, seat) };
    return;
  }
  if (die === 6) { log(s, { t: 'again', seat }); s.phase = 'roll'; s.die = null; s.tries = needsSix(s.pieces[seat]!) ? 3 : 1; return; }
  beginTurn(s, nextActive(s, seat));
}

function roll(s: LudoState, seat: number, rng: EngineRng) {
  const die = s.script.length ? s.script.shift()! : 1 + rng.nextInt(6);
  s.die = die;
  log(s, { t: 'roll', seat, die });
  const movable = movablePieces(s, seat, die);
  if (movable.length === 0) {
    log(s, { t: 'noMove', seat });
    s.tries -= 1;
    // A blocked 6 still earns the extra roll; otherwise roll again only while tries remain.
    if (die === 6 || s.tries > 0) { s.phase = 'roll'; if (die === 6) s.tries = Math.max(s.tries, 1); return; }
    beginTurn(s, nextActive(s, seat));
    return;
  }
  s.phase = 'move';
  // Only one possible move: it is played for you.
  if (movable.length === 1) doMove(s, seat, movable[0]!);
}

function leave(s: LudoState, seat: number, reason: 'resign' | 'timeout') {
  s.active[seat] = false;
  log(s, { t: 'left', seat, reason });
  const left = s.active.filter(Boolean).length;
  if (left === 1) { s.outcome = { reason: 'resign', placements: rank(s, s.active.indexOf(true)) }; return; }
  if (s.current === seat) beginTurn(s, nextActive(s, seat));
}

const finish = (s: LudoState, events: Transition<LudoState>['internalEvents']): Transition<LudoState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

export const ludoModule: GameModule<LudoState, LudoAction, LudoView> = {
  manifest: ludo.manifest,
  actionSchema: ludoAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('ludo needs 2–4 players');
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    const s: LudoState = {
      players: playerCount,
      slots: slotsFor(playerCount),
      pieces: Array.from({ length: playerCount }, () => [-1, -1, -1, -1]),
      active: Array<boolean>(playerCount).fill(true),
      current: 0, phase: 'roll', die: null, tries: 3,
      timeouts: Array<number>(playerCount).fill(0),
      script: [], log: [], seq: 0, outcome: null
    };
    if (tutorial) {
      // Learner (slot 0): two pieces in the goal (42, 43), one on 28, one on 36. Opponent (slot 2): a piece on square 34
      // (progress 14) six ahead of the learner, one on square 5. Dice: 6 (forced capture + extra roll), 5 (choice: goal),
      // opponent 2, 5 (forced), opponent 3, 4 (blocked inside the goal, no move), opponent 1, 1 (exact, wins).
      s.pieces = [[43, 42, 28, 36], [14, 25, -1, -1]];
      s.script = [6, 5, 2, 5, 3, 4, 1, 1];
      beginTurn(s, 0);
    } else beginTurn(s, rng.nextInt(playerCount));
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.active[actor.seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'roll') return s.phase === 'roll' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
    if (s.phase !== 'move') return { ok: false, errorCode: 'WRONG_PHASE' };
    return target(s, actor.seat, a.piece, s.die!) !== null ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { leave(s, seat, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'roll') roll(s, seat, ctx.rng);
    else doMove(s, seat, a.piece);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { script: _s, timeouts: _t, seq: _q, ...view } = s;
    void _s; void _t; void _q;
    return structuredClone(view);
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) {
      if (s.phase === 'roll') out.push({ type: 'roll' });
      else for (const piece of movablePieces(s, viewer.seat, s.die!)) out.push({ type: 'move', piece, to: target(s, viewer.seat, piece, s.die!) });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { leave(s, seat, 'timeout'); return finish(s, [{ type: 'timed-out', seat }]); }
    // Play the turn for the absent player: roll; move the most advanced movable piece; until the turn passes.
    for (let guard = 0; guard < 20 && !s.outcome && s.current === seat; guard++) {
      if (s.phase === 'roll') roll(s, seat, ctx.rng);
      else {
        const movable = movablePieces(s, seat, s.die!);
        doMove(s, seat, movable.sort((x, y) => s.pieces[seat]![y]! - s.pieces[seat]![x]!)[0]!);
      }
    }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 9,
    options: { deal: 'tutorial' },
    introFa: 'آخر بازی است و شما مهره‌های قرمز هستید. دو مهره‌تان در دو خانهٔ ته ستون خانه نشسته‌اند و دو مهرهٔ دیگر روی مسیرند: مهرهٔ ۳ دوازده خانه و مهرهٔ ۴ چهار خانه مانده به ستون خانه. دقیقاً ۶ خانه جلوی مهرهٔ ۳ یک مهرهٔ سبز حریف ایستاده است. هر کس اول هر ۴ مهره‌اش را به ستون خانه برساند برنده است.',
    steps: [
      { instructionFa: 'تاس بریزید. مهره به تعداد عدد تاس جلو می‌رود؛ اگر فقط یک حرکت ممکن باشد، خودکار انجام می‌شود و اگر روی مهرهٔ حریف بایستید آن را به لانه‌اش برمی‌گردانید.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۶ آمد: مهرهٔ ۴ نمی‌توانست برود، چون در ستون خانه نمی‌شود از روی مهرهٔ خودی پرید؛ پس مهرهٔ ۳ خودکار رفت و مهرهٔ سبز را زد و به لانه فرستاد. ۶ یک تاس جایزه هم دارد: دوباره تاس بریزید.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۵ آمد و دو مهره می‌توانند حرکت کنند، پس خودتان انتخاب می‌کنید. مهرهٔ ۴ را حرکت دهید تا وارد ستون خانه شود و در دومین خانهٔ آن بنشیند؛ مهره در ستون خانه دیگر زده نمی‌شود.', expected: { type: 'move', piece: 3 }, reply: { type: 'roll' } },
      { instructionFa: 'حریف ۲ آورد و تنها مهرهٔ روی مسیرش را جلو برد؛ مهرهٔ لانه فقط با ۶ بیرون می‌آید. تاس بریزید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: '۵ آمد و مهرهٔ ۳ خودکار تا یک خانه مانده به ستون خانه رفت؛ حریف هم ۳ آورد. حالا فقط اولین خانهٔ ستون خانه خالی است و مهرهٔ ۳ دقیقاً ۱ لازم دارد. تاس بریزید.', expected: { type: 'roll' }, reply: { type: 'roll' } },
      { instructionFa: '۴ آمد و هیچ حرکتی ممکن نبود: مهرهٔ ۳ باید به آخرین خانهٔ ستون می‌رفت که پر است و در ستون خانه نمی‌شود روی مهرهٔ خودی نشست یا از رویش پرید؛ مهره‌های داخل ستون هم جای خالی جلوتر ندارند. پس نوبت به حریف رسید و او ۱ آورد. دوباره تاس بریزید.', expected: { type: 'roll' }, reply: null }
    ],
    completedFa: 'بردید! با ۱ مهرهٔ آخر دقیقاً به اولین خانهٔ ستون خانه رسید و هر ۴ مهرهٔ شما در خانه نشستند و حریف دوم شد. در شروع بازی همهٔ مهره‌ها در لانه‌اند و برای بیرون آوردن هر مهره ۶ لازم است؛ تا وقتی هیچ مهره‌ای روی مسیر ندارید، هر نوبت سه بار فرصت دارید ۶ بیاورید.'
  }
};
