// For Sale («بنگاه»): properties 1–30 and cheques 0,0,2..15 (×2). 3 players drop 6 of each, 4 players 2, 2 players
// (unofficial) 10. Coins: 18 each (5–6 players: 14).
// Buying: each round reveals one property per player. In turn you raise the bid or pass; passing takes the cheapest
// card on the table and refunds half your bid (rounded down). The last bidder pays in full, takes the last card and
// starts the next round. Selling: each round reveals one cheque per player; everyone secretly picks a property, then
// the highest property takes the highest cheque, and so on. Score = cheques + coins left (tie: more coins).
// Hidden: decks, the order of the remaining cards, and properties picked for sale until everyone has picked.
// Coins and card counts are public; properties in hand stay private until the end.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { forSale } from './definition.ts';

export interface ForSaleState {
  players: number;
  props: number[];
  cheques: number[];
  coins: number[];
  owned: number[][];
  won: number[][];
  phase: 'buy' | 'sell' | 'end';
  market: number[];
  bids: number[];
  passed: boolean[];
  current: number;
  chosen: (number | null)[];
  /** Result of the last finished step, for the reveal animation. */
  last: { kind: 'take'; seat: number; card: number; paid: number } | { kind: 'sale'; pairs: { seat: number; prop: number; cheque: number }[] } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface ForSaleView {
  players: number;
  coins: number[];
  /** Own properties (everyone's at the end); others get []. */
  owned: number[][];
  ownedCount: number[];
  won: number[][] | null;
  wonCount: number[];
  phase: ForSaleState['phase'];
  market: number[];
  bids: number[];
  passed: boolean[];
  current: number | null;
  high: number;
  chosen: (number | boolean)[];
  last: ForSaleState['last'];
  propsLeft: number;
  chequesLeft: number;
  seq: number;
  outcome: Outcome | null;
}

export const forSaleAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bid'), amount: z.number().int().min(1).max(18) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('sell'), card: z.number().int().min(1).max(30) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type ForSaleAction = z.infer<typeof forSaleAction>;

const DROP: Record<number, number> = { 2: 10, 3: 6, 4: 2, 5: 0, 6: 0 };
function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const high = (s: ForSaleState) => Math.max(0, ...s.bids);
const take = (deck: number[], n: number) => deck.splice(0, n).sort((a, b) => a - b);
export const score = (s: Pick<ForSaleState, 'won' | 'coins'>, k: number) => s.won[k]!.reduce((a, c) => a + c, 0) + s.coins[k]!;

// ---------- module ----------

type Events = Transition<ForSaleState>['internalEvents'];
const finish = (s: ForSaleState, events: Events): Transition<ForSaleState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: ForSaleState, seats: number[]) {
  const r = seats.map((seat) => ({ seat, sc: score(s, seat), c: s.coins[seat]! })).sort((a, b) => b.sc - a.sc || b.c - a.c);
  const placements: Outcome['placements'] = [];
  r.forEach((x, i) => {
    const prev = r[i - 1];
    placements.push({ seat: x.seat, place: prev && prev.sc === x.sc && prev.c === x.c ? placements[i - 1]!.place : i + 1, score: x.sc });
  });
  return placements;
}

function newBuyRound(s: ForSaleState) {
  s.market = take(s.props, s.players);
  s.bids = Array(s.players).fill(0);
  s.passed = Array(s.players).fill(false);
}
function newSellRound(s: ForSaleState) {
  s.phase = 'sell';
  s.market = take(s.cheques, s.players);
  s.chosen = Array(s.players).fill(null);
}

function nextBidder(s: ForSaleState) {
  for (let k = 1; k <= s.players; k++) { const n = (s.current + k) % s.players; if (!s.passed[n]) { s.current = n; return; } }
}

function pass(s: ForSaleState, seat: number) {
  const card = s.market.shift()!;
  const paid = s.bids[seat]! - Math.floor(s.bids[seat]! / 2);
  s.coins[seat]! -= paid;
  s.owned[seat]!.push(card);
  s.passed[seat] = true;
  s.seq += 1;
  s.last = { kind: 'take', seat, card, paid };
  const left = s.passed.map((p, k) => (p ? -1 : k)).filter((k) => k >= 0);
  if (left.length > 1) { nextBidder(s); return; }
  // The last bidder pays in full for the last card and starts the next round.
  const w = left[0]!;
  const top = s.market.shift()!;
  s.coins[w]! -= s.bids[w]!;
  s.owned[w]!.push(top);
  s.last = { kind: 'take', seat: w, card: top, paid: s.bids[w]! };
  s.current = w;
  if (s.props.length) newBuyRound(s); else newSellRound(s);
}

function sell(s: ForSaleState) {
  const picks = s.chosen.map((card, seat) => ({ seat, card: card! })).sort((a, b) => b.card - a.card);
  const cheques = s.market.slice().sort((a, b) => b - a);
  const pairs = picks.map((p, i) => ({ seat: p.seat, prop: p.card, cheque: cheques[i]! }));
  for (const p of pairs) { s.owned[p.seat] = s.owned[p.seat]!.filter((c) => c !== p.prop); s.won[p.seat]!.push(p.cheque); }
  s.seq += 1;
  s.last = { kind: 'sale', pairs };
  if (s.cheques.length) { newSellRound(s); return; }
  s.phase = 'end';
  s.market = [];
  s.outcome = { placements: rank(s, s.coins.map((_, k) => k)), reason: 'score' };
}

export const forSaleModule: GameModule<ForSaleState, ForSaleAction, ForSaleView> = {
  manifest: forSale.manifest,
  actionSchema: forSaleAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('for sale needs 2–6 players');
    const drop = DROP[playerCount]!;
    const props = shuffle(rng, Array.from({ length: 30 }, (_, k) => k + 1)).slice(drop);
    const cheques = shuffle(rng, [0, 0, ...Array.from({ length: 28 }, (_, k) => 2 + (k >> 1))]).slice(drop);
    const s: ForSaleState = {
      players: playerCount, props, cheques, coins: Array(playerCount).fill(playerCount >= 5 ? 14 : 18),
      owned: Array.from({ length: playerCount }, () => []), won: Array.from({ length: playerCount }, () => []),
      phase: 'buy', market: [], bids: [], passed: [], current: rng.nextInt(playerCount), chosen: Array(playerCount).fill(null),
      last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') { s.props = [3, 30]; s.cheques = [0, 15]; s.coins = [5, 5]; s.current = 0; }
    newBuyRound(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (a.type === 'sell') {
      if (s.phase !== 'sell') return { ok: false, errorCode: 'WRONG_PHASE' };
      if (s.chosen[seat] !== null) return { ok: false, errorCode: 'ALREADY_CHOSEN' };
      return s.owned[seat]!.includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_OWNED' };
    }
    if (s.phase !== 'buy') return { ok: false, errorCode: 'WRONG_PHASE' };
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'bid' && (a.amount <= high(s) || a.amount > s.coins[seat]!)) return { ok: false, errorCode: 'BAD_BID' };
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.phase = 'end';
      s.outcome = { placements: [...rank(s, s.coins.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: score(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'bid') { s.bids[seat] = a.amount; s.seq += 1; s.last = null; nextBidder(s); }
    else if (a.type === 'pass') pass(s, seat);
    else { s.chosen[seat] = a.card; if (s.chosen.every((c) => c !== null)) sell(s); }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, coins: s.coins.slice(), owned: s.owned.map((o, k) => (s.outcome || k === me ? o.slice().sort((a, b) => a - b) : [])), ownedCount: s.owned.map((o) => o.length),
      won: s.outcome ? s.won.map((w) => w.slice()) : me >= 0 ? s.won.map((w, k) => (k === me ? w.slice() : [])) : null,
      wonCount: s.won.map((w) => w.length), phase: s.phase, market: s.market.slice(), bids: s.bids.slice(), passed: s.passed.slice(),
      current: s.phase === 'buy' ? s.current : null, high: high(s),
      chosen: s.chosen.map((c, k) => (k === me ? (c ?? false) : c !== null)), last: s.last ? structuredClone(s.last) : null,
      propsLeft: s.props.length, chequesLeft: s.cheques.length, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'buy' && s.current === seat) {
      if (s.coins[seat]! > high(s)) out.push({ type: 'bid', min: high(s) + 1, max: s.coins[seat]! });
      out.push({ type: 'pass' });
    }
    if (s.phase === 'sell' && s.chosen[seat] === null) for (const card of s.owned[seat]!) out.push({ type: 'sell', card });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    // Passive play: pass in the auction; sell the cheapest property.
    if (s.phase === 'buy') { s.timeouts[s.current]! += 1; pass(s, s.current); }
    else {
      s.chosen.forEach((c, seat) => { if (c === null) { s.timeouts[seat]! += 1; s.chosen[seat] = Math.min(...s.owned[seat]!); } });
      sell(s);
    }
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'buy' ? [s.current] : s.chosen.map((c, k) => (c === null ? k : -1)).filter((k) => k >= 0)),

  tutorial: {
    seed: 21,
    options: { deal: 'tutorial' },
    introFa: 'دو مرحله: اول در مزایده ملک می‌خرید، بعد ملک‌ها را به چک می‌فروشید. سکه‌ها و چک‌ها با هم امتیاز شما هستند. این آموزش فقط یک دور از هر مرحله است.',
    steps: [
      { instructionFa: 'یک کاخ (۳۰) و یک کپر (۳) روی میز است. «پیشنهاد ۱» بدهید.', expected: { type: 'bid', amount: 1 }, reply: { type: 'pass' } },
      { instructionFa: 'حریف کنار کشید و کپر را برداشت؛ کاخ مال شما شد. حالا چک ۱۵ هزاری و چک صفر رو شده: کاخ ۳۰ را بفروشید.', expected: { type: 'sell', card: 30 }, reply: { type: 'sell', card: 3 } }
    ],
    completedFa: 'بردید! بزرگ‌ترین ملک بزرگ‌ترین چک را گرفت: ۱۵ هزار چک به‌علاوه ۴ سکه.'
  }
};
