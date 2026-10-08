// Machi Koro («شهر تاس»), base game, 2–4 players. Everyone starts with a Wheat Field, a Bakery and 3 coins. A turn:
// roll one die (two once you own the Train Station); with the Radio Tower you may reroll once; then income resolves —
// red (restaurants) take from the roller first, then blue (everyone's) and green (roller's own) pay from the bank,
// then purple (roller's) — TV Station: take 5 from a chosen player; Business Center: swap a non-major establishment.
// Then build one establishment (all base cards are on display, 6 of each; majors limited to one each) or a landmark,
// or nothing. Doubles with the Amusement Park give another turn. The first to build all four landmarks wins.
// Shopping Mall: +1 for cup (Café, Family Restaurant) and bread (Bakery, Convenience Store) cards. Perfect information.
import { z } from 'zod';
import type { Actor, ActionHint, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { machiKoro } from './definition.ts';

export type CardKey = 'wheat' | 'ranch' | 'bakery' | 'cafe' | 'store' | 'forest' | 'stadium' | 'tv' | 'business' | 'cheese' | 'furniture' | 'mine' | 'restaurant' | 'orchard' | 'market';
export type Landmark = 'station' | 'mall' | 'park' | 'radio';
export interface CardDef { key: CardKey; color: 'blue' | 'green' | 'red' | 'purple'; rolls: number[]; cost: number; icon: 'grain' | 'cow' | 'bread' | 'cup' | 'gear' | 'tower' | 'factory' | 'fruit' }
export const CARD_DEFS: CardDef[] = [
  { key: 'wheat', color: 'blue', rolls: [1], cost: 1, icon: 'grain' },
  { key: 'ranch', color: 'blue', rolls: [2], cost: 1, icon: 'cow' },
  { key: 'bakery', color: 'green', rolls: [2, 3], cost: 1, icon: 'bread' },
  { key: 'cafe', color: 'red', rolls: [3], cost: 2, icon: 'cup' },
  { key: 'store', color: 'green', rolls: [4], cost: 2, icon: 'bread' },
  { key: 'forest', color: 'blue', rolls: [5], cost: 3, icon: 'gear' },
  { key: 'stadium', color: 'purple', rolls: [6], cost: 6, icon: 'tower' },
  { key: 'tv', color: 'purple', rolls: [6], cost: 7, icon: 'tower' },
  { key: 'business', color: 'purple', rolls: [6], cost: 8, icon: 'tower' },
  { key: 'cheese', color: 'green', rolls: [7], cost: 5, icon: 'factory' },
  { key: 'furniture', color: 'green', rolls: [8], cost: 3, icon: 'factory' },
  { key: 'mine', color: 'blue', rolls: [9], cost: 6, icon: 'gear' },
  { key: 'restaurant', color: 'red', rolls: [9, 10], cost: 3, icon: 'cup' },
  { key: 'orchard', color: 'blue', rolls: [10], cost: 3, icon: 'grain' },
  { key: 'market', color: 'green', rolls: [11, 12], cost: 2, icon: 'fruit' }
];
export const DEF = Object.fromEntries(CARD_DEFS.map((d) => [d.key, d])) as Record<CardKey, CardDef>;
export const LANDMARKS: { key: Landmark; cost: number }[] = [{ key: 'station', cost: 4 }, { key: 'mall', cost: 10 }, { key: 'park', cost: 16 }, { key: 'radio', cost: 22 }];

export interface MachiState {
  players: number;
  cards: Record<CardKey, number>[];
  landmarks: Record<Landmark, boolean>[];
  coins: number[];
  supply: Record<CardKey, number>;
  current: number;
  phase: 'roll' | 'reroll' | 'tv' | 'swap' | 'build';
  dice: number[];
  rerolled: boolean;
  /** Purple choices still owed after the current one. */
  pending: ('tv' | 'swap')[];
  income: number[];
  last: { seat: number; kind: string; dice?: number[]; card?: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type MachiView = Omit<MachiState, 'timeouts'>;

const cardKey = z.enum(CARD_DEFS.map((d) => d.key) as [CardKey, ...CardKey[]]);
const landmark = z.enum(['station', 'mall', 'park', 'radio']);
export const machiAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll'), dice: z.union([z.literal(1), z.literal(2)]) }),
  z.strictObject({ type: z.literal('keep') }),
  z.strictObject({ type: z.literal('tv'), target: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('swap'), give: cardKey, target: z.number().int().min(0).max(3), take: cardKey }),
  z.strictObject({ type: z.literal('noSwap') }),
  z.strictObject({ type: z.literal('build'), card: cardKey.optional(), landmark: landmark.optional() }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type MachiAction = z.infer<typeof machiAction>;

const empty = (): Record<CardKey, number> => Object.fromEntries(CARD_DEFS.map((d) => [d.key, 0])) as Record<CardKey, number>;
const majors = new Set<CardKey>(['stadium', 'tv', 'business']);
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);
const built = (s: MachiState, k: number) => LANDMARKS.filter((l) => s.landmarks[k]![l.key]).length;

// ---------- module ----------

type Events = Transition<MachiState>['internalEvents'];
const finish = (s: MachiState, events: Events): Transition<MachiState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: MachiState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, l: built(s, seat), c: s.coins[seat]! })).sort((a, b) => b.l - a.l || b.c - a.c);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.l === x.l && q.c === x.c ? out[i - 1]!.place : i + 1, score: x.l }); });
  return out;
}

function pay(s: MachiState, from: number, to: number, n: number) {
  const x = Math.min(n, s.coins[from]!);
  s.coins[from]! -= x; s.coins[to]! += x;
  s.income[to]! += x; s.income[from]! -= x;
}

/** Resolves red, blue and green income, and purple Stadium; returns the purple choices still owed. */
function resolve(s: MachiState): ('tv' | 'swap')[] {
  const roll = sum(s.dice);
  const r = s.current;
  const n = s.players;
  s.income = s.coins.map(() => 0);
  const mall = (k: number, d: CardDef) => (s.landmarks[k]!.mall && (d.icon === 'cup' || d.icon === 'bread') ? 1 : 0);
  // Red: counter-clockwise from the roller.
  for (let i = 1; i < n; i++) {
    const k = (r - i + n) % n;
    for (const d of CARD_DEFS) if (d.color === 'red' && d.rolls.includes(roll) && s.cards[k]![d.key]) pay(s, r, k, s.cards[k]![d.key] * ((d.key === 'cafe' ? 1 : 2) + mall(k, d)));
  }
  const gain = (k: number, x: number) => { s.coins[k]! += x; s.income[k]! += x; };
  for (let k = 0; k < n; k++) for (const d of CARD_DEFS) {
    const c = s.cards[k]![d.key];
    if (!c || !d.rolls.includes(roll)) continue;
    if (d.color === 'blue') gain(k, c * ({ wheat: 1, ranch: 1, forest: 1, mine: 5, orchard: 3 } as Record<string, number>)[d.key]!);
    if (d.color === 'green' && k === r) {
      const per = d.key === 'bakery' ? 1 + mall(k, d) : d.key === 'store' ? 3 + mall(k, d)
        : d.key === 'cheese' ? 3 * s.cards[k]!.ranch : d.key === 'furniture' ? 3 * (s.cards[k]!.forest + s.cards[k]!.mine) : 2 * (s.cards[k]!.wheat + s.cards[k]!.orchard);
      gain(k, c * per);
    }
  }
  const owed: ('tv' | 'swap')[] = [];
  if (roll === 6) {
    if (s.cards[r]!.stadium) for (let k = 0; k < n; k++) if (k !== r) pay(s, k, r, 2);
    if (s.cards[r]!.tv) owed.push('tv');
    if (s.cards[r]!.business) owed.push('swap');
  }
  return owed;
}

function afterRoll(s: MachiState) {
  const owed = resolve(s);
  s.phase = owed[0] ?? 'build';
  s.pending = owed.slice(1);
}

function nextPhase(s: MachiState) { s.phase = s.pending.shift() ?? 'build'; }

function endTurn(s: MachiState) {
  if (LANDMARKS.every((l) => s.landmarks[s.current]![l.key])) { s.outcome = { placements: rank(s, s.coins.map((_, k) => k)), reason: 'win' }; return; }
  const doubles = s.dice.length === 2 && s.dice[0] === s.dice[1] && s.landmarks[s.current]!.park;
  if (!doubles) s.current = (s.current + 1) % s.players;
  s.phase = 'roll'; s.dice = []; s.rerolled = false;
}

export const machiModule: GameModule<MachiState, MachiAction, MachiView> = {
  manifest: machiKoro.manifest,
  actionSchema: machiAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('machi koro needs 2–4 players');
    const s: MachiState = {
      players: playerCount, cards: Array.from({ length: playerCount }, () => ({ ...empty(), wheat: 1, bakery: 1 })),
      landmarks: Array.from({ length: playerCount }, () => ({ station: false, mall: false, park: false, radio: false })), coins: Array(playerCount).fill(3),
      supply: Object.fromEntries(CARD_DEFS.map((d) => [d.key, majors.has(d.key) ? playerCount : 6])) as Record<CardKey, number>,
      current: rng.nextInt(playerCount), phase: 'roll', dice: [], rerolled: false, income: Array(playerCount).fill(0), last: null, seq: 0,
      timeouts: Array(playerCount).fill(0), outcome: null, pending: []
    };
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.landmarks[0] = { station: true, mall: true, park: true, radio: false };
      s.coins = [22, 5];
      s.cards[0] = { ...s.cards[0]!, ranch: 1, cheese: 1, forest: 1 };
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'roll':
        if (s.phase !== 'roll' && !(s.phase === 'reroll')) return { ok: false, errorCode: 'NOT_NOW' };
        return a.dice === 2 && !s.landmarks[seat]!.station ? { ok: false, errorCode: 'NEED_STATION' } : { ok: true };
      case 'keep': return s.phase === 'reroll' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'tv': return s.phase === 'tv' && a.target !== seat && a.target < s.players ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'noSwap': return s.phase === 'swap' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'swap':
        if (s.phase !== 'swap' || a.target === seat || a.target >= s.players) return { ok: false, errorCode: 'NOT_NOW' };
        if (majors.has(a.give) || majors.has(a.take)) return { ok: false, errorCode: 'NO_MAJORS' };
        return s.cards[seat]![a.give] > 0 && s.cards[a.target]![a.take] > 0 ? { ok: true } : { ok: false, errorCode: 'NOT_OWNED' };
      case 'pass': return s.phase === 'build' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'build': {
        if (s.phase !== 'build') return { ok: false, errorCode: 'ROLL_FIRST' };
        if ((a.card === undefined) === (a.landmark === undefined)) return { ok: false, errorCode: 'CARD_OR_LANDMARK' };
        if (a.landmark) { const l = LANDMARKS.find((x) => x.key === a.landmark)!; return !s.landmarks[seat]![l.key] && s.coins[seat]! >= l.cost ? { ok: true } : { ok: false, errorCode: 'CANNOT_BUILD' }; }
        const d = DEF[a.card!];
        if (!s.supply[d.key] || s.coins[seat]! < d.cost) return { ok: false, errorCode: 'CANNOT_BUILD' };
        return majors.has(d.key) && s.cards[seat]![d.key] ? { ok: false, errorCode: 'ONE_MAJOR_EACH' } : { ok: true };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.coins.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: built(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    switch (a.type) {
      case 'roll': {
        if (s.phase === 'reroll') s.rerolled = true;
        s.dice = Array.from({ length: a.dice }, () => 1 + ctx.rng.nextInt(6));
        s.last = { seat, kind: 'roll', dice: s.dice.slice() };
        if (s.landmarks[seat]!.radio && !s.rerolled) s.phase = 'reroll';
        else afterRoll(s);
        break;
      }
      case 'keep': s.rerolled = true; afterRoll(s); break;
      case 'tv': { const before = s.coins[seat]!; pay(s, a.target, seat, 5); s.last = { seat, kind: 'tv', card: String(s.coins[seat]! - before) }; nextPhase(s); break; }
      case 'swap': s.cards[seat]![a.give] -= 1; s.cards[a.target]![a.give] += 1; s.cards[a.target]![a.take] -= 1; s.cards[seat]![a.take] += 1; s.last = { seat, kind: 'swap' }; nextPhase(s); break;
      case 'noSwap': nextPhase(s); break;
      case 'build':
        if (a.landmark) { s.coins[seat]! -= LANDMARKS.find((x) => x.key === a.landmark)!.cost; s.landmarks[seat]![a.landmark] = true; s.last = { seat, kind: 'landmark', card: a.landmark }; }
        else { const d = DEF[a.card!]; s.coins[seat]! -= d.cost; s.supply[d.key] -= 1; s.cards[seat]![d.key] += 1; s.last = { seat, kind: 'build', card: d.key }; }
        endTurn(s);
        break;
      case 'pass': s.last = { seat, kind: 'pass' }; endTurn(s); break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { timeouts: _t, ...rest } = structuredClone(s);
    return rest;
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      if (s.phase === 'roll' || s.phase === 'reroll') { out.push({ type: 'roll', dice: 1 }); if (s.landmarks[seat]!.station) out.push({ type: 'roll', dice: 2 }); }
      if (s.phase === 'reroll') out.push({ type: 'keep' });
      if (s.phase === 'tv') out.push({ type: 'tv' });
      if (s.phase === 'swap') { out.push({ type: 'swap' }); out.push({ type: 'noSwap' }); }
      if (s.phase === 'build') {
        for (const d of CARD_DEFS) if (s.supply[d.key] && s.coins[seat]! >= d.cost && !(majors.has(d.key) && s.cards[seat]![d.key])) out.push({ type: 'build', card: d.key });
        for (const l of LANDMARKS) if (!s.landmarks[seat]![l.key] && s.coins[seat]! >= l.cost) out.push({ type: 'build', landmark: l.key });
        out.push({ type: 'pass' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: MachiAction) => machiModule.apply(s, { kind: 'player', seat }, a, ctx);
    if (s.phase === 'roll') run({ type: 'roll', dice: 1 });
    if (s.phase === 'reroll') run({ type: 'keep' });
    while (!s.outcome && (s.phase === 'tv' || s.phase === 'swap') && s.current === seat) run(s.phase === 'tv' ? { type: 'tv', target: (seat + 1) % s.players } : { type: 'noSwap' });
    const t = !s.outcome && s.phase === 'build' && s.current === seat ? run({ type: 'pass' }) : finish(s, []);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 61,
    options: { deal: 'tutorial' },
    introFa: 'سه بنای بزرگ را ساخته‌اید و ۲۲ سکه دارید؛ برج رادیو آخرین بناست. اول تاس بریزید.',
    steps: [
      { instructionFa: 'یک تاس بریزید: مزرعه و نانوایی و دامداری‌تان درآمد می‌دهند.', expected: { type: 'roll', dice: 1 }, reply: null },
      { instructionFa: 'حالا برج رادیو را بسازید تا شهرتان کامل شود.', expected: { type: 'build', landmark: 'radio' }, reply: null }
    ],
    completedFa: 'بردید! هر چهار بنای بزرگ ساخته شد.'
  }
};
