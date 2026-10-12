// Lost Cities bot. The opponent's hand is hidden, so it decides from its own projection only. It plays cards that
// extend its expeditions with small gaps, starts an expedition only when its hand holds enough of that colour to
// beat the 20-point cost, discards what helps it least and helps the opponent least, and draws a discard only when
// it fits one of its expeditions.
import { pickByLevel, type BotStyle, type GameBot, type Scored } from '@bg/game-sdk';
import { canPlay, color, lostCitiesModule, value, type CardId, type LostCitiesAction, type LostCitiesState } from './rules.ts';

/** Hand value needed in a colour before starting it: aggressive opens early, cautious waits. */
const OPEN_AT: Record<BotStyle, number> = { aggressive: 14, balanced: 18, cautious: 22 };

export const lostCitiesBot: GameBot<LostCitiesState, LostCitiesAction> = {
  decide(state, seat, level, rng, style) {
    const v = lostCitiesModule.project(state, { kind: 'player', seat });
    const hand = v.hand!;
    const mine = v.exp[seat]!, theirs = v.exp[1 - seat]!;
    const top = (cs: CardId[]) => cs.at(-1);
    if (v.phase === 'draw') {
      const scored: Scored<LostCitiesAction>[] = [{ move: { type: 'draw', from: 'deck' }, score: 0 }];
      for (const [c, pile] of Object.entries(v.discard) as [keyof typeof v.discard, CardId[]][]) {
        const card = top(pile);
        if (!card || c === v.justDiscarded) continue;
        const started = mine[c].length > 0;
        const gap = started ? value(card) - value(top(mine[c])!) - 1 : 99;
        scored.push({ move: { type: 'draw', from: c }, score: started && canPlay(mine, card) && value(card) > 0 ? 4 - gap : -1 });
      }
      // No random draws at any level: drawing discards instead of the deck would stall the round.
      return scored.sort((x, y) => y.score - x.score)[0]!.move;
    }
    // Sum of our hand in each colour: the promise of an expedition there.
    const handSum = (c: string) => hand.filter((x) => color(x) === c).reduce((a, x) => a + (value(x) || 5), 0);
    const late = v.deckCount < 10;
    const scored: Scored<LostCitiesAction>[] = [];
    for (const card of new Set(hand)) {
      const c = color(card);
      const started = mine[c].length > 0;
      if (canPlay(mine, card)) {
        let s: number;
        if (started) s = value(card) === 0 ? 2 : 6 - (value(card) - value(top(mine[c])!) - 1);
        else s = handSum(c) + (value(card) === 0 ? 0 : value(card)) >= OPEN_AT[style] && !late ? (handSum(c) - 20) / 2 + (value(card) === 0 ? 3 : 0) : -10;
        scored.push({ move: { type: 'play', card }, score: s });
      }
      // Discard cost: what the card is worth to us later, plus what it is worth to the opponent.
      const forUs = started ? (canPlay(mine, card) ? value(card) || 3 : 0) : handSum(c) >= OPEN_AT[style] ? 3 : 0;
      const forThem = theirs[c].length && canPlay(theirs, card) ? value(card) || 2 : 0;
      scored.push({ move: { type: 'discard', card }, score: -1 - forUs * 0.5 - forThem });
    }
    return pickByLevel(scored, level, rng);
  }
};
