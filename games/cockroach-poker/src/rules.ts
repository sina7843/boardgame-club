// Cockroach Poker («بلوف حشره‌ها»), 2–6 players. 64 cards: eight creatures × 8, all dealt. The active player gives
// one hand card face down to another player with a claim. The receiver either calls «true»/«false» — a right call puts
// the card face up in front of the giver, a wrong one in front of the receiver — or secretly looks and passes it on with
// a new claim to someone who has not seen it (impossible with two players; once you have looked you must pass). Whoever gets the card face up starts the
// next round. Four of one creature face up in front of you, or having to give with an empty hand, loses; everybody
// else shares the win. Hidden: hands, and the card in play except to those who have seen it.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { cockroachPoker } from './definition.ts';

export const CREATURES = ['cockroach', 'bat', 'fly', 'toad', 'rat', 'scorpion', 'spider', 'stinkbug'] as const;
export type Creature = (typeof CREATURES)[number];

export interface Chain { card: Creature; from: number; to: number; claim: Creature; seen: number[]; peeked: boolean }
export interface CockroachState {
  players: number;
  hands: Creature[][];
  table: Creature[][];
  current: number;
  chain: Chain | null;
  last: { kind: 'call'; seat: number; truth: boolean; card: Creature; claim: Creature; taker: number } | { kind: 'pass' | 'give'; seat: number; to: number; claim: Creature } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface CockroachView {
  players: number;
  hand: Creature[] | null;
  handCount: number[];
  table: Creature[][];
  current: number;
  chain: (Omit<Chain, 'card'> & { card: Creature | null }) | null;
  last: CockroachState['last'];
  seq: number;
  outcome: Outcome | null;
}

const creature = z.enum(CREATURES);
export const cockroachAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('give'), card: creature, to: z.number().int().min(0).max(5), claim: creature }),
  z.strictObject({ type: z.literal('call'), truth: z.boolean() }),
  z.strictObject({ type: z.literal('peek') }),
  z.strictObject({ type: z.literal('pass'), to: z.number().int().min(0).max(5), claim: creature }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CockroachAction = z.infer<typeof cockroachAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const sortHand = (h: Creature[]) => h.sort((a, b) => CREATURES.indexOf(a) - CREATURES.indexOf(b));
export const passTargets = (s: Pick<CockroachState, 'players' | 'chain'>) => (s.chain ? Array.from({ length: s.players }, (_, k) => k).filter((k) => !s.chain!.seen.includes(k) && k !== s.chain!.to) : []);
const lose = (s: CockroachState, loser: number): Outcome => ({ placements: s.hands.map((_, seat) => ({ seat, place: seat === loser ? 2 : 1 })), reason: 'win' });

// ---------- module ----------

type Events = Transition<CockroachState>['internalEvents'];
const finish = (s: CockroachState, events: Events): Transition<CockroachState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

export const cockroachModule: GameModule<CockroachState, CockroachAction, CockroachView> = {
  manifest: cockroachPoker.manifest,
  actionSchema: cockroachAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('cockroach poker needs 2–6 players');
    const deck = shuffle(rng, CREATURES.flatMap((c) => Array<Creature>(8).fill(c)));
    const hands: Creature[][] = Array.from({ length: playerCount }, () => []);
    deck.forEach((c, i) => hands[i % playerCount]!.push(c));
    const s: CockroachState = {
      players: playerCount, hands: hands.map(sortHand), table: Array.from({ length: playerCount }, () => []), current: rng.nextInt(playerCount),
      chain: null, last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      s.current = 0;
      s.hands = [['bat', 'fly', 'rat', 'spider'], ['cockroach', 'toad', 'toad', 'scorpion']];
      s.table = [[], ['bat', 'bat', 'bat']];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (a.type === 'give') {
      if (s.chain || s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
      if (!s.hands[seat]!.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
      return a.to !== seat && a.to < s.players ? { ok: true } : { ok: false, errorCode: 'BAD_TARGET' };
    }
    if (!s.chain || s.chain.to !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'call') return s.chain.peeked ? { ok: false, errorCode: 'MUST_PASS' } : { ok: true };
    if (!passTargets(s).length) return { ok: false, errorCode: 'NOBODY_TO_PASS' };
    if (a.type === 'peek') return s.chain.peeked ? { ok: false, errorCode: 'ALREADY_LOOKED' } : { ok: true };
    return passTargets(s).includes(a.to) ? { ok: true } : { ok: false, errorCode: 'BAD_TARGET' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { s.outcome = lose(s, seat); s.chain = null; return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'give') {
      s.hands[seat]!.splice(s.hands[seat]!.indexOf(a.card), 1);
      s.chain = { card: a.card, from: seat, to: a.to, claim: a.claim, seen: [seat], peeked: false };
      s.last = { kind: 'give', seat, to: a.to, claim: a.claim };
    } else if (a.type === 'peek') {
      s.chain!.peeked = true;
      s.chain!.seen.push(seat);
    } else if (a.type === 'pass') {
      const c = s.chain!;
      s.chain = { card: c.card, from: seat, to: a.to, claim: a.claim, seen: c.seen.includes(seat) ? c.seen.slice() : [...c.seen, seat], peeked: false };
      s.last = { kind: 'pass', seat, to: a.to, claim: a.claim };
    } else {
      const c = s.chain!;
      const right = (c.claim === c.card) === a.truth;
      const taker = right ? c.from : seat;
      s.table[taker]!.push(c.card);
      s.last = { kind: 'call', seat, truth: a.truth, card: c.card, claim: c.claim, taker };
      s.chain = null;
      s.current = taker;
      if (s.table[taker]!.filter((x) => x === c.card).length >= 4) s.outcome = lose(s, taker);
      else if (!s.hands[taker]!.length) s.outcome = lose(s, taker);
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, handCount: s.hands.map((h) => h.length), table: s.table.map((t) => t.slice()),
      current: s.current, chain: s.chain ? { ...s.chain, seen: s.chain.seen.slice(), card: s.chain.seen.includes(me) ? s.chain.card : null } : null,
      last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (!s.chain && s.current === seat) out.push({ type: 'give', targets: Array.from({ length: s.players }, (_, k) => k).filter((k) => k !== seat) });
    if (s.chain?.to === seat) {
      const t = passTargets(s);
      if (!s.chain.peeked) out.push({ type: 'call' });
      if (t.length && !s.chain.peeked) out.push({ type: 'peek' });
      if (t.length) out.push({ type: 'pass', targets: t });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.chain ? s.chain.to : s.current;
    const missed = s.timeouts[seat]! + 1;
    const card = s.hands[seat]![0]!;
    const a: CockroachAction = s.chain ? (s.chain.peeked ? { type: 'pass', to: passTargets(s)[0]!, claim: s.chain.claim } : { type: 'call', truth: true }) : { type: 'give', card, to: (seat + 1) % s.players, claim: card };
    const t = cockroachModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.chain ? s.chain.to : s.current]),

  tutorial: {
    seed: 43,
    options: { deal: 'tutorial' },
    introFa: 'کارت را رو به پایین به حریف می‌دهید و می‌گویید چیست؛ او باید حدس بزند راست می‌گویید یا نه. حریف سه خفاش جلویش دارد — چهارمی یعنی باخت!',
    steps: [
      { instructionFa: 'یک بلوف: «موش» را بدهید ولی بگویید «سوسک».', expected: { type: 'give', card: 'rat', to: 1, claim: 'cockroach' }, reply: { type: 'call', truth: false } },
      { instructionFa: 'حریف بلوف را گرفت و موش جلوی شما ماند. حالا راستش را بگویید: «خفاش» را بدهید و بگویید «خفاش».', expected: { type: 'give', card: 'bat', to: 1, claim: 'bat' }, reply: { type: 'call', truth: false } }
    ],
    completedFa: 'بردید! حریف فکر کرد دروغ می‌گویید، ولی راست بود: چهارمین خفاش جلویش ماند.'
  }
};
