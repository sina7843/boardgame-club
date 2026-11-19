// Ludo / منچ (Mensch ärgere Dich nicht rules): 2–4 players, 4 pieces each, a 52-square track, a 5-square goal column and a centre
// column per colour. Roll a 6 to enter; a 6 rolls again; landing on an opponent sends it home; no landing on (or
// jumping over, inside the goal) your own pieces; exact count into the goal. With no piece able to move without a 6,
// you get three tries. Pieces: progress -1 = yard, 0..51 = steps from own start, 52..56 = goal column, 57 = centre.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { ludo } from './definition.ts';

// BGA board (owner decision 2026-11-08): 52-square loop, 5-square goal column, then the centre square (progress 57).
export const TRACK = 52;
export const GOAL = 5;
export const FINAL = TRACK + GOAL; // 57: the centre; any number of own pieces may stand there
const LAST = FINAL;
const SLOT_STEP = 13;
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 30;

/** Colour slot per seat: 2 players sit opposite (slots 0 and 2). Slot s starts on track square 13·s. */
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
  /** pieces[seat][i] = progress (-1 yard, 0..51 track, 52..56 goal column, 57 centre). */
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
export const trackSquare = (slot: number, progress: number) => (slot * SLOT_STEP + progress) % TRACK;

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
    for (let g = Math.max(from + 1, TRACK); g <= Math.min(to, FINAL - 1); g++) if (own.includes(g)) return null;
    return to;
  }
  const o = occupantAt(s, trackSquare(s.slots[seat]!, to));
  return o?.seat === seat ? null : to;
}

export const movablePieces = (s: LudoState, seat: number, die: number) => [0, 1, 2, 3].filter((i) => target(s, seat, i, die) !== null);

/** A piece that can never move again: at the centre, or in the goal column with no die value leading anywhere. */
function settled(own: number[], p: number) {
  if (p === FINAL) return true;
  if (p < TRACK) return false;
  for (let d = 1; d <= 6; d++) {
    const to = p + d;
    if (to > LAST) break;
    let free = true;
    for (let g = p + 1; g <= Math.min(to, FINAL - 1); g++) if (own.includes(g)) free = false;
    if (free) return false;
  }
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
  if (s.pieces[seat]!.every((p) => p === FINAL)) {
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
      // Learner (slot 0): two pieces at the centre (57), one on progress 40 (square 40), one in the goal column (53).
      // Opponent (slot 2): a piece on square 46 (progress 20) six ahead of the learner's piece 3, one on progress 5.
      // Dice: 6 (forced capture + extra roll), 4 (choice: centre), opponent 2, 6 (forced into the column + extra roll),
      // 5 (exact count into the centre, wins).
      s.pieces = [[57, 57, 40, 53], [20, 5, -1, -1]];
      s.script = [6, 4, 2, 6, 5];
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

  publicSummary: (s) => ({
    moves: s.log.flatMap((e): { seat: number; text: string }[] => {
      const fa = (n: number) => n.toLocaleString('fa-IR');
      switch (e.t) {
        case 'roll': return [{ seat: e.seat, text: `تاس ${fa(e.die)}` }];
        case 'move': return [{ seat: e.seat, text: `مهره ${fa(e.piece + 1)} ${e.from < 0 ? 'از لانه' : e.to >= FINAL ? 'به خانه' : e.to >= TRACK ? 'ستون خانه' : 'جلو'}${e.captured ? '، زد' : ''}` }];
        case 'noMove': return [{ seat: e.seat, text: 'حرکتی نداشت' }];
        case 'finished': return [{ seat: e.seat, text: 'همه به خانه رسیدند' }];
        case 'left': return [{ seat: e.seat, text: 'کنار رفت' }];
        case 'timeout': return [{ seat: e.seat, text: 'زمانش تمام شد' }];
        default: return [];
      }
    }).slice(-40),
    seats: s.pieces.map((ps, seat) => ({
      seat,
      primary: { label: 'در مقصد', value: ps.filter((p) => p === FINAL).length, target: 4 },
      stats: [{ key: 'yard', label: 'در خانه', value: ps.filter((p) => p < 0).length, icon: 'shield' }],
      ...(s.outcome ? (s.outcome.placements.some((p) => p.seat === seat && p.place === 1) ? { status: 'winner' as const } : {}) : !s.active[seat] ? { status: 'out' as const } : {}),
      strikes: s.timeouts[seat]!
    })),
    strikesMax: MAX_TIMEOUTS
  }),

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 9,
    options: { deal: 'tutorial' },
    introFa: 'آخر بازی است و شما مهره‌های قرمز هستید. دو مهره‌تان به خانهٔ مرکزی رسیده‌اند، یک مهره در ستون خانه است و مهرهٔ ۳ در مسیر است. دقیقاً ۶ خانه جلوی مهرهٔ ۳ یک مهرهٔ زرد حریف ایستاده است. هر کس اول هر ۴ مهره‌اش را به خانهٔ مرکزی برساند برنده است.',
    steps: [
      { instructionFa: 'تاس بریزید. مهره به تعداد عدد تاس جلو می‌رود؛ اگر فقط یک حرکت ممکن باشد، خودکار انجام می‌شود و اگر روی مهرهٔ حریف بایستید آن را به لانه‌اش برمی‌گردانید.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۶ آمد: مهرهٔ ۴ در ستون خانه است و ۶ خانه جا ندارد؛ پس مهرهٔ ۳ خودکار رفت و مهرهٔ زرد را زد و به لانه فرستاد. ۶ یک تاس جایزه هم دارد: دوباره تاس بریزید.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۴ آمد و دو مهره می‌توانند حرکت کنند، پس خودتان انتخاب می‌کنید. مهرهٔ ۴ را حرکت دهید تا دقیقاً به خانهٔ مرکزی برسد؛ برای رسیدن به مرکز تعداد تاس باید دقیق باشد.', expected: { type: 'move', piece: 3 }, reply: { type: 'roll' } },
      { instructionFa: 'حریف ۲ آورد و تنها مهرهٔ روی مسیرش را جلو برد؛ مهرهٔ لانه فقط با ۶ بیرون می‌آید. فقط مهرهٔ ۳ مانده است. تاس بریزید.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۶ آمد و مهرهٔ ۳ خودکار وارد ستون خانه شد؛ دوباره تاس بریزید. تا خانهٔ مرکزی دقیقاً ۵ خانه مانده است.', expected: { type: 'roll' }, reply: null }
    ],
    completedFa: 'بردید! با ۵ مهرهٔ آخر دقیقاً به خانهٔ مرکزی رسید و هر ۴ مهرهٔ شما به مرکز رسیدند و حریف دوم شد. در شروع بازی همهٔ مهره‌ها در لانه‌اند و برای بیرون آوردن هر مهره ۶ لازم است؛ تا وقتی هیچ مهره‌ای روی مسیر ندارید، هر نوبت سه بار فرصت دارید ۶ بیاورید.'
  }
};
