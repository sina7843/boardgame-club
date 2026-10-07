// Ticket to Ride, classic rules on the chosen map: 45 trains each, 110 train cards (12 per colour + 14 locomotives),
// 5 face-up cards (three face-up locomotives → redeal), draw 2 cards / claim a route / draw 3 tickets, double routes
// closed for 2–3 players, last round when someone ends a turn with 2 or fewer trains, tickets ±, longest path +10.
// Documented deviations: the first player is drawn by the engine; the initial ticket choice is simultaneous; a turn
// with no possible action is passed (and the game ends if every active player passes in a row).
import { z } from 'zod';
import type { Actor, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { ticketToRide } from './definition.ts';
import {
  BOARDS, COLORS, LONGEST_BONUS, LOCO, MAP_IDS, ROUTE_POINTS, TRAINS, connected, fullDeck, longestPath,
  type Board, type MapId
} from './board.ts';

export type Phase = 'tickets' | 'play';
/** active: plays; abandoned: resigned or timed out three times (routes stay on the map). */
export type SeatStatus = 'active' | 'abandoned';

export interface FinalScore {
  seat: number;
  routePoints: number;
  tickets: { id: number; done: boolean }[];
  ticketPoints: number;
  longest: number;
  bonus: boolean;
  total: number;
}

export type LogEntry =
  | { t: 'start'; first: number; map: MapId }
  | { t: 'keep'; seat: number; kept: number; offered: number }
  | { t: 'market'; seat: number; color: number }
  | { t: 'deck'; seat: number }
  | { t: 'tickets'; seat: number; n: number }
  | { t: 'claim'; seat: number; route: number; points: number }
  | { t: 'redeal' }
  | { t: 'final'; seat: number }
  | { t: 'pass'; seat: number }
  | { t: 'timeout'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'end'; winners: number[] };

export interface TtrState {
  map: MapId;
  players: number;
  status: SeatStatus[];
  /** Train cards as colour indexes (0–7 colours, 8 locomotive); the deck is drawn from the end. */
  deck: number[];
  discard: number[];
  market: (number | null)[];
  /** Cards in hand: count per colour index. */
  hands: number[][];
  trains: number[];
  /** Route owner by route index. */
  owner: (number | null)[];
  routePoints: number[];
  /** Kept destination tickets (ticket indexes). */
  tickets: number[][];
  /** Ticket draw pile, drawn from the front; returned tickets go under it. */
  ticketDeck: number[];
  /** Tickets being chosen (start of game: everybody; later: the current player). */
  offer: (number[] | null)[];
  phase: Phase;
  current: number;
  first: number;
  turn: number;
  /** Train cards drawn so far this turn (0 or 1). */
  drew: number;
  /** Seats still owed a turn in the last round; null until it starts. */
  finalLeft: number[] | null;
  /** Consecutive passed turns (a dead game ends when every active player passed). */
  passes: number;
  timeouts: number[];
  leftOrder: number[];
  final: FinalScore[] | null;
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

const MAX_TIMEOUTS = 3;
const LOG_SIZE = 40;
const MARKET = 5;

const int = (max: number) => z.number().int().min(0).max(max);
export const ttrAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('keep'), keep: z.array(int(99)).min(1).max(3) }),
  z.strictObject({ type: z.literal('drawMarket'), slot: int(MARKET - 1) }),
  z.strictObject({ type: z.literal('drawDeck') }),
  z.strictObject({ type: z.literal('drawTickets') }),
  z.strictObject({ type: z.literal('claim'), route: int(199), color: int(COLORS.length - 1), locos: int(8) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type TtrAction = z.infer<typeof ttrAction>;

export interface TtrView {
  map: MapId;
  players: number;
  status: SeatStatus[];
  owner: (number | null)[];
  routePoints: number[];
  trains: number[];
  handCounts: number[];
  ticketCounts: number[];
  /** Own cards per colour index; null for spectators. */
  myHand: number[] | null;
  /** Own tickets with their current connection state; null for spectators. */
  myTickets: { id: number; done: boolean }[] | null;
  /** Tickets offered to me right now. */
  myOffer: number[] | null;
  minKeep: number;
  /** Who is choosing tickets right now (public: that they choose, never what). */
  choosing: boolean[];
  market: (number | null)[];
  deckCount: number;
  discardCount: number;
  ticketDeckCount: number;
  phase: Phase;
  current: number;
  turn: number;
  drew: number;
  finalLeft: number[] | null;
  longest: number[];
  final: FinalScore[] | null;
  log: (LogEntry & { seq: number })[];
  outcome: Outcome | null;
}

// ---------- helpers ----------

type Events = Transition<TtrState>['internalEvents'];
export const boardOf = (s: Pick<TtrState, 'map'>): Board => BOARDS[s.map];

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function log(s: TtrState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

export const routesOf = (s: Pick<TtrState, 'owner'>, seat: number) => s.owner.flatMap((o, r) => (o === seat ? [r] : []));
const activeSeats = (s: TtrState) => s.status.flatMap((x, seat) => (x === 'active' ? [seat] : []));
const handSize = (h: readonly number[]) => h.reduce((a, b) => a + b, 0);
export const minKeep = (s: Pick<TtrState, 'phase'>) => (s.phase === 'tickets' ? 2 : 1);

function drawCard(s: TtrState, rng: EngineRng): number | null {
  if (s.deck.length === 0 && s.discard.length > 0) { s.deck = shuffle(s.discard, rng); s.discard = []; }
  return s.deck.pop() ?? null;
}

/** Fill empty face-up slots; three face-up locomotives are discarded and redealt (a few times at most). */
function refillMarket(s: TtrState, rng: EngineRng) {
  for (let i = 0; i < MARKET; i++) if (s.market[i] === null) s.market[i] = drawCard(s, rng);
  for (let guard = 0; guard < 3 && s.market.filter((c) => c === LOCO).length >= 3; guard++) {
    // Only redeal when the cards left could change the picture.
    if (s.deck.length + s.discard.length < MARKET) break;
    s.discard.push(...s.market.filter((c): c is number => c !== null));
    s.market = s.market.map(() => null);
    for (let i = 0; i < MARKET; i++) s.market[i] = drawCard(s, rng);
    log(s, { t: 'redeal' });
  }
}

const marketSlots = (s: TtrState) =>
  s.market.flatMap((c, i) => (c !== null && (s.drew === 0 || c !== LOCO) ? [i] : []));
const canDrawCard = (s: TtrState) => s.deck.length + s.discard.length > 0 || marketSlots(s).length > 0;

/** Ways to pay for a route: per colour, the locomotives needed (min) and usable (max). */
export function payments(board: Board, hand: readonly number[], route: number): { color: number; minLocos: number; maxLocos: number }[] {
  const r = board.routes[route]!;
  const locos = hand[LOCO]!;
  const out: { color: number; minLocos: number; maxLocos: number }[] = [];
  COLORS.forEach((name, c) => {
    if (r.color !== 'gray' && r.color !== name) return;
    const minLocos = Math.max(0, r.len - hand[c]!);
    if (minLocos <= locos) out.push({ color: c, minLocos, maxLocos: Math.min(r.len, locos) });
  });
  // Locomotives alone also pay any route (reported under the route's colour, or red for gray).
  if (out.length === 0 && locos >= r.len) {
    const c = r.color === 'gray' ? 0 : COLORS.indexOf(r.color);
    out.push({ color: c, minLocos: r.len, maxLocos: r.len });
  }
  return out;
}

function claimError(s: TtrState, seat: number, route: number, color: number, locos: number): string | null {
  const board = boardOf(s);
  const r = board.routes[route];
  if (!r) return 'INVALID_ACTION';
  if (s.owner[route] !== null) return 'ROUTE_TAKEN';
  if (r.sib !== null) {
    if (s.owner[r.sib] === seat) return 'OWN_DOUBLE';
    if (s.owner[r.sib] !== null && s.players <= 3) return 'DOUBLE_CLOSED';
  }
  if (s.trains[seat]! < r.len) return 'NOT_ENOUGH_TRAINS';
  const hand = s.hands[seat]!;
  if (locos > r.len || locos > hand[LOCO]!) return 'NOT_ENOUGH_CARDS';
  const need = r.len - locos;
  if (need === 0) return null;
  if (r.color !== 'gray' && COLORS[color] !== r.color) return 'WRONG_COLOR';
  return hand[color]! >= need ? null : 'NOT_ENOUGH_CARDS';
}

const claimable = (s: TtrState, seat: number) =>
  boardOf(s).routes.flatMap((_, r) => (payments(boardOf(s), s.hands[seat]!, r).some((p) => claimError(s, seat, r, p.color, p.minLocos) === null) ? [r] : []));

function canAct(s: TtrState, seat: number): boolean {
  return canDrawCard(s) || s.ticketDeck.length > 0 || claimable(s, seat).length > 0;
}

// ---------- scoring ----------

function score(s: TtrState): FinalScore[] {
  const board = boardOf(s);
  const rows = Array.from({ length: s.players }, (_, seat) => {
    const mine = routesOf(s, seat);
    const tickets = s.tickets[seat]!.map((id) => ({ id, done: connected(board, mine, board.tickets[id]!.a, board.tickets[id]!.b) }));
    const ticketPoints = tickets.reduce((a, t) => a + (t.done ? 1 : -1) * board.tickets[t.id]!.points, 0);
    return { seat, routePoints: s.routePoints[seat]!, tickets, ticketPoints, longest: longestPath(board, mine), bonus: false, total: 0 };
  });
  const best = Math.max(0, ...rows.filter((r) => s.status[r.seat] === 'active').map((r) => r.longest));
  for (const r of rows) {
    r.bonus = best > 0 && s.status[r.seat] === 'active' && r.longest === best;
    r.total = r.routePoints + r.ticketPoints + (r.bonus ? LONGEST_BONUS : 0);
  }
  return rows;
}

function finishGame(s: TtrState, reason: Outcome['reason'] = 'score') {
  if (s.outcome) return;
  s.final = score(s);
  const rows = s.final;
  const live = activeSeats(s);
  // Total, then completed tickets, then longest path.
  const key = (seat: number) => { const r = rows[seat]!; return [r.total, r.tickets.filter((t) => t.done).length, r.longest]; };
  const better = (a: number, b: number) => { const ka = key(a), kb = key(b); for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i]! > kb[i]!; return false; };
  const placements: Outcome['placements'] = live.map((seat) => ({ seat, score: rows[seat]!.total, place: 1 + live.filter((o) => better(o, seat)).length }));
  [...s.leftOrder].reverse().forEach((seat, i) => placements.push({ seat, score: rows[seat]!.total, place: 1 + live.length + i }));
  s.outcome = { reason, placements };
  log(s, { t: 'end', winners: placements.filter((p) => p.place === 1).map((p) => p.seat) });
}

// ---------- turn flow ----------

function nextSeat(s: TtrState, from: number): number | null {
  let seat = from;
  for (let i = 0; i < s.players; i++) {
    seat = (seat + 1) % s.players;
    if (s.status[seat] === 'active' && (s.finalLeft === null || s.finalLeft.includes(seat))) return seat;
  }
  return null;
}

function beginTurn(s: TtrState, seat: number) {
  s.current = seat;
  s.turn += 1;
  s.drew = 0;
}

function advance(s: TtrState, from: number) {
  if (s.finalLeft !== null && s.finalLeft.length === 0) return finishGame(s);
  if (s.passes >= activeSeats(s).length) return finishGame(s);
  const next = nextSeat(s, from);
  if (next === null) return finishGame(s);
  beginTurn(s, next);
}

function endTurn(s: TtrState, seat: number) {
  s.drew = 0;
  if (s.finalLeft !== null) s.finalLeft = s.finalLeft.filter((x) => x !== seat);
  else if (s.trains[seat]! <= 2) {
    // Everybody, the trigger player included, gets one more turn.
    s.finalLeft = activeSeats(s);
    log(s, { t: 'final', seat });
  }
  advance(s, seat);
}

function startPlay(s: TtrState) {
  s.phase = 'play';
  s.turn = 0;
  beginTurn(s, s.status[s.first] === 'active' ? s.first : (nextSeat(s, s.first) ?? s.first));
}

function keep(s: TtrState, seat: number, kept: number[]) {
  const offered = s.offer[seat]!;
  s.tickets[seat] = [...s.tickets[seat]!, ...kept];
  s.ticketDeck = [...s.ticketDeck, ...offered.filter((t) => !kept.includes(t))];
  s.offer[seat] = null;
  log(s, { t: 'keep', seat, kept: kept.length, offered: offered.length });
  if (s.phase === 'tickets') { if (s.offer.every((o, x) => o === null || s.status[x] !== 'active')) startPlay(s); }
  else endTurn(s, seat);
}

function takeCard(s: TtrState, seat: number, card: number, rng: EngineRng, events: Events, slot: number | null) {
  s.hands[seat]![card]! += 1;
  s.passes = 0;
  events.push({ type: 'card', seat, card });
  const wildFirst = slot !== null && card === LOCO && s.drew === 0;
  if (slot !== null) { s.market[slot] = null; refillMarket(s, rng); log(s, { t: 'market', seat, color: card }); }
  else log(s, { t: 'deck', seat });
  if (wildFirst || s.drew === 1) return endTurn(s, seat);
  s.drew = 1;
  if (!canDrawCard(s)) endTurn(s, seat);
}

function claim(s: TtrState, seat: number, route: number, color: number, locos: number) {
  const r = boardOf(s).routes[route]!;
  const need = r.len - locos;
  s.hands[seat]![LOCO]! -= locos;
  if (need > 0) s.hands[seat]![color]! -= need;
  s.discard.push(...Array<number>(locos).fill(LOCO), ...Array<number>(need).fill(color));
  s.owner[route] = seat;
  s.trains[seat]! -= r.len;
  const points = ROUTE_POINTS[r.len] ?? 0;
  s.routePoints[seat]! += points;
  s.passes = 0;
  log(s, { t: 'claim', seat, route, points });
  endTurn(s, seat);
}

function removeSeat(s: TtrState, seat: number, reason: 'resign' | 'timeout') {
  if (s.status[seat] !== 'active') return;
  s.status[seat] = 'abandoned';
  s.leftOrder.push(seat);
  s.hands[seat]!.forEach((k, c) => s.discard.push(...Array<number>(k).fill(c)));
  s.hands[seat] = s.hands[seat]!.map(() => 0);
  if (s.offer[seat]) { s.ticketDeck = [...s.ticketDeck, ...s.offer[seat]!]; s.offer[seat] = null; }
  if (s.finalLeft) s.finalLeft = s.finalLeft.filter((x) => x !== seat);
  log(s, { t: 'left', seat, reason });
  if (activeSeats(s).length <= 1) return finishGame(s, reason);
  if (s.phase === 'tickets') { if (s.offer.every((o) => o === null)) startPlay(s); return; }
  if (s.current === seat) { s.drew = 0; advance(s, seat); }
}

const turnKey = (s: TtrState) => `${s.phase}|${s.current}|${s.turn}`;
function finish(s: TtrState, events: Events, before: string): Transition<TtrState> {
  const scheduleChanges: Transition<TtrState>['scheduleChanges'] =
    s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : turnKey(s) !== before ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges };
}

// ---------- validation ----------

function check(s: TtrState, seat: number, a: TtrAction): string | null {
  if (a.type === 'keep') {
    const offer = s.offer[seat];
    if (!offer) return 'WRONG_PHASE';
    if (s.phase === 'play' && seat !== s.current) return 'NOT_YOUR_TURN';
    if (new Set(a.keep).size !== a.keep.length || !a.keep.every((t) => offer.includes(t))) return 'INVALID_TICKETS';
    return a.keep.length >= minKeep(s) ? null : 'KEEP_MORE_TICKETS';
  }
  if (s.phase !== 'play') return 'WRONG_PHASE';
  if (seat !== s.current) return 'NOT_YOUR_TURN';
  if (s.offer[seat]) return 'CHOOSE_TICKETS';
  switch (a.type) {
    case 'drawMarket': {
      const card = s.market[a.slot];
      if (card === null || card === undefined) return 'EMPTY_SLOT';
      return s.drew === 1 && card === LOCO ? 'LOCO_SECOND' : null;
    }
    case 'drawDeck': return s.deck.length + s.discard.length > 0 ? null : 'DECK_EMPTY';
    case 'drawTickets':
      if (s.drew) return 'WRONG_PHASE';
      return s.ticketDeck.length > 0 ? null : 'NO_TICKETS';
    case 'claim':
      if (s.drew) return 'WRONG_PHASE';
      return claimError(s, seat, a.route, a.color, a.locos);
    case 'pass': return s.drew === 0 && !canAct(s, seat) ? null : 'WRONG_PHASE';
    default: return 'INVALID_ACTION';
  }
}

// ---------- tutorial (Iran map, 2 seats; the learner completes two tickets and wins in the last round) ----------

const IRAN = BOARDS.iran;
const cityIx = (id: string) => IRAN.cities.findIndex((c) => c.id === id);
const routeIx = (a: string, b: string, color: string) =>
  IRAN.routes.findIndex((r) => r.color === color && ((r.a === cityIx(a) && r.b === cityIx(b)) || (r.a === cityIx(b) && r.b === cityIx(a))));
const ticketIx = (a: string, b: string) => IRAN.tickets.findIndex((t) => t.a === cityIx(a) && t.b === cityIx(b));
const C = Object.fromEntries(COLORS.map((c, i) => [c, i])) as Record<(typeof COLORS)[number], number>;

export const TUTORIAL = {
  learnerOffer: [ticketIx('tehran', 'isfahan'), ticketIx('tehran', 'shahrekord'), ticketIx('abadan', 'chabahar')],
  scriptOffer: [ticketIx('tabriz', 'mashhad'), ticketIx('urmia', 'ahvaz'), ticketIx('ilam', 'isfahan')],
  // red, orange, yellow, green, blue, pink, black, white, loco
  learnerHand: [1, 0, 1, 0, 1, 0, 2, 0, 1],
  scriptHand: [0, 2, 0, 0, 2, 2, 0, 2, 0],
  market: [C.red, C.green, LOCO, C.orange, C.white],
  learnerTrains: 7,
  routes: {
    tehranQom: routeIx('tehran', 'qom', 'gray'), qomKashan: routeIx('qom', 'kashan', 'blue'),
    kashanIsfahan: routeIx('kashan', 'isfahan', 'black'), isfahanShahrekord: routeIx('isfahan', 'shahrekord', 'gray'),
    tabrizUrmia: routeIx('tabriz', 'urmia', 'blue'), ardabilRasht: routeIx('ardabil', 'rasht', 'orange'),
    rashtQazvin: routeIx('rasht', 'qazvin', 'white'), zanjanQazvin: routeIx('zanjan', 'qazvin', 'pink')
  }
};

function tutorialState(s: TtrState, rng: EngineRng) {
  const t = TUTORIAL;
  s.hands = [[...t.learnerHand], [...t.scriptHand]];
  s.market = [...t.market];
  const used = t.learnerHand.map((k, c) => k + t.scriptHand[c]! + t.market.filter((m) => m === c).length);
  const deck: number[] = [];
  fullDeck().forEach((c) => { if (used[c]! > 0) used[c]! -= 1; else deck.push(c); });
  s.deck = shuffle(deck, rng);
  s.offer = [[...t.learnerOffer], [...t.scriptOffer]];
  s.ticketDeck = IRAN.tickets.map((_, i) => i).filter((i) => !t.learnerOffer.includes(i) && !t.scriptOffer.includes(i));
  s.trains = [t.learnerTrains, TRAINS];
  s.first = 0;
  s.current = 0;
}

// ---------- module ----------

export const ttrModule: GameModule<TtrState, TtrAction, TtrView> = {
  manifest: ticketToRide.manifest,
  actionSchema: ttrAction,

  setup({ playerCount, options, rng }) {
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    if (playerCount < 2 || playerCount > 5) throw new Error('ticket-to-ride needs 2–5 players');
    const map: MapId = tutorial ? 'iran' : MAP_IDS.includes(options.map as MapId) ? (options.map as MapId) : 'usa';
    const board = BOARDS[map];
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const s: TtrState = {
      map,
      players: playerCount,
      status: Array<SeatStatus>(playerCount).fill('active'),
      deck: shuffle(fullDeck(), rng),
      discard: [],
      market: Array<number | null>(MARKET).fill(null),
      hands: Array.from({ length: playerCount }, () => Array<number>(COLORS.length + 1).fill(0)),
      trains: Array<number>(playerCount).fill(TRAINS),
      owner: board.routes.map(() => null),
      routePoints: Array<number>(playerCount).fill(0),
      tickets: Array.from({ length: playerCount }, () => []),
      ticketDeck: shuffle(board.tickets.map((_, i) => i), rng),
      offer: Array.from({ length: playerCount }, () => null),
      phase: 'tickets',
      current: first,
      first,
      turn: 0,
      drew: 0,
      finalLeft: null,
      passes: 0,
      timeouts: Array<number>(playerCount).fill(0),
      leftOrder: [],
      final: null,
      log: [],
      seq: 0,
      outcome: null
    };
    if (tutorial) tutorialState(s, rng);
    else {
      for (let k = 0; k < 4; k++) for (const h of s.hands) h[s.deck.pop()!]! += 1;
      refillMarket(s, rng);
      s.offer = s.hands.map(() => s.ticketDeck.splice(0, 3));
    }
    log(s, { t: 'start', first, map });
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
      case 'keep': keep(s, seat, a.keep); break;
      case 'drawMarket': takeCard(s, seat, s.market[a.slot]!, ctx.rng, events, a.slot); break;
      case 'drawDeck': takeCard(s, seat, drawCard(s, ctx.rng)!, ctx.rng, events, null); break;
      case 'drawTickets': {
        const drawn = s.ticketDeck.slice(0, 3);
        s.ticketDeck = s.ticketDeck.slice(3);
        s.offer[seat] = drawn;
        s.passes = 0;
        log(s, { t: 'tickets', seat, n: drawn.length });
        events.push({ type: 'tickets-offered', seat, tickets: drawn });
        break;
      }
      case 'claim': claim(s, seat, a.route, a.color, a.locos); break;
      case 'pass':
        s.passes += 1;
        log(s, { t: 'pass', seat });
        endTurn(s, seat);
        break;
    }
    return finish(s, events, before);
  },

  project(s, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    const board = boardOf(s);
    const longest = Array.from({ length: s.players }, (_, seat) => longestPath(board, routesOf(s, seat)));
    return {
      map: s.map,
      players: s.players,
      status: s.status.slice(),
      owner: s.owner.slice(),
      routePoints: s.routePoints.slice(),
      trains: s.trains.slice(),
      handCounts: s.hands.map(handSize),
      ticketCounts: s.tickets.map((t) => t.length),
      myHand: own === null ? null : s.hands[own]!.slice(),
      myTickets: own === null ? null : s.tickets[own]!.map((id) => ({ id, done: connected(board, routesOf(s, own), board.tickets[id]!.a, board.tickets[id]!.b) })),
      myOffer: own === null || !s.offer[own] ? null : s.offer[own]!.slice(),
      minKeep: minKeep(s),
      choosing: s.offer.map((o) => o !== null),
      market: s.market.slice(),
      deckCount: s.deck.length,
      discardCount: s.discard.length,
      ticketDeckCount: s.ticketDeck.length,
      phase: s.phase,
      current: s.current,
      turn: s.turn,
      drew: s.drew,
      finalLeft: s.finalLeft ? s.finalLeft.slice() : null,
      longest,
      final: s.final ? structuredClone(s.final) : null,
      log: s.log.map((e) => structuredClone(e)),
      outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || s.status[viewer.seat] !== 'active') return [];
    const seat = viewer.seat;
    const out: { type: string; [k: string]: unknown }[] = [];
    const offer = s.offer[seat];
    if (offer && (s.phase === 'tickets' || seat === s.current)) out.push({ type: 'keep', offer: offer.slice(), min: minKeep(s) });
    else if (s.phase === 'play' && seat === s.current) {
      const slots = marketSlots(s);
      if (slots.length) out.push({ type: 'drawMarket', slots });
      if (s.deck.length + s.discard.length > 0) out.push({ type: 'drawDeck' });
      if (s.drew === 0) {
        if (s.ticketDeck.length > 0) out.push({ type: 'drawTickets' });
        const board = boardOf(s);
        for (const r of claimable(s, seat)) out.push({ type: 'claim', route: r, pay: payments(board, s.hands[seat]!, r) });
        if (!canAct(s, seat)) out.push({ type: 'pass' });
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
    const board = boardOf(s);
    const cheapest = (offer: number[], n: number) => [...offer].sort((a, b) => board.tickets[a]!.points - board.tickets[b]!.points || a - b).slice(0, n);
    const pending = ttrModule.pendingSeats(s);
    for (const seat of pending) {
      if (s.outcome) break;
      events.push({ type: 'timed-out', seat });
      log(s, { t: 'timeout', seat });
      s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
      if (s.timeouts[seat]! >= MAX_TIMEOUTS) { removeSeat(s, seat, 'timeout'); continue; }
      if (s.offer[seat]) { keep(s, seat, cheapest(s.offer[seat]!, minKeep(s))); continue; }
      // Regular turn: draw blind cards while the turn lasts (a face-up non-locomotive if the deck is gone), else pass.
      for (let guard = 0; guard < 2 && s.current === seat && s.phase === 'play' && !s.outcome; guard++) {
        if (s.deck.length + s.discard.length > 0) takeCard(s, seat, drawCard(s, ctx.rng)!, ctx.rng, events, null);
        else if (marketSlots(s).length) { const slot = marketSlots(s).find((i) => s.market[i] !== LOCO) ?? marketSlots(s)[0]!; takeCard(s, seat, s.market[slot]!, ctx.rng, events, slot); }
        else { s.passes += 1; log(s, { t: 'pass', seat }); endTurn(s, seat); }
      }
    }
    return finish(s, events, before);
  },

  pendingSeats: (s) => {
    if (s.outcome) return [];
    if (s.phase === 'tickets') return s.offer.flatMap((o, seat) => (o && s.status[seat] === 'active' ? [seat] : []));
    return [s.current];
  },

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial', map: 'iran' },
    introFa: 'در بلیت قطار با کارت‌های رنگی مسیر ریلی بین شهرها می‌سازید و بلیت‌های مقصدتان را کامل می‌کنید. این آموزش روی نقشه ایران است؛ شما فقط ۷ واگن دارید تا بازی زود به دور پایانی برسد.',
    steps: [
      { instructionFa: 'سه بلیت مقصد گرفته‌اید و باید دست‌کم ۲ تا را نگه دارید. «تهران–اصفهان» و «تهران–شهرکرد» را نگه دارید؛ هر دو از یک راه می‌گذرند. بلیت برگشتی زیر دسته بلیت‌ها می‌رود.', expected: { type: 'keep', keep: [TUTORIAL.learnerOffer[0]!, TUTORIAL.learnerOffer[1]!] }, reply: { type: 'keep', keep: [TUTORIAL.scriptOffer[0]!, TUTORIAL.scriptOffer[1]!] } },
      { instructionFa: 'در هر نوبت یکی از سه کار را می‌کنید. اینجا کارت می‌کشیم: کارت قرمز رو (خانه اول) را بردارید.', expected: { type: 'drawMarket', slot: 0 }, reply: null },
      { instructionFa: 'کارت دوم را از دسته بسته بکشید (لوکوموتیو رو را نمی‌شود به‌عنوان کارت دوم برداشت). نوبت تمام می‌شود و حریف بازی می‌کند.', expected: { type: 'drawDeck' }, reply: { type: 'claim', route: TUTORIAL.routes.tabrizUrmia, color: C.blue, locos: 0 } },
      { instructionFa: 'حالا ۲ کارت قرمز دارید. مسیر خاکستری تهران–قم (۲ واگن) را با ۲ کارت قرمز بسازید؛ مسیر خاکستری با هر رنگ یکسانی ساخته می‌شود.', expected: { type: 'claim', route: TUTORIAL.routes.tehranQom, color: C.red, locos: 0 }, reply: { type: 'claim', route: TUTORIAL.routes.ardabilRasht, color: C.orange, locos: 0 } },
      { instructionFa: 'مسیر آبی قم–کاشان ۲ واگن است ولی ۱ کارت آبی دارید. لوکوموتیو جای هر رنگی است: با ۱ آبی و ۱ لوکوموتیو بسازید.', expected: { type: 'claim', route: TUTORIAL.routes.qomKashan, color: C.blue, locos: 1 }, reply: { type: 'claim', route: TUTORIAL.routes.rashtQazvin, color: C.white, locos: 0 } },
      { instructionFa: 'مسیر مشکی کاشان–اصفهان را با ۲ کارت مشکی بسازید. بلیت تهران–اصفهان کامل می‌شود و چون فقط ۱ واگن برایتان می‌ماند، دور پایانی شروع می‌شود: هر کس یک نوبت دیگر دارد.', expected: { type: 'claim', route: TUTORIAL.routes.kashanIsfahan, color: C.black, locos: 0 }, reply: { type: 'claim', route: TUTORIAL.routes.zanjanQazvin, color: C.pink, locos: 0 } },
      { instructionFa: 'نوبت آخر شما: اصفهان–شهرکرد (۱ واگن) را با کارت زرد بسازید تا بلیت تهران–شهرکرد هم کامل شود. بعد امتیازها شمرده می‌شود.', expected: { type: 'claim', route: TUTORIAL.routes.isfahanShahrekord, color: C.yellow, locos: 0 }, reply: null }
    ],
    completedFa: 'آموزش تمام شد! امتیاز مسیرها، بلیت‌های کامل (و منفیِ بلیت‌های ناقص حریف) و ۱۰ امتیاز طولانی‌ترین مسیر پیوسته شمرده شد. در بازی واقعی ۴۵ واگن دارید و بازی وقتی واگن‌های کسی به ۲ یا کمتر برسد به دور پایانی می‌رود.'
  }
};
