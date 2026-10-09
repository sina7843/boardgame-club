// Ark Nova («آرک نوا») game module: setup, draft, the answer protocol, projection, legal actions, timeouts and resign.
// The rules themselves live in core.ts (state API used by content) and flow.ts (turn/action/break/end machinery).
// Every decision a player makes is the answer to the prompt at the head of `state.queue` (see content/README.md).
import { z } from 'zod';
import type { ActionHint, Actor, EngineRng, GameModule, ScheduleChange, Transition, Viewer } from '@bg/game-sdk';
import { arkNova, MAP_CHOICES } from './definition.ts';
import { CONTENT } from './content/index.ts';
import {
  ANIMAL, BREAK_MAX, PROJECT, REG, SPONSOR, bonusFa, ctx, donationCost, icons, range, registerContent,
  resetBuffer, shuffle, strengthOf, target, vp, handLimit, flush
} from './core.ts';
import { TILES, answer, answerError, beginTurn, placeOptions, rank, settle } from './flow.ts';
import { CONTINENTS, UNIS, type ActionKey, type Answer, type Player, type Prompt, type State } from './types.ts';
import { SCORING } from './data.ts';

registerContent(CONTENT);

export * from './types.ts';
export {
  ANIMAL, SPONSOR, PROJECT, REG, nameOf, target, vp, appealIncome, range, icons, strengthOf, KIND_FA, ICON_FA, ACTION_FA, UNI_FA, bonusFa,
  BREAK_MAX, MAX_APPEAL
} from './core.ts';
export { TILES, cardsTable, animalMax } from './flow.ts';
export { CELLS, xy, neighbors, isBorder } from './hex.ts';

// ---------------- Actions ----------------
const draftSchema = z.strictObject({ type: z.literal('draft'), keep: z.array(z.number().int()).length(4), map: z.string().max(4).optional() });
const answerSchema = z.strictObject({
  type: z.literal('answer'),
  value: z.string().max(200).optional(),
  ids: z.array(z.number().int()).max(60).optional(),
  kind: z.string().max(8).optional(),
  cells: z.array(z.string().max(5)).max(12).optional(),
  skip: z.literal(true).optional()
});
const resignSchema = z.strictObject({ type: z.literal('resign') });
export const arkNovaActionSchema = z.discriminatedUnion('type', [draftSchema, answerSchema, resignSchema]);
export type ArkAction = z.infer<typeof arkNovaActionSchema>;

const ADVANCED = ['1', '2', '3', '4', '5', '6', '7', '8'];
const isBase = (id: number) => PROJECT[id]!.base;

// ---------------- Setup ----------------
function newPlayer(rng: EngineRng, appeal: number, finals: number[]): Player {
  const tok = () => ({ mult: 0, venom: 0, con: 0 });
  return {
    map: '', money: 25, appeal, cp: 0, rep: 1, x: 0,
    slots: ['animals', ...shuffle<ActionKey>(rng, ['build', 'cards', 'association', 'sponsors'])],
    up: { animals: false, build: false, cards: false, association: false, sponsors: false },
    tok: { animals: tok(), build: tok(), cards: tok(), association: tok(), sponsors: tok() },
    workers: 1, hired: 0, hand: [], finals, zoo: [], data: {}, under: {}, partners: [], unis: [], buildings: [], nextId: 1,
    left: Array<boolean>(7).fill(true), supported: 0, marks: [], taken: [], timeouts: 0
  };
}
/** Put the chosen map on a player: printed buildings (Map A: kiosk + empty 3-space enclosure). */
function setMap(p: Player, id: string) {
  const m = REG.maps.get(id);
  if (!m) throw new Error(`ark-nova: map ${id} is not registered`);
  p.map = id;
  for (const b of m.preset ?? []) p.buildings.push({ id: p.nextId++, kind: b.kind, cells: [...b.cells].sort() });
}

export function setupState(n: number, options: Record<string, unknown>, rng: EngineRng): State {
  const mapOpt = (MAP_CHOICES as readonly string[]).includes(String(options.map)) ? String(options.map) : 'A';
  const first = rng.nextInt(n);
  const deck = shuffle(rng, [...Object.keys(ANIMAL), ...Object.keys(SPONSOR)].map(Number).concat(Object.keys(PROJECT).map(Number).filter((id) => !isBase(id))));
  const baseDeck = shuffle(rng, Object.keys(PROJECT).map(Number).filter(isBase));
  const baseProjects = baseDeck.splice(0, n === 4 ? 4 : 3);
  const ptoks: State['ptoks'] = {};
  // 2 players: the left level of the 1st, the middle level of the 2nd and the right level of the 3rd base project are blocked.
  baseProjects.forEach((id, i) => { ptoks[id] = [null, null, null]; if (n === 2) ptoks[id]![i] = -1; });
  const tiles = shuffle(rng, Object.keys(TILES));
  const finalsDeck = shuffle(rng, SCORING.map((x) => x.id));
  const players = Array.from({ length: n }, (_, seat) => newPlayer(rng, (seat - first + n) % n, finalsDeck.splice(0, 2)));
  const display = Array.from({ length: 6 }, () => deck.pop()!);
  const advanced = shuffle(rng, [...ADVANCED]);
  const drafts = players.map(() => ({ cards: deck.splice(-8, 8), maps: mapOpt === 'advanced' ? advanced.splice(0, 2) : [] }));
  if (mapOpt !== 'advanced') for (const p of players) setMap(p, mapOpt);
  const s: State = {
    n, players, stage: 'draft', current: first, first, drafts, deck, discard: [], display, finalsDeck,
    brk: 0, brkMax: BREAK_MAX[n]!, breakDue: null, zoosAvail: [...CONTINENTS], unisAvail: [...UNIS],
    assoc: { rep: [], zoo: [], uni: [], project: [] }, donations: 0, baseProjects, baseDeck, projects: [], ptoks, extraSupports: [],
    bonusTiles: { 5: tiles.slice(0, 2), 8: tiles.slice(2, 4) }, cp10: false, endAt: null, turnsDone: 0, inTurn: false, act: null,
    queue: [], venomCleared: false, turnUsed: [], seq: 0, log: [], final: null, outcome: null, options: { map: mapOpt }
  };
  return options.deal === 'tutorial' && n === 2 && mapOpt === 'A' ? tutorialState(s, rng) : s;
}

/**
 * Tutorial teaching position (2 players, Map A, learner = seat 0 starts). Late game: the learner's appeal (88) is just
 * short of the meeting point and they hold a European Pond Turtle. Build → Animals → Association (a base project) → the
 * left-edge conservation token make the tracks cross; the scripted opponent takes X-token actions. Each player keeps
 * 1 Final Scoring card, so the end needs no discard prompt.
 */
function tutorialState(s: State, rng: EngineRng): State {
  const used = [484, 486, 413, 401, 432, 404];
  s.deck = s.deck.filter((id) => !used.includes(id));
  s.discard.push(...s.drafts.flatMap((d) => d!.cards).filter((id) => !used.includes(id)));
  s.drafts = s.drafts.map(() => null);
  s.display = s.display.map((id) => (used.includes(id!) ? s.deck.pop()! : id));
  s.baseDeck.push(...s.baseProjects);
  s.baseDeck = s.baseDeck.filter((id) => id !== 109 && id !== 107 && id !== 110);
  s.baseProjects = [109, 107, 110];
  s.ptoks = { 109: [-1, null, null], 107: [null, -1, null], 110: [null, null, -1] };
  s.finalsDeck.push(...s.players.flatMap((p) => p.finals));
  s.finalsDeck = s.finalsDeck.filter((id) => id !== 10 && id !== 7);
  const [me, op] = s.players as [Player, Player];
  Object.assign(me, {
    money: 20, appeal: 88, cp: 8, rep: 6, x: 0, hand: [484, 401], finals: [10], zoo: [413, 486],
    slots: ['cards', 'sponsors', 'build', 'animals', 'association'], marks: ['c2', 'c5', 'c8', 'r5'], supported: 2
  } satisfies Partial<Player>);
  me.up.sponsors = true;
  me.buildings.find((b) => b.kind === 'e3')!.full = true; // the Cougar (rock next to 1_12)
  me.buildings.push({ id: me.nextId++, kind: 'e1', cells: ['1_4'], full: true }); // the Wall Lizard (rock next to 1_2)
  Object.assign(op, {
    money: 14, appeal: 60, cp: 7, rep: 4, x: 0, hand: [432, 404], finals: [7], zoo: [], marks: ['c2', 'c5'], supported: 2,
    slots: ['animals', 'cards', 'build', 'association', 'sponsors']
  } satisfies Partial<Player>);
  Object.assign(s, { stage: 'play', first: 0, current: 0 });
  beginTurn(ctx(s, 0, rng));
  settle(s, rng);
  return s;
}

function draftError(s: State, seat: number, a: Extract<ArkAction, { type: 'draft' }>): string | null {
  const d = s.drafts[seat];
  if (s.stage !== 'draft' || !d) return 'NOT_DRAFTING';
  if (new Set(a.keep).size !== 4 || !a.keep.every((id) => d.cards.includes(id))) return 'BAD_DRAFT';
  if (d.maps.length ? !a.map || !d.maps.includes(a.map) : a.map !== undefined) return 'BAD_MAP';
  return null;
}
function applyDraft(s: State, seat: number, keep: number[], map: string | undefined, rng: EngineRng) {
  const d = s.drafts[seat]!;
  const p = s.players[seat]!;
  p.hand = [...keep];
  s.discard.push(...d.cards.filter((id) => !keep.includes(id)));
  if (map) setMap(p, map);
  s.drafts[seat] = null;
  if (s.drafts.every((x) => x === null)) {
    s.stage = 'play';
    s.current = s.first;
    beginTurn(ctx(s, s.first, rng));
    settle(s, rng);
  }
}

// ---------------- Helpers ----------------
const head = (s: State) => s.queue[0] as Prompt | undefined;
export function pendingSeatsOf(s: State): number[] {
  if (s.outcome) return [];
  if (s.stage === 'draft') return s.drafts.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  const h = head(s);
  return h ? [h.seat] : [];
}
/** Deadline signature: a new deadline starts whenever the waiting seat or the turn changes (draft: one shared deadline). */
const sig = (s: State) => (s.stage === 'draft' ? 'draft' : `${s.turnsDone}|${pendingSeatsOf(s).join(',')}`);
function done(before: string, s: State, events: Transition<State>['internalEvents']): Transition<State> {
  const changes: ScheduleChange[] = s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : sig(s) !== before ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges: changes };
}
function resign(s: State, seat: number) {
  const others = rank(s, s.players.map((_, k) => k).filter((k) => k !== seat));
  s.outcome = { placements: [...others, { seat, place: s.n, score: vp(s.players[seat]!) }], reason: 'resign' };
  s.stage = 'over';
  s.queue = [];
  s.act = null;
}
/** Passive answer used on timeout: X-token action with the slot-1 card, skip optional prompts, else the first option. */
export function autoAnswer(s: State, q: Prompt, rng: EngineRng): Answer {
  if (q.optional) return { skip: true };
  if (q.k === 'option') {
    const x = q.fx === 'core:turn' ? q.options.find((o) => o.value === `x:${s.players[q.seat]!.slots[0]}`) : undefined;
    return { value: (x ?? q.options[0]!).value };
  }
  if (q.k === 'pick') return { ids: q.ids.slice(0, q.min) };
  const o = placeOptions(ctx(s, q.seat, rng, q.card), q)[0]!;
  return { kind: o.kind, cells: o.cells };
}

// ---------------- Projection ----------------
function mapView(id: string) {
  const m = REG.maps.get(id);
  if (!m) return null;
  return {
    id, nameFa: m.nameFa, textFa: m.textFa ?? '', water: m.water, rock: m.rock, blocked: m.blocked ?? [], upgrade: m.upgrade,
    bonuses: Object.fromEntries(Object.entries(m.bonuses).map(([k, b]) => [k, bonusFa(b)])),
    left: m.left.map((l) => ({ label: bonusFa(l.b), income: l.income })),
    partner: Object.fromEntries(Object.entries(m.partner).map(([k, b]) => [k, bonusFa(b)])),
    uni: Object.fromEntries(Object.entries(m.uni).map(([k, b]) => [k, bonusFa(b)])),
    worker: Object.fromEntries(Object.entries(m.worker).map(([k, b]) => [k, bonusFa(b)])),
    marks: m.marks ?? {}, turnAbility: m.turn?.labelFa ?? null
  };
}
export type MapView = NonNullable<ReturnType<typeof mapView>>;

export function projectState(s: State, viewer: Viewer) {
  const me = viewer.kind === 'player' ? viewer.seat : null;
  const h = head(s);
  let prompt: Record<string, unknown> | null = null;
  if (h && s.stage === 'play') {
    prompt = { seat: h.seat, k: h.k, label: h.label, optional: !!h.optional };
    if (h.seat === me) {
      if (h.k === 'option') prompt.options = h.options;
      if (h.k === 'pick') Object.assign(prompt, { ids: h.ids, min: h.min, max: h.max });
      if (h.k === 'place') Object.assign(prompt, { kinds: h.kinds, free: h.free, placements: placeOptions(ctx(s, h.seat, { nextInt: () => 0 }, h.card), h) });
    }
  }
  const mapIds = new Set(s.players.map((p) => p.map).filter(Boolean));
  if (me !== null) for (const m of s.drafts[me]?.maps ?? []) mapIds.add(m);
  const c0 = (seat: number) => ctx(s, seat, { nextInt: () => 0 });
  return {
    n: s.n, stage: s.stage, current: s.current, first: s.first, seq: s.seq,
    deckCount: s.deck.length, discardCount: s.discard.length,
    display: s.stage === 'draft' ? s.display.map(() => null) : [...s.display],
    brk: s.brk, brkMax: s.brkMax, zoosAvail: [...s.zoosAvail], unisAvail: [...s.unisAvail], assoc: structuredClone(s.assoc),
    donations: s.donations, donationCost: donationCost(s), baseProjects: [...s.baseProjects], projects: [...s.projects],
    ptoks: structuredClone(s.ptoks), extraSupports: structuredClone(s.extraSupports), bonusTiles: structuredClone(s.bonusTiles),
    cp10: s.cp10, endAt: s.endAt, turnsDone: s.turnsDone, inTurn: s.inTurn,
    act: s.act ? { seat: s.act.seat, card: s.act.card, owner: s.act.owner, strength: s.act.strength, up: s.act.up, count: s.act.count } : null,
    log: structuredClone(s.log), final: structuredClone(s.final), outcome: s.outcome, options: { ...s.options },
    maps: Object.fromEntries([...mapIds].map((id) => [id, mapView(id)])),
    players: s.players.map((p, seat) => ({
      seat, map: p.map, money: p.money, appeal: p.appeal, cp: p.cp, rep: p.rep, x: p.x, vp: vp(p), target: target(p.cp),
      slots: [...p.slots], strengths: p.slots.map((k) => strengthOf(p, k)), up: { ...p.up }, tok: structuredClone(p.tok),
      workers: p.workers, hired: p.hired, handCount: p.hand.length, finalsCount: p.finals.length, zoo: [...p.zoo], data: structuredClone(p.data),
      underCount: Object.fromEntries(Object.entries(p.under).map(([k, v]) => [k, v.length])), partners: [...p.partners], unis: [...p.unis],
      buildings: structuredClone(p.buildings), left: [...p.left], supported: p.supported, marks: [...p.marks], taken: [...p.taken],
      icons: icons(s, seat), range: range(p), handLimit: p.map ? handLimit(c0(seat)) : 3, drafting: s.drafts[seat] !== null && s.stage === 'draft'
    })),
    me: me === null ? null : {
      seat: me, hand: [...s.players[me]!.hand], finals: [...s.players[me]!.finals], under: structuredClone(s.players[me]!.under),
      draft: s.drafts[me] ? structuredClone(s.drafts[me]) : null
    },
    prompt,
    pending: pendingSeatsOf(s)
  };
}
export type ArkView = ReturnType<typeof projectState>;

export function legal(s: State, viewer: Viewer): ActionHint[] {
  if (s.outcome || viewer.kind !== 'player') return [];
  const seat = viewer.seat;
  const out: ActionHint[] = [];
  const d = s.drafts[seat];
  if (s.stage === 'draft' && d) out.push({ type: 'draft', cards: [...d.cards], keep: 4, maps: [...d.maps] });
  const h = head(s);
  if (s.stage === 'play' && h && h.seat === seat) {
    if (h.k === 'option') for (const o of h.options) out.push({ type: 'answer', value: o.value });
    if (h.k === 'pick') out.push({ type: 'answer', pick: [...h.ids], min: h.min, max: h.max });
    if (h.k === 'place') for (const o of placeOptions(ctx(s, seat, { nextInt: () => 0 }, h.card), h)) out.push({ type: 'answer', kind: o.kind, cells: o.cells });
    if (h.optional) out.push({ type: 'answer', skip: true });
  }
  out.push({ type: 'resign' });
  return out;
}

// ---------------- Module ----------------
export const arkNovaModule: GameModule<State, ArkAction, ArkView> = {
  manifest: arkNova.manifest,
  actionSchema: arkNovaActionSchema as unknown as z.ZodType<ArkAction>,

  setup: ({ playerCount, options, rng }) => setupState(playerCount, options, rng),

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.n) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (a.type === 'draft') { const e = draftError(s, actor.seat, a); return e ? { ok: false, errorCode: e } : { ok: true }; }
    const h = head(s);
    if (s.stage !== 'play' || !h) return { ok: false, errorCode: 'NO_PROMPT' };
    if (h.seat !== actor.seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const e = answerError(ctx(s, h.seat, { nextInt: () => 0 }, h.card), h, a);
    return e ? { ok: false, errorCode: e } : { ok: true };
  },

  apply(s, actor, a, ectx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const before = sig(s);
    resetBuffer();
    s.seq += 1;
    if (a.type === 'resign') { resign(s, seat); return done(before, s, [{ type: 'resigned', seat }]); }
    if (a.type === 'draft') { applyDraft(s, seat, a.keep, a.map, ectx.rng); return done(before, s, [{ type: 'drafted', seat }]); }
    s.players[seat]!.timeouts = 0;
    const { type: _t, ...ans } = a;
    answer(s, ectx.rng, ans);
    return done(before, s, [{ type: 'answered', seat }]);
  },

  project: (s, viewer) => projectState(s, viewer),
  legalActions: (s, viewer) => legal(s, viewer),
  outcome: (s) => s.outcome,

  onTimeout(s, _e, ectx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const before = sig(s);
    resetBuffer();
    s.seq += 1;
    if (s.stage === 'draft') {
      const seats = pendingSeatsOf(s);
      for (const seat of seats) {
        const d = s.drafts[seat]!;
        s.players[seat]!.timeouts += 1;
        applyDraft(s, seat, d.cards.slice(0, 4), d.maps[0], ectx.rng);
      }
      return done(before, s, [{ type: 'timed-out', seats }]);
    }
    const seat = pendingSeatsOf(s)[0];
    if (seat === undefined) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    s.players[seat]!.timeouts += 1;
    const turn = s.turnsDone;
    // Answer this seat's prompts until the turn passes, someone else must decide, or the game ends.
    for (let guard = 0; guard < 500; guard++) {
      const h = head(s);
      if (!h || h.seat !== seat || s.outcome || s.turnsDone !== turn) break;
      answer(s, ectx.rng, autoAnswer(s, h, ectx.rng));
      flush(s);
    }
    return done(before, s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => pendingSeatsOf(s),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'پایان یک بازی است. جذابیت شما ۸۸ و امتیاز حفاظت‌تان ۸ است؛ با ۸ حفاظت عدد هدف ۹۸ است، پس هنوز ۱۰ جذابیت کم دارید. هر نوبت یکی از ۵ کارت کنش را بازی می‌کنید و قدرتش برابر شمارهٔ خانه‌ای است که در آن است (۱ تا ۵)؛ کارت بازی‌شده به خانهٔ ۱ می‌رود و بقیه یک خانه جلو می‌روند. در سه نوبت یک محوطه می‌سازید، یک لاک‌پشت در آن می‌گذارید و از یک پروژهٔ حفاظت پشتیبانی می‌کنید تا دو نشان از هم عبور کنند.',
    steps: [
      { instructionFa: 'کارت «ساخت» در خانهٔ ۳ است، پس قدرتش ۳ است: می‌توانید یک ساختمان تا ۳ خانه بسازید و برای هر خانه ۲ پول بدهید. کنش ساخت با قدرت ۳ را انتخاب کنید.', expected: { type: 'answer', value: 'a:build:0' }, reply: null },
      { instructionFa: 'یک محوطهٔ ۱ خانه روی خانهٔ 2_9 بسازید: کنار محوطهٔ ۳ خانه‌ای است (هر ساختمان باید کنار ساختمان‌های قبلی باشد)، کنار آب است و پاداش چاپی ۵ پول آن خانه را هم می‌گیرید. هزینه ۲ پول است.', expected: { type: 'answer', kind: 'e1', cells: ['2_9'] }, reply: { type: 'answer', value: 'x:cards' } },
      { instructionFa: 'حریف کنش نشان X را انجام داد: کارتی را به خانهٔ ۱ برد و ۱ نشان X گرفت. «ساخت» حالا در خانهٔ ۱ است و «حیوانات» به خانهٔ ۴ رسیده. کنش حیوانات با قدرت ۴ را انتخاب کنید (در سمت I با قدرت ۲ تا ۴ یک حیوان بازی می‌شود).', expected: { type: 'answer', value: 'a:animals:0' }, reply: null },
      { instructionFa: 'لاک‌پشت برکه‌ای اروپایی ۹ پول می‌خواهد، یک محوطهٔ خالی دست‌کم ۱ خانه و ۱ خانهٔ آب در کنار آن. محوطهٔ تازه همهٔ این‌ها را دارد. لاک‌پشت را بازی کنید: ۴ جذابیت و نمادهای خزنده و اروپا می‌گیرید.', expected: { type: 'answer', value: '484@4@0' }, reply: { type: 'answer', value: 'x:cards' } },
      { instructionFa: 'جذابیت ۹۲ شد. «انجمن» در خانهٔ ۵ است. کنش انجمن با قدرت ۵ را انتخاب کنید: پشتیبانی از پروژهٔ حفاظت به قدرت ۵ و یک کارمند نیاز دارد.', expected: { type: 'answer', value: 'a:association:0' }, reply: null },
      { instructionFa: 'حالا ۲ نماد خزنده دارید. از پروژهٔ پایهٔ «خزندگان» در سطح ۲ نماد پشتیبانی کنید: ۲ امتیاز حفاظت می‌گیرید و با ۱۰ حفاظت عدد هدف به ۹۴ می‌رسد. (در بازی دونفره یک سطح هر پروژهٔ پایه بسته است.)', expected: { type: 'answer', value: 'pr:109:2:0:board:0:0' }, reply: null },
      { instructionFa: 'هر پشتیبانی یک نشان از لبهٔ نقشه آزاد می‌کند و پاداشش را می‌دهد. خانهٔ «۱ امتیاز حفاظت» را بردارید: حفاظت ۱۱ می‌شود و عدد هدف ۹۱؛ جذابیت ۹۲ از آن عبور می‌کند و پایان بازی اعلام می‌شود.', expected: { type: 'answer', value: '3' }, reply: { type: 'answer', value: 'x:cards' } }
    ],
    completedFa: 'بردید! نشان‌ها از هم عبور کردند و حریف یک نوبت آخر داشت. در امتیاز پایانی کارت «پارک صخره‌نوردی» با ۲ نماد صخره ۱ حفاظت داد: ۱۲ حفاظت یعنی عدد هدف ۸۸ (هر حفاظت تا ۱۰ دو خانه و پس از آن سه خانه از ۱۱۴ کم می‌کند). امتیاز شما ۹۲ − ۸۸ = ۴ و امتیاز حریف ۶۰ − ۱۰۰ یعنی منفی ۴۰ شد.'
  }
};


/** Full engine API for tests and content chunks (core: state helpers; flow: turn machinery). */
export * as core from './core.ts';
export * as flow from './flow.ts';
export * as hex from './hex.ts';
/** Test helper: drop the pending prompts and offer `seat` a fresh turn prompt (after a test edited the state). */
export function restartTurn(s: State, seat: number, rng: EngineRng = { nextInt: () => 0 }) {
  resetBuffer();
  s.queue = []; s.act = null; s.inTurn = false; s.current = seat;
  beginTurn(ctx(s, seat, rng));
  settle(s, rng);
}
