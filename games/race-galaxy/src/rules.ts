// Race for the Galaxy («رقابت کهکشانی»), 2–4 players. Original generated card set: 3 start worlds, 32 worlds
// (production / windfall / military; goods novelty, rare, genes, alien) and 20 developments with simple powers.
// Round: everyone secretly picks one phase; the picked phases run in order for all players, the picker gets the
// bonus — Explore (draw 2 keep 1; picker draws 4), Develop (place a development paying cost in cards; picker −1),
// Settle (place a world: civil pays cost in cards, military needs military ≥ defence; picker draws 1 afterwards),
// Consume (every good → 1 VP chip, picker ×2), Produce (production worlds without a good get one; picker also fills
// windfalls). Hand limit 10. Game ends after a round where someone has 12 tableau cards or the VP pool (12/player)
// is empty; score = card VP + chips, ties share. Not included: trade, search, takeovers, 6-cost dev bonuses, goals.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { raceGalaxy } from './definition.ts';

export type Good = 'n' | 'r' | 'g' | 'a';
export type Power = 'devCost' | 'settleCost' | 'military' | 'explore' | 'consume';
export interface Card { id: number; name: string; type: 'world' | 'dev'; cost: number; vp: number; kind?: 'prod' | 'wind' | 'mil'; good?: Good; power?: Power; mil?: number; start?: boolean }
const W: [string, number, 'prod' | 'wind' | 'mil', Good][] = [
  ['سیارهٔ سرگردان', 1, 'wind', 'n'], ['ماه یخی', 1, 'prod', 'n'], ['کمربند سیارکی', 2, 'prod', 'r'], ['جهان آبی', 2, 'prod', 'g'], ['کلونی معدنی', 2, 'wind', 'r'],
  ['پایگاه دزدان', 2, 'mil', 'n'], ['جنگل بلورین', 3, 'prod', 'g'], ['خرابه‌های بیگانه', 3, 'wind', 'a'], ['مستعمرهٔ تبعیدی', 1, 'mil', 'n'], ['زمین داغ', 3, 'prod', 'r'],
  ['سیارهٔ باغ', 3, 'prod', 'g'], ['دژ شورشیان', 3, 'mil', 'r'], ['ماه آهنی', 2, 'mil', 'r'], ['بهشت کویری', 4, 'prod', 'n'], ['سیارهٔ معدن طلا', 4, 'wind', 'r'],
  ['آزمایشگاه ژن', 4, 'prod', 'g'], ['نوار پیشگامان', 4, 'mil', 'g'], ['پایتخت گمشده', 5, 'wind', 'a'], ['کارگاه بیگانه', 5, 'prod', 'a'], ['سیارهٔ اقیانوسی', 4, 'prod', 'n'],
  ['قلعهٔ ستاره', 5, 'mil', 'a'], ['دنیای ققنوس', 5, 'prod', 'r'], ['ایستگاه مرزی', 2, 'prod', 'n'], ['جهان مه‌آلود', 3, 'wind', 'g'], ['دروازهٔ کهکشان', 6, 'prod', 'a'],
  ['امپراتوری فراموش', 6, 'mil', 'a'], ['ماه شکارچیان', 3, 'mil', 'g'], ['سیارهٔ تجاری', 3, 'prod', 'n'], ['کوهستان بلور', 4, 'wind', 'r'], ['ناو‌گاه کهن', 4, 'mil', 'n'],
  ['شهر شناور', 5, 'prod', 'g'], ['معبد ستارگان', 6, 'wind', 'a']
];
const D: [string, number, number, Power?, number?][] = [
  ['شبکهٔ اکتشاف', 1, 0, 'explore'], ['کارخانهٔ خودکار', 2, 1, 'devCost'], ['سپاه داوطلب', 1, 0, 'military', 1], ['دفتر استعمار', 2, 1, 'settleCost'], ['بازار آزاد', 2, 1, 'consume'],
  ['ناوگان جنگی', 3, 1, 'military', 2], ['آکادمی علوم', 3, 2], ['مهندسی ژنتیک', 3, 2, 'devCost'], ['اتحادیهٔ بازرگانی', 4, 2, 'consume'], ['کشتی‌های نسل', 4, 2, 'settleCost'],
  ['تله‌پورت', 4, 3], ['ستاد فرماندهی', 5, 3, 'military', 3], ['کتابخانهٔ کهکشانی', 5, 4], ['ادارهٔ اکتشاف', 2, 1, 'explore'], ['کنسولگری', 3, 2],
  ['بانک مرکزی', 6, 5], ['شورای کهکشان', 6, 5], ['زره‌پوش‌ها', 2, 1, 'military', 1], ['پروژهٔ ابرسازه', 6, 6], ['جشنوارهٔ ستاره', 1, 1]
];
const STARTS: [string, 'prod' | 'wind' | 'mil', Good][] = [['زمین قدیم', 'prod', 'n'], ['کلونی نخستین', 'wind', 'r'], ['ناو تبعیدی', 'mil', 'g']];
export const CARDS: Card[] = [
  ...STARTS.map(([name, kind, good]) => ({ name, type: 'world' as const, cost: 0, vp: 1, kind, good, start: true, ...(kind === 'mil' ? { mil: 1 } : {}) })),
  ...W.map(([name, cost, kind, good]) => ({ name, type: 'world' as const, cost, vp: Math.ceil(cost / 2), kind, good })),
  ...D.map(([name, cost, vp, power, mil]) => ({ name, type: 'dev' as const, cost, vp, ...(power ? { power } : {}), ...(mil ? { mil } : {}) }))
].map((c, id) => ({ ...c, id }));

/** The cost-2 civil world the tutorial settles. */
export const TUTORIAL_WORLD = CARDS.find((c) => c.type === 'world' && !c.start && c.kind !== 'mil' && c.cost === 2)!.id;

export const PHASES = ['explore', 'develop', 'settle', 'consume', 'produce'] as const;
export type Phase = (typeof PHASES)[number];
export interface Empire { hand: number[]; tableau: number[]; goods: number[]; chips: number; choice: Phase | null; drawn: number[]; done: boolean }
export interface RgState {
  players: Empire[];
  deck: number[];
  discard: number[];
  pool: number;
  round: number;
  stage: 'select' | Phase;
  queue: Phase[];
  chosen: Phase[][];
  last: { seat: number; kind: string; card?: number }[];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type RgView = Omit<RgState, 'players' | 'deck' | 'discard' | 'timeouts'> & {
  hand: number[] | null; drawn: number[] | null; myChoice: Phase | null;
  empires: { tableau: number[]; goods: number[]; chips: number; hand: number; chose: boolean; done: boolean; vp: number; military: number }[];
  deckCount: number;
};

const idx = z.array(z.number().int().min(0).max(40)).max(12);
export const rgAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('choose'), phase: z.enum(PHASES) }),
  z.strictObject({ type: z.literal('keep'), card: z.number().int().min(0).max(200) }),
  z.strictObject({ type: z.literal('place'), card: z.number().int().min(-1).max(200), pay: idx }),
  z.strictObject({ type: z.literal('resign') })
]);
export type RgAction = z.infer<typeof rgAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const powers = (e: Pick<Empire, 'tableau'>, p: Power) => e.tableau.filter((id) => CARDS[id]!.power === p).length;
export const military = (e: Pick<Empire, 'tableau'>) => e.tableau.reduce((n, id) => n + (CARDS[id]!.mil ?? 0), 0);
export const vpOf = (e: Pick<Empire, 'tableau' | 'chips'>) => e.chips + e.tableau.reduce((n, id) => n + CARDS[id]!.vp, 0);
/** Cards to pay (or military needed) for placing `card`; null when it does not belong to the phase. */
export function priceOf(s: RgState, seat: number, card: number, phase: 'develop' | 'settle') {
  const c = CARDS[card]!;
  const e = s.players[seat]!;
  const picker = s.chosen[seat]?.includes(phase) ? 1 : 0;
  if (phase === 'develop') return c.type === 'dev' ? Math.max(0, c.cost - picker - powers(e, 'devCost')) : null;
  if (c.type !== 'world') return null;
  if (c.kind === 'mil') return military(e) >= c.cost ? 0 : null;
  return Math.max(0, c.cost - powers(e, 'settleCost'));
}

function drawCards(s: RgState, n: number, rng: EngineRng) {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) { if (!s.discard.length) break; s.deck = shuffle(rng, s.discard); s.discard = []; }
    out.push(s.deck.shift()!);
  }
  return out;
}

type Events = Transition<RgState>['internalEvents'];
const finish = (s: RgState, events: Events): Transition<RgState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
function rank(s: RgState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: vpOf(s.players[seat]!) })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

/** Starts the next queued phase (or ends the round). Automatic phases resolve immediately. */
function nextStage(s: RgState, rng: EngineRng) {
  for (;;) {
    const ph = s.queue.shift();
    if (!ph) { endRound(s); return; }
    s.stage = ph;
    s.players.forEach((e) => { e.done = false; e.drawn = []; });
    if (ph === 'explore') {
      s.players.forEach((e, k) => { e.drawn = drawCards(s, (s.chosen[k]!.includes('explore') ? 4 : 2) + powers(e, 'explore'), rng); if (!e.drawn.length) e.done = true; });
      if (s.players.some((e) => !e.done)) return;
      continue;
    }
    if (ph === 'develop' || ph === 'settle') {
      s.players.forEach((e, k) => { if (!e.hand.some((c) => priceOf(s, k, c, ph) !== null)) e.done = true; });
      if (s.players.some((e) => !e.done)) return;
      afterSettle(s, rng);
      continue;
    }
    if (ph === 'consume') {
      s.players.forEach((e, k) => {
        const per = (s.chosen[k]!.includes('consume') ? 2 : 1) + powers(e, 'consume');
        const gain = Math.min(s.pool, e.goods.length * per);
        e.chips += gain; s.pool -= gain; e.goods = [];
      });
      continue;
    }
    s.players.forEach((e, k) => {
      for (const id of e.tableau) {
        const c = CARDS[id]!;
        if (c.type === 'world' && !e.goods.includes(id) && (c.kind === 'prod' || (c.kind === 'wind' && s.chosen[k]!.includes('produce')))) e.goods.push(id);
      }
    });
  }
}
function afterSettle(s: RgState, rng: EngineRng) {
  if (s.stage === 'settle') s.players.forEach((e, k) => { if (s.chosen[k]!.includes('settle')) e.hand.push(...drawCards(s, 1, rng)); });
}
function endRound(s: RgState) {
  for (const e of s.players) while (e.hand.length > 10) s.discard.push(e.hand.pop()!);
  if (s.pool <= 0 || s.players.some((e) => e.tableau.length >= 12)) { s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' }; return; }
  s.round += 1;
  s.stage = 'select';
  s.players.forEach((e) => { e.choice = null; e.done = false; });
}

export const rgModule: GameModule<RgState, RgAction, RgView> = {
  manifest: raceGalaxy.manifest,
  actionSchema: rgAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('race for the galaxy needs 2–4 players');
    const starts = shuffle(rng, CARDS.filter((c) => c.start).map((c) => c.id));
    const s: RgState = {
      players: [], deck: shuffle(rng, CARDS.filter((c) => !c.start).map((c) => c.id)), discard: [], pool: 12 * playerCount, round: 1, stage: 'select',
      queue: [], chosen: Array.from({ length: playerCount }, () => []), last: [], seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    s.players = Array.from({ length: playerCount }, (_, k) => ({ hand: drawCards(s, 4, rng), tableau: [starts[k % 3]!], goods: [], chips: 0, choice: null, drawn: [], done: false }));
    if (options.deal === 'tutorial') {
      const worlds = CARDS.filter((c) => c.type === 'world' && !c.start && c.kind !== 'mil').map((c) => c.id);
      const target = TUTORIAL_WORLD;
      const filler = worlds.filter((id) => id !== target).slice(0, 10);
      s.players[0]!.tableau = [starts[0]!, ...filler];
      s.players[0]!.hand = [target, ...s.deck.splice(0, 3)];
      s.deck = s.deck.filter((id) => id !== target && !filler.includes(id));
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players.length) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const e = s.players[actor.seat]!;
    if (a.type === 'choose') return s.stage === 'select' && !e.choice ? { ok: true } : { ok: false, errorCode: 'NOT_SELECTING' };
    if (e.done) return { ok: false, errorCode: 'ALREADY_DONE' };
    if (a.type === 'keep') return s.stage === 'explore' && e.drawn.includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_DRAWN' };
    if (s.stage !== 'develop' && s.stage !== 'settle') return { ok: false, errorCode: 'NOT_PLACING' };
    if (a.card === -1) return a.pay.length ? { ok: false, errorCode: 'BAD_PAY' } : { ok: true };
    if (!e.hand.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
    const price = priceOf(s, actor.seat, a.card, s.stage);
    if (price === null) return { ok: false, errorCode: 'WRONG_PHASE_OR_MILITARY' };
    const payable = new Set(a.pay);
    if (payable.size !== a.pay.length || a.pay.length !== price || a.pay.some((i) => i >= e.hand.length || e.hand[i] === a.card)) return { ok: false, errorCode: 'BAD_PAY' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.players.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players.length, score: vpOf(s.players[seat]!) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    const e = s.players[seat]!;
    if (a.type === 'choose') {
      e.choice = a.phase;
      if (s.players.every((x) => x.choice)) {
        s.chosen = s.players.map((x) => [x.choice!]);
        s.queue = PHASES.filter((ph) => s.players.some((x) => x.choice === ph));
        s.last = [];
        nextStage(s, ctx.rng);
      }
      return finish(s, [{ type: 'choose', seat }]);
    }
    if (a.type === 'keep') {
      e.hand.push(a.card);
      s.discard.push(...e.drawn.filter((c) => c !== a.card));
      e.drawn = []; e.done = true;
    } else {
      if (a.card >= 0) {
        const paid = a.pay.map((i) => e.hand[i]!);
        e.hand = e.hand.filter((c, i) => c !== a.card && !a.pay.includes(i));
        s.discard.push(...paid);
        e.tableau.push(a.card);
        if (CARDS[a.card]!.kind === 'wind') e.goods.push(a.card);
        s.last.push({ seat, kind: s.stage, card: a.card });
      }
      e.done = true;
    }
    if (s.players.every((x) => x.done)) { afterSettle(s, ctx.rng); nextStage(s, ctx.rng); }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { players, deck, discard: _d, timeouts: _t, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      ...rest, hand: players[me]?.hand ?? null, drawn: players[me]?.drawn ?? null, myChoice: players[me]?.choice ?? null, deckCount: deck.length,
      empires: players.map((e) => ({ tableau: e.tableau, goods: e.goods, chips: e.chips, hand: e.hand.length, chose: !!e.choice, done: e.done, vp: vpOf(e), military: military(e) }))
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const e = s.players[seat]!;
    const out: ActionHint[] = [];
    if (s.stage === 'select' && !e.choice) PHASES.forEach((phase) => out.push({ type: 'choose', phase }));
    if (s.stage === 'explore' && !e.done) e.drawn.forEach((card) => out.push({ type: 'keep', card }));
    if ((s.stage === 'develop' || s.stage === 'settle') && !e.done) {
      e.hand.forEach((card) => { const price = priceOf(s, seat, card, s.stage as 'develop' | 'settle'); if (price !== null && e.hand.length - 1 >= price) out.push({ type: 'place', card, price }); });
      out.push({ type: 'place', card: -1, pay: [] });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seats = rgModule.pendingSeats(s);
    const missed = seats.map((k) => s.timeouts[k]! + 1);
    for (const seat of seats) {
      if (s.outcome) break;
      const e = s.players[seat]!;
      const a: RgAction = s.stage === 'select' ? { type: 'choose', phase: 'produce' } : s.stage === 'explore' ? { type: 'keep', card: e.drawn[0]! } : { type: 'place', card: -1, pay: [] };
      if (rgModule.validate(s, { kind: 'player', seat }, a).ok) rgModule.apply(s, { kind: 'player', seat }, a, ctx);
    }
    seats.forEach((k, i) => { s.timeouts[k] = missed[i]!; });
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.players.map((e, k) => (s.stage === 'select' ? (e.choice ? -1 : k) : e.done ? -1 : k)).filter((k) => k >= 0)),

  tutorial: {
    seed: 29,
    options: { deal: 'tutorial' },
    introFa: 'امپراتوری شما ۱۱ کارت دارد. اگر جهان دوازدهم را مستقر کنید بازی در پایان همین دور تمام می‌شود.',
    steps: [
      { instructionFa: 'مرحلهٔ «استقرار» را انتخاب کنید.', expected: { type: 'choose', phase: 'settle' }, reply: { type: 'choose', phase: 'produce' } },
      { instructionFa: 'جهان اول دستتان (هزینهٔ ۲) را مستقر کنید و با دو کارت دیگر هزینه را بپردازید.', expected: { type: 'place', card: TUTORIAL_WORLD, pay: [1, 2] }, reply: { type: 'place', card: -1, pay: [] } }
    ],
    completedFa: 'بردید! با ۱۲ کارت روی میز بازی تمام شد.'
  }
};
