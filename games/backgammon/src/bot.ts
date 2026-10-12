// Backgammon bot: rolls, answers doubles by the race, and picks a whole play by scoring the position it leaves:
// pip race, blots within reach of enemy checkers, made points (home board and primes count more), hits and
// checkers borne off. One ply (the opponent's next roll is not searched). The board is public, so the state is fair.
import { pickByLevel, type BotStyle, type GameBot } from '@bg/game-sdk';
import { legalPlays, pipCount, step, type BgAction, type BgState, type Pos, type Step } from './rules.ts';

const STYLE: Record<BotStyle, { hit: number; blot: number }> = {
  aggressive: { hit: 28, blot: 5 },
  balanced: { hit: 18, blot: 9 },
  cautious: { hit: 10, blot: 15 }
};

const mine = (p: Pos, i: number, seat: number) => (seat === 0 ? Math.max(0, p.pts[i]!) : Math.max(0, -p.pts[i]!));
const home = (i: number, seat: number) => (seat === 0 ? i <= 5 : i >= 18);

/** Position value for `seat`. */
function evaluate(p: Pos, seat: number, style: BotStyle): number {
  const w = STYLE[style];
  const opp = 1 - seat;
  let v = (pipCount(p, opp) - pipCount(p, seat)) + 12 * p.off[seat]! + w.hit * p.bar[opp]! - 20 * p.bar[seat]!;
  let run = 0;
  for (let i = 0; i < 24; i++) {
    const n = mine(p, i, seat);
    if (n >= 2) { v += home(i, seat) ? 6 : 3; run++; if (run >= 3) v += 3 * (run - 2); } else run = 0; // primes
    if (n === 1) {
      // Enemy checkers (or bar) that can reach this blot: direct shots within 6 cost more than indirect within 12.
      let shots = 0;
      for (let j = 0; j < 24; j++) {
        if (mine(p, j, opp) === 0) continue;
        const d = opp === 0 ? j - i : i - j; // distance in the enemy's direction of travel
        if (d >= 1 && d <= 12) shots += d <= 6 ? 2 : 1;
      }
      if (p.bar[opp]! > 0 && (opp === 0 ? 24 - i : i + 1) <= 6) shots += 2;
      v -= w.blot * Math.min(shots, 4) / 2;
    }
  }
  return v;
}

export const backgammonBot: GameBot<BgState, BgAction> = {
  decide(s, seat, level, rng, style) {
    const lead = () => pipCount(s, 1 - seat) - pipCount(s, seat); // > 0: we are ahead in the race
    if (s.phase === 'cube') return lead() > -0.2 * pipCount(s, seat) ? { type: 'take' } : { type: 'drop' };
    if (s.phase === 'roll') {
      const canDouble = s.rules.cube && s.cube.value < 64 && (s.cube.owner === null || s.cube.owner === seat);
      return canDouble && level !== 'easy' && lead() > 0.12 * pipCount(s, seat) && pipCount(s, seat) < 120 ? { type: 'double' } : { type: 'roll' };
    }
    const seen = new Set<string>();
    const scored: { move: Step[]; score: number }[] = [];
    for (const play of legalPlays(s, seat, s.dice!)) {
      let pos: Pos = s;
      for (const m of play) pos = step(pos, seat, m).pos;
      const key = `${pos.pts.join()}|${pos.bar.join()}|${pos.off.join()}`;
      if (seen.has(key)) continue; // different orders, same result
      seen.add(key);
      scored.push({ move: play, score: evaluate(pos, seat, style) });
    }
    return { type: 'play', moves: pickByLevel(scored, level, rng) };
  }
};
