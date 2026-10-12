// Yahtzee bot: compares «score now» in each open box with «keep these dice and reroll», whose value is estimated by
// sampling rerolls. Box values are points minus a par (what that box usually earns), so a weak roll is dumped into the
// box that costs least. Dice and sheets are public, so the full state is fair.
import { pickByLevel, type BotLevel, type BotStyle, type EngineRng, type GameBot, type Scored } from '@bg/game-sdk';
import { scoreOptions, UPPER, type Cat, type Sheet, type YahtzeeAction, type YahtzeeState } from './rules.ts';

/** Typical points per box over a game; scoring below par is a loss even when points are positive. */
const PAR: Record<Cat, number> = {
  ones: 2, twos: 5, threes: 8, fours: 11, fives: 14, sixes: 17,
  threeKind: 15, fourKind: 8, fullHouse: 15, smallStraight: 18, largeStraight: 15, yahtzee: 10, chance: 22
};
const SAMPLES: Record<BotLevel, number> = { easy: 6, medium: 24, hard: 80 };
/** Extra value a reroll must promise before the bot gives up a sure score (aggressive chases, cautious banks). */
const MARGIN: Record<BotStyle, number> = { aggressive: -2, balanced: 0, cautious: 3 };

function boxValue(sheet: Sheet, cat: Cat, points: number): number {
  let v = points - PAR[cat];
  const face = UPPER.indexOf(cat) + 1;
  if (face > 0 && points >= 3 * face) v += 4; // on track for the upper bonus
  return v;
}

const bestNow = (sheet: Sheet, dice: number[]) => Math.max(...scoreOptions(sheet, dice).map((o) => boxValue(sheet, o.cat, o.points)));

export const yahtzeeBot: GameBot<YahtzeeState, YahtzeeAction> = {
  decide(s, seat, level, rng, style) {
    const none = [false, false, false, false, false];
    if (s.rolls === 0) return { type: 'roll', keep: none };
    const sheet = s.sheets[seat]!;
    type Choice = { kind: 'score'; cat: Cat } | { kind: 'roll'; keep: boolean[] };
    const scored: Scored<Choice>[] = scoreOptions(sheet, s.dice).map((o) => ({ move: { kind: 'score', cat: o.cat }, score: boxValue(sheet, o.cat, o.points) }));
    if (s.rolls < 3) {
      const seen = new Set<string>();
      for (let mask = 0; mask < 31; mask++) { // 31 = keep all, which is the same as scoring now
        const keep = s.dice.map((_, i) => !!(mask & (1 << i)));
        const key = s.dice.filter((_, i) => keep[i]).sort().join();
        if (seen.has(key)) continue;
        seen.add(key);
        scored.push({ move: { kind: 'roll', keep }, score: rerollValue(sheet, s.dice, keep, SAMPLES[level], rng) - MARGIN[style] });
      }
    }
    const c = pickByLevel(scored, level, rng);
    return c.kind === 'score' ? { type: 'score', cat: c.cat } : { type: 'roll', keep: c.keep };
  }
};

/** Average best box value after rerolling the unkept dice once (later rerolls are not modelled). */
function rerollValue(sheet: Sheet, dice: number[], keep: boolean[], samples: number, rng: EngineRng): number {
  let total = 0;
  for (let n = 0; n < samples; n++) total += bestNow(sheet, dice.map((d, i) => (keep[i] ? d : 1 + rng.nextInt(6))));
  return total / samples;
}
