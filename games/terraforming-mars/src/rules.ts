// Terraforming Mars (base game, Tharsis), 2–5 players. Generation 1: everyone secretly picks 1 of 2 corporations and
// buys any of 10 cards (3 M€ each). Each generation: research (4 cards, optional draft, buy at 3 M€), action phase
// (turns of 1–2 actions until everyone passed), production (energy→heat, then production + TR as M€). When
// temperature (+8 °C), oxygen (14 %) and oceans (9) are all maxed at the end of a generation, players may convert
// plants into greenery in turn order, then the game is scored: TR + milestones + awards + greenery + cities + cards;
// most M€ breaks ties, otherwise the place is shared. Hidden: hands, deck, offers, draft packs, prompt contents.
import { z } from 'zod';
import type { ActionHint, Actor, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { RES, type Answer, type PlayerState, type Prompt, type TmState } from './api.ts';
import {
  AWARD_COSTS, AWARDS, MILESTONE_COST, MILESTONES, PROJECTS, G, autoAnswer, autoPay, awardError, canConvertHeat, canConvertPlants,
  answerError, cardCost, def, doPay, drawCards, greeneryPlants, milestoneError, payError, payOptsFor, playCard,
  playError, projectCost, projectError, promptOptions, resolvePrompt, runEffects, runProject, score, shuffle, tableau, terraformed,
  maxPay, type Pay, type Project, type Rt, type Score
} from './core.ts';
import { CARDS } from './content/index.ts';
import { terraformingMars } from './definition.ts';

export * from './api.ts';
export { ADJ, MARS, NAME_FA, SPACE, SPACES } from './board.ts';
export {
  AWARD_COSTS, AWARDS, MILESTONE_COST, MILESTONES, PROJECTS, PROJECT_FA, RES_FA, CARDRES_FA, awardPoints, cardCost, def, legalSpaces, projectCost, score,
  tableau, tagsOf, type Pay, type Project, type Score
} from './core.ts';
export { CARD, CARDS } from './content/index.ts';

const cid = z.string().regex(/^[0-9A-Z]{3}$/);
const n = z.number().int().min(0).max(999);
const pay = z.strictObject({ mc: n.optional(), steel: n.optional(), titanium: n.optional(), heat: n.optional() });
const project = z.enum(Object.keys(PROJECTS) as [Project, ...Project[]]);
export const tmAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('corp'), corp: cid, cards: z.array(cid).max(10) }),
  z.strictObject({ type: z.literal('draft'), card: cid }),
  z.strictObject({ type: z.literal('research'), cards: z.array(cid).max(4) }),
  z.strictObject({ type: z.literal('play'), card: cid, pay: pay.optional() }),
  z.strictObject({ type: z.literal('cardAction'), card: cid, pay: pay.optional() }),
  z.strictObject({ type: z.literal('project'), project, pay: pay.optional(), cards: z.array(cid).max(200).optional() }),
  z.strictObject({ type: z.literal('milestone'), id: z.string().max(20), pay: pay.optional() }),
  z.strictObject({ type: z.literal('award'), id: z.string().max(20), pay: pay.optional() }),
  z.strictObject({ type: z.literal('convertPlants') }),
  z.strictObject({ type: z.literal('convertHeat') }),
  z.strictObject({ type: z.literal('firstAction') }),
  z.strictObject({
    type: z.literal('respond'), space: z.string().regex(/^\d{2}$/).optional(), seat: z.number().int().min(0).max(4).optional(),
    card: cid.optional(), index: z.number().int().min(0).max(20).optional(), cards: z.array(cid).max(20).optional(), amount: n.optional(), skip: z.literal(true).optional()
  }),
  z.strictObject({ type: z.literal('endTurn') }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type TmAction = z.infer<typeof tmAction>;

export interface TmPublicPlayer {
  corp: string | null; tr: number; res: PlayerState['res']; prod: PlayerState['prod']; played: string[]; cardRes: Record<string, number>;
  used: string[]; passed: boolean; hand: number; ready: boolean; score: Score;
}
export interface TmView extends Omit<TmState, 'players' | 'deck' | 'discard' | 'queue' | 'timeouts'> {
  deck: number;
  discard: number;
  players: TmPublicPlayer[];
  me: Pick<PlayerState, 'hand' | 'corpOffer' | 'offer' | 'pack' | 'drafted' | 'pick' | 'draftPick'> | null;
  /** The pending prompt if it is the viewer's (contents may be private); otherwise only who is deciding. */
  prompt: Prompt | null;
  promptSeat: number | null;
}

// ---------------- Setup ----------------
const emptyRes = () => Object.fromEntries(RES.map((r) => [r, 0])) as PlayerState['res'];
function newPlayer(): PlayerState {
  return {
    corp: null, tr: 20, res: emptyRes(), prod: emptyRes(), hand: [], played: [], cardRes: {}, used: [], passed: false, trRaised: false,
    firstActionDone: false, nextDiscount: 0, nextReqBonus: 0, corpOffer: [], offer: [], pick: null, pack: [], drafted: [], draftPick: null
  };
}
const opt = (v: unknown, dflt: boolean) => (v === undefined ? dflt : v === true || v === 'on');

// ---------------- Flow ----------------
type Events = Transition<TmState>['internalEvents'];
const step = (s: TmState, events: Events): Transition<TmState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: TmState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, v: score(s, seat).total, mc: s.players[seat]!.res.mc })).sort((a, b) => b.v - a.v || b.mc - a.mc);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.v === x.v && q.mc === x.mc ? out[i - 1]!.place : i + 1, score: x.v }); });
  return out;
}
function finishGame(s: TmState) {
  s.phase = 'end';
  s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' };
}

function startGeneration(s: TmState, rng: EngineRng) {
  s.generation += 1;
  s.firstPlayer = (s.firstPlayer + 1) % s.playerCount;
  for (const p of s.players) Object.assign(p, { passed: false, used: [], trRaised: false, nextDiscount: 0, nextReqBonus: 0, pick: null, draftPick: null, drafted: [], offer: [], pack: [] });
  if (s.draft) {
    for (const p of s.players) p.pack = drawCards(s, rng, 4);
    s.phase = 'draft';
    settleDraft(s);
  } else {
    for (const p of s.players) p.offer = drawCards(s, rng, 4);
    s.phase = 'research';
    settleResearch(s);
  }
}

/** Packs with at most one card left are taken automatically; then the research buy begins. */
function settleDraft(s: TmState) {
  if (s.players.some((p) => p.pack.length > 1)) return;
  for (const p of s.players) { p.drafted.push(...p.pack); p.pack = []; p.offer = p.drafted; p.drafted = []; }
  s.phase = 'research';
  settleResearch(s);
}
function settleResearch(s: TmState) {
  for (const p of s.players) if (!p.offer.length && !p.pick) p.pick = { cards: [] };
  if (s.players.some((p) => !p.pick)) return;
  s.players.forEach((p, seat) => {
    const bought = p.pick!.cards;
    // M€ first, then heat for Helion (validated when the pick was made; nothing is spent between pick and settle).
    doPay(s, seat, autoPay(s, seat, 3 * bought.length, {}) ?? {});
    p.hand.push(...bought);
    s.discard.push(...p.offer.filter((c) => !bought.includes(c)));
    p.offer = []; p.pick = null;
  });
  beginActions(s);
}
function beginActions(s: TmState) {
  s.phase = 'action';
  s.current = s.firstPlayer;
  s.actionsTaken = 0;
}

function nextTurn(s: TmState, rng: EngineRng) {
  s.actionsTaken = 0;
  for (let k = 1; k <= s.playerCount; k++) {
    const seat = (s.current + k) % s.playerCount;
    if (!s.players[seat]!.passed) { s.current = seat; return; }
  }
  endGeneration(s, rng);
}

function endGeneration(s: TmState, rng: EngineRng) {
  for (const p of s.players) {
    p.res.heat += p.res.energy;
    p.res.energy = 0;
    p.res.mc = Math.max(0, p.res.mc + p.prod.mc + p.tr);
    for (const r of RES) if (r !== 'mc') p.res[r] += p.prod[r];
  }
  if (terraformed(s)) {
    s.phase = 'final';
    for (const p of s.players) p.passed = false;
    finalFrom(s, s.firstPlayer);
    return;
  }
  startGeneration(s, rng);
}

/** Final greenery round: the next seat (from `from`, in turn order) that has not passed and can still convert plants. */
function finalFrom(s: TmState, from: number) {
  for (let k = 0; k < s.playerCount; k++) {
    const seat = (from + k) % s.playerCount;
    const p = s.players[seat]!;
    if (p.passed) continue;
    if (canConvertPlants(s, seat)) { s.current = seat; return; }
    p.passed = true;
  }
  finishGame(s);
}
function nextFinal(s: TmState) {
  s.players[s.current]!.passed = true;
  finalFrom(s, (s.current + 1) % s.playerCount);
}

/** End of a step: queue the new prompts, drop prompts that have no option, and close a finished action. */
function settle(s: TmState, rt: Rt, actionStep: boolean) {
  s.queue = [...rt.buf, ...s.queue];
  rt.buf = [];
  while (s.queue.length && !promptOptions(s, s.queue[0]!).length) s.queue.shift();
  if (s.queue.length || s.outcome) return;
  if (s.phase === 'action' && actionStep && s.actionsTaken >= 2) nextTurn(s, rt.rng);
  if (s.phase === 'final') finalFrom(s, s.current);
}

function corpSelect(s: TmState, rng: EngineRng) {
  if (s.players.some((p) => !p.pick)) return;
  const rt: Rt = { rng, buf: [] };
  s.players.forEach((p, seat) => {
    const c = def(p.pick!.corp!);
    p.corp = c.id;
    p.res.mc += c.startMc ?? 0;
    const g = new G(s, seat, c.id, rt);
    runEffects(g, c);
    c.start?.(g);
    const cards = p.pick!.cards;
    if (!c.freeStartCards) p.res.mc -= 3 * cards.length;
    p.hand.push(...cards);
    s.discard.push(...p.offer.filter((x) => !cards.includes(x)));
    p.firstActionDone = !c.firstAction;
    p.offer = []; p.corpOffer = []; p.pick = null;
  });
  s.queue.push(...rt.buf);
  beginActions(s);
}

/**
 * Tutorial-only teaching position: the last generation. Temperature +4 °C (2 steps left), oxygen 13 % (1 left), 8 oceans
 * (1 left). The learner (Thorgate, TR 24) has a city on area 30 between greeneries 38 and 39, Asteroid in hand, 2 titanium,
 * 8 plants and 8 heat; the opponent (CrediCor, TR 30) has a city and a greenery and Asteroid Mining (2 VP) in play.
 */
function tutorialPosition(s: TmState): TmState {
  const zero = () => emptyRes();
  Object.assign(s, { generation: 9, phase: 'action', firstPlayer: 0, current: 0, temperature: 4, oxygen: 13, oceans: 8 });
  for (const id of ['04', '06', '07', '13', '28', '32', '33', '34']) s.tiles[id] = { kind: 'ocean', owner: null };
  s.tiles['30'] = { kind: 'city', owner: 0 };
  s.tiles['38'] = { kind: 'greenery', owner: 0 };
  s.tiles['39'] = { kind: 'greenery', owner: 0 };
  s.tiles['10'] = { kind: 'city', owner: 1 };
  s.tiles['11'] = { kind: 'greenery', owner: 1 };
  const [me, op] = s.players as [PlayerState, PlayerState];
  Object.assign(me, { corp: 'R13', tr: 24, firstActionDone: true, hand: ['009'], played: ['141'], res: { ...zero(), mc: 40, titanium: 2, plants: 8, heat: 8 }, prod: { ...zero(), mc: 2, energy: 2 } });
  Object.assign(op, { corp: 'R08', tr: 30, firstActionDone: true, hand: ['078', '118'], played: ['040'], res: { ...zero(), mc: 20 }, prod: { ...zero(), mc: 3, titanium: 2 } });
  s.deck = s.deck.filter((id) => !['009', '141', '078', '118', '040'].includes(id));
  return s;
}

const isPlayer = (a: Actor): a is Extract<Actor, { kind: 'player' }> => a.kind === 'player';

function actionPay(s: TmState, seat: number, cost: number, o: Parameters<typeof autoPay>[3], p?: Pay): Pay | string {
  if (!p) return autoPay(s, seat, cost, o) ?? 'CANNOT_AFFORD';
  return payError(s, seat, cost, o, p) ?? p;
}

function cardActionError(s: TmState, seat: number, id: string): string | null {
  if (!tableau(s, seat).includes(id)) return 'NOT_IN_PLAY';
  const a = def(id).action;
  if (!a) return 'NO_ACTION';
  if (s.players[seat]!.used.includes(id)) return 'ACTION_USED';
  if (a.can && !a.can(new G(s, seat, id, { rng: { nextInt: () => 0 }, buf: [] }))) return 'CANNOT_USE';
  if ((a.cost ?? 0) > maxPay(s, seat, a.payWith ?? {})) return 'CANNOT_AFFORD';
  return null;
}

function validateAction(s: TmState, seat: number, a: TmAction): string | null {
  const p = s.players[seat]!;
  if (a.type === 'resign') return null;
  switch (s.phase) {
    case 'corp': {
      if (a.type !== 'corp') return 'WRONG_PHASE';
      if (p.pick) return 'ALREADY_CHOSEN';
      if (!p.corpOffer.includes(a.corp) || new Set(a.cards).size !== a.cards.length || !a.cards.every((c) => p.offer.includes(c))) return 'BAD_CARDS';
      const c = def(a.corp);
      return c.freeStartCards || 3 * a.cards.length <= (c.startMc ?? 0) ? null : 'CANNOT_AFFORD';
    }
    case 'draft':
      if (a.type !== 'draft') return 'WRONG_PHASE';
      if (p.draftPick || p.pack.length < 2) return 'ALREADY_CHOSEN';
      return p.pack.includes(a.card) ? null : 'BAD_CARDS';
    case 'research':
      if (a.type !== 'research') return 'WRONG_PHASE';
      if (p.pick) return 'ALREADY_CHOSEN';
      if (new Set(a.cards).size !== a.cards.length || !a.cards.every((c) => p.offer.includes(c))) return 'BAD_CARDS';
      return 3 * a.cards.length <= maxPay(s, seat, {}) ? null : 'CANNOT_AFFORD';
    case 'end': return 'GAME_FINISHED';
    default: break;
  }
  if (s.queue.length) {
    const q = s.queue[0]!;
    if (q.seat !== seat) return 'NOT_YOUR_TURN';
    if (a.type !== 'respond') return 'ANSWER_PENDING';
    return answerError(s, q, a);
  }
  if (s.current !== seat) return 'NOT_YOUR_TURN';
  if (s.phase === 'final') {
    if (a.type === 'pass') return null;
    if (a.type === 'convertPlants') return canConvertPlants(s, seat) ? null : 'CANNOT_CONVERT';
    return 'WRONG_PHASE';
  }
  if (!p.firstActionDone && a.type !== 'firstAction') return 'FIRST_ACTION_REQUIRED';
  switch (a.type) {
    case 'firstAction': return p.firstActionDone ? 'ALREADY_CHOSEN' : null;
    case 'play': {
      const e = playError(s, seat, a.card);
      if (e) return e;
      const c = def(a.card);
      const r = actionPay(s, seat, cardCost(s, seat, c), payOptsFor(c), a.pay);
      return typeof r === 'string' ? r : null;
    }
    case 'cardAction': {
      const e = cardActionError(s, seat, a.card);
      if (e) return e;
      const ad = def(a.card).action!;
      const r = actionPay(s, seat, ad.cost ?? 0, ad.payWith ?? {}, a.pay);
      return typeof r === 'string' ? r : null;
    }
    case 'project': {
      const e = projectError(s, seat, a.project, a.cards);
      if (e || a.project === 'sellPatents') return e;
      const r = actionPay(s, seat, projectCost(s, seat, a.project), {}, a.pay);
      return typeof r === 'string' ? r : null;
    }
    case 'milestone': {
      const e = milestoneError(s, seat, a.id);
      if (e) return e;
      const r = actionPay(s, seat, MILESTONE_COST, {}, a.pay);
      return typeof r === 'string' ? r : null;
    }
    case 'award': {
      const e = awardError(s, seat, a.id);
      if (e) return e;
      const r = actionPay(s, seat, AWARD_COSTS[s.awards.length]!, {}, a.pay);
      return typeof r === 'string' ? r : null;
    }
    case 'convertPlants': return canConvertPlants(s, seat) ? null : 'CANNOT_CONVERT';
    case 'convertHeat': return canConvertHeat(s, seat) ? null : 'CANNOT_CONVERT';
    case 'endTurn': return s.actionsTaken === 1 ? null : 'NO_ACTION_TAKEN';
    case 'pass': return null;
    default: return 'WRONG_PHASE';
  }
}

function applyAction(s: TmState, seat: number, a: TmAction, rng: EngineRng): Events {
  const p = s.players[seat]!;
  const rt: Rt = { rng, buf: [] };
  const log = (kind: string, card?: string, detail?: string) => { s.log.push({ seat, kind, ...(card ? { card } : {}), ...(detail ? { detail } : {}) }); while (s.log.length > 30) s.log.shift(); };
  switch (a.type) {
    case 'corp': p.pick = { corp: a.corp, cards: a.cards }; corpSelect(s, rng); return [{ type: 'corp', seat }];
    case 'draft': {
      p.draftPick = a.card;
      if (s.players.some((q) => q.pack.length > 1 && !q.draftPick)) return [{ type: 'draft', seat }];
      const dir = s.generation % 2 === 0 ? 1 : -1;
      const packs = s.players.map((q) => { if (q.draftPick) { q.drafted.push(q.draftPick); q.pack = q.pack.filter((c) => c !== q.draftPick); } q.draftPick = null; return q.pack; });
      s.players.forEach((q, k) => { q.pack = packs[(k - dir + s.playerCount) % s.playerCount]!; });
      settleDraft(s);
      return [{ type: 'draft', seat }];
    }
    case 'research': p.pick = { cards: a.cards }; settleResearch(s); return [{ type: 'research', seat }];
    case 'respond': {
      const q = s.queue.shift()!;
      resolvePrompt(s, rt, q, a as Answer);
      settle(s, rt, true);
      return [{ type: 'respond', seat }];
    }
    case 'pass':
      log('pass');
      if (s.phase === 'final') nextFinal(s);
      else { p.passed = true; nextTurn(s, rng); }
      return [{ type: 'pass', seat }];
    case 'endTurn': log('endTurn'); nextTurn(s, rng); return [{ type: 'endTurn', seat }];
    case 'convertPlants': {
      const g = new G(s, seat, '', rt);
      g.gain('plants', -greeneryPlants(s, seat));
      g.tile('greenery');
      if (s.phase === 'action') s.actionsTaken += 1;
      log('convertPlants');
      settle(s, rt, s.phase === 'action');
      return [{ type: 'convertPlants', seat }];
    }
    default: break;
  }
  s.actionsTaken += 1;
  switch (a.type) {
    case 'firstAction': { p.firstActionDone = true; const c = def(p.corp!); c.firstAction!(new G(s, seat, c.id, rt)); log('firstAction', c.id); break; }
    case 'play': {
      const c = def(a.card);
      playCard(s, rt, seat, a.card, actionPay(s, seat, cardCost(s, seat, c), payOptsFor(c), a.pay) as Pay);
      log('play', a.card);
      break;
    }
    case 'cardAction': {
      const ad = def(a.card).action!;
      if (ad.cost) doPay(s, seat, actionPay(s, seat, ad.cost, ad.payWith ?? {}, a.pay) as Pay);
      p.used.push(a.card);
      ad.run(new G(s, seat, a.card, rt));
      log('cardAction', a.card);
      break;
    }
    case 'project': {
      const pay = a.project === 'sellPatents' ? {} : actionPay(s, seat, projectCost(s, seat, a.project), {}, a.pay) as Pay;
      runProject(s, rt, seat, a.project, pay, a.cards);
      log('project', undefined, a.project);
      break;
    }
    case 'milestone': doPay(s, seat, actionPay(s, seat, MILESTONE_COST, {}, a.pay) as Pay); s.milestones.push({ id: a.id, seat }); log('milestone', undefined, a.id); break;
    case 'award': doPay(s, seat, actionPay(s, seat, AWARD_COSTS[s.awards.length]!, {}, a.pay) as Pay); s.awards.push({ id: a.id, seat }); log('award', undefined, a.id); break;
    case 'convertHeat': { const g = new G(s, seat, '', rt); g.gain('heat', -8); g.raise('temperature', 1); log('convertHeat'); break; }
    default: break;
  }
  settle(s, rt, true);
  return [{ type: a.type, seat }];
}

function resignOutcome(s: TmState, seat: number) {
  s.phase = 'end';
  s.queue = [];
  s.outcome = { placements: [...rank(s, s.players.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.playerCount, score: score(s, seat).total }], reason: 'resign' };
}

export const terraformingMarsModule: GameModule<TmState, TmAction, TmView> = {
  manifest: terraformingMars.manifest,
  actionSchema: tmAction as unknown as z.ZodType<TmAction>,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('terraforming-mars needs 2–5 players');
    const corporateEra = opt(options.corporateEra, true);
    const pool = CARDS.filter((c) => corporateEra || !c.ce);
    const s: TmState = {
      playerCount, corporateEra, draft: opt(options.draft, false), generation: 1, phase: 'corp', firstPlayer: rng.nextInt(playerCount), current: 0, actionsTaken: 0,
      temperature: -30, oxygen: 0, oceans: 0, tiles: {}, claims: {}, players: Array.from({ length: playerCount }, newPlayer),
      deck: shuffle(rng, pool.filter((c) => c.kind !== 'corporation').map((c) => c.id)), discard: [], milestones: [], awards: [], queue: [],
      revealed: null, log: [], seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    s.current = s.firstPlayer;
    if (options.deal === 'tutorial' && playerCount === 2) return tutorialPosition(s);
    const corps = shuffle(rng, pool.filter((c) => c.kind === 'corporation' && !c.freeStartCards).map((c) => c.id));
    for (const p of s.players) {
      p.corpOffer = corps.splice(0, 2);
      p.offer = drawCards(s, rng, 10);
      if (!corporateEra) for (const r of RES) p.prod[r] = 1;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (!isPlayer(actor) || actor.seat < 0 || actor.seat >= s.playerCount) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const e = validateAction(s, actor.seat, a);
    return e ? { ok: false, errorCode: e } : { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') { resignOutcome(s, seat); return step(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    return step(s, applyAction(s, seat, a, ctx.rng));
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const { players, deck, discard, queue, timeouts: _t, ...rest } = structuredClone(s);
    const simultaneous = s.phase === 'corp' || s.phase === 'research' || s.phase === 'draft';
    const q = queue[0] ?? null;
    const mine = players[me];
    return {
      ...rest,
      deck: deck.length,
      discard: discard.length,
      players: players.map((p, k) => ({
        corp: p.corp, tr: p.tr, res: p.res, prod: p.prod, played: p.played, cardRes: p.cardRes, used: p.used, passed: p.passed, hand: p.hand.length,
        ready: simultaneous ? (s.phase === 'draft' ? !!p.draftPick || p.pack.length < 2 : !!p.pick) : false, score: score(s, k)
      })),
      me: mine ? { hand: mine.hand, corpOffer: mine.corpOffer, offer: mine.offer, pack: mine.pack, drafted: mine.drafted, pick: mine.pick, draftPick: mine.draftPick } : null,
      prompt: q && q.seat === me ? q : null,
      promptSeat: q ? q.seat : null
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const p = s.players[seat]!;
    const out: ActionHint[] = [];
    const ok = (a: TmAction) => !validateAction(s, seat, a);
    if (s.phase === 'corp' && !p.pick) out.push({ type: 'corp', corps: p.corpOffer, cards: p.offer });
    else if (s.phase === 'draft' && !p.draftPick && p.pack.length > 1) out.push({ type: 'draft', cards: p.pack });
    else if (s.phase === 'research' && !p.pick) out.push({ type: 'research', cards: p.offer, max: Math.min(p.offer.length, Math.floor(maxPay(s, seat, {}) / 3)) });
    else if (s.queue.length) {
      const q = s.queue[0]!;
      if (q.seat === seat) out.push({ type: 'respond', kind: q.kind, options: promptOptions(s, q), optional: !!q.optional });
    } else if (s.current === seat && (s.phase === 'action' || s.phase === 'final')) {
      if (s.phase === 'final') {
        if (canConvertPlants(s, seat)) out.push({ type: 'convertPlants' });
        out.push({ type: 'pass' });
      } else if (!p.firstActionDone) out.push({ type: 'firstAction', corp: p.corp });
      else {
        for (const id of p.hand) if (ok({ type: 'play', card: id })) { const c = def(id); out.push({ type: 'play', card: id, cost: cardCost(s, seat, c), steel: c.tags.includes('building'), titanium: c.tags.includes('space') }); }
        for (const id of tableau(s, seat)) if (def(id).action && !cardActionError(s, seat, id) && ok({ type: 'cardAction', card: id })) out.push({ type: 'cardAction', card: id, cost: def(id).action!.cost ?? 0 });
        for (const pr of Object.keys(PROJECTS) as Project[]) {
          if (pr === 'sellPatents' ? p.hand.length > 0 : ok({ type: 'project', project: pr })) out.push({ type: 'project', project: pr, cost: projectCost(s, seat, pr) });
        }
        for (const m of MILESTONES) if (ok({ type: 'milestone', id: m.id })) out.push({ type: 'milestone', id: m.id });
        for (const aw of AWARDS) if (ok({ type: 'award', id: aw.id })) out.push({ type: 'award', id: aw.id, cost: AWARD_COSTS[s.awards.length] });
        if (canConvertPlants(s, seat)) out.push({ type: 'convertPlants' });
        if (canConvertHeat(s, seat)) out.push({ type: 'convertHeat' });
        if (s.actionsTaken === 1) out.push({ type: 'endTurn' });
        out.push({ type: 'pass' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seats = terraformingMarsModule.pendingSeats(s);
    const missed = seats.map((k) => s.timeouts[k]! + 1);
    const act = (seat: number, a: TmAction) => terraformingMarsModule.apply(s, { kind: 'player', seat }, a, ctx);
    if (s.phase === 'corp') for (const k of seats) act(k, { type: 'corp', corp: s.players[k]!.corpOffer[0]!, cards: [] });
    else if (s.phase === 'draft') for (const k of seats) act(k, { type: 'draft', card: s.players[k]!.pack[0]! });
    else if (s.phase === 'research') for (const k of seats) act(k, { type: 'research', cards: [] });
    else {
      const seat = seats[0]!;
      for (let guard = 0; s.queue.length && guard < 50; guard++) act(s.queue[0]!.seat, { type: 'respond', ...autoAnswer(s, s.queue[0]!) });
      if (!s.outcome && (s.phase === 'action' || s.phase === 'final') && s.current === seat) {
        if (s.phase === 'action' && !s.players[seat]!.firstActionDone) s.players[seat]!.firstActionDone = true;
        act(seat, { type: 'pass' });
      }
    }
    seats.forEach((k, i) => { s.timeouts[k] = missed[i]!; });
    return { ...step(s, []), internalEvents: [{ type: 'timed-out', seats }] };
  },

  pendingSeats(s) {
    if (s.outcome) return [];
    const all = s.players.map((_, k) => k);
    if (s.phase === 'corp' || s.phase === 'research') return all.filter((k) => !s.players[k]!.pick);
    if (s.phase === 'draft') return all.filter((k) => !s.players[k]!.draftPick && s.players[k]!.pack.length > 1);
    if (s.queue.length) return [s.queue[0]!.seat];
    return [s.current];
  },

  tutorial: {
    seed: 1,
    options: { deal: 'tutorial' },
    introFa: 'نسل آخر یک بازی است. دما ۴+ درجه است (۲ پله تا ۸+)، اکسیژن ۱۳٪ (۱ پله تا ۱۴٪) و ۸ اقیانوس روی نقشه است (۱ تا ۹). هر بار یکی از این‌ها را بالا ببرید ۱ رتبهٔ زمین‌سازی (TR) می‌گیرید. شما با شرکت تورگیت رتبهٔ ۲۴ دارید و حریف با کردیکور ۳۰؛ اما با کامل کردن مریخ، فضای سبز کنار شهر و یک نقطهٔ عطف از او جلو می‌زنید. در هر نوبت ۱ یا ۲ کنش انجام می‌دهید.',
    steps: [
      {
        instructionFa: 'کارت «سیارک» (۱۴ مگاکردیت، نشان فضا) را بازی کنید. تیتانیوم برای کارت‌های فضایی هر واحد ۳ مگاکردیت می‌ارزد، پس ۲ تیتانیوم و ۸ مگاکردیت پرداخت می‌شود. دما ۱ پله (۲ درجه) بالا می‌رود، ۱ رتبه و ۲ تیتانیوم می‌گیرید.',
        expected: { type: 'play', card: '009' }, reply: null
      },
      {
        instructionFa: '۸ گرما را به ۱ پلهٔ دما تبدیل کنید: دما به ۸+ می‌رسد و ۱ رتبهٔ دیگر می‌گیرید. این کنش دوم شماست، پس نوبت به حریف می‌رسد و او برای این نسل پاس می‌دهد.',
        expected: { type: 'convertHeat' }, reply: { type: 'pass' }
      },
      {
        instructionFa: 'پروژهٔ استاندارد «سفرهٔ آب» را با ۱۸ مگاکردیت بخرید تا آخرین اقیانوس را بگذارید.',
        expected: { type: 'project', project: 'aquifer' }, reply: null
      },
      {
        instructionFa: 'اقیانوس فقط روی ناحیه‌های آبی گذاشته می‌شود. ناحیهٔ ۶۳ را انتخاب کنید: پاداش چاپ‌شده‌اش ۲ تیتانیوم است. اقیانوس نهم ۱ رتبه می‌دهد.',
        expected: { type: 'respond', space: '63' }, reply: null
      },
      {
        instructionFa: '۸ گیاه را به یک کاشی فضای سبز تبدیل کنید. فضای سبز اکسیژن را ۱ پله بالا می‌برد و ۱ امتیاز پایانی دارد.',
        expected: { type: 'convertPlants' }, reply: null
      },
      {
        instructionFa: 'فضای سبز باید در صورت امکان کنار یکی از کاشی‌های خودتان باشد. ناحیهٔ ۲۲ را کنار شهرتان (ناحیهٔ ۳۰) انتخاب کنید: هر فضای سبز کنار یک شهر، ۱ امتیاز به صاحب شهر می‌دهد. اکسیژن به ۱۴٪ می‌رسد و ۱ رتبهٔ دیگر می‌گیرید.',
        expected: { type: 'respond', space: '22' }, reply: null
      },
      {
        instructionFa: 'حالا ۳ فضای سبز دارید. نقطهٔ عطف «باغبان» را با ۸ مگاکردیت ثبت کنید: ۵ امتیاز پایانی. (در کل فقط ۳ نقطهٔ عطف ثبت می‌شود.)',
        expected: { type: 'milestone', id: 'gardener' }, reply: null
      },
      {
        instructionFa: 'پاس بدهید. نسل تمام می‌شود و تولید انجام می‌شود؛ چون دما، اکسیژن و اقیانوس‌ها همه کامل‌اند، پس از دور پایانی فضای سبز (که کسی ۸ گیاه ندارد) امتیازها شمرده می‌شوند.',
        expected: { type: 'pass' }, reply: null
      }
    ],
    completedFa: 'آفرین، مریخ قابل سکونت شد و شما بردید: ۲۸ رتبه + ۵ نقطهٔ عطف + ۳ فضای سبز + ۳ امتیاز شهر = ۳۹ امتیاز، در برابر ۳۴ امتیاز حریف (۳۰ رتبه + ۱ فضای سبز + ۱ شهر + ۲ امتیاز کارت). در بازی واقعی جایزه‌ها (۸، ۱۴ و ۲۰ مگاکردیت؛ ۵ و ۲ امتیاز) هم به امتیاز پایانی اضافه می‌شوند.'
  }
};

