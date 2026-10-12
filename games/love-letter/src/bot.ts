// Love Letter bot. Hands are hidden, so it decides from its own projection only: it counts the cards it cannot see
// (deck minus its hand, all discards and the face-up cards) and uses what a Priest showed it. Each playable card is
// valued by its effect (a likely Guard hit, a winning Baron, a Prince on a probable Princess, Handmaid safety) plus
// the value of the card it keeps. It never discards the Princess by choice.
import { pickByLevel, type BotStyle, type GameBot, type Scored } from '@bg/game-sdk';
import { loveLetterModule, mustPlayCountess, type LoveLetterAction, type LoveLetterState } from './rules.ts';

const DECK = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];
const TARGETED = new Set([1, 2, 3, 5, 6]);
const ATTACK: Record<BotStyle, number> = { aggressive: 1.3, balanced: 1, cautious: 0.8 };

export const loveLetterBot: GameBot<LoveLetterState, LoveLetterAction> = {
  decide(state, seat, level, rng, style) {
    const v = loveLetterModule.project(state, { kind: 'player', seat });
    const hand = v.hand!;
    // Unseen card counts (other hands, the deck and the set-aside card).
    const unseen = new Map<number, number>();
    for (const c of DECK) unseen.set(c, (unseen.get(c) ?? 0) + 1);
    for (const c of [...hand, ...v.discards.flat(), ...v.faceUp]) unseen.set(c, (unseen.get(c) ?? 0) - 1);
    const total = [...unseen.values()].reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const p = (c: number) => Math.max(0, unseen.get(c) ?? 0) / total;
    // A card a Priest/Baron tie showed us, if that player has not played a card since.
    const known = (t: number) => {
      const s = v.seen;
      if (!s || s.seat !== t) return null;
      const playedSince = v.log.some((e) => e.seq > s.seq && e.t === 'play' && e.seat === t);
      return playedSince ? null : s.card;
    };
    const others = Array.from({ length: v.players }, (_, k) => k).filter((k) => k !== seat && v.inRound[k] && !v.protectedSeats[k]);
    const a = ATTACK[style];
    const options = hand.filter((c, i) => hand.indexOf(c) === i && (!mustPlayCountess(hand) || c === 7));
    const scored: Scored<LoveLetterAction>[] = [];
    for (const card of options) {
      const kept = hand[hand.indexOf(card) === 0 ? 1 : 0] ?? card;
      const keep = 0.6 * kept;
      if (card === 8 && options.length > 1) continue;
      // With every opponent protected, targeted cards are played without effect (the Prince must then target us).
      if (!TARGETED.has(card) || (!others.length && card !== 5)) {
        const base = card === 4 ? 4 : card === 8 ? -100 : card === 7 ? 1 : 0;
        scored.push({ move: { type: 'play', card }, score: base + keep });
        continue;
      }
      for (const t of card === 5 ? [...others, seat] : others) {
        const k = known(t);
        let value = 0;
        let guess: number | undefined;
        if (card === 1) {
          guess = k && k !== 1 ? k : [2, 3, 4, 5, 6, 7, 8].sort((x, y) => p(y) - p(x))[0]!;
          value = 10 * a * (k && k !== 1 ? 1 : p(guess));
        } else if (card === 2) value = k ? 0 : 2;
        else if (card === 3) {
          if (k) value = kept > k ? 8 * a : kept < k ? -8 : 0;
          else { let win = 0, lose = 0; for (let c = 1; c <= 8; c++) { if (c < kept) win += p(c); if (c > kept) lose += p(c); } value = 8 * a * (win - lose); }
        } else if (card === 5) value = t === seat ? (kept <= 2 ? 1 : -kept) : 2 + 12 * a * (k === 8 ? 1 : p(8));
        else if (card === 6) value = (k ?? 4.5) - kept; // swap: what we would get for what we give
        const move: LoveLetterAction = { type: 'play', card, target: t, ...(guess ? { guess } : {}) };
        scored.push({ move, score: value + (card === 6 ? 0 : keep) });
      }
    }
    return pickByLevel(scored, level, rng);
  }
};
