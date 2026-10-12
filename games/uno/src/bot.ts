// UNO bot. Hidden hands, so it decides from its own projection only. Plays the most useful matching card (dumps
// high numbers, saves wilds, hits a near-empty next player with action cards), draws when nothing fits, always
// calls UNO (easy sometimes forgets), challenges a Wild Draw 4 from a big hand, and names its strongest colour.
import { pickByLevel, type BotStyle, type GameBot, type Scored } from '@bg/game-sdk';
import { canPlay, COLORS, unoModule, type Card, type Color, type UnoAction, type UnoState } from './rules.ts';

const STYLE: Record<BotStyle, { attack: number; wild: number }> = {
  aggressive: { attack: 12, wild: 4 },
  balanced: { attack: 7, wild: 8 },
  cautious: { attack: 3, wild: 14 }
};

const bestColor = (hand: Card[]): Color => {
  const n = (c: Color) => hand.filter((x) => x.color === c).length;
  return [...COLORS].sort((a, b) => n(b) - n(a))[0]!;
};

export const unoBot: GameBot<UnoState, UnoAction> = {
  decide(state, seat, level, rng, style) {
    const v = unoModule.project(state, { kind: 'player', seat });
    const hand = v.myHand ?? [];
    const w = STYLE[style];
    if (v.phase === 'chooseColor') return { type: 'chooseColor', color: bestColor(hand) };
    if (v.phase === 'wd4') {
      // Wild Draw 4 is only legal without a card of the previous colour: a big hand more likely had one.
      const big = (v.handCounts[v.wd4!.offender] ?? 0) >= 4;
      return level !== 'easy' && big && rng.nextInt(100) < (level === 'hard' ? 60 : 35) ? { type: 'challenge' } : { type: 'accept' };
    }
    // Next active seat in play order: how close it is to going out.
    let next = seat;
    for (let k = 1; k <= v.players; k++) { const n = (seat + v.direction * k + v.players * k) % v.players; if (v.active[n]) { next = n; break; } }
    const threat = (v.handCounts[next] ?? 7) <= 2;
    const sayUno = hand.length === 2 && !(level === 'easy' && rng.nextInt(100) < 30);
    const candidates = v.phase === 'drawn' ? hand.filter((c) => c.id === v.drawnId) : hand;
    const scored: Scored<UnoAction>[] = [];
    for (const c of candidates) {
      if (!canPlay(c, v.top, v.color)) continue;
      let score = c.kind === 'num' ? 10 + c.value! : 18;
      if (c.kind === 'skip' || c.kind === 'd2' || c.kind === 'rev') score += threat ? w.attack + 8 : w.attack - 6;
      if (c.kind === 'wild' || c.kind === 'wd4') score = 6 - w.wild + (threat ? w.attack : 0);
      // Keep the colour we hold most of: playing a card of that colour keeps options open.
      if (c.color && c.color === bestColor(hand)) score += 3;
      const color = c.color ? undefined : bestColor(hand.filter((x) => x.id !== c.id));
      scored.push({ move: { type: 'play', card: c.id, ...(color ? { color } : {}), ...(sayUno ? { uno: true } : {}) }, score });
    }
    if (!scored.length) return v.phase === 'drawn' ? { type: 'keep' } : { type: 'draw' };
    return pickByLevel(scored, level, rng);
  }
};
