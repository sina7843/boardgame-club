// Point Salad bot. Everything it uses is public (market, pile tops, every player's cards). Every option is valued by
// how much it raises the bot's position: points scored now plus unfinished progress (weighed by how much of the game
// is left). Cards are never flipped to vegetables.
import { pickByLevel, type BotStyle, type GameBot, type Scored } from '@bg/game-sdk';
import { CARDS, counts, pointSaladModule, ruleScore, VEG, type PointSaladAction, type PointSaladState, type Rule, type Veg } from './rules.ts';

/**
 * Points a rule is on its way to: progress towards its next combo or set, and the lead in «most» races. Weighed by
 * how much of the game is left, this lets the bot value vegetables that are not worth points yet.
 */
function partial(r: Rule, me: Record<Veg, number>, all: Record<Veg, number>[]): number {
  switch (r.k) {
    case 'combo': {
      const need = new Map<Veg, number>();
      for (const x of r.veg) need.set(x, (need.get(x) ?? 0) + 1);
      const sets = Math.min(...[...need].map(([x, n]) => Math.floor(me[x] / n)));
      const have = [...need].reduce((a, [x, n]) => a + Math.min(n, me[x] - sets * n), 0);
      return (have / r.veg.length) * r.pts;
    }
    case 'set': return (VEG.filter((x) => me[x] > Math.min(...VEG.map((y) => me[y]))).length / 6) * 12;
    case 'most': return me[r.veg] > 0 && all.every((o) => o[r.veg] <= me[r.veg] + 1) ? 4 : 0;
    case 'each': return 3 * Math.max(0, r.terms.reduce((a, [, p]) => a + p, 0)); // a few more of its vegetables will come
    default: return 1;
  }
}
/** aggressive collects point cards, cautious grows vegetables. */
const RULE_BIAS: Record<BotStyle, number> = { aggressive: 1.2, balanced: 1, cautious: 0.8 };

export const pointSaladBot: GameBot<PointSaladState, PointSaladAction> = {
  decide(state, seat, level, rng, style) {
    const v = pointSaladModule.project(state, { kind: 'player', seat });
    const all = v.veggies.map(counts);
    // Share of the game still to come: how much unfinished progress is worth.
    const remaining = (v.pileCounts.reduce((a, b) => a + b, 0) + v.market.filter((x) => x !== null).length) / (18 * v.players);
    const value = (veggies: number[], rules: number[]) => {
      const c = all.slice(); c[seat] = counts(veggies);
      return rules.reduce((a, id) => a + ruleScore(CARDS[id]!.rule, seat, c) + remaining * partial(CARDS[id]!.rule, c[seat]!, c), 0);
    };
    const now = value(v.veggies[seat]!, v.rules[seat]!);
    const scored: Scored<PointSaladAction>[] = [];
    v.pileTops.forEach((id, pile) => {
      if (id === null) return;
      scored.push({ move: { type: 'rule', pile }, score: RULE_BIAS[style] * (value(v.veggies[seat]!, [...v.rules[seat]!, id]) - now) });
    });
    const avail = v.market.map((x, i) => (x === null ? -1 : i)).filter((i) => i >= 0);
    const pairs = avail.length >= 2 ? avail.flatMap((a, i) => avail.slice(i + 1).map((b) => [a, b])) : avail.map((a) => [a]);
    for (const slots of pairs) {
      scored.push({ move: { type: 'veg', slots }, score: value([...v.veggies[seat]!, ...slots.map((i) => v.market[i]!)], v.rules[seat]!) - now });
    }
    return pickByLevel(scored, level, rng);
  }
};
