// Coup («کودتا»), base game for 2–6 players. Court deck: 3 each of Duke, Assassin, Captain, Ambassador, Contessa.
// Everyone starts with two face-down influence cards and 2 coins (2 players: the first player starts with 1).
// Actions: Income +1; Foreign Aid +2 (Duke blocks); Coup −7, target loses an influence (forced at 10+ coins);
// Duke: Tax +3; Assassin: −3, target loses an influence (Contessa blocks); Captain: steal 2 (Captain/Ambassador
// block); Ambassador: draw 2, keep as many as you hold, return the rest. Any claim may be challenged by any player:
// a true claim makes the challenger lose an influence and the claimer swaps that card with the deck; a false claim
// costs the claimer an influence and the action (or block) fails. Losing both influences eliminates you.
// Hidden: face-down cards, the deck, and the Ambassador's draw.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { coup } from './definition.ts';

export type Role = 'duke' | 'assassin' | 'captain' | 'ambassador' | 'contessa';
export type Act = 'income' | 'foreignAid' | 'coup' | 'tax' | 'assassinate' | 'steal' | 'exchange';
export const ROLE_FA: Record<Role, string> = { duke: 'دوک', assassin: 'آدم‌کش', captain: 'کاپیتان', ambassador: 'سفیر', contessa: 'کنتس' };
export const ACT_FA: Record<Act, string> = { income: 'درآمد', foreignAid: 'کمک خارجی', coup: 'کودتا', tax: 'مالیات', assassinate: 'ترور', steal: 'دزدی', exchange: 'مبادله' };
export const CLAIM: Partial<Record<Act, Role>> = { tax: 'duke', assassinate: 'assassin', steal: 'captain', exchange: 'ambassador' };
export const BLOCKERS: Partial<Record<Act, Role[]>> = { foreignAid: ['duke'], assassinate: ['contessa'], steal: ['captain', 'ambassador'] };
const COST: Partial<Record<Act, number>> = { coup: 7, assassinate: 3 };
const TARGETED = new Set<Act>(['coup', 'assassinate', 'steal']);

export interface Card { role: Role; revealed: boolean }
export interface Pending {
  act: Act; actor: number; target: number | null; claim: Role | null;
  stage: 'respond' | 'blockOnly' | 'blockRespond';
  block: { by: number; role: Role } | null;
  responders: number[];
}
export interface CoupState {
  players: number;
  deck: Role[];
  cards: Card[][];
  coins: number[];
  current: number;
  phase: 'action' | 'respond' | 'lose' | 'exchange' | 'end';
  pending: Pending | null;
  lose: { seat: number; then: 'end' | 'resolve' | 'afterChallenge' | 'blockStands' } | null;
  exchange: { seat: number; options: Role[]; keep: number } | null;
  log: ({ seq: number; seat: number } & Record<string, unknown>)[];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface CoupView {
  players: number;
  myCards: Card[] | null;
  cards: { revealed: Role[]; hidden: number }[];
  coins: number[];
  deckCount: number;
  current: number | null;
  phase: CoupState['phase'];
  pending: Pending | null;
  lose: CoupState['lose'];
  exchange: CoupState['exchange'];
  log: CoupState['log'];
  outcome: Outcome | null;
}

const role = z.enum(['duke', 'assassin', 'captain', 'ambassador', 'contessa']);
export const coupAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('act'), act: z.enum(['income', 'foreignAid', 'coup', 'tax', 'assassinate', 'steal', 'exchange']), target: z.number().int().min(0).max(5).optional() }),
  z.strictObject({ type: z.literal('challenge') }),
  z.strictObject({ type: z.literal('block'), role }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('lose'), card: z.number().int().min(0).max(1) }),
  z.strictObject({ type: z.literal('keep'), roles: z.array(role).min(1).max(2) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CoupAction = z.infer<typeof coupAction>;

export const aliveSeat = (s: Pick<CoupState, 'cards'>, k: number) => s.cards[k]!.some((c) => !c.revealed);
const alive = (s: CoupState) => s.cards.map((_, k) => k).filter((k) => aliveSeat(s, k));
const hidden = (s: CoupState, k: number) => s.cards[k]!.filter((c) => !c.revealed);

function shuffle(rng: EngineRng, xs: Role[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// ---------- module ----------

type Events = Transition<CoupState>['internalEvents'];
const finish = (s: CoupState, events: Events): Transition<CoupState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const log = (s: CoupState, e: Record<string, unknown> & { seat: number }) => { s.log.push({ ...e, seq: ++s.seq }); if (s.log.length > 40) s.log.shift(); };

function checkEnd(s: CoupState): boolean {
  const left = alive(s);
  if (left.length > 1) return false;
  s.phase = 'end'; s.pending = null; s.lose = null; s.exchange = null;
  const order = s.log.filter((e) => e.t === 'eliminated').map((e) => e.seat);
  const places = [left[0]!, ...order.reverse(), ...s.cards.map((_, k) => k).filter((k) => k !== left[0] && !order.includes(k))];
  s.outcome = { placements: places.map((seat, i) => ({ seat, place: i + 1 })), reason: 'win' };
  return true;
}

function endTurn(s: CoupState) {
  if (checkEnd(s)) return;
  s.pending = null; s.lose = null; s.exchange = null;
  for (let k = 1; k <= s.players; k++) { const n = (s.current + k) % s.players; if (aliveSeat(s, n)) { s.current = n; break; } }
  s.phase = 'action';
}

/** Make `seat` lose an influence; asks for a choice when two cards are face down. */
function loseInfluence(s: CoupState, seat: number, then: NonNullable<CoupState['lose']>['then'], rng: EngineRng) {
  const h = s.cards[seat]!.map((c, i) => (c.revealed ? -1 : i)).filter((i) => i >= 0);
  if (h.length === 0) { continueAfterLose(s, then, rng); return; }
  if (h.length === 1) { reveal(s, seat, h[0]!); continueAfterLose(s, then, rng); return; }
  s.phase = 'lose';
  s.lose = { seat, then };
}

function reveal(s: CoupState, seat: number, i: number) {
  s.cards[seat]![i]!.revealed = true;
  log(s, { t: 'reveal', seat, role: s.cards[seat]![i]!.role });
  if (!aliveSeat(s, seat)) log(s, { t: 'eliminated', seat });
}

function continueAfterLose(s: CoupState, then: NonNullable<CoupState['lose']>['then'], rng: EngineRng) {
  s.lose = null;
  if (checkEnd(s)) return;
  const p = s.pending;
  if (then === 'end' || !p) { endTurn(s); return; }
  if (then === 'blockStands') { log(s, { t: 'blocked', seat: p.block!.by }); endTurn(s); return; }
  if (then === 'afterChallenge') {
    // The claim was true: a target that can still block gets the chance now.
    const blockers = BLOCKERS[p.act];
    if (p.target !== null && blockers && aliveSeat(s, p.target) && !p.block) {
      s.phase = 'respond'; p.stage = 'blockOnly'; p.responders = [p.target];
      return;
    }
  }
  resolveAction(s, rng);
}

/** Swap a proven card with the deck. */
function redraw(s: CoupState, seat: number, r: Role, rng: EngineRng) {
  const i = s.cards[seat]!.findIndex((c) => !c.revealed && c.role === r);
  s.deck.push(r);
  s.deck = shuffle(rng, s.deck);
  s.cards[seat]![i] = { role: s.deck.shift()!, revealed: false };
}

function resolveAction(s: CoupState, rng: EngineRng) {
  const p = s.pending!;
  log(s, { t: 'resolve', seat: p.actor, act: p.act, target: p.target });
  switch (p.act) {
    case 'foreignAid': s.coins[p.actor]! += 2; break;
    case 'tax': s.coins[p.actor]! += 3; break;
    case 'steal': { const n = Math.min(2, s.coins[p.target!]!); s.coins[p.target!]! -= n; s.coins[p.actor]! += n; break; }
    case 'assassinate': if (aliveSeat(s, p.target!)) { loseInfluence(s, p.target!, 'end', rng); return; } break;
    case 'exchange': {
      const draw = [s.deck.shift()!, s.deck.shift()!];
      s.phase = 'exchange';
      s.exchange = { seat: p.actor, options: [...hidden(s, p.actor).map((c) => c.role), ...draw], keep: hidden(s, p.actor).length };
      return;
    }
    default: break;
  }
  endTurn(s);
}

function declare(s: CoupState, seat: number, act: Act, target: number | null, rng: EngineRng) {
  s.coins[seat]! -= COST[act] ?? 0;
  const claim = CLAIM[act] ?? null;
  log(s, { t: 'act', seat, act, target, claim });
  s.pending = { act, actor: seat, target, claim, stage: 'respond', block: null, responders: [] };
  if (act === 'income') { s.coins[seat]! += 1; endTurn(s); return; }
  if (act === 'coup') { loseInfluence(s, target!, 'end', rng); return; }
  // Foreign Aid can be blocked by anyone; claims can be challenged by anyone (and blocked by the target).
  s.phase = 'respond';
  s.pending.responders = alive(s).filter((k) => k !== seat);
}

/** Who may block now. */
export function canBlock(p: Pending, seat: number): Role[] {
  const roles = BLOCKERS[p.act];
  if (!roles || p.block || p.stage === 'blockRespond') return [];
  if (p.act === 'foreignAid') return seat !== p.actor ? roles : [];
  return seat === p.target ? roles : [];
}
const canChallenge = (p: Pending) => p.stage === 'blockRespond' || (p.stage === 'respond' && p.claim !== null);

function challenge(s: CoupState, challenger: number, rng: EngineRng) {
  const p = s.pending!;
  const onBlock = p.stage === 'blockRespond';
  const claimant = onBlock ? p.block!.by : p.actor;
  const r = onBlock ? p.block!.role : p.claim!;
  const truthful = s.cards[claimant]!.some((c) => !c.revealed && c.role === r);
  log(s, { t: 'challenge', seat: challenger, of: claimant, role: r, truthful });
  if (truthful) {
    redraw(s, claimant, r, rng);
    loseInfluence(s, challenger, onBlock ? 'blockStands' : 'afterChallenge', rng);
  } else if (onBlock) {
    loseInfluence(s, claimant, 'resolve', rng);
  } else {
    if (p.act === 'assassinate') s.coins[p.actor]! += 3; // refunded when the Assassin claim fails
    loseInfluence(s, claimant, 'end', rng);
  }
}

function respondPass(s: CoupState, seat: number, rng: EngineRng) {
  const p = s.pending!;
  p.responders = p.responders.filter((k) => k !== seat);
  if (p.responders.length) return;
  if (p.stage === 'blockRespond') { log(s, { t: 'blocked', seat: p.block!.by }); endTurn(s); return; }
  resolveAction(s, rng);
}

function block(s: CoupState, seat: number, r: Role) {
  const p = s.pending!;
  p.block = { by: seat, role: r };
  p.stage = 'blockRespond';
  p.responders = alive(s).filter((k) => k !== seat);
  log(s, { t: 'block', seat, role: r });
}

export function legalFor(s: CoupState, seat: number): ActionHint[] {
  const out: ActionHint[] = [];
  if (s.outcome || !aliveSeat(s, seat)) return out;
  if (s.phase === 'action' && s.current === seat) {
    const others = alive(s).filter((k) => k !== seat);
    if (s.coins[seat]! >= 10) out.push({ type: 'act', act: 'coup', targets: others });
    else {
      for (const act of ['income', 'foreignAid', 'tax', 'exchange'] as Act[]) out.push({ type: 'act', act });
      out.push({ type: 'act', act: 'steal', targets: others });
      if (s.coins[seat]! >= 3) out.push({ type: 'act', act: 'assassinate', targets: others });
      if (s.coins[seat]! >= 7) out.push({ type: 'act', act: 'coup', targets: others });
    }
  }
  if (s.phase === 'respond' && s.pending!.responders.includes(seat)) {
    const p = s.pending!;
    if (canChallenge(p) && p.stage !== 'blockOnly') out.push({ type: 'challenge' });
    for (const r of canBlock(p, seat)) out.push({ type: 'block', role: r });
    out.push({ type: 'pass' });
  }
  if (s.phase === 'lose' && s.lose!.seat === seat) s.cards[seat]!.forEach((c, i) => { if (!c.revealed) out.push({ type: 'lose', card: i }); });
  if (s.phase === 'exchange' && s.exchange!.seat === seat) out.push({ type: 'keep', options: s.exchange!.options, keep: s.exchange!.keep });
  return out;
}

export const coupModule: GameModule<CoupState, CoupAction, CoupView> = {
  manifest: coup.manifest,
  actionSchema: coupAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('coup needs 2–6 players');
    const deck = shuffle(rng, (['duke', 'assassin', 'captain', 'ambassador', 'contessa'] as Role[]).flatMap((r) => [r, r, r]));
    const s: CoupState = {
      players: playerCount, deck, cards: Array.from({ length: playerCount }, () => [{ role: deck.shift()!, revealed: false }, { role: deck.shift()!, revealed: false }]),
      coins: Array(playerCount).fill(2), current: rng.nextInt(playerCount), phase: 'action', pending: null, lose: null, exchange: null,
      log: [], seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (playerCount === 2) s.coins[s.current] = 1;
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.cards = [[{ role: 'duke', revealed: false }, { role: 'captain', revealed: false }], [{ role: 'contessa', revealed: false }, { role: 'duke', revealed: true }]];
      s.coins = [2, 2];
      s.deck = shuffle(rng, (['duke', 'assassin', 'captain', 'ambassador', 'contessa'] as Role[]).flatMap((r) => [r, r, r])).filter((_, i) => i < 11);
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || !aliveSeat(s, actor.seat)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const hints = legalFor(s, actor.seat);
    if (!hints.length) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'act': {
        const h = hints.find((x) => x.type === 'act' && x.act === a.act);
        if (!h) return { ok: false, errorCode: s.coins[actor.seat]! >= 10 ? 'MUST_COUP' : 'ILLEGAL_ACTION' };
        if (TARGETED.has(a.act)) return (h.targets as number[]).includes(a.target ?? -1) ? { ok: true } : { ok: false, errorCode: 'BAD_TARGET' };
        return a.target === undefined ? { ok: true } : { ok: false, errorCode: 'NO_TARGET_NEEDED' };
      }
      case 'keep': {
        const ex = s.exchange;
        if (!ex || ex.seat !== actor.seat || a.roles.length !== ex.keep) return { ok: false, errorCode: 'ILLEGAL_ACTION' };
        const pool = ex.options.slice();
        for (const r of a.roles) { const i = pool.indexOf(r); if (i < 0) return { ok: false, errorCode: 'NOT_OFFERED' }; pool.splice(i, 1); }
        return { ok: true };
      }
      default:
        return hints.some((h) => h.type === a.type && (a.type !== 'block' || h.role === a.role) && (a.type !== 'lose' || h.card === a.card)) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_ACTION' };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.cards[seat]!.forEach((c) => { c.revealed = true; });
      log(s, { t: 'eliminated', seat });
      if (!checkEnd(s)) {
        if (s.pending) s.pending.responders = s.pending.responders.filter((k) => k !== seat);
        if (s.current === seat || s.lose?.seat === seat || s.exchange?.seat === seat || (s.pending && !s.pending.responders.length)) endTurn(s);
      }
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    switch (a.type) {
      case 'act': declare(s, seat, a.act, a.target ?? null, ctx.rng); break;
      case 'challenge': challenge(s, seat, ctx.rng); break;
      case 'block': block(s, seat, a.role); break;
      case 'pass': respondPass(s, seat, ctx.rng); break;
      case 'lose': { const then = s.lose!.then; reveal(s, seat, a.card); continueAfterLose(s, then, ctx.rng); break; }
      case 'keep': {
        const ex = s.exchange!;
        const back = ex.options.slice();
        for (const r of a.roles) back.splice(back.indexOf(r), 1);
        let k = 0;
        s.cards[seat] = s.cards[seat]!.map((c) => (c.revealed ? c : { role: a.roles[k++]!, revealed: false }));
        s.deck = shuffle(ctx.rng, [...s.deck, ...back]);
        log(s, { t: 'exchanged', seat });
        endTurn(s);
        break;
      }
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, myCards: me >= 0 ? s.cards[me]!.map((c) => ({ ...c })) : null,
      cards: s.cards.map((cs) => ({ revealed: cs.filter((c) => c.revealed).map((c) => c.role), hidden: cs.filter((c) => !c.revealed).length })),
      coins: s.coins.slice(), deckCount: s.deck.length, current: s.outcome ? null : s.current, phase: s.phase,
      pending: s.pending ? structuredClone(s.pending) : null, lose: s.lose ? { ...s.lose } : null,
      exchange: s.exchange && s.exchange.seat === me ? { ...s.exchange, options: s.exchange.options.slice() } : s.exchange ? { seat: s.exchange.seat, options: [], keep: s.exchange.keep } : null,
      log: s.log.map((e) => ({ ...e })), outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (viewer.kind !== 'player') return [];
    const out = legalFor(s, viewer.seat);
    if (!s.outcome && aliveSeat(s, viewer.seat)) out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    // Passive play for everyone the game waits on.
    if (s.phase === 'respond') {
      for (const k of s.pending!.responders.slice()) { s.timeouts[k]! += 1; if (s.phase === 'respond') respondPass(s, k, ctx.rng); }
    } else if (s.phase === 'lose') {
      const seat = s.lose!.seat; const then = s.lose!.then;
      s.timeouts[seat]! += 1;
      reveal(s, seat, s.cards[seat]!.findIndex((c) => !c.revealed));
      continueAfterLose(s, then, ctx.rng);
    } else if (s.phase === 'exchange') {
      const ex = s.exchange!;
      const t = coupModule.apply(s, { kind: 'player', seat: ex.seat }, { type: 'keep', roles: ex.options.slice(0, ex.keep) }, ctx);
      s.timeouts[ex.seat]! += 1;
      return t;
    } else {
      const seat = s.current;
      s.timeouts[seat]! += 1;
      const others = alive(s).filter((k) => k !== seat);
      declare(s, seat, s.coins[seat]! >= 10 ? 'coup' : 'income', s.coins[seat]! >= 10 ? others[0]! : null, ctx.rng);
    }
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'respond' ? s.pending!.responders.slice() : s.phase === 'lose' ? [s.lose!.seat] : s.phase === 'exchange' ? [s.exchange!.seat] : [s.current]),

  tutorial: {
    seed: 17,
    options: { deal: 'tutorial' },
    introFa: 'هر کس دو کارت نفوذ مخفی دارد. می‌توانید ادعا کنید هر نقشی را دارید — حتی اگر نداشته باشید! — ولی هر کس می‌تواند ادعایتان را «به چالش» بکشد. حریف فقط یک نفوذ برایش مانده.',
    steps: [
      { instructionFa: 'شما «کاپیتان» دارید: «دزدی» را انتخاب کنید و از حریف دو سکه بدزدید.', expected: { type: 'act', act: 'steal', target: 1 }, reply: { type: 'block', role: 'ambassador' } },
      { instructionFa: 'حریف ادعا کرد «سفیر» دارد و دزدی را بست. ولی «سفیر»ی که کنار گذاشته شده بود... «چالش» را بزنید!', expected: { type: 'challenge' }, reply: null }
    ],
    completedFa: 'بردید! حریف سفیر نداشت و آخرین نفوذش را از دست داد. هر کس هر دو کارتش رو شود از بازی بیرون است.'
  }
};
