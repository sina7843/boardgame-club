// Checkers bot: alpha-beta over material (kings worth three men), advancement and back-row guard.
// Public game, so the full state is fair. Repetition and the quiet-move draw are left to the rules.
import { searchMoves, pickByLevel, type BotLevel, type BotStyle, type GameBot, type SearchBudget } from '@bg/game-sdk';
import { applyMove, legalMoves, rowOf, type CheckersAction, type CheckersState, type Color, type Move, type Piece } from './rules.ts';

interface P { board: (Piece | null)[]; turn: Color }
const other = (c: Color): Color => (c === 'd' ? 'l' : 'd');
const colorOf = (p: Piece) => p.toLowerCase() as Color;

const BUDGETS: Record<BotLevel, SearchBudget> = {
  easy: { maxDepth: 1, maxNodes: 500 },
  medium: { maxDepth: 4, maxNodes: 6_000 },
  hard: { maxDepth: 8, maxNodes: 30_000 }
};

/** Style weights: aggressive races men forward, cautious keeps the home row guarded. */
const STYLE: Record<BotStyle, { adv: number; guard: number }> = {
  aggressive: { adv: 8, guard: 0 },
  balanced: { adv: 4, guard: 8 },
  cautious: { adv: 2, guard: 20 }
};

export const checkersBot: GameBot<CheckersState, CheckersAction> = {
  decide(state, seat, level, rng, style) {
    const me = state.colors[seat]!;
    const w = STYLE[style];
    const king = state.variant === 'brazilian' ? 500 : 300;
    const material = (b: (Piece | null)[]) => {
      let s = 0;
      b.forEach((p, i) => {
        if (!p) return;
        const c = colorOf(p);
        // Men gain a little per row advanced; men on the home row guard against enemy crowning.
        const adv = c === 'd' ? rowOf(i) : 7 - rowOf(i);
        const v = p === p.toUpperCase() ? king : 100 + w.adv * adv + (adv === 0 ? w.guard : 0);
        s += c === me ? v : -v;
      });
      return s;
    };
    const spec = {
      moves: (p: P) => legalMoves(p.board, p.turn, state.variant),
      play: (p: P, m: Move): P => ({ board: applyMove(p.board, m), turn: other(p.turn) }),
      // No moves for the side to move = that side loses.
      evaluate: (p: P, ply: number, ended: boolean) => (!ended ? material(p.board)
        : p.turn === me ? -(100_000 - ply) : 100_000 - ply),
      ours: (p: P) => p.turn === me,
      order: (_p: P, m: Move) => m.captured.length * 10 + (m.crowned ? 5 : 0)
    };
    const root = { board: state.board, turn: state.turn };
    const scored = searchMoves(spec, root, BUDGETS[level]);
    // A draw offer from the human is accepted when the bot is clearly behind (medium/hard only).
    if (state.drawOffer === 1 - seat && level !== 'easy' && Math.max(...scored.map((s) => s.score)) < -150) return { type: 'acceptDraw' };
    return { type: 'move', path: pickByLevel(scored, level, rng).path };
  }
};
