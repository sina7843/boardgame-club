// Dominion («قلمرو»), 2–4 players, base cards with the "first game" kingdom: Cellar, Market, Merchant, Militia, Mine,
// Moat, Remodel, Smithy, Village, Workshop. Start: 7 Copper + 3 Estate, draw 5. Turn: action phase (1 action), buy
// phase (play treasures, 1 buy), cleanup (discard all, draw 5, reshuffle when needed). Choices of Cellar/Mine/Remodel/
// Workshop are part of the play action. Militia makes every other player discard down to 3 (those players act in
// parallel); a Moat in hand blocks it automatically. Game ends after a turn when Provinces or any three supply piles
// are empty; most victory points win (ties share). Hidden: hands, deck order, discard piles below the top card.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { dominion } from './definition.ts';

export type CardId = 'copper' | 'silver' | 'gold' | 'estate' | 'duchy' | 'province'
  | 'cellar' | 'market' | 'merchant' | 'militia' | 'mine' | 'moat' | 'remodel' | 'smithy' | 'village' | 'workshop';
export interface CardInfo { name: string; cost: number; kind: 'treasure' | 'victory' | 'action'; coins?: number; vp?: number; text?: string; attack?: boolean; reaction?: boolean }
export const CARDS: Record<CardId, CardInfo> = {
  copper: { name: 'مس', cost: 0, kind: 'treasure', coins: 1 },
  silver: { name: 'نقره', cost: 3, kind: 'treasure', coins: 2 },
  gold: { name: 'طلا', cost: 6, kind: 'treasure', coins: 3 },
  estate: { name: 'ملک', cost: 2, kind: 'victory', vp: 1 },
  duchy: { name: 'تیول', cost: 5, kind: 'victory', vp: 3 },
  province: { name: 'ایالت', cost: 8, kind: 'victory', vp: 6 },
  cellar: { name: 'زیرزمین', cost: 2, kind: 'action', text: '+۱ کنش. هر تعداد کارت دور بریزید و همان‌قدر بکشید.' },
  moat: { name: 'خندق', cost: 2, kind: 'action', reaction: true, text: '+۲ کارت. در دست: از حمله در امان هستید.' },
  merchant: { name: 'سوداگر', cost: 3, kind: 'action', text: '+۱ کارت +۱ کنش. اولین نقرهٔ این نوبت +۱ سکه.' },
  village: { name: 'روستا', cost: 3, kind: 'action', text: '+۱ کارت +۲ کنش.' },
  workshop: { name: 'کارگاه', cost: 3, kind: 'action', text: 'کارتی تا قیمت ۴ بگیرید.' },
  militia: { name: 'سپاه محلی', cost: 4, kind: 'action', attack: true, text: '+۲ سکه. بقیه تا ۳ کارت دور می‌ریزند.' },
  remodel: { name: 'نوسازی', cost: 4, kind: 'action', text: 'کارتی از دست را نابود کنید و کارتی تا ۲ گران‌تر بگیرید.' },
  smithy: { name: 'آهنگری', cost: 4, kind: 'action', text: '+۳ کارت.' },
  market: { name: 'بازار', cost: 5, kind: 'action', text: '+۱ کارت +۱ کنش +۱ خرید +۱ سکه.' },
  mine: { name: 'معدن', cost: 5, kind: 'action', text: 'گنجی از دست را نابود کنید و گنجی تا ۳ گران‌تر به دست بگیرید.' }
};
export const CARD_IDS = Object.keys(CARDS) as CardId[];
export const KINGDOM: CardId[] = ['cellar', 'moat', 'merchant', 'village', 'workshop', 'militia', 'remodel', 'smithy', 'market', 'mine'];

export interface Player { deck: CardId[]; hand: CardId[]; discard: CardId[] }
export interface DomState {
  players: Player[];
  supply: Record<CardId, number>;
  trash: CardId[];
  inPlay: CardId[];
  current: number;
  phase: 'action' | 'buy';
  actions: number;
  buys: number;
  coins: number;
  silverBonus: number;
  militia: number[];
  turns: number[];
  last: { seat: number; kind: string; card?: CardId } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type DomView = Omit<DomState, 'players' | 'timeouts'> & {
  hand: CardId[] | null;
  others: { deck: number; hand: number; discard: number; top: CardId | null }[];
  vp: number[] | null;
};

const card = z.enum(CARD_IDS as [CardId, ...CardId[]]);
const idxs = z.array(z.number().int().min(0).max(99)).max(99);
export const domAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), index: z.number().int().min(0).max(99), discard: idxs.optional(), trash: z.number().int().min(0).max(99).optional(), gain: card.optional() }),
  z.strictObject({ type: z.literal('treasures') }),
  z.strictObject({ type: z.literal('buy'), card }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('militiaDiscard'), discard: idxs }),
  z.strictObject({ type: z.literal('resign') })
]);
export type DomAction = z.infer<typeof domAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
function draw(p: Player, n: number, rng: EngineRng) {
  for (let k = 0; k < n; k++) {
    if (!p.deck.length) { if (!p.discard.length) return; p.deck = shuffle(rng, p.discard); p.discard = []; }
    p.hand.push(p.deck.shift()!);
  }
}
const all = (p: Player) => [...p.deck, ...p.hand, ...p.discard];
export const vpOf = (cards: CardId[]) => cards.reduce((n, c) => n + (CARDS[c].vp ?? 0), 0);
const uniq = (xs: number[]) => new Set(xs).size === xs.length;
const emptyPiles = (s: DomState) => CARD_IDS.filter((c) => s.supply[c] === 0).length;

type Events = Transition<DomState>['internalEvents'];
const finish = (s: DomState, events: Events): Transition<DomState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: DomState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: vpOf(all(s.players[seat]!)) })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

/** Validates the choices carried by playing an action card. */
function checkPlay(s: DomState, seat: number, a: Extract<DomAction, { type: 'play' }>) {
  const hand = s.players[seat]!.hand;
  const c = hand[a.index];
  if (!c || CARDS[c].kind !== 'action') return 'NOT_AN_ACTION';
  const rest = hand.map((_, i) => i).filter((i) => i !== a.index);
  if (c === 'cellar') return a.discard && uniq(a.discard) && a.discard.every((i) => rest.includes(i)) ? null : 'BAD_DISCARD';
  if (c === 'workshop') return a.gain && s.supply[a.gain] > 0 && CARDS[a.gain].cost <= 4 ? null : 'BAD_GAIN';
  if (c === 'remodel' || c === 'mine') {
    if (!rest.length) return a.trash === undefined && a.gain === undefined ? null : 'BAD_TRASH';
    if (a.trash === undefined || !rest.includes(a.trash)) return 'BAD_TRASH';
    const t = hand[a.trash]!;
    if (c === 'mine' && CARDS[t].kind !== 'treasure') {
      return 'BAD_TRASH';
    }
    if (!a.gain || s.supply[a.gain] <= 0 || CARDS[a.gain].cost > CARDS[t].cost + (c === 'mine' ? 3 : 2)) return 'BAD_GAIN';
    if (c === 'mine' && CARDS[a.gain].kind !== 'treasure') return 'BAD_GAIN';
    return null;
  }
  return null;
}

function gain(s: DomState, to: CardId[], c: CardId) { if (s.supply[c] > 0) { s.supply[c] -= 1; to.push(c); } }

function play(s: DomState, seat: number, a: Extract<DomAction, { type: 'play' }>, rng: EngineRng) {
  const p = s.players[seat]!;
  const c = p.hand[a.index]!;
  const trashed = a.trash !== undefined ? p.hand[a.trash] : undefined;
  const discards = (a.discard ?? []).map((i) => p.hand[i]!);
  const removed = new Set([a.index, ...(a.trash !== undefined ? [a.trash] : []), ...(c === 'cellar' ? a.discard ?? [] : [])]);
  p.hand = p.hand.filter((_, i) => !removed.has(i));
  s.inPlay.push(c);
  s.actions -= 1;
  switch (c) {
    case 'cellar': s.actions += 1; p.discard.push(...discards); draw(p, discards.length, rng); break;
    case 'moat': draw(p, 2, rng); break;
    case 'merchant': draw(p, 1, rng); s.actions += 1; s.silverBonus += 1; break;
    case 'village': draw(p, 1, rng); s.actions += 2; break;
    case 'workshop': gain(s, p.discard, a.gain!); break;
    case 'smithy': draw(p, 3, rng); break;
    case 'market': draw(p, 1, rng); s.actions += 1; s.buys += 1; s.coins += 1; break;
    case 'remodel': if (trashed) { s.trash.push(trashed); gain(s, p.discard, a.gain!); } break;
    case 'mine': if (trashed) { s.trash.push(trashed); gain(s, p.hand, a.gain!); } break;
    case 'militia':
      s.coins += 2;
      s.militia = s.players.map((q, k) => (k !== seat && q.hand.length > 3 && !q.hand.includes('moat') ? q.hand.length - 3 : 0));
      break;
    default: break;
  }
}

function playTreasures(s: DomState, seat: number) {
  const p = s.players[seat]!;
  for (const c of p.hand.filter((x) => CARDS[x].kind === 'treasure')) {
    s.coins += CARDS[c].coins!;
    if (c === 'silver' && s.silverBonus) { s.coins += s.silverBonus; s.silverBonus = 0; }
    s.inPlay.push(c);
  }
  p.hand = p.hand.filter((x) => CARDS[x].kind !== 'treasure');
  s.phase = 'buy';
}

function cleanup(s: DomState, seat: number, rng: EngineRng) {
  const p = s.players[seat]!;
  p.discard.push(...s.inPlay, ...p.hand);
  s.inPlay = []; p.hand = [];
  draw(p, 5, rng);
  s.turns[seat]! += 1;
  if (s.supply.province === 0 || emptyPiles(s) >= 3) { s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' }; return; }
  s.current = (seat + 1) % s.players.length;
  Object.assign(s, { phase: 'action', actions: 1, buys: 1, coins: 0, silverBonus: 0 });
}

export const domModule: GameModule<DomState, DomAction, DomView> = {
  manifest: dominion.manifest,
  actionSchema: domAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('dominion needs 2–4 players');
    const v = playerCount === 2 ? 8 : 12;
    const supply = Object.fromEntries(CARD_IDS.map((c) => [c, KINGDOM.includes(c) ? 10 : 0])) as Record<CardId, number>;
    Object.assign(supply, { copper: 60 - 7 * playerCount, silver: 40, gold: 30, estate: v, duchy: v, province: v });
    const players = Array.from({ length: playerCount }, () => {
      const p: Player = { deck: shuffle(rng, [...Array<CardId>(7).fill('copper'), ...Array<CardId>(3).fill('estate')]), hand: [], discard: [] };
      draw(p, 5, rng);
      return p;
    });
    const s: DomState = {
      players, supply, trash: [], inPlay: [], current: rng.nextInt(playerCount), phase: 'action', actions: 1, buys: 1, coins: 0, silverBonus: 0,
      militia: Array(playerCount).fill(0), turns: Array(playerCount).fill(0), last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.players[0] = { hand: ['smithy', 'copper', 'copper', 'copper', 'estate'], deck: ['gold', 'silver', 'copper', 'copper', 'estate'], discard: ['copper', 'copper', 'estate'] };
      s.supply.province = 1;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players.length) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    if (a.type === 'resign') return { ok: true };
    if (a.type === 'militiaDiscard') {
      const need = s.militia[seat]!;
      if (!need) return { ok: false, errorCode: 'NOTHING_TO_DISCARD' };
      const hand = s.players[seat]!.hand;
      return a.discard.length === need && uniq(a.discard) && a.discard.every((i) => i < hand.length) ? { ok: true } : { ok: false, errorCode: 'BAD_DISCARD' };
    }
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (s.militia.some((n) => n > 0)) return { ok: false, errorCode: 'WAITING_FOR_DISCARDS' };
    switch (a.type) {
      case 'play': {
        if (s.phase !== 'action' || s.actions < 1) return { ok: false, errorCode: 'NO_ACTIONS' };
        const err = checkPlay(s, seat, a);
        return err ? { ok: false, errorCode: err } : { ok: true };
      }
      case 'treasures': return s.players[seat]!.hand.some((c) => CARDS[c].kind === 'treasure') ? { ok: true } : { ok: false, errorCode: 'NO_TREASURES' };
      case 'buy':
        if (s.buys < 1) return { ok: false, errorCode: 'NO_BUYS' };
        if (s.supply[a.card] <= 0) return { ok: false, errorCode: 'PILE_EMPTY' };
        return CARDS[a.card].cost <= s.coins ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      case 'endTurn': return { ok: true };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.players.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players.length, score: vpOf(all(s.players[seat]!)) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    switch (a.type) {
      case 'militiaDiscard': {
        const p = s.players[seat]!;
        p.discard.push(...a.discard.map((i) => p.hand[i]!));
        p.hand = p.hand.filter((_, i) => !a.discard.includes(i));
        s.militia[seat] = 0;
        break;
      }
      case 'play': s.last = { seat, kind: 'play', card: s.players[seat]!.hand[a.index]! }; play(s, seat, a, ctx.rng); break;
      case 'treasures': playTreasures(s, seat); break;
      case 'buy':
        s.phase = 'buy';
        s.coins -= CARDS[a.card].cost; s.buys -= 1;
        gain(s, s.players[seat]!.discard, a.card);
        s.last = { seat, kind: 'buy', card: a.card };
        break;
      case 'endTurn': cleanup(s, seat, ctx.rng); break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { players, timeouts: _t, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      ...rest,
      hand: players[me]?.hand ?? null,
      others: players.map((p) => ({ deck: p.deck.length, hand: p.hand.length, discard: p.discard.length, top: p.discard.at(-1) ?? null })),
      vp: s.outcome ? players.map((p) => vpOf(all(p))) : null
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.militia[seat]) out.push({ type: 'militiaDiscard', count: s.militia[seat] });
    if (s.current === seat && !s.militia.some((n) => n > 0)) {
      const hand = s.players[seat]!.hand;
      if (s.phase === 'action' && s.actions > 0) hand.forEach((c, index) => { if (CARDS[c].kind === 'action') out.push({ type: 'play', index, card: c }); });
      if (hand.some((c) => CARDS[c].kind === 'treasure')) out.push({ type: 'treasures' });
      if (s.buys > 0) CARD_IDS.forEach((c) => { if (s.supply[c] > 0 && CARDS[c].cost <= s.coins) out.push({ type: 'buy', card: c }); });
      out.push({ type: 'endTurn' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seats = domModule.pendingSeats(s);
    const missed = seats.map((k) => s.timeouts[k]! + 1);
    if (s.militia.some((n) => n > 0)) {
      s.militia.forEach((n, k) => { if (n) domModule.apply(s, { kind: 'player', seat: k }, { type: 'militiaDiscard', discard: Array.from({ length: n }, (_, i) => i) }, ctx); });
    } else domModule.apply(s, { kind: 'player', seat: s.current }, { type: 'endTurn' }, ctx);
    seats.forEach((k, i) => { s.timeouts[k] = missed[i]!; });
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.militia.some((n) => n > 0) ? s.militia.map((n, k) => (n ? k : -1)).filter((k) => k >= 0) : [s.current]),

  tutorial: {
    seed: 17,
    options: { deal: 'tutorial' },
    introFa: 'دست شما یک آهنگری، سه مس و یک ملک است. فقط یک ایالت در بازار مانده؛ خریدنش بازی را تمام می‌کند.',
    steps: [
      { instructionFa: 'آهنگری را بازی کنید: سه کارت می‌کشید.', expected: { type: 'play', index: 0 }, reply: null },
      { instructionFa: 'گنج‌ها را رو کنید: چهار مس + طلا + نقره = ۹ سکه.', expected: { type: 'treasures' }, reply: null },
      { instructionFa: 'ایالت را بخرید (۸ سکه).', expected: { type: 'buy', card: 'province' }, reply: null },
      { instructionFa: 'نوبت را تمام کنید؛ ایالت‌ها تمام شده و بازی پایان می‌یابد.', expected: { type: 'endTurn' }, reply: null }
    ],
    completedFa: 'بردید! ایالت ۶ امتیاز داشت.'
  }
};
