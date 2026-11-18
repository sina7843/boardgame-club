// Blood Rage: the ENGINE.md contract (§5 actions, §7 decisions, §9 legalActions / project) on top of the rules core in
// rules.ts. Ids on the wire: figures "f<n>", provinces 0..8 (0 = Yggdrasil, 1..8 clockwise from Myrkulor), fjords 0..3,
// villages 1..32, cards = BGA card numbers (content.json). The core keeps its own internal ids; this file translates.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, PublicSummary, Validation, Viewer } from '@bg/game-sdk';
import { bloodRage as def } from './definition.ts';
import {
  adjacent, CARD_BY_ID, FJORDS, isFjord, isUpgrade, LAST_STEP, RING, STATS, TRACKS,
  type FigureKind, type Place, type ProvinceId, type Reward as CoreReward, type Stat
} from './data.ts';
import {
  bloodRageCore, boardCount, callable, canBoard, finalScore, freeSlots, has, hornsOf, invadeCost, invadeTargets,
  pending, publicSummary as coreSummary, shipLike, slotMap, upgradeCost, VILLAGES,
  type BRAction, type BRState, type Choice, type Figure, type LogEntry, type Step
} from './rules.ts';
import { CARDS as CONTENT_CARDS } from './content/index.ts';

// ---------- ids ----------
export const NUM_PROV: ProvinceId[] = ['ygg', ...RING];
export const PROV_NUM = Object.fromEntries(NUM_PROV.map((p, i) => [p, i])) as Record<ProvinceId, number>;
const FJ = ['f1', 'f2', 'f3', 'f4'] as const;
export type Where = 'reserve' | 'valhalla' | 'box' | 'yggdrasil' | `village:${number}` | `fjord:${number}`;
export type StatKey = 'rage' | 'axe' | 'horn';
export type Reward = 'yggdrasil' | 'rage' | 'axe' | 'horn' | 'glory';
const STAT_IN: Record<StatKey, Stat> = { rage: 'rage', axe: 'axes', horn: 'horns' };
const STAT_OUT: Record<Stat, StatKey> = { rage: 'rage', axes: 'axe', horns: 'horn' };
const REWARD_OUT: Record<CoreReward, Reward> = { all: 'yggdrasil', rage: 'rage', axes: 'axe', horns: 'horn', glory: 'glory' };
export const figId = (n: number) => `f${n}`;
const parseFig = (x: string) => Number(x.slice(1));
export function whereOf(f: Figure, slots: Map<number, number>): Where {
  if (f.at === 'reserve' || f.at === 'valhalla' || f.at === 'box') return f.at;
  if (f.at === 'ygg') return 'yggdrasil';
  if (isFjord(f.at)) return `fjord:${FJ.indexOf(f.at)}`;
  return `village:${slots.get(f.id) ?? VILLAGES[f.at][0]!}`;
}
function parseWhere(w: string): { at: Place; slot?: number } | null {
  if (w === 'yggdrasil') return { at: 'ygg' };
  const [k, n] = w.split(':');
  const i = Number(n);
  if (k === 'fjord' && FJ[i]) return { at: FJ[i] };
  if (k === 'village') {
    const p = NUM_PROV.find((x) => VILLAGES[x].includes(i));
    return p ? { at: p, slot: i } : null;
  }
  return null;
}
const targetsOf = (s: BRState, places: Place[]): Where[] => places.flatMap((p): Where[] =>
  p === 'ygg' ? ['yggdrasil'] : isFjord(p) ? [`fjord:${FJ.indexOf(p)}`] : freeSlots(s, p).map((v) => `village:${v}` as Where));

// ---------- actions ----------
export const PENDING_KINDS = ['draftPick', 'freeInvade', 'extraWarrior', 'instantPillage', 'callToBattle', 'battleCard', 'afterReveal',
  'keepOneFigure', 'saveFigure', 'keepCards', 'moveLeader', 'loserInvade', 'raiseStat', 'discardKeep'] as const;
export type PendingKind = typeof PENDING_KINDS[number];
const fig = z.string().regex(/^f\d{1,3}$/);
const where = z.string().regex(/^(village:\d{1,2}|fjord:[0-3]|yggdrasil)$/);
const prov = z.number().int().min(0).max(8);
const card = z.number().int().min(0).max(100000);
const statKey = z.enum(['rage', 'axe', 'horn']);
export const bloodRageAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('draftPick'), cards: z.array(card).min(1).max(2) }),
  z.strictObject({ type: z.literal('invade'), figure: fig, to: where }),
  z.strictObject({ type: z.literal('march'), from: prov, to: prov, figures: z.array(fig).min(1).max(20) }),
  z.strictObject({ type: z.literal('upgrade'), card, slot: z.enum(['leader', 'warrior', 'ship', 'monster', 'clan']), index: z.number().int().min(0).max(2).optional() }),
  z.strictObject({ type: z.literal('quest'), card }),
  z.strictObject({ type: z.literal('pillage'), province: prov }),
  z.strictObject({ type: z.literal('clanAction'), card, target: prov.optional(), figures: z.array(fig).max(2).optional(), stat: statKey.optional() }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('decide'), kind: z.enum(PENDING_KINDS), choice: z.unknown() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BloodRageAction = z.infer<typeof bloodRageAction>;

const QK: Record<Choice['k'], PendingKind> = {
  freeInvade: 'freeInvade', succor: 'extraWarrior', domain: 'instantPillage', stat: 'raiseStat', hammer: 'moveLeader',
  blessing: 'loserInvade', prowess: 'keepCards', protect: 'saveFigure', tide: 'keepOneFigure', late: 'afterReveal'
};
/** The decision the game waits for (null in a normal action turn). */
export function pendingKind(s: BRState): PendingKind | null {
  const q = s.queue[0];
  if (q) return QK[q.k];
  if (s.battle?.stage === 'call') return 'callToBattle';
  if (s.battle?.stage === 'cards') return 'battleCard';
  if (s.step === 'discard') return 'discardKeep';
  if (s.step === 'draft') return 'draftPick';
  return null;
}

const toObj = z.strictObject({ to: where.optional() }).nullable();
const CHOICE = {
  draftPick: z.strictObject({ cards: z.array(card).min(1).max(2) }),
  freeInvade: z.strictObject({ to: where }).nullable(),
  extraWarrior: toObj,
  instantPillage: z.boolean(),
  callToBattle: z.union([z.literal('pass'), z.literal('passAll'), z.strictObject({ figure: fig, to: where.optional() })]),
  battleCard: z.strictObject({ card }),
  afterReveal: z.strictObject({ card }).nullable(),
  keepOneFigure: fig,
  saveFigure: z.array(fig).max(20),
  keepCards: z.array(card).max(20),
  moveLeader: prov.nullable(),
  loserInvade: toObj,
  raiseStat: statKey,
  discardKeep: card.nullable()
} satisfies Record<PendingKind, z.ZodType>;

type T = { ok: true; action: BRAction } | { ok: false; errorCode: string };
const err = (errorCode: string): T => ({ ok: false, errorCode });
const ok = (action: BRAction): T => ({ ok: true, action });

/** Contract action → core action. */
export function toInternal(s: BRState, seat: number, a: BloodRageAction): T {
  const c = s.clans[seat];
  if (!c) return err('NOT_YOUR_TURN');
  switch (a.type) {
    case 'resign': return ok({ type: 'resign' });
    case 'pass': return ok({ type: 'pass' });
    case 'draftPick': return ok({ type: 'pick', cards: a.cards });
    case 'invade': {
      const w = parseWhere(a.to);
      if (!w) return err('BAD_TARGET');
      return ok({ type: 'invade', figure: parseFig(a.figure), at: w.at, ...(w.slot !== undefined ? { slot: w.slot } : {}) });
    }
    case 'march': return ok({ type: 'march', from: NUM_PROV[a.from]!, to: NUM_PROV[a.to]!, figures: a.figures.map(parseFig) });
    case 'upgrade': {
      const d = s.inst[a.card] === undefined ? undefined : CARD_BY_ID[s.inst[a.card]!];
      if (!d || !c.hand.includes(a.card) || !isUpgrade(d.kind)) return err('NOT_UPGRADE_CARD');
      if (d.kind !== a.slot) return err('SLOT_MISMATCH');
      return ok({ type: 'upgrade', card: a.card, ...(a.index !== undefined ? { slot: a.index } : {}) });
    }
    case 'quest': return ok({ type: 'quest', card: a.card });
    case 'pillage': return ok({ type: 'pillage', at: NUM_PROV[a.province]! });
    case 'clanAction': {
      const owned = c.clans.includes(a.card) ? s.inst[a.card] : undefined;
      if (owned === 'u2-challenge' && a.target !== undefined) return ok({ type: 'challenge', at: NUM_PROV[a.target]! });
      if (owned === 'u3-sacrifice' && a.figures && a.stat) return ok({ type: 'sacrifice', figures: a.figures.map(parseFig), stat: STAT_IN[a.stat] });
      return err('CARD_NOT_OWNED');
    }
    case 'decide': {
      if (pendingKind(s) !== a.kind) return err('WRONG_DECISION');
      const parsed = CHOICE[a.kind].safeParse(a.choice);
      if (!parsed.success) return err('BAD_CHOICE');
      const ch = parsed.data as never;
      const slotOf = (x: { to?: string } | null) => {
        const w = x?.to ? parseWhere(x.to) : null;
        return w?.slot !== undefined ? { slot: w.slot } : {};
      };
      switch (a.kind) {
        case 'draftPick': return ok({ type: 'pick', cards: (ch as { cards: number[] }).cards });
        case 'callToBattle': {
          const x = ch as 'pass' | 'passAll' | { figure: string; to?: string };
          if (x === 'pass') return ok({ type: 'call' });
          if (x === 'passAll') return ok({ type: 'call', all: true });
          return ok({ type: 'call', figure: parseFig(x.figure), ...slotOf(x) });
        }
        case 'battleCard': return ok({ type: 'play', card: (ch as { card: number }).card });
        case 'discardKeep': return ok({ type: 'keep', card: ch as number | null });
        case 'freeInvade': {
          const x = ch as { to: string } | null;
          if (!x) return ok({ type: 'decide', yes: false });
          const w = parseWhere(x.to);
          if (!w) return err('BAD_TARGET');
          return ok({ type: 'decide', yes: true, at: w.at, ...(w.slot !== undefined ? { slot: w.slot } : {}) });
        }
        case 'extraWarrior': case 'loserInvade': {
          const x = ch as { to?: string } | null;
          return ok({ type: 'decide', yes: x !== null, ...slotOf(x) });
        }
        case 'instantPillage': return ok({ type: 'decide', yes: ch as boolean });
        case 'raiseStat': return ok({ type: 'decide', stat: STAT_IN[ch as StatKey] });
        case 'moveLeader': {
          const x = ch as number | null;
          return x === null ? ok({ type: 'decide', yes: false }) : ok({ type: 'decide', yes: true, at: NUM_PROV[x]! });
        }
        case 'keepCards': return ok({ type: 'decide', cards: ch as number[] });
        case 'saveFigure': return ok({ type: 'decide', figures: (ch as string[]).map(parseFig) });
        case 'keepOneFigure': return ok({ type: 'decide', figures: [parseFig(ch as string)] });
        case 'afterReveal': return ok({ type: 'decide', yes: ch !== null });
      }
    }
  }
}

/** Core error → ENGINE.md §5 error code (more precise where the contract names one). */
function refine(s: BRState, a: BloodRageAction, code: string): string {
  const base: Record<string, string> = { BR_NO_RAGE: 'NO_RAGE', BR_HORNS: 'HORNS_FULL', BR_NO_ROOM: 'NOT_ENOUGH_VILLAGES', BR_VILLAGE_TAKEN: 'VILLAGE_TAKEN' };
  if (a.type === 'invade' && code === 'BR_BAD_FIGURE') return 'NOT_IN_RESERVE';
  if (a.type === 'invade' && code === 'BR_BAD_PLACE') {
    const w = parseWhere(a.to);
    const f = s.figs[parseFig(a.figure)];
    if (!w || !f) return 'BAD_TARGET';
    if (w.at === 'ygg') return 'YGGDRASIL_MARCH_ONLY';
    if (shipLike(f) !== isFjord(w.at)) return 'SHIP_FJORD_ONLY';
    if (!isFjord(w.at) && s.destroyed.includes(w.at)) return 'PROVINCE_DESTROYED';
    if (isFjord(w.at)) return 'PROVINCE_DESTROYED';
    return 'VILLAGE_TAKEN';
  }
  if (a.type === 'march') {
    if (code === 'BR_BAD_PLACE') return a.from === a.to ? 'SAME_PROVINCE' : 'PROVINCE_DESTROYED';
    if (code === 'BR_BAD_FIGURE') return a.figures.some((x) => { const f = s.figs[parseFig(x)]; return f && shipLike(f); }) ? 'SHIPS_CANNOT_MOVE' : 'NOT_YOUR_FIGURE';
  }
  if (a.type === 'upgrade' && code === 'BR_BAD_CARD') return 'NOT_UPGRADE_CARD';
  if (a.type === 'upgrade' && (code === 'BR_BAD_SLOT' || code === 'BR_NEED_SLOT')) return 'SLOT_MISMATCH';
  if (a.type === 'quest' && code === 'BR_BAD_CARD') return 'NOT_QUEST_CARD';
  if (a.type === 'pillage' && code === 'BR_BAD_PLACE') return s.destroyed.includes(NUM_PROV[a.province]!) ? 'PROVINCE_DESTROYED' : 'ALREADY_PILLAGED';
  if (a.type === 'pillage' && code === 'BR_NO_FIGURE') return 'NO_PRESENCE';
  if (a.type === 'clanAction' && code === 'BR_BAD_CARD') return 'CARD_NOT_OWNED';
  return base[code] ?? code;
}

// ---------- legalActions (ENGINE §9) ----------
const effectsOf = (s: BRState, seat: number, f: Figure, at: Place): ActionHint['effects'] | undefined => {
  if (f.kind !== 'monster' || isFjord(at) || at === 'ygg') return undefined;
  const others = s.figs.filter((x) => x.at === at && x.seat !== seat);
  const dead = f.mon === 'm1-troll' ? others.filter((x) => x.kind === 'warrior') : f.mon === 'm2-fire' ? others.filter((x) => x.kind !== 'monster') : [];
  return dead.length ? [{ kind: 'destroy', figures: dead.map((x) => figId(x.id)) }] : undefined;
};
const placeOfWhere = (w: Where): Place => parseWhere(w)!.at;
/** One figure per kind from the reserve (lowest id), every monster on its own; Frigga's Domain adds Valhalla. */
function invaders(s: BRState, seat: number): Figure[] {
  const from = (where: 'reserve' | 'valhalla') => {
    const mine = s.figs.filter((f) => f.seat === seat && f.at === where).sort((a, b) => a.id - b.id);
    const out: Figure[] = [];
    for (const f of mine) if (f.kind === 'monster' || !out.some((x) => x.kind === f.kind)) out.push(f);
    return out;
  };
  return [...from('reserve'), ...(has(s, seat, 'u3-domain') ? from('valhalla') : [])];
}
const presence = (s: BRState, seat: number, p: ProvinceId) => s.figs.some((f) => f.seat === seat && ([p, ...fjordsOfP(p)] as Place[]).includes(f.at as Place));
const fjordsOfP = (p: ProvinceId) => FJ.filter((f) => FJORDS[f].includes(p));
const alive = (s: BRState, p: ProvinceId) => !s.destroyed.includes(p);

export function contractHints(s: BRState, viewer: Viewer): ActionHint[] {
  if (viewer.kind !== 'player' || s.outcome) return [];
  const seat = viewer.seat;
  if (!pending(s).includes(seat) || s.clans[seat]?.resigned !== null) return [];
  const c = s.clans[seat]!;
  const kind = pendingKind(s);
  const out: ActionHint[] = [];
  const decide = (choice: unknown, extra: Record<string, unknown> = {}) => out.push({ type: 'decide', kind, choice, ...extra });
  if (kind) {
    const q = s.queue[0];
    switch (kind) {
      case 'draftPick': out.push({ type: 'draftPick', need: Math.min(s.draft.need, s.packs[seat]!.length), cards: [...s.packs[seat]!] }); break;
      case 'discardKeep': for (const i of c.hand) decide(i); break;
      case 'battleCard': for (const i of c.hand) decide({ card: i }); break;
      case 'callToBattle': {
        const b = s.battle!;
        const can = callable(s, seat, b.at);
        decide('pass');
        if (can.length >= 2) decide('passAll');
        for (const f of can) decide({ figure: figId(f.id) }, { targets: targetsOf(s, [b.at]) });
        break;
      }
      case 'freeInvade': {
        const f = s.figs[(q as { fig: number }).fig]!;
        decide(null);
        for (const to of targetsOf(s, invadeTargets(s, f))) { const fx = effectsOf(s, seat, f, placeOfWhere(to)); decide({ to }, { figure: figId(f.id), cost: { rage: 0 }, ...(fx ? { effects: fx } : {}) }); }
        break;
      }
      case 'extraWarrior': case 'loserInvade': {
        decide(null);
        for (const to of targetsOf(s, [(q as { at: ProvinceId }).at])) decide({ to });
        break;
      }
      case 'instantPillage': decide(true, { cost: { rage: 2 } }); decide(false); break;
      case 'raiseStat':
        for (const st of STATS) decide(STAT_OUT[st], c.steps[st] >= LAST_STEP ? { disabled: true, reason: 'STAT_MAX' } : {});
        break;
      case 'moveLeader': {
        const from = s.figs[(q as { fig: number }).fig]!.at as ProvinceId;
        decide(null);
        for (const p of NUM_PROV) if (alive(s, p) && adjacent(from, p) && freeSlots(s, p).length + (p === 'ygg' ? 1 : 0) > 0) decide(PROV_NUM[p]);
        break;
      }
      case 'keepCards': decide([], { cards: (q as { cards: number[] }).cards, max: c.rage, cost: { rage: 1 } }); break;
      case 'saveFigure': decide([], { figures: (q as { figs: number[] }).figs.map(figId), max: c.rage, cost: { rage: 1 } }); break;
      case 'keepOneFigure': for (const id of (q as { figs: number[] }).figs) decide(figId(id)); break;
      case 'afterReveal': decide(null); decide({ card: (q as { card: number }).card }); break;
    }
    return out;
  }
  if (s.step !== 'action' || s.battle) return out;
  if (c.rage > 0) {
    if (canBoard(s, seat)) for (const f of invaders(s, seat)) {
      const cost = invadeCost(s, seat, f, f.at === 'valhalla');
      if (cost > c.rage) continue;
      for (const to of targetsOf(s, invadeTargets(s, f))) {
        const fx = effectsOf(s, seat, f, placeOfWhere(to));
        out.push({ type: 'invade', figure: figId(f.id), to, cost: { rage: cost }, ...(fx ? { effects: fx } : {}) });
      }
    }
    for (const from of NUM_PROV) {
      if (!alive(s, from)) continue;
      const movable = s.figs.filter((f) => f.seat === seat && f.at === from && !shipLike(f)).sort((a, b) => a.id - b.id);
      if (!movable.length) continue;
      for (const to of NUM_PROV) {
        if (to === from || !alive(s, to)) continue;
        const max = to === 'ygg' ? movable.length : freeSlots(s, to).length;
        if (max <= 0) continue;
        out.push({ type: 'march', from: PROV_NUM[from], to: PROV_NUM[to], figures: movable.slice(0, max).map((f) => figId(f.id)), maxFigures: max, cost: { rage: 1 } });
      }
    }
    for (const i of c.hand) {
      const d = CARD_BY_ID[s.inst[i]!]!;
      if (!isUpgrade(d.kind)) continue;
      const cost = upgradeCost(s, seat, d.cost!);
      const full = (d.kind === 'monster' && c.monsters.every((m) => m !== null)) || (d.kind === 'clan' && c.clans.every((m) => m !== null));
      out.push({ type: 'upgrade', card: i, slot: d.kind, cost: { rage: cost }, ...(full ? { replace: true } : {}), ...(cost > c.rage ? { disabled: true, reason: 'NO_RAGE' } : {}) });
    }
    const quests = c.hand.filter((i) => CARD_BY_ID[s.inst[i]!]!.kind === 'quest');
    if (quests.length) for (const i of quests) out.push({ type: 'quest', card: i, cost: { rage: 0 } });
    else out.push({ type: 'quest', disabled: true, reason: 'NOT_QUEST_CARD' });
    for (const p of NUM_PROV) if (alive(s, p) && !s.pillaged.includes(p) && presence(s, seat, p)) out.push({ type: 'pillage', province: PROV_NUM[p], cost: { rage: 0 } });
    for (const i of c.clans) {
      if (i === null) continue;
      if (s.inst[i] === 'u2-challenge' && c.rage >= 2) for (const p of NUM_PROV) if (alive(s, p) && s.pillaged.includes(p) && presence(s, seat, p)) out.push({ type: 'clanAction', card: i, target: PROV_NUM[p], cost: { rage: 2 } });
      if (s.inst[i] === 'u3-sacrifice' && s.figs.filter((f) => f.seat === seat && f.at !== 'reserve' && f.at !== 'valhalla' && f.at !== 'box').length >= 2) out.push({ type: 'clanAction', card: i, cost: { rage: 0 } });
    }
  }
  out.push({ type: 'pass' });
  return out;
}

// ---------- view (ENGINE §9 project) ----------
export type Phase = 'draft' | 'action' | 'discard' | 'quest' | 'ragnarok' | 'valhalla' | 'ended';
const PHASE: Record<Step, Phase> = { draft: 'draft', action: 'action', discard: 'discard', quest: 'quest', ragnarok: 'ragnarok', release: 'valhalla', endage: 'valhalla', over: 'ended' };
export interface FigureView { id: string; seat: number; kind: FigureKind; monster: number | null; def: string | null; where: Where; str: number }
export interface SeatView {
  seat: number; clan: number; steps: Record<StatKey, number>; values: Record<StatKey, number>; rage: number; glory: number;
  passed: boolean; resigned: boolean; handCount: number; questCount: number; onMap: number; horns: number; reserve: number; valhalla: number;
  upgrades: { leader: number | null; warrior: number | null; ship: number | null; monster: (number | null)[]; clan: (number | null)[] };
}
export interface BattleView {
  province: number; attacker: number; step: 'call' | 'cards' | 'reveal' | 'resolve'; caller: number | null; waiting: number[]; out: number[];
  parts: number[]; played: Record<number, number | 'hidden' | null>; revealed: boolean; dead: string[]; winner: number | null; totals: Record<number, number>;
}
export interface BattleRecordView { age: number; province: number; attacker: number; lines: { seat: number; str: number; cards: number[]; figures: string[] }[]; winner: number | null; pillaged: boolean }
export interface FinalLine { seat: number; place: number; glory: number; legend: Record<StatKey, number>; cards: number; total: number }
export interface BloodRageView {
  players: number; age: number; phase: Phase; first: number; turn: number | null;
  seats: SeatView[]; figures: FigureView[];
  pillage: Record<number, { reward: Reward; pillaged: boolean; by?: number }>; destroyed: number[]; ragnarok: number[]; doom: number | null;
  draft: { need: number; picked: boolean[]; round: number } | null; discarded: boolean[];
  me: { seat: number; hand: number[]; quests: number[]; pack: number[] } | null;
  /** Engine card id of every card number the viewer may see (content.json gives the art and texts). */
  defs: Record<number, string>;
  battle: BattleView | null;
  pending: { kind: PendingKind; seats: number[]; figure?: string; province?: number; cards?: number[]; figures?: string[]; card?: number } | null;
  discardPublic: number[]; battles: BattleRecordView[]; log: LogEntry[]; seq: number; outcome: BRState['outcome']; final: FinalLine[] | null; tutorial: boolean;
}

export function figureStr(s: BRState, f: Figure): number {
  if (f.kind === 'leader') return 3;
  if (f.kind === 'ship') return 2;
  if (f.kind === 'warrior') return has(s, f.seat, 'w2-experts') || has(s, f.seat, 'w3-masters') ? 2 : 1;
  if (f.mon === 'm2-elf') return f.at === 'ygg' ? 3 : 1;
  return CARD_BY_ID[f.mon!]?.mstr ?? 0;
}

export function project(s: BRState, viewer: Viewer): BloodRageView {
  const me = viewer.kind === 'player' ? viewer.seat : null;
  const slots = slotMap(s);
  const defs: Record<number, string> = {};
  const see = (ids: number[]) => { for (const i of ids) defs[i] = s.inst[i]!; return [...ids]; };
  const b = s.battle;
  const q = s.queue[0];
  const kind = pendingKind(s);
  const mine = me !== null && q?.seat === me;
  const cl = (i: number | null) => (i === null ? null : (see([i]), i));
  const view: BloodRageView = {
    players: s.players, age: s.age, phase: PHASE[s.step], first: s.first, turn: s.step === 'action' && !s.outcome ? s.turn : null,
    seats: s.clans.map((c, i) => ({
      seat: i, clan: c.clan, steps: { rage: c.steps.rage, axe: c.steps.axes, horn: c.steps.horns },
      values: { rage: TRACKS.rage[c.steps.rage]!, axe: TRACKS.axes[c.steps.axes]!, horn: TRACKS.horns[c.steps.horns]! },
      rage: c.rage, glory: c.glory, passed: c.passed, resigned: c.resigned !== null, handCount: c.hand.length, questCount: c.quests.length,
      onMap: boardCount(s, i), horns: hornsOf(s, i),
      reserve: s.figs.filter((f) => f.seat === i && f.at === 'reserve').length, valhalla: s.figs.filter((f) => f.seat === i && f.at === 'valhalla').length,
      upgrades: { leader: cl(c.leader), warrior: cl(c.warrior), ship: cl(c.ship), monster: c.monsters.map(cl), clan: c.clans.map(cl) }
    })),
    figures: s.figs.filter((f) => f.at !== 'box').map((f) => ({
      id: figId(f.id), seat: f.seat, kind: f.kind, monster: f.card ?? null, def: f.mon, where: whereOf(f, slots), str: figureStr(s, f)
    })),
    pillage: Object.fromEntries(NUM_PROV.map((p, i) => [i, {
      reward: REWARD_OUT[s.rewards[p]], pillaged: s.pillaged.includes(p), ...(s.pillagedBy?.[p] !== undefined ? { by: s.pillagedBy[p] } : {})
    }])),
    destroyed: s.destroyed.map((p) => PROV_NUM[p]), ragnarok: s.ragnarok.map((p) => PROV_NUM[p]),
    doom: s.step === 'over' ? null : s.ragnarok[s.age - 1] === undefined ? null : PROV_NUM[s.ragnarok[s.age - 1]!],
    draft: s.step === 'draft' ? { need: s.draft.need, picked: [...s.draft.picked], round: s.draft.round } : null,
    discarded: [...s.discarded],
    me: me === null || !s.clans[me] ? null : {
      seat: me, hand: see(s.clans[me]!.hand), quests: see(s.clans[me]!.quests),
      pack: s.step === 'draft' && !s.draft.picked[me] ? see(s.packs[me] ?? []) : []
    },
    defs,
    battle: !b ? null : {
      province: PROV_NUM[b.at], attacker: b.seat,
      step: b.stage === 'call' ? 'call' : b.stage === 'cards' ? 'cards' : b.stage === 'reveal' || b.stage === 'tide' || b.stage === 'late' ? 'reveal' : 'resolve',
      caller: b.stage === 'call' ? b.call.order[b.call.idx] ?? null : null,
      waiting: b.stage === 'cards' ? pending(s) : [], out: [...(b.call.out ?? [])], parts: [...b.parts],
      played: Object.fromEntries(Object.entries(b.chosen).map(([k, v]) => [Number(k), v === null ? null : b.revealed || Number(k) === me ? (see([v]), v) : 'hidden'])),
      revealed: b.revealed, dead: b.dead.map(figId), winner: b.winner, totals: { ...b.totals }
    },
    pending: !kind ? null : {
      kind, seats: pending(s),
      ...(q && 'fig' in q ? { figure: figId(q.fig) } : {}), ...(q && 'at' in q ? { province: PROV_NUM[q.at] } : {}),
      ...(q && 'figs' in q ? { figures: q.figs.map(figId) } : {}),
      ...(q && 'cards' in q && mine ? { cards: see(q.cards) } : {}), ...(q && 'card' in q && mine ? { card: (see([q.card]), q.card) } : {})
    },
    discardPublic: see(s.discardPublic ?? []),
    battles: (s.battles ?? []).map((r) => ({ ...r, province: PROV_NUM[r.province], lines: r.lines.map((l) => ({ ...l, cards: see(l.cards), figures: l.figures.map(figId) })) })),
    log: s.log.slice(-40), seq: s.seq, outcome: s.outcome, tutorial: s.tutorial,
    final: !s.outcome ? null : s.clans.map((c, i) => {
      const legend = Object.fromEntries(STATS.map((st) => [STAT_OUT[st], c.steps[st] === LAST_STEP ? 20 : c.steps[st] >= 3 ? 10 : 0])) as Record<StatKey, number>;
      const total = finalScore(s, i);
      return { seat: i, place: s.outcome!.placements.find((x) => x.seat === i)?.place ?? s.players, glory: c.glory, legend, cards: total - c.glory - legend.rage - legend.axe - legend.horn, total };
    })
  };
  return view;
}

export function publicSummary(s: BRState): PublicSummary { return coreSummary(s); }

// ---------- tutorial (contract actions) ----------
const N = (d: string) => CONTENT_CARDS.find((x) => x.def === d)!.num;

export const bloodRageModule: GameModule<BRState, BloodRageAction, BloodRageView> = {
  manifest: def.manifest,
  actionSchema: bloodRageAction,
  setup: bloodRageCore.setup,
  validate(state, actor: Actor, action): Validation {
    if (actor.kind !== 'player') return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (action.type !== 'resign' && !pending(state).includes(actor.seat)) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const t = toInternal(state, actor.seat, action);
    if (!t.ok) return t;
    const r = bloodRageCore.validate(state, actor, t.action);
    return r.ok ? r : { ok: false, errorCode: refine(state, action, r.errorCode) };
  },
  apply(state, actor, action, ctx) {
    const t = toInternal(state, (actor as { seat: number }).seat, action);
    if (!t.ok) throw new Error(t.errorCode);
    const r = bloodRageCore.apply(state, actor, t.action, ctx);
    return { ...r, internalEvents: [{ type: action.type, seat: (actor as { seat: number }).seat }] };
  },
  project,
  legalActions: contractHints,
  outcome: (s) => s.outcome,
  onTimeout: bloodRageCore.onTimeout,
  pendingSeats: pending,
  publicSummary,
  tutorial: {
    seed: 7,
    options: { tutorial: true },
    introFa: 'آموزش: عصر سوم را با ۴ خشم و چند مهره روی نقشه شروع می‌کنید (حریف ۲ خشم دارد). با ارتقا، یورش، مأموریت، لشکرکشی و یک غارت واقعی افتخار جمع کنید؛ پایان عصر راگناروک است و بیشترین افتخار برنده می‌شود.',
    steps: [
      { instructionFa: 'ارتقا: «بازی هیولا» را بزنید و کارت «سرباز هِل» را انتخاب کنید؛ هزینه‌اش ۰ خشم است و هیولا را رایگان وارد نقشه می‌کنید. بعد «ثبت».', expected: { type: 'upgrade', card: N('m3-hel'), slot: 'monster' }, reply: null },
      { instructionFa: 'یورش رایگان: روستای خالی هورگر را روی نقشه بزنید و «ثبت».', expected: { type: 'decide', kind: 'freeInvade', choice: { to: 'village:18' } }, reply: { type: 'invade', figure: 'f12', to: 'village:22' } },
      { instructionFa: 'مأموریت: «بازی مأموریت» را بزنید، کارت «مانهایم!» را انتخاب کنید و «ثبت». اگر پایان عصر در یک استان مانهایم بیشترین قدرت را داشته باشید، افتخار می‌گیرید.', expected: { type: 'quest', card: N('q3-man') }, reply: { type: 'pass' } },
      { instructionFa: 'لشکرکشی: «لشکرکشی» را بزنید، میرکولور را مبدأ و گیمله را مقصد کنید (سردار و جنگجو با هم می‌روند) و «ثبت». ۱ خشم هزینه دارد.', expected: { type: 'march', from: 1, to: 8, figures: ['f0', 'f1'] }, reply: null },
      { instructionFa: 'غارت: «غارت» را بزنید، گیمله را انتخاب کنید و «ثبت». حریف آنجاست، پس نبرد می‌شود.', expected: { type: 'pillage', province: 8 }, reply: null },
      { instructionFa: 'نبرد: کارت «Tyr\'s Rage» (+۶) را انتخاب کنید و «بازی کارت». حریف هم هم‌زمان کارتش را می‌گذارد.', expected: { type: 'decide', kind: 'battleCard', choice: { card: N('b3-rage') } }, reply: { type: 'decide', kind: 'battleCard', choice: { card: N('b3-tsmite') } } },
      { instructionFa: 'بردید: افتخار تبر و پاداش غارت را گرفتید. حالا «کنار کشیدن» را بزنید تا خشم باقی رها شود و عصر تمام شود.', expected: { type: 'pass' }, reply: null },
      { instructionFa: 'مأموریت انجام شد! یک ویژگی را یک پله بالا ببرید (مثلاً خشم).', expected: { type: 'decide', kind: 'raiseStat', choice: 'rage' }, reply: null }
    ],
    completedFa: 'آموزش تمام شد: با ارتقا، یورش، لشکرکشی، مأموریت و غارت پیروز شدید. در بازی کامل سه عصر بازی می‌کنید و هر عصر با درفت کارت شروع می‌شود.'
  }
};
