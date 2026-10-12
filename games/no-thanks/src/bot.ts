// No Thanks! bot. Others' chips are secret, so it decides from its own projection only. Taking costs the points the
// card adds to its runs minus the chips on it; passing costs a chip, which grows dearer as chips run low.
import { pickByLevel, type BotStyle, type GameBot } from '@bg/game-sdk';
import { cardPoints, noThanksModule, type NoThanksAction, type NoThanksState } from './rules.ts';

/** How much a chip is worth: aggressive spends chips freely, cautious hoards them. */
const CHIP: Record<BotStyle, number> = { aggressive: 0.7, balanced: 1, cautious: 1.4 };

export const noThanksBot: GameBot<NoThanksState, NoThanksAction> = {
  decide(state, seat, level, rng, style) {
    const v = noThanksModule.project(state, { kind: 'player', seat });
    const chips = v.chips[seat] ?? 0;
    if (chips <= 0) return { type: 'take' };
    const mine = v.cards[seat]!;
    const cost = cardPoints([...mine, v.card!]) - cardPoints(mine);
    const take = v.pot - cost;
    const pass = -CHIP[style] * (1 + 8 / (chips + 1));
    return pickByLevel([{ move: { type: 'take' as const }, score: take }, { move: { type: 'pass' as const }, score: pass }], level, rng);
  }
};
