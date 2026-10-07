// Catan base game rules (owner-supplied rulebook, 2020 edition): 3–4 players, set-up phase in snake order, production,
// robber (discard half above 7, move, steal), combined trade/build phase (domestic offers, 4:1 / 3:1 / 2:1 maritime
// trade), roads/settlements/cities with the distance rule, development cards, Longest Road, Largest Army, 10 VP.
import { z } from 'zod';
import type { Actor, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { catan } from './definition.ts';
import {
  BEGINNER_HARBORS, BEGINNER_MAP, EDGES, HARBOR_POOL, HARBOR_SLOTS, HEX_NEIGHBORS, HEX_VERTICES, NUMBER_POOL,
  RESOURCES, TERRAIN_POOL, TERRAIN_RES, VERTICES, edgeOf, pips, vertexOf,
  type Harbor, type Res, type Terrain
} from './board.ts';

export type Hand = Record<Res, number>;
export type Dev = 'knight' | 'vp' | 'road' | 'plenty' | 'monopoly';
export interface Building { seat: number; city: boolean }
export interface Hex { terrain: Terrain; number: number | null }
export type Phase = 'setupSettlement' | 'setupRoad' | 'roll' | 'discard' | 'robber' | 'steal' | 'main' | 'roadBuilding';
export interface Trade { give: Hand; get: Hand; accepted: number[]; declined: number[] }

export const WIN_VP = 10;
export const BANK_SIZE = 19;
export const LIMITS = { road: 15, settlement: 5, city: 4 } as const;
export const COST: Record<'road' | 'settlement' | 'city' | 'dev', Partial<Hand>> = {
  road: { brick: 1, lumber: 1 },
  settlement: { brick: 1, lumber: 1, wool: 1, grain: 1 },
  city: { ore: 3, grain: 2 },
  dev: { ore: 1, wool: 1, grain: 1 }
};
const DEV_DECK: Dev[] = [
  ...Array<Dev>(14).fill('knight'), ...Array<Dev>(5).fill('vp'),
  'road', 'road', 'plenty', 'plenty', 'monopoly', 'monopoly'
];
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 40;

export type LogEntry =
  | { t: 'start'; first: number }
  | { t: 'build'; seat: number; piece: 'road' | 'settlement' | 'city'; at: number; free: boolean }
  | { t: 'turn'; seat: number; turn: number }
  | { t: 'roll'; seat: number; dice: [number, number] }
  | { t: 'produce'; gains: Hand[]; setup: boolean }
  | { t: 'shortage'; res: Res }
  | { t: 'discard'; seat: number; cards: Hand }
  | { t: 'robber'; seat: number; hex: number }
  | { t: 'steal'; seat: number; from: number; res: Res | null }
  | { t: 'bank'; seat: number; give: Res; n: number; get: Res }
  | { t: 'offer'; seat: number; give: Hand; get: Hand }
  | { t: 'trade'; seat: number; with: number; give: Hand; get: Hand }
  | { t: 'buy'; seat: number }
  | { t: 'dev'; seat: number; card: Exclude<Dev, 'vp'>; res?: Res; n?: number; pick?: [Res, Res] }
  | { t: 'award'; kind: 'road' | 'army'; seat: number | null }
  | { t: 'timeout'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'win'; seat: number; vp: number };

export interface CatanState {
  players: number;
  active: boolean[];
  hexes: Hex[];
  harbors: Harbor[];
  robber: number;
  buildings: (Building | null)[];
  roads: (number | null)[];
  hands: Hand[];
  bank: Hand;
  devDeck: Dev[];
  /** `turn` = turn the card was bought; it can be played from the next turn on. */
  devs: { card: Dev; turn: number }[][];
  knights: number[];
  devPlayed: boolean;
  longestRoad: number | null;
  largestArmy: number | null;
  roadLength: number[];
  phase: Phase;
  setupOrder: number[];
  setupIdx: number;
  lastSettlement: number | null;
  current: number;
  turn: number;
  dice: [number, number] | null;
  owed: number[];
  freeRoads: number;
  /** Phase to return to after the robber / Road Building (a development card may be played before rolling). */
  resume: 'roll' | 'main';
  stealFrom: number[];
  trade: Trade | null;
  /** Tutorial only: scripted dice rolls, used before the RNG. */
  fixedDice: [number, number][];
  timeouts: number[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

const resSchema = z.enum(RESOURCES);
const n = z.number().int().min(0).max(BANK_SIZE).optional();
const handSchema = z.strictObject({ brick: n, lumber: n, wool: n, grain: n, ore: n });
export const catanAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('buildRoad'), edge: z.number().int().min(0).max(EDGES.length - 1) }),
  z.strictObject({ type: z.literal('buildSettlement'), vertex: z.number().int().min(0).max(VERTICES.length - 1) }),
  z.strictObject({ type: z.literal('buildCity'), vertex: z.number().int().min(0).max(VERTICES.length - 1) }),
  z.strictObject({ type: z.literal('roll') }),
  z.strictObject({ type: z.literal('discard'), cards: handSchema }),
  z.strictObject({ type: z.literal('moveRobber'), hex: z.number().int().min(0).max(18) }),
  z.strictObject({ type: z.literal('steal'), seat: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('buyDev') }),
  z.strictObject({ type: z.literal('playKnight') }),
  z.strictObject({ type: z.literal('playRoadBuilding') }),
  z.strictObject({ type: z.literal('playPlenty'), a: resSchema, b: resSchema }),
  z.strictObject({ type: z.literal('playMonopoly'), res: resSchema }),
  z.strictObject({ type: z.literal('bankTrade'), give: resSchema, get: resSchema }),
  z.strictObject({ type: z.literal('offerTrade'), give: handSchema, get: handSchema }),
  z.strictObject({ type: z.literal('cancelTrade') }),
  z.strictObject({ type: z.literal('acceptTrade') }),
  z.strictObject({ type: z.literal('declineTrade') }),
  z.strictObject({ type: z.literal('confirmTrade'), seat: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CatanAction = z.infer<typeof catanAction>;

export interface CatanView {
  players: number;
  active: boolean[];
  hexes: Hex[];
  harbors: Harbor[];
  robber: number;
  buildings: (Building | null)[];
  roads: (number | null)[];
  handCounts: number[];
  myHand: Hand | null;
  devCounts: number[];
  /** Own development cards; `fresh` = bought this turn (not playable yet). */
  myDevs: { card: Dev; fresh: boolean }[] | null;
  knights: number[];
  longestRoad: number | null;
  largestArmy: number | null;
  roadLength: number[];
  /** Points everyone can see (victory point cards stay hidden until the game ends). */
  publicVp: number[];
  /** Own total including hidden victory point cards. */
  myVp: number | null;
  /** Revealed at the end: every player's victory point cards. */
  vpCards: number[] | null;
  bank: Hand;
  devDeckCount: number;
  phase: Phase;
  current: number;
  turn: number;
  dice: [number, number] | null;
  owed: number[];
  freeRoads: number;
  stealFrom: number[];
  trade: Trade | null;
  devPlayed: boolean;
  lastSettlement: number | null;
  log: (LogEntry & { seq: number })[];
  outcome: Outcome | null;
}

// ---------- helpers ----------

export const emptyHand = (): Hand => ({ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 });
export const full = (h: Partial<Hand>): Hand => ({ ...emptyHand(), ...Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined)) });
export const total = (h: Partial<Hand>) => RESOURCES.reduce((a, r) => a + (h[r] ?? 0), 0);
export const covers = (h: Hand, c: Partial<Hand>) => RESOURCES.every((r) => h[r] >= (c[r] ?? 0));

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type Events = Transition<CatanState>['internalEvents'];

function log(s: CatanState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

const isSetup = (s: CatanState) => s.phase === 'setupSettlement' || s.phase === 'setupRoad';
const activeSeats = (s: CatanState) => s.active.flatMap((a, seat) => (a ? [seat] : []));
const count = (s: CatanState, seat: number, piece: 'road' | 'settlement' | 'city') =>
  piece === 'road' ? s.roads.filter((r) => r === seat).length
    : s.buildings.filter((b) => b?.seat === seat && b.city === (piece === 'city')).length;

function pay(s: CatanState, seat: number, c: Partial<Hand>) {
  for (const r of RESOURCES) { s.hands[seat]![r] -= c[r] ?? 0; s.bank[r] += c[r] ?? 0; }
}
function take(s: CatanState, seat: number, r: Res, k: number) {
  s.bank[r] -= k;
  s.hands[seat]![r] += k;
}

// ---------- placement rules ----------

/** Distance rule: the intersection and its 3 neighbours are empty. */
const distanceOk = (s: CatanState, v: number) => !s.buildings[v] && VERTICES[v]!.adj.every((w) => !s.buildings[w]);

/** A road may attach to own building, or to own road at an intersection not occupied by an opponent. */
function roadConnects(s: CatanState, seat: number, e: number): boolean {
  const { a, b } = EDGES[e]!;
  return [a, b].some((v) => {
    const bld = s.buildings[v];
    if (bld) return bld.seat === seat;
    return VERTICES[v]!.edges.some((f) => f !== e && s.roads[f] === seat);
  });
}

export function canRoad(s: CatanState, seat: number, e: number): boolean {
  if (s.roads[e] !== null || count(s, seat, 'road') >= LIMITS.road) return false;
  if (s.phase === 'setupRoad') return s.lastSettlement !== null && (EDGES[e]!.a === s.lastSettlement || EDGES[e]!.b === s.lastSettlement);
  return roadConnects(s, seat, e);
}
export function canSettlement(s: CatanState, seat: number, v: number): boolean {
  if (!distanceOk(s, v) || count(s, seat, 'settlement') >= LIMITS.settlement) return false;
  if (s.phase === 'setupSettlement') return true;
  return VERTICES[v]!.edges.some((e) => s.roads[e] === seat);
}
export const canCity = (s: CatanState, seat: number, v: number) =>
  s.buildings[v]?.seat === seat && !s.buildings[v]!.city && count(s, seat, 'city') < LIMITS.city;

const legalRoads = (s: CatanState, seat: number) => EDGES.flatMap((_, e) => (canRoad(s, seat, e) ? [e] : []));
const legalSettlements = (s: CatanState, seat: number) => VERTICES.flatMap((_, v) => (canSettlement(s, seat, v) ? [v] : []));

/** Best maritime rate for a resource: 2 at its special harbor, 3 at a generic harbor, otherwise 4. */
export function tradeRate(s: { harbors: Harbor[]; buildings: (Building | null)[] }, seat: number, r: Res): number {
  let rate = 4;
  for (const h of s.harbors) {
    const { a, b } = EDGES[h.edge]!;
    if (s.buildings[a]?.seat !== seat && s.buildings[b]?.seat !== seat) continue;
    if (h.kind === r) rate = 2;
    else if (h.kind === 'any') rate = Math.min(rate, 3);
  }
  return rate;
}

// ---------- longest road / largest army / points ----------

/** Longest single trail of own road segments; an opponent's building breaks it. */
export function longestRoad(s: CatanState, seat: number): number {
  const blocked = (v: number) => { const b = s.buildings[v]; return !!b && b.seat !== seat; };
  const used = new Set<number>();
  const walk = (v: number): number => {
    let best = 0;
    for (const e of VERTICES[v]!.edges) {
      if (s.roads[e] !== seat || used.has(e)) continue;
      const w = EDGES[e]!.a === v ? EDGES[e]!.b : EDGES[e]!.a;
      used.add(e);
      best = Math.max(best, 1 + (blocked(w) ? 0 : walk(w)));
      used.delete(e);
    }
    return best;
  };
  let best = 0;
  VERTICES.forEach((_, v) => { if (VERTICES[v]!.edges.some((e) => s.roads[e] === seat)) best = Math.max(best, walk(v)); });
  return best;
}

function updateLongestRoad(s: CatanState) {
  s.roadLength = s.roadLength.map((_, seat) => (s.active[seat] ? longestRoad(s, seat) : 0));
  const max = Math.max(...s.roadLength);
  const holder = s.longestRoad;
  if (holder !== null && s.active[holder] && s.roadLength[holder] === max && max >= 5) return;
  const top = activeSeats(s).filter((seat) => s.roadLength[seat] === max);
  const next = max >= 5 && top.length === 1 ? top[0]! : null;
  if (next !== holder) { s.longestRoad = next; log(s, { t: 'award', kind: 'road', seat: next }); }
}

function updateLargestArmy(s: CatanState) {
  // First to 3 knights; afterwards only strictly more knights takes the card (a unique leader when it is vacant).
  const holder = s.largestArmy !== null && s.active[s.largestArmy] ? s.largestArmy : null;
  const better = activeSeats(s).filter((seat) => s.knights[seat]! > (holder === null ? 2 : s.knights[holder]!));
  const max = Math.max(...better.map((seat) => s.knights[seat]!));
  const top = better.filter((seat) => s.knights[seat] === max);
  const next = top.length === 1 ? top[0]! : holder;
  if (next !== s.largestArmy) { s.largestArmy = next; log(s, { t: 'award', kind: 'army', seat: next }); }
}

export function publicVp(s: Pick<CatanState, 'buildings' | 'longestRoad' | 'largestArmy'>, seat: number): number {
  const b = s.buildings.reduce((a, x) => a + (x?.seat === seat ? (x.city ? 2 : 1) : 0), 0);
  return b + (s.longestRoad === seat ? 2 : 0) + (s.largestArmy === seat ? 2 : 0);
}
const vpCards = (s: CatanState, seat: number) => s.devs[seat]!.filter((d) => d.card === 'vp').length;
export const totalVp = (s: CatanState, seat: number) => publicVp(s, seat) + vpCards(s, seat);

function placements(s: CatanState, first: number | null): Outcome['placements'] {
  const live = activeSeats(s);
  const score = (seat: number) => totalVp(s, seat) + (seat === first ? 1000 : 0);
  const out = live.map((seat) => ({ seat, score: totalVp(s, seat), place: 1 + live.filter((o) => score(o) > score(seat)).length }));
  for (let seat = 0; seat < s.players; seat++) if (!s.active[seat]) out.push({ seat, score: totalVp(s, seat), place: live.length + 1 });
  return out;
}

/** You win only on your own turn, the moment you have 10 points (hidden victory point cards included). */
function checkWin(s: CatanState) {
  if (s.outcome || isSetup(s) || !s.active[s.current]) return;
  const vp = totalVp(s, s.current);
  if (vp < WIN_VP) return;
  log(s, { t: 'win', seat: s.current, vp });
  s.trade = null;
  s.outcome = { reason: 'win', placements: placements(s, s.current) };
}

// ---------- turn flow ----------

function nextSeat(s: CatanState, from: number): number {
  let seat = from;
  do seat = (seat + 1) % s.players; while (!s.active[seat]);
  return seat;
}

function beginTurn(s: CatanState, seat: number) {
  s.current = seat;
  s.turn += 1;
  s.phase = 'roll';
  s.dice = null;
  s.devPlayed = false;
  s.trade = null;
  s.stealFrom = [];
  s.freeRoads = 0;
  log(s, { t: 'turn', seat, turn: s.turn });
}

/** Next placement of the set-up phase, or the first turn once everyone has placed twice. */
function advanceSetup(s: CatanState) {
  s.setupIdx += 1;
  while (s.setupIdx < s.setupOrder.length && !s.active[s.setupOrder[s.setupIdx]!]) s.setupIdx += 1;
  s.lastSettlement = null;
  if (s.setupIdx >= s.setupOrder.length) {
    const first = s.setupOrder[0]!;
    beginTurn(s, s.active[first] ? first : nextSeat(s, first));
    return;
  }
  s.current = s.setupOrder[s.setupIdx]!;
  s.phase = 'setupSettlement';
}

function produce(s: CatanState, sum: number) {
  const want = s.hands.map(() => emptyHand());
  s.hexes.forEach((h, i) => {
    const r = TERRAIN_RES[h.terrain];
    if (h.number !== sum || i === s.robber || !r) return;
    for (const v of HEX_VERTICES[i]!) {
      const b = s.buildings[v];
      if (b && s.active[b.seat]) want[b.seat]![r] += b.city ? 2 : 1;
    }
  });
  const gains = s.hands.map(() => emptyHand());
  for (const r of RESOURCES) {
    const takers = want.flatMap((w, seat) => (w[r] > 0 ? [seat] : []));
    const need = takers.reduce((a, seat) => a + want[seat]![r], 0);
    if (need === 0) continue;
    if (need <= s.bank[r]) for (const seat of takers) gains[seat]![r] = want[seat]![r];
    // Not enough in the supply: nobody gets it, unless only one player is affected (they get what is left).
    else if (takers.length === 1) gains[takers[0]!]![r] = s.bank[r];
    else { log(s, { t: 'shortage', res: r }); continue; }
    for (const seat of takers) take(s, seat, r, gains[seat]![r]);
  }
  if (gains.some((g) => total(g) > 0)) log(s, { t: 'produce', gains, setup: false });
}

function roll(s: CatanState, rng: EngineRng) {
  const dice = s.fixedDice.shift() ?? [rng.nextInt(6) + 1, rng.nextInt(6) + 1] as [number, number];
  s.dice = dice;
  log(s, { t: 'roll', seat: s.current, dice });
  const sum = dice[0] + dice[1];
  if (sum !== 7) { produce(s, sum); s.phase = 'main'; return; }
  s.resume = 'main';
  s.owed = s.hands.map((h, seat) => (s.active[seat] && total(h) > 7 ? Math.floor(total(h) / 2) : 0));
  s.phase = s.owed.some((o) => o > 0) ? 'discard' : 'robber';
}

function moveRobber(s: CatanState, hex: number, rng: EngineRng) {
  s.robber = hex;
  log(s, { t: 'robber', seat: s.current, hex });
  const victims = [...new Set(HEX_VERTICES[hex]!.map((v) => s.buildings[v]?.seat).filter((x): x is number => x !== undefined))]
    .filter((seat) => seat !== s.current && s.active[seat] && total(s.hands[seat]!) > 0)
    .sort((a, b) => a - b);
  if (victims.length === 1) return steal(s, victims[0]!, rng);
  if (victims.length > 1) { s.stealFrom = victims; s.phase = 'steal'; return; }
  s.phase = s.resume;
}

function steal(s: CatanState, from: number, rng: EngineRng) {
  const h = s.hands[from]!;
  let k = rng.nextInt(total(h));
  const res = RESOURCES.find((r) => (k -= h[r]) < 0)!;
  h[res] -= 1;
  s.hands[s.current]![res] += 1;
  log(s, { t: 'steal', seat: s.current, from, res });
  s.stealFrom = [];
  s.phase = s.resume;
}

/** Robber destination for timeouts: hurts the most opponent buildings, avoids own (deterministic). */
function autoRobberHex(s: CatanState, seat: number): number {
  let best = -1, bestScore = -Infinity;
  s.hexes.forEach((_, i) => {
    if (i === s.robber) return;
    const score = HEX_VERTICES[i]!.reduce((a, v) => { const b = s.buildings[v]; return a + (!b ? 0 : b.seat === seat ? -10 : 1); }, 0);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

/** Cards to discard on timeout: always from the largest pile (deterministic). */
function autoDiscard(h: Hand, k: number): Hand {
  const left = { ...h }, out = emptyHand();
  for (let i = 0; i < k; i++) {
    const r = [...RESOURCES].sort((x, y) => left[y] - left[x])[0]!;
    left[r] -= 1; out[r] += 1;
  }
  return out;
}

function doDiscard(s: CatanState, seat: number, cards: Hand) {
  pay(s, seat, cards);
  s.owed[seat] = 0;
  log(s, { t: 'discard', seat, cards });
  if (s.owed.every((o) => o === 0) && s.phase === 'discard') s.phase = 'robber';
}

function build(s: CatanState, seat: number, piece: 'road' | 'settlement' | 'city', at: number) {
  const free = isSetup(s) || (piece === 'road' && s.phase === 'roadBuilding');
  if (!free) pay(s, seat, COST[piece]);
  if (piece === 'road') s.roads[at] = seat;
  else s.buildings[at] = { seat, city: piece === 'city' };
  log(s, { t: 'build', seat, piece, at, free });
  updateLongestRoad(s);
  if (s.phase === 'setupSettlement') {
    s.lastSettlement = at;
    // Second round: starting resources from every hex around the second settlement.
    if (s.setupIdx >= s.players) {
      const gains = s.hands.map(() => emptyHand());
      for (const h of VERTICES[at]!.hexes) {
        const r = TERRAIN_RES[s.hexes[h]!.terrain];
        if (r && s.bank[r] > 0) { take(s, seat, r, 1); gains[seat]![r] += 1; }
      }
      log(s, { t: 'produce', gains, setup: true });
    }
    s.phase = 'setupRoad';
  } else if (s.phase === 'setupRoad') {
    advanceSetup(s);
  } else if (s.phase === 'roadBuilding') {
    s.freeRoads -= 1;
    if (s.freeRoads <= 0 || legalRoads(s, seat).length === 0) { s.freeRoads = 0; s.phase = s.resume; }
  }
}

function removeSeat(s: CatanState, seat: number, reason: 'resign' | 'timeout') {
  s.active[seat] = false;
  for (const r of RESOURCES) { s.bank[r] += s.hands[seat]![r]; s.hands[seat]![r] = 0; }
  s.devs[seat] = [];
  s.owed[seat] = 0;
  s.stealFrom = s.stealFrom.filter((x) => x !== seat);
  if (s.trade) {
    s.trade.accepted = s.trade.accepted.filter((x) => x !== seat);
    if (s.current === seat) s.trade = null;
  }
  log(s, { t: 'left', seat, reason });
  updateLongestRoad(s);
  updateLargestArmy(s);
  const live = activeSeats(s);
  if (live.length === 1) {
    s.outcome = { reason, placements: placements(s, live[0]!) };
    return;
  }
  if (isSetup(s)) {
    if (s.current === seat) advanceSetup(s);
    return;
  }
  if (s.current === seat) return beginTurn(s, nextSeat(s, seat));
  if (s.phase === 'discard' && s.owed.every((o) => o === 0)) s.phase = 'robber';
  if (s.phase === 'steal' && s.stealFrom.length === 0) s.phase = s.resume;
}

const playableDev = (s: CatanState, seat: number, card: Dev) =>
  (s.phase === 'roll' || s.phase === 'main') && !s.devPlayed && s.devs[seat]!.some((d) => d.card === card && d.turn < s.turn);

function useDev(s: CatanState, seat: number, card: Dev) {
  const i = s.devs[seat]!.findIndex((d) => d.card === card && d.turn < s.turn);
  s.devs[seat]!.splice(i, 1);
  s.devPlayed = true;
  s.resume = s.phase === 'roll' ? 'roll' : 'main';
}

function finish(s: CatanState, events: Events, before: string): Transition<CatanState> {
  checkWin(s);
  const after = `${s.current}|${s.phase}|${s.turn}`;
  const scheduleChanges: Transition<CatanState>['scheduleChanges'] =
    s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : after !== before ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges };
}
const turnKey = (s: CatanState) => `${s.current}|${s.phase}|${s.turn}`;

// ---------- validation ----------

function check(s: CatanState, seat: number, a: CatanAction): string | null {
  const hand = s.hands[seat]!;
  // Responses to the current player's trade offer.
  if (a.type === 'acceptTrade' || a.type === 'declineTrade') {
    if (seat === s.current) return 'NOT_FOR_CURRENT_PLAYER';
    if (!s.trade || s.phase !== 'main') return 'NO_TRADE_OFFER';
    if (a.type === 'acceptTrade') return s.trade.accepted.includes(seat) ? 'ALREADY_ANSWERED' : covers(hand, s.trade.get) ? null : 'NOT_ENOUGH_RESOURCES';
    return s.trade.declined.includes(seat) ? 'ALREADY_ANSWERED' : null;
  }
  if (a.type === 'discard') {
    if (s.phase !== 'discard' || !s.owed[seat]) return 'NOTHING_TO_DISCARD';
    const cards = full(a.cards);
    return total(cards) !== s.owed[seat] ? 'WRONG_DISCARD_COUNT' : covers(hand, cards) ? null : 'NOT_ENOUGH_RESOURCES';
  }
  if (seat !== s.current) return 'NOT_YOUR_TURN';
  const main = s.phase === 'main';
  switch (a.type) {
    case 'buildRoad':
      if (s.phase !== 'setupRoad' && s.phase !== 'roadBuilding' && !main) return 'WRONG_PHASE';
      if (main && !covers(hand, COST.road)) return 'NOT_ENOUGH_RESOURCES';
      return canRoad(s, seat, a.edge) ? null : 'ILLEGAL_PLACEMENT';
    case 'buildSettlement':
      if (s.phase !== 'setupSettlement' && !main) return 'WRONG_PHASE';
      if (main && !covers(hand, COST.settlement)) return 'NOT_ENOUGH_RESOURCES';
      return canSettlement(s, seat, a.vertex) ? null : 'ILLEGAL_PLACEMENT';
    case 'buildCity':
      if (!main) return 'WRONG_PHASE';
      if (!covers(hand, COST.city)) return 'NOT_ENOUGH_RESOURCES';
      return canCity(s, seat, a.vertex) ? null : 'ILLEGAL_PLACEMENT';
    case 'roll': return s.phase === 'roll' ? null : 'WRONG_PHASE';
    case 'moveRobber': return s.phase !== 'robber' ? 'WRONG_PHASE' : a.hex === s.robber ? 'ROBBER_MUST_MOVE' : null;
    case 'steal': return s.phase !== 'steal' ? 'WRONG_PHASE' : s.stealFrom.includes(a.seat) ? null : 'CANNOT_STEAL_FROM';
    case 'buyDev':
      if (!main) return 'WRONG_PHASE';
      if (s.devDeck.length === 0) return 'NO_DEVELOPMENT_CARDS';
      return covers(hand, COST.dev) ? null : 'NOT_ENOUGH_RESOURCES';
    case 'playKnight': return playableDev(s, seat, 'knight') ? null : 'CANNOT_PLAY_CARD';
    case 'playRoadBuilding': return playableDev(s, seat, 'road') ? null : 'CANNOT_PLAY_CARD';
    case 'playMonopoly': return playableDev(s, seat, 'monopoly') ? null : 'CANNOT_PLAY_CARD';
    case 'playPlenty':
      if (!playableDev(s, seat, 'plenty')) return 'CANNOT_PLAY_CARD';
      return s.bank[a.a] >= (a.a === a.b ? 2 : 1) && s.bank[a.b] >= 1 ? null : 'BANK_EMPTY';
    case 'bankTrade':
      if (!main) return 'WRONG_PHASE';
      if (a.give === a.get) return 'SAME_RESOURCE';
      if (s.bank[a.get] < 1) return 'BANK_EMPTY';
      return hand[a.give] >= tradeRate(s, seat, a.give) ? null : 'NOT_ENOUGH_RESOURCES';
    case 'offerTrade': {
      if (!main) return 'WRONG_PHASE';
      const give = full(a.give), get = full(a.get);
      if (total(give) === 0 || total(get) === 0) return 'EMPTY_TRADE';
      if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return 'SAME_RESOURCE';
      return covers(hand, give) ? null : 'NOT_ENOUGH_RESOURCES';
    }
    case 'cancelTrade': return s.trade ? null : 'NO_TRADE_OFFER';
    case 'confirmTrade':
      if (!s.trade || !main) return 'NO_TRADE_OFFER';
      if (!s.trade.accepted.includes(a.seat) || !s.active[a.seat]) return 'TRADE_NOT_ACCEPTED';
      return covers(hand, s.trade.give) && covers(s.hands[a.seat]!, s.trade.get) ? null : 'TRADE_NOT_POSSIBLE';
    case 'endTurn': return main ? null : 'WRONG_PHASE';
    default: return 'INVALID_ACTION';
  }
}

// ---------- setup ----------

function randomBoard(rng: EngineRng): { hexes: Hex[]; harbors: Harbor[]; robber: number } {
  const terrains = shuffle(TERRAIN_POOL, rng);
  // Fully random variable set-up; the red numbers (6 and 8) must not be on adjacent hexes.
  let numbers: number[];
  const landIdx = terrains.flatMap((t, i) => (t === 'desert' ? [] : [i]));
  for (;;) {
    numbers = shuffle(NUMBER_POOL, rng);
    const at = new Map(landIdx.map((h, k) => [h, numbers[k]!]));
    const red = (h: number) => at.get(h) === 6 || at.get(h) === 8;
    if (landIdx.every((h) => !red(h) || HEX_NEIGHBORS[h]!.every((o) => !red(o)))) break;
  }
  let k = 0;
  const hexes = terrains.map((terrain) => ({ terrain, number: terrain === 'desert' ? null : numbers[k++]! }));
  const kinds = shuffle(HARBOR_POOL, rng);
  return { hexes, harbors: HARBOR_SLOTS.map((edge, i) => ({ edge, kind: kinds[i]! })), robber: terrains.indexOf('desert') };
}

// ---------- tutorial (fixed position on the beginners' map; learner = seat 0, one turn to 10 points) ----------

export const TUTORIAL = (() => {
  const s1 = vertexOf(7, 8, 12);
  const n1 = VERTICES[s1]!.adj.find((v) => VERTICES[v]!.hexes.includes(12) && VERTICES[v]!.hexes.includes(13))!;
  const n2 = VERTICES[n1]!.adj.find((v) => v !== s1 && VERTICES[v]!.hexes.includes(13) && VERTICES[v]!.hexes.includes(16))!;
  return {
    cities: [vertexOf(10, 11, 15), vertexOf(0, 3, 4), vertexOf(14, 15, 18)],
    settlements: [s1, vertexOf(5, 6, 10)],
    roads: [edgeOf(s1, n1)],
    opponent: { settlements: [vertexOf(1, 2, 5), vertexOf(16, 17)] },
    newRoad: edgeOf(n1, n2),
    newSettlement: n2,
    upgrade: vertexOf(5, 6, 10)
  };
})();

function tutorialState(s: CatanState) {
  const T = TUTORIAL;
  for (const v of T.cities) s.buildings[v] = { seat: 0, city: true };
  for (const v of T.settlements) s.buildings[v] = { seat: 0, city: false };
  for (const e of T.roads) s.roads[e] = 0;
  for (const v of T.opponent.settlements) {
    s.buildings[v] = { seat: 1, city: false };
    s.roads[VERTICES[v]!.edges[0]!] = 1;
  }
  s.hands[0] = { brick: 2, lumber: 1, wool: 5, grain: 2, ore: 1 };
  for (const r of RESOURCES) s.bank[r] -= s.hands[0][r];
  s.fixedDice = [[3, 5]];
  s.setupIdx = s.setupOrder.length;
  updateLongestRoad(s);
  beginTurn(s, 0);
}

// ---------- module ----------

export const catanModule: GameModule<CatanState, CatanAction, CatanView> = {
  manifest: catan.manifest,
  actionSchema: catanAction,

  setup({ playerCount, options, rng }) {
    const tutorial = options.deal === 'tutorial' && playerCount === 2;
    if (!tutorial && (playerCount < 3 || playerCount > 4)) throw new Error('catan needs 3–4 players');
    const board = options.board === 'beginner' || tutorial
      ? { hexes: BEGINNER_MAP.map((h) => ({ ...h })), harbors: HARBOR_SLOTS.map((edge, i) => ({ edge, kind: BEGINNER_HARBORS[i]! })), robber: BEGINNER_MAP.findIndex((h) => h.terrain === 'desert') }
      : randomBoard(rng);
    // Rulebook: the highest roll starts; the engine draws the starting player instead.
    const first = tutorial ? 0 : rng.nextInt(playerCount);
    const round = Array.from({ length: playerCount }, (_, i) => (first + i) % playerCount);
    const s: CatanState = {
      players: playerCount,
      active: Array<boolean>(playerCount).fill(true),
      ...board,
      buildings: VERTICES.map(() => null),
      roads: EDGES.map(() => null),
      hands: Array.from({ length: playerCount }, emptyHand),
      bank: { brick: BANK_SIZE, lumber: BANK_SIZE, wool: BANK_SIZE, grain: BANK_SIZE, ore: BANK_SIZE },
      devDeck: shuffle(DEV_DECK, rng),
      devs: Array.from({ length: playerCount }, () => []),
      knights: Array<number>(playerCount).fill(0),
      devPlayed: false,
      longestRoad: null,
      largestArmy: null,
      roadLength: Array<number>(playerCount).fill(0),
      phase: 'setupSettlement',
      setupOrder: [...round, ...round.slice().reverse()],
      setupIdx: 0,
      lastSettlement: null,
      current: first,
      turn: 0,
      dice: null,
      owed: Array<number>(playerCount).fill(0),
      freeRoads: 0,
      resume: 'main',
      stealFrom: [],
      trade: null,
      fixedDice: [],
      timeouts: Array<number>(playerCount).fill(0),
      log: [],
      seq: 0,
      outcome: null
    };
    log(s, { t: 'start', first });
    if (tutorial) tutorialState(s);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (!s.active[actor.seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    if (a.type === 'resign') return { ok: true };
    const err = check(s, actor.seat, a);
    return err ? { ok: false, errorCode: err } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const before = turnKey(s);
    const events: Events = [];
    if (a.type !== 'acceptTrade' && a.type !== 'declineTrade') s.timeouts[seat] = 0;
    // Any other move by the current player withdraws an open offer (the hand it was based on may change).
    if (s.trade && seat === s.current && !['confirmTrade', 'offerTrade', 'cancelTrade', 'resign'].includes(a.type)) s.trade = null;
    switch (a.type) {
      case 'resign':
        removeSeat(s, seat, 'resign');
        events.push({ type: 'resigned', seat });
        break;
      case 'buildRoad': build(s, seat, 'road', a.edge); break;
      case 'buildSettlement': build(s, seat, 'settlement', a.vertex); break;
      case 'buildCity': build(s, seat, 'city', a.vertex); break;
      case 'roll': roll(s, ctx.rng); break;
      case 'discard': doDiscard(s, seat, full(a.cards)); break;
      case 'moveRobber': moveRobber(s, a.hex, ctx.rng); break;
      case 'steal': steal(s, a.seat, ctx.rng); break;
      case 'buyDev': {
        pay(s, seat, COST.dev);
        const card = s.devDeck.pop()!;
        s.devs[seat]!.push({ card, turn: s.turn });
        log(s, { t: 'buy', seat });
        events.push({ type: 'bought', seat, card });
        break;
      }
      case 'playKnight':
        useDev(s, seat, 'knight');
        s.knights[seat]! += 1;
        log(s, { t: 'dev', seat, card: 'knight' });
        updateLargestArmy(s);
        s.phase = 'robber';
        break;
      case 'playRoadBuilding':
        useDev(s, seat, 'road');
        log(s, { t: 'dev', seat, card: 'road' });
        s.freeRoads = Math.min(2, LIMITS.road - count(s, seat, 'road'));
        if (s.freeRoads > 0 && legalRoads(s, seat).length > 0) s.phase = 'roadBuilding';
        else s.freeRoads = 0;
        break;
      case 'playPlenty':
        useDev(s, seat, 'plenty');
        take(s, seat, a.a, 1);
        take(s, seat, a.b, 1);
        log(s, { t: 'dev', seat, card: 'plenty', pick: [a.a, a.b] });
        break;
      case 'playMonopoly': {
        useDev(s, seat, 'monopoly');
        let got = 0;
        s.hands.forEach((h, o) => { if (o !== seat) { got += h[a.res]; h[a.res] = 0; } });
        s.hands[seat]![a.res] += got;
        log(s, { t: 'dev', seat, card: 'monopoly', res: a.res, n: got });
        break;
      }
      case 'bankTrade': {
        const rate = tradeRate(s, seat, a.give);
        pay(s, seat, { [a.give]: rate });
        take(s, seat, a.get, 1);
        log(s, { t: 'bank', seat, give: a.give, n: rate, get: a.get });
        break;
      }
      case 'offerTrade':
        s.trade = { give: full(a.give), get: full(a.get), accepted: [], declined: [] };
        log(s, { t: 'offer', seat, give: s.trade.give, get: s.trade.get });
        break;
      case 'cancelTrade': s.trade = null; break;
      case 'acceptTrade':
        s.trade!.accepted.push(seat);
        s.trade!.declined = s.trade!.declined.filter((x) => x !== seat);
        break;
      case 'declineTrade':
        s.trade!.declined.push(seat);
        s.trade!.accepted = s.trade!.accepted.filter((x) => x !== seat);
        break;
      case 'confirmTrade': {
        const { give, get } = s.trade!;
        for (const r of RESOURCES) {
          s.hands[seat]![r] += get[r] - give[r];
          s.hands[a.seat]![r] += give[r] - get[r];
        }
        log(s, { t: 'trade', seat, with: a.seat, give, get });
        s.trade = null;
        break;
      }
      case 'endTurn': beginTurn(s, nextSeat(s, seat)); break;
    }
    return finish(s, events, before);
  },

  project(s, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    const ended = !!s.outcome;
    return {
      players: s.players,
      active: s.active.slice(),
      hexes: s.hexes.map((h) => ({ ...h })),
      harbors: s.harbors.map((h) => ({ ...h })),
      robber: s.robber,
      buildings: s.buildings.map((b) => (b ? { ...b } : null)),
      roads: s.roads.slice(),
      handCounts: s.hands.map(total),
      myHand: own === null ? null : { ...s.hands[own]! },
      devCounts: s.devs.map((d) => d.length),
      myDevs: own === null ? null : s.devs[own]!.map((d) => ({ card: d.card, fresh: d.turn >= s.turn })),
      knights: s.knights.slice(),
      longestRoad: s.longestRoad,
      largestArmy: s.largestArmy,
      roadLength: s.roadLength.slice(),
      publicVp: s.hands.map((_, seat) => publicVp(s, seat)),
      myVp: own === null ? null : totalVp(s, own),
      vpCards: ended ? s.devs.map((_, seat) => vpCards(s, seat)) : null,
      bank: { ...s.bank },
      devDeckCount: s.devDeck.length,
      phase: s.phase,
      current: s.current,
      turn: s.turn,
      dice: s.dice,
      owed: s.owed.slice(),
      freeRoads: s.freeRoads,
      stealFrom: s.stealFrom.slice(),
      trade: s.trade ? structuredClone(s.trade) : null,
      devPlayed: s.devPlayed,
      lastSettlement: s.lastSettlement,
      // The stolen card is known only to the thief and the victim.
      log: s.log.map((e) => (e.t === 'steal' && own !== e.seat && own !== e.from ? { ...e, res: null } : { ...e })),
      outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const seat = viewer.seat;
    const out: { type: string; [k: string]: unknown }[] = [];
    const hand = s.hands[seat]!;
    if (s.phase === 'discard' && s.owed[seat]) out.push({ type: 'discard', count: s.owed[seat] });
    if (seat !== s.current) {
      if (s.trade && s.phase === 'main') {
        if (!s.trade.accepted.includes(seat) && covers(hand, s.trade.get)) out.push({ type: 'acceptTrade' });
        if (!s.trade.declined.includes(seat)) out.push({ type: 'declineTrade' });
      }
      out.push({ type: 'resign' });
      return out;
    }
    const main = s.phase === 'main';
    if (s.phase === 'setupSettlement') for (const v of legalSettlements(s, seat)) out.push({ type: 'buildSettlement', vertex: v });
    if (s.phase === 'setupRoad' || s.phase === 'roadBuilding' || (main && covers(hand, COST.road))) {
      for (const e of legalRoads(s, seat)) out.push({ type: 'buildRoad', edge: e });
    }
    if (s.phase === 'roll') out.push({ type: 'roll' });
    if (s.phase === 'robber') s.hexes.forEach((_, h) => { if (h !== s.robber) out.push({ type: 'moveRobber', hex: h }); });
    if (s.phase === 'steal') for (const o of s.stealFrom) out.push({ type: 'steal', seat: o });
    if (main) {
      if (covers(hand, COST.settlement)) for (const v of legalSettlements(s, seat)) out.push({ type: 'buildSettlement', vertex: v });
      if (covers(hand, COST.city)) s.buildings.forEach((_, v) => { if (canCity(s, seat, v)) out.push({ type: 'buildCity', vertex: v }); });
      if (covers(hand, COST.dev) && s.devDeck.length) out.push({ type: 'buyDev' });
      for (const give of RESOURCES) {
        const rate = tradeRate(s, seat, give);
        if (hand[give] < rate) continue;
        for (const get of RESOURCES) if (get !== give && s.bank[get] > 0) out.push({ type: 'bankTrade', give, get, rate });
      }
      if (total(hand) > 0) out.push({ type: 'offerTrade' });
      if (s.trade) {
        out.push({ type: 'cancelTrade' });
        for (const o of s.trade.accepted) if (s.active[o]) out.push({ type: 'confirmTrade', seat: o });
      }
      out.push({ type: 'endTurn' });
    }
    if (playableDev(s, seat, 'knight')) out.push({ type: 'playKnight' });
    if (playableDev(s, seat, 'road')) out.push({ type: 'playRoadBuilding' });
    if (playableDev(s, seat, 'plenty')) out.push({ type: 'playPlenty' });
    if (playableDev(s, seat, 'monopoly')) out.push({ type: 'playMonopoly' });
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _event, ctx) {
    if (s.outcome) return finish(s, [], turnKey(s));
    const before = turnKey(s);
    const events: Events = [];
    const strike = (seat: number) => {
      events.push({ type: 'timed-out', seat });
      log(s, { t: 'timeout', seat });
      s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
      return s.timeouts[seat]! >= MAX_TIMEOUTS;
    };
    if (s.phase === 'discard') {
      // Everyone still owing discards from their largest piles; the roller then moves the robber.
      for (const seat of activeSeats(s)) {
        if (!s.owed[seat]) continue;
        const out = strike(seat);
        doDiscard(s, seat, autoDiscard(s.hands[seat]!, s.owed[seat]!));
        if (out) removeSeat(s, seat, 'timeout');
      }
      return finish(s, events, before);
    }
    const seat = s.current;
    if (strike(seat)) { removeSeat(s, seat, 'timeout'); return finish(s, events, before); }
    // Do the minimum for the player and pass the turn: set-up pieces at the best spot, roll, robber, end turn.
    for (let guard = 0; guard < 20 && !s.outcome && s.current === seat; guard++) {
      // Set-up: this placement only (the same seat places twice in a row at the turn of the snake order).
      if (s.phase === 'setupSettlement') {
        const best = legalSettlements(s, seat).sort((v, w) => spotValue(s, w) - spotValue(s, v) || v - w)[0]!;
        build(s, seat, 'settlement', best);
        build(s, seat, 'road', legalRoads(s, seat)[0]!);
        break;
      }
      if (s.phase === 'setupRoad') { build(s, seat, 'road', legalRoads(s, seat)[0]!); break; }
      if (s.phase === 'roadBuilding') {
        const e = legalRoads(s, seat)[0];
        if (e === undefined) { s.freeRoads = 0; s.phase = s.resume; } else build(s, seat, 'road', e);
      } else if (s.phase === 'roll') roll(s, ctx.rng);
      else if (s.phase === 'robber') moveRobber(s, autoRobberHex(s, seat), ctx.rng);
      else if (s.phase === 'steal') steal(s, s.stealFrom[0]!, ctx.rng);
      else if (s.phase === 'main') { beginTurn(s, nextSeat(s, seat)); break; }
      else break; // a 7 made others discard: wait for them
    }
    return finish(s, events, before);
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'discard' ? s.owed.flatMap((o, seat) => (o > 0 ? [seat] : [])) : [s.current]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'در کاتان با ساختن آبادی، شهر و جاده امتیاز می‌گیرید؛ اولین کسی که در نوبت خودش به ۱۰ امتیاز برسد برنده است. شما ۸ امتیاز دارید و این نوبت می‌توانید بازی را ببرید.',
    steps: [
      { instructionFa: 'هر نوبت با ریختن تاس شروع می‌شود. تاس بریزید: هر شش‌ضلعی که عددش بیاید به آبادی‌های کنارش ۱ کارت و به شهرها ۲ کارت می‌دهد.', expected: { type: 'roll' }, reply: null },
      { instructionFa: '۸ آمد: شهرتان کنار کوهستان ۸ دو سنگ و آبادی‌تان کنار جنگل ۸ یک چوب گرفت. برای شهر گندم کم دارید: ۴ پشم را با بانک به ۱ گندم معامله کنید.', expected: { type: 'bankTrade', give: 'wool', get: 'grain' }, reply: null },
      { instructionFa: 'جاده با ۱ آجر و ۱ چوب ساخته می‌شود و باید به جاده یا آبادی خودتان وصل باشد. جاده مشخص‌شده را بسازید.', expected: { type: 'buildRoad', edge: TUTORIAL.newRoad }, reply: null },
      { instructionFa: 'آبادی (آجر، چوب، پشم، گندم) فقط کنار جاده خودتان و با فاصله دست‌کم دو مسیر از هر آبادی دیگر ساخته می‌شود. آبادی را در انتهای جاده تازه بسازید (۹ امتیاز).', expected: { type: 'buildSettlement', vertex: TUTORIAL.newSettlement }, reply: null },
      { instructionFa: 'شهر (۳ سنگ و ۲ گندم) جای یکی از آبادی‌هایتان را می‌گیرد و ۲ امتیاز دارد. آبادی مشخص‌شده را به شهر تبدیل کنید و با ۱۰ امتیاز ببرید.', expected: { type: 'buildCity', vertex: TUTORIAL.upgrade }, reply: null }
    ],
    completedFa: 'آموزش تمام شد. در بازی واقعی ابتدا هر نفر دو آبادی و دو جاده می‌گذارد؛ عدد ۷ دزد را فعال می‌کند و کارت‌های توسعه، بندرها و معامله با بازیکنان هم در کارند.'
  }
};

/** Placement value for timeouts: total dots of the adjacent number tokens. */
const spotValue = (s: CatanState, v: number) => VERTICES[v]!.hexes.reduce((a, h) => a + pips(s.hexes[h]!.number), 0);
