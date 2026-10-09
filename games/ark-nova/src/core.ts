// Ark Nova engine core: content registry, tracks, icons, events/queries, the zoo map, buildings, animals, sponsors,
// conservation projects, the display and the break track. Everything here is the API content chunks use
// (see content/README.md). Turn/action flow lives in flow.ts. Pure and deterministic: randomness only via Ctx.rng.
import type { EngineRng } from '@bg/game-sdk';
import { ANIMALS, PROJECTS, SCORING, SPONSORS } from './data.ts';
import { SHAPES, around, hexDistance, inGrid, isBorder, neighbors, placementsOf, CELLS } from './hex.ts';
import {
  ACTION_KEYS, CATEGORIES, CONTINENTS, ICONS,
  type AbilityImpl, type AbilityKey, type AbilityValue, type ActionKey, type AnimalData, type Answer, type Bonus, type Building,
  type CardDef, type Category, type ContentChunk, type Cont, type Continent, type Ctx, type GameEvent, type Icon, type MapDef,
  type Player, type ProjectData, type Queries, type ScoringDef, type SponsorData, type State, type Step, type UniKey
} from './types.ts';

// ---------------- Static data ----------------
export const ANIMAL: Record<number, AnimalData> = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));
export const SPONSOR: Record<number, SponsorData> = Object.fromEntries(SPONSORS.map((a) => [a.id, a]));
export const PROJECT: Record<number, ProjectData> = Object.fromEntries(PROJECTS.map((a) => [a.id, a]));
export const SCORING_DATA = Object.fromEntries(SCORING.map((a) => [a.id, a]));
export const isAnimal = (id: number) => id in ANIMAL;
export const isSponsor = (id: number) => id in SPONSOR;
export const isProject = (id: number) => id in PROJECT;
export const small = (a: AnimalData) => !a.std || a.size <= 2;
export const large = (a: AnimalData) => a.std && a.size >= 4;

export const ACTION_FA: Record<ActionKey, string> = { animals: 'حیوانات', build: 'ساخت', cards: 'کارت‌ها', association: 'انجمن', sponsors: 'حامیان' };
export const ICON_FA: Record<Icon, string> = {
  bird: 'پرنده', herbivore: 'گیاه‌خوار', predator: 'شکارچی', primate: 'نخستی', reptile: 'خزنده', bear: 'خرس', pet: 'باغ‌وحش کودکان',
  africa: 'آفریقا', americas: 'آمریکا', asia: 'آسیا', australia: 'استرالیا', europe: 'اروپا', science: 'پژوهش', rock: 'صخره', water: 'آب'
};
export const UNI_FA: Record<UniKey, string> = { science: 'دانشگاه پژوهشی (۲ پژوهش)', rep: 'دانشگاه اعتبار (۱ پژوهش + ۲ اعتبار)', hand: 'دانشگاه کتابخانه (۱ اعتبار، سقف دست ۵)' };
export const KIND_FA: Record<string, string> = {
  e1: 'محوطهٔ ۱ خانه', e2: 'محوطهٔ ۲ خانه', e3: 'محوطهٔ ۳ خانه', e4: 'محوطهٔ ۴ خانه', e5: 'محوطهٔ ۵ خانه',
  kiosk: 'کیوسک', pavilion: 'آلاچیق', pz: 'باغ‌وحش کودکان', rh: 'خانهٔ خزندگان', ba: 'قفس بزرگ پرندگان'
};

export const MAX_APPEAL = 113;
export const MAX_X = 5;
/** The Conservation track ends at 41 (FAQ). */
export const MAX_CP = 41;
/** Break track length per player count (start space to the last space). */
export const BREAK_MAX: Record<number, number> = { 2: 15, 3: 12, 4: 10 };
export const SPECIAL_CAP: Record<string, number> = { pz: 3, rh: 5, ba: 5 };
/** Reputation at which display folders 1..6 come into reputation range. */
const FOLDER_STARTS = [0, 2, 4, 7, 10, 13];

// ---------------- Content registry ----------------
export const REG = {
  cards: new Map<number, CardDef>(),
  abilities: {} as Partial<Record<AbilityKey, AbilityImpl>>,
  maps: new Map<string, MapDef>(),
  scoring: new Map<number, ScoringDef>(),
  projects: new Map<number, { nameFa: string; textFa?: string }>(),
  fx: {} as Record<string, Cont>
};
let registered = false;
/** Called once by rules.ts with every content chunk. Duplicate ids/keys throw so overlapping chunks are caught. */
export function registerContent(chunks: ContentChunk[]) {
  if (registered) return;
  registered = true;
  for (const ch of chunks) {
    for (const [k, v] of Object.entries(ch.abilities ?? {})) {
      if (REG.abilities[k as AbilityKey]) throw new Error(`ark-nova: duplicate ability ${k}`);
      REG.abilities[k as AbilityKey] = v;
    }
    for (const c of ch.cards ?? []) {
      if (REG.cards.has(c.id)) throw new Error(`ark-nova: duplicate card ${c.id}`);
      if (!isAnimal(c.id) && !isSponsor(c.id)) throw new Error(`ark-nova: unknown card ${c.id}`);
      REG.cards.set(c.id, c);
    }
    for (const m of ch.maps ?? []) { if (REG.maps.has(m.id)) throw new Error(`ark-nova: duplicate map ${m.id}`); REG.maps.set(m.id, m); }
    for (const sc of ch.scoring ?? []) { if (REG.scoring.has(sc.id)) throw new Error(`ark-nova: duplicate scoring ${sc.id}`); REG.scoring.set(sc.id, sc); }
    for (const pr of ch.projects ?? []) { if (REG.projects.has(pr.id)) throw new Error(`ark-nova: duplicate project ${pr.id}`); REG.projects.set(pr.id, pr); }
    for (const [k, f] of Object.entries(ch.fx ?? {})) { if (REG.fx[k]) throw new Error(`ark-nova: duplicate fx ${k}`); REG.fx[k] = f; }
  }
}
export const def = (id: number): CardDef | undefined => REG.cards.get(id);
export function nameOf(id: number): string {
  return def(id)?.nameFa ?? REG.projects.get(id)?.nameFa ?? REG.scoring.get(id)?.nameFa ?? ANIMAL[id]?.name ?? SPONSOR[id]?.name ?? PROJECT[id]?.name ?? String(id);
}
export function mapOf(p: Player): MapDef {
  const m = REG.maps.get(p.map);
  if (!m) throw new Error(`ark-nova: map ${p.map} is not registered`);
  return m;
}
/** Value of an ability keyword printed on an animal (null if absent). */
export const abilityValue = (card: number, key: AbilityKey): AbilityValue | undefined => ANIMAL[card]?.ab.find(([k]) => k === key)?.[1];

// ---------------- Basics ----------------
export const P = (c: Ctx): Player => c.s.players[c.seat]!;
export const ctx = (s: State, seat: number, rng: EngineRng, card?: number): Ctx => ({ s, seat, rng, ...(card !== undefined ? { card } : {}) });
export function log(c: Ctx, t: string, extra: Record<string, unknown> = {}) {
  c.s.log.push({ seat: c.seat, t, ...extra });
  if (c.s.log.length > 40) c.s.log.shift();
}
export function shuffle<T>(rng: EngineRng, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
/** Seats in turn order starting with `from`. */
export const seatsFrom = (s: State, from: number) => Array.from({ length: s.n }, (_, k) => (from + k) % s.n);

// ---------------- Step buffer (prompts asked during one resolution are inserted before older ones) ----------------
let BUF: Step[] = [];
export function resetBuffer() { BUF = []; }
export function flush(s: State) { if (BUF.length) { s.queue.unshift(...BUF); BUF = []; } }
function push(step: Step) { BUF.push(step); }
const base = (c: Ctx) => ({ seat: c.seat, ...(c.card !== undefined ? { card: c.card } : {}) });

/** Prompts. Each is answered by its owner (c.seat); the continuation `fx` runs with (ctx, data, answer). */
export const ask = {
  option(c: Ctx, o: { options: { value: string; label: string }[]; label: string; fx: string; data?: unknown; optional?: boolean }) {
    if (o.options.length) push({ k: 'option', ...base(c), ...o });
  },
  pick(c: Ctx, o: { ids: number[]; min: number; max: number; label: string; fx: string; data?: unknown; optional?: boolean; open?: boolean }) {
    if (o.ids.length && o.max > 0) push({ k: 'pick', ...base(c), ...o, min: Math.min(o.min, o.ids.length), max: Math.min(o.max, o.ids.length) });
  },
  /** Place a building. `free` = no money cost (bonus/effect); `upgraded` lets it cover Build-II spaces (default: own Build II). */
  place(c: Ctx, o: { kinds: string[]; free: boolean; optional: boolean; label: string; fx?: string; data?: unknown; upgraded?: boolean }) {
    const { fx, data, upgraded, ...rest } = o;
    push({ k: 'place', ...base(c), ...rest, fx: fx ?? 'core:placed', data: fx ? data : { free: o.free }, upgraded: upgraded ?? P(c).up.build });
  }
};
/**
 * Grant an extra action (Determination, Action X, Hypnosis): the player chooses one of `cards` (default all) and
 * performs it with the strength of its slot (+X-tokens); the card then moves to slot 1. `from` = use that player's
 * Action cards (Hypnosis). Optional unless `optional: false`.
 */
export function grantAction(c: Ctx, o: { cards?: ActionKey[]; from?: number; label: string; optional?: boolean }) {
  later(c, 'core:turnPrompt', { label: o.label, extra: true, optional: o.optional ?? true, ...(o.cards ? { cards: o.cards } : {}), ...(o.from !== undefined ? { from: o.from } : {}) });
}
/** Run `fx` later (when the step reaches the head of the queue) — use when options depend on earlier prompts. */
export function later(c: Ctx, fx: string, data?: unknown) { push({ k: 'sys', ...base(c), fx, ...(data !== undefined ? { data } : {}) }); }
/** Run `fx` after the current action finished (its Action card already moved to slot 1). Outside an action: `later`. */
export function afterAction(c: Ctx, fx: string, data?: unknown) {
  const a = c.s.act;
  if (a && a.seat === c.seat) a.after.push({ k: 'sys', ...base(c), fx, ...(data !== undefined ? { data } : {}) });
  else later(c, fx, data);
}
/** Run a continuation now (engine or content key). */
export function runFx(c: Ctx, fx: string, data: unknown, ans: Answer) {
  const f = REG.fx[fx];
  if (!f) throw new Error(`ark-nova: unknown fx ${fx}`);
  f(c, data, ans);
}

// ---------------- Events and queries ----------------
/** Sources of one player: their zoo cards (and abilities of their animals) and their map. */
function sources(s: State, seat: number): { card?: number; on?: CardDef['on']; q?: Queries }[] {
  const p = s.players[seat]!;
  const out: { card?: number; on?: CardDef['on']; q?: Queries }[] = [];
  for (const id of p.zoo) {
    const d = def(id);
    if (d) out.push({ card: id, on: d.on, q: d.q });
    for (const [k] of ANIMAL[id]?.ab ?? []) { const a = REG.abilities[k]; if (a) out.push({ card: id, on: a.on, q: a.q }); }
  }
  const m = REG.maps.get(p.map);
  if (m) out.push({ on: m.on, q: m.q });
  return out;
}
/** Notify every handler of every player (each handler decides whether the event concerns it via e.seat vs c.seat). */
export function emit(s: State, rng: EngineRng, e: GameEvent) {
  for (const seat of seatsFrom(s, e.seat)) {
    for (const src of sources(s, seat)) {
      const h = src.on?.[e.t] as ((c: Ctx, e: GameEvent) => void) | undefined;
      if (h) h(ctx(s, seat, rng, src.card), e);
    }
  }
}
type QArgs<K extends keyof Queries> = Queries[K] extends ((c: Ctx, ...a: infer A) => unknown) | undefined ? A : never;
function asked<K extends keyof Queries>(c: Ctx, key: K, args: QArgs<K>, subject?: AnimalData): unknown[] {
  const out: unknown[] = [];
  const srcs = sources(c.s, c.seat);
  if (subject && !P(c).zoo.includes(subject.id)) for (const [k] of subject.ab) { const a = REG.abilities[k]; if (a) srcs.push({ card: subject.id, q: a.q }); }
  for (const src of srcs) {
    const f = src.q?.[key] as ((c: Ctx, ...a: unknown[]) => unknown) | undefined;
    if (f) out.push(f({ ...c, ...(src.card !== undefined ? { card: src.card } : {}) }, ...(args as unknown[])));
  }
  return out;
}
const subjectOf = (x: unknown) => (x && typeof x === 'object' && 'ab' in x ? x as AnimalData : undefined);
/** Sum of a numeric query over the player's sources. */
export const qsum = <K extends keyof Queries>(c: Ctx, key: K, ...args: QArgs<K>): number =>
  asked(c, key, args, subjectOf(args[0])).reduce<number>((a, b) => a + (Number(b) || 0), 0);
/** OR of a boolean query over the player's sources. */
export const qany = <K extends keyof Queries>(c: Ctx, key: K, ...args: QArgs<K>): boolean =>
  asked(c, key, args, subjectOf(args[0])).some(Boolean);

// ---------------- Icons ----------------
/** Icons printed on one card (upper-right icons plus rock/water requirements). */
export function cardIcons(id: number): Partial<Record<Icon, number>> {
  const d = ANIMAL[id] ?? SPONSOR[id];
  const out: Partial<Record<Icon, number>> = {};
  if (!d) return out;
  for (const i of d.icons) out[i] = (out[i] ?? 0) + 1;
  if (d.rock) out.rock = (out.rock ?? 0) + d.rock;
  if (d.water) out.water = (out.water ?? 0) + d.water;
  return out;
}
/** Every icon in a player's zoo: cards, partner zoos and universities. */
export function icons(s: State, seat: number): Record<Icon, number> {
  const p = s.players[seat]!;
  const out = Object.fromEntries(ICONS.map((i) => [i, 0])) as Record<Icon, number>;
  for (const id of p.zoo) for (const [i, n] of Object.entries(cardIcons(id))) out[i as Icon] += n!;
  for (const z of p.partners) out[z] += 1;
  for (const u of p.unis) out.science += u === 'science' ? 2 : u === 'rep' ? 1 : 0;
  return out;
}
export const count = (s: State, seat: number, i: Icon) => icons(s, seat)[i];
export const categoriesIn = (s: State, seat: number) => { const ic = icons(s, seat); return CATEGORIES.filter((k) => ic[k] > 0).length; };
export const continentsIn = (s: State, seat: number) => { const ic = icons(s, seat); return CONTINENTS.filter((k) => ic[k] > 0).length; };
export const animalsIn = (s: State, seat: number) => s.players[seat]!.zoo.filter(isAnimal).map((id) => ANIMAL[id]!);
export const sponsorsIn = (s: State, seat: number) => s.players[seat]!.zoo.filter(isSponsor);

// ---------------- Tracks ----------------
export const target = (cp: number) => Math.max(1, 114 - 2 * Math.min(cp, 10) - 3 * Math.max(0, cp - 10));
export const vp = (p: Player) => p.appeal - target(p.cp);
export const crossed = (p: Player) => p.appeal >= target(p.cp);
/** Money from the Appeal track in each break. */
export function appealIncome(a: number): number {
  a = Math.max(0, Math.min(MAX_APPEAL, a));
  if (a <= 5) return 5 + a;
  if (a <= 17) return 11 + Math.floor((a - 6) / 2);
  if (a <= 35) return 17 + Math.floor((a - 18) / 3);
  if (a <= 59) return 23 + Math.floor((a - 36) / 4);
  if (a <= 89) return 29 + Math.floor((a - 60) / 5);
  return 35 + Math.floor((a - 90) / 6);
}
/** Folders within reputation range (1..6). */
export const range = (p: Player) => FOLDER_STARTS.filter((m) => p.rep >= m).length;
export const handLimit = (c: Ctx) => (P(c).unis.includes('hand') ? 5 : 3) + qsum(c, 'handLimit');

const mark = (p: Player, k: string) => { if (p.marks.includes(k)) return false; p.marks.push(k); return true; };
export type TrackKey = 'money' | 'appeal' | 'cp' | 'rep' | 'x';
/** Gain (or lose, n < 0) on a track. Reputation and conservation milestones are triggered here. */
export function gain(c: Ctx, k: TrackKey, n: number) {
  const p = P(c);
  if (!n) return;
  switch (k) {
    case 'money': p.money = Math.max(0, p.money + n); return;
    case 'appeal': p.appeal = Math.max(0, Math.min(MAX_APPEAL, p.appeal + n)); return;
    case 'x': p.x = Math.max(0, Math.min(MAX_X, p.x + n)); return;
    case 'rep': {
      if (n < 0) { p.rep = Math.max(0, p.rep + n); return; }
      for (let i = 0; i < n; i++) {
        const cap = p.up.cards ? 15 : 9;
        if (p.rep < cap) { p.rep += 1; repMilestone(c, p.rep); } else if (cap === 15) gain(c, 'appeal', 1);
      }
      return;
    }
    case 'cp': {
      const old = p.cp;
      p.cp = Math.max(0, Math.min(MAX_CP, p.cp + n));
      for (const m of [2, 5, 8]) if (old < m && p.cp >= m && mark(p, `c${m}`)) later(c, 'core:cpMilestone', m);
      if (old < 10 && p.cp >= 10 && !c.s.cp10) {
        c.s.cp10 = true;
        for (const k2 of seatsFrom(c.s, c.seat)) later(ctx(c.s, k2, c.rng), 'core:finalDiscard');
      }
    }
  }
}
function repMilestone(c: Ctx, r: number) {
  const p = P(c);
  if (!mark(p, `r${r}`)) return;
  if (r === 5) later(c, 'core:upgrade');
  else if (r === 8) hireWorker(c);
  else if (r === 11 || r === 14) gain(c, 'cp', 1);
  else if (r === 12 || r === 15) gain(c, 'x', 1);
  else if (r === 13) later(c, 'core:snap');
}
export function hireWorker(c: Ctx) {
  const p = P(c);
  if (p.hired >= 3) return;
  p.hired += 1; p.workers += 1;
  const b = mapOf(p).worker[p.hired];
  if (b) gainBonus(c, b);
}

// ---------------- Cards: deck, display, hand ----------------
/** Take the top card of the deck (the discard pile is reshuffled when the deck runs out). */
export function reveal(c: Ctx): number | null {
  const s = c.s;
  if (!s.deck.length && s.discard.length) { s.deck = shuffle(c.rng, s.discard); s.discard = []; }
  return s.deck.pop() ?? null;
}
export function drawDeck(c: Ctx, n: number): number[] {
  const got: number[] = [];
  for (let i = 0; i < n; i++) { const id = reveal(c); if (id === null) break; got.push(id); }
  P(c).hand.push(...got);
  return got;
}
/** Take the card in display folder `folder` (1-based) into the hand; the folder stays empty until the end of the turn. */
export function takeDisplay(c: Ctx, folder: number): number | null {
  const id = c.s.display[folder - 1];
  if (id === null || id === undefined) return null;
  c.s.display[folder - 1] = null;
  P(c).hand.push(id);
  return id;
}
/** Slide cards towards folder 1 (order kept) and fill the empty folders from the deck. */
export function refillDisplay(c: Ctx) {
  const kept = c.s.display.filter((x): x is number => x !== null);
  while (kept.length < 6) { const id = reveal(c); if (id === null) break; kept.push(id); }
  c.s.display = [...kept, ...Array<null>(6 - kept.length).fill(null)];
}
/** Remove a card from the hand if it is there (tests may play cards that were never dealt). */
export function dropFromHand(p: Player, id: number) { const i = p.hand.indexOf(id); if (i >= 0) p.hand.splice(i, 1); }
export function discardFromHand(c: Ctx, ids: number[]) {
  const p = P(c);
  for (const id of ids) { const i = p.hand.indexOf(id); if (i >= 0) { p.hand.splice(i, 1); c.s.discard.push(id); } }
}
/** Folders (1-based) holding a card within the player's reputation range. */
export const inRange = (c: Ctx) => c.s.display.map((id, i) => (id !== null && i < range(P(c)) ? i + 1 : 0)).filter(Boolean);
export const displayFolders = (s: State) => s.display.map((id, i) => (id !== null ? i + 1 : 0)).filter(Boolean);

/** Advance the Break token; reaching the last space calls a break (end of this turn) and gains 1 X-token. */
export function advanceBreak(c: Ctx, n: number) {
  const s = c.s;
  if (n <= 0 || s.brk >= s.brkMax) return;
  s.brk = Math.min(s.brkMax, s.brk + n);
  if (s.brk >= s.brkMax && s.breakDue === null) { s.breakDue = c.seat; gain(c, 'x', 1); log(c, 'break'); }
}

// ---------------- Action cards ----------------
/** Move an Action card to slot 1 (the cards to its left shift one slot right). */
export function toSlot1(p: Player, card: ActionKey) { p.slots = [card, ...p.slots.filter((k) => k !== card)]; }
/** Move an Action card to slot 5 (the cards to its right shift one slot left). */
export function toSlot5(p: Player, card: ActionKey) { p.slots = [...p.slots.filter((k) => k !== card), card]; }
export const strengthOf = (p: Player, card: ActionKey) => p.slots.indexOf(card) + 1 - (p.tok[card].con ? 2 : 0);

// ---------------- Zoo map ----------------
export const coveredCells = (p: Player) => new Set(p.buildings.flatMap((b) => b.cells));
const sizeOfKind = (kind: string) => (kind.startsWith('e') ? Number(kind.slice(1)) : kind === 'kiosk' || kind === 'pavilion' ? 1 : kind === 'pz' ? 3 : kind === 'rh' || kind === 'ba' ? 5 : def(Number(kind.slice(1)))?.building?.shape.length ?? 0);
export const kindSize = sizeOfKind;
export const isStandard = (b: Building) => /^e\d$/.test(b.kind);
export const isSpecial = (b: Building) => b.kind === 'pz' || b.kind === 'rh' || b.kind === 'ba';
export const isUnique = (b: Building) => b.kind.startsWith('u');
/** Rock / water spaces of the player's map that are not covered (Diversity Researcher may cover them). */
export function terrain(p: Player, t: 'rock' | 'water'): string[] {
  const cov = coveredCells(p);
  return mapOf(p)[t].filter((x) => !cov.has(x));
}
/** Distinct uncovered rock/water spaces adjacent to a set of cells. */
export function adjacentTerrain(p: Player, cells: string[], t: 'rock' | 'water'): number {
  const set = new Set(terrain(p, t));
  return around(cells).filter((x) => set.has(x)).length;
}
/** Building spaces: every space except rock, water and printed features. */
export function buildingSpaces(p: Player): string[] {
  const m = mapOf(p);
  const no = new Set([...m.rock, ...m.water, ...(m.blocked ?? [])]);
  return CELLS.filter((x) => !no.has(x));
}
export const isFull = (p: Player) => { const cov = coveredCells(p); return buildingSpaces(p).every((x) => cov.has(x)); };
/** A space is connected if it is not covered but adjacent to a covered space. */
export function connected(p: Player, cell: string): boolean {
  const cov = coveredCells(p);
  return !cov.has(cell) && neighbors(cell).some((x) => cov.has(x));
}

/** A space is isolated if it is not covered and not adjacent to a covered space. */
export function isolated(p: Player, cell: string): boolean {
  const cov = coveredCells(p);
  return !cov.has(cell) && !neighbors(cell).some((x) => cov.has(x));
}

function shapeOf(kind: string): [number, number][] | null {
  if (SHAPES[kind]) return SHAPES[kind]!;
  if (kind.startsWith('u')) return def(Number(kind.slice(1)))?.building?.shape ?? null;
  return null;
}
/**
 * Why a building cannot go on these cells (null = legal). `upgraded`: may cover Build-II spaces.
 * Rules: shape (any rotation; special enclosures may also be mirrored), empty building spaces, adjacent to an existing
 * building (first building: on a border space), kiosks 3+ apart, one of each special enclosure and unique building.
 */
export function placeError(c: Ctx, kind: string, cells: string[], upgraded: boolean): string | null {
  const p = P(c);
  const m = mapOf(p);
  const shape = shapeOf(kind);
  if (!shape || cells.length !== shape.length) return 'BAD_BUILDING';
  if (!cells.every(inGrid)) return 'BAD_CELLS';
  const key = [...cells].sort().join(',');
  if (!placementsOf(kind, shape).some((pl) => pl.join(',') === key)) return 'BAD_SHAPE';
  const cov = coveredCells(p);
  const terr = qany(c, 'coverTerrain');
  for (const x of cells) {
    if (cov.has(x)) return 'CELL_COVERED';
    if ((m.blocked ?? []).includes(x)) return 'CELL_BLOCKED';
    if (!terr && (m.rock.includes(x) || m.water.includes(x))) return 'CELL_TERRAIN';
    if (!upgraded && m.upgrade.includes(x)) return 'NEEDS_BUILD_UPGRADE';
  }
  if ((kind === 'pz' || kind === 'rh' || kind === 'ba' || kind.startsWith('u')) && p.buildings.some((b) => b.kind === kind)) return 'ALREADY_BUILT';
  if (kind === 'kiosk') {
    for (const b of p.buildings) if (b.kind === 'kiosk' && b.cells.some((y) => cells.some((x) => hexDistance(x, y) < 3))) return 'KIOSK_DISTANCE';
  }
  const ub = kind.startsWith('u') ? def(Number(kind.slice(1)))?.building : undefined;
  if (ub?.border && cells.filter(isBorder).length < ub.border) return 'NEEDS_BORDER';
  if (!ub?.anywhere) {
    if (!p.buildings.length) { if (!cells.some(isBorder)) return 'NEEDS_BORDER'; }
    else if (!around(cells).some((x) => cov.has(x))) return 'BUILD_NOT_ADJACENT';
  }
  if (ub && !terr) {
    if ((ub.rock ?? 0) > adjacentTerrain(p, cells, 'rock')) return 'NEEDS_ROCK';
    if ((ub.water ?? 0) > adjacentTerrain(p, cells, 'water')) return 'NEEDS_WATER';
  }
  return null;
}
/** Every legal placement of a building kind. */
export function placements(c: Ctx, kind: string, upgraded: boolean): string[][] {
  const shape = shapeOf(kind);
  if (!shape) return [];
  return placementsOf(kind, shape).filter((cells) => !placeError(c, kind, cells, upgraded));
}
export const canPlaceKind = (c: Ctx, kind: string, upgraded: boolean) => {
  const shape = shapeOf(kind);
  return !!shape && placementsOf(kind, shape).some((cells) => !placeError(c, kind, cells, upgraded));
};

/** Put a (validated) building on the map: placement bonuses, pavilion appeal, full-map bonus and events. */
export function build(c: Ctx, kind: string, cells: string[], free: boolean): Building {
  const p = P(c);
  const m = mapOf(p);
  const b: Building = { id: p.nextId++, kind, cells: [...cells].sort() };
  if (isSpecial(b)) b.used = 0;
  p.buildings.push(b);
  log(c, 'build', { kind });
  if (kind === 'pavilion') gain(c, 'appeal', 1);
  for (const x of b.cells) {
    const bonus = m.bonuses[x];
    if (bonus && !p.taken.includes(x)) {
      p.taken.push(x);
      gainBonus(c, bonus);
      emit(c.s, c.rng, { t: 'placementBonus', seat: c.seat, cell: x, border: isBorder(x), bonus });
    }
  }
  emit(c.s, c.rng, { t: 'covered', seat: c.seat, cells: b.cells });
  emit(c.s, c.rng, { t: 'built', seat: c.seat, building: b, free });
  if (isFull(p) && mark(p, 'full')) gain(c, 'appeal', 7);
  return b;
}
/** Standard enclosure capacity (map 2 Outdoor Areas adds 2). */
export const capacity = (c: Ctx, b: Building) => (isStandard(b) ? sizeOfKind(b.kind) + qsum(c, 'enclosureSize', b) : SPECIAL_CAP[b.kind] ?? 0);

// ---------------- Bonuses ----------------
const faN = (n?: number) => (n ?? 1).toLocaleString('fa-IR');
export const BONUS_FA: Record<string, (n?: number) => string> = {
  money: (n) => `${faN(n)} پول`, x: (n) => `${faN(n)} نشان X`, rep: (n) => `${faN(n)} اعتبار`, cp: (n) => `${faN(n)} امتیاز حفاظت`, appeal: (n) => `${faN(n)} جذابیت`,
  card: (n) => `${faN(n)} کارت از محدودهٔ اعتبار یا دسته`, snap: () => 'برداشتن ۱ کارت از ویترین', worker: () => 'یک کارمند انجمن', upgrade: () => 'ارتقای یک کارت کنش',
  partner: () => 'یک باغ‌وحش همکار', uni: () => 'یک دانشگاه', enclosure: (n) => `محوطهٔ ${faN(n)} خانهٔ رایگان`, kiosk: () => 'کیوسک رایگان', pavilion: () => 'آلاچیق رایگان',
  clever: () => 'یک کارت کنش به خانهٔ ۱', multiplier: () => 'نشان دوبرابرکننده', sponsor: () => 'بازی یک حامی با پرداخت پول به اندازهٔ سطحش', fx: () => 'پاداش ویژه'
};
export const bonusFa = (b: Bonus) => b.labelFa ?? BONUS_FA[b.k]?.(b.n) ?? b.k;
/** Gain a printed bonus (placement bonus, left-edge token, partner zoo / university space, ...). */
export function gainBonus(c: Ctx, b: Bonus) {
  const n = b.n ?? 1;
  switch (b.k) {
    case 'money': case 'x': case 'rep': case 'cp': case 'appeal': gain(c, b.k, n); return;
    case 'card': for (let i = 0; i < n; i++) later(c, 'core:card1'); return;
    case 'snap': later(c, 'core:snap'); return;
    case 'worker': hireWorker(c); return;
    case 'upgrade': later(c, 'core:upgrade'); return;
    case 'partner': later(c, 'core:partner'); return;
    case 'uni': later(c, 'core:uni'); return;
    case 'enclosure': ask.place(c, { kinds: [`e${n}`], free: true, optional: true, label: `ساخت رایگان ${KIND_FA[`e${n}`]}` }); return;
    case 'kiosk': case 'pavilion': ask.place(c, { kinds: [b.k], free: true, optional: true, label: `ساخت رایگان ${KIND_FA[b.k]}` }); return;
    case 'clever': later(c, 'core:clever'); return;
    case 'multiplier': later(c, 'core:multiplier', null); return;
    case 'sponsor': later(c, 'core:sponsorForMoney'); return;
    case 'fx': runFx(c, b.fx!, b.data, {}); return;
  }
}
export const partnerLimit = (p: Player, up = p.up.association) => (up ? 4 : 2);
export function takePartner(c: Ctx, z: Continent) {
  const p = P(c);
  c.s.zoosAvail = c.s.zoosAvail.filter((x) => x !== z);
  p.partners.push(z);
  log(c, 'partner', { zoo: z });
  const b = mapOf(p).partner[p.partners.length];
  if (b) gainBonus(c, b);
  emit(c.s, c.rng, { t: 'icons', seat: c.seat, card: null, icons: { [z]: 1 }, source: 'partner' });
}
export function takeUni(c: Ctx, u: UniKey) {
  const p = P(c);
  c.s.unisAvail = c.s.unisAvail.filter((x) => x !== u);
  p.unis.push(u);
  log(c, 'uni', { uni: u });
  const b = mapOf(p).uni[p.unis.length];
  if (b) gainBonus(c, b);
  if (u === 'rep') gain(c, 'rep', 2);
  if (u === 'hand') gain(c, 'rep', 1);
  const sci = u === 'science' ? 2 : u === 'rep' ? 1 : 0;
  if (sci) emit(c.s, c.rng, { t: 'icons', seat: c.seat, card: null, icons: { science: sci }, source: 'uni' });
}
export const partnerOptions = (c: Ctx, up?: boolean) => (P(c).partners.length >= partnerLimit(P(c), up) ? [] : c.s.zoosAvail.filter((z) => !P(c).partners.includes(z)));
export const uniOptions = (c: Ctx) => c.s.unisAvail.filter((u) => !P(c).unis.includes(u));

// ---------------- Conditions ----------------
/** Missing condition units of a card (each missing icon / unmet condition counts 1). `up` = the relevant Action card's side. */
export function missing(c: Ctx, card: AnimalData | SponsorData, up: boolean): number {
  const p = P(c);
  const ic = icons(c.s, c.seat);
  let miss = 0;
  for (const [k, n] of Object.entries(card.req) as [string, number][]) {
    if (k === 'partner') {
      if ('cost' in card) miss += (card.icons.some((i) => p.partners.includes(i as Continent)) ? 0 : 1);
      else miss += Math.max(0, n - p.partners.length);
    } else if (k === 'animals2' || k === 'sponsors2') miss += up || p.up[k === 'animals2' ? 'animals' : 'sponsors'] ? 0 : 1;
    else if (k === 'appeal25') miss += p.appeal <= 25 ? 0 : 1;
    else if (k === 'rep') miss += p.rep >= n ? 0 : 1;
    else miss += Math.max(0, n - (ic[k as Icon] ?? 0));
  }
  return miss;
}

// ---------------- Animals ----------------
export interface AnimalOpt { card: number; home: number | null; cost: number; folder: number }
/** Money to play an animal: printed cost − 3 per continent icon with a partner zoo, + modifiers + display folder. */
export function animalCost(c: Ctx, a: AnimalData, folder = 0): number {
  const p = P(c);
  const partner = a.icons.filter((i) => p.partners.includes(i as Continent)).length;
  return Math.max(0, a.cost - 3 * partner + qsum(c, 'animalCost', a)) + folder;
}
/** Enclosures (building ids) the animal may live in; null = no enclosure needed (Flock). */
export function homesFor(c: Ctx, a: AnimalData): (number | null)[] {
  const p = P(c);
  const terr = qany(c, 'coverTerrain');
  const ok = (b: Building) => terr || (adjacentTerrain(p, b.cells, 'rock') >= a.rock && adjacentTerrain(p, b.cells, 'water') >= a.water);
  const out: (number | null)[] = [];
  for (const b of p.buildings) {
    if (a.std && isStandard(b) && !b.full && capacity(c, b) >= a.size && ok(b)) out.push(b.id);
    if (a.sp && b.kind === a.sp.k && SPECIAL_CAP[b.kind]! - (b.used ?? 0) >= a.sp.n && ok(b)) out.push(b.id);
  }
  if (qany(c, 'noEnclosure', a)) out.push(null);
  return out;
}
export function animalError(c: Ctx, a: AnimalData, up: boolean, folder = 0): string | null {
  if (qany(c, 'forbidAnimal', a)) return 'ANIMAL_FORBIDDEN';
  if (missing(c, a, up) > qsum(c, 'ignoreConditions', a)) return 'CONDITIONS';
  if (P(c).money < animalCost(c, a, folder)) return 'CANNOT_AFFORD';
  if (!homesFor(c, a).length) return 'NO_ENCLOSURE';
  return null;
}
/** Animal plays available now: from hand, and (with `display`) within reputation range paying the folder number. */
export function animalOptions(c: Ctx, up: boolean, display: boolean, filter: (a: AnimalData) => boolean = () => true): AnimalOpt[] {
  const out: AnimalOpt[] = [];
  const srcs: [number, number][] = P(c).hand.map((id) => [id, 0]);
  if (display) for (const f of inRange(c)) srcs.push([c.s.display[f - 1]!, f]);
  for (const [id, folder] of srcs) {
    const a = ANIMAL[id];
    if (!a || !filter(a) || animalError(c, a, up, folder)) continue;
    for (const home of homesFor(c, a)) out.push({ card: id, home, cost: animalCost(c, a, folder), folder });
  }
  return out;
}
export const animalValue = (o: AnimalOpt) => `${o.card}@${o.home ?? 'none'}@${o.folder}`;
export function animalLabel(c: Ctx, o: AnimalOpt): string {
  const b = P(c).buildings.find((x) => x.id === o.home);
  return `${nameOf(o.card)} — ${b ? KIND_FA[b.kind] ?? b.kind : 'بدون محوطه'}، ${o.cost} پول${o.folder ? ` (ویترین ${o.folder})` : ''}`;
}
/** Play an animal (validated option): pay, fill the enclosure, gain rewards, icons event, abilities. */
export function playAnimal(c: Ctx, o: AnimalOpt) {
  const s = c.s;
  const p = P(c);
  const a = ANIMAL[o.card]!;
  gain(c, 'money', -o.cost);
  if (o.folder) s.display[o.folder - 1] = null; else dropFromHand(p, o.card);
  const b = p.buildings.find((x) => x.id === o.home);
  if (b && isStandard(b)) { b.full = true; emit(s, c.rng, { t: 'occupied', seat: c.seat, building: b }); }
  if (b && isSpecial(b)) b.used = (b.used ?? 0) + (a.sp?.k === b.kind ? a.sp.n : 1);
  p.zoo.push(a.id);
  log(c, 'animal', { card: a.id });
  if (s.act && s.act.seat === c.seat) { s.act.count += 1; if (!small(a)) s.act.small = false; }
  const cc = { ...c, card: a.id };
  gain(cc, 'rep', a.rep);
  gain(cc, 'cp', a.cp);
  emit(s, c.rng, { t: 'icons', seat: c.seat, card: a.id, icons: cardIcons(a.id), source: 'animal' });
  emit(s, c.rng, { t: 'animal', seat: c.seat, card: a.id, building: o.home });
  def(a.id)?.onPlay?.(cc);
  for (const [k, v] of a.ab) {
    const impl = REG.abilities[k];
    impl?.now?.(cc, v);
    if (impl?.after) afterAction(cc, 'core:abilityAfter', { k, v });
  }
  gain(cc, 'appeal', a.appeal);
}
/**
 * Flip back the smallest occupied standard enclosure that meets all of the animal's requirements (size incl. map
 * modifiers, rock, water); else the smallest that meets its size; else none (errata 1.1, release and moving alike).
 */
export function vacateFor(c: Ctx, a: AnimalData): boolean {
  const p = P(c);
  const full = p.buildings.filter((b) => isStandard(b) && b.full && capacity(c, b) >= a.size).sort((x, y) => capacity(c, x) - capacity(c, y));
  const fits = full.filter((b) => adjacentTerrain(p, b.cells, 'rock') >= a.rock && adjacentTerrain(p, b.cells, 'water') >= a.water);
  const b = fits[0] ?? full[0];
  if (b) b.full = false;
  return !!b;
}
/** Release an animal into the wild: lose its printed appeal, free its enclosure, discard it (and cards under it). */
export function releaseAnimal(c: Ctx, id: number) {
  const p = P(c);
  const a = ANIMAL[id]!;
  p.zoo.splice(p.zoo.indexOf(id), 1);
  gain(c, 'appeal', -a.appeal);
  const sp = a.sp ? p.buildings.find((b) => b.kind === a.sp!.k && (b.used ?? 0) >= a.sp!.n) : undefined;
  const pz = !a.std ? p.buildings.find((b) => b.kind === 'pz' && (b.used ?? 0) > 0) : undefined;
  if (sp) sp.used! -= a.sp!.n;
  else if (pz) pz.used! -= a.sp?.n ?? 1;
  else vacateFor(c, a);
  c.s.discard.push(id, ...(p.under[id] ?? []));
  delete p.under[id];
  log(c, 'release', { card: id });
  emit(c.s, c.rng, { t: 'release', seat: c.seat, card: id });
}

// ---------------- Sponsors ----------------
export const sponsorLevel = (c: Ctx, id: number) => Math.max(0, SPONSOR[id]!.level + qsum(c, 'sponsorLevel', SPONSOR[id]!));
/** Why a Sponsor card cannot be played (conditions, its own check, room for its unique building). */
export function sponsorError(c: Ctx, id: number, up: boolean): string | null {
  const sp = SPONSOR[id];
  if (!sp) return 'NOT_A_SPONSOR';
  if (missing(c, sp, up) > 0) return 'CONDITIONS';
  const d = def(id);
  const e = d?.canPlay?.({ ...c, card: id });
  if (e) return e;
  if (d?.building && !canPlaceKind({ ...c, card: id }, `u${id}`, P(c).up.build)) return 'NO_ROOM';
  return null;
}
/** Play a (validated) Sponsor card from the hand (folder 0) or the display (pay the folder number). */
export function playSponsor(c: Ctx, id: number, folder = 0) {
  const s = c.s;
  const p = P(c);
  const sp = SPONSOR[id]!;
  gain(c, 'money', -folder);
  if (folder) s.display[folder - 1] = null; else dropFromHand(p, id);
  p.zoo.push(id);
  log(c, 'sponsor', { card: id });
  const cc = { ...c, card: id };
  const d = def(id);
  gain(cc, 'rep', sp.rep);
  gain(cc, 'cp', sp.cp);
  if (d?.wild) p.data[id] = { ...(p.data[id] as object ?? {}), wild: d.wild };
  // The unique building is placed first; prompts triggered by the card's own icons come after it (printed order).
  if (d?.building) ask.place(cc, { kinds: [`u${id}`], free: true, optional: false, label: `ساخت ${d.building.nameFa}` });
  emit(s, c.rng, { t: 'icons', seat: c.seat, card: id, icons: cardIcons(id), source: 'sponsor' });
  emit(s, c.rng, { t: 'sponsor', seat: c.seat, card: id });
  d?.onPlay?.(cc);
  gain(cc, 'appeal', sp.appeal);
}

// ---------------- Conservation projects ----------------
export const projectSlotsMax = (s: State) => s.n;
/** Icons counted for an 'icons' project. */
export function projectCount(s: State, seat: number, pr: ProjectData): number {
  if (pr.icon === 'categories') return categoriesIn(s, seat);
  if (pr.icon === 'continents') return continentsIn(s, seat);
  if (pr.icon === 'small') return animalsIn(s, seat).filter(small).length;
  if (pr.icon === 'large') return animalsIn(s, seat).filter(large).length;
  return count(s, seat, pr.icon as Icon);
}
const bracket = (a: AnimalData) => (!a.std ? 0 : a.size >= 4 ? 4 : a.size === 3 ? 3 : 2);
/** Animals in the zoo that may be released for this release-project slot. */
export const releasable = (s: State, seat: number, pr: ProjectData, slot: number) =>
  animalsIn(s, seat).filter((a) => a.icons.includes(pr.icon as Icon) && bracket(a) === pr.slots[slot]!.size).map((a) => a.id);
const wildCards = (p: Player) => p.zoo.filter((id) => ((p.data[id] as { wild?: number } | undefined)?.wild ?? 0) > 0);
export interface ProjectOpt { project: number; slot: number; animal?: number; from: 'board' | 'hand' | 'display'; folder: number; wild?: number }
/** Every way to support a project now (board projects, project cards in hand, and with `display` in reputation range). */
export function projectOptions(c: Ctx, display: boolean): ProjectOpt[] {
  const s = c.s;
  const p = P(c);
  const out: ProjectOpt[] = [];
  const consider = (id: number, from: ProjectOpt['from'], folder: number) => {
    const pr = PROJECT[id]!;
    const toks = s.ptoks[id] ?? [null, null, null];
    const mine = toks.includes(c.seat) || s.extraSupports.some((x) => x.project === id && x.seat === c.seat);
    if (mine && !(pr.kind === 'release' && qany(c, 'repeatRelease'))) return;
    if (p.money < folder) return;
    pr.slots.forEach((sl, k) => {
      if (toks[k] !== null && toks[k] !== undefined) return;
      if (pr.kind === 'icons') {
        const have = projectCount(s, c.seat, pr);
        if (have >= sl.need!) out.push({ project: id, slot: k, from, folder });
        else if (pr.base && have + 1 >= sl.need! && wildCards(p).length) out.push({ project: id, slot: k, from, folder, wild: wildCards(p)[0]! });
      } else if (pr.kind === 'release') {
        for (const a of releasable(s, c.seat, pr, k)) out.push({ project: id, slot: k, animal: a, from, folder });
      } else if (animalsIn(s, c.seat).some((a) => a.icons.includes(pr.icon as Icon) && a.icons.some((i) => p.partners.includes(i as Continent)))) {
        out.push({ project: id, slot: k, from, folder });
      }
    });
  };
  for (const id of [...s.baseProjects, ...s.projects]) consider(id, 'board', 0);
  for (const id of p.hand) if (isProject(id)) consider(id, 'hand', 0);
  if (display) for (const f of inRange(c)) { const id = s.display[f - 1]!; if (isProject(id)) consider(id, 'display', f); }
  return out;
}
export const projectValue = (o: ProjectOpt) => `pr:${o.project}:${o.slot}:${o.animal ?? 0}:${o.from}:${o.folder}:${o.wild ?? 0}`;
export function projectLabel(o: ProjectOpt): string {
  const pr = PROJECT[o.project]!;
  const sl = pr.slots[o.slot]!;
  const src = o.from === 'hand' ? ' (از دست)' : o.from === 'display' ? ` (ویترین ${o.folder})` : '';
  return `حمایت از ${nameOf(o.project)}${src}: ${sl.cp} حفاظت${sl.rep ? ` + ${sl.rep} اعتبار` : ''}${o.animal ? ` — رهاسازی ${nameOf(o.animal)}` : ''}${o.wild ? ' (با نشان آزاد)' : ''}`;
}
/** Support a project (validated option). New project cards go to the leftmost space above the board. */
export function supportProject(c: Ctx, o: ProjectOpt) {
  const s = c.s;
  const p = P(c);
  const pr = PROJECT[o.project]!;
  if (o.from !== 'board') {
    if (o.from === 'hand') dropFromHand(p, o.project);
    else { gain(c, 'money', -o.folder); s.display[o.folder - 1] = null; }
    s.projects.unshift(o.project);
    s.ptoks[o.project] = [null, null, null];
    while (s.projects.length > projectSlotsMax(s)) {
      const gone = s.projects.pop()!;
      delete s.ptoks[gone];
      s.extraSupports = s.extraSupports.filter((x) => x.project !== gone);
      s.discard.push(gone);
    }
    if (pr.played?.rep) gain(c, 'rep', pr.played.rep);
  }
  if (o.wild) { const d = p.data[o.wild] as { wild: number }; d.wild -= 1; }
  if (o.animal) releaseAnimal(c, o.animal);
  const toks = s.ptoks[o.project]!;
  if (toks.includes(c.seat)) s.extraSupports.push({ project: o.project, seat: c.seat });
  toks[o.slot] = c.seat;
  p.supported += 1;
  log(c, 'project', { card: o.project, slot: o.slot });
  const sl = pr.slots[o.slot]!;
  gain(c, 'cp', sl.cp);
  gain(c, 'rep', sl.rep);
  later(c, 'core:leftToken');
  emit(s, c.rng, { t: 'project', seat: c.seat, project: o.project, slot: o.slot, ...(o.animal ? { released: o.animal } : {}) });
}
/** Donation cost now (12 once every printed space is covered). In 2-player games the left column is blocked. */
export function donationCost(s: State): number {
  const costs = s.n === 2 ? [2, 5, 7, 10] : [2, 5, 5, 7, 7, 10, 10];
  return costs[s.donations] ?? 12;
}

// ---------------- Final scoring helpers ----------------
/** Conservation points from a table like {3: 1, 6: 2, ...}: the reward of the highest threshold reached (max 4). */
export function fromTable(table: Record<number, number>, n: number): number {
  let best = 0;
  for (const [k, v] of Object.entries(table)) if (n >= Number(k)) best = Math.max(best, v);
  return Math.min(4, best);
}
export const actionKeys = ACTION_KEYS;
export type { Category };
