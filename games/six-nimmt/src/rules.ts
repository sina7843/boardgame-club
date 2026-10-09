// 6 nimmt! («گاو شش»): 104 cards with bullheads (55 = 7, multiples of 11 = 5, of 10 = 3, of 5 = 2, others 1).
// 2–10 players get 10 cards; four rows start with one card each. Every turn all players choose a card at the same
// time (hidden); the cards are revealed and placed from lowest to highest: each goes after the row whose last card
// is the highest one below it. The sixth card of a row takes the five cards before it (penalty) and starts the row
// anew. A card lower than every row forces its player to take a row of their choice. After ten turns the round is
// scored; play continues until someone has 66 bullheads (option: a single round). Fewest bullheads wins.
// Hidden: hands, the cards being chosen, the undealt deck, and penalties collected during the current round.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { sixNimmt } from './definition.ts';

export const bullheads = (c: number) => (c === 55 ? 7 : c % 11 === 0 ? 5 : c % 10 === 0 ? 3 : c % 5 === 0 ? 2 : 1);
const LIMIT = 66;

export interface SixNimmtState {
  players: number;
  hands: number[][];
  rows: number[][];
  chosen: (number | null)[];
  phase: 'choose' | 'takeRow' | 'end';
  /** Cards still to place this turn (ascending); the first waits for a row choice in phase 'takeRow'. */
  queue: { seat: number; card: number }[];
  /** Penalty cards collected this round (hidden from others until the round ends). */
  taken: number[][];
  totals: number[];
  round: number;
  oneRound: boolean;
  reveal: { seat: number; card: number; took: number[] | null }[];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface SixNimmtView {
  players: number;
  hand: number[] | null;
  rows: number[][];
  /** Own chosen card; for others only whether they have chosen. */
  chosen: (number | boolean)[];
  phase: SixNimmtState['phase'];
  waitingRow: number | null;
  pendingCard: number | null;
  myRound: number | null;
  totals: number[];
  round: number;
  oneRound: boolean;
  reveal: SixNimmtState['reveal'];
  /** Revealed cards still waiting to be placed this turn (all choices are revealed at once). */
  upcoming: { seat: number; card: number }[];
  seq: number;
  outcome: Outcome | null;
}

export const sixNimmtAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: z.number().int().min(1).max(104) }),
  z.strictObject({ type: z.literal('takeRow'), row: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SixNimmtAction = z.infer<typeof sixNimmtAction>;

const sum = (cs: number[]) => cs.reduce((a, c) => a + bullheads(c), 0);
function shuffle(rng: EngineRng) {
  const a = Array.from({ length: 104 }, (_, k) => k + 1);
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
function deal(s: SixNimmtState, rng: EngineRng) {
  const d = shuffle(rng);
  s.hands = Array.from({ length: s.players }, (_, k) => d.slice(k * 10, k * 10 + 10).sort((a, b) => a - b));
  s.rows = [0, 1, 2, 3].map((k) => [d[s.players * 10 + k]!]);
  s.taken = Array.from({ length: s.players }, () => []);
  s.chosen = Array(s.players).fill(null);
  s.phase = 'choose';
}

/** Row a card goes to (highest last card below it), or null when it is lower than every row. */
export function rowFor(rows: number[][], card: number): number | null {
  let best: number | null = null;
  rows.forEach((r, k) => { const last = r.at(-1)!; if (last < card && (best === null || last > rows[best]!.at(-1)!)) best = k; });
  return best;
}

// ---------- module ----------

type Events = Transition<SixNimmtState>['internalEvents'];
const finish = (s: SixNimmtState, events: Events): Transition<SixNimmtState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function place(s: SixNimmtState, seat: number, card: number, row: number, forced: boolean) {
  const r = s.rows[row]!;
  let took: number[] | null = null;
  if (forced || r.length === 5) { took = r.slice(); s.taken[seat]!.push(...took); s.rows[row] = [card]; }
  else r.push(card);
  s.reveal.push({ seat, card, took });
}

function resolve(s: SixNimmtState, rng: EngineRng) {
  while (s.queue.length) {
    const { seat, card } = s.queue[0]!;
    const row = rowFor(s.rows, card);
    if (row === null) { s.phase = 'takeRow'; return; }
    s.queue.shift();
    place(s, seat, card, row, false);
  }
  s.chosen = Array(s.players).fill(null);
  s.phase = 'choose';
  if (s.hands[0]!.length) return;
  // Round over: score it.
  s.taken.forEach((t, k) => { s.totals[k]! += sum(t); });
  if (s.oneRound || Math.max(...s.totals) >= LIMIT) {
    s.phase = 'end';
    const ranked = s.totals.map((t, seat) => ({ seat, t })).sort((a, b) => a.t - b.t);
    const placements: Outcome['placements'] = [];
    ranked.forEach((r, i) => placements.push({ seat: r.seat, place: i > 0 && ranked[i - 1]!.t === r.t ? placements[i - 1]!.place : i + 1, score: r.t }));
    s.outcome = { placements, reason: 'score' };
    return;
  }
  s.round += 1;
  deal(s, rng);
}

function startTurnIfReady(s: SixNimmtState, rng: EngineRng) {
  if (s.chosen.some((c) => c === null)) return;
  s.seq += 1;
  s.reveal = [];
  s.queue = s.chosen.map((card, seat) => ({ seat, card: card! })).sort((a, b) => a.card - b.card);
  for (const q of s.queue) s.hands[q.seat] = s.hands[q.seat]!.filter((c) => c !== q.card);
  resolve(s, rng);
}

/** The row with the fewest bullheads (passive choice). */
const cheapestRow = (rows: number[][]) => rows.map((r, k) => ({ k, b: sum(r) })).sort((a, b) => a.b - b.b || a.k - b.k)[0]!.k;

export const sixNimmtModule: GameModule<SixNimmtState, SixNimmtAction, SixNimmtView> = {
  manifest: sixNimmt.manifest,
  actionSchema: sixNimmtAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 10) throw new Error('6 nimmt! needs 2–10 players');
    const s: SixNimmtState = {
      players: playerCount, hands: [], rows: [], chosen: [], phase: 'choose', queue: [], taken: [], totals: Array(playerCount).fill(0),
      round: 1, oneRound: options.length === 'oneRound' || options.deal === 'tutorial', reveal: [], seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    deal(s, rng);
    if (options.deal === 'tutorial') {
      // Four cards each. The 40s row is one card from full; the 20s row is one card from five.
      s.hands = [[5, 29, 50, 72], [30, 48, 55, 66]];
      s.rows = [[10], [21, 23, 26, 28], [40, 41, 44, 46, 47], [70]];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (a.type === 'play') {
      if (s.phase !== 'choose') return { ok: false, errorCode: 'WRONG_PHASE' };
      if (s.chosen[actor.seat] !== null) return { ok: false, errorCode: 'ALREADY_CHOSEN' };
      return s.hands[actor.seat]!.includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_IN_HAND' };
    }
    if (s.phase !== 'takeRow' || s.queue[0]?.seat !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      // Resigning concedes last place at once.
      const others = s.totals.map((t, k) => ({ k, t })).filter((x) => x.k !== seat).sort((x, y) => x.t - y.t);
      s.phase = 'end';
      s.outcome = { placements: [...others.map((x, i) => ({ seat: x.k, place: i + 1, score: x.t })), { seat, place: s.players, score: s.totals[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'play') { s.chosen[seat] = a.card; startTurnIfReady(s, ctx.rng); }
    else { const q = s.queue.shift()!; place(s, q.seat, q.card, a.row, true); resolve(s, ctx.rng); }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, rows: s.rows.map((r) => r.slice()),
      chosen: s.chosen.map((c, k) => (k === me ? (c ?? false) : c !== null)),
      phase: s.phase, waitingRow: s.phase === 'takeRow' ? s.queue[0]!.seat : null, pendingCard: s.phase === 'takeRow' ? s.queue[0]!.card : null,
      myRound: me >= 0 ? sum(s.taken[me]!) : null, totals: s.totals.slice(), round: s.round, oneRound: s.oneRound,
      reveal: s.reveal.slice(), upcoming: s.phase === 'takeRow' ? s.queue.map((q) => ({ ...q })) : [], seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.phase === 'choose' && s.chosen[viewer.seat] === null) for (const card of s.hands[viewer.seat]!) out.push({ type: 'play', card });
    if (s.phase === 'takeRow' && s.queue[0]?.seat === viewer.seat) for (const row of [0, 1, 2, 3]) out.push({ type: 'takeRow', row });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    // Passive play for everyone the game waits on: the lowest card; the cheapest row.
    if (s.phase === 'takeRow') {
      const q = s.queue.shift()!;
      s.timeouts[q.seat]! += 1;
      place(s, q.seat, q.card, cheapestRow(s.rows), true);
      resolve(s, ctx.rng);
    } else {
      s.chosen.forEach((c, seat) => { if (c === null) { s.timeouts[seat]! += 1; s.chosen[seat] = s.hands[seat]![0]!; } });
      startTurnIfReady(s, ctx.rng);
    }
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'takeRow' ? [s.queue[0]!.seat] : s.chosen.map((c, k) => (c === null ? k : -1)).filter((k) => k >= 0)),

  tutorial: {
    seed: 14,
    options: { deal: 'tutorial' },
    introFa: 'یک دست کوتاه با ۴ کارت در برابر یک حریف. هر کارت چند گاو (امتیاز منفی) دارد و در پایان، کمترین گاو برنده است. هر نوبت هر دو نفر مخفیانه یک کارت انتخاب می‌کنند؛ بعد کارت‌ها رو می‌شوند و از کوچک به بزرگ، هر کدام پشت ردیفی می‌نشیند که آخرین کارتش بزرگ‌ترین عددِ کوچک‌تر از آن است.',
    steps: [
      { instructionFa: '۷۲ را بازی کنید. بزرگ‌ترین آخرِ ردیفِ کوچک‌تر از ۷۲، کارت ۷۰ است؛ پس ۷۲ بی‌خطر پشت آن می‌نشیند. ردیف ۴۰ تا ۴۷ را ببینید: ۵ کارت دارد و هر کس کارت ششمش را بگذارد آن ۵ کارت را برمی‌دارد.', expected: { type: 'play', card: 72 }, reply: { type: 'play', card: 48 } },
      { instructionFa: 'حریف ۴۸ را بازی کرد و ششمین کارت ردیف شد: ۱۱ گاو برداشت (۴۴ مضرب ۱۱ است و ۵ گاو دارد، ۴۰ مضرب ۱۰ و ۳ گاو). حالا ۲۹ را بازی کنید: پنجمین کارت ردیف ۲۱ تا ۲۸ می‌شود. کارت کوچک‌تر زودتر گذاشته می‌شود، پس اگر حریف کارتی کمی بزرگ‌تر بازی کند، او ششمی می‌شود.', expected: { type: 'play', card: 29 }, reply: { type: 'play', card: 30 } },
      { instructionFa: 'همین شد: ۳۰ حریف ششمین کارت شد و ۵ گاو دیگر برداشت. حالا ۵ را بازی کنید. از آخر همهٔ ردیف‌ها کوچک‌تر است، پس جایی برایش نیست و باید یک ردیف را بردارید.', expected: { type: 'play', card: 5 }, reply: { type: 'play', card: 55 } },
      { instructionFa: 'هر ردیفی را بخواهید می‌توانید بردارید؛ کم‌گاوترینش را انتخاب کنید: ردیف ۴۸ فقط ۱ گاو دارد (ردیف‌های ۱۰ و ۳۰ هر کدام ۳ گاو و ردیف ۷۰ و ۷۲ چهار گاو). کارت ۵ شروع همان ردیف می‌شود. بعد ۵۵ حریف (۷ گاو، پرگاوترین کارت) پشت ۳۰ می‌نشیند.', expected: { type: 'takeRow', row: 2 }, reply: null },
      { instructionFa: 'آخرین کارت: ۵۰ را بازی کنید؛ پشت ۱۰ می‌نشیند. با تمام شدن کارت‌ها دست تمام می‌شود و گاوهای برداشته‌شده شمرده می‌شود.', expected: { type: 'play', card: 50 }, reply: { type: 'play', card: 66 } }
    ],
    completedFa: 'بردید! شما فقط ردیف ۴۸ را برداشتید: ۱ گاو. حریف دو بار ششمین کارت ردیف را گذاشت: ۱۱ گاو از ردیف ۴۰ تا ۴۷ و ۵ گاو از ردیف ۲۱ تا ۲۹، جمعاً ۱۶ گاو. در بازی کامل هر نفر ۱۰ کارت دارد و دست‌ها آن‌قدر ادامه پیدا می‌کند تا کسی به ۶۶ گاو برسد.'
  }
};
