// Shared helpers for game bots: bounded game-tree search and level-based move choice. Pure and deterministic
// (node budget, never wall clock), so a bot move costs the worker a bounded, measurable amount of CPU.
import type { BotLevel, EngineRng } from './index.ts';

/** Two-sided search over a game's own position type. */
export interface SearchSpec<P, M> {
  /** Moves of the side to move; empty means the game is over at `p`. */
  moves(p: P): M[];
  /** Position after `m`. Must not mutate `p`. */
  play(p: P, m: M): P;
  /**
   * Score for the searching side (higher is better). `ended` is true when `moves(p)` was empty (game over), false at
   * the depth limit, so a game only checks for mate/stalemate where it matters. `ply` prefers quicker wins.
   */
  evaluate(p: P, ply: number, ended: boolean): number;
  /** True when the searching side chooses at `p`; otherwise the opponent picks the move worst for us. */
  ours(p: P): boolean;
  /** Optional move-ordering hint (higher is searched first, e.g. captures); improves pruning only. */
  order?(p: P, m: M): number;
}

export interface Scored<M> { move: M; score: number }

/** Search limits per level. A depth is used only if it completes within the node budget. */
export interface SearchBudget { maxDepth: number; maxNodes: number }

class OutOfNodes extends Error {}

/**
 * Iterative-deepening alpha-beta. Every root move gets an exact score at the deepest depth that fit in
 * `maxNodes` (depth 1 always completes), so a level can choose among near-best moves, not just the best.
 */
export function searchMoves<P, M>(spec: SearchSpec<P, M>, root: P, budget: SearchBudget): Scored<M>[] {
  const rootMoves = sortMoves(spec, root, spec.moves(root));
  let nodes = 0;
  let limited = false; // depth 1 (one evaluation per root move) always completes
  const ab = (p: P, depth: number, ply: number, alpha: number, beta: number): number => {
    if (++nodes > budget.maxNodes && limited) throw new OutOfNodes();
    if (depth === 0) return spec.evaluate(p, ply, false);
    const ms = spec.moves(p);
    if (!ms.length) return spec.evaluate(p, ply, true);
    const max = spec.ours(p);
    let best = max ? -Infinity : Infinity;
    for (const m of sortMoves(spec, p, ms)) {
      const v = ab(spec.play(p, m), depth - 1, ply + 1, alpha, beta);
      if (max) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
      if (alpha >= beta) break;
    }
    return best;
  };
  let result: Scored<M>[] = [];
  for (let depth = 1; depth <= Math.max(1, budget.maxDepth); depth++) {
    limited = depth > 1;
    try {
      result = rootMoves.map((move) => ({ move, score: ab(spec.play(root, move), depth - 1, 1, -Infinity, Infinity) }));
    } catch (e) {
      if (e instanceof OutOfNodes) break;
      throw e;
    }
  }
  return result;
}

function sortMoves<P, M>(spec: SearchSpec<P, M>, p: P, ms: M[]): M[] {
  return spec.order ? ms.map((m) => ({ m, k: spec.order!(p, m) })).sort((a, b) => b.k - a.k).map((x) => x.m) : ms;
}

/** Default search limits; games with cheap or expensive positions pass their own. */
export const DEFAULT_BUDGETS: Record<BotLevel, SearchBudget> = {
  easy: { maxDepth: 1, maxNodes: 2_000 },
  medium: { maxDepth: 3, maxNodes: 15_000 },
  hard: { maxDepth: 6, maxNodes: 60_000 }
};

/**
 * Choose by level from scored moves. easy: often a random move, otherwise one of the top three;
 * medium: usually the best, sometimes the second best; hard: always a best move. Ties break randomly.
 */
export function pickByLevel<M>(scored: Scored<M>[], level: BotLevel, rng: EngineRng): M {
  if (!scored.length) throw new Error('pickByLevel needs at least one move');
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const any = <T>(xs: T[]) => xs[rng.nextInt(xs.length)]!;
  const bestTies = sorted.filter((s) => s.score === sorted[0]!.score);
  if (level === 'easy') return rng.nextInt(100) < 35 ? any(sorted).move : any(sorted.slice(0, 3)).move;
  if (level === 'medium' && sorted.length > bestTies.length && rng.nextInt(100) < 15) return sorted[bestTies.length]!.move;
  return any(bestTies).move;
}

/** Search, then choose by level. */
export function searchAndPick<P, M>(spec: SearchSpec<P, M>, root: P, level: BotLevel, rng: EngineRng,
  budgets: Record<BotLevel, SearchBudget> = DEFAULT_BUDGETS): M {
  return pickByLevel(searchMoves(spec, root, budgets[level]), level, rng);
}
