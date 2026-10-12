// 6 nimmt! bot. Hands are hidden, so it decides from its own projection only. For each card in hand it samples the
// other players' cards from those it cannot see, resolves the turn and counts the bullheads it would take; it plays
// the card with the lowest expected penalty. Forced to take a row, it takes the cheapest.
import { pickByLevel, type BotLevel, type BotStyle, type EngineRng, type GameBot, type Scored } from '@bg/game-sdk';
import { bullheads, rowFor, sixNimmtModule, type SixNimmtAction, type SixNimmtState } from './rules.ts';

const SAMPLES: Record<BotLevel, number> = { easy: 10, medium: 40, hard: 150 };
const heads = (cs: number[]) => cs.reduce((a, c) => a + bullheads(c), 0);
const cheapest = (rows: number[][]) => rows.map((r, k) => ({ k, b: heads(r) })).sort((a, b) => a.b - b.b || a.k - b.k)[0]!.k;
/** cautious also dislikes cards that leave a row one short of six (risky next turn); aggressive ignores that. */
const NEAR_FULL: Record<BotStyle, number> = { aggressive: 0, balanced: 0.5, cautious: 1.5 };

/** Bullheads `seat` takes when its card and the others' cards are placed this turn. */
function penalty(rows: number[][], mine: number, others: number[]): number {
  const r = rows.map((x) => x.slice());
  let taken = 0;
  for (const card of [mine, ...others].sort((a, b) => a - b)) {
    const row = rowFor(r, card);
    const me = card === mine;
    if (row === null) { const k = cheapest(r); if (me) taken += heads(r[k]!); r[k] = [card]; continue; }
    if (r[row]!.length === 5) { if (me) taken += heads(r[row]!); r[row] = [card]; } else r[row]!.push(card);
  }
  return taken;
}

export const sixNimmtBot: GameBot<SixNimmtState, SixNimmtAction> = {
  decide(state, seat, level, rng: EngineRng, style) {
    const v = sixNimmtModule.project(state, { kind: 'player', seat });
    if (v.phase === 'takeRow') return { type: 'takeRow', row: cheapest(v.rows) };
    const hand = v.hand!;
    const seen = new Set([...hand, ...v.rows.flat()]);
    const unseen = Array.from({ length: 104 }, (_, k) => k + 1).filter((c) => !seen.has(c));
    const opponents = v.players - 1;
    const scored: Scored<number>[] = hand.map((card) => {
      let total = 0;
      for (let n = 0; n < SAMPLES[level]; n++) {
        const pool = unseen.slice();
        const others = Array.from({ length: Math.min(opponents, pool.length) }, () => pool.splice(rng.nextInt(pool.length), 1)[0]!);
        total += penalty(v.rows, card, others);
      }
      const row = rowFor(v.rows, card);
      const risk = row !== null && v.rows[row]!.length === 4 ? NEAR_FULL[style] : 0;
      return { move: card, score: -(total / SAMPLES[level]) - risk };
    });
    return { type: 'play', card: pickByLevel(scored, level, rng) };
  }
};
