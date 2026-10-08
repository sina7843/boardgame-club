// Jaipur («کاروان»), two players. 55 cards: diamond 6, gold 6, silver 6, cloth 8, spice 8, leather 10, camel 11.
// Market of five (three camels + two cards at the start of a round); hands of five, camels go straight to the herd.
// A turn: take one good (hand limit 7), take all camels, exchange two or more market goods for the same number of
// hand goods and/or herd camels (never a type you take; no camels taken), or sell cards of one type (diamond, gold
// and silver need two or more) taking the top goods tokens plus a hidden bonus token for 3/4/5+ cards.
// The round ends when three goods token piles are empty or the market cannot be refilled. Most camels +5. Round:
// most rupees, then more bonus tokens, then more goods tokens. Two seals win (option: one round). The round's loser
// starts the next. Hidden: hands, deck, bonus token values (owners see their own).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { jaipur } from './definition.ts';

export const GOODS = ['diamond', 'gold', 'silver', 'cloth', 'spice', 'leather'] as const;
export type Good = (typeof GOODS)[number];
export type Card = Good | 'camel';
const COUNT: Record<Card, number> = { diamond: 6, gold: 6, silver: 6, cloth: 8, spice: 8, leather: 10, camel: 11 };
export const TOKENS: Record<Good, number[]> = {
  diamond: [7, 7, 5, 5, 5], gold: [6, 6, 5, 5, 5], silver: [5, 5, 5, 5, 5], cloth: [5, 3, 3, 2, 2, 1, 1], spice: [5, 3, 3, 2, 2, 1, 1], leather: [4, 3, 2, 1, 1, 1, 1, 1, 1]
};
const BONUS: Record<3 | 4 | 5, number[]> = { 3: [3, 3, 2, 2, 2, 1, 1], 4: [6, 6, 5, 5, 4, 4], 5: [10, 10, 9, 8, 8] };
export const PRECIOUS = new Set<Good>(['diamond', 'gold', 'silver']);

export interface JaipurState {
  deck: Card[];
  market: Card[];
  hands: Good[][];
  herds: number[];
  tokens: Record<Good, number[]>;
  bonus: Record<3 | 4 | 5, number[]>;
  goods: number[][];
  bonuses: number[][];
  seals: number[];
  current: number;
  round: number;
  best3: boolean;
  roundResults: { winner: number | null; rupees: number[]; camelBonus: number | null }[];
  last: { seat: number; kind: 'take' | 'camels' | 'exchange' | 'sell'; cards?: Card[]; give?: Card[]; good?: Good; count?: number; earned?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface JaipurView {
  market: Card[];
  deckCount: number;
  hand: Good[] | null;
  handCount: number[];
  herds: number[];
  tokens: Record<Good, number[]>;
  bonusLeft: Record<3 | 4 | 5, number>;
  goods: number[][];
  /** Own bonus token values; others only how many. */
  bonuses: (number[] | number)[];
  seals: number[];
  current: number | null;
  round: number;
  best3: boolean;
  roundResults: JaipurState['roundResults'];
  last: JaipurState['last'];
  seq: number;
  outcome: Outcome | null;
}

const good = z.enum(GOODS);
const card = z.enum([...GOODS, 'camel']);
export const jaipurAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('take'), good }),
  z.strictObject({ type: z.literal('camels') }),
  z.strictObject({ type: z.literal('exchange'), take: z.array(good).min(2).max(5), give: z.array(card).min(2).max(5) }),
  z.strictObject({ type: z.literal('sell'), good, count: z.number().int().min(1).max(7) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type JaipurAction = z.infer<typeof jaipurAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const removeAll = <T>(from: T[], items: T[]) => { for (const x of items) { const i = from.indexOf(x); if (i < 0) return false; from.splice(i, 1); } return true; };
export const rupees = (s: Pick<JaipurState, 'goods' | 'bonuses'>, k: number) => sum(s.goods[k]!) + sum(s.bonuses[k]!);

// ---------- module ----------

type Events = Transition<JaipurState>['internalEvents'];
const finish = (s: JaipurState, events: Events): Transition<JaipurState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function newRound(s: JaipurState, rng: EngineRng, starter: number) {
  const deck = shuffle(rng, (Object.keys(COUNT) as Card[]).flatMap((c) => Array<Card>(c === 'camel' ? COUNT[c] - 3 : COUNT[c]).fill(c)));
  s.market = ['camel', 'camel', 'camel', deck.shift()!, deck.shift()!];
  s.hands = [[], []];
  s.herds = [0, 0];
  for (const k of [0, 1]) for (const c of deck.splice(0, 5)) { if (c === 'camel') s.herds[k]! += 1; else s.hands[k]!.push(c); }
  s.deck = deck;
  s.tokens = structuredClone(TOKENS);
  s.bonus = { 3: shuffle(rng, BONUS[3]), 4: shuffle(rng, BONUS[4]), 5: shuffle(rng, BONUS[5]) };
  s.goods = [[], []];
  s.bonuses = [[], []];
  s.current = starter;
}

function refill(s: JaipurState) {
  while (s.market.length < 5 && s.deck.length) s.market.push(s.deck.shift()!);
}

function roundOver(s: JaipurState) { return s.market.length < 5 || GOODS.filter((g) => !s.tokens[g].length).length >= 3; }

function endRound(s: JaipurState, rng: EngineRng) {
  const camelBonus = s.herds[0] === s.herds[1] ? null : s.herds[0]! > s.herds[1]! ? 0 : 1;
  const r = [0, 1].map((k) => rupees(s, k) + (camelBonus === k ? 5 : 0));
  const key = (k: number) => [r[k]!, s.bonuses[k]!.length, s.goods[k]!.length];
  const cmp = key(0).map((v, i) => v - key(1)[i]!).find((d) => d !== 0) ?? 0;
  const winner = cmp > 0 ? 0 : cmp < 0 ? 1 : null;
  s.roundResults.push({ winner, rupees: r, camelBonus });
  if (winner !== null) s.seals[winner]! += 1;
  const done = s.best3 ? s.seals.some((x) => x >= 2) || s.round >= 3 : true;
  if (done) {
    const [a, b] = s.seals as [number, number];
    s.outcome = a === b ? { placements: [{ seat: 0, place: 1, score: a }, { seat: 1, place: 1, score: b }], reason: 'draw' }
      : { placements: [{ seat: a > b ? 0 : 1, place: 1, score: Math.max(a, b) }, { seat: a > b ? 1 : 0, place: 2, score: Math.min(a, b) }], reason: 'score' };
    return;
  }
  s.round += 1;
  newRound(s, rng, winner === null ? 1 - s.current : 1 - winner);
}

export const jaipurModule: GameModule<JaipurState, JaipurAction, JaipurView> = {
  manifest: jaipur.manifest,
  actionSchema: jaipurAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('jaipur is a two-player game');
    const s = { seals: [0, 0], round: 1, best3: options.length !== 'one' && options.deal !== 'tutorial', roundResults: [], last: null, seq: 0, timeouts: [0, 0], outcome: null } as unknown as JaipurState;
    newRound(s, rng, rng.nextInt(2));
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.tokens.diamond = []; s.tokens.gold = []; s.tokens.silver = [5, 5];
      s.goods = [[7, 7, 6, 6, 5], [5, 5, 5, 6, 6, 5]];
      s.bonuses = [[2], [1]];
      s.hands = [['silver', 'cloth', 'spice'], ['leather', 'leather', 'cloth', 'spice']];
      s.herds = [3, 1];
      s.market = ['silver', 'camel', 'leather', 'cloth', 'spice'];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const hand = s.hands[seat]!;
    switch (a.type) {
      case 'take':
        if (!s.market.includes(a.good)) return { ok: false, errorCode: 'NOT_IN_MARKET' };
        return hand.length < 7 ? { ok: true } : { ok: false, errorCode: 'HAND_FULL' };
      case 'camels':
        return s.market.includes('camel') ? { ok: true } : { ok: false, errorCode: 'NO_CAMELS' };
      case 'exchange': {
        if (a.take.length !== a.give.length) return { ok: false, errorCode: 'SAME_COUNT' };
        if (a.give.some((c) => c !== 'camel' && a.take.includes(c))) return { ok: false, errorCode: 'SAME_TYPE' };
        if (!removeAll(s.market.slice(), a.take)) return { ok: false, errorCode: 'NOT_IN_MARKET' };
        const camels = a.give.filter((c) => c === 'camel').length;
        if (camels > s.herds[seat]!) return { ok: false, errorCode: 'NO_CAMELS' };
        if (!removeAll(hand.slice(), a.give.filter((c) => c !== 'camel') as Good[])) return { ok: false, errorCode: 'NOT_IN_HAND' };
        return hand.length + camels <= 7 ? { ok: true } : { ok: false, errorCode: 'HAND_FULL' };
      }
      case 'sell': {
        if (hand.filter((c) => c === a.good).length < a.count) return { ok: false, errorCode: 'NOT_IN_HAND' };
        return PRECIOUS.has(a.good) && a.count < 2 ? { ok: false, errorCode: 'SELL_TWO' } : { ok: true };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [{ seat: 1 - seat, place: 1, score: s.seals[1 - seat]! }, { seat, place: 2, score: s.seals[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const hand = s.hands[seat]!;
    switch (a.type) {
      case 'take': s.market.splice(s.market.indexOf(a.good), 1); hand.push(a.good); s.last = { seat, kind: 'take', cards: [a.good] }; break;
      case 'camels': {
        const n = s.market.filter((c) => c === 'camel').length;
        s.market = s.market.filter((c) => c !== 'camel');
        s.herds[seat]! += n;
        s.last = { seat, kind: 'camels', count: n };
        break;
      }
      case 'exchange': {
        removeAll(s.market, a.take);
        const camels = a.give.filter((c) => c === 'camel').length;
        s.herds[seat]! -= camels;
        removeAll(hand, a.give.filter((c) => c !== 'camel') as Good[]);
        hand.push(...a.take);
        s.market.push(...a.give);
        s.last = { seat, kind: 'exchange', cards: a.take, give: a.give };
        break;
      }
      case 'sell': {
        for (let i = 0; i < a.count; i++) hand.splice(hand.indexOf(a.good), 1);
        const earned = s.tokens[a.good].splice(0, a.count);
        s.goods[seat]!.push(...earned);
        const tier = Math.min(5, a.count) as 3 | 4 | 5;
        let b = 0;
        if (a.count >= 3 && s.bonus[tier].length) { b = s.bonus[tier].shift()!; s.bonuses[seat]!.push(b); }
        s.last = { seat, kind: 'sell', good: a.good, count: a.count, earned: sum(earned) + b };
        break;
      }
    }
    hand.sort((x, y) => GOODS.indexOf(x) - GOODS.indexOf(y));
    refill(s);
    if (roundOver(s)) endRound(s, ctx.rng);
    else s.current = 1 - seat;
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      market: s.market.slice(), deckCount: s.deck.length, hand: me >= 0 ? s.hands[me]!.slice() : null, handCount: s.hands.map((h) => h.length),
      herds: s.herds.slice(), tokens: structuredClone(s.tokens), bonusLeft: { 3: s.bonus[3].length, 4: s.bonus[4].length, 5: s.bonus[5].length },
      goods: s.goods.map((g) => g.slice()), bonuses: s.bonuses.map((b, k) => (k === me || s.outcome ? b.slice() : b.length)),
      seals: s.seals.slice(), current: s.outcome ? null : s.current, round: s.round, best3: s.best3, roundResults: structuredClone(s.roundResults),
      last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      const hand = s.hands[seat]!;
      if (hand.length < 7) for (const g of new Set(s.market.filter((c) => c !== 'camel'))) out.push({ type: 'take', good: g });
      if (s.market.includes('camel')) out.push({ type: 'camels' });
      if (s.market.filter((c) => c !== 'camel').length >= 2 && hand.length + s.herds[seat]! >= 2) out.push({ type: 'exchange' });
      for (const g of new Set(hand)) { const n = hand.filter((c) => c === g).length; if (n >= (PRECIOUS.has(g) ? 2 : 1)) out.push({ type: 'sell', good: g, max: n, min: PRECIOUS.has(g) ? 2 : 1 }); }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    // Passive play: take the camels, else the first good, else sell the commonest cheap good.
    const hand = s.hands[seat]!;
    const g = s.market.find((c) => c !== 'camel') as Good | undefined;
    const cheap = [...GOODS].reverse().find((x) => hand.filter((c) => c === x).length >= (PRECIOUS.has(x) ? 2 : 1));
    const a: JaipurAction = s.market.includes('camel') ? { type: 'camels' } : g && hand.length < 7 ? { type: 'take', good: g } : { type: 'sell', good: cheap!, count: PRECIOUS.has(cheap!) ? 2 : 1 };
    const t = jaipurModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 35,
    options: { deal: 'tutorial' },
    introFa: 'سکه‌های الماس و طلا تمام شده و فقط دو سکهٔ نقره مانده. اگر سکه‌های سه کالا تمام شود، دست تمام است. شما یک نقره دارید و یک نقره هم در بازار است.',
    steps: [
      { instructionFa: 'نقرهٔ بازار را بردارید.', expected: { type: 'take', good: 'silver' }, reply: { type: 'take', good: 'leather' } },
      { instructionFa: 'حالا دو نقره دارید: هر دو را بفروشید تا سکه‌های نقره تمام شود.', expected: { type: 'sell', good: 'silver', count: 2 }, reply: null }
    ],
    completedFa: 'بردید! با فروش نقره سه کالا تمام شد؛ شما با سکه‌های بیشتر و جایزهٔ شترها دست را بردید.'
  }
};
