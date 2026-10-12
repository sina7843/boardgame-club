// Sushi Go! bot. Hands pass around hidden, so it decides from its own projection only. Each card gets the points it
// is likely to add to its own tableau given how many picks are left this round; chopsticks take a second card when
// that one is worth it.
import { pickByLevel, type BotStyle, type GameBot, type Scored } from '@bg/game-sdk';
import { MAKI, NIGIRI, sushiGoModule, type Kind, type Played, type SushiGoAction, type SushiGoState } from './rules.ts';

const DUMPLING = [0, 1, 3, 6, 10, 15];
/** aggressive chases sets (sashimi, tempura), cautious takes sure nigiri and dumplings. */
const SET_BIAS: Record<BotStyle, number> = { aggressive: 1.3, balanced: 1, cautious: 0.75 };

function cardValue(k: Kind, table: Played[], left: number, round: number, style: BotStyle): number {
  const n = (x: Kind) => table.filter((c) => c.kind === x).length;
  const freeWasabi = n('wasabi') - table.filter((c) => c.wasabi).length;
  const set = SET_BIAS[style];
  switch (k) {
    case 'tempura': return n('tempura') % 2 ? 5 : left >= 2 ? 2.5 * set : 0;
    case 'sashimi': { const r = n('sashimi') % 3; return r === 2 ? 10 : r === 1 ? (left >= 2 ? 4 * set : 0) : left >= 3 ? 2.5 * set : 0; }
    case 'dumpling': return DUMPLING[Math.min(5, n('dumpling') + 1)]! - DUMPLING[Math.min(5, n('dumpling'))]!;
    case 'wasabi': return left >= 3 ? 3 / set : 0;
    case 'chopsticks': return left >= 4 ? 1.5 : 0;
    case 'pudding': return round === 3 ? 3 : 2;
    default:
      if (NIGIRI[k]) return NIGIRI[k]! * (freeWasabi > 0 ? 3 : 1);
      return (MAKI[k] ?? 0) * 1.2;
  }
}

export const sushiGoBot: GameBot<SushiGoState, SushiGoAction> = {
  decide(state, seat, level, rng, style) {
    const v = sushiGoModule.project(state, { kind: 'player', seat });
    const hand = v.hand!;
    const table = v.table[seat]!;
    const left = hand.length;
    const scored: Scored<Kind>[] = [...new Set(hand)].map((k) => ({ move: k, score: cardValue(k, table, left, v.round, style) }));
    const card = pickByLevel(scored, level, rng);
    // Chopsticks on the table: take a second card when it is clearly worth giving the chopsticks back.
    if (level !== 'easy' && table.some((c) => c.kind === 'chopsticks') && left >= 2) {
      const after = [...table, { kind: card }];
      const rest = hand.slice();
      rest.splice(rest.indexOf(card), 1);
      const second = [...new Set(rest)].map((k) => ({ k, s: cardValue(k, after, left - 1, v.round, style) })).sort((a, b) => b.s - a.s)[0];
      if (second && second.s >= 4) return { type: 'pick', card, extra: second.k };
    }
    return { type: 'pick', card };
  }
};
