// Heat: Pedal to the Metal («هیت»), 2–6 players. A round: everyone secretly shifts gear (±1 free, ±2 costs 1 Heat)
// and plays as many cards as the gear; then, in race order (furthest car first, racing line before outside lane),
// each car reveals and moves its speed, may Boost (1 Heat: flip until a speed card), takes Adrenaline if last
// (+1 speed and +1 cooldown), cools down (gear 1: 3, gear 2: 1), may Slipstream (+2 when sharing or directly behind
// a car), then pays Heat for every corner crossed above its limit — or spins out (back before the corner, Stress
// cards, 1st gear). Discard, refill to 7. A space holds two cars. The race ends when every car has crossed the line;
// finishing order = round of crossing, then distance beyond the line, then race order. Options: track, laps,
// weather + road conditions, garage upgrade draft, championship (several races, points 9/6/4/3/2/1).
// Hidden: decks, hands, secret plans, garage supply, RNG.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { heat as def } from './definition.ts';
import { TRACK_IDS, trackOf, type TrackId } from './tracks.ts';

export const HAND_SIZE = 7;
/** Cooldown granted by gear (index = gear). */
export const GEAR_COOL = [0, 3, 1, 0, 0];
export const RACE_POINTS = [9, 6, 4, 3, 2, 1];
export const SLIP = 2;
/** Safety cap: a race that has not finished after this many rounds ends, unfinished cars ranked by position. */
export const MAX_ROUNDS = 60;
export const DRAFT_ROUNDS = 3;

// ---------- cards ----------
export type GarageId = 'radiator' | 'cooler' | 'fan' | 'turbo' | 'nitro' | 'injector' | 'tires' | 'slicks' | 'brakes' | 'wing' | 'spoiler' | 'chassis' | 'carbon' | 'gearbox' | 'intercooler';
export interface GarageDef { nameFa: string; v: number; heat?: number; cool?: number; scrap?: number; stress?: number; superCool?: number; slip?: number; limit?: number; refresh?: boolean }
/** Garage upgrade cards (two copies each in the supply). heat = Heat paid to play it. */
export const GARAGE: Record<GarageId, GarageDef> = {
  radiator: { nameFa: 'رادیاتور', v: 1, cool: 3 },
  cooler: { nameFa: 'خنک‌کن روغن', v: 2, cool: 2 },
  fan: { nameFa: 'فن خنک‌کاری', v: 3, cool: 1 },
  turbo: { nameFa: 'توربوشارژر', v: 6, heat: 1 },
  nitro: { nameFa: 'نیتروژن', v: 8, heat: 2 },
  injector: { nameFa: 'انژکتور', v: 5, scrap: 2 },
  tires: { nameFa: 'لاستیک نرم', v: 2, limit: 1 },
  slicks: { nameFa: 'لاستیک اسلیک', v: 4, limit: 1, heat: 1 },
  brakes: { nameFa: 'ترمز سرامیکی', v: 1, limit: 2 },
  wing: { nameFa: 'بال عقب', v: 3, slip: 1 },
  spoiler: { nameFa: 'اسپویلر', v: 2, slip: 2 },
  chassis: { nameFa: 'شاسی سبک', v: 3, stress: 1 },
  carbon: { nameFa: 'بدنهٔ کربنی', v: 4, stress: 1, scrap: 1 },
  gearbox: { nameFa: 'گیربکس مسابقه', v: 2, refresh: true },
  intercooler: { nameFa: 'اینترکولر', v: 2, superCool: 2 }
};
export const GARAGE_IDS = Object.keys(GARAGE) as GarageId[];

export interface Card { id: number; k: 'speed' | 'heat' | 'stress' | 'garage'; v?: number; g?: GarageId; up?: boolean }
export const hasSpeed = (c: Card) => c.k === 'speed' || c.k === 'garage';
const heatCost = (c: Card) => (c.k === 'garage' ? GARAGE[c.g!].heat ?? 0 : 0);

// ---------- weather & road conditions ----------
export type WeatherId = 'sun' | 'rain' | 'fog' | 'cold' | 'heatwave';
export const WEATHER: Record<WeatherId, { nameFa: string; engine?: number; stress?: number; deckHeat?: number; cool?: number; slip?: number; noSlip?: boolean }> = {
  sun: { nameFa: 'آفتابی', engine: 1, slip: 1 },
  rain: { nameFa: 'باران', stress: 1, cool: 1 },
  fog: { nameFa: 'مه', noSlip: true },
  cold: { nameFa: 'سرمای شدید', engine: -1, cool: 1 },
  heatwave: { nameFa: 'موج گرما', deckHeat: 1, cool: -1 }
};
export const WEATHER_IDS = Object.keys(WEATHER) as WeatherId[];
export type RoadId = 'up' | 'down' | 'overheat' | 'slip';
export const ROAD_IDS: RoadId[] = ['up', 'down', 'overheat', 'slip'];

// ---------- state ----------
export interface Racer {
  hand: Card[]; deck: Card[]; discard: Card[]; engine: Card[];
  gear: number; pos: number; lane: number;
  /** Secret plan for this round (hidden until the car's turn). */
  plan: { gear: number; cards: number[] } | null;
  /** Revealed this round. */
  played: Card[]; flips: Card[]; speed: number; start: number; revealed: boolean; boosted: boolean; adrenaline: boolean;
  finished: { round: number; over: number; seq: number } | null;
  resigned: number | null;
  points: number; results: (number | null)[];
}
export interface LogEntry { seat: number; e: 'shift' | 'move' | 'stress' | 'boost' | 'adrenaline' | 'cool' | 'slip' | 'corner' | 'spin' | 'finish' | 'scrap' | 'pick' | 'timeout' | 'resign'; n?: number; to?: number; at?: number }
export interface HeatOptions { track: TrackId; laps: number; weather: boolean; garage: boolean; races: number }
export interface HeatState {
  players: number;
  opts: HeatOptions;
  tracks: TrackId[];
  race: number;
  track: TrackId;
  laps: number;
  weather: WeatherId | null;
  road: (RoadId | null)[];
  phase: 'draft' | 'plan' | 'react' | 'over';
  round: number;
  racers: Racer[];
  grid: number[];
  order: number[];
  turn: number;
  draft: { round: number; market: Card[]; pickers: number[] } | null;
  supply: Card[];
  nextId: number;
  finishSeq: number;
  resignSeq: number;
  log: LogEntry[];
  history: { track: TrackId; order: number[] }[];
  seq: number;
  outcome: Outcome | null;
}

export interface RacerView {
  gear: number; pos: number; lane: number; engine: number; deck: number; discard: number; discardTop: Card | null; hand: number;
  planned: boolean; played: Card[]; flips: Card[]; speed: number; revealed: boolean; boosted: boolean; adrenaline: boolean;
  finished: Racer['finished']; resigned: boolean; points: number; results: (number | null)[];
}
export interface HeatView {
  players: number; track: TrackId; laps: number; race: number; races: number; weather: WeatherId | null; road: (RoadId | null)[];
  garage: boolean; phase: HeatState['phase']; round: number; racers: RacerView[]; order: number[]; current: number | null;
  draft: { round: number; market: Card[]; picker: number | null } | null; log: LogEntry[]; history: HeatState['history']; seq: number; outcome: Outcome | null;
  me: { seat: number; hand: Card[]; plan: { gear: number; cards: number[] } | null; deckStress: number } | null;
}

const ids = z.array(z.number().int().min(0).max(100000)).max(7);
export const heatAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('plan'), gear: z.number().int().min(1).max(4), cards: ids }),
  z.strictObject({ type: z.literal('boost') }),
  z.strictObject({ type: z.literal('react'), adrenaline: z.boolean(), slipstream: z.boolean(), discard: ids }),
  z.strictObject({ type: z.literal('pick'), card: z.number().int().min(0).max(100000) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type HeatAction = z.infer<typeof heatAction>;

// ---------- helpers ----------
function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const racing = (r: Racer) => !r.finished && r.resigned === null;
const card = (s: HeatState, c: Omit<Card, 'id'>): Card => ({ id: s.nextId++, ...c });
const finishLine = (s: HeatState) => s.laps * trackOf(s.track).length;
const log = (s: HeatState, e: LogEntry) => { s.log.push(e); if (s.log.length > 40) s.log.shift(); };

function draw(r: Racer, rng: EngineRng): Card | null {
  if (!r.deck.length) {
    if (!r.discard.length) return null;
    r.deck = shuffle(rng, r.discard);
    r.discard = [];
  }
  return r.deck.shift()!;
}
function refill(r: Racer, rng: EngineRng) {
  while (r.hand.length < HAND_SIZE) { const c = draw(r, rng); if (!c) break; r.hand.push(c); }
}
/** Flip cards from the deck until one with a speed value; flipped cards go to the discard pile. */
function flipSpeed(r: Racer, rng: EngineRng): Card | null {
  const aside: Card[] = [];
  let got: Card | null = null;
  for (let i = 0; i < 80; i++) {
    const c = draw(r, rng);
    if (!c) break;
    aside.push(c);
    if (hasSpeed(c)) { got = c; break; }
  }
  r.flips.push(...aside);
  r.discard.push(...aside);
  return got;
}
function payHeat(r: Racer, n: number) { for (let i = 0; i < n && r.engine.length; i++) r.discard.push(r.engine.pop()!); }

/** Cars on the board other than `seat` at absolute position `p`. */
const carsAt = (s: HeatState, seat: number, p: number) => s.racers.flatMap((r, i) => (i !== seat && racing(r) && r.pos === p ? [r.lane] : []));
/** First space at or behind `target` with a free spot. */
export function freeSpot(s: HeatState, seat: number, target: number): { pos: number; lane: number } {
  for (let t = target; ; t--) {
    const lanes = carsAt(s, seat, t);
    if (lanes.length < 2) return { pos: t, lane: lanes.includes(0) ? 1 : 0 };
  }
}
function moveTo(s: HeatState, seat: number, target: number) {
  const r = s.racers[seat]!;
  const f = freeSpot(s, seat, target);
  r.pos = f.pos; r.lane = f.lane;
}
export const canSlip = (s: HeatState, seat: number, p: number) =>
  !(s.weather && WEATHER[s.weather].noSlip) && (carsAt(s, seat, p).length > 0 || carsAt(s, seat, p + 1).length > 0);

/** Race order: furthest first, racing line (lane 0) before the outside lane. */
export function raceOrder(s: HeatState): number[] {
  return s.racers.map((r, i) => ({ r, i })).filter((x) => racing(x.r)).sort((a, b) => b.r.pos - a.r.pos || a.r.lane - b.r.lane || a.i - b.i).map((x) => x.i);
}

/** Cards that can be played normally: everything but Heat, and garage cards whose Heat cost the engine covers. */
const playable = (r: Racer) => r.hand.filter((c) => c.k !== 'heat' && heatCost(c) <= r.engine.length);
/** Gears the racer may choose this round and their Heat cost (±2 gears = 1 Heat; never more gears than playable cards). */
export function gearOptions(r: Racer): { gear: number; cost: number }[] {
  const p = playable(r).length;
  if (p === 0) return [{ gear: 1, cost: 0 }];
  const out: { gear: number; cost: number }[] = [];
  for (let g = 1; g <= 4; g++) {
    const d = Math.abs(g - r.gear);
    if (d > 2 || g > p) continue;
    const cost = d === 2 ? 1 : 0;
    if (cost > r.engine.length) continue;
    out.push({ gear: g, cost });
  }
  if (!out.length) out.push({ gear: Math.max(1, Math.min(p, r.gear)), cost: 0 });
  return out;
}

function cornerMods(s: HeatState, idx: number) {
  const road = s.road[idx] ?? null;
  return { limit: road === 'up' ? 1 : road === 'down' ? -1 : 0, extra: road === 'overheat' ? 1 : 0 };
}
/** Slipstream bonus of the road sector the car is in (sector = from a corner to the next). */
function sectorSlip(s: HeatState, p: number) {
  const t = trackOf(s.track);
  const m = ((p % t.length) + t.length) % t.length;
  let idx = -1;
  t.corners.forEach((c, i) => { if (c.at <= m) idx = i; });
  if (idx < 0) idx = t.corners.length - 1;
  return s.road[idx] === 'slip' ? 1 : 0;
}

// ---------- race setup ----------
function startingDeck(s: HeatState, stress: number, extraHeat: number): Card[] {
  const out: Card[] = [];
  for (let v = 1; v <= 4; v++) for (let i = 0; i < 3; i++) out.push(card(s, { k: 'speed', v }));
  out.push(card(s, { k: 'speed', v: 0, up: true }), card(s, { k: 'speed', v: 5, up: true }), card(s, { k: 'heat', up: true }));
  for (let i = 0; i < stress; i++) out.push(card(s, { k: 'stress' }));
  for (let i = 0; i < extraHeat; i++) out.push(card(s, { k: 'heat' }));
  return out;
}

function setupRace(s: HeatState, rng: EngineRng) {
  s.track = s.tracks[s.race]!;
  const t = trackOf(s.track);
  s.weather = s.opts.weather ? WEATHER_IDS[rng.nextInt(WEATHER_IDS.length)]! : null;
  s.road = t.corners.map(() => (s.opts.weather ? ROAD_IDS[rng.nextInt(ROAD_IDS.length)]! : null));
  const w: (typeof WEATHER)[WeatherId] | Record<string, never> = s.weather ? WEATHER[s.weather] : {};
  const live = s.racers.map((_, i) => i).filter((i) => s.racers[i]!.resigned === null);
  // First race: random grid. Championship: the leader starts at the back (fewest points first; ties: worse last result first).
  s.grid = s.race === 0 ? shuffle(rng, live)
    : live.slice().sort((a, b) => s.racers[a]!.points - s.racers[b]!.points || (s.racers[b]!.results[s.race - 1] ?? 99) - (s.racers[a]!.results[s.race - 1] ?? 99) || a - b);
  s.grid.forEach((seat, i) => {
    const r = s.racers[seat]!;
    r.hand = []; r.discard = []; r.plan = null; r.played = []; r.flips = []; r.speed = 0; r.revealed = false; r.boosted = false; r.adrenaline = false;
    r.finished = null; r.gear = 1; r.pos = -1 - Math.floor(i / 2); r.lane = i % 2;
    r.deck = startingDeck(s, t.stress + (w.stress ?? 0), w.deckHeat ?? 0);
    r.engine = Array.from({ length: Math.max(0, t.heat + (w.engine ?? 0)) }, () => card(s, { k: 'heat' }));
  });
  s.round = 1;
  s.order = [];
  s.turn = 0;
  s.log = [];
  if (s.opts.garage) {
    const supply: Card[] = [];
    for (const g of GARAGE_IDS) for (let i = 0; i < 2; i++) supply.push(card(s, { k: 'garage', v: GARAGE[g].v, g }));
    s.supply = shuffle(rng, supply);
    s.phase = 'draft';
    dealMarket(s, 1);
  } else beginRace(s, rng);
}
function dealMarket(s: HeatState, round: number) {
  const live = s.grid.filter((i) => s.racers[i]!.resigned === null);
  s.draft = { round, market: s.supply.splice(0, live.length + 3), pickers: live.slice().reverse() };
}
function beginRace(s: HeatState, rng: EngineRng) {
  s.draft = null;
  s.supply = [];
  for (const seat of s.grid) {
    const r = s.racers[seat]!;
    r.deck = shuffle(rng, r.deck);
    refill(r, rng);
  }
  s.phase = 'plan';
}

// ---------- the round ----------
function resolveStart(s: HeatState, rng: EngineRng) {
  s.order = raceOrder(s);
  const adr = s.order.length < 2 ? 0 : s.players >= 5 ? 2 : 1;
  for (const r of s.racers) { r.played = []; r.flips = []; r.speed = 0; r.revealed = false; r.boosted = false; r.adrenaline = false; }
  s.order.slice(s.order.length - adr).forEach((seat) => { s.racers[seat]!.adrenaline = true; });
  s.log = [];
  for (const seat of s.order) {
    const r = s.racers[seat]!;
    const p = r.plan!;
    const d = Math.abs(p.gear - r.gear);
    if (d === 2) payHeat(r, 1);
    if (d) log(s, { seat, e: 'shift', n: p.gear, to: d === 2 ? 1 : 0 });
    r.gear = p.gear;
  }
  s.turn = 0;
  startTurn(s, rng);
}

/** Reveal & move for the car whose turn it is; skips cars that left the race. */
function startTurn(s: HeatState, rng: EngineRng) {
  while (s.turn < s.order.length && !racing(s.racers[s.order[s.turn]!]!)) s.turn++;
  if (s.turn >= s.order.length) { endRound(s, rng); return; }
  const seat = s.order[s.turn]!;
  const r = s.racers[seat]!;
  const plan = r.plan!;
  r.plan = null;
  r.start = r.pos;
  r.played = plan.cards.map((id) => r.hand.find((c) => c.id === id)!).filter(Boolean);
  r.hand = r.hand.filter((c) => !plan.cards.includes(c.id));
  r.revealed = true;
  let speed = 0;
  for (const c of r.played) {
    if (c.k === 'heat') continue;
    if (c.k === 'stress') {
      const f = flipSpeed(r, rng);
      const v = f?.v ?? 0;
      speed += v;
      log(s, { seat, e: 'stress', n: v });
    } else {
      const g = c.k === 'garage' ? GARAGE[c.g!] : null;
      // A garage card whose Heat the engine cannot pay only reaches play as the forced card: speed 0, no effect.
      if (g?.heat && r.engine.length < g.heat) continue;
      speed += c.v ?? 0;
      if (g?.heat) payHeat(r, g.heat);
      if (g?.scrap) { for (let i = 0; i < g.scrap; i++) { const x = draw(r, rng); if (x) r.discard.push(x); } log(s, { seat, e: 'scrap', n: g.scrap }); }
    }
  }
  r.speed = speed;
  moveTo(s, seat, r.pos + speed);
  log(s, { seat, e: 'move', n: speed, to: r.pos });
  s.phase = 'react';
}

function garageSum(r: Racer, key: 'cool' | 'slip' | 'limit' | 'stress' | 'superCool') {
  return r.played.reduce((a, c) => a + (c.k === 'garage' ? GARAGE[c.g!][key] ?? 0 : 0), 0);
}

/** Cooldown available this turn (gear, cards, adrenaline, weather). */
export function cooldownOf(s: HeatState, r: Racer) {
  return Math.max(0, GEAR_COOL[r.gear]! + garageSum(r, 'cool') + (r.adrenaline ? 1 : 0) + (s.weather ? WEATHER[s.weather].cool ?? 0 : 0));
}

function endTurn(s: HeatState, seat: number, a: { adrenaline: boolean; slipstream: boolean; discard: number[] }, rng: EngineRng) {
  const r = s.racers[seat]!;
  // Adrenaline: +1 speed (optional; counts for corners).
  if (a.adrenaline && r.adrenaline) { r.speed += 1; moveTo(s, seat, r.pos + 1); log(s, { seat, e: 'adrenaline', to: r.pos }); }
  // Cooldown: Heat from hand back to the engine.
  const cool = Math.min(cooldownOf(s, r), r.hand.filter((c) => c.k === 'heat').length);
  for (let i = 0; i < cool; i++) { const k = r.hand.findIndex((c) => c.k === 'heat'); r.engine.push(r.hand.splice(k, 1)[0]!); }
  if (cool) log(s, { seat, e: 'cool', n: cool });
  for (let i = 0, n = garageSum(r, 'stress'); i < n; i++) { const k = r.hand.findIndex((c) => c.k === 'stress'); if (k >= 0) r.discard.push(r.hand.splice(k, 1)[0]!); }
  for (let i = 0, n = garageSum(r, 'superCool'); i < n; i++) { const k = r.discard.findIndex((c) => c.k === 'heat'); if (k >= 0) r.engine.push(r.discard.splice(k, 1)[0]!); }
  // Slipstream: +2 (does not count as speed for corners).
  if (a.slipstream && canSlip(s, seat, r.pos)) {
    const n = SLIP + garageSum(r, 'slip') + (s.weather ? WEATHER[s.weather].slip ?? 0 : 0) + sectorSlip(s, r.pos);
    moveTo(s, seat, r.pos + n);
    log(s, { seat, e: 'slip', n, to: r.pos });
  }
  // Corners crossed this turn, in order.
  const t = trackOf(s.track);
  const line = finishLine(s);
  const bonus = garageSum(r, 'limit');
  const crossed: { abs: number; idx: number }[] = [];
  for (let lap = 0; lap <= s.laps; lap++) t.corners.forEach((c, idx) => { const abs = lap * t.length + c.at; if (abs > r.start && abs <= r.pos && abs < line) crossed.push({ abs, idx }); });
  crossed.sort((x, y) => x.abs - y.abs);
  for (const { abs, idx } of crossed) {
    const m = cornerMods(s, idx);
    const limit = Math.max(1, t.corners[idx]!.limit + m.limit) + bonus;
    const excess = r.speed - limit;
    if (excess <= 0) continue;
    const cost = excess + m.extra;
    if (r.engine.length >= cost) { payHeat(r, cost); log(s, { seat, e: 'corner', n: cost, at: idx }); continue; }
    // Spin out.
    const stress = r.gear <= 2 ? 1 : 2;
    for (let i = 0; i < stress; i++) r.hand.push(card(s, { k: 'stress' }));
    r.gear = 1;
    moveTo(s, seat, abs - 1);
    log(s, { seat, e: 'spin', n: stress, at: idx, to: r.pos });
    break;
  }
  // Discard chosen cards, played cards to the discard pile (refresh cards on top of the deck), refill.
  for (const id of a.discard) { const k = r.hand.findIndex((c) => c.id === id); if (k >= 0) r.discard.push(r.hand.splice(k, 1)[0]!); }
  for (const c of r.played) { if (c.k === 'garage' && GARAGE[c.g!].refresh) r.deck.unshift(c); else r.discard.push(c); }
  refill(r, rng);
  if (r.pos >= line) { r.finished = { round: s.round, over: r.pos - line, seq: s.finishSeq++ }; log(s, { seat, e: 'finish', n: r.pos - line }); }
  s.turn += 1;
  startTurn(s, rng);
}

function endRound(s: HeatState, rng: EngineRng) {
  s.order = [];
  const live = s.racers.filter((r) => r.resigned === null);
  if (!live.some(racing) || s.round >= MAX_ROUNDS) { endRace(s, rng); return; }
  s.round += 1;
  s.phase = 'plan';
}

/** Finishing order of this race (resigned cars excluded). */
export function finishOrder(s: HeatState): number[] {
  return s.racers.map((r, i) => ({ r, i })).filter((x) => x.r.resigned === null).sort((a, b) => {
    const fa = a.r.finished, fb = b.r.finished;
    if (fa && fb) return fa.round - fb.round || fb.over - fa.over || fa.seq - fb.seq;
    if (fa || fb) return fa ? -1 : 1;
    return b.r.pos - a.r.pos || a.r.lane - b.r.lane || a.i - b.i;
  }).map((x) => x.i);
}

function endRace(s: HeatState, rng: EngineRng) {
  const order = finishOrder(s);
  order.forEach((seat, place) => { const r = s.racers[seat]!; r.points += RACE_POINTS[place] ?? 0; r.results[s.race] = place + 1; });
  s.history.push({ track: s.track, order });
  if (s.race + 1 < s.tracks.length) { s.race += 1; setupRace(s, rng); return; }
  s.phase = 'over';
  s.outcome = { placements: standings(s), reason: 'score' };
}

/** Final placements: championship points, ties broken by the last race; resigned players last (latest resignation better). */
function standings(s: HeatState, reason?: 'resign'): Outcome['placements'] {
  const last = s.history.length - 1;
  const live = s.racers.map((r, i) => ({ r, i })).filter((x) => x.r.resigned === null);
  const ordered = reason === 'resign' && !s.history.length
    ? live.sort((a, b) => b.r.pos - a.r.pos || a.i - b.i)
    : live.sort((a, b) => b.r.points - a.r.points || (a.r.results[last] ?? 99) - (b.r.results[last] ?? 99) || b.r.pos - a.r.pos || a.i - b.i);
  const out = ordered.map((x, k) => ({ seat: x.i, place: k + 1, score: x.r.points }));
  const gone = s.racers.map((r, i) => ({ r, i })).filter((x) => x.r.resigned !== null).sort((a, b) => b.r.resigned! - a.r.resigned!);
  for (const x of gone) out.push({ seat: x.i, place: out.length + 1, score: x.r.points });
  return out;
}

/** Deterministic play for a missed deadline: keep the gear if possible (else the nearest free one), play the slowest cards. */
export function autoPlan(r: Racer): { gear: number; cards: number[] } {
  const opts = gearOptions(r);
  if (playable(r).length === 0) return { gear: 1, cards: [r.hand[0]!.id] };
  const free = opts.filter((o) => o.cost === 0);
  const pool = (free.length ? free : opts).slice().sort((a, b) => (a.gear === r.gear ? -1 : b.gear === r.gear ? 1 : a.gear <= r.gear && b.gear <= r.gear ? b.gear - a.gear : a.gear - b.gear));
  const val = (c: Card) => (c.k === 'stress' ? 2.5 : c.v ?? 0) + heatCost(c) * 10;
  const cards = playable(r).sort((a, b) => val(a) - val(b) || a.id - b.id);
  for (const o of pool) {
    const pick = cards.slice(0, o.gear);
    if (pick.length === o.gear && o.cost + pick.reduce((a, c) => a + heatCost(c), 0) <= r.engine.length) return { gear: o.gear, cards: pick.map((c) => c.id).sort((a, b) => a - b) };
  }
  const o = pool[0]!;
  return { gear: o.gear, cards: cards.slice(0, o.gear).map((c) => c.id).sort((a, b) => a - b) };
}

// ---------- tutorial teaching position ----------
function tutorialSetup(s: HeatState) {
  // USA, one lap (finish line = space 54). Corner limits there: 36 → 6, 45 → 4.
  s.tracks = ['usa']; s.track = 'usa'; s.laps = 1; s.weather = null; s.road = trackOf('usa').corners.map(() => null);
  s.grid = [1, 0];
  const mk = (id: number, k: Card['k'], v?: number): Card => (v === undefined ? { id, k } : { id, k, v });
  const sp = (id: number, v: number) => mk(id, 'speed', v);
  const me = s.racers[0]!, op = s.racers[1]!;
  Object.assign(me, {
    gear: 2, pos: 37, lane: 0,
    hand: [sp(1, 1), sp(2, 1), sp(3, 2), mk(4, 'heat'), sp(5, 2), sp(6, 3), sp(7, 4)],
    deck: [sp(8, 1), sp(9, 1), sp(10, 2), mk(11, 'stress'), mk(12, 'heat'), sp(13, 2), sp(14, 3), sp(15, 4), sp(16, 1), sp(17, 2), sp(18, 3), sp(19, 4), sp(20, 1), sp(21, 3)],
    discard: [], engine: [mk(22, 'heat'), mk(23, 'heat'), mk(24, 'heat'), mk(25, 'heat'), mk(26, 'heat')]
  });
  Object.assign(op, {
    gear: 2, pos: 38, lane: 0,
    hand: [sp(101, 1), sp(102, 3), sp(103, 2), sp(104, 2), sp(105, 3), sp(106, 3), sp(107, 4)],
    deck: [sp(108, 3), sp(109, 4), sp(110, 1), sp(111, 2), sp(112, 1), sp(113, 2), sp(114, 3), sp(115, 4), sp(116, 1), sp(117, 2)],
    discard: [], engine: [mk(122, 'heat'), mk(123, 'heat'), mk(124, 'heat'), mk(125, 'heat'), mk(126, 'heat'), mk(127, 'heat')],
    plan: { gear: 2, cards: [101, 102] }
  });
  s.nextId = 200;
  s.phase = 'plan';
}

// ---------- module ----------
type Events = Transition<HeatState>['internalEvents'];
const step = (s: HeatState, events: Events, changed = true): Transition<HeatState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : changed ? [{ kind: 'set', deadlineKey: 'turn' }] : [] });

function afterPlan(s: HeatState, rng: EngineRng): boolean {
  if (s.racers.some((r) => racing(r) && !r.plan)) return false;
  resolveStart(s, rng);
  return true;
}
function doPick(s: HeatState, seat: number, id: number, rng: EngineRng) {
  const d = s.draft!;
  const k = d.market.findIndex((c) => c.id === id);
  const c = d.market.splice(k, 1)[0]!;
  s.racers[seat]!.deck.push(c);
  d.pickers.shift();
  log(s, { seat, e: 'pick', n: c.id });
  advanceDraft(s, rng);
}
function advanceDraft(s: HeatState, rng: EngineRng) {
  const d = s.draft!;
  while (d.pickers.length && s.racers[d.pickers[0]!]!.resigned !== null) d.pickers.shift();
  if (d.pickers.length) return;
  if (d.round < DRAFT_ROUNDS && s.supply.length) dealMarket(s, d.round + 1);
  else beginRace(s, rng);
}

function readOptions(o: Record<string, unknown>): HeatOptions {
  const track = TRACK_IDS.includes(o.track as TrackId) ? (o.track as TrackId) : 'usa';
  const laps = [1, 2, 3].includes(Number(o.laps)) ? Number(o.laps) : 2;
  const races = [1, 2, 3, 4].includes(Number(o.races)) ? Number(o.races) : 1;
  return { track, laps, weather: o.weather === true || o.weather === 'on', garage: o.garage === true || o.garage === 'on', races };
}

function resign(s: HeatState, seat: number, rng: EngineRng): Events {
  const r = s.racers[seat]!;
  r.resigned = s.resignSeq++;
  r.plan = null;
  log(s, { seat, e: 'resign' });
  const live = s.racers.filter((x) => x.resigned === null).length;
  if (live <= 1) { s.phase = 'over'; s.outcome = { placements: standings(s, 'resign'), reason: 'resign' }; return [{ type: 'resigned', seat }]; }
  if (s.phase === 'draft') { if (s.draft!.pickers[0] === seat) s.draft!.pickers.shift(); advanceDraft(s, rng); }
  else if (s.phase === 'plan') afterPlan(s, rng);
  else if (s.phase === 'react' && s.order[s.turn] === seat) { s.turn += 1; startTurn(s, rng); }
  return [{ type: 'resigned', seat }];
}

export function pending(s: HeatState): number[] {
  if (s.outcome) return [];
  if (s.phase === 'draft') return s.draft?.pickers.length ? [s.draft.pickers[0]!] : [];
  if (s.phase === 'plan') return s.racers.flatMap((r, i) => (racing(r) && !r.plan ? [i] : []));
  if (s.phase === 'react') { const seat = s.order[s.turn]; return seat === undefined ? [] : [seat]; }
  return [];
}

export const heatModule: GameModule<HeatState, HeatAction, HeatView> = {
  manifest: def.manifest,
  actionSchema: heatAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('heat needs 2–6 players');
    const opts = readOptions(options);
    const start = TRACK_IDS.indexOf(opts.track);
    const s: HeatState = {
      players: playerCount, opts, tracks: Array.from({ length: opts.races }, (_, i) => TRACK_IDS[(start + i) % TRACK_IDS.length]!), race: 0, track: opts.track,
      laps: opts.laps, weather: null, road: [], phase: 'plan', round: 1,
      racers: Array.from({ length: playerCount }, () => ({
        hand: [], deck: [], discard: [], engine: [], gear: 1, pos: 0, lane: 0, plan: null, played: [], flips: [], speed: 0, start: 0, revealed: false,
        boosted: false, adrenaline: false, finished: null, resigned: null, points: 0, results: []
      })),
      grid: [], order: [], turn: 0, draft: null, supply: [], nextId: 1, finishSeq: 0, resignSeq: 0, log: [], history: [], seq: 0, outcome: null
    };
    if (options.tutorial === true) tutorialSetup(s);
    else setupRace(s, rng);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const r = s.racers[actor.seat]!;
    if (r.resigned !== null) return { ok: false, errorCode: 'ALREADY_RESIGNED' };
    if (a.type === 'resign') return { ok: true };
    if (a.type === 'pick') {
      if (s.phase !== 'draft' || s.draft?.pickers[0] !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
      return s.draft.market.some((c) => c.id === a.card) ? { ok: true } : { ok: false, errorCode: 'NO_SUCH_CARD' };
    }
    if (a.type === 'plan') {
      if (s.phase !== 'plan') return { ok: false, errorCode: 'WRONG_PHASE' };
      if (!racing(r)) return { ok: false, errorCode: 'NOT_RACING' };
      if (r.plan) return { ok: false, errorCode: 'ALREADY_COMMITTED' };
      if (new Set(a.cards).size !== a.cards.length || !a.cards.every((id) => r.hand.some((c) => c.id === id))) return { ok: false, errorCode: 'NO_SUCH_CARD' };
      const g = gearOptions(r).find((o) => o.gear === a.gear);
      if (!g) return { ok: false, errorCode: 'GEAR_NOT_ALLOWED' };
      if (a.cards.length !== a.gear) return { ok: false, errorCode: 'WRONG_CARD_COUNT' };
      const cards = a.cards.map((id) => r.hand.find((c) => c.id === id)!);
      if (playable(r).length > 0 && cards.some((c) => c.k === 'heat')) return { ok: false, errorCode: 'HEAT_NOT_PLAYABLE' };
      if (playable(r).length > 0 && g.cost + cards.reduce((x, c) => x + heatCost(c), 0) > r.engine.length) return { ok: false, errorCode: 'NOT_ENOUGH_HEAT' };
      return { ok: true };
    }
    if (s.phase !== 'react' || s.order[s.turn] !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'boost') {
      if (r.boosted) return { ok: false, errorCode: 'ALREADY_BOOSTED' };
      return r.engine.length ? { ok: true } : { ok: false, errorCode: 'NOT_ENOUGH_HEAT' };
    }
    if (a.adrenaline && !r.adrenaline) return { ok: false, errorCode: 'NO_ADRENALINE' };
    if (a.slipstream && !canSlip(s, actor.seat, a.adrenaline ? freeSpot(s, actor.seat, r.pos + 1).pos : r.pos)) return { ok: false, errorCode: 'NO_SLIPSTREAM' };
    if (new Set(a.discard).size !== a.discard.length) return { ok: false, errorCode: 'NO_SUCH_CARD' };
    for (const id of a.discard) {
      const c = r.hand.find((x) => x.id === id);
      if (!c) return { ok: false, errorCode: 'NO_SUCH_CARD' };
      if (c.k === 'heat' || c.k === 'stress') return { ok: false, errorCode: 'CANNOT_DISCARD' };
    }
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') return step(s, resign(s, seat, ctx.rng));
    if (a.type === 'pick') { doPick(s, seat, a.card, ctx.rng); return step(s, [{ type: 'pick', seat, card: a.card }]); }
    if (a.type === 'plan') {
      s.racers[seat]!.plan = { gear: a.gear, cards: a.cards.slice() };
      const resolved = afterPlan(s, ctx.rng);
      return step(s, [{ type: 'plan', seat, gear: a.gear, cards: a.cards }], resolved);
    }
    const r = s.racers[seat]!;
    if (a.type === 'boost') {
      payHeat(r, 1);
      r.boosted = true;
      const f = flipSpeed(r, ctx.rng);
      const v = f?.v ?? 0;
      r.speed += v;
      moveTo(s, seat, r.pos + v);
      log(s, { seat, e: 'boost', n: v, to: r.pos });
      return step(s, [{ type: 'boost', seat, value: v }], false);
    }
    endTurn(s, seat, a, ctx.rng);
    return step(s, [{ type: 'react', seat }]);
  },

  project(s, viewer: Viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    const me = own === null ? null : s.racers[own]!;
    return {
      players: s.players, track: s.track, laps: s.laps, race: s.race, races: s.tracks.length, weather: s.weather, road: s.road.slice(), garage: s.opts.garage,
      phase: s.phase, round: s.round, order: s.order.slice(), current: s.phase === 'react' ? s.order[s.turn] ?? null : null,
      racers: s.racers.map((r) => ({
        gear: r.gear, pos: r.pos, lane: r.lane, engine: r.engine.length, deck: r.deck.length, discard: r.discard.length,
        discardTop: r.discard.length ? { ...r.discard[r.discard.length - 1]! } : null, hand: r.hand.length, planned: !!r.plan,
        played: r.revealed ? r.played.map((c) => ({ ...c })) : [], flips: r.flips.map((c) => ({ ...c })), speed: r.revealed ? r.speed : 0,
        revealed: r.revealed, boosted: r.boosted, adrenaline: r.adrenaline, finished: r.finished ? { ...r.finished } : null, resigned: r.resigned !== null,
        points: r.points, results: r.results.slice()
      })),
      draft: s.draft ? { round: s.draft.round, market: s.draft.market.map((c) => ({ ...c })), picker: s.draft.pickers[0] ?? null } : null,
      log: s.log.map((e) => ({ ...e })), history: s.history.map((h) => ({ track: h.track, order: h.order.slice() })), seq: s.seq, outcome: s.outcome,
      me: me ? { seat: own!, hand: me.hand.map((c) => ({ ...c })), plan: me.plan ? { gear: me.plan.gear, cards: me.plan.cards.slice() } : null, deckStress: me.deck.filter((c) => c.k === 'stress').length } : null
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const r = s.racers[seat];
    if (!r || r.resigned !== null) return [];
    const out: ActionHint[] = [];
    if (s.phase === 'draft' && s.draft?.pickers[0] === seat) out.push({ type: 'pick', cards: s.draft.market.map((c) => c.id) });
    if (s.phase === 'plan' && racing(r) && !r.plan) {
      const forced = playable(r).length === 0;
      out.push({ type: 'plan', gears: gearOptions(r), heat: r.engine.length, playable: (forced ? r.hand : playable(r)).map((c) => c.id) });
    }
    if (s.phase === 'react' && s.order[s.turn] === seat) {
      if (!r.boosted && r.engine.length) out.push({ type: 'boost' });
      out.push({
        type: 'react', adrenaline: r.adrenaline, slip: canSlip(s, seat, r.pos), slipAdrenaline: r.adrenaline && canSlip(s, seat, freeSpot(s, seat, r.pos + 1).pos),
        discardable: r.hand.filter((c) => c.k !== 'heat' && c.k !== 'stress').map((c) => c.id), cooldown: cooldownOf(s, r)
      });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    s.seq += 1;
    const events: Events = [];
    if (s.phase === 'draft') {
      const seat = s.draft!.pickers[0]!;
      log(s, { seat, e: 'timeout' });
      events.push({ type: 'timeout', seat });
      doPick(s, seat, s.draft!.market[0]!.id, ctx.rng);
    } else if (s.phase === 'plan') {
      s.racers.forEach((r, seat) => {
        if (!racing(r) || r.plan) return;
        r.plan = autoPlan(r);
        log(s, { seat, e: 'timeout' });
        events.push({ type: 'timeout', seat });
      });
      afterPlan(s, ctx.rng);
    } else if (s.phase === 'react') {
      const seat = s.order[s.turn]!;
      log(s, { seat, e: 'timeout' });
      events.push({ type: 'timeout', seat });
      endTurn(s, seat, { adrenaline: false, slipstream: false, discard: [] }, ctx.rng);
    }
    return step(s, events);
  },

  pendingSeats: pending,

  tutorial: {
    seed: 21,
    options: { tutorial: true },
    introFa: 'دور آخر پیست آمریکاست و خط پایان در خانهٔ ۵۴ است. ماشین شما در خانهٔ ۳۷ و در دندهٔ ۲ است و حریف یک خانه جلوتر (۳۸). هر دور همه هم‌زمان و پنهانی دنده عوض می‌کنند و به تعداد دنده کارت بازی می‌کنند؛ بعد به ترتیب مسابقه (ماشین جلوتر اول) کارت‌ها رو می‌شود و ماشین به اندازهٔ مجموع سرعت جلو می‌رود. پیچ خانهٔ ۴۵ محدودیت سرعت ۴ دارد و موتور شما ۵ کارت گرما دارد.',
    steps: [
      { instructionFa: 'یک دنده بالا بروید (۲ به ۳ رایگان است) و سه کارت ۱، ۱ و ۲ را بازی کنید: سرعت ۴. چون آخر مسابقه هستید آدرنالین دارید.', expected: { type: 'plan', gear: 3, cards: [1, 2, 3] }, reply: { type: 'react', adrenaline: false, slipstream: false, discard: [] } },
      { instructionFa: 'حریف به خانهٔ ۴۲ رسید و شما به ۴۱. آدرنالین (+۱ سرعت) را بزنید تا کنار حریف در خانهٔ ۴۲ بایستید، بعد با مکش (اسلیپ‌استریم) ۲ خانهٔ دیگر جلو بروید. آدرنالین یک خنک‌سازی هم می‌دهد و کارت گرمای دستتان به موتور برمی‌گردد.', expected: { type: 'react', adrenaline: true, slipstream: true, discard: [] }, reply: { type: 'plan', gear: 2, cards: [103, 104] } },
      { instructionFa: 'حالا شما جلو هستید (خانهٔ ۴۴). دنده را به ۲ پایین بیاورید و کارت‌های ۲ و ۳ را بازی کنید: سرعت ۵ از پیچ ۴۵ با محدودیت ۴ می‌گذرد و ۱ گرما می‌پردازید.', expected: { type: 'plan', gear: 2, cards: [5, 6] }, reply: null },
      { instructionFa: 'در خانهٔ ۴۹ هستید. دو کارت ۱ کم‌ارزش را دور بریزید تا دستتان با کارت‌های تازه پر شود؛ هزینهٔ پیچ (۱ گرما) خودکار پرداخت می‌شود.', expected: { type: 'react', adrenaline: false, slipstream: false, discard: [8, 9] }, reply: { type: 'react', adrenaline: false, slipstream: false, discard: [] } },
      { instructionFa: 'تا خط پایان ۵ خانه مانده و حریف هم با تمام قوا می‌آید. دنده را مستقیم از ۲ به ۴ ببرید (پرش دو دنده ۱ گرما هزینه دارد) و کارت‌های ۴، ۲، ۲ و کارت استرس را بازی کنید؛ استرس از بالای دسته کارت رو می‌کند تا به یک کارت سرعت برسد.', expected: { type: 'plan', gear: 4, cards: [7, 10, 11, 13] }, reply: { type: 'plan', gear: 4, cards: [105, 106, 107, 108] } },
      { instructionFa: 'از خط پایان گذشتید (خانهٔ ۵۸). اگر چند ماشین در یک دور تمام کنند، کسی که جلوتر رفته برنده است. با ۱ گرما بوست بزنید: کارت بعدی دسته سرعت اضافه می‌دهد.', expected: { type: 'boost' }, reply: null },
      { instructionFa: 'نوبت را تمام کنید. بعد حریف حرکت می‌کند و مسابقه وقتی همه از خط بگذرند تمام می‌شود.', expected: { type: 'react', adrenaline: false, slipstream: false, discard: [] }, reply: { type: 'react', adrenaline: false, slipstream: false, discard: [] } }
    ],
    completedFa: 'بردید! با سرعت ۱۱ (۹ از کارت‌ها و ۲ از بوست) به خانهٔ ۶۰ رسیدید، ۶ خانه بعد از خط. حریف با سرعت ۱۳ به خانهٔ ۵۹ رسید، ۵ خانه بعد از خط؛ هر دو در یک دور تمام کردید و شما جلوتر بودید. نفر اول ۹ امتیاز و نفر دوم ۶ امتیاز می‌گیرد.'
  }
};
