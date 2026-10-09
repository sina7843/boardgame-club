// The Quest for El Dorado («راه الدورادو»), 2–4 players. Fixed 11×6 hex map (odd-r offset, row 0 = start, the top
// row holds the El Dorado hexes). Hex types: g (jungle, machete), b (water, paddle), y (village, coin), r (rubble:
// discard N cards), c (base camp: remove N cards from the game), m (mountain, blocked). Start deck: 3 explorers
// (green 1), 1 sailor (blue 1), 4 travellers (coin 1); hand of 4. A card's points may be spent over several
// consecutive hexes of its colour (jokers pick a colour on first use); cards are not combined for one hex. One
// purchase per turn paid with coin points (any other card = ½ coin); bought cards go to the discard. Single-use
// cards leave the game when used. Reaching El Dorado ends the game at the end of the round; everyone who arrived
// shares first, the rest rank by distance. Simplifications: one fixed map, the whole market is buyable (3 of each
// type), no blockade tiles or caves. Hidden: hands and deck order.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { elDorado } from './definition.ts';

export const ROWS = 11, COLS = 6;
const MAP_ROWS = [
  's  s  s  s  m  m', 'g1 g1 b1 g1 y1 g1', 'g1 y1 b1 b1 g2 g1', 'm  g2 r1 b1 g1 y1', 'g1 g1 y2 m  b2 g1', 'c1 g2 g1 y1 b1 g2',
  'g1 c1 g2 y1 g2 b1', 'm  g3 b2 b2 y2 g1', 'g1 y1 g1 m  g2 c2', 'g2 g1 r1 y3 g1 g1', 'm  E  E  E  E  m'
];
export interface Hex { kind: 'g' | 'b' | 'y' | 'r' | 'c' | 'm' | 's' | 'E'; cost: number }
export const MAP: Hex[] = MAP_ROWS.flatMap((row) => row.trim().split(/\s+/).map((t) => ({ kind: t[0] as Hex['kind'], cost: Number(t.slice(1) || 0) })));
export const rc = (i: number) => [Math.floor(i / COLS), i % COLS] as const;
export function neighbours(i: number) {
  const [r, c] = rc(i);
  const odd = r % 2 === 1;
  const ds = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return ds.map(([dr, dc]) => [r + dr!, c + dc!] as const).filter(([y, x]) => y >= 0 && y < ROWS && x >= 0 && x < COLS).map(([y, x]) => y * COLS + x).filter((j) => MAP[j]!.kind !== 'm');
}
/** Steps from each hex to the nearest El Dorado hex (ignoring cost). */
export const DIST: number[] = (() => {
  const d = MAP.map((h) => (h.kind === 'E' ? 0 : Infinity));
  const q = MAP.map((_, i) => i).filter((i) => d[i] === 0);
  while (q.length) { const i = q.shift()!; for (const j of neighbours(i)) if (d[j] === Infinity) { d[j] = d[i]! + 1; q.push(j); } }
  return d;
})();

export type Sym = 'g' | 'b' | 'y' | 'any';
export interface CardType { key: string; name: string; sym: Sym; pts: number; cost: number; once?: boolean; draw?: number; trash?: number; native?: boolean }
export const CARD_TYPES: CardType[] = [
  { key: 'explorer', name: 'کاوشگر', sym: 'g', pts: 1, cost: 0 }, { key: 'sailor', name: 'ملوان', sym: 'b', pts: 1, cost: 0 }, { key: 'traveller', name: 'مسافر', sym: 'y', pts: 1, cost: 0 },
  { key: 'scout', name: 'پیشاهنگ', sym: 'g', pts: 2, cost: 1 }, { key: 'trailblazer', name: 'راه‌گشا', sym: 'g', pts: 3, cost: 3 }, { key: 'pioneer', name: 'پیشگام', sym: 'g', pts: 5, cost: 5 },
  { key: 'machete', name: 'قمهٔ بزرگ', sym: 'g', pts: 6, cost: 3, once: true }, { key: 'captain', name: 'ناخدا', sym: 'b', pts: 3, cost: 2 },
  { key: 'photographer', name: 'عکاس', sym: 'y', pts: 2, cost: 2 }, { key: 'journalist', name: 'روزنامه‌نگار', sym: 'y', pts: 3, cost: 3 },
  { key: 'chest', name: 'صندوق گنج', sym: 'y', pts: 4, cost: 3, once: true }, { key: 'millionaire', name: 'ثروتمند', sym: 'y', pts: 4, cost: 5 },
  { key: 'jack', name: 'همه‌کاره', sym: 'any', pts: 1, cost: 2 }, { key: 'adventurer', name: 'ماجراجو', sym: 'any', pts: 2, cost: 4 },
  { key: 'plane', name: 'هواپیمای ملخی', sym: 'any', pts: 4, cost: 4, once: true },
  { key: 'cartographer', name: 'نقشه‌کش', sym: 'g', pts: 0, cost: 4, draw: 2 }, { key: 'compass', name: 'قطب‌نما', sym: 'g', pts: 0, cost: 2, draw: 3, once: true },
  { key: 'scientist', name: 'دانشمند', sym: 'g', pts: 0, cost: 4, draw: 1, trash: 1 }, { key: 'native', name: 'راهنمای بومی', sym: 'g', pts: 0, cost: 5, native: true }
];
export const TYPE: Record<string, CardType> = Object.fromEntries(CARD_TYPES.map((t) => [t.key, t]));
export const MARKET = CARD_TYPES.filter((t) => t.cost > 0).map((t) => t.key);

export interface Explorer { pos: number; deck: string[]; hand: string[]; discard: string[]; arrived: boolean }
export interface EdState {
  players: Explorer[];
  market: Record<string, number>;
  current: number;
  firstSeat: number;
  active: { key: string; sym: Sym; left: number } | null;
  bought: boolean;
  removed: number;
  last: { seat: number; kind: string; card?: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type EdView = Omit<EdState, 'players' | 'timeouts'> & {
  hand: string[] | null;
  explorers: { pos: number; deck: number; hand: number; discard: number; arrived: boolean }[];
};

const idx = z.array(z.number().int().min(0).max(30)).max(30);
export const edAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), to: z.number().int().min(0).max(ROWS * COLS - 1), card: z.number().int().min(-1).max(30), as: z.enum(['g', 'b', 'y']).optional(), pay: idx.optional() }),
  z.strictObject({ type: z.literal('buy'), key: z.string().max(20), pay: idx }),
  z.strictObject({ type: z.literal('use'), card: z.number().int().min(0).max(30), trash: z.number().int().min(0).max(30).optional() }),
  z.strictObject({ type: z.literal('endTurn'), discard: idx }),
  z.strictObject({ type: z.literal('resign') })
]);
export type EdAction = z.infer<typeof edAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
function draw(p: Explorer, n: number, rng: EngineRng) {
  for (let k = 0; k < n; k++) {
    if (!p.deck.length) { if (!p.discard.length) return; p.deck = shuffle(rng, p.discard); p.discard = []; }
    p.hand.push(p.deck.shift()!);
  }
}
const uniq = (xs: number[]) => new Set(xs).size === xs.length;
export const coinValue = (keys: string[]) => keys.reduce((n, k) => n + (TYPE[k]!.sym === 'y' ? TYPE[k]!.pts : 0.5), 0);

type Events = Transition<EdState>['internalEvents'];
const finish = (s: EdState, events: Events): Transition<EdState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
function rank(s: EdState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, d: s.players[seat]!.arrived ? 0 : DIST[s.players[seat]!.pos]! })).sort((a, b) => a.d - b.d);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.d === x.d ? out[i - 1]!.place : i + 1, score: -x.d }); });
  return out;
}
const occupied = (s: EdState, hex: number) => s.players.some((p) => p.pos === hex);
/** Removes hand cards by indices; single-use cards leave the game, others go to the discard (or are removed). */
function spend(s: EdState, p: Explorer, indices: number[], remove = false) {
  const keys = indices.map((i) => p.hand[i]!);
  p.hand = p.hand.filter((_, i) => !indices.includes(i));
  for (const k of keys) { if (remove || TYPE[k]!.once) s.removed += 1; else p.discard.push(k); }
  return keys;
}

/** Tutorial route (row × 6 + column): village start → water → jungle → jungle → rubble → El Dorado. */
const TUTORIAL_HEX = { start: 6 * COLS + 3, water: 7 * COLS + 2, jungle1: 8 * COLS + 2, jungle2: 9 * COLS + 1, rubble: 9 * COLS + 2, goal: 10 * COLS + 2, opponent: 8 * COLS + 4 };

export const edModule: GameModule<EdState, EdAction, EdView> = {
  manifest: elDorado.manifest,
  actionSchema: edAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('el dorado needs 2–4 players');
    const starts = MAP.map((h, i) => (h.kind === 's' ? i : -1)).filter((i) => i >= 0);
    const first = rng.nextInt(playerCount);
    const players = Array.from({ length: playerCount }, (_, k) => {
      const p: Explorer = { pos: starts[(k - first + playerCount) % playerCount]!, deck: shuffle(rng, ['explorer', 'explorer', 'explorer', 'sailor', 'traveller', 'traveller', 'traveller', 'traveller']), hand: [], discard: [], arrived: false };
      draw(p, 4, rng);
      return p;
    });
    const s: EdState = {
      players, market: Object.fromEntries(MARKET.map((k) => [k, 3])), current: first, firstSeat: first, active: null, bought: false, removed: 0,
      last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // Late in a two-player race: the learner (village 6,3) crosses water, two jungle hexes, rubble and arrives; the
      // opponent waits at (8,4), two hexes out. Hand and deck are fixed so every card index in the script is known.
      s.current = 0; s.firstSeat = 0;
      Object.assign(s.players[0]!, { pos: TUTORIAL_HEX.start, hand: ['captain', 'scout', 'traveller', 'traveller'], deck: ['sailor', 'explorer', 'traveller', 'explorer'], discard: [] });
      s.players[1]!.pos = TUTORIAL_HEX.opponent;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players.length) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const p = s.players[actor.seat]!;
    const inHand = (xs: number[]) => uniq(xs) && xs.every((i) => i < p.hand.length);
    switch (a.type) {
      case 'endTurn': return inHand(a.discard) ? { ok: true } : { ok: false, errorCode: 'BAD_CARDS' };
      case 'buy': {
        if (s.bought) return { ok: false, errorCode: 'ALREADY_BOUGHT' };
        if (!s.market[a.key]) return { ok: false, errorCode: 'SOLD_OUT' };
        if (!inHand(a.pay)) return { ok: false, errorCode: 'BAD_CARDS' };
        return coinValue(a.pay.map((i) => p.hand[i]!)) >= TYPE[a.key]!.cost ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      }
      case 'use': {
        const t = TYPE[p.hand[a.card] ?? '']!;
        if (!t || (!t.draw && !t.trash)) return { ok: false, errorCode: 'NOT_AN_ACTION_CARD' };
        if (a.trash !== undefined && (!t.trash || a.trash === a.card || a.trash >= p.hand.length)) return { ok: false, errorCode: 'BAD_TRASH' };
        return { ok: true };
      }
      case 'move': {
        if (p.arrived) return { ok: false, errorCode: 'ARRIVED' };
        if (!neighbours(p.pos).includes(a.to) || occupied(s, a.to)) return { ok: false, errorCode: 'NOT_REACHABLE' };
        const hex = MAP[a.to]!;
        if (hex.kind === 's') return { ok: false, errorCode: 'NOT_REACHABLE' };
        if (hex.kind === 'r' || hex.kind === 'c') return a.pay && a.pay.length === hex.cost && inHand(a.pay) ? { ok: true } : { ok: false, errorCode: 'MUST_PAY_CARDS' };
        const need = hex.kind === 'E' ? 1 : hex.cost;
        const sym = hex.kind === 'E' ? null : hex.kind;
        if (a.card === -1) {
          const act = s.active;
          if (!act || act.left < need || (sym && act.sym !== sym)) return { ok: false, errorCode: 'NO_POINTS' };
          return { ok: true };
        }
        const t = TYPE[p.hand[a.card] ?? '']!;
        if (!t) return { ok: false, errorCode: 'NO_SUCH_CARD' };
        if (t.native) return { ok: true };
        const csym = t.sym === 'any' ? a.as ?? sym ?? 'g' : t.sym;
        if (t.pts < need || (sym && csym !== sym)) return { ok: false, errorCode: 'WRONG_CARD' };
        return { ok: true };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.players.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players.length }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    const p = s.players[seat]!;
    switch (a.type) {
      case 'move': {
        const hex = MAP[a.to]!;
        if (hex.kind === 'r' || hex.kind === 'c') { spend(s, p, a.pay!, hex.kind === 'c'); s.active = null; }
        else {
          const need = hex.kind === 'E' ? 1 : hex.cost;
          if (a.card >= 0) {
            const key = p.hand[a.card]!;
            const t = TYPE[key]!;
            spend(s, p, [a.card]);
            s.active = t.native ? null : { key, sym: t.sym === 'any' ? (a.as ?? (hex.kind === 'E' ? 'g' : hex.kind as Sym)) : t.sym, left: t.pts - need };
          } else s.active!.left -= need;
        }
        p.pos = a.to;
        if (hex.kind === 'E') { p.arrived = true; s.active = null; }
        s.last = { seat, kind: 'move' };
        break;
      }
      case 'buy': {
        spend(s, p, a.pay);
        s.market[a.key]! -= 1;
        p.discard.push(a.key);
        s.bought = true;
        s.last = { seat, kind: 'buy', card: a.key };
        break;
      }
      case 'use': {
        const key = p.hand[a.card]!;
        const t = TYPE[key]!;
        const trashKey = a.trash !== undefined ? p.hand[a.trash] : undefined;
        spend(s, p, [a.card]);
        if (trashKey) { p.hand.splice(p.hand.indexOf(trashKey), 1); s.removed += 1; }
        draw(p, t.draw ?? 0, ctx.rng);
        s.last = { seat, kind: 'use', card: key };
        break;
      }
      case 'endTurn': {
        spend(s, p, a.discard);
        draw(p, Math.max(0, 4 - p.hand.length), ctx.rng);
        s.active = null; s.bought = false;
        s.current = (seat + 1) % s.players.length;
        if (s.current === s.firstSeat && s.players.some((x) => x.arrived)) s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' };
        s.last = { seat, kind: 'end' };
        break;
      }
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { players, timeouts: _t, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return { ...rest, hand: players[me]?.hand ?? null, explorers: players.map((p) => ({ pos: p.pos, deck: p.deck.length, hand: p.hand.length, discard: p.discard.length, arrived: p.arrived })) };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      const p = s.players[viewer.seat]!;
      if (!p.arrived) {
        for (const to of neighbours(p.pos)) {
          const hex = MAP[to]!;
          if (occupied(s, to) || hex.kind === 's') continue;
          if (hex.kind === 'r' || hex.kind === 'c') { if (p.hand.length >= hex.cost) out.push({ type: 'move', to, discardCards: hex.cost, removes: hex.kind === 'c' }); continue; }
          const sym = hex.kind === 'E' ? null : hex.kind;
          const need = hex.kind === 'E' ? 1 : hex.cost;
          if (s.active && s.active.left >= need && (!sym || s.active.sym === sym)) out.push({ type: 'move', to, card: -1 });
          p.hand.forEach((k, card) => { const t = TYPE[k]!; if (t.native || (t.pts >= need && (!sym || t.sym === sym || t.sym === 'any'))) out.push({ type: 'move', to, card }); });
        }
      }
      if (!s.bought) out.push({ type: 'buy', coins: coinValue(p.hand) });
      p.hand.forEach((k, card) => { if (TYPE[k]!.draw || TYPE[k]!.trash) out.push({ type: 'use', card }); });
      out.push({ type: 'endTurn' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const t = edModule.apply(s, { kind: 'player', seat }, { type: 'endTurn', discard: [] }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 3,
    options: { deal: 'tutorial' },
    introFa: 'نزدیک پایان یک مسابقهٔ دونفره هستید و حریف دو خانه با الدورادو فاصله دارد (حریف آموزشی فقط نوبتش را تمام می‌کند). با کارت‌های دستتان حرکت می‌کنید: کارت سبز (قمه) برای جنگل، آبی (پارو) برای آب و زرد (سکه) برای روستا؛ عدد هر خانه هزینهٔ ورود به آن است. در این آموزش از آب، دو جنگل و آوار می‌گذرید و به شهر طلایی می‌رسید.',
    steps: [
      { instructionFa: 'کارت «ناخدا» (۳ پارو) را انتخاب کنید و وارد خانهٔ آبی با هزینهٔ ۲ شوید. هر خانه فقط با کارت هم‌رنگش پرداخت می‌شود؛ ۱ پاروی باقی‌مانده فقط در آب بعدی به کار می‌آمد.', expected: { type: 'move', to: TUTORIAL_HEX.water, card: 0 }, reply: null },
      { instructionFa: 'حالا «پیشاهنگ» (۲ قمه) را انتخاب کنید و وارد جنگل با هزینهٔ ۱ شوید. با بازی کارت تازه، باقی‌ماندهٔ ناخدا از دست می‌رود و ۱ قمه از پیشاهنگ می‌ماند.', expected: { type: 'move', to: TUTORIAL_HEX.jungle1, card: 0 }, reply: null },
      { instructionFa: 'امتیاز یک کارت را می‌شود میان چند خانهٔ پشت‌سرهمِ همان رنگ خرج کرد: با ۱ قمهٔ باقی‌ماندهٔ پیشاهنگ وارد جنگل بعدی (هزینهٔ ۱) شوید. ولی دو کارت را هیچ‌وقت برای یک خانه روی هم نمی‌گذارید.', expected: { type: 'move', to: TUTORIAL_HEX.jungle2, card: -1 }, reply: null },
      { instructionFa: 'در هر نوبت یک بار می‌توانید از بازار بخرید: هر کارت زرد به اندازهٔ عددش سکه است و هر کارت دیگر نیم سکه. با دو مسافر (۲ سکه) «عکاس» را بخرید. کارت خریده‌شده به دورریزتان می‌رود و وقتی دسته تمام شود با بُر خوردن دورریز به دستتان می‌آید.', expected: { type: 'buy', key: 'photographer', pay: [0, 1] }, reply: null },
      { instructionFa: 'نوبت را تمام کنید. در پایان نوبت هر کارتی را بخواهید نگه می‌دارید یا دور می‌ریزید و دستتان از دسته تا ۴ کارت پر می‌شود. حریف هم نوبتش را تمام می‌کند.', expected: { type: 'endTurn', discard: [] }, reply: { type: 'endTurn', discard: [] } },
      { instructionFa: 'خانهٔ آوار با کارت حرکت پرداخت نمی‌شود: باید به اندازهٔ عددش کارت دور بریزید. زیر کارت «ملوان» (پارو این‌جا به کاری نمی‌آید) «برای آوار» را بزنید و بعد وارد آوار شوید.', expected: { type: 'move', to: TUTORIAL_HEX.rubble, card: -1, pay: [0] }, reply: null },
      { instructionFa: 'خانه‌های الدورادو با هر کارتی که دست‌کم ۱ امتیاز داشته باشد، از هر رنگ، پر می‌شوند. «کاوشگر» را انتخاب کنید و وارد الدورادو شوید.', expected: { type: 'move', to: TUTORIAL_HEX.goal, card: 0 }, reply: null },
      { instructionFa: 'نوبت را تمام کنید. رسیدن به الدورادو پایان بازی را اعلام می‌کند، ولی دور تا رسیدن نوبت به نفر اول کامل بازی می‌شود تا بقیه هم فرصت رسیدن داشته باشند.', expected: { type: 'endTurn', discard: [] }, reply: { type: 'endTurn', discard: [] } }
    ],
    completedFa: 'بردید! وقتی نوبت به نفر اول برگشت بازی تمام شد: شما در الدورادو هستید (فاصلهٔ ۰) و حریف ۲ خانه با شهر فاصله داشت. همهٔ کسانی که رسیده باشند با هم اول می‌شوند و بقیه به ترتیب فاصله تا الدورادو رتبه می‌گیرند. در بازی واقعی اردوگاه‌ها (حذف همیشگی کارت‌های ضعیف از دسته) و کارت‌های کشیدن مثل نقشه‌کش و دانشمند را هم امتحان کنید.'
  }
};
