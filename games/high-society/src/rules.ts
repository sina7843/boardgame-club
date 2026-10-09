// High Society («اشرافی»). Money cards per player: 1 2 3 4 6 8 10 12 15 20 25. Status deck (16): luxury 1–10,
// prestige ×3 (status ×2), passé (−5), scandal (status ½), faux pas (lose a luxury). Prestige and scandal have red
// frames; the game ends at once when the fourth red card is turned (it is not auctioned).
// Auctions: in turn, raise by adding money cards (your total must beat the high bid) or pass (take your bid back).
// Normal cards go to the last bidder standing, who pays. Disgrace cards (passé, scandal, faux pas) go to the first
// player who passes, who takes their money back; everyone else pays what they bid. The winner / taker starts the next
// auction. Faux pas discards your lowest luxury card (always the best choice), or the next one you win.
// End: the poorest player(s) are out; among the rest the highest status wins (tie: more money, then the highest
// luxury card). Hidden: hands, the deck. Bids, spent money and won cards are public.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { highSociety } from './definition.ts';

export type StatusCard = `l${number}` | 'prestige' | 'passe' | 'scandal' | 'faux';
export const MONEY = [1, 2, 3, 4, 6, 8, 10, 12, 15, 20, 25];
export const isDisgrace = (c: StatusCard) => c === 'passe' || c === 'scandal' || c === 'faux';
export const isRed = (c: StatusCard) => c === 'prestige' || c === 'scandal';
export const lux = (c: StatusCard) => (c.startsWith('l') ? Number(c.slice(1)) : 0);

export interface HighSocietyState {
  players: number;
  deck: StatusCard[];
  card: StatusCard | null;
  red: number;
  hands: number[][];
  bids: number[][];
  spent: number[][];
  passed: boolean[];
  current: number;
  won: StatusCard[][];
  faux: boolean[];
  last: { seat: number; card: StatusCard; paid: number; lost?: StatusCard } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface HighSocietyView {
  players: number;
  hand: number[] | null;
  handCount: number[];
  bids: number[][];
  spent: number[][];
  card: StatusCard | null;
  red: number;
  deckCount: number;
  passed: boolean[];
  current: number | null;
  high: number;
  won: StatusCard[][];
  faux: boolean[];
  /** Final money per player (only at the end). */
  money: number[] | null;
  last: HighSocietyState['last'];
  seq: number;
  outcome: Outcome | null;
}

export const highSocietyAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bid'), cards: z.array(z.number().int().min(1).max(25)).min(1).max(11) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type HighSocietyAction = z.infer<typeof highSocietyAction>;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const high = (s: HighSocietyState) => Math.max(0, ...s.bids.map(sum));
function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export function status(won: StatusCard[]) {
  let v = sum(won.map(lux)) - 5 * won.filter((c) => c === 'passe').length;
  v *= 2 ** won.filter((c) => c === 'prestige').length;
  v /= 2 ** won.filter((c) => c === 'scandal').length;
  return v;
}

// ---------- module ----------

type Events = Transition<HighSocietyState>['internalEvents'];
const finish = (s: HighSocietyState, events: Events): Transition<HighSocietyState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: HighSocietyState, seats: number[]): Outcome['placements'] {
  const money = (k: number) => sum(s.hands[k]!) + sum(s.bids[k]!);
  const poorest = Math.min(...seats.map(money));
  const allPoor = seats.every((k) => money(k) === poorest);
  const key = (k: number) => [allPoor || money(k) > poorest ? 1 : 0, status(s.won[k]!), money(k), Math.max(0, ...s.won[k]!.map(lux))];
  const r = seats.map((seat) => ({ seat, k: key(seat) })).sort((a, b) => b.k[0]! - a.k[0]! || b.k[1]! - a.k[1]! || b.k[2]! - a.k[2]! || b.k[3]! - a.k[3]!);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => {
    const prev = r[i - 1];
    out.push({ seat: x.seat, place: prev && prev.k.every((v, j) => v === x.k[j]) ? out[i - 1]!.place : i + 1, score: status(s.won[x.seat]!) });
  });
  return out;
}

function reveal(s: HighSocietyState) {
  s.bids = s.bids.map(() => []);
  s.passed = Array(s.players).fill(false);
  const c = s.deck.shift();
  if (c && isRed(c)) s.red += 1;
  if (!c || s.red >= 4) {
    s.card = c ?? null;
    s.outcome = { placements: rank(s, s.hands.map((_, k) => k)), reason: 'score' };
    return;
  }
  s.card = c;
}

/** Adds a won card. Faux pas discards the lowest luxury (or the next luxury won); returns the discarded card. */
function gain(s: HighSocietyState, seat: number, c: StatusCard): StatusCard | undefined {
  const won = s.won[seat]!;
  if (lux(c) && s.faux[seat]) { s.faux[seat] = false; return c; }
  won.push(c);
  if (c !== 'faux') return undefined;
  const l = won.filter((x) => lux(x) > 0).sort((x, y) => lux(x) - lux(y))[0];
  if (!l) { s.faux[seat] = true; return undefined; }
  won.splice(won.indexOf(l), 1);
  return l;
}

function award(s: HighSocietyState, seat: number) {
  const c = s.card!;
  const disgrace = isDisgrace(c);
  let paid = 0;
  s.bids.forEach((b, k) => {
    if ((disgrace && k !== seat) || (!disgrace && k === seat)) { s.spent[k]!.push(...b); if (k === seat) paid = sum(b); }
    else s.hands[k]!.push(...b);
  });
  s.hands.forEach((h) => h.sort((a, b) => a - b));
  const lost = gain(s, seat, c);
  s.last = { seat, card: c, paid, ...(lost ? { lost } : {}) };
  s.current = seat;
  s.seq += 1;
  reveal(s);
}

function nextBidder(s: HighSocietyState) {
  for (let k = 1; k <= s.players; k++) { const n = (s.current + k) % s.players; if (!s.passed[n]) { s.current = n; return; } }
}

function pass(s: HighSocietyState, seat: number) {
  if (isDisgrace(s.card!)) { award(s, seat); return; }
  s.passed[seat] = true;
  s.hands[seat]!.push(...s.bids[seat]!);
  s.hands[seat]!.sort((a, b) => a - b);
  s.bids[seat] = [];
  s.seq += 1;
  const left = s.passed.map((p, k) => (p ? -1 : k)).filter((k) => k >= 0);
  if (left.length === 1) award(s, left[0]!);
  else nextBidder(s);
}

export const highSocietyModule: GameModule<HighSocietyState, HighSocietyAction, HighSocietyView> = {
  manifest: highSociety.manifest,
  actionSchema: highSocietyAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('high society needs 2–5 players');
    const deck: StatusCard[] = [...Array.from({ length: 10 }, (_, k) => `l${k + 1}` as StatusCard), 'prestige', 'prestige', 'prestige', 'passe', 'scandal', 'faux'];
    const s: HighSocietyState = {
      players: playerCount, deck: shuffle(rng, deck), card: null, red: 0,
      hands: Array.from({ length: playerCount }, () => MONEY.slice()), bids: Array.from({ length: playerCount }, () => []),
      spent: Array.from({ length: playerCount }, () => []), passed: [], current: rng.nextInt(playerCount),
      won: Array.from({ length: playerCount }, () => []), faux: Array(playerCount).fill(false), last: null, seq: 0,
      timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // Late game, two prestige cards already out. Auctions: the yacht (9), the third prestige, a passé; the scandal
      // that follows is the fourth red card and ends the game. The rival has more status but less money.
      s.deck = ['l9', 'prestige', 'passe', 'scandal'];
      s.red = 2;
      s.current = 0;
      s.hands = [[1, 2, 6, 10, 12], [3, 4, 15]];
      s.spent = s.hands.map((h) => MONEY.filter((m) => !h.includes(m)));
      s.won = [['l5', 'prestige'], ['l7', 'l8', 'prestige']];
    }
    reveal(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'pass') return { ok: true };
    const hand = s.hands[actor.seat]!.slice();
    for (const c of a.cards) { const i = hand.indexOf(c); if (i < 0) return { ok: false, errorCode: 'NOT_IN_HAND' }; hand.splice(i, 1); }
    return sum(s.bids[actor.seat]!) + sum(a.cards) > high(s) ? { ok: true } : { ok: false, errorCode: 'BID_TOO_LOW' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.hands.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: status(s.won[seat]!) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'pass') pass(s, seat);
    else {
      for (const c of a.cards) s.hands[seat]!.splice(s.hands[seat]!.indexOf(c), 1);
      s.bids[seat]!.push(...a.cards);
      s.bids[seat]!.sort((x, y) => x - y);
      s.seq += 1;
      s.last = null;
      nextBidder(s);
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, handCount: s.hands.map((h) => h.length),
      bids: s.bids.map((b) => b.slice()), spent: s.spent.map((b) => b.slice()), card: s.card, red: s.red, deckCount: s.deck.length,
      passed: s.passed.slice(), current: s.outcome ? null : s.current, high: high(s), won: s.won.map((w) => w.slice()), faux: s.faux.slice(),
      money: s.outcome ? s.hands.map((h, k) => sum(h) + sum(s.bids[k]!)) : null, last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      const need = high(s) + 1 - sum(s.bids[seat]!);
      if (sum(s.hands[seat]!) >= need) out.push({ type: 'bid', need });
      out.push({ type: 'pass' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    s.timeouts[s.current]! += 1;
    pass(s, s.current);
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 23,
    options: { deal: 'tutorial' },
    introFa: 'آخر بازی است. شما «عطر» (۵) و یک «افتخار» (×۲) دارید؛ حریف «پیانو» (۷)، «اسب» (۸) و یک افتخار. دو کارت قاب‌قرمز رو شده و وقتی چهارمی رو شود بازی بلافاصله تمام می‌شود. هر دور یک کارت مزایده می‌شود: به نوبت اسکناس اضافه می‌کنید تا جمع پیشنهادتان از بالاترین پیشنهاد بیشتر شود، یا کنار می‌کشید. اسکناس‌ها خرد نمی‌شوند و هر پولی خرج شود دیگر برنمی‌گردد.',
    steps: [
      { instructionFa: '«قایق» (۹) روی میز است و شما شروع می‌کنید. اسکناس ۲ را انتخاب کنید و «پیشنهاد» بدهید.', expected: { type: 'bid', cards: [2] }, reply: { type: 'bid', cards: [3] } },
      { instructionFa: 'حریف ۳ پیشنهاد داد. قایق ارزش جنگیدن ندارد؛ پول آخر بازی مهم است. «کنار می‌کشم» را بزنید: اسکناس ۲ به دستتان برمی‌گردد و حریف که آخرین نفر مانده، ۳ را می‌پردازد و قایق را می‌برد.', expected: { type: 'pass' }, reply: { type: 'bid', cards: [4] } },
      { instructionFa: 'برندهٔ هر مزایده مزایدهٔ بعدی را شروع می‌کند: حریف روی کارت «افتخار» (قاب‌قرمز سوم) ۴ پیشنهاد داد. افتخار کل امتیاز شما را دو برابر می‌کند. اسکناس ۶ را بگذارید تا پیشنهادتان ۶ شود.', expected: { type: 'bid', cards: [6] }, reply: { type: 'pass' } },
      { instructionFa: 'حریف کنار کشید و افتخار را با ۶ بردید. حالا «از مد افتاده» (۵−) آمده؛ کارت بد برعکس مزایده می‌شود: اولین کسی که کنار بکشد کارت را می‌گیرد ولی پولش برمی‌گردد و بقیه هر چه گذاشته‌اند می‌پردازند. اسکناس ۱ را پیشنهاد بدهید تا حریف مجبور شود بیشتر بدهد یا کارت را بگیرد.', expected: { type: 'bid', cards: [1] }, reply: { type: 'pass' } }
    ],
    completedFa: 'بردید! حریف کنار کشید و «از مد افتاده» را گرفت؛ شما ۱ پرداختید. کارت بعدی «رسوایی» چهارمین کارت قاب‌قرمز بود و بازی همان لحظه تمام شد. حساب پول: شما ۲۴ (۲ + ۱۰ + ۱۲) و حریف ۱۹ (۴ + ۱۵). امتیاز حریف بیشتر بود: (۷ + ۸ + ۹ − ۵) × ۲ = ۳۸ در برابر ۵ × ۲ × ۲ = ۲۰ برای شما؛ ولی کم‌پول‌ترین بازیکن کنار می‌رود و فقط بقیه با امتیاز مقایسه می‌شوند.'
  }
};
