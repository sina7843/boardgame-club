// Century: Spice Road («راه ادویه»), 2–5 players. Spices y < r < g < b (turmeric, saffron, cardamom, cinnamon);
// caravan limit 10. Merchant cards: spice (gain), upgrade N (N one-step upgrades), trade (input → output, repeatable).
// The merchant and order cards are generated sets following the original's kinds and value curve (order points =
// y1 r2 g3 b4 summed), not card-for-card copies. Everyone starts with «2 turmeric» and «upgrade 2»; starting spices by
// seat order from the first player: 3y, 4y, 4y, 3y+1r, 3y+1r. A turn: play a hand card; acquire market card i (put one
// spice on each card before it, take the spices on it); rest (played cards return); or claim an order (pay its exact
// spices; first slot also takes a gold coin (3), second a silver (1) while they last; 2 × players of each).
// The 6th order (5th with 4–5 players) finishes the round. Score: orders + coins + 1 per non-turmeric spice.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { century } from './definition.ts';

export const SPICES = ['y', 'r', 'g', 'b'] as const;
export type Spice = (typeof SPICES)[number];
export type Bag = Record<Spice, number>;
export type Merchant = { id: number; kind: 'spice'; gain: Bag } | { id: number; kind: 'upgrade'; n: number } | { id: number; kind: 'trade'; give: Bag; gain: Bag };
export interface Order { id: number; need: Bag; points: number }

export const empty = (): Bag => ({ y: 0, r: 0, g: 0, b: 0 });
const bag = (s: string): Bag => { const x = empty(); for (const ch of s) x[ch as Spice] += 1; return x; };
const SPICE_CARDS = ['yyy', 'yyyy', 'yyr', 'yg', 'rr', 'yyg', 'yb', 'rg', 'g', 'b', 'yyrr', 'rrr'];
const TRADES = ['yy>rr', 'yyy>rg', 'yyy>b', 'yyyy>gg', 'yyyyy>bb', 'r>yyy', 'rr>yyg', 'rr>b', 'rrr>gg', 'rrr>yyb', 'g>rr', 'g>yyr', 'gg>bb', 'gg>rrb', 'b>yyg', 'bb>ggg', 'yr>g', 'yyr>b', 'yg>rb', 'rg>bb'];
export const MERCHANTS: Merchant[] = [
  { id: 0, kind: 'spice', gain: bag('yy') }, { id: 1, kind: 'upgrade', n: 2 },
  ...SPICE_CARDS.map((s, i) => ({ id: 2 + i, kind: 'spice' as const, gain: bag(s) })),
  { id: 14, kind: 'upgrade', n: 3 }, { id: 15, kind: 'upgrade', n: 2 },
  ...TRADES.map((t, i) => { const [a, b] = t.split('>'); return { id: 16 + i, kind: 'trade' as const, give: bag(a!), gain: bag(b!) }; })
];
const VAL: Record<Spice, number> = { y: 1, r: 2, g: 3, b: 4 };
export const ORDERS: Order[] = (() => {
  const all: string[] = [];
  const rec = (pre: string, from: number, left: number) => { if (!left) { all.push(pre); return; } for (let i = from; i < 4; i++) rec(pre + SPICES[i], i, left - 1); };
  for (let n = 2; n <= 5; n++) rec('', 0, n);
  const ok = all.filter((s) => new Set(s).size >= 2 || s.length >= 4).filter((s) => s.split('').reduce((a, c) => a + VAL[c as Spice], 0) >= 6);
  const step = ok.length / 36;
  return Array.from({ length: 36 }, (_, i) => { const s = ok[Math.floor(i * step)]!; return { id: i, need: bag(s), points: s.split('').reduce((a, c) => a + VAL[c as Spice], 0) }; });
})();
export const total = (b: Bag) => b.y + b.r + b.g + b.b;
const covers = (have: Bag, need: Bag, k = 1) => SPICES.every((s) => have[s] >= need[s] * k);

export interface CenturyState {
  players: number;
  hands: number[][];
  played: number[][];
  cubes: Bag[];
  mdeck: number[];
  market: { card: number; cubes: Bag }[];
  odeck: number[];
  orders: number[];
  gold: number;
  silver: number;
  won: number[][];
  coins: { gold: number; silver: number }[];
  current: number;
  starter: number;
  ending: boolean;
  phase: 'act' | 'discard';
  last: { seat: number; kind: string; card?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type CenturyView = Omit<CenturyState, 'mdeck' | 'odeck' | 'timeouts'> & { mdeckCount: number; odeckCount: number; scores: number[] };

const spice = z.enum(SPICES);
export const centuryAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: z.number().int().min(0).max(35), times: z.number().int().min(1).max(10).optional(), upgrades: z.array(spice).max(3).optional() }),
  z.strictObject({ type: z.literal('acquire'), slot: z.number().int().min(0).max(5), pay: z.array(spice).max(5) }),
  z.strictObject({ type: z.literal('rest') }),
  z.strictObject({ type: z.literal('claim'), slot: z.number().int().min(0).max(4) }),
  z.strictObject({ type: z.literal('discard'), cubes: z.array(spice).min(1).max(20) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CenturyAction = z.infer<typeof centuryAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const scoreOf = (s: Pick<CenturyState, 'won' | 'coins' | 'cubes'>, k: number) =>
  s.won[k]!.reduce((a, id) => a + ORDERS[id]!.points, 0) + 3 * s.coins[k]!.gold + s.coins[k]!.silver + s.cubes[k]!.r + s.cubes[k]!.g + s.cubes[k]!.b;

/** Applies upgrades in order; returns the new bag or null when one is impossible. */
export function upgrade(have: Bag, ups: Spice[]): Bag | null {
  const b = { ...have };
  for (const u of ups) { if (u === 'b' || b[u] < 1) return null; b[u] -= 1; b[SPICES[SPICES.indexOf(u) + 1]!] += 1; }
  return b;
}

// ---------- module ----------

type Events = Transition<CenturyState>['internalEvents'];
const finish = (s: CenturyState, events: Events): Transition<CenturyState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: CenturyState, seats: number[]): Outcome['placements'] {
  // Tie: the later player in turn order wins (they had fewer turns).
  const order = (k: number) => (k - s.starter + s.players) % s.players;
  const r = seats.map((seat) => ({ seat, p: scoreOf(s, seat) })).sort((a, b) => b.p - a.p || order(b.seat) - order(a.seat));
  return r.map((x, i) => ({ seat: x.seat, place: i + 1, score: x.p }));
}

function endTurn(s: CenturyState) {
  const seat = s.current;
  if (total(s.cubes[seat]!) > 10) { s.phase = 'discard'; return; }
  s.phase = 'act';
  if (s.won[seat]!.length >= (s.players <= 3 ? 6 : 5)) s.ending = true;
  s.current = (seat + 1) % s.players;
  if (s.ending && s.current === s.starter) s.outcome = { placements: rank(s, s.cubes.map((_, k) => k)), reason: 'score' };
}

export function legalFor(s: CenturyState, seat: number): ActionHint[] {
  const out: ActionHint[] = [];
  if (s.outcome || s.current !== seat) return out;
  if (s.phase === 'discard') return [{ type: 'discard', count: total(s.cubes[seat]!) - 10 }];
  const c = s.cubes[seat]!;
  for (const id of s.hands[seat]!) {
    const m = MERCHANTS[id]!;
    if (m.kind === 'trade') { const max = SPICES.reduce((a, x) => (m.give[x] ? Math.min(a, Math.floor(c[x] / m.give[x])) : a), 99); if (max >= 1) out.push({ type: 'play', card: id, max }); }
    else if (m.kind === 'upgrade') { if (c.y + c.r + c.g) out.push({ type: 'play', card: id, n: m.n }); }
    else out.push({ type: 'play', card: id });
  }
  s.market.forEach((_, i) => { if (total(c) >= i) out.push({ type: 'acquire', slot: i }); });
  if (s.played[seat]!.length) out.push({ type: 'rest' });
  s.orders.forEach((id, i) => { if (covers(c, ORDERS[id]!.need)) out.push({ type: 'claim', slot: i }); });
  return out;
}

/** The tutorial's sixth order: 2 saffron + 1 cardamom + 1 cinnamon, 11 points. */
const TUTORIAL_ORDER = 13;

export const centuryModule: GameModule<CenturyState, CenturyAction, CenturyView> = {
  manifest: century.manifest,
  actionSchema: centuryAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('century needs 2–5 players');
    const mdeck = shuffle(rng, MERCHANTS.slice(2).map((m) => m.id));
    const odeck = shuffle(rng, ORDERS.map((o) => o.id));
    const starter = rng.nextInt(playerCount);
    const start = ['yyy', 'yyyy', 'yyyy', 'yyyr', 'yyyr'];
    const s: CenturyState = {
      players: playerCount, hands: Array.from({ length: playerCount }, () => [0, 1]), played: Array.from({ length: playerCount }, () => []),
      cubes: Array.from({ length: playerCount }, (_, k) => bag(start[(k - starter + playerCount) % playerCount]!)), mdeck, market: mdeck.splice(0, 6).map((card) => ({ card, cubes: empty() })),
      odeck, orders: odeck.splice(0, 5), gold: 2 * playerCount, silver: 2 * playerCount, won: Array.from({ length: playerCount }, () => []),
      coins: Array.from({ length: playerCount }, () => ({ gold: 0, silver: 0 })), current: starter, starter, ending: false, phase: 'act', last: null, seq: 0,
      timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // Late game, two players, the learner starts. Five orders each side of 32 points; the learner's sixth order
      // (rrgb) needs a spice card, a rest, a repeated trade, an upgrade and a market card holding one cinnamon.
      const won = [[0, 1, 2, 3, 6], [7, 9, 12, 17]];
      s.starter = 0; s.current = 0;
      s.cubes = [bag('yyyy'), bag('yyy')];
      s.hands = [[0], [0, 1]];
      s.played = [[16, 1], []];
      s.won = won;
      s.coins = [{ gold: 1, silver: 1 }, { gold: 1, silver: 0 }];
      s.gold = 2 * playerCount - 2; s.silver = 2 * playerCount - 1;
      s.odeck = s.odeck.concat(s.orders).filter((id) => id !== TUTORIAL_ORDER && !won.flat().includes(id));
      s.orders = [TUTORIAL_ORDER, ...s.odeck.splice(0, 4)];
      const market = [5, 9, 23];
      s.mdeck = s.mdeck.concat(s.market.map((x) => x.card)).filter((id) => !market.includes(id));
      s.market = [...market, ...s.mdeck.splice(0, 3)].map((card) => ({ card, cubes: empty() }));
      s.market[2]!.cubes.b = 1;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const c = s.cubes[seat]!;
    if (s.phase === 'discard') {
      if (a.type !== 'discard') return { ok: false, errorCode: 'DISCARD_FIRST' };
      if (a.cubes.length !== total(c) - 10) return { ok: false, errorCode: 'DISCARD_EXACT' };
      return covers(c, bag(a.cubes.join(''))) ? { ok: true } : { ok: false, errorCode: 'NOT_OWNED' };
    }
    switch (a.type) {
      case 'play': {
        if (!s.hands[seat]!.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
        const m = MERCHANTS[a.card]!;
        if (m.kind === 'trade') return covers(c, m.give, a.times ?? 1) ? { ok: true } : { ok: false, errorCode: 'CANNOT_TRADE' };
        if (m.kind === 'upgrade') return a.upgrades && a.upgrades.length >= 1 && a.upgrades.length <= m.n && upgrade(c, a.upgrades) ? { ok: true } : { ok: false, errorCode: 'BAD_UPGRADE' };
        return { ok: true };
      }
      case 'acquire':
        if (!s.market[a.slot]) return { ok: false, errorCode: 'NO_SUCH_CARD' };
        if (a.pay.length !== a.slot) return { ok: false, errorCode: 'PAY_ONE_EACH' };
        return covers(c, bag(a.pay.join(''))) ? { ok: true } : { ok: false, errorCode: 'NOT_OWNED' };
      case 'rest': return s.played[seat]!.length ? { ok: true } : { ok: false, errorCode: 'NOTHING_TO_REST' };
      case 'claim': return s.orders[a.slot] !== undefined && covers(c, ORDERS[s.orders[a.slot]!]!.need) ? { ok: true } : { ok: false, errorCode: 'CANNOT_CLAIM' };
      default: return { ok: false, errorCode: 'ILLEGAL_ACTION' };
    }
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.cubes.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: scoreOf(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const c = s.cubes[seat]!;
    switch (a.type) {
      case 'discard': for (const x of a.cubes) c[x] -= 1; break;
      case 'play': {
        const m = MERCHANTS[a.card]!;
        if (m.kind === 'spice') for (const x of SPICES) c[x] += m.gain[x];
        else if (m.kind === 'trade') for (const x of SPICES) c[x] += (m.gain[x] - m.give[x]) * (a.times ?? 1);
        else Object.assign(c, upgrade(c, a.upgrades!)!);
        s.hands[seat] = s.hands[seat]!.filter((x) => x !== a.card);
        s.played[seat]!.push(a.card);
        break;
      }
      case 'acquire': {
        a.pay.forEach((x, i) => { c[x] -= 1; s.market[i]!.cubes[x] += 1; });
        const [slot] = s.market.splice(a.slot, 1);
        for (const x of SPICES) c[x] += slot!.cubes[x];
        s.hands[seat]!.push(slot!.card);
        const next = s.mdeck.shift();
        if (next !== undefined) s.market.push({ card: next, cubes: empty() });
        break;
      }
      case 'rest': s.hands[seat]!.push(...s.played[seat]!); s.played[seat] = []; break;
      case 'claim': {
        const id = s.orders.splice(a.slot, 1)[0]!;
        for (const x of SPICES) c[x] -= ORDERS[id]!.need[x];
        s.won[seat]!.push(id);
        if (a.slot === 0 && s.gold > 0) { s.gold -= 1; s.coins[seat]!.gold += 1; }
        else if ((a.slot === 0 || (a.slot === 1 && s.gold > 0)) && s.silver > 0) { s.silver -= 1; s.coins[seat]!.silver += 1; }
        const next = s.odeck.shift();
        if (next !== undefined) s.orders.push(next);
        break;
      }
    }
    s.last = { seat, kind: a.type, ...('card' in a ? { card: a.card } : {}) };
    endTurn(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { mdeck, odeck, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, mdeckCount: mdeck.length, odeckCount: odeck.length, scores: s.cubes.map((_, k) => scoreOf(s, k)) };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    return [...legalFor(s, viewer.seat), { type: 'resign' }];
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    let a: CenturyAction;
    if (s.phase === 'discard') {
      const c = { ...s.cubes[seat]! };
      const cubes: Spice[] = [];
      for (let n = total(c) - 10; n > 0; n--) { const x = SPICES.find((y) => c[y] > 0)!; c[x] -= 1; cubes.push(x); }
      a = { type: 'discard', cubes };
    } else if (s.played[seat]!.length) a = { type: 'rest' };
    else {
      const spiceCard = s.hands[seat]!.find((id) => MERCHANTS[id]!.kind === 'spice');
      a = spiceCard !== undefined ? { type: 'play', card: spiceCard } : { type: 'acquire', slot: 0, pay: [] };
    }
    const t = centuryModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 51,
    options: { deal: 'tutorial' },
    introFa: 'آخر بازی دونفره است و شما شروع‌کننده‌اید. هر دو نفر ۳۲ امتیاز سفارش دارید؛ شما ۵ سفارش تحویل داده‌اید و ششمی پایان بازی را اعلام می‌کند. سفارش اول ردیف ۲ زعفران، ۱ هل و ۱ دارچین می‌خواهد (۱۱ امتیاز) و شما فقط ۴ زردچوبه دارید. ادویه‌ها به ترتیب ارزش: زردچوبه، زعفران، هل، دارچین. هر نوبت فقط یک کار می‌کنید.',
    steps: [
      { instructionFa: 'کارت «۲ زردچوبه» را از دستتان بازی کنید. کارت ادویه همان ادویه‌ها را به کاروانتان می‌دهد و بعد به ردیف کارت‌های بازی‌شده می‌رود.', expected: { type: 'play', card: 0 }, reply: { type: 'play', card: 0 } },
      { instructionFa: 'دستتان خالی است و کارت‌های معاوضه و ارتقا بازی‌شده‌اند. «استراحت» کنید: کل نوبت صرف می‌شود، ولی همهٔ کارت‌های بازی‌شده به دستتان برمی‌گردند.', expected: { type: 'rest' }, reply: { type: 'rest' } },
      { instructionFa: 'کارت معاوضهٔ «۲ زردچوبه ← ۲ زعفران» را انتخاب کنید و تعداد را ۲ کنید تا دو بار پشت‌سرهم اجرا شود و «معاوضه» را بزنید: ۴ زردچوبه به ۴ زعفران تبدیل می‌شود.', expected: { type: 'play', card: 16, times: 2 }, reply: { type: 'play', card: 0 } },
      { instructionFa: 'کارت «ارتقا ۲» را انتخاب کنید و دو بار زعفران را بزنید، بعد «ارتقا»: هر ارتقا یک ادویه را یک پله بالا می‌برد، پس ۲ زعفران هل می‌شوند.', expected: { type: 'play', card: 1, upgrades: ['r', 'r'] }, reply: { type: 'rest' } },
      { instructionFa: 'تاجر سوم بازار یک دارچین رویش دارد. آن را استخدام کنید: روی هر کارتِ قبل از آن یک ادویه می‌گذارید (ارزان‌ترین‌ها، اینجا ۲ زردچوبه) و کارت با ادویه‌های رویش مال شما می‌شود.', expected: { type: 'acquire', slot: 2, pay: ['y', 'y'] }, reply: { type: 'acquire', slot: 0, pay: [] } },
      { instructionFa: 'حریف تاجر اول را با زردچوبه‌ای که شما رویش گذاشتید برداشت. حالا ۲ زعفران، ۲ هل و ۱ دارچین دارید: سفارش اول ردیف را تحویل بگیرید. سفارش اول سکهٔ طلا (۳ امتیاز) هم دارد. این ششمین سفارش شماست و دور با نوبت حریف تمام می‌شود.', expected: { type: 'claim', slot: 0 }, reply: { type: 'play', card: 0 } }
    ],
    completedFa: 'بردید! ۳۲ امتیاز سفارش‌های قبلی + ۱۱ امتیاز سفارش تازه + ۲ سکهٔ طلا (۶) + ۱ سکهٔ نقره (۱) + ۱ امتیاز برای هلِ باقی‌مانده (هر ادویهٔ غیر زردچوبه ۱ امتیاز) = ۵۱. حریف با ۳۲ امتیاز سفارش و یک سکهٔ طلا و زردچوبه‌هایی که امتیاز ندارند ۳۵ گرفت.'
  }
};
