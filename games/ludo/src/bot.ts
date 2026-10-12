// Ludo bot: always rolls; picks a piece by a one-move heuristic (capture, enter, reach the goal, escape or avoid
// threats, advance). The board is public, so the full state is fair; the next die is never looked at.
import { pickByLevel, type BotStyle, type GameBot } from '@bg/game-sdk';
import { movablePieces, target, trackSquare, TRACK, type LudoAction, type LudoState } from './rules.ts';

const STYLE: Record<BotStyle, { capture: number; danger: number }> = {
  aggressive: { capture: 80, danger: 6 },
  balanced: { capture: 50, danger: 12 },
  cautious: { capture: 35, danger: 22 }
};

/** Opponent pieces that could land on absolute square `sq` with one die (1–6), counting yard pieces on their start. */
function threats(s: LudoState, seat: number, sq: number): number {
  let n = 0;
  for (let o = 0; o < s.players; o++) {
    if (o === seat || !s.active[o]) continue;
    for (const p of s.pieces[o]!) {
      if (p === -1) { if (trackSquare(s.slots[o]!, 0) === sq) n++; continue; }
      if (p >= TRACK) continue;
      const d = (sq - trackSquare(s.slots[o]!, p) + TRACK) % TRACK;
      if (d >= 1 && d <= 6 && p + d < TRACK) n++;
    }
  }
  return n;
}

const occupied = (s: LudoState, seat: number, sq: number) => s.pieces.some((ps, o) => o !== seat && s.active[o] && ps.some((p) => p >= 0 && p < TRACK && trackSquare(s.slots[o]!, p) === sq));

export const ludoBot: GameBot<LudoState, LudoAction> = {
  decide(s, seat, level, rng, style) {
    if (s.phase === 'roll') return { type: 'roll' };
    const w = STYLE[style];
    const slot = s.slots[seat]!;
    const scored = movablePieces(s, seat, s.die!).map((piece) => {
      const from = s.pieces[seat]![piece]!;
      const to = target(s, seat, piece, s.die!)!;
      let v = to * 0.5;
      if (from === -1) v += 30;
      if (to >= TRACK) v += 40;
      else {
        const sq = trackSquare(slot, to);
        if (occupied(s, seat, sq)) v += w.capture;
        v -= w.danger * threats(s, seat, sq);
      }
      if (from >= 0 && from < TRACK) v += w.danger * 0.8 * threats(s, seat, trackSquare(slot, from)); // escaping counts
      return { move: piece, score: v };
    });
    return { type: 'move', piece: pickByLevel(scored, level, rng) };
  }
};
