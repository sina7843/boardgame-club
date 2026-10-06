// sealed-bids rules (docs/GAME_MODULES.md): 2–4 players, hidden hands, simultaneous sealed bids, 5 rounds.
import { z } from 'zod';
import type { Actor, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { sealedBids } from './definition.ts';

export const ROUNDS = 5;
export const TOKENS = [1, 2, 3, 4, 5] as const;

export interface RoundRecord { round: number; prize: number; bids: number[]; winner: number | null }

export interface SealedBidsState {
  players: number;
  /** Stable seat order, shuffled once at setup with the engine RNG. Used for deterministic auto-commits. */
  seatOrder: number[];
  hands: number[][];
  round: number;
  /** Sealed bid per seat for the current round — hidden from everyone but the owner. */
  pending: (number | null)[];
  scores: number[];
  history: RoundRecord[];
  resigned: boolean[];
  outcome: Outcome | null;
}

export const sealedBidsAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bid'), token: z.number().int().min(1).max(5) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SealedBidsAction = z.infer<typeof sealedBidsAction>;

export interface SealedBidsView {
  players: number;
  round: number;
  prize: number | null;
  scores: number[];
  /** Who has sealed a bid this round — never the value. */
  submitted: boolean[];
  resigned: boolean[];
  /** Only already-revealed rounds. */
  history: RoundRecord[];
  seatOrder: number[];
  myHand: number[] | null;
  myBid: number | null;
  outcome: Outcome | null;
}

type Events = Transition<SealedBidsState>['internalEvents'];

const lowest = (hand: number[]) => Math.min(...hand);

/** Competition ranking: equal scores share a place (1, 1, 3). */
export function rankByScore(scores: number[]): Outcome['placements'] {
  return scores.map((score, seat) => ({ seat, score, place: 1 + scores.filter((s) => s > score).length }));
}

/** Commit lowest unused tokens for resigned seats, then resolve every complete round (handles all-resigned). */
function settle(state: SealedBidsState, events: Events): { state: SealedBidsState; resolved: boolean } {
  let s = state;
  let resolved = false;
  for (;;) {
    if (s.outcome) return { state: s, resolved };
    const pending = s.pending.slice();
    for (const seat of s.seatOrder) {
      if (s.resigned[seat] && pending[seat] === null) {
        pending[seat] = lowest(s.hands[seat]!);
        events.push({ type: 'auto-committed', seat, token: pending[seat], reason: 'resigned' });
      }
    }
    s = { ...s, pending };
    if (pending.some((b) => b === null)) return { state: s, resolved };

    const bids = pending as number[];
    const max = Math.max(...bids);
    const top = bids.flatMap((b, seat) => (b === max ? [seat] : []));
    const winner = top.length === 1 ? top[0]! : null;
    const prize = s.round;
    const scores = s.scores.slice();
    if (winner !== null) scores[winner]! += prize;
    const hands = s.hands.map((h, seat) => h.filter((t) => t !== bids[seat]));
    const history = [...s.history, { round: s.round, prize, bids, winner }];
    events.push({ type: 'revealed', round: s.round, bids, winner });
    resolved = true;
    const round = s.round + 1;
    s = {
      ...s, hands, scores, history, round,
      pending: Array<number | null>(s.players).fill(null),
      outcome: round > ROUNDS ? { placements: rankByScore(scores), reason: 'score' } : null
    };
  }
}

function finish(before: SealedBidsState, events: Events): Transition<SealedBidsState> {
  const { state, resolved } = settle(before, events);
  const scheduleChanges: Transition<SealedBidsState>['scheduleChanges'] =
    state.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : resolved ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: state, internalEvents: events, scheduleChanges };
}

export const sealedBidsModule: GameModule<SealedBidsState, SealedBidsAction, SealedBidsView> = {
  manifest: sealedBids.manifest,
  actionSchema: sealedBidsAction,

  setup({ playerCount, rng }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('sealed-bids needs 2–4 players');
    const seatOrder = Array.from({ length: playerCount }, (_, i) => i);
    for (let i = seatOrder.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [seatOrder[i], seatOrder[j]] = [seatOrder[j]!, seatOrder[i]!];
    }
    return {
      players: playerCount,
      seatOrder,
      hands: seatOrder.map(() => [...TOKENS]),
      round: 1,
      pending: Array<number | null>(playerCount).fill(null),
      scores: Array<number>(playerCount).fill(0),
      history: [],
      resigned: Array<boolean>(playerCount).fill(false),
      outcome: null
    };
  },

  validate(state, actor, action) {
    if (state.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= state.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (state.resigned[actor.seat]) return { ok: false, errorCode: 'ALREADY_RESIGNED' };
    if (action.type === 'resign') return { ok: true };
    if (state.pending[actor.seat] !== null) return { ok: false, errorCode: 'ALREADY_COMMITTED' };
    if (!state.hands[actor.seat]!.includes(action.token)) return { ok: false, errorCode: 'TOKEN_UNAVAILABLE' };
    return { ok: true };
  },

  apply(state, actor, action) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (action.type === 'resign') {
      const resigned = state.resigned.slice();
      resigned[seat] = true;
      return finish({ ...state, resigned }, [{ type: 'resigned', seat }]);
    }
    const pending = state.pending.slice();
    pending[seat] = action.token;
    return finish({ ...state, pending }, [{ type: 'committed', seat, token: action.token }]);
  },

  project(state, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < state.players ? viewer.seat : null;
    return {
      players: state.players,
      round: Math.min(state.round, ROUNDS),
      prize: state.outcome ? null : state.round,
      scores: state.scores.slice(),
      submitted: state.pending.map((b) => b !== null),
      resigned: state.resigned.slice(),
      history: state.history.map((h) => ({ ...h, bids: h.bids.slice() })),
      seatOrder: state.seatOrder.slice(),
      myHand: own === null ? null : state.hands[own]!.slice(),
      myBid: own === null ? null : state.pending[own]!,
      outcome: state.outcome
    };
  },

  legalActions(state, viewer) {
    if (state.outcome || viewer.kind !== 'player' || state.resigned[viewer.seat]) return [];
    const bids = state.pending[viewer.seat] === null ? state.hands[viewer.seat]!.map((token) => ({ type: 'bid', token })) : [];
    return [...bids, { type: 'resign' }];
  },

  outcome: (state) => state.outcome,

  onTimeout(state) {
    if (state.outcome) return { nextState: state, internalEvents: [], scheduleChanges: [] };
    const events: Events = [];
    const pending = state.pending.slice();
    for (const seat of state.seatOrder) {
      if (pending[seat] === null) {
        pending[seat] = lowest(state.hands[seat]!);
        events.push({ type: 'auto-committed', seat, token: pending[seat], reason: 'timeout' });
      }
    }
    return finish({ ...state, pending }, events);
  },

  pendingSeats: (state) => (state.outcome ? [] : state.pending.flatMap((b, seat) => (b === null && !state.resigned[seat] ? [seat] : []))),

  tutorial: {
    seed: 7,
    introFa: 'در مزایده سربسته هر دور همه هم‌زمان یک ژتون را پنهانی ثبت می‌کنند. بالاترین پیشنهاد یکتا، امتیاز همان دور را می‌برد.',
    steps: [
      { instructionFa: 'دور ۱ فقط ۱ امتیاز دارد. ژتون کم‌ارزشی مثل ۱ یا ۲ را ثبت کنید و ژتون‌های بزرگ را نگه دارید.', expected: null, reply: { type: 'bid', token: 3 } },
      { instructionFa: 'هر ژتون فقط یک بار مصرف می‌شود. حریف ۳ را خرج کرد؛ دور ۲ را با دقت پیشنهاد دهید.', expected: null, reply: { type: 'bid', token: 5 } },
      { instructionFa: 'حریف ۵ را هم خرج کرد. حالا بزرگ‌ترین ژتون شما ارزشمندتر است.', expected: null, reply: { type: 'bid', token: 1 } },
      { instructionFa: 'اگر پیشنهادها برابر شوند، هیچ‌کس امتیاز نمی‌گیرد.', expected: null, reply: { type: 'bid', token: 2 } },
      { instructionFa: 'دور آخر ۵ امتیاز دارد. آخرین ژتون خود را ثبت کنید.', expected: null, reply: { type: 'bid', token: 4 } }
    ],
    completedFa: 'آموزش تمام شد. در بازی واقعی پیشنهاد حریف تا آشکارسازی دیده نمی‌شود و اگر زمان تمام شود کم‌ارزش‌ترین ژتون شما ثبت می‌شود.'
  }
};
