// line-three bot: full game-tree search (at most 9! lines, heavily pruned). Public game, so the full state is fair.
import { searchAndPick, type GameBot, type SearchBudget, type BotLevel } from '@bg/game-sdk';
import { winningLine, type LineThreeAction, type LineThreeState, type Mark } from './rules.ts';

interface P { board: (Mark | null)[]; current: Mark }

const BUDGETS: Record<BotLevel, SearchBudget> = {
  easy: { maxDepth: 1, maxNodes: 100 },
  medium: { maxDepth: 2, maxNodes: 1_000 },
  hard: { maxDepth: 9, maxNodes: 20_000 }
};

export const lineThreeBot: GameBot<LineThreeState, LineThreeAction> = {
  decide(state, seat, level, rng) {
    const won = (p: P) => winningLine(p.board);
    const cell = searchAndPick<P, number>({
      moves: (p) => (won(p) ? [] : p.board.flatMap((c, i) => (c === null ? [i] : []))),
      play: (p, i) => { const board = p.board.slice(); board[i] = p.current; return { board, current: (1 - p.current) as Mark }; },
      // The side that just moved made the line. Quicker wins and slower losses score higher.
      evaluate: (p, ply) => (won(p) ? (p.current === seat ? -(10 - ply) : 10 - ply) : 0),
      ours: (p) => p.current === seat
    }, { board: state.board, current: state.current }, level, rng, BUDGETS);
    return { type: 'place', cell };
  }
};
