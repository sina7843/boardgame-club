// «املاک» rules — classic property trading (Monopoly-style): 2–8 players, two dice rolled by the server, buy or
// auction, rent, even building with a limited bank of houses/hotels, mortgages (10% interest), Chance/Chest cards,
// jail, multi-party debts, bankruptcy and player-to-player trades. Money is in units of 1,000 toman. All state is public
// except the order of the two card decks.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { amlak } from './definition.ts';
import {
  BAIL, BOARD, CHANCE, CHEST, HOTELS, HOUSES, JAIL, SALARY, START_CASH, STATION_RENT,
  cardById, groupMembers, groupOf, isOwnable, priceOf, type CardEffect, type Group
} from './board.ts';

const MAX_TIMEOUTS = 3;
const LOG_SIZE = 40;
const BANK = -1;
const POT = -2;

export interface Player { cash: number; pos: number; inJail: boolean; jailTurns: number; jailCards: string[]; bankrupt: boolean }
export interface Debt { seat: number; amount: number; to: number; why: string }
export interface TradeSide { cash: number; props: number[]; cards: string[] }
export interface Trade { from: number; to: number; give: TradeSide; get: TradeSide }
export interface Auction { sq: number; high: number; leader: number | null; seats: number[]; turn: number }

export type LogEntry =
  | { t: 'roll'; seat: number; dice: [number, number]; jail?: 'out' | 'stay' | 'forced' }
  | { t: 'move'; seat: number; to: number; salary: number }
  | { t: 'buy'; seat: number; sq: number; price: number }
  | { t: 'decline'; seat: number; sq: number }
  | { t: 'bid'; seat: number; amount: number }
  | { t: 'auctionPass'; seat: number }
  | { t: 'auctionWon'; seat: number | null; sq: number; price: number }
  | { t: 'pay'; seat: number; to: number; amount: number; why: string }
  | { t: 'collect'; seat: number; amount: number; why: string }
  | { t: 'card'; seat: number; card: string }
  | { t: 'jail'; seat: number; why: 'square' | 'card' | 'doubles' }
  | { t: 'leaveJail'; seat: number; how: 'bail' | 'card' | 'doubles' }
  | { t: 'build'; seat: number; sq: number; houses: number }
  | { t: 'sell'; seat: number; sq: number; houses: number }
  | { t: 'mortgage'; seat: number; sq: number; on: boolean }
  | { t: 'trade'; from: number; to: number; accepted: boolean | null }
  | { t: 'bankrupt'; seat: number; to: number }
  | { t: 'turn'; seat: number; round: number }
  | { t: 'timeout'; seat: number };

export interface AmlakState {
  players: number;
  order: number[];
  p: Player[];
  owner: (number | null)[];
  houses: number[]; // 0–4 houses, 5 = hotel
  mortgaged: boolean[];
  housesLeft: number;
  hotelsLeft: number;
  current: number;
  phase: 'roll' | 'buy' | 'auction' | 'debt' | 'end';
  doubles: number;
  rolledDouble: boolean;
  lastRoll: [number, number] | null;
  auction: Auction | null;
  debts: Debt[];
  /** Movement waiting for a debt to be settled (third failed jail roll: pay the fine, then move). */
  resume: { steps: number } | null;
  trade: Trade | null;
  chance: string[];
  chest: string[];
  lastCard: { seat: number; card: string } | null;
  pot: number;
  rules: { freeParking: boolean; auction: boolean; doubleGo: boolean; rounds: number | null };
  round: number;
  eliminated: number[];
  timeouts: number[];
  script: [number, number][];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

const sideSchema = z.strictObject({
  cash: z.number().int().min(0).max(100_000),
  props: z.array(z.number().int().min(0).max(39)).max(28),
  cards: z.array(z.string().max(20)).max(2)
});
const sq = z.number().int().min(0).max(39);
export const amlakAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('payBail') }),
  z.strictObject({ type: z.literal('useCard') }),
  z.strictObject({ type: z.literal('buy') }),
  z.strictObject({ type: z.literal('decline') }),
  z.strictObject({ type: z.literal('bid'), amount: z.number().int().min(1).max(100_000) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('build'), sq }),
  z.strictObject({ type: z.literal('sell'), sq }),
  z.strictObject({ type: z.literal('mortgage'), sq }),
  z.strictObject({ type: z.literal('unmortgage'), sq }),
  z.strictObject({ type: z.literal('offer'), to: z.number().int().min(0).max(7), give: sideSchema, get: sideSchema }),
  z.strictObject({ type: z.literal('acceptTrade') }),
  z.strictObject({ type: z.literal('rejectTrade') }),
  z.strictObject({ type: z.literal('bankrupt') }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type AmlakAction = z.infer<typeof amlakAction>;
export type AmlakView = Omit<AmlakState, 'chance' | 'chest' | 'script' | 'timeouts' | 'seq'> & { deckCounts: { chance: number; chest: number } };

// ---------- helpers ----------

function log(s: AmlakState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}
function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const alive = (s: AmlakState) => s.order.filter((seat) => !s.p[seat]!.bankrupt);
export const ownsGroup = (s: AmlakState, seat: number, g: Group) => groupMembers(g).every((i) => s.owner[i] === seat);
const groupBuilt = (s: AmlakState, g: Group) => groupMembers(g).some((i) => s.houses[i]! > 0);
const buildCost = (i: number) => { const b = BOARD[i]!; return b.kind === 'street' ? b.house : 0; };
export const unmortgageCost = (i: number) => Math.ceil((priceOf(i) / 2) * 11 / 10); // integer math (1.1 is not exact)

/** Cash a player could raise right now: sell every building (half price), then mortgage everything (half price). */
export function liquidation(s: AmlakState, seat: number): number {
  let v = 0;
  for (let i = 0; i < 40; i++) {
    if (s.owner[i] !== seat) continue;
    v += (s.houses[i]! * buildCost(i)) / 2;
    if (!s.mortgaged[i]) v += priceOf(i) / 2;
  }
  return Math.floor(v);
}
/** Net worth for ranking: cash + property value (half if mortgaged) + buildings at cost. */
export function netWorth(s: AmlakState, seat: number): number {
  let v = s.p[seat]!.cash;
  for (let i = 0; i < 40; i++) if (s.owner[i] === seat) v += (s.mortgaged[i] ? priceOf(i) / 2 : priceOf(i)) + s.houses[i]! * buildCost(i);
  return Math.floor(v);
}

export function rentFor(s: AmlakState, i: number, diceTotal: number, mod: 'station2' | 'utility10' | null = null): number {
  const owner = s.owner[i]!;
  const b = BOARD[i]!;
  if (b.kind === 'street') {
    const h = s.houses[i]!;
    return h === 0 ? b.rents[0] * (ownsGroup(s, owner, b.group) ? 2 : 1) : b.rents[h]!;
  }
  if (b.kind === 'station') {
    const n = BOARD.filter((x, j) => x.kind === 'station' && s.owner[j] === owner).length;
    return STATION_RENT[n]! * (mod === 'station2' ? 2 : 1);
  }
  const n = BOARD.filter((x, j) => x.kind === 'utility' && s.owner[j] === owner).length;
  return diceTotal * (mod === 'utility10' || n === 2 ? 10 : 4);
}

const owe = (s: AmlakState, seat: number, to: number, amount: number, why: string) => { if (amount > 0) s.debts.push({ seat, amount, to, why }); };
const fee = (s: AmlakState) => (s.rules.freeParking ? POT : BANK);
function collect(s: AmlakState, seat: number, amount: number, why: string) {
  s.p[seat]!.cash += amount;
  log(s, { t: 'collect', seat, amount, why });
}

function dice(s: AmlakState, rng: EngineRng): [number, number] {
  return s.script.length ? s.script.shift()! : [1 + rng.nextInt(6), 1 + rng.nextInt(6)];
}

function sendToJail(s: AmlakState, seat: number, why: 'square' | 'card' | 'doubles') {
  const p = s.p[seat]!;
  p.pos = JAIL; p.inJail = true; p.jailTurns = 0;
  s.rolledDouble = false;
  log(s, { t: 'jail', seat, why });
}

function moveTo(s: AmlakState, seat: number, to: number, collectGo: boolean, rng: EngineRng, mod: 'station2' | 'utility10' | null = null) {
  const p = s.p[seat]!;
  let salary = 0;
  if (collectGo && to <= p.pos && to !== p.pos) salary = SALARY;
  if (collectGo && to === 0 && s.rules.doubleGo) salary = SALARY * 2;
  p.pos = to;
  if (salary) p.cash += salary;
  log(s, { t: 'move', seat, to, salary });
  land(s, seat, rng, mod);
}
const moveBy = (s: AmlakState, seat: number, steps: number, rng: EngineRng) => moveTo(s, seat, (s.p[seat]!.pos + steps) % 40, true, rng);

function land(s: AmlakState, seat: number, rng: EngineRng, mod: 'station2' | 'utility10' | null = null) {
  const i = s.p[seat]!.pos;
  const b = BOARD[i]!;
  if (isOwnable(i)) {
    const owner = s.owner[i];
    if (owner === null) { s.phase = 'buy'; return; }
    if (owner === seat || s.mortgaged[i]) return;
    let total = s.lastRoll ? s.lastRoll[0] + s.lastRoll[1] : 7;
    if (mod === 'utility10') { const d = dice(s, rng); total = d[0] + d[1]; log(s, { t: 'roll', seat, dice: d }); }
    owe(s, seat, owner!, rentFor(s, i, total, mod), 'rent');
    return;
  }
  switch (b.kind) {
    case 'tax': owe(s, seat, fee(s), b.amount, 'tax'); return;
    case 'chance': case 'chest': drawCard(s, seat, b.kind, rng); return;
    case 'goToJail': sendToJail(s, seat, 'square'); return;
    case 'parking': if (s.rules.freeParking && s.pot > 0) { collect(s, seat, s.pot, 'parking'); s.pot = 0; } return;
    default: return;
  }
}

function drawCard(s: AmlakState, seat: number, deck: 'chance' | 'chest', rng: EngineRng) {
  const id = s[deck].shift()!;
  s.lastCard = { seat, card: id };
  log(s, { t: 'card', seat, card: id });
  const e: CardEffect = cardById(id).effect;
  if (e.kind === 'jailFree') { s.p[seat]!.jailCards.push(id); return; }
  s[deck].push(id);
  const p = s.p[seat]!;
  switch (e.kind) {
    case 'advance': moveTo(s, seat, e.to, e.collectGo, rng); return;
    case 'nearest': {
      let to = p.pos;
      do to = (to + 1) % 40; while (BOARD[to]!.kind !== e.type);
      moveTo(s, seat, to, true, rng, e.type === 'station' ? 'station2' : 'utility10');
      return;
    }
    case 'back': moveTo(s, seat, (p.pos + 40 - e.steps) % 40, false, rng); return;
    case 'jail': sendToJail(s, seat, 'card'); return;
    case 'money': if (e.amount > 0) collect(s, seat, e.amount, 'card'); else owe(s, seat, fee(s), -e.amount, 'card'); return;
    case 'eachPlayer':
      for (const other of alive(s)) {
        if (other === seat) continue;
        if (e.amount > 0) owe(s, other, seat, e.amount, 'card'); else owe(s, seat, other, -e.amount, 'card');
      }
      return;
    case 'repairs': {
      let n = 0;
      for (let i = 0; i < 40; i++) if (s.owner[i] === seat) n += s.houses[i] === 5 ? e.hotel : s.houses[i]! * e.house;
      owe(s, seat, fee(s), n, 'card');
    }
  }
}

function rank(s: AmlakState): Outcome['placements'] {
  const live = alive(s).map((seat) => ({ seat, w: netWorth(s, seat) }));
  const out: Outcome['placements'] = live.map((x) => ({ seat: x.seat, place: 1 + live.filter((o) => o.w > x.w).length }));
  let place = live.length + 1;
  for (const seat of [...s.eliminated].reverse()) out.push({ seat, place: place++ });
  return out;
}

function bankrupt(s: AmlakState, seat: number, to: number) {
  const p = s.p[seat]!;
  // Buildings go back to the bank at half price.
  for (let i = 0; i < 40; i++) {
    if (s.owner[i] !== seat || !s.houses[i]) continue;
    p.cash += (s.houses[i]! * buildCost(i)) / 2;
    if (s.houses[i] === 5) s.hotelsLeft += 1; else s.housesLeft += s.houses[i]!;
    s.houses[i] = 0;
  }
  p.cash = Math.floor(p.cash);
  if (to >= 0) {
    s.p[to]!.cash += p.cash;
    for (let i = 0; i < 40; i++) if (s.owner[i] === seat) s.owner[i] = to;
    s.p[to]!.jailCards.push(...p.jailCards);
  } else {
    if (to === POT) s.pot += p.cash;
    for (let i = 0; i < 40; i++) if (s.owner[i] === seat) { s.owner[i] = null; s.mortgaged[i] = false; }
    for (const c of p.jailCards) (c.startsWith('ch') ? s.chance : s.chest).push(c);
  }
  p.cash = 0; p.jailCards = []; p.bankrupt = true;
  s.eliminated.push(seat);
  s.debts = s.debts.filter((d) => d.seat !== seat).map((d) => (d.to === seat ? { ...d, to: BANK } : d));
  if (s.trade && (s.trade.from === seat || s.trade.to === seat)) s.trade = null;
  log(s, { t: 'bankrupt', seat, to });
  if (alive(s).length === 1) s.outcome = { reason: 'win', placements: rank(s) };
}

function pay(s: AmlakState, d: Debt) {
  s.p[d.seat]!.cash -= d.amount;
  if (d.to >= 0) s.p[d.to]!.cash += d.amount;
  if (d.to === POT) s.pot += d.amount;
  log(s, { t: 'pay', seat: d.seat, to: d.to, amount: d.amount, why: d.why });
}

/** Settle debts (automatically when cash allows), resume pending movement, then decide what the turn does next. */
function flow(s: AmlakState, rng: EngineRng) {
  for (let guard = 0; guard < 200 && !s.outcome; guard++) {
    while (s.debts.length && !s.outcome) {
      const d = s.debts[0]!;
      const p = s.p[d.seat]!;
      if (p.cash >= d.amount) { pay(s, d); s.debts.shift(); continue; }
      // Even selling everything would not cover it: bankrupt now (nothing to decide).
      if (p.cash + liquidation(s, d.seat) < d.amount) { bankrupt(s, d.seat, d.to); continue; }
      s.phase = 'debt';
      return;
    }
    if (s.outcome) return;
    if (s.resume) {
      const { steps } = s.resume;
      s.resume = null;
      if (!s.p[s.current]!.bankrupt) moveBy(s, s.current, steps, rng);
      if (s.phase === 'buy') return;
      continue;
    }
    break;
  }
  if (s.outcome || s.phase === 'buy' || s.phase === 'auction') return;
  if (s.p[s.current]!.bankrupt) { nextTurn(s); return; }
  s.phase = s.rolledDouble && !s.p[s.current]!.inJail ? 'roll' : 'end';
}

function nextTurn(s: AmlakState) {
  const live = alive(s);
  if (live.length <= 1) return;
  const idx = s.order.indexOf(s.current);
  let k = idx;
  let wrapped = false;
  do { k = (k + 1) % s.order.length; if (k === 0) wrapped = true; } while (s.p[s.order[k]!]!.bankrupt);
  if (wrapped) {
    s.round += 1;
    if (s.rules.rounds !== null && s.round > s.rules.rounds) { s.outcome = { reason: 'score', placements: rank(s) }; return; }
  }
  s.current = s.order[k]!;
  s.phase = 'roll';
  s.doubles = 0;
  s.rolledDouble = false;
  log(s, { t: 'turn', seat: s.current, round: s.round });
}

function startAuction(s: AmlakState, i: number) {
  const live = alive(s);
  const from = live.indexOf(s.current);
  const seats = [...live.slice(from), ...live.slice(0, from)];
  s.auction = { sq: i, high: 0, leader: null, seats, turn: seats[0]! };
  s.phase = 'auction';
}
/** Ends the auction when nobody is left or only the leader remains; otherwise `turn` is already the next bidder. */
function auctionCheck(s: AmlakState, rng: EngineRng) {
  const a = s.auction!;
  if (a.seats.length && !(a.leader !== null && a.seats.length === 1 && a.seats[0] === a.leader)) return;
  if (a.leader !== null) { s.p[a.leader]!.cash -= a.high; s.owner[a.sq] = a.leader; }
  log(s, { t: 'auctionWon', seat: a.leader, sq: a.sq, price: a.high });
  s.auction = null;
  s.phase = 'end';
  flow(s, rng);
}
function auctionBid(s: AmlakState, seat: number, amount: number, rng: EngineRng) {
  const a = s.auction!;
  a.high = amount; a.leader = seat;
  a.turn = a.seats[(a.seats.indexOf(seat) + 1) % a.seats.length]!;
  auctionCheck(s, rng);
}
/** A bidder drops out (pass, resign). */
function auctionLeave(s: AmlakState, seat: number, rng: EngineRng) {
  const a = s.auction!;
  const i = a.seats.indexOf(seat);
  if (i < 0) return;
  a.seats.splice(i, 1);
  if (a.leader === seat) a.leader = null;
  if (a.turn === seat && a.seats.length) a.turn = a.seats[i % a.seats.length]!;
  auctionCheck(s, rng);
}

// ---------- building, mortgages, trades (validation shared with legal hints) ----------

function canBuild(s: AmlakState, seat: number, i: number): string | null {
  const b = BOARD[i]!;
  if (b.kind !== 'street' || s.owner[i] !== seat) return 'NOT_YOURS';
  if (!ownsGroup(s, seat, b.group)) return 'NEED_FULL_GROUP';
  const g = groupMembers(b.group);
  if (g.some((j) => s.mortgaged[j])) return 'GROUP_MORTGAGED';
  const h = s.houses[i]!;
  if (h >= 5) return 'MAX_BUILT';
  if (h > Math.min(...g.map((j) => s.houses[j]!))) return 'BUILD_EVENLY';
  if (h === 4 ? s.hotelsLeft < 1 : s.housesLeft < 1) return 'NO_BUILDINGS_LEFT';
  if (s.p[seat]!.cash < b.house) return 'NOT_ENOUGH_CASH';
  return null;
}
function canSell(s: AmlakState, seat: number, i: number): string | null {
  const b = BOARD[i]!;
  if (b.kind !== 'street' || s.owner[i] !== seat || !s.houses[i]) return 'NOTHING_TO_SELL';
  if (s.houses[i]! < Math.max(...groupMembers(b.group).map((j) => s.houses[j]!))) return 'SELL_EVENLY';
  if (s.houses[i] === 5 && s.housesLeft < 4) return 'HOUSE_SHORTAGE';
  return null;
}
function canMortgage(s: AmlakState, seat: number, i: number): string | null {
  if (!isOwnable(i) || s.owner[i] !== seat || s.mortgaged[i]) return 'CANNOT_MORTGAGE';
  const g = groupOf(i);
  if (g && groupBuilt(s, g)) return 'SELL_BUILDINGS_FIRST';
  return null;
}
function canUnmortgage(s: AmlakState, seat: number, i: number): string | null {
  if (s.owner[i] !== seat || !s.mortgaged[i]) return 'NOT_MORTGAGED';
  return s.p[seat]!.cash >= unmortgageCost(i) ? null : 'NOT_ENOUGH_CASH';
}
const tradable = (s: AmlakState, seat: number, i: number) => s.owner[i] === seat && !(groupOf(i) && groupBuilt(s, groupOf(i)!));
function checkSide(s: AmlakState, seat: number, side: TradeSide): string | null {
  if (side.cash > s.p[seat]!.cash) return 'NOT_ENOUGH_CASH';
  if (new Set(side.props).size !== side.props.length || !side.props.every((i) => tradable(s, seat, i))) return 'PROPERTY_NOT_TRADABLE';
  if (new Set(side.cards).size !== side.cards.length || !side.cards.every((c) => s.p[seat]!.jailCards.includes(c))) return 'CARD_NOT_OWNED';
  return null;
}
/** Interest (10%) the receiver pays on mortgaged properties received in a trade. */
const tradeInterest = (s: AmlakState, props: number[]) => props.filter((i) => s.mortgaged[i]).reduce((a, i) => a + Math.ceil(priceOf(i) / 20), 0);
function checkTrade(s: AmlakState, t: Trade): string | null {
  if (t.from === t.to || s.p[t.to]?.bankrupt !== false) return 'INVALID_TRADE_PARTNER';
  const empty = (x: TradeSide) => !x.cash && !x.props.length && !x.cards.length;
  if (empty(t.give) && empty(t.get)) return 'EMPTY_TRADE';
  const e = checkSide(s, t.from, t.give) ?? checkSide(s, t.to, t.get);
  if (e) return e;
  const fromAfter = s.p[t.from]!.cash - t.give.cash + t.get.cash;
  const toAfter = s.p[t.to]!.cash - t.get.cash + t.give.cash;
  if (fromAfter < tradeInterest(s, t.get.props) || toAfter < tradeInterest(s, t.give.props)) return 'CANNOT_PAY_INTEREST';
  return null;
}
function doTrade(s: AmlakState, t: Trade) {
  const move = (from: number, to: number, side: TradeSide) => {
    s.p[from]!.cash -= side.cash; s.p[to]!.cash += side.cash;
    for (const i of side.props) s.owner[i] = to;
    for (const c of side.cards) { s.p[from]!.jailCards.splice(s.p[from]!.jailCards.indexOf(c), 1); s.p[to]!.jailCards.push(c); }
  };
  const interestTo = tradeInterest(s, t.give.props);
  const interestFrom = tradeInterest(s, t.get.props);
  move(t.from, t.to, t.give);
  move(t.to, t.from, t.get);
  s.p[t.to]!.cash -= interestTo;
  s.p[t.from]!.cash -= interestFrom;
}

// ---------- module ----------

const finish = (s: AmlakState, events: Transition<AmlakState>['internalEvents']): Transition<AmlakState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

/** The seat the game waits on: trade partner, auction bidder, debtor, otherwise the current player. */
export function waitingOn(s: AmlakState): number {
  if (s.trade) return s.trade.to;
  if (s.phase === 'auction') return s.auction!.turn;
  if (s.phase === 'debt') return s.debts[0]!.seat;
  return s.current;
}

function validateAction(s: AmlakState, seat: number, a: AmlakAction): string | null {
  const p = s.p[seat]!;
  if (a.type === 'resign') return null;
  if (s.trade) {
    if (a.type === 'acceptTrade') return seat === s.trade.to ? checkTrade(s, s.trade) : 'NOT_YOUR_TURN';
    if (a.type === 'rejectTrade') return seat === s.trade.to ? null : 'NOT_YOUR_TURN';
    return 'TRADE_PENDING';
  }
  if (a.type === 'acceptTrade' || a.type === 'rejectTrade') return 'NO_TRADE';
  if (seat !== waitingOn(s)) return 'NOT_YOUR_TURN';
  const own = s.phase === 'roll' || s.phase === 'end';
  switch (a.type) {
    case 'roll': return s.phase === 'roll' ? null : 'WRONG_PHASE';
    case 'payBail': return s.phase === 'roll' && p.inJail ? (p.cash >= BAIL ? null : 'NOT_ENOUGH_CASH') : 'WRONG_PHASE';
    case 'useCard': return s.phase === 'roll' && p.inJail && p.jailCards.length ? null : 'WRONG_PHASE';
    case 'buy': return s.phase !== 'buy' ? 'WRONG_PHASE' : p.cash >= priceOf(p.pos) ? null : 'NOT_ENOUGH_CASH';
    case 'decline': return s.phase === 'buy' ? null : 'WRONG_PHASE';
    case 'bid': return s.phase !== 'auction' ? 'WRONG_PHASE' : a.amount <= s.auction!.high ? 'BID_TOO_LOW' : a.amount > p.cash ? 'NOT_ENOUGH_CASH' : null;
    case 'pass': return s.phase === 'auction' ? null : 'WRONG_PHASE';
    case 'build': return own ? canBuild(s, seat, a.sq) : 'WRONG_PHASE';
    case 'sell': return own || s.phase === 'debt' ? canSell(s, seat, a.sq) : 'WRONG_PHASE';
    case 'mortgage': return own || s.phase === 'debt' ? canMortgage(s, seat, a.sq) : 'WRONG_PHASE';
    case 'unmortgage': return own ? canUnmortgage(s, seat, a.sq) : 'WRONG_PHASE';
    case 'offer': return own ? checkTrade(s, { from: seat, to: a.to, give: a.give, get: a.get }) : 'WRONG_PHASE';
    case 'bankrupt': return s.phase === 'debt' ? null : 'WRONG_PHASE';
    case 'endTurn': return s.phase === 'end' ? null : 'WRONG_PHASE';
  }
}

function applyAction(s: AmlakState, seat: number, a: AmlakAction, rng: EngineRng) {
  const p = s.p[seat]!;
  switch (a.type) {
    case 'resign': {
      const wasCurrent = s.current === seat;
      bankrupt(s, seat, BANK);
      if (s.outcome) return;
      if (wasCurrent) {
        // Their turn ends: an auction of their square is cancelled (it stays with the bank).
        s.auction = null; s.resume = null;
        s.debts = s.debts.filter((d) => d.seat !== seat);
        nextTurn(s);
        if (s.debts.length) flow(s, rng);
        return;
      }
      if (s.auction) { auctionLeave(s, seat, rng); return; }
      if (s.phase === 'debt') flow(s, rng);
      return;
    }
    case 'roll': {
      const d = dice(s, rng);
      s.lastRoll = d;
      const isDouble = d[0] === d[1];
      if (p.inJail) {
        if (isDouble) {
          p.inJail = false; p.jailTurns = 0; s.rolledDouble = false;
          log(s, { t: 'roll', seat, dice: d, jail: 'out' });
          log(s, { t: 'leaveJail', seat, how: 'doubles' });
          moveBy(s, seat, d[0] + d[1], rng);
        } else if (p.jailTurns >= 2) {
          // Third failed attempt: pay the fine, then move.
          p.inJail = false; p.jailTurns = 0; s.rolledDouble = false;
          log(s, { t: 'roll', seat, dice: d, jail: 'forced' });
          owe(s, seat, BANK, BAIL, 'bail');
          s.resume = { steps: d[0] + d[1] };
        } else {
          p.jailTurns += 1; s.rolledDouble = false;
          log(s, { t: 'roll', seat, dice: d, jail: 'stay' });
        }
        flow(s, rng);
        return;
      }
      log(s, { t: 'roll', seat, dice: d });
      s.rolledDouble = isDouble;
      if (isDouble) s.doubles += 1;
      if (s.doubles === 3) { sendToJail(s, seat, 'doubles'); flow(s, rng); return; }
      moveBy(s, seat, d[0] + d[1], rng);
      flow(s, rng);
      return;
    }
    case 'payBail':
      p.cash -= BAIL; p.inJail = false; p.jailTurns = 0;
      log(s, { t: 'pay', seat, to: BANK, amount: BAIL, why: 'bail' });
      log(s, { t: 'leaveJail', seat, how: 'bail' });
      return;
    case 'useCard': {
      const c = p.jailCards.shift()!;
      (c.startsWith('ch') ? s.chance : s.chest).push(c);
      p.inJail = false; p.jailTurns = 0;
      log(s, { t: 'leaveJail', seat, how: 'card' });
      return;
    }
    case 'buy': {
      const i = p.pos;
      p.cash -= priceOf(i);
      s.owner[i] = seat;
      log(s, { t: 'buy', seat, sq: i, price: priceOf(i) });
      s.phase = 'end';
      flow(s, rng);
      return;
    }
    case 'decline':
      log(s, { t: 'decline', seat, sq: p.pos });
      if (s.rules.auction) { startAuction(s, p.pos); return; }
      s.phase = 'end';
      flow(s, rng);
      return;
    case 'bid':
      log(s, { t: 'bid', seat, amount: a.amount });
      auctionBid(s, seat, a.amount, rng);
      return;
    case 'pass':
      log(s, { t: 'auctionPass', seat });
      auctionLeave(s, seat, rng);
      return;
    case 'build': {
      const i = a.sq;
      p.cash -= buildCost(i);
      if (s.houses[i] === 4) { s.hotelsLeft -= 1; s.housesLeft += 4; } else s.housesLeft -= 1;
      s.houses[i]! += 1;
      log(s, { t: 'build', seat, sq: i, houses: s.houses[i]! });
      return;
    }
    case 'sell':
      sellBuilding(s, seat, a.sq);
      if (s.phase === 'debt') flow(s, rng);
      return;
    case 'mortgage':
      mortgage(s, seat, a.sq);
      if (s.phase === 'debt') flow(s, rng);
      return;
    case 'unmortgage':
      p.cash -= unmortgageCost(a.sq); s.mortgaged[a.sq] = false;
      log(s, { t: 'mortgage', seat, sq: a.sq, on: false });
      return;
    case 'offer':
      s.trade = { from: seat, to: a.to, give: a.give, get: a.get };
      log(s, { t: 'trade', from: seat, to: a.to, accepted: null });
      return;
    case 'acceptTrade': {
      const t = s.trade!;
      doTrade(s, t);
      s.trade = null;
      log(s, { t: 'trade', from: t.from, to: t.to, accepted: true });
      return;
    }
    case 'rejectTrade': {
      const t = s.trade!;
      s.trade = null;
      log(s, { t: 'trade', from: t.from, to: t.to, accepted: false });
      return;
    }
    case 'bankrupt': {
      const d = s.debts[0]!;
      bankrupt(s, seat, d.to);
      flow(s, rng);
      return;
    }
    case 'endTurn':
      nextTurn(s);
      return;
  }
}

function sellBuilding(s: AmlakState, seat: number, i: number) {
  const p = s.p[seat]!;
  p.cash = Math.floor(p.cash + buildCost(i) / 2);
  if (s.houses[i] === 5) { s.hotelsLeft += 1; s.housesLeft -= 4; } else s.housesLeft += 1;
  s.houses[i]! -= 1;
  log(s, { t: 'sell', seat, sq: i, houses: s.houses[i]! });
}
function mortgage(s: AmlakState, seat: number, i: number) {
  s.mortgaged[i] = true;
  s.p[seat]!.cash += priceOf(i) / 2;
  log(s, { t: 'mortgage', seat, sq: i, on: true });
}

/** Raise cash automatically (timeouts): sell buildings (tallest first), then mortgage (cheapest first). */
function autoRaise(s: AmlakState, seat: number, need: number) {
  for (let guard = 0; guard < 200 && s.p[seat]!.cash < need; guard++) {
    const all = BOARD.map((_, i) => i);
    const sell = all.filter((i) => !canSell(s, seat, i)).sort((x, y) => s.houses[y]! - s.houses[x]!)[0];
    if (sell !== undefined) { sellBuilding(s, seat, sell); continue; }
    const m = all.filter((i) => !canMortgage(s, seat, i)).sort((x, y) => priceOf(x) - priceOf(y))[0];
    if (m === undefined) return;
    mortgage(s, seat, m);
  }
}

export const TUTORIAL = { cash: [1500, 5], pos: [0, 4], dice: [[2, 4], [1, 1]] as [number, number][] };

export const amlakModule: GameModule<AmlakState, AmlakAction, AmlakView> = {
  manifest: amlak.manifest,
  actionSchema: amlakAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 8) throw new Error('amlak needs 2–8 players');
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const rounds = options.gameLength === 'rounds20' ? 20 : options.gameLength === 'rounds35' ? 35 : null;
    const s: AmlakState = {
      players: playerCount,
      order: Array.from({ length: playerCount }, (_, i) => (first + i) % playerCount),
      p: Array.from({ length: playerCount }, (_, seat) => ({
        cash: tutorial ? TUTORIAL.cash[seat]! : START_CASH, pos: tutorial ? TUTORIAL.pos[seat]! : 0,
        inJail: false, jailTurns: 0, jailCards: [], bankrupt: false
      })),
      owner: Array<number | null>(40).fill(null),
      houses: Array<number>(40).fill(0),
      mortgaged: Array<boolean>(40).fill(false),
      housesLeft: HOUSES, hotelsLeft: HOTELS,
      current: first, phase: 'roll', doubles: 0, rolledDouble: false, lastRoll: null,
      auction: null, debts: [], resume: null, trade: null,
      chance: shuffle(CHANCE.map((c) => c.id), rng),
      chest: shuffle(CHEST.map((c) => c.id), rng),
      lastCard: null, pot: 0,
      rules: { freeParking: options.freeParking === true, auction: options.auction !== false, doubleGo: options.doubleGo === true, rounds },
      round: 1, eliminated: [],
      timeouts: Array<number>(playerCount).fill(0),
      script: tutorial ? TUTORIAL.dice.map((d) => [...d] as [number, number]) : [],
      log: [], seq: 0, outcome: null
    };
    log(s, { t: 'turn', seat: first, round: 1 });
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (s.p[actor.seat]!.bankrupt) return { ok: false, errorCode: 'NOT_IN_GAME' };
    const e = validateAction(s, actor.seat, a);
    return e ? { ok: false, errorCode: e } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.timeouts[seat] = 0;
    applyAction(s, seat, a, ctx.rng);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { chance, chest, script: _s, timeouts: _t, seq: _q, ...rest } = s;
    void _s; void _t; void _q;
    return { ...structuredClone(rest), deckCounts: { chance: chance.length, chest: chest.length } };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || s.p[viewer.seat]?.bankrupt !== false) return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    const ok = (a: AmlakAction) => !validateAction(s, seat, a);
    for (const type of ['roll', 'payBail', 'useCard', 'buy', 'decline', 'pass', 'bankrupt', 'endTurn', 'acceptTrade', 'rejectTrade'] as const) {
      if (ok({ type } as AmlakAction)) out.push({ type });
    }
    if (s.phase === 'auction' && seat === waitingOn(s) && !s.trade) out.push({ type: 'bid', min: s.auction!.high + 1, max: s.p[seat]!.cash });
    for (let i = 0; i < 40; i++) {
      for (const type of ['build', 'sell', 'mortgage', 'unmortgage'] as const) if (ok({ type, sq: i })) out.push({ type, sq: i });
    }
    if (!s.trade && (s.phase === 'roll' || s.phase === 'end') && seat === s.current) {
      for (const to of alive(s)) if (to !== seat) out.push({ type: 'offer', to });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = waitingOn(s);
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) { applyAction(s, seat, { type: 'resign' }, ctx.rng); return finish(s, [{ type: 'timed-out', seat }]); }
    // Act passively for the absent player until the game waits on someone else (or a new turn starts).
    const turn = s.current;
    for (let guard = 0; guard < 60 && !s.outcome && waitingOn(s) === seat && s.p[seat]!.bankrupt === false; guard++) {
      if (s.trade) { applyAction(s, seat, { type: 'rejectTrade' }, ctx.rng); continue; }
      if (s.phase === 'auction') { applyAction(s, seat, { type: 'pass' }, ctx.rng); continue; }
      if (s.phase === 'debt') {
        autoRaise(s, seat, s.debts[0]!.amount);
        if (s.p[seat]!.cash >= s.debts[0]!.amount) flow(s, ctx.rng); else applyAction(s, seat, { type: 'bankrupt' }, ctx.rng);
        continue;
      }
      if (s.phase === 'buy') { applyAction(s, seat, { type: 'decline' }, ctx.rng); continue; }
      if (s.phase === 'end') { applyAction(s, seat, { type: 'endTurn' }, ctx.rng); break; }
      if (s.phase === 'roll') applyAction(s, seat, { type: 'roll' }, ctx.rng);
      if (s.current !== turn) break;
    }
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [waitingOn(s)]),

  tutorial: {
    seed: 12,
    options: { deal: 'tutorial' },
    introFa: 'شما ۱٫۵ میلیون تومان پول دارید و حریف تقریباً ورشکسته است (۵ هزار تومان). تاس بریزید، ملک بخرید و از او اجاره بگیرید.',
    steps: [
      { instructionFa: 'تاس بریزید (تاس‌ها را سرور می‌ریزد).', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۶ آوردید و روی «میدان خراسان» ایستادید که صاحب ندارد. آن را به قیمت ۱۰۰ هزار تومان بخرید.', expected: { type: 'buy' }, reply: null },
      { instructionFa: 'حالا صاحب ملک هستید؛ هرکس روی آن بایستد به شما اجاره می‌دهد. نوبت را تمام کنید.', expected: { type: 'endTurn' }, reply: { type: 'roll' } }
    ],
    completedFa: 'حریف روی ملک شما ایستاد، نتوانست ۶ هزار تومان اجاره بدهد و ورشکست شد. در بازی واقعی با تکمیل یک رنگ خانه و هتل می‌سازید، رهن می‌گذارید و با دیگران معامله می‌کنید.'
  }
};
