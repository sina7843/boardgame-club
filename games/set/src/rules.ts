// Set rules: 81 cards (4 attributes × 3 values), 12 on the table (+3 while no set exists), real-time claims.
// Everyone acts at once; the platform serializes commands, so the first valid claim that reaches the server wins.
import { z } from 'zod';
import type { Actor, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { set } from './definition.ts';

export const TABLE_SIZE = 12;
export const WRONG_PENALTY = 1;

/** Card id 0..80 = count + 3·shape + 9·color + 27·shading (each digit 0..2). */
export const attrs = (id: number): [number, number, number, number] => [id % 3, Math.floor(id / 3) % 3, Math.floor(id / 9) % 3, Math.floor(id / 27) % 3];
export const isSet = (a: number, b: number, c: number): boolean => {
  const x = attrs(a), y = attrs(b), z3 = attrs(c);
  return a !== b && b !== c && a !== c && x.every((v, i) => (v + y[i]! + z3[i]!) % 3 === 0);
};
/** The unique card completing a set with a and b. */
export const third = (a: number, b: number): number => attrs(a).reduce((id, v, i) => id + ((6 - v - attrs(b)[i]!) % 3) * 3 ** i, 0);
/** First set in table order (lexicographic by slot), or null. */
export function findSet(table: readonly number[]): [number, number, number] | null {
  const at = new Map(table.map((c, i) => [c, i]));
  for (let i = 0; i < table.length; i++) for (let j = i + 1; j < table.length; j++) {
    const k = at.get(third(table[i]!, table[j]!));
    if (k !== undefined && k > j) return [table[i]!, table[j]!, table[k]!];
  }
  return null;
}

export type LastEvent = { kind: 'set' | 'miss'; seat: number; cards: number[] } | { kind: 'timeout'; seat: null; cards: number[] };

export interface SetState {
  players: number;
  /** Hidden draw order. Never projected. */
  deck: number[];
  table: number[];
  sets: number[][][];
  penalties: number[];
  resigned: boolean[];
  resignOrder: number[];
  /** Seats that made a wrong claim on the current board: they may not claim again until the board changes. */
  locked: boolean[];
  last: LastEvent | null;
  seq: number;
  outcome: Outcome | null;
}

export const setAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('claim'), cards: z.tuple([z.number().int().min(0).max(80), z.number().int().min(0).max(80), z.number().int().min(0).max(80)]) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SetAction = z.infer<typeof setAction>;

export interface SetView {
  players: number;
  table: number[];
  deckCount: number;
  /** Cards of every set each seat found (public: claimed sets are shown face up). */
  sets: number[][][];
  penalties: number[];
  scores: number[];
  resigned: boolean[];
  locked: boolean[];
  last: LastEvent | null;
  seq: number;
  outcome: Outcome | null;
}

type Events = Transition<SetState>['internalEvents'];
export const scoreOf = (s: Pick<SetState, 'sets' | 'penalties'>, seat: number) => s.sets[seat]!.length - s.penalties[seat]!;

function placements(s: SetState): Outcome['placements'] {
  const active = Array.from({ length: s.players }, (_, i) => i).filter((i) => !s.resigned[i]);
  const ranked = active.map((seat) => ({ seat, score: scoreOf(s, seat), place: 1 + active.filter((o) => scoreOf(s, o) > scoreOf(s, seat)).length }));
  // Resigned seats rank after everyone still playing; the earliest resigner is last.
  const out = s.resignOrder.map((seat, i) => ({ seat, score: scoreOf(s, seat), place: s.players - i }));
  return [...ranked, ...out].sort((a, b) => a.place - b.place || a.seat - b.seat);
}

/** Deal 3 more while the table has no set; end the game when the deck is out and no set remains. */
function settle(s: SetState, events: Events): SetState {
  while (!findSet(s.table) && s.deck.length) {
    const cards = s.deck.slice(0, 3);
    s = { ...s, deck: s.deck.slice(3), table: [...s.table, ...cards] };
    events.push({ type: 'dealt-extra', cards });
  }
  if (!findSet(s.table)) {
    s = { ...s, outcome: { placements: placements(s), reason: 'score' } };
    events.push({ type: 'finished' });
  }
  return s;
}

/** Take a set off the table: refill its slots from the deck only while the table would drop below 12. */
/** A new board lifts every wrong-claim lockout. */
function removeSet(s: SetState, cards: number[]): SetState {
  const locked = s.locked.map(() => false);
  if (s.table.length > TABLE_SIZE || !s.deck.length) return { ...s, locked, table: s.table.filter((c) => !cards.includes(c)) };
  const deck = s.deck.slice();
  return { ...s, locked, table: s.table.map((c) => (cards.includes(c) ? deck.shift()! : c)), deck };
}

function step(s: SetState, events: Events, boardChanged: boolean): Transition<SetState> {
  const next = { ...s, seq: s.seq + 1 };
  const scheduleChanges: Transition<SetState>['scheduleChanges'] = next.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : boardChanged ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: next, internalEvents: events, scheduleChanges };
}

function shuffle(cards: number[], rng: { nextInt(n: number): number }) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return cards;
}

/** Tutorial-only teaching deal: 12 on the table, 3 in the deck (sets S1 S2 S3 S4 + 3 leftovers that are not a set). */
export const TUTORIAL_TABLE = [0, 19, 42, 40, 22, 43, 2, 13, 80, 25, 38, 57];
export const TUTORIAL_DECK = [74, 70, 44];

export const setModule: GameModule<SetState, SetAction, SetView> = {
  manifest: set.manifest,
  actionSchema: setAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 8) throw new Error('set needs 2–8 players');
    const cards = options.deal === 'tutorial' ? [...TUTORIAL_TABLE, ...TUTORIAL_DECK] : shuffle(Array.from({ length: 81 }, (_, i) => i), rng);
    const s: SetState = {
      players: playerCount,
      deck: cards.slice(TABLE_SIZE),
      table: cards.slice(0, TABLE_SIZE),
      sets: Array.from({ length: playerCount }, () => []),
      penalties: Array<number>(playerCount).fill(0),
      resigned: Array<boolean>(playerCount).fill(false),
      resignOrder: [],
      locked: Array<boolean>(playerCount).fill(false),
      last: null,
      seq: 0,
      outcome: null
    };
    return settle(s, []);
  },

  validate(state, actor, action) {
    if (state.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= state.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (state.resigned[actor.seat]) return { ok: false, errorCode: 'ALREADY_RESIGNED' };
    if (action.type === 'resign') return { ok: true };
    if (state.locked[actor.seat]) return { ok: false, errorCode: 'CLAIM_LOCKED' };
    if (new Set(action.cards).size !== 3) return { ok: false, errorCode: 'INVALID_ACTION' };
    if (!action.cards.every((c) => state.table.includes(c))) return { ok: false, errorCode: 'CARD_NOT_ON_TABLE' };
    return { ok: true };
  },

  apply(state, actor, action) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (action.type === 'resign') {
      const resigned = state.resigned.slice();
      resigned[seat] = true;
      const locked = state.locked.every((l, i) => l || resigned[i]) ? state.locked.map(() => false) : state.locked;
      let s: SetState = { ...state, resigned, locked, resignOrder: [...state.resignOrder, seat] };
      if (resigned.filter((r) => !r).length <= 1) s = { ...s, outcome: { placements: placements(s), reason: 'resign' } };
      return step(s, [{ type: 'resigned', seat }], false);
    }
    const cards = [...action.cards].sort((a, b) => a - b);
    if (!isSet(cards[0]!, cards[1]!, cards[2]!)) {
      const penalties = state.penalties.slice();
      penalties[seat]! += WRONG_PENALTY;
      let locked = state.locked.slice();
      locked[seat] = true;
      // Nobody may be shut out for good: once every active seat has missed on this board, all are free again.
      if (locked.every((l, i) => l || state.resigned[i])) locked = locked.map(() => false);
      return step({ ...state, penalties, locked, last: { kind: 'miss', seat, cards } }, [{ type: 'wrong-claim', seat, cards }], false);
    }
    const events: Events = [{ type: 'set-claimed', seat, cards }];
    const sets = state.sets.map((x, i) => (i === seat ? [...x, cards] : x));
    const s = settle({ ...removeSet({ ...state, sets }, cards), last: { kind: 'set', seat, cards } }, events);
    return step(s, events, true);
  },

  project(state) {
    return {
      players: state.players,
      table: state.table.slice(),
      deckCount: state.deck.length,
      sets: state.sets.map((x) => x.map((c) => c.slice())),
      penalties: state.penalties.slice(),
      scores: state.sets.map((_, i) => scoreOf(state, i)),
      resigned: state.resigned.slice(),
      locked: state.locked.slice(),
      last: state.last && { ...state.last, cards: state.last.cards.slice() },
      seq: state.seq,
      outcome: state.outcome
    };
  },

  // Never list the sets on the table: that would hand out the answer. Claims carry any three table cards.
  legalActions(state, viewer) {
    if (state.outcome || viewer.kind !== 'player' || state.resigned[viewer.seat]) return [];
    return state.locked[viewer.seat] ? [{ type: 'resign' }] : [{ type: 'claim', cards: 3 }, { type: 'resign' }];
  },

  outcome: (state) => state.outcome,

  // Idle deadline: nobody found a set in time → the first set on the table is set aside unscored and refilled.
  onTimeout(state) {
    if (state.outcome) return { nextState: state, internalEvents: [], scheduleChanges: [] };
    const cards = findSet(state.table)!.slice().sort((a, b) => a - b);
    const events: Events = [{ type: 'timeout-discard', cards }];
    return step(settle({ ...removeSet(state, cards), last: { kind: 'timeout', seat: null, cards } }, events), events, true);
  },

  pendingSeats: (state) => (state.outcome ? [] : state.resigned.flatMap((r, seat) => (r ? [] : [seat]))),

  tutorial: {
    seed: 81,
    options: { deal: 'tutorial' },
    introFa: 'در ست همه هم‌زمان بازی می‌کنند. هر کارت چهار ویژگی دارد: تعداد (۱ تا ۳)، شکل (لوزی، موج، بیضی)، رنگ (قرمز، سبز، بنفش) و پرشدگی (توپر، هاشور، توخالی). سه کارت وقتی ست هستند که در هر ویژگی یا همه یکسان باشند یا همه متفاوت. روی میز ۱۲ کارت است و در این آموزش فقط ۳ کارت در دسته مانده است. شما سه ست پیدا می‌کنید و حریف آموزشی یک ست درست و یک اعلام اشتباه دارد.',
    steps: [
      { instructionFa: 'کارت‌های «۱ لوزی قرمز توپر»، «۲ موج سبز هاشور» و «۳ بیضی بنفش توخالی» را انتخاب کنید و «ست!» را بزنید: در هر چهار ویژگی هر سه کارت با هم متفاوت‌اند، پس ست هستند. جای خالی‌شان با ۳ کارت آخر دسته پر می‌شود.', expected: { type: 'claim', cards: [0, 40, 80] }, reply: { type: 'claim', cards: [13, 19, 42] } },
      { instructionFa: 'حریف سه کارتی اعلام کرد که ست نبود: دو کارت ۲تایی و یکی ۱تایی بود، پس ۱ امتیاز از او کم شد و تا ست بعدی نمی‌تواند دوباره اعلام کند. حالا سه کارت «۲ … بنفش توپر» را بگیرید: تعداد، رنگ و پرشدگی یکسان و شکل‌ها (لوزی، موج، بیضی) همه متفاوت‌اند. چون دسته تمام شده، جای این کارت‌ها دیگر پر نمی‌شود.', expected: { type: 'claim', cards: [19, 22, 25] }, reply: { type: 'claim', cards: [42, 43, 44] } },
      { instructionFa: 'حریف سه بیضی سبز هاشور با تعداد ۱، ۲ و ۳ را گرفت. آخرین ست را بگیرید: سه کارتِ «۳ لوزی» که رنگ و پرشدگی‌شان همه متفاوت است. بعد از آن دسته خالی است و سه کارت باقی‌مانده ست نیستند، پس بازی تمام می‌شود.', expected: { type: 'claim', cards: [2, 38, 74] }, reply: null }
    ],
    completedFa: 'بردید! شما ۳ ست پیدا کردید: ۳ امتیاز. حریف ۱ ست گرفت ولی یک اعلام اشتباه داشت: ۱ − ۱ = ۰ امتیاز. در بازی واقعی دسته ۸۱ کارت دارد، اگر روی میز ستی نباشد ۳ کارت اضافه می‌شود و بازی وقتی تمام می‌شود که دسته خالی شده و ستی روی میز نمانده باشد.'
  }
};
