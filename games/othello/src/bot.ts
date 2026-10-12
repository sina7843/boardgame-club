// Othello bot: alpha-beta over a classic square-weight table. Public game, so the full state is fair.
import { searchAndPick, type BotLevel, type GameBot, type SearchBudget } from '@bg/game-sdk';
import { count, flips, legalSquares, type Disc, type OthelloAction, type OthelloState } from './rules.ts';

interface P { board: (Disc | null)[]; turn: Disc }
const PASS = -1;
const other = (d: Disc): Disc => (d === 'b' ? 'w' : 'b');

// Corners are gold, squares next to an empty corner are dangerous, edges are good.
const W = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100
];

const BUDGETS: Record<BotLevel, SearchBudget> = {
  easy: { maxDepth: 1, maxNodes: 500 },
  medium: { maxDepth: 3, maxNodes: 4_000 },
  hard: { maxDepth: 6, maxNodes: 12_000 }
};

export const othelloBot: GameBot<OthelloState, OthelloAction> = {
  decide(state, seat, level, rng, style) {
    const me = state.colors[seat]!;
    const sq = searchAndPick<P, number>({
      moves: (p) => {
        const own = legalSquares(p.board, p.turn);
        if (own.length) return own;
        return legalSquares(p.board, other(p.turn)).length ? [PASS] : [];
      },
      play: (p, m) => {
        if (m === PASS) return { board: p.board, turn: other(p.turn) };
        const board = p.board.slice();
        for (const i of [m, ...flips(p.board, m, p.turn)]) board[i] = p.turn;
        return { board, turn: other(p.turn) };
      },
      evaluate: (p, ply, ended) => {
        if (ended) {
          const c = count(p.board);
          const diff = me === 'b' ? c.b - c.w : c.w - c.b;
          return diff === 0 ? 0 : Math.sign(diff) * (10_000 - ply) + diff;
        }
        // Style: aggressive also counts discs (greedy flips), cautious fears the squares next to corners twice as much.
        let s = 0;
        p.board.forEach((d, i) => {
          if (!d) return;
          const v = (style === 'cautious' && W[i]! < 0 ? 2 * W[i]! : W[i]!) + (style === 'aggressive' ? 4 : 0);
          s += d === me ? v : -v;
        });
        return s;
      },
      ours: (p) => p.turn === me,
      order: (_p, m) => (m === PASS ? 0 : W[m]!)
    }, { board: state.board, turn: state.turn }, level, rng, BUDGETS);
    return { type: 'place', sq };
  }
};
