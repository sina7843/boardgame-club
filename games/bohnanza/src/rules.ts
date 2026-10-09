// Bohnanza («لوبیاکاری»), 2–5 players. 150 bean cards of ten types. Turn: plant the first hand card (must) and the
// second (may); flip two cards face up; the active player trades/donates face-up and hand cards with the others
// (offer → target accepts or declines); trade ends, remaining face-up cards go to the active player, everyone plants
// what they received; the active player draws three. Fields hold one bean type; harvesting pays by the beanometer
// (coin cards leave play, the rest are discarded). A single-bean field cannot be harvested while another field has
// more. A third field costs 3 coins. The game ends when the deck runs out (one pass, no reshuffle); all fields are
// harvested and the most coins win. Hidden: hand contents and order, deck.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { bohnanza } from './definition.ts';

export const BEANS = ['coffee', 'wax', 'blue', 'chili', 'stink', 'green', 'soy', 'blackeye', 'red', 'garden'] as const;
export type Bean = (typeof BEANS)[number];
export const BEAN_INFO: Record<Bean, { name: string; count: number; meter: (number | null)[] }> = {
  coffee: { name: 'قهوه‌ای', count: 24, meter: [4, 7, 10, 12] },
  wax: { name: 'مومی', count: 22, meter: [4, 7, 9, 11] },
  blue: { name: 'آبی', count: 20, meter: [4, 6, 8, 10] },
  chili: { name: 'فلفلی', count: 18, meter: [3, 6, 8, 9] },
  stink: { name: 'بدبو', count: 16, meter: [3, 5, 7, 8] },
  green: { name: 'سبز', count: 14, meter: [3, 5, 6, 7] },
  soy: { name: 'سویا', count: 12, meter: [2, 4, 6, 7] },
  blackeye: { name: 'چشم‌بلبلی', count: 10, meter: [2, 4, 5, 6] },
  red: { name: 'قرمز', count: 8, meter: [2, 3, 4, 5] },
  garden: { name: 'باغی', count: 6, meter: [null, 2, 3, null] }
};
/** Coins for harvesting n beans of a type. */
export const payout = (b: Bean, n: number) => BEAN_INFO[b].meter.reduce<number>((c, t, i) => (t !== null && n >= t ? i + 1 : c), 0);

export interface Field { bean: Bean | null; n: number }
export interface Offer { from: number; to: number; faceUp: number[]; hand: number[]; want: Bean[] }
export type Phase = 'plant' | 'trade' | 'settle';
export interface BeanState {
  players: number;
  deck: Bean[];
  discard: number;
  hands: Bean[][];
  fields: Field[][];
  coins: number[];
  faceUp: Bean[];
  pending: Bean[][];
  phase: Phase;
  planted: number;
  offer: Offer | null;
  current: number;
  last: { seat: number; kind: string; detail: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type BeanView = Omit<BeanState, 'deck' | 'hands' | 'timeouts'> & { deckCount: number; handCounts: number[]; hand: Bean[] | null };

const bean = z.enum(BEANS);
const idx = z.array(z.number().int().min(0).max(200)).max(30);
export const beanAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('plant'), field: z.number().int().min(0).max(2) }),
  z.strictObject({ type: z.literal('harvest'), field: z.number().int().min(0).max(2) }),
  z.strictObject({ type: z.literal('buyField') }),
  z.strictObject({ type: z.literal('flip') }),
  z.strictObject({ type: z.literal('offer'), to: z.number().int().min(0).max(4), faceUp: idx, hand: idx, want: z.array(bean).max(10) }),
  z.strictObject({ type: z.literal('accept') }),
  z.strictObject({ type: z.literal('decline') }),
  z.strictObject({ type: z.literal('endTrade') }),
  z.strictObject({ type: z.literal('plantPending'), card: z.number().int().min(0).max(30), field: z.number().int().min(0).max(2) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type BeanAction = z.infer<typeof beanAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const uniq = (xs: number[]) => new Set(xs).size === xs.length;

export const canPlantIn = (f: Field | undefined, b: Bean) => !!f && (f.bean === null || f.bean === b);
export function canHarvest(fields: Field[], i: number) {
  const f = fields[i];
  if (!f || !f.bean) return false;
  return f.n > 1 || fields.every((g) => g.n <= 1);
}
/** Indices in `hand` that satisfy `want` (first occurrences), or null. */
export function matchWant(hand: Bean[], want: Bean[]) {
  const used = new Set<number>();
  for (const w of want) {
    const i = hand.findIndex((b, k) => b === w && !used.has(k));
    if (i < 0) return null;
    used.add(i);
  }
  return [...used];
}

type Events = Transition<BeanState>['internalEvents'];
const finish = (s: BeanState, events: Events): Transition<BeanState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: BeanState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.coins[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function harvest(s: BeanState, seat: number, i: number) {
  const f = s.fields[seat]![i]!;
  const c = payout(f.bean!, f.n);
  s.coins[seat]! += c;
  s.discard += f.n - c;
  f.bean = null; f.n = 0;
  return c;
}
function plantInto(s: BeanState, seat: number, i: number, b: Bean) {
  const f = s.fields[seat]![i]!;
  f.bean = b; f.n += 1;
}

function endGame(s: BeanState) {
  for (let seat = 0; seat < s.players; seat++) s.fields[seat]!.forEach((f, i) => { if (f.bean) harvest(s, seat, i); });
  s.outcome = { placements: rank(s, s.coins.map((_, k) => k)), reason: 'score' };
}

/** After trading: when nobody has cards left to plant, the active player draws three and the turn passes. */
function maybeEndTurn(s: BeanState) {
  if (s.outcome || s.phase !== 'settle' || s.pending.some((p) => p.length)) return;
  if (s.deck.length < 3) { s.discard += s.deck.length; s.deck = []; endGame(s); return; }
  s.hands[s.current]!.push(...s.deck.splice(0, 3));
  s.current = (s.current + 1) % s.players;
  s.phase = 'plant';
  s.planted = s.hands[s.current]!.length ? 0 : 2;
}

export const beanModule: GameModule<BeanState, BeanAction, BeanView> = {
  manifest: bohnanza.manifest,
  actionSchema: beanAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('bohnanza needs 2–5 players');
    const deck = shuffle(rng, BEANS.flatMap((b) => Array<Bean>(BEAN_INFO[b].count).fill(b)));
    const s: BeanState = {
      players: playerCount, deck, discard: 0, hands: Array.from({ length: playerCount }, () => deck.splice(0, 5)),
      fields: Array.from({ length: playerCount }, () => [{ bean: null, n: 0 }, { bean: null, n: 0 }]), coins: Array(playerCount).fill(0),
      faceUp: [], pending: Array.from({ length: playerCount }, () => []), phase: 'plant', planted: 0, offer: null,
      current: rng.nextInt(playerCount), last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // The last turn of a game: the deck holds just the two cards about to be flipped, so this turn ends the game.
      s.current = 0;
      s.hands = [['red', 'blue', 'chili'], ['blue', 'wax']];
      s.fields[0] = [{ bean: 'red', n: 3 }, { bean: 'blue', n: 2 }];
      s.fields[1] = [{ bean: 'soy', n: 1 }, { bean: 'wax', n: 2 }];
      s.coins = [2, 4];
      s.deck = ['chili', 'soy'];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    const fields = s.fields[seat]!;
    const active = seat === s.current;
    switch (a.type) {
      case 'resign': return { ok: true };
      case 'harvest':
        return canHarvest(fields, a.field) ? { ok: true } : { ok: false, errorCode: 'CANNOT_HARVEST' };
      case 'buyField':
        return fields.length < 3 && s.coins[seat]! >= 3 ? { ok: true } : { ok: false, errorCode: 'CANNOT_BUY' };
      case 'plant':
        if (!active || s.phase !== 'plant') return { ok: false, errorCode: 'NOT_YOUR_TURN' };
        if (s.planted >= 2 || !s.hands[seat]!.length) return { ok: false, errorCode: 'NOTHING_TO_PLANT' };
        return canPlantIn(fields[a.field], s.hands[seat]![0]!) ? { ok: true } : { ok: false, errorCode: 'FIELD_TAKEN' };
      case 'flip':
        if (!active || s.phase !== 'plant') return { ok: false, errorCode: 'NOT_YOUR_TURN' };
        return s.planted >= 1 || !s.hands[seat]!.length ? { ok: true } : { ok: false, errorCode: 'MUST_PLANT' };
      case 'offer': {
        if (!active || s.phase !== 'trade' || s.offer) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
        if (a.to === seat || a.to >= s.players) return { ok: false, errorCode: 'BAD_TARGET' };
        if (!uniq(a.faceUp) || !uniq(a.hand) || a.faceUp.some((i) => i >= s.faceUp.length) || a.hand.some((i) => i >= s.hands[seat]!.length)) return { ok: false, errorCode: 'BAD_CARDS' };
        if (!a.faceUp.length && !a.hand.length && !a.want.length) return { ok: false, errorCode: 'EMPTY_OFFER' };
        return { ok: true };
      }
      case 'accept':
        if (!s.offer || s.offer.to !== seat) return { ok: false, errorCode: 'NO_OFFER' };
        return matchWant(s.hands[seat]!, s.offer.want) ? { ok: true } : { ok: false, errorCode: 'MISSING_CARDS' };
      case 'decline':
        return s.offer && s.offer.to === seat ? { ok: true } : { ok: false, errorCode: 'NO_OFFER' };
      case 'endTrade':
        return active && s.phase === 'trade' && !s.offer ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_TURN' };
      case 'plantPending': {
        if (s.phase !== 'settle') return { ok: false, errorCode: 'NOT_NOW' };
        const b = s.pending[seat]![a.card];
        if (!b) return { ok: false, errorCode: 'NO_SUCH_CARD' };
        return canPlantIn(fields[a.field], b) ? { ok: true } : { ok: false, errorCode: 'FIELD_TAKEN' };
      }
    }
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.coins.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.coins[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    switch (a.type) {
      case 'harvest': {
        const b = s.fields[seat]![a.field]!.bean!;
        const c = harvest(s, seat, a.field);
        s.last = { seat, kind: 'harvest', detail: `${BEAN_INFO[b].name}، ${c} سکه` };
        break;
      }
      case 'buyField':
        s.coins[seat]! -= 3; s.fields[seat]!.push({ bean: null, n: 0 });
        s.last = { seat, kind: 'buy', detail: '' };
        break;
      case 'plant':
        plantInto(s, seat, a.field, s.hands[seat]!.shift()!);
        s.planted = s.hands[seat]!.length ? s.planted + 1 : 2;
        break;
      case 'flip':
        if (s.deck.length < 2) { s.discard += s.deck.length; s.deck = []; endGame(s); break; }
        s.faceUp = s.deck.splice(0, 2);
        s.phase = 'trade';
        break;
      case 'offer':
        s.offer = { from: seat, to: a.to, faceUp: a.faceUp, hand: a.hand, want: a.want };
        break;
      case 'accept': {
        const o = s.offer!;
        const take = matchWant(s.hands[seat]!, o.want)!;
        const got = take.map((i) => s.hands[seat]![i]!);
        s.hands[seat] = s.hands[seat]!.filter((_, i) => !take.includes(i));
        const give = [...o.faceUp.map((i) => s.faceUp[i]!), ...o.hand.map((i) => s.hands[o.from]![i]!)];
        s.faceUp = s.faceUp.filter((_, i) => !o.faceUp.includes(i));
        s.hands[o.from] = s.hands[o.from]!.filter((_, i) => !o.hand.includes(i));
        s.pending[seat]!.push(...give);
        s.pending[o.from]!.push(...got);
        s.last = { seat, kind: 'trade', detail: `${give.length}↔${got.length}` };
        s.offer = null;
        break;
      }
      case 'decline':
        s.last = { seat, kind: 'decline', detail: '' };
        s.offer = null;
        break;
      case 'endTrade':
        s.pending[seat]!.push(...s.faceUp);
        s.faceUp = [];
        s.phase = 'settle';
        break;
      case 'plantPending':
        plantInto(s, seat, a.field, s.pending[seat]!.splice(a.card, 1)[0]!);
        break;
    }
    maybeEndTurn(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { deck, hands, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, deckCount: deck.length, handCounts: hands.map((h) => h.length), hand: viewer.kind === 'player' ? hands[viewer.seat] ?? null : null };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    const fields = s.fields[seat]!;
    fields.forEach((_, i) => { if (canHarvest(fields, i)) out.push({ type: 'harvest', field: i }); });
    if (fields.length < 3 && s.coins[seat]! >= 3) out.push({ type: 'buyField' });
    if (seat === s.current && s.phase === 'plant') {
      const b = s.hands[seat]![0];
      if (b && s.planted < 2) fields.forEach((f, i) => { if (canPlantIn(f, b)) out.push({ type: 'plant', field: i }); });
      if (s.planted >= 1 || !b) out.push({ type: 'flip' });
    }
    if (seat === s.current && s.phase === 'trade' && !s.offer) out.push({ type: 'offer' }, { type: 'endTrade' });
    if (s.offer?.to === seat) { if (matchWant(s.hands[seat]!, s.offer.want)) out.push({ type: 'accept' }); out.push({ type: 'decline' }); }
    if (s.phase === 'settle') s.pending[seat]!.forEach((b, card) => fields.forEach((f, field) => { if (canPlantIn(f, b)) out.push({ type: 'plantPending', card, field }); }));
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seats = beanModule.pendingSeats(s);
    const missed = seats.map((k) => s.timeouts[k]! + 1);
    const act = (seat: number, a: BeanAction) => beanModule.apply(s, { kind: 'player', seat }, a, ctx);
    /** Plants bean b for seat, harvesting the best harvestable field first if no field fits. */
    const autoPlant = (seat: number, b: Bean, plant: (field: number) => BeanAction) => {
      const fields = s.fields[seat]!;
      let i = fields.findIndex((f) => f.bean === b);
      if (i < 0) i = fields.findIndex((f) => f.bean === null);
      if (i < 0) {
        const worth = (k: number) => payout(fields[k]!.bean!, fields[k]!.n);
        i = fields.map((_, k) => k).filter((k) => canHarvest(fields, k)).sort((x, y) => worth(y) - worth(x))[0]!;
        act(seat, { type: 'harvest', field: i });
      }
      act(seat, plant(i));
    };
    if (s.phase === 'plant') {
      const seat = s.current;
      if (s.planted === 0 && s.hands[seat]!.length) autoPlant(seat, s.hands[seat]![0]!, (field) => ({ type: 'plant', field }));
      act(seat, { type: 'flip' });
    } else if (s.phase === 'trade') {
      if (s.offer) act(s.offer.to, { type: 'decline' });
      else act(s.current, { type: 'endTrade' });
    } else {
      for (const seat of seats) while (s.phase === 'settle' && !s.outcome && s.pending[seat]!.length) autoPlant(seat, s.pending[seat]![0]!, (field) => ({ type: 'plantPending', card: 0, field }));
    }
    seats.forEach((k, i) => { s.timeouts[k] = missed[i]!; });
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'settle' ? s.pending.map((p, k) => (p.length ? k : -1)).filter((k) => k >= 0) : s.offer ? [s.offer.to] : [s.current]),

  tutorial: {
    seed: 33,
    options: { deal: 'tutorial' },
    introFa: 'آخرین نوبت یک بازی است و فقط ۲ کارت در دسته مانده. شما ۲ سکه دارید و حریف ۴ سکه. مزرعهٔ اولتان ۳ لوبیای قرمز دارد و مزرعهٔ دوم ۲ لوبیای آبی. دستتان به ترتیب قرمز، آبی و فلفلی است و ترتیبش را نمی‌شود عوض کرد.',
    steps: [
      { instructionFa: 'کارت اول دست همیشه باید کاشته شود. قرمز را در مزرعهٔ قرمز (مزرعهٔ اول) بکارید؛ هر مزرعه فقط یک نوع لوبیا می‌گیرد. حالا ۴ قرمز دارید که طبق جدول ۳ سکه می‌ارزد.', expected: { type: 'plant', field: 0 }, reply: null },
      { instructionFa: 'کاشتن کارت دوم اختیاری است. کارت دوم آبی است و مزرعهٔ آبی دارید؛ آن را در مزرعهٔ دوم بکارید تا ۳ آبی شود. فلفلی در دست می‌ماند.', expected: { type: 'plant', field: 1 }, reply: null },
      { instructionFa: 'دو کارت را رو کنید. کارت‌های روشده را می‌توانید نگه دارید یا در معامله به دیگران بدهید.', expected: { type: 'flip' }, reply: null },
      { instructionFa: 'فلفلی و سویا رو شد. حریف یک آبی در دست دارد و ۴ آبی ۱ سکه می‌ارزد. معامله پیشنهاد کنید: سویای روشده را برای دادن انتخاب کنید، از لوبیاهای خواستنی «آبی» را بزنید و بعد «پیشنهاد معامله». حریف آبی دارد و می‌پذیرد.', expected: { type: 'offer', to: 1, faceUp: [1], hand: [], want: ['blue'] }, reply: { type: 'accept' } },
      { instructionFa: 'معامله انجام شد. «پایان معامله» را بزنید: فلفلی روشده که کسی نگرفت مال خودتان می‌شود. کارت‌های معامله به دست نمی‌روند و همه باید آن‌ها را بکارند؛ حریف سویا را در مزرعهٔ سویایش می‌کارد.', expected: { type: 'endTrade' }, reply: { type: 'plantPending', card: 0, field: 0 } },
      { instructionFa: 'آبی معامله را در مزرعهٔ آبی بکارید. حالا ۴ آبی دارید که ۱ سکه می‌ارزد.', expected: { type: 'plantPending', card: 0, field: 1 }, reply: null },
      { instructionFa: 'فلفلی جا ندارد، چون هر دو مزرعه نوع دیگری دارند. اول مزرعهٔ قرمز را برداشت کنید (دکمهٔ «برداشت (۳ سکه)»): ۴ قرمز ۳ سکه می‌دهد و مزرعه خالی می‌شود. برداشت را هر وقت بخواهید می‌توانید انجام دهید.', expected: { type: 'harvest', field: 0 }, reply: null },
      { instructionFa: 'فلفلی را در مزرعهٔ خالی بکارید. چون کارتی برای کشیدن در دسته نمانده، بازی تمام می‌شود و همهٔ مزرعه‌ها برداشت می‌شوند.', expected: { type: 'plantPending', card: 0, field: 0 }, reply: null }
    ],
    completedFa: 'بردید! ۲ سکهٔ قبلی، ۳ سکه از برداشت ۴ قرمز و در برداشت پایانی ۱ سکه از ۴ آبی (۱ فلفلی به آستانهٔ ۳ نمی‌رسد و سکه‌ای ندارد): روی هم ۶ سکه. حریف ۴ سکه داشت و ۲ سویایش ۱ سکه داد (۲ مومی به آستانهٔ ۴ نرسید): ۵ سکه. همان آبی‌ای که با معامله گرفتید بازی را برد.'
  }
};
