// Onitama («اونیتاما»): 5×5, each side a master and four students. Five of the 16 move cards are dealt: two each and
// one beside the board. A turn: pick one of your cards and move a piece by one of its offsets (seen from your side);
// the used card goes beside the board and you take the card that was there. Win by capturing the enemy master
// (Way of the Stone) or moving your master onto the enemy temple — its master's start square (Way of the Stream).
// The colour stamped on the side card decides who starts. If no move is possible you still swap a card (pass).
// House safety (not in the box rules): threefold repetition of position + cards is a draw.
//
// Board: index = r * 5 + c, r 0 = red's back row (seat 0, bottom). Red moves towards r 4.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { onitama } from './definition.ts';

export type Side = 'red' | 'blue';
export type Piece = 'rM' | 'rS' | 'bM' | 'bS';
export interface Card { id: string; nameFa: string; nameEn: string; color: Side; moves: [number, number][] }

/** Offsets are (dx, dy) from the owner's side: +dx = to the owner's right, +dy = forward. */
export const CARDS: Card[] = [
  { id: 'tiger', nameFa: 'ببر', nameEn: 'Tiger', color: 'blue', moves: [[0, 2], [0, -1]] },
  { id: 'crab', nameFa: 'خرچنگ', nameEn: 'Crab', color: 'blue', moves: [[-2, 0], [2, 0], [0, 1]] },
  { id: 'monkey', nameFa: 'میمون', nameEn: 'Monkey', color: 'blue', moves: [[-1, 1], [1, 1], [-1, -1], [1, -1]] },
  { id: 'crane', nameFa: 'درنا', nameEn: 'Crane', color: 'blue', moves: [[0, 1], [-1, -1], [1, -1]] },
  { id: 'dragon', nameFa: 'اژدها', nameEn: 'Dragon', color: 'red', moves: [[-2, 1], [2, 1], [-1, -1], [1, -1]] },
  { id: 'elephant', nameFa: 'فیل', nameEn: 'Elephant', color: 'red', moves: [[-1, 1], [1, 1], [-1, 0], [1, 0]] },
  { id: 'mantis', nameFa: 'آخوندک', nameEn: 'Mantis', color: 'red', moves: [[-1, 1], [1, 1], [0, -1]] },
  { id: 'boar', nameFa: 'گراز', nameEn: 'Boar', color: 'red', moves: [[-1, 0], [1, 0], [0, 1]] },
  { id: 'frog', nameFa: 'قورباغه', nameEn: 'Frog', color: 'red', moves: [[-2, 0], [-1, 1], [1, -1]] },
  { id: 'goose', nameFa: 'غاز', nameEn: 'Goose', color: 'blue', moves: [[-1, 0], [-1, 1], [1, 0], [1, -1]] },
  { id: 'horse', nameFa: 'اسب', nameEn: 'Horse', color: 'red', moves: [[-1, 0], [0, 1], [0, -1]] },
  { id: 'eel', nameFa: 'مارماهی', nameEn: 'Eel', color: 'blue', moves: [[-1, 1], [-1, -1], [1, 0]] },
  { id: 'rabbit', nameFa: 'خرگوش', nameEn: 'Rabbit', color: 'blue', moves: [[2, 0], [1, 1], [-1, -1]] },
  { id: 'rooster', nameFa: 'خروس', nameEn: 'Rooster', color: 'red', moves: [[1, 0], [1, 1], [-1, 0], [-1, -1]] },
  { id: 'ox', nameFa: 'گاو', nameEn: 'Ox', color: 'blue', moves: [[1, 0], [0, 1], [0, -1]] },
  { id: 'cobra', nameFa: 'کبرا', nameEn: 'Cobra', color: 'red', moves: [[-1, 0], [1, 1], [1, -1]] }
];
export const cardById = (id: string) => CARDS.find((c) => c.id === id)!;

export interface OnitamaState {
  board: (Piece | null)[];
  /** hands[seat] = two card ids; seat 0 = red, seat 1 = blue. */
  hands: [string[], string[]];
  side: string;
  current: number;
  seen: Record<string, number>;
  history: { seat: number; card: string; from: number | null; to: number | null; captured: Piece | null }[];
  timeouts: [number, number];
  end: { kind: 'stone' | 'stream' | 'resign' | 'timeout' | 'repetition' } | null;
  outcome: Outcome | null;
}
export type OnitamaView = Omit<OnitamaState, 'seen' | 'timeouts'>;

const sq = z.number().int().min(0).max(24);
const cardId = z.enum(CARDS.map((c) => c.id) as [string, ...string[]]);
export const onitamaAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), card: cardId, from: sq, to: sq }),
  z.strictObject({ type: z.literal('pass'), card: cardId }),
  z.strictObject({ type: z.literal('resign') })
]);
export type OnitamaAction = z.infer<typeof onitamaAction>;

const mine = (p: Piece | null, seat: number) => !!p && p[0] === (seat === 0 ? 'r' : 'b');
export const TEMPLE = [2, 22] as const; // red master starts on c1 (index 2), blue on index 22

export function startBoard(): (Piece | null)[] {
  const b: (Piece | null)[] = Array(25).fill(null);
  for (const c of [0, 1, 3, 4]) { b[c] = 'rS'; b[20 + c] = 'bS'; }
  b[2] = 'rM'; b[22] = 'bM';
  return b;
}

/** Target square of a card offset for `seat`'s piece on `from`, or null if off the board. */
export function target(from: number, seat: number, [dx, dy]: [number, number]): number | null {
  const sign = seat === 0 ? 1 : -1;
  const r = Math.floor(from / 5) + dy * sign, c = (from % 5) + dx * sign;
  return r >= 0 && r < 5 && c >= 0 && c < 5 ? r * 5 + c : null;
}

export function movesFor(s: Pick<OnitamaState, 'board' | 'hands'>, seat: number): { card: string; from: number; to: number }[] {
  const out: { card: string; from: number; to: number }[] = [];
  for (const card of s.hands[seat as 0 | 1]) {
    for (let from = 0; from < 25; from++) {
      if (!mine(s.board[from]!, seat)) continue;
      for (const off of cardById(card).moves) {
        const to = target(from, seat, off);
        if (to !== null && !mine(s.board[to]!, seat)) out.push({ card, from, to });
      }
    }
  }
  return out;
}

const key = (s: OnitamaState) => `${s.board.map((p) => p ?? '..').join('')}|${[...s.hands[0]].sort()}|${[...s.hands[1]].sort()}|${s.side}|${s.current}`;

// ---------- module ----------

type Events = Transition<OnitamaState>['internalEvents'];
const MAX_TIMEOUTS = 1;
const finish = (s: OnitamaState, events: Events): Transition<OnitamaState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const win = (s: OnitamaState, seat: number, kind: NonNullable<OnitamaState['end']>['kind'], reason: Outcome['reason']) => {
  s.end = { kind };
  s.outcome = { placements: [{ seat, place: 1 }, { seat: 1 - seat, place: 2 }], reason };
};

function swap(s: OnitamaState, seat: number, card: string) {
  const hand = s.hands[seat as 0 | 1];
  hand[hand.indexOf(card)] = s.side;
  s.side = card;
}

function shuffle(rng: EngineRng): string[] {
  const ids = CARDS.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [ids[i], ids[j]] = [ids[j]!, ids[i]!]; }
  return ids;
}

export const onitamaModule: GameModule<OnitamaState, OnitamaAction, OnitamaView> = {
  manifest: onitama.manifest,
  actionSchema: onitamaAction,

  setup({ playerCount, rng, options }) {
    if (playerCount !== 2) throw new Error('onitama needs exactly 2 players');
    const deck = shuffle(rng);
    const s: OnitamaState = {
      board: startBoard(), hands: [deck.slice(0, 2), deck.slice(2, 4)], side: deck[4]!, current: 0,
      seen: {}, history: [], timeouts: [0, 0], end: null, outcome: null
    };
    if (options.deal === 'tutorial') {
      // A late race. Red: master on 7, students on 1 and 13. Blue: master out on 15, students on 19, 21, 23; blue's
      // temple (22) is empty. Red holds Mantis + Frog, blue Tiger + Ox, Horse is beside the board. Every scripted red
      // move (from → to) is possible with only one of red's two cards.
      s.board = Array(25).fill(null);
      s.board[7] = 'rM'; s.board[1] = 'rS'; s.board[13] = 'rS';
      s.board[15] = 'bM'; s.board[19] = 'bS'; s.board[21] = 'bS'; s.board[23] = 'bS';
      s.hands = [['mantis', 'frog'], ['tiger', 'ox']];
      s.side = 'horse';
      s.current = 0;
    } else s.current = cardById(s.side).color === 'red' ? 0 : 1;
    s.seen[key(s)] = 1;
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (!s.hands[actor.seat].includes(a.card)) return { ok: false, errorCode: 'NOT_YOUR_CARD' };
    const moves = movesFor(s, actor.seat);
    if (a.type === 'pass') return moves.length ? { ok: false, errorCode: 'MOVE_AVAILABLE' } : { ok: true };
    return moves.some((m) => m.card === a.card && m.from === a.from && m.to === a.to) ? { ok: true } : { ok: false, errorCode: 'ILLEGAL_MOVE' };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { win(s, 1 - seat, 'resign', 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    if (a.type === 'pass') {
      s.history.push({ seat, card: a.card, from: null, to: null, captured: null });
      swap(s, seat, a.card);
    } else {
      const piece = s.board[a.from]!;
      const captured = s.board[a.to] ?? null;
      s.board[a.to] = piece;
      s.board[a.from] = null;
      s.history.push({ seat, card: a.card, from: a.from, to: a.to, captured });
      swap(s, seat, a.card);
      if (captured === (seat === 0 ? 'bM' : 'rM')) { win(s, seat, 'stone', 'win'); return finish(s, [{ type: 'moved', seat }]); }
      if (piece[1] === 'M' && a.to === TEMPLE[1 - seat]) { win(s, seat, 'stream', 'win'); return finish(s, [{ type: 'moved', seat }]); }
    }
    s.current = 1 - seat;
    const k = key(s);
    s.seen[k] = (s.seen[k] ?? 0) + 1;
    if (s.seen[k]! >= 3) { s.end = { kind: 'repetition' }; s.outcome = { placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' }; }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { seen: _s, timeouts: _t, ...rest } = s;
    void _s; void _t;
    return structuredClone(rest);
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || (viewer.seat !== 0 && viewer.seat !== 1)) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) {
      const moves = movesFor(s, viewer.seat);
      for (const m of moves) out.push({ type: 'move', ...m });
      if (!moves.length) for (const card of s.hands[viewer.seat]) out.push({ type: 'pass', card });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.timeouts[seat]! += 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) win(s, 1 - seat, 'timeout', 'timeout');
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 7,
    options: { deal: 'tutorial' },
    introFa: 'شما قرمز هستید و از پایین صفحه رو به بالا بازی می‌کنید. استاد آبی معبدش را خالی گذاشته و به سمت معبد شما آمده است؛ هر کس زودتر برسد یا استاد دیگری را بزند برنده است. هر کارت حرکت، خانه‌هایی را نشان می‌دهد که مهره نسبت به جای فعلی‌اش می‌تواند برود (خانهٔ وسط کارت جای مهره است و بالای کارت رو به حریف). دست شما «آخوندک» و «قورباغه» است، حریف «ببر» و «گاو» دارد و «اسب» کنار صفحه است.',
    steps: [
      { instructionFa: 'آخوندک اجازه می‌دهد یک خانهٔ مورب رو به جلو بروید. شاگرد وسطی‌تان را با آخوندک یک خانهٔ مورب جلو ببرید و شاگرد آبی را بزنید؛ مهرهٔ زده‌شده از بازی بیرون می‌رود. بعد از حرکت، آخوندک کنار صفحه می‌رود و «اسب» مال شما می‌شود.', expected: { type: 'move', card: 'mantis', from: 13, to: 19 }, reply: { type: 'move', card: 'tiger', from: 15, to: 5 } },
      { instructionFa: 'حریف با «ببر» استادش را دو خانه جلو آورد و آخوندک شما را برداشت؛ ببر حالا کنار صفحه است. با «اسب» که تازه گرفتید استادتان را یک خانه مستقیم جلو ببرید. حواستان باشد: هر کارتی بازی کنید، نوبت بعد به دست حریف می‌رسد.', expected: { type: 'move', card: 'horse', from: 7, to: 12 }, reply: { type: 'move', card: 'mantis', from: 5, to: 1 } },
      { instructionFa: 'حریف با آخوندکِ شما شاگردتان را زد و حالا «اسب» را دارد که استادش را با آن به معبد شما می‌رساند! ولی نوبت شماست و «ببر» حریف به دست شما رسیده: ببر دو خانه مستقیم جلو می‌برد. استادتان را با ببر به معبد خالی آبی ببرید.', expected: { type: 'move', card: 'tiger', from: 12, to: 22 }, reply: null }
    ],
    completedFa: 'بردید! استاد شما به معبد آبی (خانهٔ شروع استاد او) رسید؛ این «راه رود» است. راه دیگر برد «راه سنگ» است: زدن استاد حریف. دیدید که کارت‌ها دست‌به‌دست می‌چرخند: آخوندکی که شما بازی کردید به حریف رسید و ببر حریف برد را برای شما آورد.'
  }
};
