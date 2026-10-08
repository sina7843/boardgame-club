// Res Arcana («آرکانا»), 2–4 players. Essences: e (elan/fire), l (life), c (calm), d (death), g (gold). Each player
// has a mage (collects 2 essences) and a private deck of 6 artifacts (dealt from 24) and draws 3. Round: collect
// (mage, artifacts and places of power produce), then actions in turn until everyone passes: play an artifact (pay
// its cost), tap one card's power (once per round), buy a place of power (5 on offer) or a monument (2 face up, 4
// gold, 2 VP), discard a card for 1 gold or 2 of one other essence, or pass (draw 1; the first to pass starts the
// next round). Taps can give VP tokens. The game ends at the end of a round in which someone has 10+ VP; most VP wins
// (ties share). Simplification: original card set without attacks, dragons, reactions or "any essence" costs.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { resArcana } from './definition.ts';

export const ESS = ['e', 'l', 'c', 'd', 'g'] as const;
export type Ess = (typeof ESS)[number];
export type Pile = Partial<Record<Ess, number>>;
export const ESS_FA: Record<Ess, string> = { e: 'آتش', l: 'زندگی', c: 'آرامش', d: 'مرگ', g: 'طلا' };
const P = (s: string): Pile => { const out: Pile = {}; for (const ch of s) out[ch as Ess] = (out[ch as Ess] ?? 0) + 1; return out; };

export interface Power { pay: Pile; gain: Pile; vp?: number }
export interface Card { id: number; kind: 'mage' | 'artifact' | 'place' | 'monument'; name: string; cost: Pile; vp: number; collect: Pile; power?: Power }
type Def = [string, string, string, string?, number?];
const A: Def[] = [
  ['جام زندگی', 'l', 'l'], ['آینهٔ آرامش', 'c', 'c'], ['جمجمهٔ سیاه', 'd', 'd'], ['شعلهٔ کوچک', 'e', 'e'], ['کیسهٔ زر', 'gg', 'g'],
  ['عصای کیمیاگر', 'cd', '', 'll>gg'], ['دیگ جوشان', 'll', '', '>le'], ['گوی پیشگو', 'cc', 'c', 'ccc>*'], ['خنجر خون', 'ed', 'e', 'ee>dd'],
  ['تاج خار', 'ld', '', 'dd>*'], ['چراغ ابدی', 'ee', 'e', 'eee>*'], ['چشمهٔ شفا', 'lll', 'll'], ['زره سنگی', 'gc', '', '>cc'],
  ['کتاب سایه', 'dd', 'd', 'g>ddd'], ['بال ققنوس', 'eel', '', 'l>eee'], ['ترازوی طلایی', 'gg', '', 'ec>gg'], ['کلید راز', 'c', '', 'gg>*'],
  ['بذر کهن', 'l', 'l', 'lll>ec'], ['ناقوس مردگان', 'ddd', 'dd'], ['قلب اژدها', 'eee', 'ee', 'e>*'], ['حلقهٔ معامله', 'g', '', 'd>gl'],
  ['گل یخ', 'cl', 'c', 'cc>l*'], ['آتشدان', 'egg', 'eg'], ['تومار جادو', 'ccd', '', '>cd']
];
const M: Def[] = [['جادوگر آتش', '', 'el'], ['شفاگر جنگل', '', 'lc'], ['کاهن سایه', '', 'dg'], ['استاد آرامش', '', 'ce']];
const PL: Def[] = [
  ['برج اژدها', 'eeeedd', '', 'e>*', 2], ['باغ مقدس', 'llllll', 'll', undefined, 2], ['معبد آرام', 'cccccg', '', undefined, 3],
  ['دخمهٔ مرگ', 'dddddd', 'd', 'dd>*', 1], ['کان طلا', 'ggggg', 'g', undefined, 2]
];
function power(spec?: string): Power | undefined {
  if (!spec) return undefined;
  const [pay, gain] = spec.split('>') as [string, string];
  const vp = [...gain].filter((x) => x === '*').length;
  return { pay: P(pay), gain: P(gain.replace(/\*/g, '')), ...(vp ? { vp } : {}) };
}
export const CARDS: Card[] = [
  ...A.map(([name, cost, collect, pw]) => ({ kind: 'artifact' as const, name, cost: P(cost), vp: 0, collect: P(collect), power: power(pw) })),
  ...M.map(([name, cost, collect, pw]) => ({ kind: 'mage' as const, name, cost: P(cost), vp: 0, collect: P(collect), power: power(pw) })),
  ...PL.map(([name, cost, collect, pw, vp]) => ({ kind: 'place' as const, name, cost: P(cost), vp: vp ?? 0, collect: P(collect), power: power(pw) })),
  ...Array.from({ length: 6 }, (_, i) => ({ kind: 'monument' as const, name: ['ستون فرشتگان', 'تندیس طلایی', 'دروازهٔ ستاره', 'هرم جادو', 'کتیبهٔ کهن', 'برج ناقوس'][i]!, cost: P('gggg'), vp: 2, collect: {} }))
].map((c, id) => ({ ...c, id }));
const ofKind = (k: Card['kind']) => CARDS.filter((c) => c.kind === k).map((c) => c.id);
/** The monument the tutorial buys (first in card order). */
export const FIRST_MONUMENT = ofKind('monument')[0]!;

export interface Mage { deck: number[]; hand: number[]; table: number[]; ess: Record<Ess, number>; vpTokens: number; passed: boolean }
export interface RaState {
  players: Mage[];
  places: number[];
  monuments: number[];
  monumentDeck: number[];
  tapped: number[];
  current: number;
  first: number;
  nextFirst: number | null;
  round: number;
  last: { seat: number; kind: string; card?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type RaView = Omit<RaState, 'players' | 'monumentDeck' | 'timeouts'> & {
  hand: number[] | null;
  mages: { table: number[]; ess: Record<Ess, number>; vpTokens: number; passed: boolean; hand: number; deck: number; vp: number }[];
  monumentsLeft: number;
};

export const raAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('tap'), card: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('buy'), card: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('discard'), card: z.number().int().min(0).max(80), gain: z.enum(ESS) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type RaAction = z.infer<typeof raAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const canPay = (ess: Record<Ess, number>, cost: Pile) => ESS.every((k) => ess[k] >= (cost[k] ?? 0));
const pay = (ess: Record<Ess, number>, cost: Pile) => ESS.forEach((k) => { ess[k] -= cost[k] ?? 0; });
const add = (ess: Record<Ess, number>, gain: Pile) => ESS.forEach((k) => { ess[k] += gain[k] ?? 0; });
export const vpOf = (m: Pick<Mage, 'table' | 'vpTokens'>) => m.vpTokens + m.table.reduce((n, id) => n + CARDS[id]!.vp, 0);
const draw = (m: Mage) => { if (m.deck.length) m.hand.push(m.deck.shift()!); };

type Events = Transition<RaState>['internalEvents'];
const finish = (s: RaState, events: Events): Transition<RaState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
function rank(s: RaState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: vpOf(s.players[seat]!) })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}
function collect(s: RaState) { for (const m of s.players) for (const id of m.table) add(m.ess, CARDS[id]!.collect); }
function nextActive(s: RaState, from: number) {
  for (let k = 1; k <= s.players.length; k++) { const seat = (from + k) % s.players.length; if (!s.players[seat]!.passed) return seat; }
  return -1;
}
function endRound(s: RaState) {
  if (s.players.some((m) => vpOf(m) >= 10)) { s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' }; return; }
  s.round += 1;
  s.tapped = [];
  s.players.forEach((m) => { m.passed = false; });
  s.first = s.nextFirst ?? s.first; s.nextFirst = null;
  s.current = s.first;
  collect(s);
}

export const raModule: GameModule<RaState, RaAction, RaView> = {
  manifest: resArcana.manifest,
  actionSchema: raAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('res arcana needs 2–4 players');
    const arts = shuffle(rng, ofKind('artifact'));
    const mages = shuffle(rng, ofKind('mage'));
    const monuments = shuffle(rng, ofKind('monument'));
    const first = rng.nextInt(playerCount);
    const s: RaState = {
      players: Array.from({ length: playerCount }, (_, k) => {
        const deck = arts.slice(k * 6, k * 6 + 6);
        return { deck: deck.slice(3), hand: deck.slice(0, 3), table: [mages[k]!], ess: { e: 1, l: 1, c: 1, d: 1, g: 1 }, vpTokens: 0, passed: false };
      }),
      places: ofKind('place'), monuments: monuments.slice(0, 2), monumentDeck: monuments.slice(2), tapped: [], current: first, first, nextFirst: null, round: 1,
      last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      s.current = 0; s.first = 0;
      const cup = CARDS.find((c) => c.name === 'جام زندگی')!.id;
      const m0 = s.players[0]!;
      m0.hand = [cup, ...m0.hand.filter((x) => x !== cup)].slice(0, 3);
      m0.ess = { e: 0, l: 1, c: 0, d: 0, g: 4 };
      m0.vpTokens = 8;
      s.monuments = [ofKind('monument')[0]!, ofKind('monument')[1]!];
      s.monumentDeck = ofKind('monument').slice(2);
      s.players.forEach((m, k) => { if (k > 0) m.hand = m.hand.filter((x) => x !== cup); });
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players.length) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const m = s.players[actor.seat]!;
    switch (a.type) {
      case 'pass': return { ok: true };
      case 'play': return !m.hand.includes(a.card) ? { ok: false, errorCode: 'NOT_IN_HAND' } : canPay(m.ess, CARDS[a.card]!.cost) ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      case 'discard': return m.hand.includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_IN_HAND' };
      case 'tap': {
        const c = CARDS[a.card]!;
        if (!m.table.includes(a.card) || !c.power) return { ok: false, errorCode: 'NO_POWER' };
        if (s.tapped.includes(a.card)) return { ok: false, errorCode: 'ALREADY_TAPPED' };
        return canPay(m.ess, c.power.pay) ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      }
      case 'buy': {
        if (!s.places.includes(a.card) && !s.monuments.includes(a.card)) return { ok: false, errorCode: 'NOT_FOR_SALE' };
        return canPay(m.ess, CARDS[a.card]!.cost) ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
      }
    }
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.players.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players.length, score: vpOf(s.players[seat]!) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    const m = s.players[seat]!;
    switch (a.type) {
      case 'play': pay(m.ess, CARDS[a.card]!.cost); m.hand = m.hand.filter((x) => x !== a.card); m.table.push(a.card); break;
      case 'discard': m.hand = m.hand.filter((x) => x !== a.card); m.ess[a.gain] += a.gain === 'g' ? 1 : 2; break;
      case 'tap': { const pw = CARDS[a.card]!.power!; pay(m.ess, pw.pay); add(m.ess, pw.gain); m.vpTokens += pw.vp ?? 0; s.tapped.push(a.card); break; }
      case 'buy':
        pay(m.ess, CARDS[a.card]!.cost);
        m.table.push(a.card);
        if (s.places.includes(a.card)) s.places = s.places.filter((x) => x !== a.card);
        else { s.monuments = s.monuments.filter((x) => x !== a.card); if (s.monumentDeck.length) s.monuments.push(s.monumentDeck.shift()!); }
        break;
      case 'pass':
        m.passed = true; draw(m);
        if (s.nextFirst === null) s.nextFirst = seat;
        break;
    }
    s.last = { seat, kind: a.type, ...('card' in a ? { card: a.card } : {}) };
    const next = nextActive(s, seat);
    if (next < 0) endRound(s); else s.current = next;
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { players, monumentDeck, timeouts: _t, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      ...rest, hand: players[me]?.hand ?? null, monumentsLeft: monumentDeck.length,
      mages: players.map((m) => ({ table: m.table, ess: m.ess, vpTokens: m.vpTokens, passed: m.passed, hand: m.hand.length, deck: m.deck.length, vp: vpOf(m) }))
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      const m = s.players[viewer.seat]!;
      m.hand.forEach((card) => { if (canPay(m.ess, CARDS[card]!.cost)) out.push({ type: 'play', card }); out.push({ type: 'discard', card }); });
      m.table.forEach((card) => { const pw = CARDS[card]!.power; if (pw && !s.tapped.includes(card) && canPay(m.ess, pw.pay)) out.push({ type: 'tap', card }); });
      [...s.places, ...s.monuments].forEach((card) => { if (canPay(m.ess, CARDS[card]!.cost)) out.push({ type: 'buy', card }); });
      out.push({ type: 'pass' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const t = raModule.apply(s, { kind: 'player', seat }, { type: 'pass' }, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 19,
    options: { deal: 'tutorial' },
    introFa: 'شما ۸ امتیاز، ۴ طلا و ۱ جوهر زندگی دارید. بناهای یادبود ۴ طلا قیمت دارند و ۲ امتیاز می‌دهند.',
    steps: [
      { instructionFa: '«جام زندگی» را با یک جوهر زندگی بازی کنید؛ از دور بعد زندگی تولید می‌کند.', expected: { type: 'play', card: 0 }, reply: { type: 'pass' } },
      { instructionFa: 'حریف رد کرد. بنای یادبود اول را با ۴ طلا بخرید (+۲ امتیاز).', expected: { type: 'buy', card: FIRST_MONUMENT }, reply: null },
      { instructionFa: 'رد کنید تا دور تمام شود؛ با ۱۰ امتیاز برنده می‌شوید.', expected: { type: 'pass' }, reply: null }
    ],
    completedFa: 'بردید! به ۱۰ امتیاز رسیدید.'
  }
};
