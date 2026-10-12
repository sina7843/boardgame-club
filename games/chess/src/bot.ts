// Chess bot: alpha-beta over material plus simple piece placement (central knights/bishops, advanced pawns).
// Public game, so the full state is fair. Repetition and the fifty-move rule are left to the rules.
import { pickByLevel, searchMoves, type BotLevel, type GameBot, type SearchBudget } from '@bg/game-sdk';
import { inCheck, insufficientMaterial, legalMoves, makeMove, sqName, type ChessAction, type ChessState, type Color, type Move, type Position } from './rules.ts';

const VALUE: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

const BUDGETS: Record<BotLevel, SearchBudget> = {
  easy: { maxDepth: 1, maxNodes: 200 },
  medium: { maxDepth: 2, maxNodes: 2_500 },
  hard: { maxDepth: 4, maxNodes: 8_000 }
};

/** Material and placement from `me`'s side. */
function material(board: Position['board'], me: Color): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const c = p[0] as Color, t = p[1]!;
    const f = i % 8, r = Math.floor(i / 8);
    const centre = 7 - (Math.abs(3.5 - f) + Math.abs(3.5 - r)); // 0 (corner) … 6 (centre)
    let v = VALUE[t]!;
    if (t === 'N' || t === 'B') v += 4 * centre;
    if (t === 'P') v += 6 * (c === 'w' ? r - 1 : 6 - r) + (f >= 2 && f <= 5 ? 4 : 0);
    if (t === 'K') v += (c === 'w' ? r === 0 : r === 7) ? 10 : -10; // keep the king home in a simple way
    s += c === me ? v : -v;
  }
  return s;
}

export const chessBot: GameBot<ChessState, ChessAction> = {
  decide(state, seat, level, rng) {
    const me = state.colors[seat]!;
    const spec = {
      moves: (p: Position) => (insufficientMaterial(p.board) ? [] : legalMoves(p)),
      play: (p: Position, m: Move) => makeMove(p, m),
      evaluate: (p: Position, ply: number, ended: boolean) => {
        if (insufficientMaterial(p.board)) return 0;
        if (!ended) return material(p.board, me);
        if (!inCheck(p)) return 0; // stalemate
        return p.turn === me ? -(100_000 - ply) : 100_000 - ply;
      },
      ours: (p: Position) => p.turn === me,
      // Captures of valuable pieces by cheap ones first, then promotions.
      order: (p: Position, m: Move) => (m.captured ? 10 * VALUE[m.captured[1]!]! - VALUE[p.board[m.from]![1]!]! : 0) + (m.promo ? 800 : 0)
    };
    const scored = searchMoves(spec, state.pos, BUDGETS[level]);
    if (state.drawOffer === 1 - seat && level !== 'easy' && Math.max(...scored.map((s) => s.score)) < -200) return { type: 'acceptDraw' };
    const m = pickByLevel(scored, level, rng);
    return { type: 'move', from: sqName(m.from), to: sqName(m.to), ...(m.promo ? { promotion: m.promo } : {}) };
  }
};
