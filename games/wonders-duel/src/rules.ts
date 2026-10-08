// 7 Wonders Duel («شگفتی‌ها: دوئل»), two players. Wonder draft (4 + 4, picks A·B·B·A then B·A·A·B), three ages laid
// out as card structures (Age I pyramid 2-3-4-5-6, Age II inverted 6-5-4-3-2, Age III 2-3-4-2-4-3-2 with 3 guilds),
// alternate rows face down. A turn takes one uncovered card to build (own resources, chains free, missing resources
// bought at 2 + opponent's brown/grey production, or 1 with a reserve card), discard (2 + 1 per yellow card) or build
// a wonder (max 7 wonders in total). Military track with the 2/5 coin tokens and supremacy at 9; science pairs give a
// progress token, six different symbols win; otherwise civilian victory after Age III (tie: most blue points).
// Simplification: the weaker military player starts the next age (tie: the player who did not take the last card).
// Hidden: face-down cards (only age/guild back), the removed cards and the out-of-game progress tokens.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { wondersDuel } from './definition.ts';

export type Color = 'brown' | 'grey' | 'blue' | 'red' | 'green' | 'yellow' | 'purple';
export type Res = 'W' | 'C' | 'S' | 'G' | 'P';
export const RES: Res[] = ['W', 'C', 'S', 'G', 'P'];
export const RES_FA: Record<Res, string> = { W: 'چوب', C: 'رس', S: 'سنگ', G: 'شیشه', P: 'پاپیروس' };
export interface Card {
  id: number; age: 1 | 2 | 3; name: string; color: Color; cost: string; coins: number;
  prod?: string; choice?: string; vp?: number; shields?: number; sci?: string; from?: string; chain?: string;
  trade?: string; gain?: number; per?: Color | 'wonder'; guild?: Color[] | 'wonder' | 'coins';
}
type Row = [string, Color, string, number, Partial<Card>?];
const AGE1: Row[] = [
  ['چوب‌بری', 'brown', '', 0, { prod: 'W' }], ['اردوگاه هیزم', 'brown', '', 1, { prod: 'W' }], ['آبگیر رس', 'brown', '', 0, { prod: 'C' }],
  ['گودال رس', 'brown', '', 1, { prod: 'C' }], ['معدن سنگ', 'brown', '', 0, { prod: 'S' }], ['گودال سنگ', 'brown', '', 1, { prod: 'S' }],
  ['شیشه‌گری', 'grey', '', 1, { prod: 'G' }], ['کاغذسازی', 'grey', '', 1, { prod: 'P' }],
  ['برج نگهبانی', 'red', '', 0, { shields: 1 }], ['اصطبل', 'red', 'W', 0, { shields: 1, chain: 'horseshoe' }],
  ['پادگان', 'red', 'C', 0, { shields: 1, chain: 'sword' }], ['حصار چوبی', 'red', '', 2, { shields: 1, chain: 'tower' }],
  ['کارگاه', 'green', 'P', 0, { sci: 'compass', vp: 1 }], ['عطاری', 'green', 'G', 0, { sci: 'wheel', vp: 1 }],
  ['کتابت‌خانه', 'green', '', 2, { sci: 'quill', chain: 'book' }], ['داروخانه', 'green', '', 2, { sci: 'mortar', chain: 'gear' }],
  ['تماشاخانه', 'blue', '', 0, { vp: 3, chain: 'mask' }], ['محراب', 'blue', '', 0, { vp: 3, chain: 'moon' }], ['گرمابه', 'blue', 'S', 0, { vp: 3, chain: 'drop' }],
  ['انبار سنگ', 'yellow', '', 3, { trade: 'S' }], ['انبار رس', 'yellow', '', 3, { trade: 'C' }], ['انبار چوب', 'yellow', '', 3, { trade: 'W' }],
  ['قهوه‌خانه', 'yellow', '', 0, { gain: 4, chain: 'jug' }]
];
const AGE2: Row[] = [
  ['کارخانهٔ چوب', 'brown', '', 2, { prod: 'WW' }], ['آجرپزی', 'brown', '', 2, { prod: 'CC' }], ['معدن پلکانی', 'brown', '', 2, { prod: 'SS' }],
  ['شیشه‌دمی', 'grey', '', 0, { prod: 'G' }], ['خشک‌خانه', 'grey', '', 0, { prod: 'P' }],
  ['باروها', 'red', 'SS', 0, { shields: 2 }], ['پرورشگاه اسب', 'red', 'CW', 0, { shields: 1, from: 'horseshoe' }], ['سربازخانه', 'red', '', 3, { shields: 1, from: 'sword' }],
  ['میدان تیراندازی', 'red', 'SWP', 0, { shields: 2, chain: 'target' }], ['میدان رژه', 'red', 'CCG', 0, { shields: 2, chain: 'helmet' }],
  ['کتابخانه', 'green', 'SWG', 0, { sci: 'quill', vp: 2, from: 'book' }], ['درمانگاه', 'green', 'CCS', 0, { sci: 'mortar', vp: 2, from: 'gear' }],
  ['مکتب‌خانه', 'green', 'WPP', 0, { sci: 'wheel', vp: 1, chain: 'harp' }], ['آزمایشگاه', 'green', 'WGG', 0, { sci: 'compass', vp: 1, chain: 'lamp' }],
  ['دادگاه', 'blue', 'WWG', 0, { vp: 5 }], ['تندیس', 'blue', 'CC', 0, { vp: 4, from: 'mask', chain: 'column' }], ['معبد', 'blue', 'WP', 0, { vp: 4, from: 'moon', chain: 'sun' }],
  ['قنات', 'blue', 'SSS', 0, { vp: 5, from: 'drop' }], ['سکوی خطابه', 'blue', 'SW', 0, { vp: 4, chain: 'bank' }],
  ['میدان', 'yellow', 'C', 3, { choice: 'GP' }], ['کاروانسرا', 'yellow', 'GP', 2, { choice: 'WCS' }], ['گمرک', 'yellow', '', 4, { trade: 'GP' }],
  ['شربت‌خانه', 'yellow', '', 0, { gain: 6, chain: 'barrel' }]
];
const AGE3: Row[] = [
  ['زرادخانه', 'red', 'CCCWW', 0, { shields: 3 }], ['قرارگاه', 'red', '', 8, { shields: 3 }], ['استحکامات', 'red', 'SSCP', 0, { shields: 2, from: 'tower' }],
  ['کارگاه محاصره', 'red', 'WWWG', 0, { shields: 2, from: 'target' }], ['میدان نمایش', 'red', 'CCSS', 0, { shields: 2, from: 'helmet' }],
  ['آکادمی', 'green', 'SWGG', 0, { sci: 'sundial', vp: 3, from: 'lamp' }], ['اتاق مطالعه', 'green', 'WWGP', 0, { sci: 'sundial', vp: 3 }],
  ['دانشگاه', 'green', 'CGP', 0, { sci: 'globe', vp: 2, from: 'harp' }], ['رصدخانه', 'green', 'SPP', 0, { sci: 'globe', vp: 2 }],
  ['کاخ', 'blue', 'CSWGG', 0, { vp: 7 }], ['تالار شهر', 'blue', 'SSSWW', 0, { vp: 7 }], ['ستون یادبود', 'blue', 'SSG', 0, { vp: 5 }],
  ['باغ‌ها', 'blue', 'CCWW', 0, { vp: 6, from: 'column' }], ['نیایشگاه بزرگ', 'blue', 'CWPP', 0, { vp: 6, from: 'sun' }], ['انجمن شهر', 'blue', 'CCSP', 0, { vp: 5, from: 'bank' }],
  ['اتاق بازرگانی', 'yellow', 'PP', 0, { vp: 3, per: 'grey' }], ['بندر', 'yellow', 'WGP', 0, { vp: 3, per: 'brown' }], ['اسلحه‌خانه', 'yellow', 'SSG', 0, { vp: 3, per: 'red' }],
  ['فانوس دریایی', 'yellow', 'CCG', 0, { vp: 3, per: 'yellow', from: 'jug' }], ['ورزشگاه', 'yellow', 'CSW', 0, { vp: 3, per: 'wonder', from: 'barrel' }]
];
const GUILDS: Row[] = [
  ['صنف بازرگانان', 'purple', 'CWGP', 0, { guild: ['yellow'] }], ['صنف کشتی‌داران', 'purple', 'CSGP', 0, { guild: ['brown', 'grey'] }],
  ['صنف معماران', 'purple', 'SSCWG', 0, { guild: 'wonder' }], ['صنف دادرسان', 'purple', 'WWCP', 0, { guild: ['blue'] }],
  ['صنف دانشمندان', 'purple', 'CCWW', 0, { guild: ['green'] }], ['صنف صرافان', 'purple', 'SSWW', 0, { guild: 'coins' }],
  ['صنف فرماندهان', 'purple', 'SSCP', 0, { guild: ['red'] }]
];
export const CARDS: Card[] = [[AGE1, 1], [AGE2, 2], [AGE3, 3], [GUILDS, 3]].flatMap(([rows, age]) => (rows as Row[]).map((r) => ({ age: age as 1 | 2 | 3, name: r[0], color: r[1], cost: r[2], coins: r[3], ...r[4] })))
  .map((c, id) => ({ ...c, id }) as Card);
export const PER_COINS: Record<string, number> = { grey: 3, brown: 2, red: 1, yellow: 1, wonder: 2 };

export interface Wonder { id: number; name: string; cost: string; vp: number; coins?: number; steal?: number; shields?: number; replay?: boolean; choice?: string; destroy?: 'brown' | 'grey'; mausoleum?: boolean; library?: boolean }
export const WONDERS: Wonder[] = ([
  ['جادهٔ شاهی', 'SSCCP', 3, { coins: 3, steal: 3, replay: true }], ['میدان بزرگ', 'SSWG', 3, { shields: 1, destroy: 'grey' }],
  ['غول مفرغی', 'CCCG', 3, { shields: 2 }], ['کتابخانهٔ بزرگ', 'WWWGP', 4, { library: true }], ['فانوس بزرگ', 'WSPP', 4, { choice: 'WCS' }],
  ['باغ‌های معلق', 'WWGP', 3, { coins: 6, replay: true }], ['آرامگاه', 'CCGGP', 2, { mausoleum: true }], ['بندرگاه', 'WWSC', 2, { choice: 'GP', replay: true }],
  ['هرم‌ها', 'SSSP', 9, {}], ['ابوالهول', 'SCGG', 6, { replay: true }], ['تندیس خدای آسمان', 'SSWCP', 3, { shields: 1, destroy: 'brown' }],
  ['پرستشگاه ماه', 'WSGP', 0, { coins: 12, replay: true }]
] as [string, string, number, Partial<Wonder>][]).map(([name, cost, vp, rest], id) => ({ id, name, cost, vp, ...rest }));

export const PROGRESS = ['agriculture', 'architecture', 'economy', 'law', 'masonry', 'mathematics', 'philosophy', 'strategy', 'theology', 'urbanism'] as const;
export type Progress = (typeof PROGRESS)[number];
export const PROGRESS_FA: Record<Progress, [string, string]> = {
  agriculture: ['کشاورزی', '۶ سکه و ۴ امتیاز'], architecture: ['معماری', 'شگفتی‌ها ۲ منبع ارزان‌تر'], economy: ['اقتصاد', 'پول خرید منابع حریف به شما می‌رسد'],
  law: ['قانون', 'یک نماد علمی'], masonry: ['بنّایی', 'کارت‌های آبی ۲ منبع ارزان‌تر'], mathematics: ['ریاضیات', '۳ امتیاز برای هر نشان'],
  philosophy: ['فلسفه', '۷ امتیاز'], strategy: ['راهبرد', 'کارت‌های قرمز تازه یک سپر بیشتر'], theology: ['الهیات', 'همهٔ شگفتی‌ها نوبت دوباره'],
  urbanism: ['شهرسازی', '۶ سکه و ۴ سکه برای هر ساخت زنجیره‌ای']
};

/** Rows (counts) and which rows are face up, per age. x positions are in half-card units. */
const LAYOUT: Record<1 | 2 | 3, { rows: number[]; up: boolean[]; xs?: number[][] }> = {
  1: { rows: [2, 3, 4, 5, 6], up: [true, false, true, false, true] },
  2: { rows: [6, 5, 4, 3, 2], up: [true, false, true, false, true] },
  3: { rows: [2, 3, 4, 2, 4, 3, 2], up: [true, false, true, false, true, false, true], xs: [[2, 4], [1, 3, 5], [0, 2, 4, 6], [1, 5], [0, 2, 4, 6], [1, 3, 5], [2, 4]] }
};
export interface Slot { card: number; row: number; x: number; up: boolean; taken: boolean }
export type Choice =
  | { kind: 'progress'; seat: number; options: Progress[] }
  | { kind: 'library'; seat: number; options: Progress[] }
  | { kind: 'destroy'; seat: number; options: number[] }
  | { kind: 'mausoleum'; seat: number; options: number[] };

export interface DuelState {
  phase: 'draft' | 'play' | 'choose';
  draftPool: number[];
  draftLater: number[];
  draftPick: number;
  first: number;
  wonders: { id: number; built: boolean }[][];
  age: 1 | 2 | 3;
  structure: Slot[];
  cities: number[][];
  coins: number[];
  military: number;
  milTokens: boolean[][];
  progressBoard: Progress[];
  progressOut: Progress[];
  progress: Progress[][];
  discard: number[];
  current: number;
  choice: Choice | null;
  replay: boolean;
  lastActor: number;
  last: { seat: number; kind: string; card?: number; wonder?: number; coins?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type SlotView = Omit<Slot, 'card'> & { card: number | null; back: 1 | 2 | 3 | 'guild' };
export type DuelView = Omit<DuelState, 'structure' | 'progressOut' | 'choice' | 'timeouts' | 'draftLater'> & {
  structure: SlotView[]; choice: Choice | { kind: Choice['kind']; seat: number; options: null } | null; accessible: number[];
};

const DRAFT_ORDER = [0, 1, 1, 0, 1, 0, 0, 1];

export const duelAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('draftWonder'), wonder: z.number().int().min(0).max(11) }),
  z.strictObject({ type: z.literal('build'), slot: z.number().int().min(0).max(19) }),
  z.strictObject({ type: z.literal('discard'), slot: z.number().int().min(0).max(19) }),
  z.strictObject({ type: z.literal('wonder'), slot: z.number().int().min(0).max(19), wonder: z.number().int().min(0).max(11) }),
  z.strictObject({ type: z.literal('progress'), token: z.enum(PROGRESS) }),
  z.strictObject({ type: z.literal('destroy'), card: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('mausoleum'), card: z.number().int().min(0).max(80) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type DuelAction = z.infer<typeof duelAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export function layout(age: 1 | 2 | 3, cards: number[]): Slot[] {
  const L = LAYOUT[age];
  const max = Math.max(...L.rows);
  const out: Slot[] = [];
  let k = 0;
  L.rows.forEach((n, row) => {
    const xs = L.xs?.[row] ?? Array.from({ length: n }, (_, i) => max - n + 2 * i);
    xs.forEach((x) => out.push({ card: cards[k++]!, row, x, up: L.up[row]!, taken: false }));
  });
  return out;
}
/** A slot is accessible when no untaken card in the next row overlaps it. */
export const covered = (st: Slot[], i: number) => st.some((o) => !o.taken && o.row === st[i]!.row + 1 && Math.abs(o.x - st[i]!.x) === 1);
export const accessible = (st: Slot[]) => st.map((_, i) => i).filter((i) => !st[i]!.taken && !covered(st, i));

function dealAge(s: DuelState, rng: EngineRng) {
  let cards = shuffle(rng, CARDS.filter((c) => c.age === s.age && c.color !== 'purple').map((c) => c.id)).slice(3);
  if (s.age === 3) cards = shuffle(rng, [...cards, ...shuffle(rng, CARDS.filter((c) => c.color === 'purple').map((c) => c.id)).slice(0, 3)]);
  s.structure = layout(s.age, cards);
}

// ---------- economy ----------

const count = (str: string, r: string) => [...str].filter((x) => x === r).length;
export const cityCards = (s: DuelState, seat: number) => s.cities[seat]!.map((id) => CARDS[id]!);
const has = (s: DuelState, seat: number, p: Progress) => s.progress[seat]!.includes(p);
export function price(s: DuelState, seat: number, r: Res) {
  const mine = cityCards(s, seat);
  if (mine.some((c) => c.trade?.includes(r))) return 1;
  return 2 + cityCards(s, 1 - seat).filter((c) => c.color === 'brown' || c.color === 'grey').reduce((n, c) => n + count(c.prod ?? '', r), 0);
}
/** Coins needed to buy missing resources for a cost string (after own production, choices and reductions). */
export function tradeCost(s: DuelState, seat: number, cost: string, reduce: number) {
  const mine = cityCards(s, seat);
  const fixed = Object.fromEntries(RES.map((r) => [r, mine.reduce((n, c) => n + count(c.prod ?? '', r), 0)]));
  const missing: Res[] = [];
  for (const r of RES) for (let k = count(cost, r) - fixed[r]!; k > 0; k--) missing.push(r);
  const choices = [...mine.filter((c) => c.choice).map((c) => c.choice!), ...s.wonders[seat]!.filter((w) => w.built && WONDERS[w.id]!.choice).map((w) => WONDERS[w.id]!.choice!)];
  const prices = Object.fromEntries(RES.map((r) => [r, price(s, seat, r)])) as Record<Res, number>;
  let best = Infinity;
  const go = (i: number, left: Res[]) => {
    if (i === choices.length) {
      const ps = left.map((r) => prices[r]).sort((a, b) => b - a).slice(reduce);
      best = Math.min(best, ps.reduce((a, b) => a + b, 0));
      return;
    }
    go(i + 1, left);
    for (const r of new Set(choices[i]!)) { const j = left.indexOf(r as Res); if (j >= 0) go(i + 1, [...left.slice(0, j), ...left.slice(j + 1)]); }
  };
  go(0, missing);
  return best;
}
/** Total coins to build a card (0 when chained), or null if unaffordable. */
export function cardPrice(s: DuelState, seat: number, id: number): { total: number; trade: number; chained: boolean } | null {
  const c = CARDS[id]!;
  if (c.from && cityCards(s, seat).some((x) => x.chain === c.from)) return { total: 0, trade: 0, chained: true };
  const trade = tradeCost(s, seat, c.cost, c.color === 'blue' && has(s, seat, 'masonry') ? 2 : 0);
  const total = c.coins + trade;
  return total <= s.coins[seat]! ? { total, trade, chained: false } : null;
}
export function wonderPrice(s: DuelState, seat: number, w: number) {
  const trade = tradeCost(s, seat, WONDERS[w]!.cost, has(s, seat, 'architecture') ? 2 : 0);
  return trade <= s.coins[seat]! ? trade : null;
}
export const discardValue = (s: DuelState, seat: number) => 2 + cityCards(s, seat).filter((c) => c.color === 'yellow').length;
const builtWonders = (s: DuelState) => s.wonders.flat().filter((w) => w.built).length;

// ---------- scoring ----------

export function symbols(s: DuelState, seat: number) {
  const out = cityCards(s, seat).filter((c) => c.sci).map((c) => c.sci!);
  if (has(s, seat, 'law')) out.push('law');
  return out;
}
const mostOf = (s: DuelState, colors: Color[]) => Math.max(...[0, 1].map((k) => cityCards(s, k).filter((c) => colors.includes(c.color)).length));
export function scoreBreakdown(s: DuelState, seat: number) {
  const cards = cityCards(s, seat);
  const sum = (col: Color) => cards.filter((c) => c.color === col).reduce((n, c) => n + (c.vp ?? 0), 0);
  const guilds = cards.filter((c) => c.guild).reduce((n, c) => n + (c.guild === 'wonder' ? 2 * Math.max(...[0, 1].map((k) => s.wonders[k]!.filter((w) => w.built).length))
    : c.guild === 'coins' ? Math.floor(Math.max(...s.coins) / 3) : mostOf(s, c.guild as Color[])), 0);
  const wonders = s.wonders[seat]!.filter((w) => w.built).reduce((n, w) => n + WONDERS[w.id]!.vp, 0);
  const prog = s.progress[seat]!;
  const progress = (prog.includes('agriculture') ? 4 : 0) + (prog.includes('philosophy') ? 7 : 0) + (prog.includes('mathematics') ? 3 * prog.length : 0);
  const lead = seat === 0 ? s.military : -s.military;
  const military = lead >= 6 ? 10 : lead >= 3 ? 5 : lead >= 1 ? 2 : 0;
  const parts = { blue: sum('blue'), green: sum('green'), yellow: sum('yellow'), guilds, wonders, progress, military, coins: Math.floor(s.coins[seat]! / 3) };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
}

// ---------- module ----------

type Events = Transition<DuelState>['internalEvents'];
const finish = (s: DuelState, events: Events): Transition<DuelState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const winBy = (s: DuelState, seat: number) => { s.outcome = { placements: [{ seat, place: 1 }, { seat: 1 - seat, place: 2 }], reason: 'win' }; };

function moveMilitary(s: DuelState, seat: number, n: number) {
  s.military = Math.max(-9, Math.min(9, s.military + (seat === 0 ? n : -n)));
  const opp = 1 - seat;
  const lead = seat === 0 ? s.military : -s.military;
  const toks = s.milTokens[opp]!;
  if (lead >= 3 && !toks[0]) { toks[0] = true; s.coins[opp] = Math.max(0, s.coins[opp]! - 2); }
  if (lead >= 6 && !toks[1]) { toks[1] = true; s.coins[opp] = Math.max(0, s.coins[opp]! - 5); }
  if (lead >= 9) winBy(s, seat);
}
function checkScience(s: DuelState, seat: number) {
  if (new Set(symbols(s, seat)).size >= 6) winBy(s, seat);
}
function takeProgress(s: DuelState, seat: number, p: Progress) {
  s.progress[seat]!.push(p);
  if (p === 'agriculture' || p === 'urbanism') s.coins[seat]! += 6;
  if (p === 'law') checkScience(s, seat);
}

/** Ends the action: resolve age end / next player unless a choice is open or the game is over. */
function advance(s: DuelState, seat: number, ctx: { rng: EngineRng }) {
  if (s.outcome || s.choice) return;
  s.lastActor = seat;
  if (s.structure.every((x) => x.taken)) {
    if (s.age === 3) {
      const a = scoreBreakdown(s, 0), b = scoreBreakdown(s, 1);
      const key = (x: typeof a) => x.total * 100 + x.blue;
      s.outcome = key(a) === key(b)
        ? { placements: [{ seat: 0, place: 1, score: a.total }, { seat: 1, place: 1, score: b.total }], reason: 'draw' }
        : { placements: [[0, a], [1, b]].sort((x, y) => key(y[1] as typeof a) - key(x[1] as typeof a)).map(([k, x], i) => ({ seat: k as number, place: i + 1, score: (x as typeof a).total })), reason: 'score' };
      return;
    }
    s.age = (s.age + 1) as 2 | 3;
    dealAge(s, ctx.rng);
    s.current = s.military > 0 ? 1 : s.military < 0 ? 0 : 1 - seat;
    s.replay = false;
    return;
  }
  s.current = s.replay ? seat : 1 - seat;
  s.replay = false;
}

function reveal(s: DuelState) {
  s.structure.forEach((x, i) => { if (!x.taken && !x.up && !covered(s.structure, i)) x.up = true; });
}

export const duelModule: GameModule<DuelState, DuelAction, DuelView> = {
  manifest: wondersDuel.manifest,
  actionSchema: duelAction,

  setup({ rng, options }) {
    const wonders = shuffle(rng, WONDERS.map((w) => w.id)).slice(0, 8);
    const prog = shuffle(rng, [...PROGRESS]);
    const first = rng.nextInt(2);
    const s: DuelState = {
      phase: 'draft', draftPool: wonders.slice(0, 4), draftLater: wonders.slice(4), draftPick: 0, first, wonders: [[], []], age: 1, structure: [],
      cities: [[], []], coins: [7, 7], military: 0, milTokens: [[false, false], [false, false]], progressBoard: prog.slice(0, 5), progressOut: prog.slice(5),
      progress: [[], []], discard: [], current: first, choice: null, replay: false, lastActor: first, last: null, seq: 0, timeouts: [0, 0], outcome: null
    };
    dealAge(s, rng);
    if (options.deal === 'tutorial') {
      const id = (n: string) => CARDS.find((c) => c.name === n)!.id;
      Object.assign(s, {
        phase: 'play', draftPool: [], draftLater: [], first: 0, current: 0, age: 3, coins: [20, 6], military: 6, milTokens: [[false, false], [true, true]],
        wonders: [[{ id: 8, built: true }, { id: 2, built: false }], [{ id: 9, built: true }, { id: 5, built: false }]],
        cities: [[id('اتاق مطالعه'), id('چوب‌بری')], [id('معدن سنگ'), id('محراب')]],
        progressBoard: ['strategy', 'philosophy', 'agriculture', 'economy', 'law'], progressOut: ['masonry', 'theology', 'urbanism', 'architecture', 'mathematics'],
        structure: [id('آکادمی'), id('میدان نمایش'), id('ستون یادبود')].map((card, i) => ({ card, row: 0, x: i * 2, up: true, taken: false }))
      });
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat > 1) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    if (a.type === 'resign') return { ok: true };
    if (s.phase === 'draft') {
      if (a.type !== 'draftWonder') return { ok: false, errorCode: 'DRAFTING' };
      if (DRAFT_ORDER[s.draftPick]! !== (seat === s.first ? 0 : 1)) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
      return s.draftPool.includes(a.wonder) ? { ok: true } : { ok: false, errorCode: 'NOT_OFFERED' };
    }
    if (s.phase === 'choose') {
      const c = s.choice!;
      if (c.seat !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
      if (a.type === 'progress') return (c.kind === 'progress' || c.kind === 'library') && c.options.includes(a.token) ? { ok: true } : { ok: false, errorCode: 'NOT_OFFERED' };
      if (a.type === 'destroy' || a.type === 'mausoleum') return c.kind === a.type && (c.options as number[]).includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_OFFERED' };
      return { ok: false, errorCode: 'CHOOSE_FIRST' };
    }
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type !== 'build' && a.type !== 'discard' && a.type !== 'wonder') return { ok: false, errorCode: 'BAD_ACTION' };
    if (!accessible(s.structure).includes(a.slot)) return { ok: false, errorCode: 'NOT_ACCESSIBLE' };
    if (a.type === 'build') return cardPrice(s, seat, s.structure[a.slot]!.card) ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
    if (a.type === 'wonder') {
      const w = s.wonders[seat]!.find((x) => x.id === a.wonder);
      if (!w || w.built) return { ok: false, errorCode: 'NO_SUCH_WONDER' };
      if (builtWonders(s) >= 7) return { ok: false, errorCode: 'SEVEN_WONDERS' };
      return wonderPrice(s, seat, a.wonder) !== null ? { ok: true } : { ok: false, errorCode: 'CANNOT_AFFORD' };
    }
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const opp = 1 - seat;
    s.seq += 1;
    if (a.type === 'resign') { winBy(s, opp); s.outcome!.reason = 'resign'; return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    const pay = (seat: number, total: number, trade: number) => { s.coins[seat]! -= total; if (has(s, 1 - seat, 'economy')) s.coins[1 - seat]! += trade; };

    if (a.type === 'draftWonder') {
      s.wonders[seat]!.push({ id: a.wonder, built: false });
      s.draftPool = s.draftPool.filter((w) => w !== a.wonder);
      s.draftPick += 1;
      if (s.draftPick === 3) { s.wonders[DRAFT_ORDER[3] === 0 ? s.first : 1 - s.first]!.push({ id: s.draftPool[0]!, built: false }); s.draftPool = s.draftLater; s.draftLater = []; s.draftPick = 4; }
      else if (s.draftPick === 7) { s.wonders[DRAFT_ORDER[7] === 0 ? s.first : 1 - s.first]!.push({ id: s.draftPool[0]!, built: false }); s.draftPool = []; s.draftPick = 8; s.phase = 'play'; s.current = s.first; }
      s.last = { seat, kind: 'draft', wonder: a.wonder };
      return finish(s, [{ type: 'draft', seat }]);
    }

    if (a.type === 'progress') {
      const c = s.choice!;
      if (c.kind === 'library') s.progressOut = s.progressOut.filter((p) => p !== a.token); else s.progressBoard = s.progressBoard.filter((p) => p !== a.token);
      s.choice = null; s.phase = 'play';
      takeProgress(s, seat, a.token);
      s.last = { seat, kind: 'progress' };
    } else if (a.type === 'destroy') {
      s.cities[opp] = s.cities[opp]!.filter((id) => id !== a.card);
      s.discard.push(a.card);
      s.choice = null; s.phase = 'play';
      s.last = { seat, kind: 'destroy', card: a.card };
    } else if (a.type === 'mausoleum') {
      s.discard = s.discard.filter((id) => id !== a.card);
      s.choice = null; s.phase = 'play';
      buildCard(s, seat, a.card);
      s.last = { seat, kind: 'mausoleum', card: a.card };
    } else {
      const slot = s.structure[a.slot]!;
      slot.taken = true;
      const id = slot.card;
      if (a.type === 'discard') {
        const v = discardValue(s, seat);
        s.coins[seat]! += v;
        s.discard.push(id);
        s.last = { seat, kind: 'discard', card: id, coins: v };
      } else if (a.type === 'build') {
        const p = cardPrice(s, seat, id)!;
        pay(seat, p.total, p.trade);
        if (p.chained && has(s, seat, 'urbanism')) s.coins[seat]! += 4;
        buildCard(s, seat, id);
        s.last = { seat, kind: 'build', card: id };
      } else {
        const trade = wonderPrice(s, seat, a.wonder)!;
        pay(seat, trade, trade);
        const w = WONDERS[a.wonder]!;
        s.wonders[seat]!.find((x) => x.id === a.wonder)!.built = true;
        if (builtWonders(s) >= 7) s.wonders.forEach((ws) => ws.splice(0, ws.length, ...ws.filter((x) => x.built)));
        if (w.coins) s.coins[seat]! += w.coins;
        if (w.steal) s.coins[opp] = Math.max(0, s.coins[opp]! - w.steal);
        if (w.shields) moveMilitary(s, seat, w.shields);
        if (w.replay || has(s, seat, 'theology')) s.replay = true;
        const destroyable = w.destroy ? s.cities[opp]!.filter((c) => CARDS[c]!.color === w.destroy) : [];
        if (!s.outcome && destroyable.length) s.choice = { kind: 'destroy', seat, options: destroyable };
        if (!s.outcome && w.mausoleum && s.discard.length) s.choice = { kind: 'mausoleum', seat, options: [...s.discard] };
        if (!s.outcome && w.library && s.progressOut.length) s.choice = { kind: 'library', seat, options: shuffle(ctx.rng, s.progressOut).slice(0, 3) };
        s.last = { seat, kind: 'wonder', card: id, wonder: a.wonder };
      }
      reveal(s);
    }
    if (s.choice) s.phase = 'choose';
    advance(s, seat, ctx);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer) {
    const { progressOut: _p, timeouts: _t, draftLater: _d, structure, choice, ...rest } = structuredClone(s);
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      ...rest,
      structure: structure.map((x) => ({ ...x, card: x.up || x.taken ? x.card : null, back: CARDS[x.card]!.color === 'purple' ? 'guild' as const : CARDS[x.card]!.age })),
      choice: choice && choice.kind === 'library' && choice.seat !== me ? { kind: 'library', seat: choice.seat, options: null } : choice,
      accessible: s.phase === 'play' ? accessible(s.structure) : []
    };
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'draft' && DRAFT_ORDER[s.draftPick] === (seat === s.first ? 0 : 1)) s.draftPool.forEach((w) => out.push({ type: 'draftWonder', wonder: w }));
    if (s.phase === 'choose' && s.choice!.seat === seat) {
      const c = s.choice!;
      if (c.kind === 'progress' || c.kind === 'library') c.options.forEach((t) => out.push({ type: 'progress', token: t }));
      else (c.options as number[]).forEach((card) => out.push({ type: c.kind, card }));
    }
    if (s.phase === 'play' && s.current === seat) {
      for (const slot of accessible(s.structure)) {
        const p = cardPrice(s, seat, s.structure[slot]!.card);
        if (p) out.push({ type: 'build', slot, cost: p.total });
        out.push({ type: 'discard', slot, coins: discardValue(s, seat) });
        if (builtWonders(s) < 7) for (const w of s.wonders[seat]!) if (!w.built) { const c = wonderPrice(s, seat, w.id); if (c !== null) out.push({ type: 'wonder', slot, wonder: w.id, cost: c }); }
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = duelModule.pendingSeats(s)[0]!;
    const missed = s.timeouts[seat]! + 1;
    const hint = duelModule.legalActions(s, { kind: 'player', seat }).find((h) => h.type !== 'resign' && h.type !== 'build' && h.type !== 'wonder')!;
    const { cost: _c, coins: _k, ...action } = hint;
    const t = duelModule.apply(s, { kind: 'player', seat }, action as DuelAction, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'draft' ? [DRAFT_ORDER[s.draftPick] === 0 ? s.first : 1 - s.first] : s.phase === 'choose' ? [s.choice!.seat] : [s.current]),

  tutorial: {
    seed: 21,
    options: { deal: 'tutorial' },
    introFa: 'دوران سوم است و مهرهٔ جنگ شش خانه به سمت حریف رفته. یک نماد ساعت آفتابی دارید؛ آکادمی هم همین نماد را دارد.',
    steps: [
      { instructionFa: 'آکادمی را بسازید (منابع کم را با سکه می‌خرید): جفت نماد علمی یعنی یک نشان پیشرفت.', expected: { type: 'build', slot: 0 }, reply: null },
      { instructionFa: 'نشان «راهبرد» را بگیرید: کارت‌های قرمز بعدی یک سپر بیشتر می‌دهند.', expected: { type: 'progress', token: 'strategy' }, reply: { type: 'discard', slot: 2 } },
      { instructionFa: 'میدان نمایش را بسازید: ۲ سپر + ۱ راهبرد مهره را به پایتخت حریف می‌رساند.', expected: { type: 'build', slot: 1 }, reply: null }
    ],
    completedFa: 'پیروزی نظامی! مهرهٔ جنگ به پایتخت حریف رسید.'
  }
};

function buildCard(s: DuelState, seat: number, id: number) {
  const c = CARDS[id]!;
  s.cities[seat]!.push(id);
  if (c.gain) s.coins[seat]! += c.gain;
  if (c.per) s.coins[seat]! += PER_COINS[c.per]! * (c.per === 'wonder' ? s.wonders[seat]!.filter((w) => w.built).length : cityCards(s, seat).filter((x) => x.color === c.per).length);
  if (Array.isArray(c.guild)) s.coins[seat]! += mostOf(s, c.guild);
  if (c.shields) moveMilitary(s, seat, c.shields + (c.color === 'red' && has(s, seat, 'strategy') ? 1 : 0));
  if (s.outcome) return;
  if (c.sci) {
    checkScience(s, seat);
    if (!s.outcome && symbols(s, seat).filter((x) => x === c.sci).length === 2 && s.progressBoard.length) s.choice = { kind: 'progress', seat, options: [...s.progressBoard] };
  }
}
