// Brass: Birmingham, 2–4 players. Two eras (Canal, Rail); each era is played in rounds until the draw deck and every
// hand are exhausted (8/9/10 rounds with the full 64/54/40-card deck for 4/3/2 players). A turn is 2 actions (1 in the
// first Canal round); every action discards a card: Build, Network, Develop, Sell, Loan, Scout (discard 3, take both
// wilds) or Pass. Money spent this round decides the next round's order (least first, ties keep order); income is
// paid after every round except the last of the game. Era end: links score the link-VP icons of their adjacent
// locations, flipped industries score their VP; after the Canal Era level-1 tiles leave the board, merchant beer is
// refilled and all discards are reshuffled into a new 8-card hand each.
// All board/tile/card numbers live in content/ (data); this file is the engine that interprets them.
// Hidden: deck order, other players' hands, the face-down first discard of the Canal Era. Resource sources (which
// coal mine / iron works / brewery is used) are chosen deterministically by the engine (DECISIONS: closest coal, own
// sources before opponents', then board order; merchant beer first when selling).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { brass } from './definition.ts';
import { GOODS, INDUSTRIES, linkId, type Industry, type IndustryTileDef, type LinkDef, type LocationDef, type MerchantBonus } from './types.ts';
import { INDUSTRY_CARDS, LINKS, LOCATIONS, MERCHANT_TILES, TILES } from './content/index.ts';

export * from './types.ts';
export { INDUSTRY_CARDS, LINKS, LOCATIONS, MERCHANT_TILES, TILES };

// ---------- static content indexes ----------

export const LOC = new Map(LOCATIONS.map((l) => [l.id, l]));
export const LINK = new Map(LINKS.map((l) => [linkId(l), l]));
export const linkNodes = (l: LinkDef): string[] => [l.a, l.b, ...(l.also ?? [])];
const LOC_INDEX = new Map(LOCATIONS.map((l, i) => [l.id, i]));
export const MERCHANT_TILE = new Map(MERCHANT_TILES.map((t) => [t.id, t]));

/** Each industry's player-mat stack, lowest level first, one entry per physical tile. */
export const STACK: Record<Industry, IndustryTileDef[]> = Object.fromEntries(
  INDUSTRIES.map((ind) => [ind, TILES.filter((t) => t.industry === ind).sort((a, b) => a.level - b.level).flatMap((t) => Array.from({ length: t.count }, () => t))])
) as Record<Industry, IndustryTileDef[]>;
export const tileDef = (industry: Industry, level: number): IndustryTileDef => {
  const t = TILES.find((x) => x.industry === industry && x.level === level);
  if (!t) throw new Error(`no tile ${industry} ${level}`);
  return t;
};

export type Card = { id: number; minPlayers: number } & ({ kind: 'location'; loc: string } | { kind: 'industry'; industries: readonly Industry[] });
export const WILD_LOCATION = 900;
export const WILD_INDUSTRY = 901;
const firstCount = (copies: readonly [number, number, number], k: number) => [2, 3, 4].find((p) => k < copies[p - 2]!) ?? 99;
/** Every draw-deck card (4-player deck); `minPlayers` says from which player count a copy is used. */
export const CARDS: Card[] = (() => {
  const out: Card[] = [];
  for (const l of LOCATIONS) if (l.cards) for (let k = 0; k < Math.max(...l.cards); k++) out.push({ id: out.length, kind: 'location', loc: l.id, minPlayers: firstCount(l.cards, k) });
  for (const c of INDUSTRY_CARDS) for (let k = 0; k < Math.max(...c.copies); k++) out.push({ id: out.length, kind: 'industry', industries: c.industries, minPlayers: firstCount(c.copies, k) });
  return out;
})();
export const deckFor = (players: number) => CARDS.filter((c) => c.minPlayers <= players).map((c) => c.id);

// Markets: price of each space, cheapest first. Cubes always occupy the most expensive spaces.
export const MARKET = {
  coal: { prices: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7], empty: 8, start: 13 },
  iron: { prices: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], empty: 6, start: 8 }
} as const;
export const buyPrice = (kind: 'coal' | 'iron', cubes: number) => (cubes > 0 ? MARKET[kind].prices[MARKET[kind].prices.length - cubes]! : MARKET[kind].empty);
const sellPrice = (kind: 'coal' | 'iron', cubes: number) => (cubes < MARKET[kind].prices.length ? MARKET[kind].prices[MARKET[kind].prices.length - cubes - 1]! : null);

/** Income level shown beside a Progress Track space (0..99): -10..30. */
export function incomeLevel(space: number): number {
  if (space <= 10) return space - 10;
  if (space <= 30) return Math.ceil((space - 10) / 2);
  if (space <= 60) return 10 + Math.ceil((space - 30) / 3);
  return Math.min(30, 20 + Math.ceil((space - 60) / 4));
}
/** Highest Progress Track space of an income level (where a loan puts the marker). */
export function topSpace(level: number): number {
  if (level <= 0) return level + 10;
  if (level <= 10) return 10 + 2 * level;
  if (level <= 20) return 30 + 3 * (level - 10);
  return Math.min(99, 60 + 4 * (level - 20));
}

export const START_MONEY = 17;
export const HAND_SIZE = 8;
export const LINK_TILES = 14;
export const WILD_PILE = 4;

// ---------- state ----------

export interface Tile { owner: number; industry: Industry; level: number; flipped: boolean; cubes: number }
export interface MerchantState { tiles: (string | null)[]; beer: boolean[] }
export interface LastAction { seat: number; type: string; cards: number[]; loc?: string; slot?: number; industry?: Industry; links?: string[]; industries?: Industry[]; sales?: { loc: string; slot: number; merchant: string }[] }

export interface BrassState {
  players: number;
  era: 'canal' | 'rail';
  round: number;
  order: number[];
  turn: number;
  actionsLeft: number;
  deck: number[];
  hands: number[][];
  discards: number[][];
  /** The Canal Era's face-down first discard of each player (hidden; reshuffled at the end of the Canal Era). */
  facedown: number[][];
  money: number[];
  /** Progress-track space of each income marker (0..99); level via incomeLevel(). */
  income: number[];
  vp: number[];
  spent: number[];
  /** Tiles already taken (built or developed) from each industry stack of each player mat. */
  mat: Record<Industry, number>[];
  board: Record<string, (Tile | null)[]>;
  /** linkId → owner seat. */
  links: Record<string, number>;
  coal: number;
  iron: number;
  merchants: Record<string, MerchantState>;
  wild: { location: number; industry: number };
  last: LastAction | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}

export interface BrassView extends Omit<BrassState, 'deck' | 'hands' | 'discards' | 'facedown' | 'timeouts'> {
  current: number | null;
  deckCount: number;
  handCounts: number[];
  /** The viewer's own hand (null for spectators). */
  hand: number[] | null;
  /** Face-up top card of each discard pile (the Canal Era's first, face-down card is never shown). */
  discardTop: (number | null)[];
  incomeLevels: number[];
}

// ---------- actions ----------

const ind = z.enum(INDUSTRIES);
const card = z.number().int().min(0).max(999);
const locId = z.string().min(1).max(40);
export const brassAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('build'), card, industry: ind, loc: locId, slot: z.number().int().min(0).max(7) }),
  z.strictObject({ type: z.literal('network'), card, links: z.array(z.string().min(1).max(90)).min(1).max(2) }),
  z.strictObject({ type: z.literal('develop'), card, industries: z.array(ind).min(1).max(2) }),
  z.strictObject({ type: z.literal('sell'), card, sales: z.array(z.strictObject({ loc: locId, slot: z.number().int().min(0).max(7), merchant: locId.optional(), develop: ind.optional() })).min(1).max(20) }),
  z.strictObject({ type: z.literal('loan'), card }),
  z.strictObject({ type: z.literal('scout'), cards: z.array(card).length(3) }),
  z.strictObject({ type: z.literal('pass'), card }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BrassAction = z.infer<typeof brassAction>;

class BrassError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const fail = (code: string): never => { throw new BrassError(code); };

// ---------- helpers ----------

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const currentSeat = (s: BrassState): number | null => (s.outcome ? null : s.order[s.turn] ?? null);
export const nextTile = (s: Pick<BrassState, 'mat'>, seat: number, industry: Industry): IndustryTileDef | null => STACK[industry][s.mat[seat]![industry]] ?? null;
const produceOf = (t: IndustryTileDef, era: BrassState['era']) => (typeof t.produce === 'number' ? t.produce : t.produce[era]);

function eachTile(s: BrassState, f: (t: Tile, loc: string, slot: number) => void) {
  for (const l of LOCATIONS) s.board[l.id]?.forEach((t, i) => { if (t) f(t, l.id, i); });
}

/** Locations reachable from `from` over built links (any owner), with the number of links travelled. */
export function distances(s: Pick<BrassState, 'links'>, from: readonly string[]): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const id of Object.keys(s.links)) {
    const nodes = linkNodes(LINK.get(id)!);
    for (const a of nodes) for (const b of nodes) if (a !== b) adj.set(a, [...(adj.get(a) ?? []), b]);
  }
  const dist = new Map(from.map((x) => [x, 0]));
  const queue = [...from];
  while (queue.length) {
    const x = queue.shift()!;
    for (const y of adj.get(x) ?? []) if (!dist.has(y)) { dist.set(y, dist.get(x)! + 1); queue.push(y); }
  }
  return dist;
}
const connectedToMerchant = (s: BrassState, from: readonly string[]) => [...distances(s, from).keys()].some((x) => LOC.get(x)?.kind === 'merchant');

export const hasPresence = (s: BrassState, seat: number) => Object.values(s.links).includes(seat) || LOCATIONS.some((l) => s.board[l.id]?.some((t) => t?.owner === seat));
/** Locations that are part of a player's network: own industry tiles, or adjacent to own links. */
export function network(s: BrassState, seat: number): Set<string> {
  const out = new Set<string>();
  eachTile(s, (t, loc) => { if (t.owner === seat) out.add(loc); });
  for (const [id, owner] of Object.entries(s.links)) if (owner === seat) for (const n of linkNodes(LINK.get(id)!)) out.add(n);
  return out;
}

function pay(s: BrassState, seat: number, n: number) { s.money[seat]! -= n; s.spent[seat]! += n; }
function flip(s: BrassState, t: Tile) {
  t.flipped = true;
  s.income[t.owner] = Math.min(99, s.income[t.owner]! + tileDef(t.industry, t.level).income);
}

/** Consume `n` coal for a build/link at `from`: closest connected coal mine first, then the market (needs a merchant connection). */
function takeCoal(s: BrassState, seat: number, from: readonly string[], n: number) {
  for (let i = 0; i < n; i++) {
    const dist = distances(s, from);
    let best: { t: Tile; key: number[] } | null = null;
    eachTile(s, (t, loc, slot) => {
      if (t.industry !== 'coal' || t.flipped || t.cubes <= 0 || !dist.has(loc)) return;
      const key = [dist.get(loc)!, t.owner === seat ? 0 : 1, LOC_INDEX.get(loc)!, slot];
      if (!best || lexLess(key, best.key)) best = { t, key };
    });
    const b = best as { t: Tile } | null;
    if (b) { b.t.cubes -= 1; if (b.t.cubes === 0) flip(s, b.t); continue; }
    if (!connectedToMerchant(s, from)) fail('NO_COAL');
    pay(s, seat, buyPrice('coal', s.coal));
    if (s.coal > 0) s.coal -= 1;
  }
}
const lexLess = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!; return false; };

/** Consume `n` iron: any unflipped iron works (own first, then board order; no connection needed), then the market. */
function takeIron(s: BrassState, seat: number, n: number) {
  for (let i = 0; i < n; i++) {
    let best: Tile | null = null;
    eachTile(s, (t) => { if (t.industry === 'iron' && !t.flipped && t.cubes > 0 && (!best || (best.owner !== seat && t.owner === seat))) best = t; });
    const b = best as Tile | null;
    if (b) { b.cubes -= 1; if (b.cubes === 0) flip(s, b); continue; }
    pay(s, seat, buyPrice('iron', s.iron));
    if (s.iron > 0) s.iron -= 1;
  }
}

/** Consume `n` beer at `at`: the merchant's barrel (if given and full, earns its bonus), own breweries anywhere, then connected opponents' breweries. */
function takeBeer(s: BrassState, seat: number, at: readonly string[], n: number, merchant: { loc: string; space: number } | null): boolean {
  let bonus = false;
  for (let i = 0; i < n; i++) {
    const m = merchant && s.merchants[merchant.loc];
    if (m && m.beer[merchant.space]) { m.beer[merchant.space] = false; bonus = true; continue; }
    const dist = distances(s, at);
    let best: { t: Tile; key: number[] } | null = null;
    eachTile(s, (t, loc, slot) => {
      if (t.industry !== 'brewery' || t.flipped || t.cubes <= 0) return;
      if (t.owner !== seat && !dist.has(loc)) return;
      const key = [t.owner === seat ? 0 : 1 + dist.get(loc)!, LOC_INDEX.get(loc)!, slot];
      if (!best || lexLess(key, best.key)) best = { t, key };
    });
    const b = best as { t: Tile } | null;
    if (!b) fail('NO_BEER');
    b!.t.cubes -= 1;
    if (b!.t.cubes === 0) flip(s, b!.t);
  }
  return bonus;
}

function useCard(s: BrassState, seat: number, id: number) {
  const hand = s.hands[seat]!;
  const i = hand.indexOf(id);
  if (i < 0) fail('NOT_IN_HAND');
  hand.splice(i, 1);
  if (id === WILD_LOCATION) s.wild.location += 1;
  else if (id === WILD_INDUSTRY) s.wild.industry += 1;
  else s.discards[seat]!.push(id);
}

/** Can this card build `industry` at `loc` (card rules + network rule)? */
export function cardAllows(s: BrassState, seat: number, id: number, industry: Industry, loc: LocationDef): boolean {
  if (id === WILD_LOCATION) return loc.kind === 'town';
  const c = id === WILD_INDUSTRY ? null : CARDS[id];
  if (c?.kind === 'location') return c.loc === loc.id;
  if (c && !c.industries.includes(industry)) return false;
  return !hasPresence(s, seat) || network(s, seat).has(loc.id);
}

const resourceLeft = (s: BrassState, kind: 'coal' | 'iron') => {
  let any = s[kind] > 0;
  eachTile(s, (t) => { if (t.industry === kind && t.cubes > 0) any = true; });
  return any;
};

function develop(s: BrassState, seat: number, industry: Industry, iron: boolean) {
  const t = nextTile(s, seat, industry);
  if (!t) fail('NO_TILES_LEFT');
  if (t!.noDevelop) fail('CANNOT_DEVELOP');
  if (iron) takeIron(s, seat, 1);
  s.mat[seat]![industry] += 1;
}

function bonus(s: BrassState, seat: number, b: MerchantBonus, dev: Industry | undefined) {
  if (b.kind === 'money') s.money[seat]! += b.amount;
  else if (b.kind === 'vp') s.vp[seat]! += b.amount;
  else if (b.kind === 'income') s.income[seat] = Math.min(99, s.income[seat]! + b.amount);
  else if (dev) develop(s, seat, dev, false);
}

// ---------- actions ----------

function build(s: BrassState, seat: number, a: Extract<BrassAction, { type: 'build' }>) {
  const loc = LOC.get(a.loc);
  if (!loc?.slots) return fail('BAD_LOCATION');
  const accepts = loc.slots[a.slot];
  if (!accepts) return fail('BAD_SLOT');
  if (!accepts.includes(a.industry)) fail('SLOT_REJECTS_INDUSTRY');
  const def = nextTile(s, seat, a.industry);
  if (!def) return fail('NO_TILES_LEFT');
  if (def.era && def.era !== s.era) fail('WRONG_ERA_TILE');
  if (!cardAllows(s, seat, a.card, a.industry, loc)) fail('CARD_CANNOT_BUILD');
  const row = s.board[loc.id]!;
  const cur = row[a.slot];
  if (cur) {
    if (cur.industry !== a.industry) fail('SLOT_TAKEN');
    if (def.level <= cur.level) fail('OVERBUILD_LEVEL');
    if (cur.owner !== seat) {
      if (a.industry !== 'coal' && a.industry !== 'iron') fail('OVERBUILD_OPPONENT');
      if (resourceLeft(s, a.industry as 'coal' | 'iron')) fail('OVERBUILD_RESOURCES_LEFT');
    }
    row[a.slot] = null; // overbuilt tile (and any cubes on it) leaves the game
  } else if (accepts.length > 1 && loc.slots.some((sl, i) => !row[i] && sl.length === 1 && sl[0] === a.industry)) fail('USE_SINGLE_SLOT');
  if (s.era === 'canal' && row.some((t, i) => i !== a.slot && t?.owner === seat)) fail('ONE_TILE_PER_TOWN');
  pay(s, seat, def.cost);
  takeCoal(s, seat, [loc.id], def.coal);
  takeIron(s, seat, def.iron);
  if (s.money[seat]! < 0) fail('NO_MONEY');
  useCard(s, seat, a.card);
  s.mat[seat]![a.industry] += 1;
  const tile: Tile = { owner: seat, industry: a.industry, level: def.level, flipped: false, cubes: produceOf(def, s.era) };
  row[a.slot] = tile;
  if (a.industry === 'iron' || (a.industry === 'coal' && connectedToMerchant(s, [loc.id]))) {
    const kind = a.industry;
    for (let p = sellPrice(kind, s[kind]); tile.cubes > 0 && p !== null; p = sellPrice(kind, s[kind])) { tile.cubes -= 1; s[kind] += 1; s.money[seat]! += p; }
    if (tile.cubes === 0) flip(s, tile);
  }
}

function buildNetwork(s: BrassState, seat: number, a: Extract<BrassAction, { type: 'network' }>) {
  if (s.era === 'canal' && a.links.length !== 1) fail('ONE_CANAL_LINK');
  if (new Set(a.links).size !== a.links.length) fail('LINK_TAKEN');
  const owned = Object.values(s.links).filter((o) => o === seat).length;
  if (owned + a.links.length > LINK_TILES) fail('NO_LINKS_LEFT');
  pay(s, seat, s.era === 'canal' ? 3 : a.links.length === 1 ? 5 : 15);
  for (const id of a.links) {
    const l = LINK.get(id);
    if (!l) return fail('BAD_LINK');
    if (s.links[id] !== undefined) fail('LINK_TAKEN');
    if (!(s.era === 'canal' ? l.canal : l.rail)) fail('WRONG_ERA_LINK');
    // Re-checked per link: with no presence the first link goes anywhere, the second must touch it.
    const net = network(s, seat);
    if (hasPresence(s, seat) && !linkNodes(l).some((n) => net.has(n))) fail('NOT_IN_NETWORK');
    s.links[id] = seat;
    if (s.era === 'rail') takeCoal(s, seat, linkNodes(l), 1);
  }
  if (a.links.length === 2) takeBeer(s, seat, linkNodes(LINK.get(a.links[1]!)!), 1, null);
  if (s.money[seat]! < 0) fail('NO_MONEY');
  useCard(s, seat, a.card);
}

function sell(s: BrassState, seat: number, a: Extract<BrassAction, { type: 'sell' }>) {
  for (const sale of a.sales) {
    const t = s.board[sale.loc]?.[sale.slot];
    if (!t || t.owner !== seat || t.flipped || !GOODS.includes(t.industry)) return fail('NOT_SELLABLE');
    const reach = distances(s, [sale.loc]);
    const spaces: { loc: string; space: number; beer: boolean }[] = [];
    for (const l of LOCATIONS) {
      const m = s.merchants[l.id];
      if (!m || !reach.has(l.id) || (sale.merchant && sale.merchant !== l.id)) continue;
      m.tiles.forEach((id, space) => { if (id && MERCHANT_TILE.get(id)!.goods.includes(t.industry)) spaces.push({ loc: l.id, space, beer: m.beer[space]! }); });
    }
    const to = spaces.find((x) => x.beer) ?? spaces[0];
    if (!to) return fail('NO_MERCHANT');
    const def = tileDef(t.industry, t.level);
    const got = takeBeer(s, seat, [sale.loc], def.beer, to);
    flip(s, t);
    if (got) bonus(s, seat, LOC.get(to.loc)!.merchant!.bonus, sale.develop);
    else if (sale.develop) fail('NO_DEVELOP_BONUS');
  }
  useCard(s, seat, a.card);
}

function perform(s: BrassState, seat: number, a: Exclude<BrassAction, { type: 'resign' }>, rng: EngineRng) {
  const cards = a.type === 'scout' ? a.cards : [a.card];
  switch (a.type) {
    case 'build': build(s, seat, a); break;
    case 'network': buildNetwork(s, seat, a); break;
    case 'sell': sell(s, seat, a); break;
    case 'develop':
      for (const x of a.industries) develop(s, seat, x, true);
      if (s.money[seat]! < 0) fail('NO_MONEY');
      useCard(s, seat, a.card);
      break;
    case 'loan': {
      const lvl = incomeLevel(s.income[seat]!) - 3;
      if (lvl < -10) fail('NO_LOAN');
      useCard(s, seat, a.card);
      s.money[seat]! += 30;
      s.income[seat] = topSpace(lvl);
      break;
    }
    case 'scout':
      if (new Set(a.cards).size !== 3) fail('NOT_IN_HAND');
      if (s.hands[seat]!.some((c) => c >= WILD_LOCATION)) fail('HAS_WILD');
      if (s.wild.location < 1 || s.wild.industry < 1) fail('NO_WILD_LEFT');
      for (const c of a.cards) useCard(s, seat, c);
      s.hands[seat]!.push(WILD_LOCATION, WILD_INDUSTRY);
      s.wild.location -= 1; s.wild.industry -= 1;
      break;
    case 'pass': useCard(s, seat, a.card); break;
  }
  s.seq += 1;
  s.last = {
    seat, type: a.type, cards,
    ...(a.type === 'build' ? { loc: a.loc, slot: a.slot, industry: a.industry } : {}),
    ...(a.type === 'network' ? { links: a.links } : {}),
    ...(a.type === 'develop' ? { industries: a.industries } : {}),
    ...(a.type === 'sell' ? { sales: a.sales.map((x) => ({ loc: x.loc, slot: x.slot, merchant: x.merchant ?? '' })) } : {})
  };
  s.actionsLeft -= 1;
  if (s.actionsLeft <= 0 || s.hands[seat]!.length === 0) endTurn(s, rng);
}

// ---------- turn / round / era flow ----------

function startTurn(s: BrassState, rng: EngineRng) {
  while (s.turn < s.order.length && s.hands[s.order[s.turn]!]!.length === 0) s.turn += 1;
  if (s.turn >= s.order.length) return endRound(s, rng);
  const base = s.era === 'canal' && s.round === 1 ? 1 : 2;
  s.actionsLeft = Math.min(base, s.hands[s.order[s.turn]!]!.length);
}

function endTurn(s: BrassState, rng: EngineRng) {
  const seat = s.order[s.turn]!;
  while (s.hands[seat]!.length < HAND_SIZE && s.deck.length) s.hands[seat]!.push(s.deck.shift()!);
  s.turn += 1;
  startTurn(s, rng);
}

function payIncome(s: BrassState, seat: number) {
  s.money[seat]! += incomeLevel(s.income[seat]!);
  if (s.money[seat]! >= 0) return;
  // Shortfall: remove own industry tiles (cheapest first) for half their cost, rounded down, until covered.
  const own: { loc: string; slot: number; cost: number }[] = [];
  eachTile(s, (t, loc, slot) => { if (t.owner === seat) own.push({ loc, slot, cost: tileDef(t.industry, t.level).cost }); });
  own.sort((x, y) => x.cost - y.cost);
  for (const o of own) {
    if (s.money[seat]! >= 0) break;
    s.board[o.loc]![o.slot] = null;
    s.money[seat]! += Math.floor(o.cost / 2);
  }
  if (s.money[seat]! < 0) { s.vp[seat] = Math.max(0, s.vp[seat]! + s.money[seat]!); s.money[seat] = 0; }
}

function endRound(s: BrassState, rng: EngineRng) {
  const eraOver = s.deck.length === 0 && s.hands.every((h) => h.length === 0);
  s.order = [...s.order].sort((a, b) => s.spent[a]! - s.spent[b]!); // stable: equal spenders keep their order
  s.spent = s.spent.map(() => 0);
  if (!(eraOver && s.era === 'rail')) for (let p = 0; p < s.players; p++) payIncome(s, p);
  s.turn = 0;
  if (eraOver) return endEra(s, rng);
  s.round += 1;
  startTurn(s, rng);
}

/** Link VP icons at a location: merchants have printed icons, towns/farms sum their flipped tiles. */
export function locationLinkVp(s: Pick<BrassState, 'board'>, id: string): number {
  const l = LOC.get(id);
  if (l?.merchant) return l.merchant.linkVp;
  return (s.board[id] ?? []).reduce((n, t) => n + (t?.flipped ? tileDef(t.industry, t.level).linkVp : 0), 0);
}

function endEra(s: BrassState, rng: EngineRng) {
  for (const [id, owner] of Object.entries(s.links)) s.vp[owner]! += linkNodes(LINK.get(id)!).reduce((n, x) => n + locationLinkVp(s, x), 0);
  s.links = {};
  eachTile(s, (t) => { if (t.flipped) s.vp[t.owner]! += tileDef(t.industry, t.level).vp; });
  if (s.era === 'rail') { s.outcome = { placements: rank(s, s.order), reason: 'score' }; return; }
  for (const l of LOCATIONS) { const row = s.board[l.id]; if (row) row.forEach((t, i) => { if (t?.level === 1) row[i] = null; }); }
  for (const m of Object.values(s.merchants)) m.beer = m.tiles.map((id) => !!id && MERCHANT_TILE.get(id)!.goods.length > 0);
  s.deck = shuffle(rng, [...s.deck, ...s.discards.flat(), ...s.facedown.flat()]);
  s.facedown = s.facedown.map(() => []);
  s.discards = s.discards.map(() => []);
  s.hands = s.hands.map(() => s.deck.splice(0, HAND_SIZE));
  s.era = 'rail';
  s.round = 1;
  startTurn(s, rng);
}

function rank(s: BrassState, seats: number[]): Outcome['placements'] {
  const key = (p: number) => [s.vp[p]!, incomeLevel(s.income[p]!), s.money[p]!];
  const r = [...seats].sort((a, b) => { const x = key(a), y = key(b); return y[0]! - x[0]! || y[1]! - x[1]! || y[2]! - x[2]!; });
  const out: Outcome['placements'] = [];
  r.forEach((seat, i) => {
    const prev = r[i - 1];
    const tie = prev !== undefined && key(prev).every((v, k) => v === key(seat)[k]);
    out.push({ seat, place: tie ? out[i - 1]!.place : i + 1, score: s.vp[seat]! });
  });
  return out;
}

// ---------- module ----------

type Events = Transition<BrassState>['internalEvents'];
const finish = (s: BrassState, events: Events): Transition<BrassState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const NO_RNG: EngineRng = { nextInt: () => 0 }; // validation never depends on the shuffle result

function check(s: BrassState, seat: number, a: Exclude<BrassAction, { type: 'resign' }>): string | null {
  try { perform(structuredClone(s), seat, a, NO_RNG); return null; } catch (e) { if (e instanceof BrassError) return e.code; throw e; }
}

export function setupState(playerCount: number, rng: EngineRng): BrassState {
  const deck = shuffle(rng, deckFor(playerCount));
  const seats = Array.from({ length: playerCount }, (_, i) => i);
  const merchants: Record<string, MerchantState> = {};
  const tiles = shuffle(rng, MERCHANT_TILES.filter((t) => t.minPlayers <= playerCount).map((t) => t.id));
  for (const l of LOCATIONS) {
    if (!l.merchant) continue;
    const active = l.merchant.minPlayers <= playerCount;
    const placed = Array.from({ length: l.merchant.spaces }, () => (active ? tiles.shift() ?? null : null));
    merchants[l.id] = { tiles: placed, beer: placed.map((id) => !!id && MERCHANT_TILE.get(id)!.goods.length > 0) };
  }
  const s: BrassState = {
    players: playerCount, era: 'canal', round: 1, order: shuffle(rng, seats), turn: 0, actionsLeft: 1,
    deck, hands: seats.map(() => deck.splice(0, HAND_SIZE)), discards: seats.map(() => []), facedown: seats.map(() => deck.splice(0, 1)),
    money: seats.map(() => START_MONEY), income: seats.map(() => 10), vp: seats.map(() => 0), spent: seats.map(() => 0),
    mat: seats.map(() => Object.fromEntries(INDUSTRIES.map((x) => [x, 0])) as Record<Industry, number>),
    board: Object.fromEntries(LOCATIONS.filter((l) => l.slots).map((l) => [l.id, l.slots!.map(() => null)])),
    links: {}, coal: MARKET.coal.start, iron: MARKET.iron.start, merchants, wild: { location: WILD_PILE, industry: WILD_PILE },
    last: null, seq: 0, timeouts: seats.map(() => 0), outcome: null
  };
  return s;
}

// ---------- tutorial (tutorial tables only) ----------

const cardOf = (town: string, n: number) => CARDS.filter((c) => c.kind === 'location' && c.loc === town)[n]!.id;
/** Learner: Birmingham ×2, Coventry ×2. Opponent: one Dudley card (so its turn is a single action). */
export const TUTORIAL_HAND = [cardOf('birmingham', 0), cardOf('birmingham', 1), cardOf('coventry', 0), cardOf('coventry', 1)];
export const TUTORIAL_OPPONENT = [cardOf('dudley', 0)];

/**
 * Last two rounds of the Rail Era, 2 players, draw deck empty. Learner (seat 0, first): an unflipped Cotton Mill III in
 * Birmingham, £20, income space 20 (level 5), 52 VP. Opponent: flipped Coal Mine II + Iron Works II in Dudley and a
 * Coal Mine II with 1 cube in Wolverhampton, £12, income space 30 (level 10), 55 VP. Oxford holds the «all goods» and
 * «manufacturer» tiles, both with beer. Markets: 10 coal, 6 iron.
 */
function tutorialState(s: BrassState): BrassState {
  const t = (owner: number, industry: Industry, level: number, cubes: number, flipped: boolean): Tile => ({ owner, industry, level, cubes, flipped });
  const used = new Set([...TUTORIAL_HAND, ...TUTORIAL_OPPONENT]);
  Object.assign(s, {
    era: 'rail', round: 7, order: [0, 1], turn: 0, actionsLeft: 2, deck: [],
    hands: [[...TUTORIAL_HAND], [...TUTORIAL_OPPONENT]],
    discards: [deckFor(2).filter((c) => !used.has(c)).slice(0, 3), deckFor(2).filter((c) => !used.has(c)).slice(3, 6)],
    facedown: [[], []], money: [20, 12], income: [20, 30], vp: [52, 55], spent: [0, 0], coal: 10, iron: 6, links: {}
  });
  s.mat = [
    { cotton: 6, manufacturer: 1, pottery: 1, coal: 3, iron: 2, brewery: 2 },
    { cotton: 3, manufacturer: 1, pottery: 1, coal: 5, iron: 2, brewery: 3 }
  ];
  for (const row of Object.values(s.board)) row.fill(null);
  s.board.birmingham![0] = t(0, 'cotton', 3, 0, false);
  s.board.dudley![0] = t(1, 'coal', 2, 0, true);
  s.board.dudley![1] = t(1, 'iron', 2, 0, true);
  s.board.wolverhampton![1] = t(1, 'coal', 2, 1, false);
  for (const m of Object.values(s.merchants)) { m.tiles = m.tiles.map(() => null); m.beer = m.beer.map(() => false); }
  s.merchants.oxford = { tiles: ['m2-all', 'm2-manufacturer'], beer: [true, true] };
  s.merchants.gloucester = { tiles: ['m2-cotton', 'm2-blank-1'], beer: [false, false] };
  s.merchants.shrewsbury = { tiles: ['m2-blank-2'], beer: [false] };
  return s;
}

export const brassModule: GameModule<BrassState, BrassAction, BrassView> = {
  manifest: brass.manifest,
  actionSchema: brassAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('brass needs 2–4 players');
    const s = setupState(playerCount, rng);
    return options.deal === 'tutorial' && playerCount === 2 ? tutorialState(s) : s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (currentSeat(s) !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const code = check(s, actor.seat, a);
    return code ? { ok: false, errorCode: code } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.order.filter((k) => k !== seat)), { seat, place: s.players, score: s.vp[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    perform(s, seat, a, ctx.rng);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer): BrassView {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const { deck, hands, discards, facedown, timeouts, ...pub } = structuredClone(s);
    void timeouts; void facedown;
    return {
      ...pub,
      current: currentSeat(s),
      deckCount: deck.length,
      handCounts: hands.map((h) => h.length),
      hand: me >= 0 ? hands[me]! : null,
      discardTop: discards.map((d) => d.at(-1) ?? null),
      incomeLevels: s.income.map(incomeLevel)
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    return [...legalFor(s, viewer.seat), { type: 'resign' }];
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    const seat = currentSeat(s);
    if (seat === null) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const missed = s.timeouts[seat]! + 1;
    // Pass every remaining action of the turn, discarding the first card of the hand each time.
    for (let n = s.actionsLeft; n > 0 && !s.outcome && currentSeat(s) === seat && s.hands[seat]!.length; n--) perform(s, seat, { type: 'pass', card: s.hands[seat]![0]! }, ctx.rng);
    s.timeouts[seat] = missed;
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => { const c = currentSeat(s); return c === null ? [] : [c]; },

  tutorial: {
    seed: 21,
    options: { deal: 'tutorial' },
    introFa: 'آخرین دو دور دورهٔ راه‌آهن است و دستهٔ کشیدنی تمام شده. شما ۵۲ امتیاز دارید و حریف ۵۵. در بیرمنگام یک کارخانهٔ پنبهٔ سطح ۳ (برنگشته) دارید، £۲۰ پول و درآمد ۵. در هر نوبت ۲ اقدام دارید و هر اقدام یک کارت را دور می‌اندازد. نقشه: بیرمنگام را با راه‌آهن به تاجر آکسفورد وصل کنید، پنبه را بفروشید، یک تولیدی بسازید و آن را هم بفروشید تا در امتیازشماری پایان بازی جلو بزنید.',
    steps: [
      { instructionFa: '«ساخت مسیر» را بزنید، مسیر بیرمنگام ↔ آکسفورد را انتخاب کنید و کارت «کاونتری» را دور بیندازید. مسیر راه‌آهن £۵ و ۱ زغال می‌خواهد. هیچ معدن زغالی به این مسیر وصل نیست، ولی چون به تاجر آکسفورد می‌رسد زغال از بازار خریده می‌شود: ۱۰ مکعب در بازار است، پس £۳. جمعاً £۸ خرج می‌کنید.', expected: { type: 'network', card: TUTORIAL_HAND[2]!, links: ['birmingham~oxford'] }, reply: null },
      { instructionFa: '«فروش» را بزنید، کارخانهٔ پنبهٔ بیرمنگام → آکسفورد را تیک بزنید و کارت دوم «کاونتری» را دور بیندازید. فروش به تاجری که کالای شما را می‌خرد ۱ آبجو می‌خواهد؛ بشکهٔ آبجوی کنار همان تاجر را مصرف می‌کنید و پاداش آکسفورد (+۲ خانهٔ درآمد) را هم می‌گیرید. کاشی برمی‌گردد و درآمدتان ۳ خانه دیگر هم بالا می‌رود.', expected: { type: 'sell', card: TUTORIAL_HAND[3]!, sales: [{ loc: 'birmingham', slot: 0, merchant: 'oxford' }] }, reply: { type: 'network', card: TUTORIAL_OPPONENT[0]!, links: ['dudley~wolverhampton'] } },
      { instructionFa: 'حریف مسیر دادلی ↔ ولورهمپتون را ساخت و آخرین زغال معدن خودش را مصرف کرد. دور تمام شد و درآمد پرداخت شد: شما با درآمد ۸ به £۲۰ رسیدید. چون حریف کمتر خرج کرده بود اول بازی می‌کرد، ولی کارتی ندارد. حالا «ساخت صنعت» را بزنید، «تولیدی» در بیرمنگام (خانهٔ ۲) را انتخاب کنید و کارت «بیرمنگام» را بدهید. تولیدی سطح ۲ £۱۰ و ۱ آهن می‌خواهد؛ آهن از بازار £۳ است.', expected: { type: 'build', card: TUTORIAL_HAND[0]!, industry: 'manufacturer', loc: 'birmingham', slot: 1 }, reply: null },
      { instructionFa: 'تولیدی تازه را به آکسفورد بفروشید: «فروش»، تیک تولیدی بیرمنگام → آکسفورد و کارت آخر «بیرمنگام». بشکهٔ دوم آکسفورد آبجوی این فروش است. با این اقدام دست‌ها خالی می‌شود و دورهٔ راه‌آهن امتیازشماری می‌شود.', expected: { type: 'sell', card: TUTORIAL_HAND[1]!, sales: [{ loc: 'birmingham', slot: 1, merchant: 'oxford' }] }, reply: null }
    ],
    completedFa: 'بردید، ۷۰ به ۶۷! در پایان دوره هر مسیر امتیاز آیکون‌های دو سرش را می‌گیرد: آکسفورد ۲، و در بیرمنگام پنبهٔ سطح ۳ و تولیدی سطح ۲ هر کدام ۱، پس مسیر شما ۴ امتیاز داد. بعد کاشی‌های برگشته امتیاز خودشان را دادند: پنبه ۹ و تولیدی ۵. یعنی ۵۲ + ۴ + ۱۴ = ۷۰. حریف از مسیرش ۳ و از سه کاشی برگشته‌اش ۹ امتیاز گرفت: ۵۵ + ۱۲ = ۶۷. در مساوی، درآمد بیشتر و بعد پول بیشتر برنده می‌شد.'
  }
};

/** Every legal action of `seat` as hints. Builds list the hand cards that may pay for them. */
export function legalFor(s: BrassState, seat: number): ActionHint[] {
  if (s.outcome || currentSeat(s) !== seat) return [];
  const hand = s.hands[seat]!;
  const any = hand[0];
  if (any === undefined) return [];
  const out: ActionHint[] = [];
  for (const loc of LOCATIONS) {
    loc.slots?.forEach((accepts, slot) => {
      for (const industry of accepts) {
        const cards = hand.filter((c, i) => hand.indexOf(c) === i && cardAllows(s, seat, c, industry, loc));
        if (cards.length && !check(s, seat, { type: 'build', card: cards[0]!, industry, loc: loc.id, slot })) out.push({ type: 'build', industry, loc: loc.id, slot, cards });
      }
    });
  }
  const singles = [...LINK.keys()].filter((id) => !check(s, seat, { type: 'network', card: any, links: [id] }));
  for (const id of singles) out.push({ type: 'network', links: [id] });
  if (s.era === 'rail' && s.money[seat]! >= 15) {
    const net = network(s, seat);
    for (const a of singles) {
      const near = new Set([...net, ...linkNodes(LINK.get(a)!)]);
      for (const [b, l] of LINK) {
        if (a === b || !l.rail || s.links[b] !== undefined || !linkNodes(l).some((x) => near.has(x))) continue; // cheap pre-filter
        if (!check(s, seat, { type: 'network', card: any, links: [a, b] })) out.push({ type: 'network', links: [a, b] });
      }
    }
  }
  for (let i = 0; i < INDUSTRIES.length; i++) {
    const a = INDUSTRIES[i]!;
    if (!check(s, seat, { type: 'develop', card: any, industries: [a] })) out.push({ type: 'develop', industries: [a] });
    for (let j = i; j < INDUSTRIES.length; j++) {
      const b = INDUSTRIES[j]!;
      if (!check(s, seat, { type: 'develop', card: any, industries: [a, b] })) out.push({ type: 'develop', industries: [a, b] });
    }
  }
  eachTile(s, (t, loc, slot) => {
    if (t.owner !== seat || t.flipped || !GOODS.includes(t.industry)) return;
    for (const m of Object.keys(s.merchants)) if (!check(s, seat, { type: 'sell', card: any, sales: [{ loc, slot, merchant: m }] })) out.push({ type: 'sell', loc, slot, merchant: m });
  });
  if (!check(s, seat, { type: 'loan', card: any })) out.push({ type: 'loan' });
  if (hand.length >= 3 && !check(s, seat, { type: 'scout', cards: hand.slice(0, 3) })) out.push({ type: 'scout' });
  out.push({ type: 'pass' });
  return out;
}
