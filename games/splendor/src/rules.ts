// Splendor («گوهرفروش»), 2–4 players. Gems: white, blue, green, red, black (4/5/7 each for 2/3/4 players) and 5 gold.
// 90 development cards (40/30/20 in three levels) with a bonus colour, prestige and a cost. The cards are generated
// from per-colour cost patterns that follow the original's distribution (same levels, points and cost shapes; not a
// card-for-card copy). Ten nobles (3 prestige; 4+4 of two colours or 3+3+3 of three), players + 1 on the table.
// A turn: take three different gems (fewer only if fewer colours are left), two of one colour (pile of 4+), reserve a
// card (face up or blind from a deck; max 3; +1 gold if any), or buy a face-up/reserved card paying cost minus bonuses,
// gold as wild. Over ten tokens: return the excess. A noble whose requirement is met visits at the end of the turn
// (the first eligible one). Reaching 15 finishes the round; most prestige wins, tie → fewer cards bought.
// Hidden: deck order and blind-reserved cards (others see only that a card of that level is reserved).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { splendor } from './definition.ts';

export const GEMS = ['w', 'u', 'g', 'r', 'k'] as const;
export type Gem = (typeof GEMS)[number];
export type Token = Gem | 'o';
export interface DevCard { id: number; level: 1 | 2 | 3; color: Gem; points: number; cost: Partial<Record<Gem, number>> }
export interface Noble { id: number; need: Partial<Record<Gem, number>> }

// Patterns relative to the card colour c: a = c+1, b = c+2, d = c+3, e = c+4 (mod 5).
type Rel = 'a' | 'b' | 'd' | 'e' | 'c';
const PATTERNS: [1 | 2 | 3, number, Partial<Record<Rel, number>>][] = [
  [1, 0, { a: 1, b: 1, d: 1, e: 1 }], [1, 0, { a: 1, b: 2, d: 1, e: 1 }], [1, 0, { a: 2, b: 2, e: 1 }], [1, 0, { d: 1, e: 3, c: 1 }],
  [1, 0, { d: 2, e: 1 }], [1, 0, { a: 2, d: 2 }], [1, 0, { d: 3 }], [1, 1, { b: 4 }],
  [2, 1, { a: 3, b: 2, d: 2 }], [2, 1, { a: 3, d: 3, c: 2 }], [2, 2, { b: 1, d: 4, e: 2 }], [2, 2, { d: 5, e: 3 }], [2, 2, { a: 5 }], [2, 3, { c: 6 }],
  [3, 3, { a: 3, b: 3, d: 5, e: 3 }], [3, 4, { e: 7 }], [3, 4, { d: 3, e: 6, c: 3 }], [3, 5, { e: 7, c: 3 }]
];
const OFF: Record<Rel, number> = { c: 0, a: 1, b: 2, d: 3, e: 4 };
export const CARDS: DevCard[] = (() => {
  const out: DevCard[] = [];
  for (const level of [1, 2, 3] as const) for (let c = 0; c < 5; c++) for (const [l, points, rel] of PATTERNS) {
    if (l !== level) continue;
    const cost: Partial<Record<Gem, number>> = {};
    for (const [k, v] of Object.entries(rel) as [Rel, number][]) cost[GEMS[(c + OFF[k]) % 5]!] = v;
    out.push({ id: out.length, level, color: GEMS[c]!, points, cost });
  }
  return out;
})();
export const NOBLES: Noble[] = [
  ...GEMS.map((g, i) => ({ id: i, need: { [g]: 4, [GEMS[(i + 1) % 5]!]: 4 } })),
  ...GEMS.map((g, i) => ({ id: 5 + i, need: { [g]: 3, [GEMS[(i + 1) % 5]!]: 3, [GEMS[(i + 2) % 5]!]: 3 } }))
];

export interface SplendorState {
  players: number;
  bank: Record<Token, number>;
  decks: number[][];
  market: (number | null)[][];
  nobles: number[];
  tokens: Record<Token, number>[];
  bought: number[][];
  reserved: number[][];
  blind: number[][];
  visited: number[][];
  current: number;
  starter: number;
  phase: 'act' | 'return' | 'end';
  ending: boolean;
  last: { seat: number; kind: string; card?: number; gems?: Token[]; noble?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface SplendorView extends Omit<SplendorState, 'decks' | 'reserved' | 'blind' | 'timeouts'> {
  deckCounts: number[];
  /** Reserved cards; blind ones from others are shown as { level } only. */
  reserved: (number | { level: number })[][];
  points: number[];
}

const gem = z.enum(GEMS);
const token = z.enum([...GEMS, 'o']);
export const splendorAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('take'), gems: z.array(gem).min(1).max(3) }),
  z.strictObject({ type: z.literal('reserve'), card: z.number().int().min(0).max(89).optional(), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional() }),
  z.strictObject({ type: z.literal('buy'), card: z.number().int().min(0).max(89) }),
  z.strictObject({ type: z.literal('return'), gems: z.array(token).min(1).max(3) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SplendorAction = z.infer<typeof splendorAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const emptyTokens = (): Record<Token, number> => ({ w: 0, u: 0, g: 0, r: 0, k: 0, o: 0 });
const count = (t: Record<Token, number>) => Object.values(t).reduce((a, b) => a + b, 0);
export const bonuses = (bought: number[]) => {
  const b: Record<Gem, number> = { w: 0, u: 0, g: 0, r: 0, k: 0 };
  for (const id of bought) b[CARDS[id]!.color] += 1;
  return b;
};
export const pointsOf = (s: Pick<SplendorState, 'bought' | 'visited'>, k: number) => s.bought[k]!.reduce((a, id) => a + CARDS[id]!.points, 0) + 3 * s.visited[k]!.length;

/** Gems paid (incl. gold) to buy `card`, or null when unaffordable. */
export function payment(tokens: Record<Token, number>, bought: number[], card: number): Record<Token, number> | null {
  const b = bonuses(bought);
  const pay = emptyTokens();
  for (const g of GEMS) {
    const need = Math.max(0, (CARDS[card]!.cost[g] ?? 0) - b[g]);
    pay[g] = Math.min(need, tokens[g]);
    pay.o += need - pay[g];
  }
  return pay.o <= tokens.o ? pay : null;
}

// ---------- module ----------

type Events = Transition<SplendorState>['internalEvents'];
const finish = (s: SplendorState, events: Events): Transition<SplendorState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: SplendorState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: pointsOf(s, seat), n: s.bought[seat]!.length })).sort((a, b) => b.p - a.p || a.n - b.n);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p && q.n === x.n ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

const where = (s: SplendorState, card: number) => {
  for (let l = 0; l < 3; l++) { const i = s.market[l]!.indexOf(card); if (i >= 0) return { l, i }; }
  return null;
};
function refill(s: SplendorState, l: number, i: number) { s.market[l]![i] = s.decks[l]!.shift() ?? null; }

function endTurn(s: SplendorState) {
  const seat = s.current;
  if (count(s.tokens[seat]!) > 10) { s.phase = 'return'; return; }
  const b = bonuses(s.bought[seat]!);
  const noble = s.nobles.find((n) => GEMS.every((g) => b[g] >= (NOBLES[n]!.need[g] ?? 0)));
  if (noble !== undefined) { s.nobles = s.nobles.filter((n) => n !== noble); s.visited[seat]!.push(noble); s.last = { ...s.last!, noble }; }
  if (pointsOf(s, seat) >= 15) s.ending = true;
  s.current = (seat + 1) % s.players;
  s.phase = 'act';
  if (s.ending && s.current === s.starter) { s.phase = 'end'; s.outcome = { placements: rank(s, s.tokens.map((_, k) => k)), reason: 'score' }; }
}

function takeOptions(s: SplendorState) {
  const avail = GEMS.filter((g) => s.bank[g] > 0);
  return { avail, pairs: GEMS.filter((g) => s.bank[g] >= 4) };
}

export const splendorModule: GameModule<SplendorState, SplendorAction, SplendorView> = {
  manifest: splendor.manifest,
  actionSchema: splendorAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('splendor needs 2–4 players');
    const n = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
    const decks = [1, 2, 3].map((l) => shuffle(rng, CARDS.filter((c) => c.level === l).map((c) => c.id)));
    const s: SplendorState = {
      players: playerCount, bank: { w: n, u: n, g: n, r: n, k: n, o: 5 }, decks, market: decks.map((d) => d.splice(0, 4)),
      nobles: shuffle(rng, NOBLES.map((x) => x.id)).slice(0, playerCount + 1), tokens: Array.from({ length: playerCount }, emptyTokens),
      bought: Array.from({ length: playerCount }, () => []), reserved: Array.from({ length: playerCount }, () => []), blind: Array.from({ length: playerCount }, () => []),
      visited: Array.from({ length: playerCount }, () => []), current: rng.nextInt(playerCount), starter: 0, phase: 'act', ending: false,
      last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    s.starter = s.current;
    if (options.deal === 'tutorial') {
      // Late-game teaching deal (tutorial tables only). Learner: 4 black + 3 red cards (6 prestige), red 3 · blue 2
      // gems. Opponent: a green and a blue card (7 prestige). The market holds the red «six reds» card (63) and the
      // white level-3 card (70); noble «4 red + 4 black» waits for the learner's fourth red card.
      const mine = [32, 33, 34, 35, 60, 61, 62];
      const theirs = [79, 51];
      const shown = [[2], [63], [70]];
      const used = new Set([...mine, ...theirs, ...shown.flat()]);
      s.current = 0; s.starter = 0;
      s.bought = [mine, theirs];
      s.tokens[0] = { ...emptyTokens(), r: 3, u: 2 };
      s.bank = { w: n, u: n - 2, g: n, r: n - 3, k: n, o: 5 };
      s.decks = s.decks.map((d) => d.filter((id) => !used.has(id)));
      s.market = shown.map((row, l) => [...row, ...s.decks[l]!.splice(0, 3)]);
      s.nobles = [3, 0, 6];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (s.phase === 'return') {
      if (a.type !== 'return') return { ok: false, errorCode: 'RETURN_TOKENS' };
      if (a.gems.length !== count(s.tokens[seat]!) - 10) return { ok: false, errorCode: 'RETURN_EXACT' };
      const t = { ...s.tokens[seat]! };
      for (const g of a.gems) { if (t[g] <= 0) return { ok: false, errorCode: 'NOT_OWNED' }; t[g] -= 1; }
      return { ok: true };
    }
    switch (a.type) {
      case 'take': {
        const { avail, pairs } = takeOptions(s);
        if (a.gems.length === 2 && a.gems[0] === a.gems[1]) return pairs.includes(a.gems[0]!) ? { ok: true } : { ok: false, errorCode: 'PAIR_NEEDS_FOUR' };
        if (new Set(a.gems).size !== a.gems.length) return { ok: false, errorCode: 'DIFFERENT_COLOURS' };
        if (!a.gems.every((g) => s.bank[g] > 0)) return { ok: false, errorCode: 'EMPTY_PILE' };
        return a.gems.length === Math.min(3, avail.length) ? { ok: true } : { ok: false, errorCode: 'TAKE_THREE' };
      }
      case 'reserve':
        if (s.reserved[seat]!.length >= 3) return { ok: false, errorCode: 'RESERVE_FULL' };
        if ((a.card === undefined) === (a.level === undefined)) return { ok: false, errorCode: 'CARD_OR_DECK' };
        if (a.card !== undefined) return where(s, a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_ON_TABLE' };
        return s.decks[a.level! - 1]!.length ? { ok: true } : { ok: false, errorCode: 'EMPTY_DECK' };
      case 'buy':
        if (!where(s, a.card) && !s.reserved[seat]!.includes(a.card)) return { ok: false, errorCode: 'NOT_AVAILABLE' };
        return payment(s.tokens[seat]!, s.bought[seat]!, a.card) ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      case 'pass':
        return legalFor(s, seat).some((h) => h.type !== 'pass') ? { ok: false, errorCode: 'MUST_ACT' } : { ok: true };
      default:
        return { ok: false, errorCode: 'ILLEGAL_ACTION' };
    }
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.phase = 'end';
      s.outcome = { placements: [...rank(s, s.tokens.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: pointsOf(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const t = s.tokens[seat]!;
    switch (a.type) {
      case 'take': for (const g of a.gems) { s.bank[g] -= 1; t[g] += 1; } s.last = { seat, kind: 'take', gems: a.gems }; break;
      case 'return': for (const g of a.gems) { s.bank[g] += 1; t[g] -= 1; } s.last = { seat, kind: 'return', gems: a.gems }; break;
      case 'reserve': {
        let card: number;
        if (a.card !== undefined) { const at = where(s, a.card)!; card = a.card; refill(s, at.l, at.i); }
        else { card = s.decks[a.level! - 1]!.shift()!; s.blind[seat]!.push(card); }
        s.reserved[seat]!.push(card);
        if (s.bank.o > 0) { s.bank.o -= 1; t.o += 1; }
        s.last = { seat, kind: 'reserve', ...(a.card !== undefined ? { card } : {}) };
        break;
      }
      case 'buy': {
        const pay = payment(t, s.bought[seat]!, a.card)!;
        for (const k of Object.keys(pay) as Token[]) { t[k] -= pay[k]; s.bank[k] += pay[k]; }
        const at = where(s, a.card);
        if (at) refill(s, at.l, at.i);
        else { s.reserved[seat] = s.reserved[seat]!.filter((x) => x !== a.card); s.blind[seat] = s.blind[seat]!.filter((x) => x !== a.card); }
        s.bought[seat]!.push(a.card);
        s.last = { seat, kind: 'buy', card: a.card };
        break;
      }
      case 'pass': s.last = { seat, kind: 'pass' }; break;
    }
    endTurn(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, bank: { ...s.bank }, deckCounts: s.decks.map((d) => d.length), market: s.market.map((r) => r.slice()), nobles: s.nobles.slice(),
      tokens: s.tokens.map((t) => ({ ...t })), bought: s.bought.map((b) => b.slice()),
      reserved: s.reserved.map((r, k) => r.map((id) => (k === me || s.outcome || !s.blind[k]!.includes(id) ? id : { level: CARDS[id]!.level }))),
      visited: s.visited.map((v) => v.slice()), current: s.current, starter: s.starter, phase: s.phase, ending: s.ending,
      points: s.tokens.map((_, k) => pointsOf(s, k)), last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    return [...legalFor(s, viewer.seat), { type: 'resign' }];
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    // Passive play: return the most plentiful gems; otherwise take gems, else buy, else reserve blind, else pass.
    let a: SplendorAction;
    if (s.phase === 'return') {
      const t = { ...s.tokens[seat]! };
      const gems: Token[] = [];
      for (let n = count(t) - 10; n > 0; n--) { const g = (Object.keys(t) as Token[]).filter((k) => k !== 'o' && t[k] > 0).sort((x, y) => t[y] - t[x])[0] ?? 'o'; t[g] -= 1; gems.push(g); }
      a = { type: 'return', gems };
    } else {
      const hints = legalFor(s, seat);
      const take = hints.find((h) => h.type === 'take');
      const buy = hints.find((h) => h.type === 'buy');
      const deck = hints.find((h) => h.type === 'reserve' && h.level);
      a = take ? { type: 'take', gems: (take.colors as Gem[]).slice(0, 3) } : buy ? { type: 'buy', card: buy.card as number }
        : deck ? { type: 'reserve', level: deck.level as 1 | 2 | 3 } : { type: 'pass' };
    }
    const tr = splendorModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...tr, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 31,
    options: { deal: 'tutorial' },
    introFa: 'اواخر یک بازی دونفره است و شما ۶ اعتبار دارید؛ برای بردن ۱۵ اعتبار لازم است. چهار کارت عقیق سیاه و سه کارت یاقوت سرخ خریده‌اید و ۳ یاقوت سرخ و ۲ یاقوت کبود در دست دارید. هر کارت خریده‌شده یک تخفیف دائمی از رنگ خودش می‌دهد. نقشه: کارت «یاقوت سرخ» کارگاه (۶ یاقوت سرخ، ۳ اعتبار) و کارت «الماس» کاروان (۳ اعتبار) را بخرید و نظر بزرگی را که ۴ کارت سرخ و ۴ کارت سیاه می‌خواهد جلب کنید.',
    steps: [
      { instructionFa: 'سه گوهر از سه رنگ مختلف بردارید: الماس، یاقوت کبود و یاقوت سرخ. روی هر سه بزنید و بعد «برداشتن». این رایج‌ترین حرکت است: سه گوهر، هر کدام از یک رنگ.', expected: { type: 'take', gems: ['w', 'u', 'r'] }, reply: { type: 'take', gems: ['w', 'u', 'k'] } },
      { instructionFa: 'حالا دو زمرد بردارید: روی زمرد دو بار بزنید و «برداشتن». دو گوهر هم‌رنگ فقط وقتی مجاز است که پیش از برداشتن دست‌کم ۴ گوهر در آن کپه باشد؛ کپهٔ زمرد هنوز ۴ تاست.', expected: { type: 'take', gems: ['g', 'g'] }, reply: { type: 'take', gems: ['w', 'g', 'k'] } },
      { instructionFa: 'کارت الماس سطح کاروان (۳ اعتبار؛ ۳ کبود، ۳ زمرد، ۵ سرخ، ۳ سیاه) را رزرو کنید: روی آن کارت بزنید و «رزرو (+طلا)». کارت رزروشده فقط مال شماست و یک سکهٔ طلا هم می‌گیرید که جای هر گوهری حساب می‌شود. حداکثر ۳ کارت می‌توانید رزرو کنید.', expected: { type: 'reserve', card: 70 }, reply: null },
      { instructionFa: 'حالا ۱۱ گوهر و طلا دارید، ولی بیشتر از ۱۰ تا نمی‌شود نگه داشت. الماس را که لازم ندارید پس بدهید: روی الماس خودتان بزنید و «پس دادن».', expected: { type: 'return', gems: ['w'] }, reply: { type: 'buy', card: 2 } },
      { instructionFa: 'کارت یاقوت سرخ سطح کارگاه (۳ اعتبار) قیمتش ۶ یاقوت سرخ است، ولی ۳ کارت سرخ دارید که ۳ تا تخفیف می‌دهند؛ پس فقط ۳ یاقوت سرخ می‌پردازید. آن را بخرید. با چهارمین کارت سرخ، خواستهٔ بزرگ (۴ سرخ و ۴ سیاه) کامل می‌شود و او خودکار با ۳ اعتبار به دیدارتان می‌آید.', expected: { type: 'buy', card: 63 }, reply: { type: 'reserve', level: 3 } },
      { instructionFa: 'کارت الماس رزروشده را از ردیف رزروهای خودتان بخرید. تخفیف ۴ کارت سرخ و ۴ کارت سیاه بیشتر قیمت را می‌پوشاند؛ ۳ کبود، ۲ زمرد و ۱ یاقوت سرخ می‌دهید و طلا جای زمرد سوم را می‌گیرد. با این خرید به ۱۵ اعتبار می‌رسید.', expected: { type: 'buy', card: 70 }, reply: { type: 'take', gems: ['w', 'u', 'g'] } }
    ],
    completedFa: 'بردید! از ۶ اعتبار شروع کردید: کارت یاقوت سرخ ۳ اعتبار، دیدار بزرگ ۳ اعتبار و کارت الماس ۳ اعتبار، یعنی ۱۵. چون به ۱۵ رسیدید، دور تا آخر ادامه یافت تا حریف هم نوبت آخرش را بازی کند و بازی با ۱۵ در برابر ۷ تمام شد. اگر امتیازها برابر بود، کسی که کارت کمتری خریده برنده می‌شد.'
  }
};

export function legalFor(s: SplendorState, seat: number): ActionHint[] {
  const out: ActionHint[] = [];
  if (s.outcome || s.current !== seat) return out;
  if (s.phase === 'return') return [{ type: 'return', count: count(s.tokens[seat]!) - 10 }];
  const { avail, pairs } = takeOptions(s);
  if (avail.length) out.push({ type: 'take', colors: avail, need: Math.min(3, avail.length) });
  for (const g of pairs) out.push({ type: 'take2', color: g });
  if (s.reserved[seat]!.length < 3) {
    for (const row of s.market) for (const id of row) if (id !== null) out.push({ type: 'reserve', card: id });
    s.decks.forEach((d, l) => { if (d.length) out.push({ type: 'reserve', level: l + 1 }); });
  }
  for (const id of [...s.market.flat(), ...s.reserved[seat]!]) if (id !== null && payment(s.tokens[seat]!, s.bought[seat]!, id)) out.push({ type: 'buy', card: id });
  if (!out.length) out.push({ type: 'pass' });
  return out;
}
