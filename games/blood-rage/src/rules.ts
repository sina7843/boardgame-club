// Blood Rage («خشم خون»), 2–5 players, base game (no expansions). Three Ages, each: Gods' Gifts (card draft) → Action
// (spend Rage: invade, march, upgrade, quest, pillage) → Discard → Quest → Ragnarök → Release Valhalla. The clan with the
// most Glory after the third Age wins. The server owns everything: hands, drafted packs and secretly chosen battle cards
// are hidden; the board, upgrades, stats and glory are public.
//
// Modelling notes (details in DECISIONS.md): the board is reconstructed (ring of 8 provinces around Yggdrasil, 4 fjords);
// optional card effects that would need long interrupts are asked one at a time as «choices» (a queue); Volur Witch always
// escapes to Yggdrasil when she would be destroyed in an outer province; Odin's Smite takes the opponent's first warrior.
import { z } from 'zod';
import type { Actor, ActionHint, EngineContext, EngineRng, GameModule, Outcome, PublicSummary, Transition, Viewer } from '@bg/game-sdk';
import { bloodRage as def } from './definition.ts';
import {
  ageDeck, adjacent, CARD_BY_ID, DESTROYED_AT_START, ENDGAME_BONUS_LAST, ENDGAME_BONUS_STEP, GLORY_REWARD,
  isFjord, isUpgrade, LAST_STEP, OUTER, OUTER_REWARDS, PROVINCES, RAGNAROK_GLORY, RING, STATS, TRACKS, WARRIORS,
  type CardId, type FigureKind, type Place, type ProvinceId, type Reward, type Stat, placesOf, FJORD_IDS, PROVINCE_IDS
} from './data.ts';

export const HAND_PICKS = 6;
export const DEAL = 8;

// ---------- state ----------
export interface Figure { id: number; seat: number; kind: FigureKind; mon: CardId | null; at: Place | 'reserve' | 'valhalla' | 'box' }
export interface Clan {
  hand: number[]; quests: number[];
  warrior: number | null; leader: number | null; ship: number | null;
  monsters: [number | null, number | null]; clans: [number | null, number | null, number | null];
  steps: Record<Stat, number>; rage: number; glory: number; passed: boolean;
  /** Order of resignation (1 = first), null while playing. */
  resigned: number | null;
}
export type Step = 'draft' | 'action' | 'discard' | 'quest' | 'ragnarok' | 'release' | 'endage' | 'over';
export type Choice =
  | { k: 'freeInvade'; seat: number; fig: number }
  | { k: 'succor'; seat: number; at: ProvinceId }
  | { k: 'domain'; seat: number; at: ProvinceId }
  | { k: 'stat'; seat: number }
  | { k: 'hammer'; seat: number; fig: number }
  | { k: 'blessing'; seat: number; at: ProvinceId }
  | { k: 'prowess'; seat: number; cards: number[] }
  | { k: 'protect'; seat: number; figs: number[] }
  | { k: 'tide'; seat: number; figs: number[] }
  | { k: 'late'; seat: number; card: number };
export interface Battle {
  seat: number; at: ProvinceId; rep: boolean;
  stage: 'call' | 'cards' | 'reveal' | 'tide' | 'late' | 'protect' | 'apply' | 'after';
  call: { order: number[]; idx: number; moved: boolean };
  /** seat → chosen card instance (null = none, absent = not chosen yet). */
  chosen: Record<string, number | null>;
  revealed: boolean;
  /** Seats that decided to play / keep back their late card (Eye, Gaze). */
  late: Record<string, boolean>;
  /** Figures destroyed in this battle (by card effects or defeat). */
  /** Clans that took part (fixed when the cards are chosen; a clan stays in the battle even if its figures all die). */
  parts: number[];
  dead: number[];
  /** Figures a Protection saved. */
  saved: number[];
  winner: number | null;
  losers: number[];
  /** Seats whose cards are muted by Thor's Primacy. */
  muted: number[];
  totals: Record<string, number>;
}
export interface LogEntry { seat: number; e: string; n?: number; at?: string; card?: string; to?: string; w?: number }
export interface BRState {
  players: number;
  tutorial: boolean;
  age: 1 | 2 | 3;
  step: Step;
  first: number;
  turn: number;
  spent: boolean;
  inst: CardId[];
  clans: Clan[];
  figs: Figure[];
  rewards: Record<ProvinceId, Reward>;
  pillaged: ProvinceId[];
  destroyed: ProvinceId[];
  /** Ragnarök token of each age (the province it destroys). */
  ragnarok: ProvinceId[];
  packs: number[][];
  draft: { need: number; picked: boolean[]; round: number };
  discarded: boolean[];
  battle: Battle | null;
  queue: Choice[];
  log: LogEntry[];
  resignSeq: number;
  seq: number;
  outcome: Outcome | null;
}

// ---------- views ----------
export interface SeatView {
  seat: number; steps: Record<Stat, number>; rage: number; glory: number; passed: boolean; resigned: boolean;
  hand: number; quests: number;
  warrior: string | null; leader: string | null; ship: string | null; monsters: (string | null)[]; clans: (string | null)[];
}
export interface BattleView {
  seat: number; at: ProvinceId; rep: boolean; stage: Battle['stage'];
  caller: number | null; waiting: number[];
  chosen: Record<string, 'hidden' | 'none' | string>;
  revealed: boolean; dead: number[]; saved: number[]; winner: number | null; losers: number[]; muted: number[];
  totals: Record<string, number>; late: Record<string, boolean>;
}
export interface BRView {
  players: number; age: number; step: Step; first: number; turn: number | null; spent: boolean;
  seats: SeatView[]; figs: Figure[];
  rewards: Record<ProvinceId, Reward>; pillaged: ProvinceId[]; destroyed: ProvinceId[]; ragnarok: ProvinceId[]; doom: ProvinceId | null;
  draft: { need: number; picked: boolean[]; round: number } | null;
  discarded: boolean[];
  me: { seat: number; hand: { id: number; def: CardId }[]; quests: { id: number; def: CardId }[]; pack: { id: number; def: CardId }[] } | null;
  battle: BattleView | null;
  choice: { k: Choice['k']; seat: number; fig?: number; at?: ProvinceId; cards?: number[]; figs?: number[]; card?: number } | null;
  log: LogEntry[]; seq: number; outcome: Outcome | null;
  /** Cards (all instances the viewer may know by def) — only own hand/quests/pack carry defs. */
  tutorial: boolean;
}

// ---------- actions ----------
const int = z.number().int().min(0).max(100000);
const placeSchema = z.enum(['ygg', 'myr', 'elv', 'ang', 'gim', 'and', 'utg', 'hor', 'mus', 'f1', 'f2', 'f3', 'f4']);
const provSchema = z.enum(['ygg', 'myr', 'elv', 'ang', 'gim', 'and', 'utg', 'hor', 'mus']);
const statSchema = z.enum(['rage', 'axes', 'horns']);
export const brAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pick'), cards: z.array(int).min(1).max(2) }),
  z.strictObject({ type: z.literal('invade'), figure: int, at: placeSchema }),
  z.strictObject({ type: z.literal('march'), from: provSchema, to: provSchema, figures: z.array(int).min(1).max(20) }),
  z.strictObject({ type: z.literal('upgrade'), card: int, slot: z.number().int().min(0).max(2).optional() }),
  z.strictObject({ type: z.literal('quest'), card: int }),
  z.strictObject({ type: z.literal('pillage'), at: provSchema }),
  z.strictObject({ type: z.literal('challenge'), at: provSchema }),
  z.strictObject({ type: z.literal('sacrifice'), figures: z.array(int).length(2), stat: statSchema }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('call'), figure: int.optional() }),
  z.strictObject({ type: z.literal('play'), card: int.nullable() }),
  z.strictObject({ type: z.literal('keep'), card: int.nullable() }),
  z.strictObject({
    type: z.literal('decide'), yes: z.boolean().optional(), at: placeSchema.optional(), stat: statSchema.optional(),
    figures: z.array(int).max(20).optional(), cards: z.array(int).max(20).optional()
  }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BRAction = z.infer<typeof brAction>;

// ---------- small helpers ----------
function shuffle<T>(rng: EngineRng, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const log = (s: BRState, e: LogEntry) => { s.log.push(e); if (s.log.length > 60) s.log.shift(); };
const defOf = (s: BRState, inst: number) => CARD_BY_ID[s.inst[inst]!]!;
const isOuter = (p: Place): p is ProvinceId => !isFjord(p) && p !== 'ygg';
const alive = (s: Pick<BRState, 'destroyed'>, p: ProvinceId) => !s.destroyed.includes(p);
const rageMax = (s: BRState, seat: number) => TRACKS.rage[s.clans[seat]!.steps.rage]!;
export const axesOf = (s: Pick<BRState, 'clans'>, seat: number) => TRACKS.axes[s.clans[seat]!.steps.axes]!;
export const hornsOf = (s: Pick<BRState, 'clans'>, seat: number) => TRACKS.horns[s.clans[seat]!.steps.horns]!;
const seatsFrom = (s: BRState, from: number) => Array.from({ length: s.players }, (_, k) => (from + k) % s.players);
const live = (s: BRState, seat: number) => s.clans[seat]!.resigned === null;

/** Does the clan have this upgrade card (by def id) in play? */
export function has(s: Pick<BRState, 'clans' | 'inst'>, seat: number, id: CardId): boolean {
  const c = s.clans[seat]!;
  const slots = [c.warrior, c.leader, c.ship, ...c.monsters, ...c.clans];
  return slots.some((i) => i !== null && s.inst[i] === id);
}
const inReserve = (s: BRState, seat: number, kind: FigureKind) => s.figs.find((f) => f.seat === seat && f.kind === kind && f.at === 'reserve');
const onBoard = (f: Figure) => f.at !== 'reserve' && f.at !== 'valhalla' && f.at !== 'box';
export const boardCount = (s: Pick<BRState, 'figs'>, seat: number) => s.figs.filter((f) => f.seat === seat && onBoard(f)).length;
export const villagesFree = (s: Pick<BRState, 'figs'>, p: ProvinceId) => (p === 'ygg' ? 99 : PROVINCES[p].villages - s.figs.filter((f) => f.at === p).length);
const shipLike = (f: Figure) => f.kind === 'ship' || (f.kind === 'monster' && f.mon === 'm1-serpent');
const freeMon = (f: Figure) => f.kind === 'monster' && (f.mon === 'm1-dwarf' || f.mon === 'm3-hel');

/** Strength of a clan's figures in a set of places (pairs of warriors count together). */
export function groupStr(s: Pick<BRState, 'figs' | 'clans' | 'inst'>, seat: number, places: Place[]): number {
  let sum = 0;
  const w: Record<string, number> = {};
  for (const f of s.figs) {
    if (f.seat !== seat || !places.includes(f.at as Place)) continue;
    if (f.kind === 'leader') sum += 2;
    else if (f.kind === 'ship') sum += 3;
    else if (f.kind === 'monster') sum += f.mon === 'm2-elf' ? (f.at === 'ygg' ? 3 : 1) : CARD_BY_ID[f.mon!]!.mstr!;
    else w[f.at] = (w[f.at] ?? 0) + 1;
  }
  const up = s.clans[seat]!.warrior === null ? null : s.inst[s.clans[seat]!.warrior!];
  for (const n of Object.values(w)) {
    const pairs = Math.floor(n / 2), odd = n % 2;
    if (up === 'w1-brothers') sum += pairs * 3 + odd;
    else if (up === 'w2-experts') sum += n * 2;
    else if (up === 'w3-masters') sum += pairs * 6 + odd * 2;
    else sum += n;
  }
  return sum;
}
/** Strength of every clan in a province (and its fjords), used by quests and battles. */
export const provinceStr = (s: BRState, seat: number, p: ProvinceId) => groupStr(s, seat, placesOf(p));
const leads = (s: BRState, seat: number, p: ProvinceId) => {
  const mine = provinceStr(s, seat, p);
  return mine > 0 && s.clans.every((_, o) => o === seat || provinceStr(s, o, p) < mine);
};

function newFigure(s: BRState, seat: number, kind: FigureKind, mon: CardId | null, at: Figure['at'] = 'reserve'): Figure {
  const f: Figure = { id: s.figs.length, seat, kind, mon, at };
  s.figs.push(f);
  return f;
}

/** Destroy a figure: to Valhalla, with the Dragons' glory; a Volur Witch in an outer province flees to Yggdrasil instead. */
function kill(s: BRState, f: Figure, flee = true): boolean {
  if (flee && f.kind === 'monster' && f.mon === 'm3-volur' && isOuter(f.at as Place)) { f.at = 'ygg'; return false; }
  const was = f.at;
  f.at = 'valhalla';
  if (s.battle) s.battle.dead.push(f.id);
  if (shipLike(f) && was !== 'valhalla') {
    const g = has(s, f.seat, 's3-eternal') ? 12 : has(s, f.seat, 's2-fire') ? 8 : has(s, f.seat, 's1-loki') ? 4 : 0;
    if (g) s.clans[f.seat]!.glory += g;
  }
  return true;
}

/** Raise a stat one step; false when already at the last step. */
function raise(s: BRState, seat: number, stat: Stat): boolean {
  const c = s.clans[seat]!;
  if (c.steps[stat] >= LAST_STEP) return false;
  c.steps[stat]++;
  return true;
}
const raiseAll = (s: BRState, seat: number) => { for (const st of STATS) raise(s, seat, st); };
const canRaise = (s: BRState, seat: number) => STATS.some((st) => s.clans[seat]!.steps[st] < LAST_STEP);
/** Queue a «raise one stat of your choice» decision (dropped if every stat is at the last step). */
const ownStat = (s: BRState, seat: number) => { if (canRaise(s, seat)) s.queue.push({ k: 'stat', seat }); };

// ---------- setup ----------
function emptyClan(): Clan {
  return {
    hand: [], quests: [], warrior: null, leader: null, ship: null, monsters: [null, null], clans: [null, null, null],
    steps: { rage: 0, axes: 0, horns: 0 }, rage: 0, glory: 0, passed: false, resigned: null
  };
}

function startAge(s: BRState, rng: EngineRng) {
  const n = s.players;
  const ids = shuffle(rng, ageDeck(s.age, n)).map((d) => { s.inst.push(d); return s.inst.length - 1; });
  s.packs = Array.from({ length: n }, (_, i) => ids.slice(i * DEAL, (i + 1) * DEAL));
  s.step = 'draft';
  s.draft = { need: n === 2 ? 2 : 1, picked: Array.from({ length: n }, () => false), round: 0 };
  s.discarded = Array.from({ length: n }, () => false);
  log(s, { seat: -1, e: 'age', n: s.age });
}

function beginAction(s: BRState) {
  s.step = 'action';
  s.packs = s.packs.map(() => []);
  s.turn = s.first;
  s.spent = false;
  for (const [i, c] of s.clans.entries()) { c.rage = live(s, i) ? rageMax(s, i) : 0; c.passed = !live(s, i); }
  if (!s.clans[s.turn]!.rage) endTurn(s);
}

export function setup(ctx: { playerCount: number; options: Record<string, unknown>; rng: EngineRng }): BRState {
  const n = Math.min(5, Math.max(2, ctx.playerCount));
  const rng = ctx.rng;
  const tutorial = ctx.options.tutorial === true;
  const s: BRState = {
    players: n, tutorial, age: 1, step: 'draft', first: rng.nextInt(n), turn: 0, spent: false, inst: [],
    clans: Array.from({ length: n }, emptyClan), figs: [],
    rewards: { ygg: 'all' } as Record<ProvinceId, Reward>, pillaged: [], destroyed: [], ragnarok: [],
    packs: [], draft: { need: 1, picked: [], round: 0 }, discarded: [], battle: null, queue: [], log: [], resignSeq: 0, seq: 0, outcome: null
  };
  for (let seat = 0; seat < n; seat++) {
    newFigure(s, seat, 'leader', null);
    for (let k = 0; k < WARRIORS; k++) newFigure(s, seat, 'warrior', null);
    newFigure(s, seat, 'ship', null);
  }
  const rw = shuffle(rng, OUTER_REWARDS);
  RING.forEach((p, i) => { s.rewards[p] = rw[i]!; });
  const tokens = shuffle(rng, RING);
  s.ragnarok = tokens.slice(0, 3);
  s.destroyed = tokens.slice(3, 3 + (DESTROYED_AT_START[n] ?? 0));
  if (tutorial) return tutorialPosition(s);
  startAge(s, rng);
  return s;
}

/** Teaching position: the third Age's Action phase, two clans, a few figures on the board, fixed hands. */
function tutorialPosition(s: BRState): BRState {
  s.age = 3;
  s.first = 0;
  s.ragnarok = ['utg', 'hor', 'mus'];
  s.destroyed = ['and'];
  s.rewards = { ygg: 'all', myr: 'axes', elv: 'glory', ang: 'rage', gim: 'horns', and: 'glory', utg: 'rage', hor: 'axes', mus: 'horns' };
  const give = (seat: number, defs: CardId[]) => { for (const d of defs) { s.inst.push(d); s.clans[seat]!.hand.push(s.inst.length - 1); } };
  give(0, ['q3-man', 'm3-hel', 'b3-rage', 'b3-crush']);
  give(1, ['b3-tsmite', 'b3-crush']);
  const put = (seat: number, kind: FigureKind, k: number, at: Place) => {
    const f = s.figs.filter((x) => x.seat === seat && x.kind === kind)[k]!;
    f.at = at;
  };
  put(0, 'leader', 0, 'myr'); put(0, 'warrior', 0, 'myr'); put(0, 'warrior', 1, 'elv');
  put(1, 'leader', 0, 'gim'); put(1, 'warrior', 0, 'gim');
  for (const c of s.clans) c.steps = { rage: 0, axes: 0, horns: 0 };
  s.clans[0]!.glory = 12; s.clans[1]!.glory = 14;
  s.step = 'action';
  s.turn = 0;
  for (const [i, c] of s.clans.entries()) c.rage = i === 0 ? 4 : 2;
  return s;
}

// ---------- turn flow ----------
function endAction(s: BRState) {
  s.step = 'discard';
  s.discarded = s.clans.map((c, i) => !live(s, i) || (s.age === 3 ? true : c.hand.length <= 1));
  if (s.age === 3) for (const c of s.clans) c.hand = [];
  log(s, { seat: -1, e: 'end-action' });
}

function endTurn(s: BRState) {
  s.spent = false;
  const open = PROVINCE_IDS.filter((p) => alive(s, p));
  if (open.every((p) => s.pillaged.includes(p))) { endAction(s); return; }
  for (let k = 1; k <= s.players; k++) {
    const seat = (s.turn + k) % s.players;
    const c = s.clans[seat]!;
    if (c.rage > 0 && !c.passed && live(s, seat)) { s.turn = seat; return; }
  }
  endAction(s);
}

// ---------- invading ----------
export function invadeCost(s: BRState, seat: number, f: Figure, fromValhalla = false): number {
  if (fromValhalla) return 1;
  if (f.kind === 'leader') return 0;
  if (f.kind === 'warrior') return 1;
  if (f.kind === 'ship') return 3;
  if (freeMon(f)) return 0;
  return f.mon === 'm2-elf' ? 1 : CARD_BY_ID[f.mon!]!.mstr!;
}
export function invadeTargets(s: Pick<BRState, 'figs' | 'destroyed'>, f: Figure): Place[] {
  if (shipLike(f)) return FJORD_IDS;
  const out: Place[] = OUTER.filter((p) => alive(s, p) && villagesFree(s, p) > 0);
  if (f.kind === 'monster' && f.mon === 'm2-elf') out.push('ygg');
  return out;
}
const canBoard = (s: BRState, seat: number) => boardCount(s, seat) < hornsOf(s, seat);

function place(s: BRState, f: Figure, at: Place) { void s; f.at = at; }
/** An invasion: the figure arrives, and Troll / Fire Giant destroy the enemies already there. */
function invadeInto(s: BRState, f: Figure, at: Place) {
  place(s, f, at);
  if (isFjord(at) || !isOuter(at)) return;
  const others = s.figs.filter((x) => x.at === at && x.seat !== f.seat);
  if (f.kind === 'monster' && f.mon === 'm1-troll') for (const x of others) if (x.kind === 'warrior') kill(s, x);
  if (f.kind === 'monster' && f.mon === 'm2-fire') for (const x of others) if (x.kind !== 'monster') kill(s, x);
}

/** After any invasion: Frigga's Succor and Thor's Domain are offered. */
function afterInvade(s: BRState, seat: number, at: Place, chain: boolean) {
  if (isFjord(at)) return;
  const prov = at as ProvinceId;
  if (chain) return;
  if (has(s, seat, 'u1-succor') && inReserve(s, seat, 'warrior') && canBoard(s, seat) && villagesFree(s, prov) > 0) s.queue.push({ k: 'succor', seat, at: prov });
  if (has(s, seat, 'u2-thordomain') && s.clans[seat]!.rage >= 2 && !s.pillaged.includes(prov) && alive(s, prov)) s.queue.push({ k: 'domain', seat, at: prov });
}

// ---------- pillage / battle ----------
function startPillage(s: BRState, seat: number, at: ProvinceId, rep: boolean) {
  const order = seatsFrom(s, (seat + 1) % s.players);
  s.battle = {
    seat, at, rep, stage: 'call', call: { order, idx: 0, moved: false }, chosen: {}, revealed: false, late: {},
    parts: [], dead: [], saved: [], winner: null, losers: [], muted: [], totals: {}
  };
  log(s, { seat, e: 'pillage', at });
}

/** Figures a clan may call into a battle at `at`: its non-ship figures in an adjacent province, while a village is free. */
export function callable(s: BRState, seat: number, at: ProvinceId): Figure[] {
  if (!live(s, seat) || villagesFree(s, at) <= 0) return [];
  return s.figs.filter((f) => f.seat === seat && !shipLike(f) && f.at !== 'reserve' && f.at !== 'valhalla' && f.at !== 'box' && !isFjord(f.at as Place)
    && adjacent(f.at as ProvinceId, at) && alive(s, f.at as ProvinceId));
}
const participants = (s: BRState, at: ProvinceId) => [...new Set(s.figs.filter((f) => (placesOf(at) as Place[]).includes(f.at as Place)).map((f) => f.seat))].sort((a, b) => a - b);
const battleFigs = (s: BRState, seat: number, at: ProvinceId) => s.figs.filter((f) => f.seat === seat && (placesOf(at) as Place[]).includes(f.at as Place));
const pickersOf = (s: BRState, b: Battle) => b.parts.filter((seat) => s.clans[seat]!.hand.length > 0 && live(s, seat));

const isLateCard = (d: CardId) => d === 'b2-eye' || d === 'b3-gaze';
function cardBonus(s: BRState, b: Battle, seat: number, skipLate = false): number {
  const inst = b.chosen[seat];
  if (inst === null || inst === undefined) return 0;
  const d = defOf(s, inst);
  if (isLateCard(d.id) && !b.muted.includes(seat) && (skipLate || b.late[seat] === false)) return 0;
  if (d.kind === 'quest') {
    if (has(s, seat, 'u3-wrath')) return 5;
    if (has(s, seat, 'u1-tyrdomain')) return 3;
    return 0;
  }
  if (d.kind !== 'battle') return 0;
  if (d.str === null) {
    let best = 0;
    for (const o of Object.keys(b.chosen)) {
      const oi = b.chosen[o];
      if (Number(o) === seat || oi === null || oi === undefined) continue;
      const od = defOf(s, oi);
      if (od.kind === 'battle' && od.str !== null) best = Math.max(best, od.str!);
      else if (od.kind === 'quest') best = Math.max(best, has(s, Number(o), 'u3-wrath') ? 5 : has(s, Number(o), 'u1-tyrdomain') ? 3 : 0);
    }
    return best;
  }
  return d.str!;
}
const activeText = (s: BRState, b: Battle, seat: number, id: CardId): boolean => {
  const inst = b.chosen[seat];
  return inst !== null && inst !== undefined && s.inst[inst] === id && !b.muted.includes(seat);
};
const anyActive = (s: BRState, b: Battle, id: CardId): number[] => Object.keys(b.chosen).map(Number).filter((seat) => activeText(s, b, seat, id));

function discardCard(s: BRState, seat: number, inst: number) {
  const c = s.clans[seat]!;
  c.hand = c.hand.filter((i) => i !== inst);
}

function totalOf(s: BRState, b: Battle, seat: number, skipLate = false): number {
  return groupStr(s, seat, placesOf(b.at)) + cardBonus(s, b, seat, skipLate);
}

/** Advance the current battle as far as it can go without input; true when something happened. */
function stepBattle(s: BRState): boolean {
  const b = s.battle!;
  switch (b.stage) {
    case 'call': {
      if (b.call.idx >= b.call.order.length) {
        if (!b.call.moved || villagesFree(s, b.at) <= 0) { finishCall(s); return true; }
        b.call.idx = 0; b.call.moved = false; return true;
      }
      if (villagesFree(s, b.at) <= 0) { finishCall(s); return true; }
      const seat = b.call.order[b.call.idx]!;
      if (callable(s, seat, b.at).length === 0) { b.call.idx++; return true; }
      return false;
    }
    case 'cards': {
      const need = pickersOf(s, b).filter((seat) => b.chosen[seat] === undefined);
      if (need.length) return false;
      for (const seat of b.parts) if (b.chosen[seat] === undefined) b.chosen[seat] = null;
      b.revealed = true;
      b.stage = 'reveal';
      return true;
    }
    case 'reveal': {
      const parts = b.parts;
      b.muted = parts.filter((seat) => parts.some((o) => o !== seat && activeText(s, { ...b, muted: [] }, o, 'b3-primacy')));
      const watchers = [...anyActive(s, b, 'b2-watch'), ...anyActive(s, b, 'b3-watch')];
      if (watchers.length) {
        const w = seatsFrom(s, s.first).find((x) => watchers.includes(x))!;
        let sum = 0;
        for (const seat of Object.keys(b.chosen).map(Number)) {
          const inst = b.chosen[seat];
          if (inst === null || inst === undefined) continue;
          sum += Math.max(0, cardBonus(s, b, seat));
          discardCard(s, seat, inst);
        }
        s.clans[w]!.glory += sum;
        log(s, { seat: w, e: 'watch', n: sum });
        b.chosen = {}; b.revealed = false; b.late = {}; b.muted = [];
        b.stage = 'cards';
        return true;
      }
      for (const seat of anyActive(s, b, 'b1-smite')) {
        for (const o of parts) {
          if (o === seat) continue;
          const w = battleFigs(s, o, b.at).find((f) => f.kind === 'warrior' && f.at === b.at);
          if (w) kill(s, w);
        }
      }
      b.stage = 'tide';
      return true;
    }
    case 'tide': {
      b.stage = 'late';
      if (anyActive(s, b, 'b2-tide').length) {
        for (const seat of b.parts) {
          const figs = battleFigs(s, seat, b.at);
          if (figs.length > 1) s.queue.push({ k: 'tide', seat, figs: figs.map((f) => f.id) });
        }
      }
      return true;
    }
    case 'late': {
      b.stage = 'protect';
      b.totals = Object.fromEntries(b.parts.map((seat) => [seat, totalOf(s, b, seat, true)]));
      for (const seat of Object.keys(b.chosen).map(Number)) {
        const inst = b.chosen[seat];
        if (inst === null || inst === undefined) continue;
        if (isLateCard(s.inst[inst]!) && !b.muted.includes(seat)) s.queue.push({ k: 'late', seat, card: inst });
      }
      return true;
    }
    case 'protect': {
      const parts = b.parts;
      b.totals = Object.fromEntries(parts.map((seat) => [seat, totalOf(s, b, seat)]));
      const best = Math.max(...parts.map((seat) => b.totals[seat]!), 0);
      const top = parts.filter((seat) => b.totals[seat] === best);
      b.winner = top.length === 1 && parts.length > 0 ? top[0]! : null;
      b.losers = parts.filter((seat) => seat !== b.winner);
      for (const seat of b.losers) {
        const figs = battleFigs(s, seat, b.at).map((f) => f.id);
        if (figs.length && has(s, seat, 'u2-protection') && s.clans[seat]!.rage > 0) s.queue.push({ k: 'protect', seat, figs });
      }
      b.stage = 'apply';
      return true;
    }
    case 'apply': applyBattle(s); return true;
    case 'after': s.battle = null; return true;
  }
}

function finishCall(s: BRState) {
  const b = s.battle!;
  const parts = participants(s, b.at);
  if (parts.every((seat) => seat === b.seat)) {
    // nobody opposes: the pillage succeeds without a battle and without glory
    reward(s, b, b.seat);
    leaderBonus(s, b, b.seat);
    b.stage = 'after';
    return;
  }
  b.parts = parts;
  b.stage = 'cards';
}

/** Lord of Hammers / Axes / Spears after a successful pillage with the leader in the battle. */
function leaderBonus(s: BRState, b: Battle, seat: number) {
  const leaderIn = s.figs.find((f) => f.seat === seat && f.kind === 'leader' && (placesOf(b.at) as Place[]).includes(f.at as Place));
  if (!leaderIn) return;
  if (has(s, seat, 'l3-spears')) raiseAll(s, seat);
  if (has(s, seat, 'l2-axes')) ownStat(s, seat);
  if (has(s, seat, 'l1-hammers')) s.queue.push({ k: 'hammer', seat, fig: leaderIn.id });
}

function reward(s: BRState, b: Battle, seat: number) {
  const r = s.rewards[b.at];
  const times = battleFigs(s, seat, b.at).some((f) => f.kind === 'monster' && f.mon === 'm3-frost') ? 2 : 1;
  for (let i = 0; i < times; i++) {
    if (r === 'glory') s.clans[seat]!.glory += GLORY_REWARD;
    else if (r === 'all') raiseAll(s, seat);
    else raise(s, seat, r);
  }
  if (!s.pillaged.includes(b.at)) s.pillaged.push(b.at);
  log(s, { seat, e: 'reward', at: b.at, card: r });
}

function applyBattle(s: BRState) {
  const b = s.battle!;
  const parts = b.parts;
  const w = b.winner;
  const wc = w === null ? null : s.clans[w]!;
  const protectedFigs = new Set(b.saved);
  // losers lose their figures (a Protection saves some)
  for (const seat of b.losers) for (const f of battleFigs(s, seat, b.at)) if (!protectedFigs.has(f.id)) kill(s, f);
  const deadOf = (seat: number) => b.dead.filter((id) => s.figs[id]!.seat === seat).length;
  const enemyDead = (seat: number) => b.dead.length - deadOf(seat);
  // winner effects
  if (w !== null && wc) {
    if (b.seat === w) { reward(s, b, w); }
    wc.glory += axesOf(s, w);
    if (activeText(s, b, w, 'b1-hammer')) wc.glory += 3;
    if (activeText(s, b, w, 'b3-ascension')) { wc.glory += 3; wc.rage += 3; }
    if (activeText(s, b, w, 'b2-oath')) ownStat(s, w);
    if (b.seat === w && activeText(s, b, w, 'b1-grace')) ownStat(s, w);
    log(s, { seat: w, e: 'win', at: b.at, w });
  } else {
    log(s, { seat: b.seat, e: 'tie', at: b.at });
  }
  // loser card effects
  for (const seat of b.losers) {
    if (w !== null && wc) {
      if (activeText(s, b, seat, 'b1-trickery') && wc.rage > 0) { wc.rage--; s.clans[seat]!.rage++; }
      if (activeText(s, b, seat, 'b2-backstab')) { const t = Math.min(2, wc.glory); wc.glory -= t; s.clans[seat]!.glory += t; }
    }
  }
  // glory for destruction
  for (const seat of parts) {
    const c = s.clans[seat]!;
    if (has(s, seat, 'u1-glory') && enemyDead(seat) >= 2) c.glory += 2;
    const valk = battleFigs(s, seat, b.at).concat(b.dead.map((id) => s.figs[id]!).filter((f) => f.seat === seat && f.at === 'valhalla')).filter((f) => f.mon === 'm2-valkyrie');
    if (valk.length) c.glory += 2 * enemyDead(seat) * new Set(valk.map((f) => f.id)).size;
    if (activeText(s, b, seat, 'b3-judgement')) c.glory += 2 * b.dead.length;
  }
  if (w !== null && b.seat === w) leaderBonus(s, b, w);
  // cards: winner discards, a Poison loser takes them instead, Prowess keeps them for rage
  const poison = w === null ? [] : b.losers.filter((seat) => activeText(s, b, seat, 'b3-poison'));
  if (w !== null) {
    const inst = b.chosen[w];
    if (inst !== null && inst !== undefined) {
      if (poison.length) { discardCard(s, w, inst); s.clans[poison[0]!]!.hand.push(inst); }
      else if (has(s, w, 'u2-prowess') && wc!.rage > 0) s.queue.push({ k: 'prowess', seat: w, cards: [inst] });
      else if (!(isLateCard(s.inst[inst]!) && b.late[w] === false)) discardCard(s, w, inst);
    }
  }
  for (const seat of b.losers) {
    if (has(s, seat, 'u1-blessing') && inReserve(s, seat, 'warrior') && canBoard(s, seat) && villagesFree(s, b.at) > 0) s.queue.push({ k: 'blessing', seat, at: b.at });
  }
  b.stage = 'after';
}

// ---------- the other phases ----------
function resolveQuests(s: BRState) {
  for (const seat of seatsFrom(s, s.first)) {
    const c = s.clans[seat]!;
    for (const inst of c.quests) {
      const d = defOf(s, inst);
      const key = d.id.slice(3);
      let ok = false;
      if (key === 'alf' || key === 'man' || key === 'jot') {
        const region = key === 'alf' ? 'alfheim' : key === 'man' ? 'manheim' : 'jotunheim';
        ok = OUTER.some((p) => PROVINCES[p].region === region && alive(s, p) && leads(s, seat, p));
      } else if (key === 'ygg') ok = leads(s, seat, 'ygg');
      else if (key === 'death') ok = s.figs.filter((f) => f.seat === seat && f.at === 'valhalla').length >= 4;
      else if (key === 'wide') ok = PROVINCE_IDS.filter((p) => alive(s, p) && leads(s, seat, p)).length >= 2;
      if (ok) {
        c.glory += d.glory! * (has(s, seat, 'u3-throne') ? 2 : 1);
        ownStat(s, seat);
        log(s, { seat, e: 'quest', n: d.glory!, card: d.id });
      } else log(s, { seat, e: 'quest-failed', card: d.id });
    }
    c.quests = [];
  }
  s.step = 'ragnarok';
}

function resolveRagnarok(s: BRState) {
  const p = s.ragnarok[s.age - 1]!;
  const per = RAGNAROK_GLORY[s.age]!;
  for (const f of s.figs.filter((x) => (placesOf(p) as Place[]).includes(x.at as Place))) {
    const seat = f.seat;
    if (kill(s, f)) s.clans[seat]!.glory += per * (has(s, seat, 'u2-inspiration') ? 2 : 1);
  }
  s.destroyed.push(p);
  log(s, { seat: -1, e: 'ragnarok', at: p });
  s.step = 'release';
}

function resolveRelease(s: BRState) {
  for (const [seat, c] of s.clans.entries()) {
    const back = s.figs.filter((f) => f.seat === seat && f.at === 'valhalla');
    for (const f of back) f.at = 'reserve';
    c.glory += back.length * ((has(s, seat, 'u1-lokidomain') ? 1 : 0) + (has(s, seat, 'u2-eminence') ? 2 : 0) + (has(s, seat, 'u3-lokiwrath') ? 3 : 0));
  }
  s.step = 'endage';
}

export function finalScore(s: BRState, seat: number): number {
  const c = s.clans[seat]!;
  let g = c.glory;
  for (const st of STATS) {
    const step = c.steps[st];
    if (step === LAST_STEP) g += ENDGAME_BONUS_LAST;
    else if (step >= 3) g += ENDGAME_BONUS_STEP;
  }
  if (has(s, seat, 'u3-conquest')) g += 3 * boardCount(s, seat);
  return g;
}

function placements(s: BRState): Outcome {
  const alive = s.clans.map((_, i) => i).filter((i) => live(s, i));
  const dead = s.clans.map((_, i) => i).filter((i) => !live(s, i)).sort((a, b) => s.clans[b]!.resigned! - s.clans[a]!.resigned!);
  const scored = alive.map((seat) => ({ seat, score: finalScore(s, seat) })).sort((a, b) => b.score - a.score);
  const out: Outcome['placements'] = [];
  let place = 0;
  scored.forEach((x, i) => { if (i === 0 || x.score !== scored[i - 1]!.score) place = i + 1; out.push({ seat: x.seat, place, score: x.score }); });
  dead.forEach((seat, i) => out.push({ seat, place: scored.length + i + 1, score: s.clans[seat]!.glory }));
  return { placements: out, reason: dead.length && scored.length === 1 ? 'resign' : 'score' };
}

function endAge(s: BRState, rng: EngineRng) {
  s.pillaged = [];
  s.first = (s.first + 1) % s.players;
  for (const c of s.clans) c.passed = false;
  if (s.age === 3 || s.tutorial) {
    for (const [i] of s.clans.entries()) log(s, { seat: i, e: 'final', n: finalScore(s, i) });
    s.outcome = placements(s);
    s.step = 'over';
    return;
  }
  s.age = (s.age + 1) as 2 | 3;
  startAge(s, rng);
}

// ---------- driver ----------
/** Run everything that needs no player input; resigned seats are played with defaults. */
function settle(s: BRState, rng: EngineRng) {
  for (let guard = 0; guard < 500; guard++) {
    if (s.outcome) return;
    if (alivePlayers(s) <= 1 && s.players > 1) { s.outcome = placements(s); s.step = 'over'; return; }
    if (!s.battle) for (const f of s.figs) if (!live(s, f.seat) && f.at !== 'box') f.at = 'box';
    const pend = pending(s);
    const auto = pend.find((seat) => !live(s, seat));
    if (auto !== undefined) { const a = defaultAction(s, auto); if (a) { run(s, auto, a, rng); continue; } }
    if (s.queue.length) return;
    if (s.battle) { if (stepBattle(s)) continue; return; }
    switch (s.step) {
      case 'draft': return;
      case 'action': if (s.spent) { endTurn(s); continue; } return;
      case 'discard': if (s.discarded.every(Boolean)) { s.step = 'quest'; continue; } return;
      case 'quest': resolveQuests(s); continue;
      case 'ragnarok': resolveRagnarok(s); continue;
      case 'release': resolveRelease(s); continue;
      case 'endage': endAge(s, rng); continue;
      case 'over': return;
    }
  }
}
const alivePlayers = (s: BRState) => s.clans.filter((_, i) => live(s, i)).length;

export function pending(s: BRState): number[] {
  if (s.outcome) return [];
  const q = s.queue[0];
  if (q) return [q.seat];
  if (s.battle) {
    const b = s.battle;
    if (b.stage === 'call') {
      const seat = b.call.order[b.call.idx];
      return seat === undefined ? [] : [seat];
    }
    if (b.stage === 'cards') return pickersOf(s, b).filter((seat) => b.chosen[seat] === undefined);
    return [];
  }
  switch (s.step) {
    case 'draft': return s.draft.picked.map((p, i) => (!p && live(s, i) ? i : -1)).filter((i) => i >= 0).concat(s.clans.map((_, i) => i).filter((i) => !live(s, i) && !s.draft.picked[i]));
    case 'discard': return s.discarded.map((d, i) => (!d ? i : -1)).filter((i) => i >= 0);
    case 'action': return s.spent ? [] : [s.turn];
    default: return [];
  }
}

// ---------- validation and application ----------
const bad = (errorCode: string) => ({ ok: false as const, errorCode });
const OK = { ok: true as const };

function validateAction(s: BRState, seat: number, a: BRAction): { ok: true } | { ok: false; errorCode: string } {
  if (s.outcome) return bad('GAME_OVER');
  if (a.type === 'resign') return live(s, seat) ? OK : bad('NOT_YOUR_TURN');
  if (!live(s, seat)) return bad('NOT_YOUR_TURN');
  if (!pending(s).includes(seat)) return bad('NOT_YOUR_TURN');
  const c = s.clans[seat]!;
  const q = s.queue[0];
  if (q) return validateChoice(s, seat, q, a);
  if (s.battle) {
    const b = s.battle;
    if (b.stage === 'call' && a.type === 'call') {
      if (a.figure === undefined) return OK;
      const f = s.figs[a.figure];
      if (!f || !callable(s, seat, b.at).some((x) => x.id === f.id)) return bad('BR_BAD_CALL');
      return OK;
    }
    if (b.stage === 'cards' && a.type === 'play') {
      if (a.card === null) return c.hand.length === 0 ? OK : bad('BR_MUST_PLAY');
      return c.hand.includes(a.card) ? OK : bad('BR_BAD_CARD');
    }
    return bad('BR_BATTLE_PENDING');
  }
  if (s.step === 'draft') {
    if (a.type !== 'pick') return bad('BR_DRAFT');
    const pack = s.packs[seat]!;
    if (s.draft.picked[seat]) return bad('ALREADY_CHOSEN');
    const need = Math.min(s.draft.need, pack.length);
    if (a.cards.length !== need || new Set(a.cards).size !== need || !a.cards.every((i) => pack.includes(i))) return bad('BAD_CARDS');
    return OK;
  }
  if (s.step === 'discard') {
    if (a.type !== 'keep') return bad('BR_DISCARD');
    if (s.discarded[seat]) return bad('ALREADY_CHOSEN');
    if (a.card !== null && !c.hand.includes(a.card)) return bad('BR_BAD_CARD');
    return OK;
  }
  if (s.step !== 'action') return bad('NOT_YOUR_TURN');
  if (a.type === 'pass') return OK;
  if (c.rage <= 0) return bad('BR_NO_RAGE');
  switch (a.type) {
    case 'invade': {
      const f = s.figs[a.figure];
      if (!f || f.seat !== seat) return bad('BR_BAD_FIGURE');
      const fromV = f.at === 'valhalla';
      if (f.at !== 'reserve' && !(fromV && has(s, seat, 'u3-domain'))) return bad('BR_BAD_FIGURE');
      if (!canBoard(s, seat)) return bad('BR_HORNS');
      if (!invadeTargets(s, f).includes(a.at)) return bad('BR_BAD_PLACE');
      if (invadeCost(s, seat, f, fromV) > c.rage) return bad('BR_NO_RAGE');
      return OK;
    }
    case 'march': {
      if (c.rage < 1) return bad('BR_NO_RAGE');
      if (a.from === a.to || !alive(s, a.from) || !alive(s, a.to)) return bad('BR_BAD_PLACE');
      const figs = a.figures.map((i) => s.figs[i]);
      if (new Set(a.figures).size !== a.figures.length) return bad('BR_BAD_FIGURE');
      if (figs.some((f) => !f || f.seat !== seat || f.at !== a.from || shipLike(f))) return bad('BR_BAD_FIGURE');
      if (a.to !== 'ygg' && villagesFree(s, a.to) < figs.length) return bad('BR_NO_ROOM');
      return OK;
    }
    case 'upgrade': {
      if (!c.hand.includes(a.card)) return bad('BR_BAD_CARD');
      const d = defOf(s, a.card);
      if (!isUpgrade(d.kind)) return bad('BR_BAD_CARD');
      if (upgradeCost(s, seat, d.cost!) > c.rage) return bad('BR_NO_RAGE');
      if ((d.kind === 'monster' && c.monsters.every((m) => m !== null) && a.slot === undefined) || (d.kind === 'clan' && c.clans.every((m) => m !== null) && a.slot === undefined)) return bad('BR_NEED_SLOT');
      if (a.slot !== undefined && ((d.kind === 'monster' && a.slot > 1) || (d.kind !== 'monster' && d.kind !== 'clan' && a.slot > 0))) return bad('BR_BAD_SLOT');
      return OK;
    }
    case 'quest': {
      if (!c.hand.includes(a.card) || defOf(s, a.card).kind !== 'quest') return bad('BR_BAD_CARD');
      return OK;
    }
    case 'pillage': {
      if (!alive(s, a.at) || s.pillaged.includes(a.at)) return bad('BR_BAD_PLACE');
      if (!s.figs.some((f) => f.seat === seat && (placesOf(a.at) as Place[]).includes(f.at as Place))) return bad('BR_NO_FIGURE');
      return OK;
    }
    case 'challenge': {
      if (!has(s, seat, 'u2-challenge')) return bad('BR_BAD_CARD');
      if (c.rage < 2) return bad('BR_NO_RAGE');
      if (!alive(s, a.at) || !s.pillaged.includes(a.at)) return bad('BR_BAD_PLACE');
      if (!s.figs.some((f) => f.seat === seat && (placesOf(a.at) as Place[]).includes(f.at as Place))) return bad('BR_NO_FIGURE');
      return OK;
    }
    case 'sacrifice': {
      if (!has(s, seat, 'u3-sacrifice')) return bad('BR_BAD_CARD');
      if (new Set(a.figures).size !== 2) return bad('BR_BAD_FIGURE');
      if (a.figures.some((i) => !s.figs[i] || s.figs[i]!.seat !== seat || !onBoard(s.figs[i]!))) return bad('BR_BAD_FIGURE');
      if (c.steps[a.stat] >= LAST_STEP) return bad('BR_STAT_MAX');
      return OK;
    }
    default: return bad('BR_PHASE');
  }
}

export const upgradeCost = (s: Pick<BRState, 'clans' | 'inst'>, seat: number, base: number) => Math.max(0, base - (has(s, seat, 'u1-charm') ? 1 : 0));

function validateChoice(s: BRState, seat: number, q: Choice, a: BRAction): { ok: true } | { ok: false; errorCode: string } {
  if (a.type !== 'decide') return bad('BR_CHOICE_PENDING');
  const c = s.clans[seat]!;
  switch (q.k) {
    case 'freeInvade': {
      if (!a.yes) return OK;
      const f = s.figs[q.fig]!;
      if (a.at === undefined || !invadeTargets(s, f).includes(a.at) || !canBoard(s, seat) || f.at !== 'reserve') return bad('BR_BAD_PLACE');
      return OK;
    }
    case 'succor': return !a.yes || villagesFree(s, q.at) > 0 ? OK : bad('BR_NO_ROOM');
    case 'domain': return !a.yes || c.rage >= 2 ? OK : bad('BR_NO_RAGE');
    case 'stat': return a.stat && c.steps[a.stat] < LAST_STEP ? OK : bad('BR_STAT_MAX');
    case 'hammer': return !a.yes || (a.at !== undefined && !isFjord(a.at) && alive(s, a.at as ProvinceId) && adjacent(s.figs[q.fig]!.at as ProvinceId, a.at as ProvinceId) && villagesFree(s, a.at as ProvinceId) > 0) ? OK : bad('BR_BAD_PLACE');
    case 'blessing': return !a.yes || villagesFree(s, q.at) > 0 ? OK : bad('BR_NO_ROOM');
    case 'prowess': {
      const keep = a.cards ?? [];
      return keep.every((i) => q.cards.includes(i)) && keep.length <= c.rage ? OK : bad('BR_BAD_CARD');
    }
    case 'protect': {
      const fs = a.figures ?? [];
      return fs.every((i) => q.figs.includes(i)) && new Set(fs).size === fs.length && fs.length <= c.rage ? OK : bad('BR_BAD_FIGURE');
    }
    case 'tide': {
      const fs = a.figures ?? [];
      return fs.length === 1 && q.figs.includes(fs[0]!) ? OK : bad('BR_BAD_FIGURE');
    }
    case 'late': return a.yes === undefined ? bad('BR_BAD_CHOICE') : OK;
  }
}

function applyChoice(s: BRState, seat: number, q: Choice, a: Extract<BRAction, { type: 'decide' }>) {
  const c = s.clans[seat]!;
  switch (q.k) {
    case 'freeInvade': {
      if (!a.yes) break;
      const f = s.figs[q.fig]!;
      invadeInto(s, f, a.at!);
      log(s, { seat, e: 'invade', at: a.at!, n: 0 });
      afterInvade(s, seat, a.at!, false);
      break;
    }
    case 'succor': {
      if (!a.yes) break;
      const w = inReserve(s, seat, 'warrior');
      if (w && villagesFree(s, q.at) > 0 && canBoard(s, seat)) place(s, w, q.at);
      break;
    }
    case 'domain': {
      if (!a.yes) break;
      c.rage -= 2;
      s.queue.shift();
      startPillage(s, seat, q.at, false);
      return;
    }
    case 'stat': raise(s, seat, a.stat!); break;
    case 'hammer': if (a.yes) s.figs[q.fig]!.at = a.at as ProvinceId; break;
    case 'blessing': {
      if (!a.yes) break;
      const w = inReserve(s, seat, 'warrior');
      if (w && villagesFree(s, q.at) > 0 && canBoard(s, seat)) place(s, w, q.at);
      break;
    }
    case 'prowess': {
      const keep = a.cards ?? [];
      c.rage -= keep.length;
      for (const i of q.cards) if (!keep.includes(i)) discardCard(s, seat, i);
      break;
    }
    case 'protect': {
      const fs = a.figures ?? [];
      c.rage -= fs.length;
      s.battle!.saved.push(...fs);
      break;
    }
    case 'tide': {
      const keep = a.figures![0]!;
      for (const id of q.figs) if (id !== keep) kill(s, s.figs[id]!);
      break;
    }
    case 'late': {
      s.battle!.late[seat] = a.yes === true;
      break;
    }
  }
  s.queue.shift();
}

/** Spend/discard bookkeeping shared by actions; mutates s. */
function run(s: BRState, seat: number, a: BRAction, rng: EngineRng) {
  const c = s.clans[seat]!;
  s.seq++;
  const q = s.queue[0];
  if (a.type === 'resign') {
    c.resigned = ++s.resignSeq;
    c.rage = 0; c.passed = true;
    c.hand = []; c.quests = [];
    for (const f of s.figs) if (f.seat === seat && !s.battle) f.at = 'box';
    log(s, { seat, e: 'resign' });
    return;
  }
  if (q) { applyChoice(s, seat, q, a as Extract<BRAction, { type: 'decide' }>); return; }
  if (s.battle) {
    const b = s.battle;
    if (a.type === 'call' && b.stage === 'call') {
      if (a.figure !== undefined) {
        const f = s.figs[a.figure]!;
        const from = f.at;
        place(s, f, b.at);
        b.call.moved = true;
        log(s, { seat, e: 'call', at: b.at, to: String(from) });
      }
      b.call.idx++;
      return;
    }
    if (a.type === 'play' && b.stage === 'cards') { b.chosen[seat] = a.card; return; }
    return;
  }
  if (s.step === 'draft' && a.type === 'pick') {
    const pack = s.packs[seat]!;
    for (const i of a.cards) { c.hand.push(i); pack.splice(pack.indexOf(i), 1); }
    s.draft.picked[seat] = true;
    if (s.draft.picked.every(Boolean)) {
      s.draft.round++;
      if (s.draft.round >= HAND_PICKS / s.draft.need) { beginAction(s); return; }
      s.packs = s.packs.map((_, i) => s.packs[(i - 1 + s.players) % s.players]!);
      s.draft.picked = s.draft.picked.map(() => false);
    }
    return;
  }
  if (s.step === 'discard' && a.type === 'keep') {
    c.hand = a.card === null || s.age === 3 ? [] : c.hand.filter((i) => i === a.card);
    s.discarded[seat] = true;
    return;
  }
  // action phase
  switch (a.type) {
    case 'pass': c.rage = 0; c.passed = true; s.spent = true; log(s, { seat, e: 'pass' }); break;
    case 'invade': {
      const f = s.figs[a.figure]!;
      const fromV = f.at === 'valhalla';
      c.rage -= invadeCost(s, seat, f, fromV);
      invadeInto(s, f, a.at);
      log(s, { seat, e: 'invade', at: a.at, n: f.id });
      s.spent = true;
      afterInvade(s, seat, a.at, false);
      break;
    }
    case 'march': {
      c.rage -= 1;
      for (const i of a.figures) place(s, s.figs[i]!, a.to);
      log(s, { seat, e: 'march', at: a.to, to: a.from });
      s.spent = true;
      break;
    }
    case 'upgrade': {
      const d = defOf(s, a.card);
      c.rage -= upgradeCost(s, seat, d.cost!);
      c.hand = c.hand.filter((i) => i !== a.card);
      const slotFree = (arr: (number | null)[]) => arr.findIndex((x) => x === null);
      if (d.kind === 'warrior') c.warrior = a.card;
      else if (d.kind === 'leader') c.leader = a.card;
      else if (d.kind === 'ship') c.ship = a.card;
      else if (d.kind === 'clan') { const i = a.slot ?? slotFree(c.clans); c.clans[i] = a.card; }
      else {
        const i = a.slot ?? slotFree(c.monsters);
        const old = c.monsters[i];
        if (old !== null && old !== undefined) {
          const oldMon = s.figs.find((f) => f.seat === seat && f.kind === 'monster' && f.mon === s.inst[old]);
          if (oldMon) oldMon.at = 'box';
        }
        c.monsters[i] = a.card;
      }
      s.spent = true;
      log(s, { seat, e: 'upgrade', card: d.id });
      let fig: Figure | undefined;
      if (d.kind === 'leader') fig = inReserve(s, seat, 'leader');
      else if (d.kind === 'warrior') fig = inReserve(s, seat, 'warrior');
      else if (d.kind === 'ship') fig = inReserve(s, seat, 'ship');
      else if (d.kind === 'monster') fig = newFigure(s, seat, 'monster', d.id);
      if (fig && canBoard(s, seat)) s.queue.push({ k: 'freeInvade', seat, fig: fig.id });
      break;
    }
    case 'quest': {
      c.hand = c.hand.filter((i) => i !== a.card);
      c.quests.push(a.card);
      s.spent = true;
      log(s, { seat, e: 'commit' });
      break;
    }
    case 'pillage': { s.spent = true; startPillage(s, seat, a.at, false); break; }
    case 'challenge': { c.rage -= 2; s.spent = true; startPillage(s, seat, a.at, true); break; }
    case 'sacrifice': {
      for (const i of a.figures) { const f = s.figs[i]!; kill(s, f, false); }
      raise(s, seat, a.stat);
      s.spent = true;
      log(s, { seat, e: 'sacrifice' });
      break;
    }
    default: break;
  }
  void rng;
}

/** What a seat does when it times out or has resigned. Always a legal action for that moment (or null). */
export function defaultAction(s: BRState, seat: number): BRAction | null {
  const c = s.clans[seat]!;
  const q = s.queue[0];
  if (q) {
    switch (q.k) {
      case 'stat': return { type: 'decide', stat: STATS.find((st) => c.steps[st] < LAST_STEP) ?? 'rage' };
      case 'tide': return { type: 'decide', figures: [q.figs[0]!] };
      case 'late': return { type: 'decide', yes: true };
      case 'prowess': return { type: 'decide', cards: [] };
      case 'protect': return { type: 'decide', figures: [] };
      default: return { type: 'decide', yes: false };
    }
  }
  if (s.battle) {
    if (s.battle.stage === 'call') return { type: 'call' };
    if (s.battle.stage === 'cards') {
      if (!c.hand.length) return { type: 'play', card: null };
      const best = [...c.hand].sort((a, b2) => (defOf(s, b2).str ?? 0) - (defOf(s, a).str ?? 0))[0]!;
      return { type: 'play', card: best };
    }
    return null;
  }
  if (s.step === 'draft') {
    const pack = s.packs[seat] ?? [];
    return { type: 'pick', cards: pack.slice(0, Math.min(s.draft.need, pack.length)) };
  }
  if (s.step === 'discard') return { type: 'keep', card: null };
  if (s.step === 'action') return { type: 'pass' };
  return null;
}

// ---------- view ----------
function project(s: BRState, viewer: Viewer): BRView {
  const seat = viewer.kind === 'player' ? viewer.seat : null;
  const c = seat === null ? null : s.clans[seat]!;
  const b = s.battle;
  const chosen: BattleView['chosen'] = {};
  if (b) for (const [k, v] of Object.entries(b.chosen)) chosen[k] = v === null ? 'none' : b.revealed || Number(k) === seat ? s.inst[v]! : 'hidden';
  const q = s.queue[0] ?? null;
  const mineChoice = q && seat === q.seat;
  const view: BRView = {
    players: s.players, age: s.age, step: s.step, first: s.first, turn: s.step === 'action' ? s.turn : null, spent: s.spent,
    seats: s.clans.map((x, i) => ({
      seat: i, steps: { ...x.steps }, rage: x.rage, glory: x.glory, passed: x.passed, resigned: x.resigned !== null, hand: x.hand.length, quests: x.quests.length,
      warrior: x.warrior === null ? null : s.inst[x.warrior]!, leader: x.leader === null ? null : s.inst[x.leader]!, ship: x.ship === null ? null : s.inst[x.ship]!,
      monsters: x.monsters.map((m) => (m === null ? null : s.inst[m]!)), clans: x.clans.map((m) => (m === null ? null : s.inst[m]!))
    })),
    figs: s.figs.filter((f) => f.at !== 'box').map((f) => ({ ...f })),
    rewards: s.rewards, pillaged: [...s.pillaged], destroyed: [...s.destroyed], ragnarok: [...s.ragnarok],
    doom: s.step === 'over' ? null : s.ragnarok[s.age - 1] ?? null,
    draft: s.step === 'draft' ? { need: s.draft.need, picked: [...s.draft.picked], round: s.draft.round } : null,
    discarded: [...s.discarded],
    me: seat === null || !c ? null : {
      seat,
      hand: c.hand.map((i) => ({ id: i, def: s.inst[i]! })),
      quests: c.quests.map((i) => ({ id: i, def: s.inst[i]! })),
      pack: s.step === 'draft' && !s.draft.picked[seat] ? (s.packs[seat] ?? []).map((i) => ({ id: i, def: s.inst[i]! })) : []
    },
    battle: !b ? null : {
      seat: b.seat, at: b.at, rep: b.rep, stage: b.stage, caller: b.stage === 'call' ? b.call.order[b.call.idx] ?? null : null,
      waiting: b.stage === 'cards' ? pickersOf(s, b).filter((x) => b.chosen[x] === undefined) : [],
      chosen, revealed: b.revealed, dead: [...b.dead], saved: [...b.saved], winner: b.winner, losers: [...b.losers], muted: [...b.muted],
      totals: b.totals, late: b.late
    },
    choice: !q ? null : {
      k: q.k, seat: q.seat,
      ...(('fig' in q) ? { fig: q.fig } : {}), ...(('at' in q) ? { at: q.at } : {}),
      ...(('cards' in q && mineChoice) ? { cards: q.cards } : {}), ...(('figs' in q) ? { figs: q.figs } : {}),
      ...(('card' in q && mineChoice) ? { card: q.card } : {})
    },
    log: s.log.slice(-40), seq: s.seq, outcome: s.outcome, tutorial: s.tutorial
  };
  return view;
}

function hints(s: BRState, viewer: Viewer): ActionHint[] {
  if (viewer.kind !== 'player' || s.outcome) return [];
  const seat = viewer.seat;
  if (!pending(s).includes(seat) || !live(s, seat)) return [];
  const c = s.clans[seat]!;
  const out: ActionHint[] = [];
  const q = s.queue[0];
  if (q) { out.push({ type: 'decide', choice: q.k }); return out; }
  if (s.battle) {
    const b = s.battle;
    if (b.stage === 'call') { out.push({ type: 'call' }); for (const f of callable(s, seat, b.at)) out.push({ type: 'call', figure: f.id }); }
    else if (b.stage === 'cards') for (const i of c.hand.length ? c.hand : [null]) out.push({ type: 'play', card: i });
    return out;
  }
  if (s.step === 'draft') { out.push({ type: 'pick', need: Math.min(s.draft.need, s.packs[seat]!.length) }); return out; }
  if (s.step === 'discard') { out.push({ type: 'keep', card: null }); for (const i of c.hand) out.push({ type: 'keep', card: i }); return out; }
  if (s.step !== 'action') return out;
  out.push({ type: 'pass' });
  if (c.rage <= 0) return out;
  for (const f of s.figs.filter((x) => x.seat === seat && (x.at === 'reserve' || (x.at === 'valhalla' && has(s, seat, 'u3-domain'))))) {
    if (!canBoard(s, seat) || invadeCost(s, seat, f, f.at === 'valhalla') > c.rage) continue;
    for (const at of invadeTargets(s, f)) out.push({ type: 'invade', figure: f.id, at });
  }
  if (c.rage >= 1) for (const from of PROVINCE_IDS) if (alive(s, from) && s.figs.some((f) => f.seat === seat && f.at === from && !shipLike(f))) out.push({ type: 'march', from });
  for (const i of c.hand) {
    const d = defOf(s, i);
    if (isUpgrade(d.kind) && upgradeCost(s, seat, d.cost!) <= c.rage) out.push({ type: 'upgrade', card: i });
    if (d.kind === 'quest') out.push({ type: 'quest', card: i });
  }
  for (const p of PROVINCE_IDS) {
    if (!alive(s, p) || !s.figs.some((f) => f.seat === seat && (placesOf(p) as Place[]).includes(f.at as Place))) continue;
    if (!s.pillaged.includes(p)) out.push({ type: 'pillage', at: p });
    else if (has(s, seat, 'u2-challenge') && c.rage >= 2) out.push({ type: 'challenge', at: p });
  }
  if (has(s, seat, 'u3-sacrifice') && s.figs.filter((f) => f.seat === seat && onBoard(f)).length >= 2) out.push({ type: 'sacrifice' });
  return out;
}

export function publicSummary(s: BRState): PublicSummary {
  const scores = s.clans.map((_, i) => s.clans[i]!.glory);
  const top = Math.max(...scores);
  return {
    seats: s.clans.map((c, i) => ({
      seat: i,
      primary: { label: 'افتخار', value: c.glory },
      stats: [
        { key: 'rage', label: 'خشم', value: s.step === 'action' ? `${c.rage}/${TRACKS.rage[c.steps.rage]}` : `${TRACKS.rage[c.steps.rage]}` },
        { key: 'axes', label: 'تبر', value: TRACKS.axes[c.steps.axes]! },
        { key: 'horns', label: 'شاخ', value: `${boardCount(s, i)}/${TRACKS.horns[c.steps.horns]}` },
        { key: 'cards', label: 'کارت', value: c.hand.length }
      ],
      status: c.resigned !== null ? 'out' : s.outcome ? (s.outcome.placements.find((p) => p.seat === i)?.place === 1 ? 'winner' : 'done') : c.passed && s.step === 'action' ? 'passed' : 'playing',
      ...(s.step === 'action' ? { turnOrder: ((i - s.first + s.players) % s.players) + 1 } : {})
    })),
    shared: [{ key: 'age', label: 'عصر', value: s.age, max: 3 }],
    ...(top > 0 ? { leaderSeat: scores.indexOf(top) } : {}),
    moves: s.log.filter((x) => x.seat >= 0 && ['invade', 'march', 'pillage', 'upgrade', 'commit', 'pass', 'win'].includes(x.e)).slice(-20).map((x) => ({ seat: x.seat, text: logText(x) }))
  };
}
const logText = (x: LogEntry): string => {
  switch (x.e) {
    case 'invade': return `حمله ${x.at ? PROVINCES[x.at as ProvinceId]?.nameFa ?? 'خلیج' : ''}`;
    case 'march': return `لشکرکشی ${x.at ? PROVINCES[x.at as ProvinceId]?.nameFa ?? '' : ''}`;
    case 'pillage': return `غارت ${x.at ? PROVINCES[x.at as ProvinceId]?.nameFa ?? '' : ''}`;
    case 'upgrade': return `ارتقا ${x.card ? CARD_BY_ID[x.card]?.nameFa ?? '' : ''}`;
    case 'commit': return 'تعهد به مأموریت';
    case 'win': return 'برد نبرد';
    default: return 'گذشت';
  }
};

// ---------- the module ----------
export const bloodRageModule: GameModule<BRState, BRAction, BRView> = {
  manifest: def.manifest,
  actionSchema: brAction,
  setup,
  validate(state, actor: Actor, action) {
    if (actor.kind !== 'player') return bad('NOT_YOUR_TURN');
    return validateAction(state, actor.seat, action);
  },
  apply(state, actor: Actor, action, ctx: EngineContext): Transition<BRState> {
    const s = structuredClone(state);
    const seat = (actor as { seat: number }).seat;
    run(s, seat, action, ctx.rng);
    settle(s, ctx.rng);
    return done(s, [{ type: action.type, seat }]);
  },
  project,
  legalActions: hints,
  outcome: (s) => s.outcome,
  onTimeout(state, _event, ctx): Transition<BRState> {
    const s = structuredClone(state);
    for (const seat of pending(s)) {
      if (s.outcome || !pending(s).includes(seat)) continue;
      const a = defaultAction(s, seat);
      if (!a) continue;
      run(s, seat, a, ctx.rng);
      settle(s, ctx.rng);
    }
    return done(s, [{ type: 'timeout' }]);
  },
  pendingSeats: pending,
  publicSummary,
  tutorial: {
    seed: 7,
    options: { tutorial: true },
    introFa: 'آموزش: عصر سوم را با ۴ خشم و چند نیرو در صفحه شروع می‌کنید (رقیب ۲ خشم دارد). با ارتقا، حمله، تعهد به مأموریت، لشکرکشی و یک غارت واقعی افتخار جمع کنید؛ پایان عصر راگناروک است و بیشترین افتخار برنده می‌شود.',
    steps: [
      { instructionFa: 'ارتقا: کارت «سرباز هل» را بازی کنید. هزینه‌اش ۰ خشم است و هیولا را بی‌درنگ رایگان وارد صفحه می‌کنید.', expected: { type: 'upgrade', card: 1 }, reply: null },
      { instructionFa: 'حمله: سرباز هل را رایگان در استان هورگر بگذارید (روستای خالی آن را انتخاب کنید).', expected: { type: 'decide', yes: true, at: 'hor' }, reply: { type: 'invade', figure: 12, at: 'utg' } },
      { instructionFa: 'مأموریت: کارت «مانهایم!» را رایگان و پنهان تعهد کنید. اگر پایان عصر بیشترین قدرت را در یک استان مانهایم (میرک‌ولر، الواگر یا آنگربودا) داشته باشید، افتخار می‌گیرید.', expected: { type: 'quest', card: 0 }, reply: { type: 'pass' } },
      { instructionFa: 'لشکرکشی: با ۱ خشم رهبر و جنگجوی میرک‌ولر را به گیملی ببرید؛ آنجا رقیب شما هست و می‌توانید آن را غارت کنید. (الواگر را نگه می‌دارید تا مأموریتتان بماند.)', expected: { type: 'march', from: 'myr', to: 'gim', figures: [0, 1] }, reply: null },
      { instructionFa: 'غارت: گیملی را غارت کنید. رایگان است. چون رقیب آنجاست نبرد می‌شود.', expected: { type: 'pillage', at: 'gim' }, reply: null },
      { instructionFa: 'نبرد: کارت «غرّش تیر» (+۶) را پنهان بازی کنید؛ رقیب هم همزمان کارتش را می‌گذارد. قدرت نیروها به‌علاوهٔ کارت مقایسه می‌شود.', expected: { type: 'play', card: 2 }, reply: { type: 'play', card: 4 } },
      { instructionFa: 'برنده شدید: افتخار تبرتان و پاداش غارت را گرفتید. حالا «گذشتن» را بزنید تا خشم باقی‌مانده را رها کنید و عصر تمام شود.', expected: { type: 'pass' }, reply: null },
      { instructionFa: 'مأموریت انجام شد! یکی از ویژگی‌هایتان را یک پله بالا ببرید (مثلاً خشم).', expected: { type: 'decide', stat: 'rage' }, reply: null }
    ],
    completedFa: 'آموزش تمام شد: با ارتقا، حمله، لشکرکشی، مأموریت و غارت پیروز شدید. در بازی کامل سه عصر کامل بازی می‌کنید و هر عصر با درفت کارت شروع می‌شود.'
  }
};

function done(s: BRState, events: { type: string; [k: string]: unknown }[]): Transition<BRState> {
  return {
    nextState: s,
    internalEvents: events,
    scheduleChanges: s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : [{ kind: 'set', deadlineKey: 'turn' }]
  };
}
