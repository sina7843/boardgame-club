// line-three rules (docs/GAME_MODULES.md): 2 players, 3×3, public state, alternating turns.
// Cells are indexed 0..8 row-major from the board's top-left in board coordinates; never mirrored by the RTL shell.
import { z } from 'zod';
import type { Actor, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { lineThree } from './definition.ts';

export type Mark = 0 | 1; // seat index that owns the cell
export interface LineThreeState {
  board: (Mark | null)[];
  /** symbols[seat] — the first actor plays X. */
  symbols: ['X' | 'O', 'X' | 'O'];
  current: Mark;
  outcome: Outcome | null;
}

export const lineThreeAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), cell: z.number().int().min(0).max(8) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type LineThreeAction = z.infer<typeof lineThreeAction>;

export interface LineThreeView {
  board: ('X' | 'O' | null)[];
  current: Mark | null;
  symbols: ['X' | 'O', 'X' | 'O'];
  winningLine: number[] | null;
  outcome: Outcome | null;
}

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

const winningLine = (board: (Mark | null)[]) =>
  LINES.find(([a, b, c]) => board[a!] !== null && board[a!] === board[b!] && board[a!] === board[c!]) ?? null;

const loserOutcome = (loser: Mark, reason: Outcome['reason']): Outcome => ({
  placements: [{ seat: (1 - loser) as Mark, place: 1 }, { seat: loser, place: 2 }], reason
});

const done = (state: LineThreeState, events: Transition<LineThreeState>['internalEvents']): Transition<LineThreeState> =>
  ({ nextState: state, internalEvents: events, scheduleChanges: [{ kind: 'clear', deadlineKey: 'turn' }] });

export const lineThreeModule: GameModule<LineThreeState, LineThreeAction, LineThreeView> = {
  manifest: lineThree.manifest,
  actionSchema: lineThreeAction,

  setup({ playerCount, rng }) {
    if (playerCount !== 2) throw new Error('line-three needs exactly 2 players');
    const first = rng.nextInt(2) as Mark;
    const symbols: LineThreeState['symbols'] = first === 0 ? ['X', 'O'] : ['O', 'X'];
    return { board: Array<Mark | null>(9).fill(null), symbols, current: first, outcome: null };
  },

  validate(state, actor, action) {
    if (state.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || (actor.seat !== 0 && actor.seat !== 1)) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (action.type === 'resign') return { ok: true };
    if (actor.seat !== state.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (state.board[action.cell] !== null) return { ok: false, errorCode: 'CELL_OCCUPIED' };
    return { ok: true };
  },

  apply(state, actor, action) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat as Mark;
    if (action.type === 'resign') {
      return done({ ...state, outcome: loserOutcome(seat, 'resign') }, [{ type: 'resigned', seat }]);
    }
    const board = state.board.slice();
    board[action.cell] = seat;
    const placed = { type: 'placed', seat, cell: action.cell };
    if (winningLine(board)) {
      return done({ ...state, board, outcome: { placements: [{ seat, place: 1 }, { seat: (1 - seat) as Mark, place: 2 }], reason: 'win' } }, [placed]);
    }
    if (board.every((c) => c !== null)) {
      return done({ ...state, board, outcome: { placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' } }, [placed]);
    }
    return { nextState: { ...state, board, current: (1 - seat) as Mark }, internalEvents: [placed], scheduleChanges: [{ kind: 'set', deadlineKey: 'turn' }] };
  },

  project(state, _viewer: Viewer) {
    // Fully public game: every viewer sees the same board. RNG state is never part of game state.
    return {
      board: state.board.map((c) => (c === null ? null : state.symbols[c])),
      current: state.outcome ? null : state.current,
      symbols: state.symbols,
      winningLine: winningLine(state.board),
      outcome: state.outcome
    };
  },

  legalActions(state, viewer) {
    if (state.outcome || viewer.kind !== 'player') return [];
    const hints: { type: string; cell?: number }[] = [];
    if (viewer.seat === state.current) state.board.forEach((c, cell) => { if (c === null) hints.push({ type: 'place', cell }); });
    hints.push({ type: 'resign' });
    return hints;
  },

  outcome: (state) => state.outcome,

  onTimeout(state) {
    if (state.outcome) return { nextState: state, internalEvents: [], scheduleChanges: [] };
    return done({ ...state, outcome: loserOutcome(state.current, 'timeout') }, [{ type: 'timed-out', seat: state.current }]);
  },

  pendingSeats: (state) => (state.outcome ? [] : [state.current]),

  tutorial: {
    // Seed chosen so the learner (seat 0) moves first and plays X — verified by the engine tests.
    seed: 7,
    introFa: 'در سه‌خطی هر کس زودتر سه نشان خود را در یک ردیف، ستون یا قطر بچیند برنده است. شما X هستید و اول بازی می‌کنید.',
    steps: [
      { instructionFa: 'خانه وسط جدول را انتخاب کنید؛ خانه وسط در چهار خط مشترک است.', expected: { type: 'place', cell: 4 }, reply: { type: 'place', cell: 0 } },
      { instructionFa: 'حریف گوشه را گرفت. حالا گوشه مشخص‌شده را بگیرید تا یک قطر نیمه‌کاره بسازید.', expected: { type: 'place', cell: 2 }, reply: { type: 'place', cell: 1 } },
      { instructionFa: 'حریف قطر شما را نبست. خانه مشخص‌شده را بگیرید و قطر را کامل کنید.', expected: { type: 'place', cell: 6 }, reply: null }
    ],
    completedFa: 'آفرین! سه نشان در یک قطر یعنی برد. اگر جدول پر شود و خطی کامل نشود، بازی مساوی است.'
  }
};
