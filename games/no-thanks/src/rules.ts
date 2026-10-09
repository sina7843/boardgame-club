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
      // Endgame (tutorial tables only): 21 is up with 3 chips; the learner holds 20 and 22 and 17 chips, the opponent
      // 6, 7, 15 and only 2 chips. Then 23 and 35 are left. Chips stay at 22 in total (2 × 11).
      s.current = 0; s.card = 21; s.pot = 3; s.cards = [[20, 22], [6, 7, 15]]; s.chips = [17, 2];
      s.deck = [23, 35]; s.removed = all.filter((c) => ![6, 7, 15, 20, 21, 22, 23, 35].includes(c));
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
    introFa: 'آخر بازی دونفره است و فقط سه کارت مانده. کارت‌ها امتیاز منفی‌اند و کمترین امتیاز می‌برد. در نوبتتان یا کارت وسط را با همهٔ ژتون‌های رویش برمی‌دارید، یا یک ژتون رویش می‌گذارید و می‌گویید «نه، مرسی!». از هر رشتهٔ عدد پشت سر هم فقط کوچک‌ترین کارت حساب می‌شود و هر ژتون یک امتیاز کم می‌کند. شما ۲۰ و ۲۲ و ۱۷ ژتون دارید؛ حریف ۶، ۷ و ۱۵ دارد و تعداد ژتون‌هایش مخفی است.',
    steps: [
      { instructionFa: 'کارت ۲۱ با ۳ ژتون آمده. با آن رشتهٔ ۲۰-۲۱-۲۲ ساخته می‌شود که فقط ۲۰ حساب می‌شود؛ یعنی ۲۱ برایتان هیچ امتیازی ندارد و ۳ ژتون هم می‌گیرید. «برمی‌دارم» را بزنید. کسی که کارت برمی‌دارد کارت بعدی را رو می‌کند و دوباره نوبت خودش است.', expected: { type: 'take' }, reply: null },
      { instructionFa: 'کارت بعدی ۲۳ است که رشته‌تان را ادامه می‌دهد و برای حریف بد است. می‌توانید با «نه، مرسی!» یک ژتون رویش بگذارید تا دور بزند و ژتون جمع کند. این کار ریسک دارد، چون حریف می‌تواند آن را بردارد.', expected: { type: 'pass' }, reply: { type: 'pass' } },
      { instructionFa: 'حریف هم رد کرد و حالا ۲ ژتون روی ۲۳ است. حالا آن را بردارید: رشته ۲۰ تا ۲۳ شد و هنوز فقط ۲۰ حساب می‌شود.', expected: { type: 'take' }, reply: null },
      { instructionFa: 'آخرین کارت ۳۵ است، بدترین کارت بازی. «نه، مرسی!» بزنید و یک ژتون بدهید.', expected: { type: 'pass' }, reply: { type: 'pass' } },
      { instructionFa: 'حریف هم یک ژتون داد و حالا دیگر ژتونی ندارد. دوباره «نه، مرسی!» بزنید: کسی که ژتون ندارد مجبور است کارت را بردارد و با برداشتن آخرین کارت بازی تمام می‌شود.', expected: { type: 'pass' }, reply: { type: 'take' } }
    ],
    completedFa: 'بردید! کارت‌های شما رشتهٔ ۲۰ تا ۲۳ است که فقط ۲۰ امتیاز دارد؛ ۱۹ ژتون دارید، پس امتیازتان ۲۰ منهای ۱۹ یعنی ۱ است. حریف مجبور شد ۳۵ را با ۳ ژتون بردارد: ۶ (رشتهٔ ۶-۷) به‌علاوهٔ ۱۵ و ۳۵ می‌شود ۵۶، منهای ۳ ژتون یعنی ۵۳. کمترین امتیاز برنده است.'
  }
};
