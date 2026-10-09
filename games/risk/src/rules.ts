// RISK, classic world-domination rules: random territory deal, starting armies, reinforcements with continent bonuses,
// escalating card sets (+2 on an owned pictured territory), dice battles (ties to the defender), conquest and
// occupation, elimination with card transfer and forced trade, one fortification per turn, card for a conquest.
// Documented deviations: each player places all starting armies in one action; the defender always rolls the
// maximum dice allowed; occupation is skipped when only one army count is possible; optional 'majority' goal.
import { z } from 'zod';
import type { Actor, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { risk } from './definition.ts';
import {
  ADJ, CARD_COUNT, CONTINENTS, CONTINENT_OF, MAJORITY, STARTING_ARMIES, T, TERRITORY_IDS, cardTerritory, isSet, setValue,
  type ContinentId, type TerritoryId
} from './board.ts';

export type Phase = 'setup' | 'reinforce' | 'attack' | 'occupy' | 'fortify';
/** active: plays; abandoned: resigned / timed out, territories stay passive on the map; out: eliminated. */
export type SeatStatus = 'active' | 'abandoned' | 'out';
export type Goal = 'world' | 'majority';
export type FortifyMode = 'connected' | 'adjacent';

export interface Battle {
  seat: number; defender: number; from: number; to: number;
  /** Dice of the last roll, highest first. */
  att: number[]; def: number[];
  /** Losses over all rolls of this attack (several rolls for a blitz). */
  lossA: number; lossD: number; rounds: number; conquered: boolean; turn: number;
}

export type LogEntry =
  | { t: 'start'; first: number; goal: Goal }
  | { t: 'setup'; seat: number; armies: number }
  | { t: 'turn'; seat: number; turn: number; income: number }
  | { t: 'trade'; seat: number; cards: number[]; value: number; bonus: number | null }
  | { t: 'place'; seat: number; armies: number; at: number[] }
  | ({ t: 'battle'; blitz: boolean } & Omit<Battle, 'turn'>)
  | { t: 'occupy'; seat: number; from: number; to: number; armies: number }
  | { t: 'eliminate'; seat: number; by: number; cards: number }
  | { t: 'fortify'; seat: number; from: number; to: number; armies: number }
  | { t: 'card'; seat: number }
  | { t: 'timeout'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'win'; seat: number; reason: 'world' | 'majority' | 'last' };

export interface RiskState {
  players: number;
  goal: Goal;
  fortifyMode: FortifyMode;
  status: SeatStatus[];
  owner: number[];
  armies: number[];
  hands: number[][];
  deck: number[];
  discard: number[];
  /** Sets traded in so far (whole game): drives the set value. */
  trades: number;
  phase: Phase;
  current: number;
  first: number;
  turn: number;
  /** Starting armies still to place (setup phase). */
  setupLeft: number[];
  /** Armies to place now (setup / reinforce). */
  available: number;
  /** Reinforce sub-phase after eliminating a player with 6+ cards; returns to the attack phase. */
  elimTrade: boolean;
  /** The +2 pictured-territory bonus was already received this turn. */
  bonusTaken: boolean;
  /** At least one territory conquered this turn (earns a card). */
  conquered: boolean;
  occupy: { from: number; to: number; min: number; elim: boolean } | null;
  lastBattle: Battle | null;
  /** Tutorial only: scripted dice, used before the RNG. */
  fixedDice: number[];
  timeouts: number[];
  /** Seats in the order they left the game (removed or eliminated). */
  leftOrder: number[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

const MAX_TIMEOUTS = 3;
const LOG_SIZE = 40;

const tid = z.enum(TERRITORY_IDS);
export const riskAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), armies: z.record(z.string().max(32), z.number().int().min(0).max(1_000_000)) }),
  z.strictObject({ type: z.literal('trade'), cards: z.array(z.number().int().min(0).max(CARD_COUNT - 1)).length(3) }),
  z.strictObject({ type: z.literal('attack'), from: tid, to: tid, dice: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.strictObject({ type: z.literal('blitz'), from: tid, to: tid }),
  z.strictObject({ type: z.literal('occupy'), armies: z.number().int().min(1).max(1_000_000) }),
  z.strictObject({ type: z.literal('endAttack') }),
  z.strictObject({ type: z.literal('fortify'), from: tid, to: tid, armies: z.number().int().min(1).max(1_000_000) }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type RiskAction = z.infer<typeof riskAction>;

export interface RiskView {
  players: number;
  goal: Goal;
  fortifyMode: FortifyMode;
  status: SeatStatus[];
  owner: number[];
  armies: number[];
  handCounts: number[];
  /** Own cards (card ids: 0–41 territory cards, 42–43 wild); null for spectators. */
  myHand: number[] | null;
  deckCount: number;
  discardCount: number;
  trades: number;
  nextSetValue: number;
  phase: Phase;
  current: number;
  turn: number;
  setupLeft: number[];
  available: number;
  elimTrade: boolean;
  mustTrade: boolean;
  bonusTaken: boolean;
  conquered: boolean;
  occupy: { from: number; to: number; min: number; max: number } | null;
  lastBattle: Battle | null;
  log: (LogEntry & { seq: number })[];
  outcome: Outcome | null;
}

// ---------- helpers ----------

type Events = Transition<RiskState>['internalEvents'];

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function log(s: RiskState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

export const territoriesOf = (s: Pick<RiskState, 'owner'>, seat: number) => s.owner.reduce((a, o) => a + (o === seat ? 1 : 0), 0);
export const ownsContinent = (s: Pick<RiskState, 'owner'>, seat: number, c: ContinentId) =>
  CONTINENT_OF.every((x, i) => x !== c || s.owner[i] === seat);

/** Reinforcements at the start of a turn: territories / 3 (at least 3) plus complete continents. */
export function income(s: Pick<RiskState, 'owner'>, seat: number): number {
  const base = Math.max(3, Math.floor(territoriesOf(s, seat) / 3));
  return base + CONTINENTS.reduce((a, c) => a + (ownsContinent(s, seat, c.id) ? c.bonus : 0), 0);
}

const activeSeats = (s: RiskState) => s.status.flatMap((x, seat) => (x === 'active' ? [seat] : []));

export function mustTrade(s: RiskState, seat: number): boolean {
  if (s.phase !== 'reinforce' || seat !== s.current) return false;
  const n = s.hands[seat]!.length;
  return s.elimTrade ? n > 4 : n >= 5;
}

/** Own territories reachable from `from` (own chain for 'connected', neighbours for 'adjacent'). */
export function fortifyTargets(s: Pick<RiskState, 'owner' | 'fortifyMode'>, from: number): number[] {
  const seat = s.owner[from]!;
  if (s.fortifyMode === 'adjacent') return ADJ[from]!.filter((t) => s.owner[t] === seat);
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift()!;
    for (const n of ADJ[t]!) if (!seen.has(n) && s.owner[n] === seat) { seen.add(n); queue.push(n); }
  }
  seen.delete(from);
  return [...seen].sort((a, b) => a - b);
}

/** Every valid set in a hand (card ids ascending). */
export function validSets(hand: readonly number[]): number[][] {
  const h = [...hand].sort((a, b) => a - b);
  const out: number[][] = [];
  for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) for (let k = j + 1; k < h.length; k++) {
    const set = [h[i]!, h[j]!, h[k]!];
    if (isSet(set)) out.push(set);
  }
  return out;
}

function nextSeat(s: RiskState, from: number): number {
  let seat = from;
  for (let i = 0; i < s.players; i++) {
    seat = (seat + 1) % s.players;
    if (s.status[seat] === 'active') return seat;
  }
  return from;
}

function placements(s: RiskState, winner: number): Outcome['placements'] {
  const live = activeSeats(s).filter((x) => x !== winner);
  const score = (seat: number) => territoriesOf(s, seat);
  const out: Outcome['placements'] = [{ seat: winner, place: 1, score: score(winner) }];
  for (const seat of live) out.push({ seat, score: score(seat), place: 2 + live.filter((o) => score(o) > score(seat)).length });
  // Seats that left: the later they left, the better.
  [...s.leftOrder].reverse().forEach((seat, i) => out.push({ seat, score: score(seat), place: 2 + live.length + i }));
  return out;
}

function win(s: RiskState, seat: number, reason: 'world' | 'majority' | 'last', outcomeReason: Outcome['reason'] = 'win') {
  if (s.outcome) return;
  log(s, { t: 'win', seat, reason });
  s.outcome = { reason: outcomeReason, placements: placements(s, seat) };
}

/** Immediate wins: world domination, or the only active player left. */
function checkWin(s: RiskState, reason: Outcome['reason'] = 'win') {
  if (s.outcome) return;
  const seat = s.owner[0]!;
  if (s.status[seat] === 'active' && s.owner.every((o) => o === seat)) return win(s, seat, 'world');
  const live = activeSeats(s);
  if (live.length === 1) win(s, live[0]!, 'last', reason);
}

function drawCard(s: RiskState, rng: EngineRng): number | null {
  if (s.deck.length === 0 && s.discard.length > 0) { s.deck = shuffle(s.discard, rng); s.discard = []; }
  return s.deck.pop() ?? null;
}

// ---------- turn flow ----------

function beginTurn(s: RiskState, seat: number) {
  s.current = seat;
  s.turn += 1;
  s.phase = 'reinforce';
  s.available = income(s, seat);
  s.elimTrade = false;
  s.bonusTaken = false;
  s.conquered = false;
  s.occupy = null;
  log(s, { t: 'turn', seat, turn: s.turn, income: s.available });
}

/** Next seat that still has starting armies to place, else the first turn. */
function advanceSetup(s: RiskState) {
  let seat = s.current;
  for (let i = 0; i < s.players; i++) {
    seat = (seat + 1) % s.players;
    if (s.status[seat] === 'active' && s.setupLeft[seat]! > 0) {
      s.current = seat;
      s.available = s.setupLeft[seat]!;
      return;
    }
  }
  s.available = 0;
  beginTurn(s, s.status[s.first] === 'active' ? s.first : nextSeat(s, s.first));
}

function place(s: RiskState, seat: number, armies: Record<string, number>) {
  const at: number[] = [];
  let total = 0;
  for (const [id, k] of Object.entries(armies)) {
    if (k <= 0) continue;
    s.armies[T[id as TerritoryId]]! += k;
    at.push(T[id as TerritoryId]);
    total += k;
  }
  if (s.phase === 'setup') {
    s.setupLeft[seat] = 0;
    log(s, { t: 'setup', seat, armies: total });
    advanceSetup(s);
    return;
  }
  log(s, { t: 'place', seat, armies: total, at });
  s.available = 0;
  s.elimTrade = false;
  s.phase = 'attack';
}

function trade(s: RiskState, seat: number, cards: number[]) {
  const hand = s.hands[seat]!;
  s.hands[seat] = hand.filter((c) => !cards.includes(c));
  s.discard.push(...cards);
  const value = setValue(s.trades);
  s.trades += 1;
  s.available += value;
  let bonus: number | null = null;
  if (!s.bonusTaken) {
    const own = cards.map(cardTerritory).filter((t): t is number => t !== null && s.owner[t] === seat).sort((a, b) => a - b);
    if (own.length) { bonus = own[0]!; s.armies[bonus]! += 2; s.bonusTaken = true; }
  }
  log(s, { t: 'trade', seat, cards: [...cards].sort((a, b) => a - b), value, bonus });
}

function rollDice(s: RiskState, rng: EngineRng, k: number): number[] {
  return Array.from({ length: k }, () => s.fixedDice.shift() ?? rng.nextInt(6) + 1).sort((a, b) => b - a);
}

/** One attack (or a blitz: repeated max-dice rolls until conquest or 1 army left). */
function attack(s: RiskState, rng: EngineRng, seat: number, from: number, to: number, dice: number | 'blitz') {
  const defender = s.owner[to]!;
  let att: number[], def: number[], used: number, lossA = 0, lossD = 0, rounds = 0;
  do {
    used = dice === 'blitz' ? Math.min(3, s.armies[from]! - 1) : dice;
    att = rollDice(s, rng, used);
    def = rollDice(s, rng, Math.min(2, s.armies[to]!));
    for (let i = 0; i < Math.min(att.length, def.length); i++) {
      if (att[i]! > def[i]!) { s.armies[to]! -= 1; lossD += 1; } else { s.armies[from]! -= 1; lossA += 1; }
    }
    rounds += 1;
  } while (dice === 'blitz' && s.armies[to]! > 0 && s.armies[from]! > 1);
  const conquered = s.armies[to] === 0;
  const battle = { seat, defender, from, to, att, def, lossA, lossD, rounds, conquered };
  s.lastBattle = { ...battle, turn: s.turn };
  log(s, { t: 'battle', blitz: dice === 'blitz', ...battle });
  if (!conquered) return;

  s.owner[to] = seat;
  s.conquered = true;
  let elim = false;
  if (territoriesOf(s, defender) === 0) {
    elim = true;
    const cards = s.hands[defender]!;
    s.hands[seat]!.push(...cards);
    s.hands[defender] = [];
    if (s.status[defender] === 'active') s.leftOrder.push(defender);
    s.status[defender] = 'out';
    log(s, { t: 'eliminate', seat: defender, by: seat, cards: cards.length });
  }
  s.occupy = { from, to, min: used, elim };
  s.phase = 'occupy';
  checkWin(s);
  // Only one possible count (or the game is over): move it right away.
  if (s.outcome || used >= s.armies[from]! - 1) occupy(s, seat, used);
}

function occupy(s: RiskState, seat: number, armies: number) {
  const o = s.occupy!;
  s.armies[o.from]! -= armies;
  s.armies[o.to]! += armies;
  s.occupy = null;
  log(s, { t: 'occupy', seat, from: o.from, to: o.to, armies });
  if (s.outcome) return;
  if (o.elim && s.hands[seat]!.length >= 6) {
    s.phase = 'reinforce';
    s.elimTrade = true;
    s.available = 0;
  } else s.phase = 'attack';
}

function endTurn(s: RiskState, seat: number, rng: EngineRng, events: Events) {
  if (s.conquered) {
    const card = drawCard(s, rng);
    if (card !== null) {
      s.hands[seat]!.push(card);
      log(s, { t: 'card', seat });
      events.push({ type: 'card-drawn', seat, card });
    }
  }
  if (s.goal === 'majority' && territoriesOf(s, seat) >= MAJORITY) return win(s, seat, 'majority');
  beginTurn(s, nextSeat(s, seat));
}

/** Owned territory bordering the most enemy armies (lowest index on ties): where timeouts put armies. */
export function frontline(s: RiskState, seat: number): number {
  let best = -1, bestScore = -1;
  s.owner.forEach((o, t) => {
    if (o !== seat) return;
    const score = ADJ[t]!.reduce((a, n) => a + (s.owner[n] !== seat ? s.armies[n]! : 0), 0);
    if (score > bestScore) { best = t; bestScore = score; }
  });
  return best;
}

function removeSeat(s: RiskState, seat: number, reason: 'resign' | 'timeout') {
  if (s.status[seat] !== 'active') return;
  // Keep the map consistent first: unplaced starting armies are placed, a pending occupation moves the minimum.
  if (s.phase === 'setup' && s.setupLeft[seat]! > 0) {
    s.armies[frontline(s, seat)]! += s.setupLeft[seat]!;
    s.setupLeft[seat] = 0;
  }
  if (s.current === seat && s.phase === 'occupy') occupy(s, seat, s.occupy!.min);
  s.status[seat] = 'abandoned';
  s.leftOrder.push(seat);
  s.discard.push(...s.hands[seat]!);
  s.hands[seat] = [];
  log(s, { t: 'left', seat, reason });
  checkWin(s, reason);
  if (s.outcome || s.current !== seat) return;
  if (s.phase === 'setup') advanceSetup(s);
  else beginTurn(s, nextSeat(s, seat));
}

const turnKey = (s: RiskState) => `${s.current}|${s.phase}|${s.turn}`;
function finish(s: RiskState, events: Events, before: string): Transition<RiskState> {
  const scheduleChanges: Transition<RiskState>['scheduleChanges'] =
    s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : turnKey(s) !== before ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges };
}

// ---------- validation ----------

function check(s: RiskState, seat: number, a: RiskAction): string | null {
  if (seat !== s.current) return 'NOT_YOUR_TURN';
  const own = (id: TerritoryId) => s.owner[T[id]] === seat;
  switch (a.type) {
    case 'place': {
      if (s.phase !== 'setup' && s.phase !== 'reinforce') return 'WRONG_PHASE';
      if (mustTrade(s, seat)) return 'MUST_TRADE';
      let total = 0;
      for (const [id, k] of Object.entries(a.armies)) {
        if (!(TERRITORY_IDS as readonly string[]).includes(id) || !own(id as TerritoryId)) return 'NOT_YOUR_TERRITORY';
        total += k;
      }
      return total === s.available && total > 0 ? null : 'WRONG_ARMY_COUNT';
    }
    case 'trade': {
      if (s.phase !== 'reinforce') return 'WRONG_PHASE';
      if (s.elimTrade && !mustTrade(s, seat)) return 'NO_TRADE_NEEDED';
      if (!a.cards.every((c) => s.hands[seat]!.includes(c))) return 'CARD_NOT_IN_HAND';
      return isSet(a.cards) ? null : 'NOT_A_SET';
    }
    case 'attack':
    case 'blitz': {
      if (s.phase !== 'attack') return 'WRONG_PHASE';
      if (!own(a.from)) return 'NOT_YOUR_TERRITORY';
      if (own(a.to)) return 'NOT_ENEMY';
      if (!ADJ[T[a.from]]!.includes(T[a.to])) return 'NOT_ADJACENT';
      const k = s.armies[T[a.from]]!;
      if (k < 2) return 'TOO_FEW_ARMIES';
      return a.type === 'attack' && a.dice > Math.min(3, k - 1) ? 'TOO_MANY_DICE' : null;
    }
    case 'occupy': {
      if (s.phase !== 'occupy' || !s.occupy) return 'WRONG_PHASE';
      return a.armies >= s.occupy.min && a.armies <= s.armies[s.occupy.from]! - 1 ? null : 'WRONG_ARMY_COUNT';
    }
    case 'endAttack': return s.phase === 'attack' ? null : 'WRONG_PHASE';
    case 'fortify': {
      if (s.phase !== 'fortify') return 'WRONG_PHASE';
      if (a.from === a.to) return 'SAME_TERRITORY';
      if (!own(a.from) || !own(a.to)) return 'NOT_YOUR_TERRITORY';
      if (!fortifyTargets(s, T[a.from]).includes(T[a.to])) return 'NOT_CONNECTED';
      return a.armies <= s.armies[T[a.from]]! - 1 ? null : 'WRONG_ARMY_COUNT';
    }
    case 'endTurn': return s.phase === 'fortify' ? null : 'WRONG_PHASE';
    default: return 'INVALID_ACTION';
  }
}

// ---------- tutorial (2 seats; learner = seat 0 owns 29 territories, conquers North Africa and Egypt, wins with 31 of 30) ----------

const TUTORIAL_HAND = [T.alaska, T.alberta, T.westernUS]; // three infantry cards
/** Reinforcements in the tutorial turn: 29 / 3 = 9, + North America 5, South America 2, Asia 7, Australia 2, + set 4. */
export const TUTORIAL_PLACE = 29;

function tutorialState(s: RiskState) {
  s.owner = CONTINENT_OF.map((c) => (c === 'eu' || c === 'af' ? 1 : 0));
  s.armies = CONTINENT_OF.map((c) => (c === 'eu' || c === 'af' ? 3 : 2));
  s.armies[T.brazil] = 4;
  s.armies[T.northAfrica] = 1;
  s.hands = [[...TUTORIAL_HAND], []];
  s.deck = s.deck.filter((c) => !TUTORIAL_HAND.includes(c));
  s.setupLeft = [0, 0];
  // Attack Brazil→North Africa (3 dice vs 1), then a blitz on Egypt in two rolls (a 5–5 tie costs the attacker 1).
  s.fixedDice = [6, 5, 4, 2, 6, 5, 3, 5, 5, 6, 4, 2, 3, 1];
  beginTurn(s, 0);
}

// ---------- module ----------

export const riskModule: GameModule<RiskState, RiskAction, RiskView> = {
  manifest: risk.manifest,
  actionSchema: riskAction,

  setup({ playerCount, options, rng }) {
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    if (!tutorial && (playerCount < 3 || playerCount > 6)) throw new Error('risk needs 3–6 players');
    // Rulebook: the highest roll starts; the engine draws the first player. Territories are dealt like the cards.
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const owner = Array<number>(TERRITORY_IDS.length).fill(0);
    shuffle(TERRITORY_IDS.map((_, i) => i), rng).forEach((t, k) => { owner[t] = (first + k) % playerCount; });
    const start = STARTING_ARMIES[playerCount]!;
    const s: RiskState = {
      players: playerCount,
      goal: tutorial || options.goal === 'majority' ? 'majority' : 'world',
      fortifyMode: options.fortify === 'adjacent' ? 'adjacent' : 'connected',
      status: Array<SeatStatus>(playerCount).fill('active'),
      owner,
      armies: owner.map(() => 1),
      hands: Array.from({ length: playerCount }, () => []),
      deck: shuffle(Array.from({ length: CARD_COUNT }, (_, c) => c), rng),
      discard: [],
      trades: 0,
      phase: 'setup',
      current: first,
      first,
      turn: 0,
      setupLeft: Array.from({ length: playerCount }, (_, seat) => start - owner.filter((o) => o === seat).length),
      available: 0,
      elimTrade: false,
      bonusTaken: false,
      conquered: false,
      occupy: null,
      lastBattle: null,
      fixedDice: [],
      timeouts: Array<number>(playerCount).fill(0),
      leftOrder: [],
      log: [],
      seq: 0,
      outcome: null
    };
    s.available = s.setupLeft[first]!;
    log(s, { t: 'start', first, goal: s.goal });
    if (tutorial) tutorialState(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (s.status[actor.seat] !== 'active') return { ok: false, errorCode: 'NOT_IN_GAME' };
    if (a.type === 'resign') return { ok: true };
    const err = check(s, actor.seat, a);
    return err ? { ok: false, errorCode: err } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const before = turnKey(s);
    const events: Events = [];
    s.timeouts[seat] = 0;
    switch (a.type) {
      case 'resign':
        removeSeat(s, seat, 'resign');
        events.push({ type: 'resigned', seat });
        break;
      case 'place': place(s, seat, a.armies); break;
      case 'trade': trade(s, seat, a.cards); break;
      case 'attack': attack(s, ctx.rng, seat, T[a.from], T[a.to], a.dice); break;
      case 'blitz': attack(s, ctx.rng, seat, T[a.from], T[a.to], 'blitz'); break;
      case 'occupy': occupy(s, seat, a.armies); break;
      case 'endAttack': s.phase = 'fortify'; break;
      case 'fortify':
        s.armies[T[a.from]]! -= a.armies;
        s.armies[T[a.to]]! += a.armies;
        log(s, { t: 'fortify', seat, from: T[a.from], to: T[a.to], armies: a.armies });
        endTurn(s, seat, ctx.rng, events);
        break;
      case 'endTurn': endTurn(s, seat, ctx.rng, events); break;
    }
    return finish(s, events, before);
  },

  project(s, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    return {
      players: s.players,
      goal: s.goal,
      fortifyMode: s.fortifyMode,
      status: s.status.slice(),
      owner: s.owner.slice(),
      armies: s.armies.slice(),
      handCounts: s.hands.map((h) => h.length),
      myHand: own === null ? null : [...s.hands[own]!].sort((a, b) => a - b),
      deckCount: s.deck.length,
      discardCount: s.discard.length,
      trades: s.trades,
      nextSetValue: setValue(s.trades),
      phase: s.phase,
      current: s.current,
      turn: s.turn,
      setupLeft: s.setupLeft.slice(),
      available: s.available,
      elimTrade: s.elimTrade,
      mustTrade: mustTrade(s, s.current),
      bonusTaken: s.bonusTaken,
      conquered: s.conquered,
      occupy: s.occupy ? { from: s.occupy.from, to: s.occupy.to, min: s.occupy.min, max: s.armies[s.occupy.from]! - 1 } : null,
      lastBattle: s.lastBattle ? structuredClone(s.lastBattle) : null,
      log: s.log.map((e) => structuredClone(e)),
      outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || s.status[viewer.seat] !== 'active') return [];
    const seat = viewer.seat;
    const out: { type: string; [k: string]: unknown }[] = [];
    if (seat === s.current) {
      const mine = TERRITORY_IDS.filter((_, t) => s.owner[t] === seat);
      if (s.phase === 'reinforce') {
        const sets = validSets(s.hands[seat]!);
        if (!s.elimTrade || mustTrade(s, seat)) for (const cards of sets) out.push({ type: 'trade', cards });
      }
      if ((s.phase === 'setup' || s.phase === 'reinforce') && !mustTrade(s, seat) && s.available > 0) {
        out.push({ type: 'place', available: s.available, territories: mine });
      }
      if (s.phase === 'attack') {
        s.owner.forEach((o, t) => {
          if (o !== seat || s.armies[t]! < 2) return;
          for (const n of ADJ[t]!) if (s.owner[n] !== seat) out.push({ type: 'attack', from: TERRITORY_IDS[t], to: TERRITORY_IDS[n], maxDice: Math.min(3, s.armies[t]! - 1) });
        });
        if (out.length) out.push({ type: 'blitz' });
        out.push({ type: 'endAttack' });
      }
      if (s.phase === 'occupy' && s.occupy) out.push({ type: 'occupy', min: s.occupy.min, max: s.armies[s.occupy.from]! - 1 });
      if (s.phase === 'fortify') {
        s.owner.forEach((o, t) => {
          if (o !== seat || s.armies[t]! < 2) return;
          const to = fortifyTargets(s, t);
          if (to.length) out.push({ type: 'fortify', from: TERRITORY_IDS[t], to: to.map((x) => TERRITORY_IDS[x]), max: s.armies[t]! - 1 });
        });
        out.push({ type: 'endTurn' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _event, ctx) {
    const before = turnKey(s);
    const events: Events = [];
    if (s.outcome) return finish(s, events, before);
    const seat = s.current;
    events.push({ type: 'timed-out', seat });
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      removeSeat(s, seat, 'timeout');
      return finish(s, events, before);
    }
    // Finish the turn with the minimum: forced trades, all armies on the front line, minimum occupation, no attack.
    for (let guard = 0; guard < 20 && !s.outcome && s.current === seat; guard++) {
      if (s.phase === 'setup') {
        place(s, seat, { [TERRITORY_IDS[frontline(s, seat)]!]: s.available });
        break;
      }
      if (s.phase === 'reinforce') {
        if (mustTrade(s, seat)) trade(s, seat, validSets(s.hands[seat]!)[0]!);
        else place(s, seat, { [TERRITORY_IDS[frontline(s, seat)]!]: s.available });
      } else if (s.phase === 'occupy') occupy(s, seat, s.occupy!.min);
      else if (s.phase === 'attack') s.phase = 'fortify';
      else endTurn(s, seat, ctx.rng, events);
    }
    return finish(s, events, before);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 11,
    options: { deal: 'tutorial' },
    introFa: 'آموزش یک نوبت کامل ریسک است. شما (آبی) آمریکای شمالی، آمریکای جنوبی، آسیا و استرالیا را دارید: ۲۹ قلمرو. حریف اروپا و آفریقا را دارد. در این آموزش هر کس در پایان نوبتش ۳۰ قلمرو داشته باشد برنده است. هر نوبت سه مرحله دارد: نیروی کمکی، حمله و جابه‌جایی.',
    steps: [
      { instructionFa: 'نوبت با نیروی کمکی شروع می‌شود. در دستتان سه کارت پیاده‌نظام دارید و سه نماد یکسان یک دسته است. دسته را معاوضه کنید: اولین دستهٔ بازی ۴ ارتش می‌دهد و چون آلاسکا (تصویر یکی از کارت‌ها) مال شماست، ۲ ارتش اضافه هم خودکار روی آلاسکا می‌نشیند.', expected: { type: 'trade', cards: [...TUTORIAL_HAND] }, reply: null },
      { instructionFa: 'حساب نیروی کمکی: ۲۹ قلمرو تقسیم بر ۳ یعنی ۹ ارتش، به‌علاوهٔ پاداش قاره‌های کامل (آمریکای شمالی ۵، آمریکای جنوبی ۲، آسیا ۷، استرالیا ۲) و ۴ ارتش دستهٔ کارت: روی هم ۲۹ ارتش. همه را روی برزیل بچینید، چون برزیل از راه دریا با شمال آفریقا همسایه است.', expected: { type: 'place', armies: { brazil: TUTORIAL_PLACE } }, reply: null },
      { instructionFa: 'حالا مرحلهٔ حمله است. برزیل (۳۳ ارتش) را انتخاب کنید، بعد شمال آفریقا که فقط ۱ ارتش دارد، و با ۳ تاس حمله کنید. بزرگ‌ترین تاس‌ها جفت‌به‌جفت مقایسه می‌شوند و در تساوی مدافع می‌برد؛ مدافع با ۱ ارتش فقط ۱ تاس دارد.', expected: { type: 'attack', from: 'brazil', to: 'northAfrica', dice: 3 }, reply: null },
      { instructionFa: 'شمال آفریقا فتح شد! باید دست‌کم به تعداد تاس‌های آخرین پرتاب (۳) ارتش وارد کنید و ۱ ارتش هم باید در برزیل بماند. ۱۰ ارتش وارد شمال آفریقا کنید تا برای حملهٔ بعدی آماده باشد.', expected: { type: 'occupy', armies: 10 }, reply: null },
      { instructionFa: 'مصر ۳ ارتش دارد و با ۲ تاس دفاع می‌کند. شمال آفریقا را انتخاب کنید، بعد مصر، و «حمله سریع» را بزنید: حمله با بیشترین تاس پشت سر هم تکرار می‌شود تا قلمرو فتح شود یا ۱ ارتش بماند.', expected: { type: 'blitz', from: 'northAfrica', to: 'egypt' }, reply: null },
      { instructionFa: 'مصر در دو پرتاب فتح شد. در پرتاب اول دو تاس ۵ با هم مساوی شدند و شما ۱ ارتش از دست دادید، چون تساوی به نفع مدافع است. ۵ ارتش وارد مصر کنید (دست‌کم ۳، چون آخرین پرتاب ۳ تاس بود).', expected: { type: 'occupy', armies: 5 }, reply: null },
      { instructionFa: 'برای این نوبت کافی است. «پایان حمله» را بزنید تا به مرحلهٔ جابه‌جایی بروید.', expected: { type: 'endAttack' }, reply: null },
      { instructionFa: 'در پایان نوبت یک بار می‌توانید ارتش را میان قلمروهای به‌هم‌پیوستهٔ خودتان جابه‌جا کنید. برزیل را انتخاب کنید، بعد ونزوئلا، و ۵ ارتش ببرید. جابه‌جایی نوبت را تمام می‌کند؛ چون قلمرو گرفته‌اید یک کارت می‌گیرید و با ۳۱ قلمرو برنده می‌شوید.', expected: { type: 'fortify', from: 'brazil', to: 'venezuela', armies: 5 }, reply: null }
    ],
    completedFa: 'بردید! با معاوضهٔ کارت ۴ ارتش و ۲ ارتش پاداش آلاسکا گرفتید و ۲۹ ارتش کمکی روی برزیل چیدید. حمله با ۳ تاس (۶، ۵، ۴ در برابر ۲) شمال آفریقا را گرفت و حمله سریع در دو پرتاب مصر را گرفت (یک تساوی ۵ و ۵ به نفع مدافع بود و ۱ ارتش از دست دادید). با ۳۱ قلمرو در برابر ۱۱ قلمرو حریف نوبت را تمام کردید و یک کارت تازه هم گرفتید. در بازی واقعی هدف کلاسیک گرفتن هر ۴۲ قلمرو است.'
  }
};
