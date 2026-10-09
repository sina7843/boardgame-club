// Terraforming Mars engine core: the effect context, global parameters, tile placement, triggers, card legality and
// payment, standard projects, milestones/awards and scoring. Turn/phase flow lives in rules.ts.
import type { EngineRng } from '@bg/game-sdk';
import {
  OCEANS_MAX, OXY_MAX, RES, TEMP_MAX, type Amounts, type Answer, type CardDef, type CardRes, type Ctx, type Param,
  type PlayerState, type Prompt, type PromptInput, type Res, type Tag, type Then, type TileKind, type TileRule, type TmState
} from './api.ts';
import { ADJ, MARS, NOCTIS, SPACE, VOLCANIC } from './board.ts';
import { CARD } from './content/index.ts';

/** Runtime of one engine step: RNG and the prompts created during it (prepended to the queue at the end). */
export interface Rt { rng: EngineRng; buf: Prompt[] }
export const noRng: EngineRng = { nextInt: () => 0 };

export function def(id: string): CardDef {
  const c = CARD[id];
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}
export const minProd = (r: Res) => (r === 'mc' ? -5 : 0);

export function tableau(s: TmState, seat: number, events = false): string[] {
  const p = s.players[seat]!;
  return [...(p.corp ? [p.corp] : []), ...p.played.filter((id) => events || def(id).kind !== 'event')];
}
export function ownerOf(s: TmState, card: string): number {
  return s.players.findIndex((p) => p.corp === card || p.played.includes(card));
}
export const tagsOf = (s: TmState, seat: number, tag: Tag) =>
  tableau(s, seat).reduce((n, id) => n + def(id).tags.filter((t) => t === tag).length, 0);
export function citiesOf(s: TmState, opts: { seat?: number; onMars?: boolean } = {}) {
  return Object.entries(s.tiles).filter(([id, t]) => t.kind === 'city' && (opts.seat === undefined || t.owner === opts.seat)
    && (!opts.onMars || !SPACE[id]!.offMap)).length;
}
export const greeneriesOf = (s: TmState, seat?: number) =>
  Object.values(s.tiles).filter((t) => t.kind === 'greenery' && (seat === undefined || t.owner === seat)).length;

export function shuffle<T>(rng: EngineRng, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export function drawCards(s: TmState, rng: EngineRng, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    if (!s.deck.length) { if (!s.discard.length) break; s.deck = shuffle(rng, s.discard); s.discard = []; }
    out.push(s.deck.shift()!);
  }
  return out;
}

// ---------------- Effect context ----------------
export class G implements Ctx {
  readonly s: TmState; readonly seat: number; readonly self: string; readonly rt: Rt;
  constructor(s: TmState, seat: number, self: string, rt: Rt) { this.s = s; this.seat = seat; this.self = self; this.rt = rt; }
  get p(): PlayerState { return this.s.players[this.seat]!; }
  card(id: string) { return def(id); }
  gain(res: Res, n: number) { this.p.res[res] = Math.max(0, this.p.res[res] + n); }
  canPay(n: number) { return maxPay(this.s, this.seat, {}) >= n; }
  pay(n: number) { const pay = autoPay(this.s, this.seat, n, {}); if (pay) doPay(this.s, this.seat, pay); }
  prod(res: Res, n: number) { this.prodOf(this.seat, res, n); }
  prodOf(seat: number, res: Res, n: number) { const p = this.s.players[seat]!; p.prod[res] = Math.max(minProd(res), p.prod[res] + n); }
  tr(n: number) { if (n > 0) this.p.trRaised = true; this.p.tr = Math.max(0, this.p.tr + n); }
  raise(param: Param, steps: number) { return raise(this, param, steps); }
  tile(kind: TileKind, rule?: TileRule, then?: Then) {
    this.prompt({ kind: 'space', tile: kind, rule: rule ?? defaultRule(kind), ...(CARD[this.self] && def(this.self).kind !== 'corporation' ? { card: this.self } : {}), ...(then ? { then } : {}) });
  }
  ocean(n = 1) { for (let i = 0; i < n; i++) this.tile('ocean'); }
  draw(n: number) { const c = drawCards(this.s, this.rt.rng, n); this.p.hand.push(...c); return c; }
  look(n: number) { return drawCards(this.s, this.rt.rng, n); }
  discardCards(ids: string[]) { this.s.discard.push(...ids); }
  tileOf(card = this.self) { return Object.entries(this.s.tiles).find(([, t]) => t.card === card)?.[0] ?? null; }
  adjacent(space: string) { return ADJ[space] ?? []; }
  tileAt(space: string) { return this.s.tiles[space] ?? null; }
  space(id: string) { return SPACE[id]!; }
  claim() { this.prompt({ kind: 'space', tile: 'special', rule: 'land', claim: true, labelFa: 'ناحیه‌ای برای نشانهٔ ادعای زمین' }); }
  copyProduction(card: string) {
    const c = def(card);
    const g = new G(this.s, this.seat, card, this.rt);
    for (const r of RES) if (c.prod?.[r]) g.prod(r, c.prod[r]!);
    // The red-bordered "decrease any X production" is part of the production box (Heat Trappers, Biomass Combustors).
    if (c.anyProd) g.reduceAnyProd(c.anyProd.res, c.anyProd.n);
    c.prodBox?.(g);
  }
  reveal() {
    const [c] = drawCards(this.s, this.rt.rng, 1);
    if (!c) return null;
    this.s.discard.push(c); this.s.revealed = c;
    return c;
  }
  addRes(n: number, card = this.self) {
    const o = ownerOf(this.s, card);
    const p = this.s.players[o < 0 ? this.seat : o]!;
    p.cardRes[card] = Math.max(0, (p.cardRes[card] ?? 0) + n);
  }
  resOn(card = this.self) { const o = ownerOf(this.s, card); return o < 0 ? 0 : this.s.players[o]!.cardRes[card] ?? 0; }
  tags(tag: Tag, seat = this.seat) { return tagsOf(this.s, seat, tag); }
  cities(opts: { seat?: number; onMars?: boolean } = {}) { return citiesOf(this.s, opts); }
  greeneries(seat?: number) { return greeneriesOf(this.s, seat); }
  tableau(seat = this.seat, events = false) { return tableau(this.s, seat, events); }
  eventsPlayed() { return this.s.players.reduce((n, p) => n + p.played.filter((id) => def(id).kind === 'event').length, 0); }
  isProtected(seat: number) { return seat !== this.seat && tableau(this.s, seat).some((id) => def(id).protects); }
  prompt(p: PromptInput) { this.rt.buf.push({ ...p, seat: p.seat ?? this.seat } as Prompt); }
  removeAny(res: Res, n: number, steal = false) {
    const options = this.s.players.map((_, k) => k).filter((k) => k !== this.seat && this.s.players[k]!.res[res] > 0 && !(res === 'plants' && this.isProtected(k)));
    if (options.length) this.prompt({ kind: 'player', options, optional: true, then: { card: null, key: 'removeRes' }, data: { res, n, steal }, labelFa: `${steal ? 'دزدیدن' : 'برداشتن'} تا ${n} ${RES_FA[res]} از یک بازیکن` });
  }
  reduceAnyProd(res: Res, n: number) {
    const options = this.s.players.map((_, k) => k).filter((k) => this.s.players[k]!.prod[res] - n >= minProd(res));
    if (options.length) this.prompt({ kind: 'player', options, then: { card: null, key: 'reduceProd' }, data: { res, n }, labelFa: `کاهش ${n} پلهٔ تولید ${RES_FA[res]} یک بازیکن` });
  }
  canReduceAnyProd(res: Res, n: number) { return this.s.players.some((p) => p.prod[res] - n >= minProd(res)); }
  cardsWith(type: CardRes, opts: { other?: boolean; min?: number; seat?: number } = {}) {
    const seat = opts.seat ?? this.seat;
    return tableau(this.s, seat).filter((id) => def(id).resource === type && (!opts.other || id !== this.self)
      && (this.s.players[seat]!.cardRes[id] ?? 0) >= (opts.min ?? 0));
  }
  addToCard(type: CardRes, n: number, other = false) {
    const options = this.cardsWith(type, { other });
    if (options.length) this.prompt({ kind: 'card', options, then: { card: null, key: 'addRes' }, data: { n }, labelFa: `افزودن ${n} ${CARDRES_FA[type]} به یک کارت` });
  }
  choose(labelsFa: string[], key: string, data?: Record<string, unknown>) {
    this.prompt({ kind: 'choice', options: labelsFa, then: { card: this.self, key }, ...(data ? { data } : {}) });
  }
}

export const RES_FA: Record<Res, string> = { mc: 'مگاکردیت', steel: 'فولاد', titanium: 'تیتانیوم', plants: 'گیاه', energy: 'انرژی', heat: 'گرما' };
export const CARDRES_FA: Record<CardRes, string> = { microbe: 'میکروب', animal: 'جانور', science: 'منبع علمی', fighter: 'جنگنده' };
const defaultRule = (k: TileKind): TileRule => (k === 'special' ? 'land' : k);

// ---------------- Global parameters ----------------
function raise(g: G, param: Param, steps: number): number {
  const s = g.s;
  let done = 0;
  for (let i = 0; i < steps; i++) {
    if (param === 'temperature') {
      if (s.temperature >= TEMP_MAX) break;
      s.temperature += 2; done++; g.tr(1);
      if (s.temperature === -24 || s.temperature === -20) g.prod('heat', 1);
      if (s.temperature === 0) g.ocean();
    } else {
      if (s.oxygen >= OXY_MAX) break;
      s.oxygen += 1; done++; g.tr(1);
      if (s.oxygen === 8) raise(g, 'temperature', 1);
    }
  }
  return done;
}
export const terraformed = (s: TmState) => s.temperature >= TEMP_MAX && s.oxygen >= OXY_MAX && s.oceans >= OCEANS_MAX;

// ---------------- Tiles ----------------
export function legalSpaces(s: TmState, seat: number, rule: TileRule): string[] {
  const free = (id: string) => !s.tiles[id] && (s.claims[id] === undefined || s.claims[id] === seat);
  const land = MARS.filter((sp) => !sp.ocean && sp.id !== NOCTIS && free(sp.id));
  const adjKind = (id: string, k: TileKind) => ADJ[id]!.filter((a) => s.tiles[a]?.kind === k).length;
  const ownAdj = (id: string) => ADJ[id]!.some((a) => s.tiles[a]?.owner === seat);
  const isolated = (id: string) => ADJ[id]!.every((a) => !s.tiles[a]);
  const steelTi = (id: string) => SPACE[id]!.bonus.some((b) => b === 'steel' || b === 'titanium');
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
  switch (rule) {
    case 'ocean': case 'oceanArea': return ids(MARS.filter((sp) => sp.ocean && free(sp.id)));
    case 'greenery': { const own = land.filter((sp) => ownAdj(sp.id)); return ids(own.length ? own : land); }
    case 'city': return ids(land.filter((sp) => !adjKind(sp.id, 'city')));
    case 'land': case 'landOcean': return ids(land);
    case 'isolated': case 'isolatedCity': return ids(land.filter((sp) => isolated(sp.id)));
    case 'volcanic': return [...VOLCANIC].filter(free);
    case 'noctis': return s.tiles[NOCTIS] ? [] : [NOCTIS];
    case 'nextToCity': return ids(land.filter((sp) => adjKind(sp.id, 'city') > 0));
    case 'twoCities': return ids(land.filter((sp) => adjKind(sp.id, 'city') >= 2));
    case 'nextToGreenery': return ids(land.filter((sp) => adjKind(sp.id, 'greenery') > 0));
    case 'steelTi': return ids(land.filter((sp) => steelTi(sp.id)));
    case 'steelTiOwnAdj': return ids(land.filter((sp) => steelTi(sp.id) && ownAdj(sp.id)));
    case 'phobos': return s.tiles['02'] ? [] : ['02'];
    case 'ganymede': return s.tiles['01'] ? [] : ['01'];
  }
}

export function placeTile(g: G, id: string, kind: TileKind, card?: string) {
  const s = g.s;
  const sp = SPACE[id]!;
  s.tiles[id] = { kind, owner: kind === 'ocean' ? null : g.seat, ...(card ? { card } : {}) };
  delete s.claims[id];
  const bonus: Amounts = {};
  if (!sp.offMap) {
    for (const b of sp.bonus) {
      if (b === 'card') g.draw(1);
      else { g.gain(b, 1); bonus[b] = (bonus[b] ?? 0) + 1; }
    }
    const oceans = ADJ[id]!.filter((a) => a !== id && s.tiles[a]?.kind === 'ocean').length;
    if (oceans) { g.gain('mc', 2 * oceans); bonus.mc = 2 * oceans; }
  }
  if (kind === 'ocean' && s.oceans < OCEANS_MAX) { s.oceans += 1; g.tr(1); }
  if (kind === 'greenery') g.raise('oxygen', 1);
  emit(s, g.rt, 'onTilePlaced', { seat: g.seat, kind, space: id, ...(card ? { card } : {}), onMars: !sp.offMap, bonus });
}

// ---------------- Triggers ----------------
type Hook = 'onCardPlayed' | 'onTilePlaced' | 'onStandardProject';
export function emit<H extends Hook>(s: TmState, rt: Rt, hook: H, e: Parameters<NonNullable<CardDef[H]>>[1]) {
  for (let seat = 0; seat < s.players.length; seat++) {
    for (const id of tableau(s, seat)) {
      const f = def(id)[hook] as ((g: Ctx, e: unknown) => void) | undefined;
      if (f) f(new G(s, seat, id, rt), e);
    }
  }
}

// ---------------- Prompts ----------------
const spacesFor = (s: TmState, q: Extract<Prompt, { kind: 'space' }>) =>
  legalSpaces(s, q.seat, q.rule).filter((id) => !q.claim || s.claims[id] === undefined);

/** Options of a prompt (space ids, seats, cards, choice indexes) - empty means it is skipped. */
export function promptOptions(s: TmState, q: Prompt): (string | number)[] {
  switch (q.kind) {
    case 'space': return q.tile === 'ocean' && s.oceans >= OCEANS_MAX ? [] : spacesFor(s, q);
    case 'player': case 'card': return q.options;
    case 'choice': return q.options.map((_, i) => i);
    case 'cards': return q.cards;
    case 'amount': return q.max >= q.min ? [q.min] : [];
  }
}

export function answerError(s: TmState, q: Prompt, a: Answer): string | null {
  if (a.skip) return q.optional ? null : 'NOT_OPTIONAL';
  switch (q.kind) {
    case 'space': return a.space && spacesFor(s, q).includes(a.space) ? null : 'BAD_SPACE';
    case 'player': return a.seat !== undefined && q.options.includes(a.seat) ? null : 'BAD_TARGET';
    case 'card': return a.card && q.options.includes(a.card) ? null : 'BAD_TARGET';
    case 'choice': return a.index !== undefined && a.index >= 0 && a.index < q.options.length ? null : 'BAD_CHOICE';
    case 'cards': {
      const c = a.cards ?? [];
      return new Set(c).size === c.length && c.length >= q.min && c.length <= q.max && c.every((x) => q.cards.includes(x)) ? null : 'BAD_CARDS';
    }
    case 'amount': return a.amount !== undefined && Number.isInteger(a.amount) && a.amount >= q.min && a.amount <= q.max ? null : 'BAD_AMOUNT';
  }
}

/** Deterministic default answer (timeouts): first option, minimum selection, or skip. */
export function autoAnswer(s: TmState, q: Prompt): Answer {
  if (q.optional) return { skip: true };
  const o = promptOptions(s, q);
  switch (q.kind) {
    case 'space': return { space: o[0] as string };
    case 'player': return { seat: o[0] as number };
    case 'card': return { card: o[0] as string };
    case 'choice': return { index: 0 };
    case 'cards': return { cards: q.cards.slice(0, q.min) };
    case 'amount': return { amount: q.min };
  }
}

const BUILTIN: Record<string, (g: G, a: Answer, d: Record<string, unknown>) => void> = {
  removeRes(g, a, d) {
    const t = g.s.players[a.seat!]!;
    const res = d.res as Res;
    const n = Math.min(d.n as number, t.res[res]);
    t.res[res] -= n;
    if (d.steal) g.gain(res, n);
  },
  reduceProd(g, a, d) { g.prodOf(a.seat!, d.res as Res, -(d.n as number)); },
  addRes(g, a, d) { g.addRes(d.n as number, a.card!); }
};

export function resolvePrompt(s: TmState, rt: Rt, q: Prompt, a: Answer) {
  const self = q.then?.card ?? (q.kind === 'space' ? q.card ?? '' : '');
  const g = new G(s, q.seat, self, rt);
  if (a.skip && !q.onSkip) return;
  if (!a.skip && q.kind === 'space') {
    if (q.claim) s.claims[a.space!] = q.seat;
    else placeTile(g, a.space!, q.tile, q.card);
  }
  if (!q.then) return;
  const f = q.then.card === null ? BUILTIN[q.then.key] : def(q.then.card).resolve?.[q.then.key];
  if (!f) throw new Error(`missing resolver ${q.then.card}:${q.then.key}`);
  f(g, a, q.data ?? {});
}

// ---------------- Requirements, cost, payment ----------------
const within = (v: number, r: { min?: number; max?: number } | undefined, tol: number) =>
  !r || ((r.min === undefined || v >= r.min - tol) && (r.max === undefined || v <= r.max + tol));
export function reqOk(s: TmState, seat: number, c: CardDef): boolean {
  const r = c.req;
  if (!r) return true;
  const p = s.players[seat]!;
  const tol = tableau(s, seat).reduce((n, id) => n + (def(id).reqTolerance ?? 0), 0) + p.nextReqBonus;
  if (!within(s.temperature, r.temperature, 2 * tol) || !within(s.oxygen, r.oxygen, tol) || !within(s.oceans, r.oceans, tol)) return false;
  for (const [t, n] of Object.entries(r.tags ?? {})) if (tagsOf(s, seat, t as Tag) < n) return false;
  for (const [x, n] of Object.entries(r.prod ?? {})) if (p.prod[x as Res] < n) return false;
  if (r.cities !== undefined && citiesOf(s) < r.cities) return false;
  if (r.greeneries !== undefined && greeneriesOf(s, seat) < r.greeneries) return false;
  return true;
}

export const ctxOf = (s: TmState, seat: number, self = '') => new G(s, seat, self, { rng: noRng, buf: [] });

export function cardCost(s: TmState, seat: number, c: CardDef): number {
  const g = ctxOf(s, seat);
  const d = tableau(s, seat).reduce((n, id) => n + (def(id).discount?.(c, g) ?? 0), s.players[seat]!.nextDiscount);
  return Math.max(0, c.cost - d);
}
export function values(s: TmState, seat: number) {
  const t = tableau(s, seat).map(def);
  return { steel: 2 + t.reduce((n, c) => n + (c.steelBonus ?? 0), 0), titanium: 3 + t.reduce((n, c) => n + (c.titaniumBonus ?? 0), 0), heat: t.some((c) => c.heatAsMc) };
}

export interface Pay { mc?: number; steel?: number; titanium?: number; heat?: number }
export interface PayOpts { steel?: boolean; titanium?: boolean; reserve?: Amounts }
const avail = (s: TmState, seat: number, r: Res, reserve?: Amounts) => Math.max(0, s.players[seat]!.res[r] - Math.max(0, reserve?.[r] ?? 0));

export function maxPay(s: TmState, seat: number, o: PayOpts): number {
  const v = values(s, seat);
  return avail(s, seat, 'mc', o.reserve) + (o.steel ? avail(s, seat, 'steel', o.reserve) * v.steel : 0)
    + (o.titanium ? avail(s, seat, 'titanium', o.reserve) * v.titanium : 0) + (v.heat ? avail(s, seat, 'heat', o.reserve) : 0);
}

/** Deterministic default payment: titanium and steel without overpaying, then M€, then heat (Helion), then overpay with steel/titanium. */
export function autoPay(s: TmState, seat: number, cost: number, o: PayOpts): Pay | null {
  const v = values(s, seat);
  const a = (r: Res) => avail(s, seat, r, o.reserve);
  let rem = cost;
  const pay = { mc: 0, steel: 0, titanium: 0, heat: 0 };
  if (o.titanium) { pay.titanium = Math.min(a('titanium'), Math.floor(rem / v.titanium)); rem -= pay.titanium * v.titanium; }
  if (o.steel) { pay.steel = Math.min(a('steel'), Math.floor(rem / v.steel)); rem -= pay.steel * v.steel; }
  pay.mc = Math.min(a('mc'), rem); rem -= pay.mc;
  if (v.heat) { pay.heat = Math.min(a('heat'), rem); rem -= pay.heat; }
  while (rem > 0) {
    if (o.steel && pay.steel < a('steel')) { pay.steel++; rem -= v.steel; } else if (o.titanium && pay.titanium < a('titanium')) { pay.titanium++; rem -= v.titanium; } else return null;
  }
  return pay;
}

export function payError(s: TmState, seat: number, cost: number, o: PayOpts, pay: Pay): string | null {
  const v = values(s, seat);
  const { mc = 0, steel = 0, titanium = 0, heat = 0 } = pay;
  if ([mc, steel, titanium, heat].some((x) => !Number.isInteger(x) || x < 0)) return 'BAD_PAYMENT';
  if ((steel && !o.steel) || (titanium && !o.titanium) || (heat && !v.heat)) return 'BAD_PAYMENT';
  if (mc > avail(s, seat, 'mc', o.reserve) || steel > avail(s, seat, 'steel', o.reserve) || titanium > avail(s, seat, 'titanium', o.reserve) || heat > avail(s, seat, 'heat', o.reserve)) return 'CANNOT_AFFORD';
  if (mc + heat > cost || mc + heat + steel * v.steel + titanium * v.titanium < cost) return 'BAD_PAYMENT';
  return null;
}
export function doPay(s: TmState, seat: number, pay: Pay) {
  const p = s.players[seat]!;
  p.res.mc -= pay.mc ?? 0; p.res.steel -= pay.steel ?? 0; p.res.titanium -= pay.titanium ?? 0; p.res.heat -= pay.heat ?? 0;
}

/** Everything about a card except payment: requirements, mandatory losses and targets. */
export function playError(s: TmState, seat: number, id: string): string | null {
  const p = s.players[seat]!;
  if (!p.hand.includes(id)) return 'NOT_IN_HAND';
  const c = def(id);
  if (!reqOk(s, seat, c)) return 'REQUIREMENTS_NOT_MET';
  for (const r of RES) {
    if ((c.prod?.[r] ?? 0) < 0 && p.prod[r] + c.prod![r]! < minProd(r)) return 'PRODUCTION_TOO_LOW';
    if ((c.gain?.[r] ?? 0) < 0 && p.res[r] + c.gain![r]! < 0) return 'NOT_ENOUGH_RESOURCES';
  }
  const g = ctxOf(s, seat, id);
  // "Decrease any production" is chosen after the card's own production change, so that change counts for the owner.
  if (c.anyProd) {
    const { res, n } = c.anyProd;
    if (!s.players.some((q, k) => q.prod[res] + (k === seat ? c.prod?.[res] ?? 0 : 0) - n >= minProd(res))) return 'NO_TARGET';
  }
  if (c.canPlay && !c.canPlay(g)) return 'CANNOT_PLAY';
  // A card whose land tile cannot be placed may not be played (oceans beyond 9 are simply skipped).
  for (const t of c.tiles ?? []) if (t.kind !== 'ocean' && !legalSpaces(s, seat, t.rule ?? defaultRule(t.kind)).length) return 'NO_SPACE';
  const reserve = Object.fromEntries(RES.map((r) => [r, -(c.gain?.[r] ?? 0)])) as Amounts;
  if (maxPay(s, seat, { steel: c.tags.includes('building'), titanium: c.tags.includes('space'), reserve }) < cardCost(s, seat, c)) return 'CANNOT_AFFORD';
  return null;
}
export const payOptsFor = (c: CardDef): PayOpts => ({
  steel: c.tags.includes('building'), titanium: c.tags.includes('space'),
  reserve: Object.fromEntries(RES.map((r) => [r, -(c.gain?.[r] ?? 0)])) as Amounts
});

/** Data effects then play() then prodBox. */
export function runEffects(g: G, c: CardDef) {
  for (const r of RES) if (c.gain?.[r]) g.gain(r, c.gain[r]!);
  for (const r of RES) if (c.prod?.[r]) g.prod(r, c.prod[r]!);
  if (c.tr) g.tr(c.tr);
  if (c.raise?.temperature) g.raise('temperature', c.raise.temperature);
  if (c.raise?.oxygen) g.raise('oxygen', c.raise.oxygen);
  if (c.oceans) g.ocean(c.oceans);
  for (const t of c.tiles ?? []) g.tile(t.kind, t.rule);
  if (c.draw) g.draw(c.draw);
  if (c.addSelf) g.addRes(c.addSelf);
  if (c.anyProd) g.reduceAnyProd(c.anyProd.res, c.anyProd.n);
  if (c.removeAny) g.removeAny(c.removeAny.res, c.removeAny.n, c.removeAny.steal);
  if (c.addCard) g.addToCard(c.addCard.type, c.addCard.n, c.addCard.other);
  c.play?.(g);
  c.prodBox?.(g);
}

export function playCard(s: TmState, rt: Rt, seat: number, id: string, pay: Pay) {
  const p = s.players[seat]!;
  const c = def(id);
  doPay(s, seat, pay);
  p.hand = p.hand.filter((x) => x !== id);
  p.nextDiscount = 0; p.nextReqBonus = 0;
  p.played.push(id);
  runEffects(new G(s, seat, id, rt), c);
  emit(s, rt, 'onCardPlayed', { seat, card: c });
}

// ---------------- Standard projects ----------------
export const PROJECTS = { sellPatents: 0, powerPlant: 11, asteroid: 14, aquifer: 18, greenery: 23, city: 25 } as const;
export type Project = keyof typeof PROJECTS;
export const PROJECT_FA: Record<Project, string> = { sellPatents: 'فروش امتیاز اختراع', powerPlant: 'نیروگاه', asteroid: 'سیارک', aquifer: 'سفرهٔ آب', greenery: 'فضای سبز', city: 'شهر' };
export function projectCost(s: TmState, seat: number, project: Project) {
  const g = ctxOf(s, seat);
  return Math.max(0, PROJECTS[project] - tableau(s, seat).reduce((n, id) => n + (def(id).spDiscount?.(project, g) ?? 0), 0));
}
export function projectError(s: TmState, seat: number, project: Project, cards?: string[]): string | null {
  if (project === 'sellPatents') {
    const h = s.players[seat]!.hand;
    return cards?.length && new Set(cards).size === cards.length && cards.every((c) => h.includes(c)) ? null : 'BAD_CARDS';
  }
  if (project === 'asteroid' && s.temperature >= TEMP_MAX) return 'PARAMETER_MAXED';
  if (project === 'aquifer' && s.oceans >= OCEANS_MAX) return 'PARAMETER_MAXED';
  if ((project === 'greenery' || project === 'city') && !legalSpaces(s, seat, project).length) return 'NO_SPACE';
  return maxPay(s, seat, {}) >= projectCost(s, seat, project) ? null : 'CANNOT_AFFORD';
}
export function runProject(s: TmState, rt: Rt, seat: number, project: Project, pay: Pay, cards?: string[]) {
  const g = new G(s, seat, '', rt);
  if (project === 'sellPatents') {
    g.p.hand = g.p.hand.filter((c) => !cards!.includes(c));
    s.discard.push(...cards!);
    g.gain('mc', cards!.length);
  } else {
    doPay(s, seat, pay);
    if (project === 'powerPlant') g.prod('energy', 1);
    if (project === 'asteroid') g.raise('temperature', 1);
    if (project === 'aquifer') g.ocean();
    if (project === 'greenery') g.tile('greenery');
    if (project === 'city') { g.tile('city'); g.prod('mc', 1); }
  }
  emit(s, rt, 'onStandardProject', { seat, project, cost: PROJECTS[project] });
}

// ---------------- Conversions ----------------
export const greeneryPlants = (s: TmState, seat: number) => Math.min(8, ...tableau(s, seat).map((id) => def(id).greeneryPlants ?? 8));
export const canConvertPlants = (s: TmState, seat: number) => s.players[seat]!.res.plants >= greeneryPlants(s, seat) && legalSpaces(s, seat, 'greenery').length > 0;
export const canConvertHeat = (s: TmState, seat: number) => s.players[seat]!.res.heat >= 8 && s.temperature < TEMP_MAX;

// ---------------- Milestones and awards (Tharsis) ----------------
type Metric = (s: TmState, seat: number) => number;
export const MILESTONES: { id: string; name: string; nameFa: string; need: number; textFa: string; value: Metric }[] = [
  { id: 'terraformer', name: 'Terraformer', nameFa: 'زمین‌ساز', need: 35, textFa: 'رتبهٔ زمین‌سازی دست‌کم ۳۵', value: (s, k) => s.players[k]!.tr },
  { id: 'mayor', name: 'Mayor', nameFa: 'شهردار', need: 3, textFa: 'دست‌کم ۳ کاشی شهر', value: (s, k) => citiesOf(s, { seat: k }) },
  { id: 'gardener', name: 'Gardener', nameFa: 'باغبان', need: 3, textFa: 'دست‌کم ۳ کاشی فضای سبز', value: (s, k) => greeneriesOf(s, k) },
  { id: 'builder', name: 'Builder', nameFa: 'سازنده', need: 8, textFa: 'دست‌کم ۸ نشان ساختمان', value: (s, k) => tagsOf(s, k, 'building') },
  { id: 'planner', name: 'Planner', nameFa: 'برنامه‌ریز', need: 16, textFa: 'دست‌کم ۱۶ کارت در دست', value: (s, k) => s.players[k]!.hand.length }
];
export const AWARDS: { id: string; name: string; nameFa: string; textFa: string; value: Metric }[] = [
  { id: 'landlord', name: 'Landlord', nameFa: 'زمین‌دار', textFa: 'بیشترین کاشی در بازی', value: (s, k) => Object.values(s.tiles).filter((t) => t.owner === k).length },
  { id: 'banker', name: 'Banker', nameFa: 'بانکدار', textFa: 'بیشترین تولید مگاکردیت', value: (s, k) => s.players[k]!.prod.mc },
  { id: 'scientist', name: 'Scientist', nameFa: 'دانشمند', textFa: 'بیشترین نشان علم', value: (s, k) => tagsOf(s, k, 'science') },
  { id: 'thermalist', name: 'Thermalist', nameFa: 'گرماشناس', textFa: 'بیشترین منبع گرما', value: (s, k) => s.players[k]!.res.heat },
  { id: 'miner', name: 'Miner', nameFa: 'معدنچی', textFa: 'بیشترین فولاد و تیتانیوم', value: (s, k) => s.players[k]!.res.steel + s.players[k]!.res.titanium }
];
export const MILESTONE_COST = 8;
export const AWARD_COSTS = [8, 14, 20];

export function milestoneError(s: TmState, seat: number, id: string): string | null {
  const m = MILESTONES.find((x) => x.id === id);
  if (!m) return 'UNKNOWN_MILESTONE';
  if (s.milestones.length >= 3 || s.milestones.some((x) => x.id === id)) return 'MILESTONE_TAKEN';
  if (m.value(s, seat) < m.need) return 'MILESTONE_NOT_REACHED';
  return maxPay(s, seat, {}) >= MILESTONE_COST ? null : 'CANNOT_AFFORD';
}
export function awardError(s: TmState, seat: number, id: string): string | null {
  if (!AWARDS.some((x) => x.id === id)) return 'UNKNOWN_AWARD';
  if (s.awards.length >= 3 || s.awards.some((x) => x.id === id)) return 'AWARD_TAKEN';
  return maxPay(s, seat, {}) >= AWARD_COSTS[s.awards.length]! ? null : 'CANNOT_AFFORD';
}

/** Award VP for each seat: 5 for first (shared on ties), 2 for second (not when first is shared, not in 2-player games). */
export function awardPoints(s: TmState, id: string): number[] {
  const a = AWARDS.find((x) => x.id === id)!;
  const v = s.players.map((_, k) => a.value(s, k));
  const first = Math.max(...v);
  const firsts = v.filter((x) => x === first).length;
  const rest = v.filter((x) => x < first);
  const second = firsts === 1 && s.playerCount > 2 && rest.length ? Math.max(...rest) : null;
  return v.map((x) => (x === first ? 5 : x === second ? 2 : 0));
}

export interface Score { tr: number; milestones: number; awards: number; greenery: number; city: number; cards: number; total: number }
export function score(s: TmState, seat: number): Score {
  const g = ctxOf(s, seat);
  const milestones = 5 * s.milestones.filter((m) => m.seat === seat).length;
  const awards = s.awards.reduce((n, a) => n + awardPoints(s, a.id)[seat]!, 0);
  const greenery = greeneriesOf(s, seat);
  const city = Object.entries(s.tiles).filter(([id, t]) => t.kind === 'city' && t.owner === seat && !SPACE[id]!.offMap)
    .reduce((n, [id]) => n + ADJ[id]!.filter((a) => s.tiles[a]?.kind === 'greenery').length, 0);
  const cards = tableau(s, seat, true).reduce((n, id) => {
    const v = def(id).vp;
    return n + (typeof v === 'function' ? v(new G(s, seat, id, g.rt)) : v ?? 0);
  }, 0);
  const tr = s.players[seat]!.tr;
  return { tr, milestones, awards, greenery, city, cards, total: tr + milestones + awards + greenery + city + cards };
}
