// No Thanks! («نه، مرسی!»): cards 3–35, nine removed unseen. Each player starts with 11 chips (6 players: 9,
// 7 players: 7; the unofficial 2-player game: 11). The card in the middle is either taken (with every chip on it) or
// refused by paying one chip onto it. Whoever takes a card turns up the next one and decides again. When the deck is
// empty, a score is the sum of the lowest card of every run of consecutive numbers, minus chips; the lowest wins.
// Hidden: the deck, the removed cards, and other players' chip counts (chips are kept secret in the rules).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { noThanks } from './definition.ts';

export interface NoThanksState {
  players: number;
  deck: number[];
  removed: number[];
  card: number | null;
  pot: number;
  chips: number[];
  cards: number[][];
  current: number;
  active: boolean[];
  log: { seq: number; seat: number; t: 'take' | 'pass' | 'resign' | 'timeout'; card: number | null; pot: number }[];
  seq: number;
  timeouts: number[];
  scores: number[] | null;
  outcome: Outcome | null;
}
export interface NoThanksView {
  players: number;
  card: number | null;
  pot: number;
  deckCount: number;
  /** Own chips only; others are secret (null). At the end everyone's chips are shown. */
  chips: (number | null)[];
  cards: number[][];
  current: number | null;
  active: boolean[];
  log: NoThanksState['log'];
  scores: number[] | null;
  outcome: Outcome | null;
}

export const noThanksAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('take') }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type NoThanksAction = z.infer<typeof noThanksAction>;

/** Sum of the lowest card of each run of consecutive cards. */
export function cardPoints(cards: number[]): number {
  const s = [...cards].sort((a, b) => a - b);
  return s.reduce((sum, c, i) => (i > 0 && s[i - 1] === c - 1 ? sum : sum + c), 0);
}
/** Group sorted cards into runs (for display). */
export function runs(cards: number[]): number[][] {
  const s = [...cards].sort((a, b) => a - b);
  const out: number[][] = [];
  for (const c of s) { const last = out.at(-1); if (last && last.at(-1) === c - 1) last.push(c); else out.push([c]); }
  return out;
}
const startChips = (n: number) => (n === 6 ? 9 : n === 7 ? 7 : 11);

function shuffle(rng: EngineRng, xs: number[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// ---------- module ----------

type Events = Transition<NoThanksState>['internalEvents'];
const finish = (s: NoThanksState, events: Events): Transition<NoThanksState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const log = (s: NoThanksState, e: Omit<NoThanksState['log'][number], 'seq'>) => { s.log.push({ ...e, seq: ++s.seq }); if (s.log.length > 30) s.log.shift(); };

function nextSeat(s: NoThanksState) {
  for (let k = 1; k <= s.players; k++) { const n = (s.current + k) % s.players; if (s.active[n]) { s.current = n; return; } }
}

function end(s: NoThanksState, reason: Outcome['reason']) {
  s.card = null;
  s.scores = s.cards.map((cs, k) => cardPoints(cs) - s.chips[k]!);
  const ranked = s.scores.map((sc, seat) => ({ seat, sc, out: !s.active[seat] })).sort((a, b) => Number(a.out) - Number(b.out) || a.sc - b.sc);
  const placements: Outcome['placements'] = [];
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    const place = prev && prev.sc === r.sc && prev.out === r.out ? placements[i - 1]!.place : i + 1;
    placements.push({ seat: r.seat, place, score: r.sc });
  });
  s.outcome = { placements, reason };
}

function take(s: NoThanksState, seat: number) {
  s.cards[seat]!.push(s.card!);
  s.chips[seat]! += s.pot;
  log(s, { seat, t: 'take', card: s.card, pot: s.pot });
  s.pot = 0;
  s.card = s.deck.shift() ?? null;
  if (s.card === null) end(s, 'score');
}

function pass(s: NoThanksState, seat: number) {
  s.chips[seat]! -= 1;
  s.pot += 1;
  log(s, { seat, t: 'pass', card: s.card, pot: s.pot });
  nextSeat(s);
}

export const noThanksModule: GameModule<NoThanksState, NoThanksAction, NoThanksView> = {
  manifest: noThanks.manifest,
  actionSchema: noThanksAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 7) throw new Error('no-thanks needs 2–7 players');
    const all = shuffle(rng, Array.from({ length: 33 }, (_, k) => k + 3));
    const s: NoThanksState = {
      players: playerCount, removed: all.slice(0, 9), deck: all.slice(10), card: all[9]!, pot: 0,
      chips: Array(playerCount).fill(startChips(playerCount)), cards: Array.from({ length: playerCount }, () => []),
      current: rng.nextInt(playerCount), active: Array(playerCount).fill(true), log: [], seq: 0,
      timeouts: Array(playerCount).fill(0), scores: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // Endgame: the learner holds 24 and 26, 25 is up with 4 chips on it; only the 3 is left after it.
      s.current = 0; s.card = 25; s.pot = 4; s.cards = [[24, 26], [30, 33]]; s.chips = [8, 2];
      s.deck = [3]; s.removed = all.filter((c) => ![24, 25, 26, 30, 33, 3].includes(c));
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || !s.active[actor.seat]) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'pass' && s.chips[actor.seat]! <= 0) return { ok: false, errorCode: 'NO_CHIPS' };
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.active[seat] = false;
      log(s, { seat, t: 'resign', card: s.card, pot: s.pot });
      const left = s.active.filter(Boolean).length;
      if (left <= 1) end(s, 'resign'); else if (s.current === seat) nextSeat(s);
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'take') take(s, seat); else pass(s, seat);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, card: s.card, pot: s.pot, deckCount: s.deck.length,
      chips: s.chips.map((c, k) => (k === me || s.outcome ? c : null)),
      cards: s.cards.map((cs) => [...cs].sort((a, b) => a - b)),
      current: s.outcome ? null : s.current, active: s.active.slice(), log: s.log.slice(), scores: s.scores, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) { out.push({ type: 'take' }); if (s.chips[viewer.seat]! > 0) out.push({ type: 'pass' }); }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.timeouts[seat]! += 1;
    log(s, { seat, t: 'timeout', card: s.card, pot: s.pot });
    // Passive play: refuse while chips last, otherwise take.
    if (s.chips[seat]! > 0) pass(s, seat); else take(s, seat);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 13,
    options: { deal: 'tutorial' },
    introFa: 'کارت وسط را یا بردارید (با همه ژتون‌های رویش) یا با گذاشتن یک ژتون رد کنید. کارت‌ها امتیاز منفی‌اند؛ ولی از هر رشته عدد پشت سر هم فقط کوچک‌ترینش حساب می‌شود.',
    steps: [
      { instructionFa: '۲۵ آمده و شما ۲۴ و ۲۶ دارید: با ۲۵ رشته ۲۴-۲۵-۲۶ کامل می‌شود و فقط ۲۴ حساب می‌شود؛ ۴ ژتون هم رویش است. «برمی‌دارم» را بزنید.', expected: { type: 'take' }, reply: null },
      { instructionFa: 'آخرین کارت ۳ است و حریف فقط ۲ ژتون دارد. یک بار «نه، مرسی!» بزنید؛ حریف هم باید ژتون بدهد یا آن را بردارد.', expected: { type: 'pass' }, reply: { type: 'pass' } },
      { instructionFa: 'حریف هم رد کرد و حالا ۲ ژتون روی ۳ است. برش دارید تا بازی تمام شود.', expected: { type: 'take' }, reply: null }
    ],
    completedFa: 'بردید! امتیاز = جمع کوچک‌ترین کارت هر رشته منهای ژتون‌ها؛ کمترین امتیاز برنده است.'
  }
};
