// Lost Cities («کاوشگران»), two players. 60 cards: five colours × (2–10 and three wagers, value 0). Hands of 8.
// A turn is: play a card to your expedition of its colour (strictly ascending; wagers only before any number) or
// discard it on that colour's pile, then draw from the deck or the top of a discard pile — not the card just
// discarded. The round ends when the last deck card is drawn. Expedition score: (sum − 20) × (1 + wagers), +20 for
// eight or more cards; unstarted expeditions score 0. Three rounds (option: one); the loser of a round starts the
// next one (a tied round alternates the starter).
// Hidden: hands and the deck. Expeditions and discard piles are public.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { lostCities } from './definition.ts';

export const COLORS = ['y', 'b', 'w', 'g', 'r'] as const;
export type Color = (typeof COLORS)[number];
/** Card id: colour letter + value (0 = wager), e.g. "r7", "b0". */
export type CardId = string;
export const color = (c: CardId) => c[0] as Color;
export const value = (c: CardId) => Number(c.slice(1));

export interface LostCitiesState {
  deck: CardId[];
  hands: CardId[][];
  exp: Record<Color, CardId[]>[];
  discard: Record<Color, CardId[]>;
  current: number;
  phase: 'place' | 'draw' | 'end';
  /** Colour discarded this turn (cannot be drawn back). */
  justDiscarded: Color | null;
  round: number;
  rounds: number;
  starter: number;
  scores: number[];
  roundScores: number[][];
  last: { seat: number; kind: 'play' | 'discard' | 'draw'; card: CardId | null; from?: Color | 'deck' } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface LostCitiesView {
  hand: CardId[] | null;
  handCount: number[];
  exp: Record<Color, CardId[]>[];
  discard: Record<Color, CardId[]>;
  deckCount: number;
  current: number | null;
  phase: LostCitiesState['phase'];
  justDiscarded: Color | null;
  round: number;
  rounds: number;
  scores: number[];
  roundScores: number[][];
  last: LostCitiesState['last'];
  seq: number;
  outcome: Outcome | null;
}

const cardId = z.string().regex(/^[ybwgr](0|[2-9]|10)$/);
export const lostCitiesAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: cardId }),
  z.strictObject({ type: z.literal('discard'), card: cardId }),
  z.strictObject({ type: z.literal('draw'), from: z.enum(['deck', ...COLORS]) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type LostCitiesAction = z.infer<typeof lostCitiesAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const empty = () => Object.fromEntries(COLORS.map((c) => [c, [] as CardId[]])) as Record<Color, CardId[]>;
const fullDeck = () => COLORS.flatMap((c) => [`${c}0`, `${c}0`, `${c}0`, ...Array.from({ length: 9 }, (_, k) => `${c}${k + 2}`)]);
export const sortHand = (h: CardId[]) => h.sort((a, b) => COLORS.indexOf(color(a)) - COLORS.indexOf(color(b)) || value(a) - value(b));

export function expScore(cards: CardId[]) {
  if (!cards.length) return 0;
  const sum = cards.reduce((a, c) => a + value(c), 0);
  const wagers = cards.filter((c) => value(c) === 0).length;
  return (sum - 20) * (1 + wagers) + (cards.length >= 8 ? 20 : 0);
}
export const tableScore = (e: Record<Color, CardId[]>) => COLORS.reduce((a, c) => a + expScore(e[c]), 0);
export function canPlay(e: Record<Color, CardId[]>, card: CardId) {
  const top = e[color(card)].at(-1);
  return top === undefined || (value(card) === 0 ? value(top) === 0 : value(card) > value(top));
}

// ---------- module ----------

type Events = Transition<LostCitiesState>['internalEvents'];
const finish = (s: LostCitiesState, events: Events): Transition<LostCitiesState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function deal(s: LostCitiesState, rng: EngineRng) {
  s.deck = shuffle(rng, fullDeck());
  s.hands = [sortHand(s.deck.splice(0, 8)), sortHand(s.deck.splice(0, 8))];
  s.exp = [empty(), empty()];
  s.discard = empty();
  s.phase = 'place';
  s.justDiscarded = null;
  s.current = s.starter;
}

function endRound(s: LostCitiesState, rng: EngineRng) {
  const r = s.exp.map(tableScore);
  s.roundScores.push(r);
  r.forEach((v, k) => { s.scores[k]! += v; });
  if (s.round >= s.rounds) {
    s.phase = 'end';
    const [a, b] = s.scores as [number, number];
    s.outcome = { placements: [{ seat: 0, place: a >= b ? 1 : 2, score: a }, { seat: 1, place: b >= a ? 1 : 2, score: b }], reason: a === b ? 'draw' : 'score' };
    return;
  }
  s.round += 1;
  s.starter = r[0]! === r[1]! ? 1 - s.starter : r[0]! < r[1]! ? 0 : 1;
  deal(s, rng);
}

export const lostCitiesModule: GameModule<LostCitiesState, LostCitiesAction, LostCitiesView> = {
  manifest: lostCities.manifest,
  actionSchema: lostCitiesAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('lost cities is a two-player game');
    const s: LostCitiesState = {
      deck: [], hands: [], exp: [], discard: empty(), current: 0, phase: 'place', justDiscarded: null, round: 1,
      rounds: options.length === 'one' || options.deal === 'tutorial' ? 1 : 3, starter: rng.nextInt(2), scores: [0, 0], roundScores: [],
      last: null, seq: 0, timeouts: [0, 0], outcome: null
    };
    deal(s, rng);
    if (options.deal === 'tutorial') {
      // The last turn of a round (a turn is two actions and the script answers once per step, so the opponent cannot
      // take a full turn here). The learner's desert run 2–8 takes the 9 as its eighth card (+20); one deck card is
      // left, so drawing it ends the round. Every card is placed at most once, as in the real deck.
      s.current = 0;
      s.exp = [{ ...empty(), y: ['y2', 'y3', 'y4', 'y5', 'y6', 'y7', 'y8'], r: ['r0', 'r7', 'r8', 'r10'] }, { ...empty(), b: ['b0', 'b0', 'b4', 'b5', 'b6'], g: ['g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'], w: ['w10'] }];
      s.hands = [['y9', 'b2', 'b3', 'w2', 'w3', 'r2', 'r3', 'r4'], ['y10', 'b7', 'b8', 'w5', 'w6', 'g10', 'r5', 'r6']];
      s.discard = { ...empty(), w: ['w7'], g: ['g2'] };
      s.deck = ['b9'];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'draw') {
      if (s.phase !== 'draw') return { ok: false, errorCode: 'PLACE_FIRST' };
      if (a.from === 'deck') return { ok: true };
      if (a.from === s.justDiscarded) return { ok: false, errorCode: 'JUST_DISCARDED' };
      return s.discard[a.from].length ? { ok: true } : { ok: false, errorCode: 'EMPTY_PILE' };
    }
    if (s.phase !== 'place') return { ok: false, errorCode: 'DRAW_NOW' };
    if (!s.hands[actor.seat]!.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
    if (a.type === 'play' && !canPlay(s.exp[actor.seat]!, a.card)) return { ok: false, errorCode: 'NOT_ASCENDING' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.phase = 'end';
      s.outcome = { placements: [{ seat: 1 - seat, place: 1, score: s.scores[1 - seat]! }, { seat, place: 2, score: s.scores[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'draw') {
      const card = a.from === 'deck' ? s.deck.shift()! : s.discard[a.from].pop()!;
      s.hands[seat]!.push(card);
      sortHand(s.hands[seat]!);
      s.last = { seat, kind: 'draw', card: a.from === 'deck' ? null : card, from: a.from };
      if (!s.deck.length) endRound(s, ctx.rng);
      else { s.phase = 'place'; s.justDiscarded = null; s.current = 1 - seat; }
    } else {
      const h = s.hands[seat]!;
      h.splice(h.indexOf(a.card), 1);
      if (a.type === 'play') s.exp[seat]![color(a.card)].push(a.card);
      else { s.discard[color(a.card)].push(a.card); s.justDiscarded = color(a.card); }
      s.last = { seat, kind: a.type, card: a.card };
      s.phase = 'draw';
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      hand: me >= 0 ? s.hands[me]!.slice() : null, handCount: s.hands.map((h) => h.length),
      exp: s.exp.map((e) => structuredClone(e)), discard: structuredClone(s.discard), deckCount: s.deck.length,
      current: s.outcome ? null : s.current, phase: s.phase, justDiscarded: s.justDiscarded, round: s.round, rounds: s.rounds,
      scores: s.scores.slice(), roundScores: s.roundScores.map((r) => r.slice()), last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat && s.phase === 'place') {
      for (const card of new Set(s.hands[seat]!)) {
        if (canPlay(s.exp[seat]!, card)) out.push({ type: 'play', card });
        out.push({ type: 'discard', card });
      }
    }
    if (s.current === seat && s.phase === 'draw') {
      out.push({ type: 'draw', from: 'deck' });
      for (const c of COLORS) if (c !== s.justDiscarded && s.discard[c].length) out.push({ type: 'draw', from: c });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    // Passive play: discard the lowest card, then draw from the deck.
    if (s.phase === 'place') {
      const low = s.hands[seat]!.slice().sort((a, b) => value(a) - value(b))[0]!;
      lostCitiesModule.apply(s, { kind: 'player', seat }, { type: 'discard', card: low }, ctx);
    }
    const t = lostCitiesModule.apply(s, { kind: 'player', seat }, { type: 'draw', from: 'deck' }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 27,
    options: { deal: 'tutorial' },
    introFa: 'آخرین نوبت یک دست است و فقط یک کارت در دسته مانده. هر نوبت دو کار دارد: اول یک کارت را روی سفر خودتان می‌گذارید یا دور می‌اندازید، بعد یک کارت برمی‌دارید. سفر صحرای شما کارت‌های ۲ تا ۸ را دارد و سفر آتشفشان با یک «شرط» و ۷، ۸، ۱۰ شروع شده است. هر سفرِ شروع‌شده ۲۰ امتیاز خرج دارد، پس فقط سفری را شروع کنید که خرجش درمی‌آید.',
    steps: [
      { instructionFa: '«صحرا ۹» را انتخاب کنید و روی سفر صحرا بگذارید. کارت‌های هر سفر باید از کارت قبلی بزرگ‌تر باشند؛ برای همین ۲ و ۳ و ۴ آتشفشان دیگر روی سفر آتشفشان (که به ۱۰ رسیده) نمی‌نشینند و فقط می‌شود دورشان انداخت. این هشتمین کارت سفر صحراست و سفر هشت‌کارتی ۲۰ امتیاز جایزه دارد.', expected: { type: 'play', card: 'y9' }, reply: null },
      { instructionFa: 'حالا یک کارت بردارید: از دسته، یا کارت بالای یکی از کپه‌های دورریخته (اگر همین نوبت کارتی دور انداخته بودید، همان را نمی‌شد برداشت). برداشتن آخرین کارت دسته دست را تمام می‌کند؛ شما جلو هستید، پس از دسته بردارید. اگر عقب بودید، برداشتن از کپه‌های دورریخته بازی را طولانی‌تر می‌کرد.', expected: { type: 'draw', from: 'deck' }, reply: null }
    ],
    completedFa: 'بردید! امتیاز هر سفر = (جمع اعداد − ۲۰) × (۱ + تعداد شرط‌ها)، و سفر هشت‌کارتی ۲۰ امتیاز جایزه دارد. سفر صحرای شما: (۴۴ − ۲۰) + ۲۰ = ۴۴. سفر آتشفشان با یک شرط: (۲۵ − ۲۰) × ۲ = ۱۰. سه سفر شروع‌نشده صفرند: جمعاً ۵۴. حریف: جنگل (۴۲ − ۲۰) = ۲۲، دریا با دو شرط (۱۵ − ۲۰) × ۳ = ۱۵−، و کوهستان با یک کارت ۱۰ (۱۰ − ۲۰) = ۱۰−؛ جمعاً ۳−. کارت‌های مانده در دست امتیازی ندارند. در بازی کامل سه دست بازی می‌شود و جمع امتیازها برنده را تعیین می‌کند.'

  }
};
