// Point Salad («بازار سبزی»), 2–6 players, perfect information except the deck order. 108 double-sided cards: a
// vegetable on one side (six kinds, 18 each) and a scoring rule on the other. The rules are generated from the
// original's rule families (sets, ±per vegetable, even/odd, most/fewest, full sets, most/fewest in total); not a
// card-for-card copy. Each player count uses 3 cards of each vegetable per player (2: 36, 3: 54, …, 6: 108).
// Market: three piles (rule side up) with two vegetables under each. A turn: take the top rule of a pile, or one or
// two market vegetables; then optionally flip one of your rules into its vegetable. Empty vegetable slots refill
// from the pile above (an empty pile borrows from the bottom of the largest one). The game ends when every card is
// taken; each rule scores against its owner's vegetables (most/fewest compare with everyone; ties share).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { pointSalad } from './definition.ts';

export const VEG = ['tomato', 'lettuce', 'carrot', 'cabbage', 'pepper', 'onion'] as const;
export type Veg = (typeof VEG)[number];
export type Rule =
  | { k: 'combo'; veg: Veg[]; pts: number }
  | { k: 'each'; terms: [Veg, number][] }
  | { k: 'parity'; veg: Veg }
  | { k: 'most'; veg: Veg }
  | { k: 'fewest'; veg: Veg }
  | { k: 'set' }
  | { k: 'mostTotal' }
  | { k: 'fewestTotal' };
export interface Card { id: number; veg: Veg; rule: Rule }

const v = (i: number) => VEG[((i % 6) + 6) % 6]!;
const PATTERNS: ((a: Veg, b: Veg, c: Veg, d: Veg) => Rule)[] = [
  (a, b) => ({ k: 'combo', veg: [a, b], pts: 5 }), (a) => ({ k: 'combo', veg: [a, a], pts: 5 }), (a, b, c) => ({ k: 'combo', veg: [a, b, c], pts: 8 }),
  (a, b) => ({ k: 'each', terms: [[a, 2], [b, -1]] }), (a, b) => ({ k: 'each', terms: [[a, 3], [b, -2]] }), (a, b) => ({ k: 'each', terms: [[a, 1], [b, 1]] }),
  (a) => ({ k: 'parity', veg: a }), (a) => ({ k: 'most', veg: a }), (a) => ({ k: 'fewest', veg: a }), () => ({ k: 'set' }),
  (a) => ({ k: 'combo', veg: [a, a, a], pts: 8 }), (a, b, c) => ({ k: 'each', terms: [[a, 4], [b, -2], [c, -2]] }), (a, b, c) => ({ k: 'each', terms: [[a, 2], [b, 1], [c, -2]] }),
  (a, b) => ({ k: 'combo', veg: [a, a, b], pts: 7 }), () => ({ k: 'mostTotal' }), () => ({ k: 'fewestTotal' }), (a, b) => ({ k: 'each', terms: [[a, 3], [b, -1]] }),
  (a, b, c, d) => ({ k: 'combo', veg: [a, b, c, d], pts: 10 })
];
export const CARDS: Card[] = Array.from({ length: 108 }, (_, id) => {
  const r = Math.floor(id / 6);
  return { id, veg: v(id), rule: PATTERNS[r]!(v(id + 1), v(id + 2 + (r % 3)), v(id + 3), v(id + 4)) };
});

export interface PointSaladState {
  players: number;
  piles: number[][];
  market: (number | null)[];
  rules: number[][];
  veggies: number[][];
  current: number;
  last: { seat: number; took: number[]; kind: 'rule' | 'veg'; flipped: number | null } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type PointSaladView = Omit<PointSaladState, 'piles' | 'timeouts'> & { pileTops: (number | null)[]; pileCounts: number[] };

export const pointSaladAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rule'), pile: z.number().int().min(0).max(2), flip: z.number().int().min(0).max(107).optional() }),
  z.strictObject({ type: z.literal('veg'), slots: z.array(z.number().int().min(0).max(5)).min(1).max(2), flip: z.number().int().min(0).max(107).optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type PointSaladAction = z.infer<typeof pointSaladAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const counts = (veggies: number[]) => { const c = Object.fromEntries(VEG.map((x) => [x, 0])) as Record<Veg, number>; for (const id of veggies) c[CARDS[id]!.veg] += 1; return c; };

/** Score of one rule for `seat` given everyone's vegetables. */
export function ruleScore(rule: Rule, seat: number, all: Record<Veg, number>[]) {
  const me = all[seat]!;
  const total = (c: Record<Veg, number>) => VEG.reduce((a, x) => a + c[x], 0);
  switch (rule.k) {
    case 'combo': { const need = counts([]) as Record<Veg, number>; for (const x of rule.veg) need[x] += 1; return Math.min(...VEG.filter((x) => need[x]).map((x) => Math.floor(me[x] / need[x]))) * rule.pts; }
    case 'each': return rule.terms.reduce((a, [x, p]) => a + me[x] * p, 0);
    case 'parity': return me[rule.veg] % 2 === 0 ? 7 : 3;
    case 'most': return me[rule.veg] > 0 && all.every((o) => o[rule.veg] <= me[rule.veg]) ? 10 : 0;
    case 'fewest': return all.every((o) => o[rule.veg] >= me[rule.veg]) ? 7 : 0;
    case 'set': return Math.min(...VEG.map((x) => me[x])) * 12;
    case 'mostTotal': return all.every((o) => total(o) <= total(me)) ? 10 : 0;
    case 'fewestTotal': return all.every((o) => total(o) >= total(me)) ? 7 : 0;
  }
}
export function scores(s: Pick<PointSaladState, 'rules' | 'veggies'>) {
  const all = s.veggies.map(counts);
  return s.rules.map((rs, seat) => rs.reduce((a, id) => a + ruleScore(CARDS[id]!.rule, seat, all), 0));
}

// ---------- module ----------

type Events = Transition<PointSaladState>['internalEvents'];
const finish = (s: PointSaladState, events: Events): Transition<PointSaladState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: PointSaladState, seats: number[]): Outcome['placements'] {
  const sc = scores(s);
  const r = seats.map((seat) => ({ seat, p: sc[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function takeFrom(s: PointSaladState, pile: number): number | undefined {
  if (s.piles[pile]!.length) return s.piles[pile]!.shift();
  const biggest = [0, 1, 2].sort((a, b) => s.piles[b]!.length - s.piles[a]!.length)[0]!;
  return s.piles[biggest]!.pop();
}
function refill(s: PointSaladState) {
  s.market = s.market.map((x, i) => (x === null ? takeFrom(s, Math.floor(i / 2)) ?? null : x));
}
const allTaken = (s: PointSaladState) => s.piles.every((p) => !p.length) && s.market.every((x) => x === null);

export const pointSaladModule: GameModule<PointSaladState, PointSaladAction, PointSaladView> = {
  manifest: pointSalad.manifest,
  actionSchema: pointSaladAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('point salad needs 2–6 players');
    const deck = VEG.flatMap((x) => shuffle(rng, CARDS.filter((c) => c.veg === x).map((c) => c.id)).slice(0, 3 * playerCount));
    const shuffled = shuffle(rng, deck);
    const piles = [0, 1, 2].map((k) => shuffled.filter((_, i) => i % 3 === k));
    const s: PointSaladState = {
      players: playerCount, piles, market: Array(6).fill(null), rules: Array.from({ length: playerCount }, () => []), veggies: Array.from({ length: playerCount }, () => []),
      current: rng.nextInt(playerCount), last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    refill(s);
    if (options.deal === 'tutorial') {
      // The last three rounds. Learner: 1 tomato, rules «most lettuce» (a tomato on its back) and «fewest vegetables».
      // Rival: lettuce ×2 and carrot, rules «carrot +1, onion +1» and «most vegetables». Pile 1 holds the
      // «+2 per tomato» rule; pile 2 a parity rule over two cards that refill the market once the tomatoes go.
      s.current = 0;
      s.piles = [[23], [36, 0, 2], []];
      s.market = [5, 1, 6, 12, 4, 3];
      s.rules = [[42, 90], [31, 85]];
      s.veggies = [[24], [7, 13, 8]];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.current !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.flip !== undefined && !s.rules[actor.seat]!.includes(a.flip) && !(a.type === 'rule' && s.piles[a.pile]![0] === a.flip)) return { ok: false, errorCode: 'NOT_YOUR_RULE' };
    if (a.type === 'rule') return s.piles[a.pile]!.length ? { ok: true } : { ok: false, errorCode: 'EMPTY_PILE' };
    if (new Set(a.slots).size !== a.slots.length || a.slots.some((i) => s.market[i] === null)) return { ok: false, errorCode: 'NO_SUCH_VEGETABLE' };
    const avail = s.market.filter((x) => x !== null).length;
    return a.slots.length === Math.min(2, avail) ? { ok: true } : { ok: false, errorCode: 'TAKE_TWO' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.rules.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: scores(s)[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    let took: number[];
    if (a.type === 'rule') { const id = s.piles[a.pile]!.shift()!; s.rules[seat]!.push(id); took = [id]; }
    else { took = a.slots.map((i) => s.market[i]!); a.slots.forEach((i) => { s.market[i] = null; }); s.veggies[seat]!.push(...took); }
    if (a.flip !== undefined) { s.rules[seat] = s.rules[seat]!.filter((x) => x !== a.flip); s.veggies[seat]!.push(a.flip); }
    s.last = { seat, took, kind: a.type, flipped: a.flip ?? null };
    refill(s);
    if (allTaken(s)) s.outcome = { placements: rank(s, s.rules.map((_, k) => k)), reason: 'score' };
    else s.current = (seat + 1) % s.players;
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { piles, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, pileTops: piles.map((p) => p[0] ?? null), pileCounts: piles.map((p) => p.length) };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      s.piles.forEach((p, i) => { if (p.length) out.push({ type: 'rule', pile: i }); });
      const avail = s.market.map((x, i) => (x === null ? -1 : i)).filter((i) => i >= 0);
      if (avail.length) out.push({ type: 'veg', slots: avail, need: Math.min(2, avail.length) });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const avail = s.market.map((x, i) => (x === null ? -1 : i)).filter((i) => i >= 0);
    const a: PointSaladAction = avail.length ? { type: 'veg', slots: avail.slice(0, 2) } : { type: 'rule', pile: s.piles.findIndex((p) => p.length) };
    const t = pointSaladModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 41,
    options: { deal: 'tutorial' },
    introFa: 'سه دور به پایان بازی مانده. هر کارت یک روی دستور امتیاز دارد و یک روی سبزی. شما ۱ گوجه و دو دستور دارید: «بیشترین کاهو = ۱۰» و «کمترین سبزی کل = ۷». حریف ۲ کاهو و ۱ هویج و دستورهای «هر هویج +۱، هر پیاز +۱» و «بیشترین سبزی کل = ۱۰» را دارد. وقتی همهٔ کارت‌ها برداشته شود، هر دستور با سبزی‌های صاحبش امتیاز می‌گیرد.',
    steps: [
      { instructionFa: 'روی دستهٔ اول دستور «هر گوجه +۲، هر کاهو −۱» است و بازار پر از گوجه است. در هر نوبت یا یک دستور برمی‌دارید یا دو سبزی؛ این دستور را بردارید. حریف هم دستور دستهٔ دوم را برمی‌دارد.', expected: { type: 'rule', pile: 0 }, reply: { type: 'rule', pile: 1 } },
      { instructionFa: 'حالا دو گوجهٔ زیر دستهٔ دوم را انتخاب کنید و بردارید. جای خالی بازار از کارت‌های همان دسته پر می‌شود و آن کارت‌ها با روی سبزی‌شان به بازار می‌آیند. حریف پیاز و کاهو برمی‌دارد.', expected: { type: 'veg', slots: [2, 3] }, reply: { type: 'veg', slots: [0, 1] } },
      { instructionFa: 'حریف ۳ کاهو دارد و شما هیچ؛ دستور «بیشترین کاهو» برایتان ۰ امتیاز است. پیش از برداشتن، روی همین دستور بزنید تا برگردد و سبزی پشتش (یک گوجه) را بگیرید. بعد گوجه و هویج بازار را بردارید. حریف دو سبزی آخر را برمی‌دارد و بازی تمام می‌شود.', expected: { type: 'veg', slots: [2, 3], flip: 42 }, reply: { type: 'veg', slots: [4, 5] } }
    ],
    completedFa: 'بردید، ۱۷ به ۱۵! ۵ گوجه با دستور «هر گوجه +۲» ۱۰ امتیاز شد و کاهو نداشتید که چیزی کم شود. ۶ سبزی شما از ۷ سبزی حریف کمتر بود، پس «کمترین سبزی کل» ۷ امتیاز داد. حریف ۱۰ امتیاز «بیشترین سبزی کل»، ۳ امتیاز از ۳ کاهوی فرد و ۲ امتیاز از هویج و پیاز گرفت. اگر دستور «بیشترین کاهو» را برنمی‌گرداندید، ۴ گوجه و ۱۵ امتیاز داشتید و بازی مساوی می‌شد.'
  }
};
