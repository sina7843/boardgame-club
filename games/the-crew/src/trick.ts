// Shared trick-taking core for both Crew editions: 36 coloured cards (pink, blue, green, yellow 1–9) and four
// rockets (trumps 1–4). Follow suit if you can; rockets beat colours; the holder of rocket 4 is the commander and
// leads the first trick. Communication: once per mission, between tricks, a player may show one coloured card that
// is their highest, lowest or only card of that colour.
import type { EngineRng } from '@bg/game-sdk';

export const SUITS = ['p', 'b', 'g', 'y'] as const;
export const SUIT_FA: Record<string, string> = { p: 'صورتی', b: 'آبی', g: 'سبز', y: 'زرد', r: 'موشک' };
export const DECK: string[] = [...SUITS.flatMap((s) => Array.from({ length: 9 }, (_, i) => `${s}${i + 1}`)), 'r1', 'r2', 'r3', 'r4'];
export const suit = (c: string) => c[0]!;
export const rank = (c: string) => Number(c.slice(1));
export const cardFa = (c: string) => `${SUIT_FA[suit(c)]} ${Number(c.slice(1)).toLocaleString('fa-IR')}`;
export const sortHand = (h: string[]) => h.slice().sort((a, b) => 'pbgyr'.indexOf(suit(a)) - 'pbgyr'.indexOf(suit(b)) || rank(a) - rank(b));

export type CommKind = 'top' | 'bottom' | 'only';
export interface Comm { card: string; kind: CommKind }
export interface Play { seat: number; card: string }
export interface TrickCore {
  players: number;
  hands: string[][];
  aside: string | null;
  commander: number;
  current: number;
  trick: Play[];
  won: string[][][];
  tricks: number;
  comms: (Comm | null)[];
  commsUsed: boolean[];
  lastTrick: { winner: number; cards: Play[] } | null;
}

export function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

export function deal(rng: EngineRng, players: number): TrickCore {
  let d = shuffle(rng, DECK);
  // ponytail: with 3 players the one card that does not divide evenly is set aside face up (never rocket 4).
  const aside = DECK.length % players ? d.find((c) => c !== 'r4')! : null;
  if (aside) d = d.filter((c) => c !== aside);
  const hands = Array.from({ length: players }, () => [] as string[]);
  d.forEach((c, i) => hands[i % players]!.push(c));
  const commander = hands.findIndex((h) => h.includes('r4'));
  return {
    players, hands: hands.map(sortHand), aside, commander, current: commander, trick: [], won: hands.map(() => []), tricks: 0,
    comms: hands.map(() => null), commsUsed: hands.map(() => false), lastTrick: null
  };
}

export function legalCards(s: TrickCore, seat: number) {
  const hand = s.hands[seat]!;
  const lead = s.trick[0];
  if (!lead) return hand;
  const follow = hand.filter((c) => suit(c) === suit(lead.card));
  return follow.length ? follow : hand;
}
export function trickWinner(trick: Play[]) {
  const led = suit(trick[0]!.card);
  const rockets = trick.filter((p) => suit(p.card) === 'r');
  const pool = rockets.length ? rockets : trick.filter((p) => suit(p.card) === led);
  return pool.reduce((a, b) => (rank(b.card) > rank(a.card) ? b : a)).seat;
}
export function commKind(hand: string[], card: string): CommKind | null {
  if (suit(card) === 'r' || !hand.includes(card)) return null;
  const same = hand.filter((c) => suit(c) === suit(card)).map(rank);
  if (same.length === 1) return 'only';
  if (rank(card) === Math.max(...same)) return 'top';
  if (rank(card) === Math.min(...same)) return 'bottom';
  return null;
}

/** Plays a card; returns the finished trick (winner + cards) when the trick completes. */
export function playCard(s: TrickCore, seat: number, card: string) {
  s.hands[seat] = s.hands[seat]!.filter((c) => c !== card);
  if (s.comms[seat]?.card === card) s.comms[seat] = null;
  s.trick.push({ seat, card });
  if (s.trick.length < s.players) { s.current = (seat + 1) % s.players; return null; }
  const winner = trickWinner(s.trick);
  const done = { winner, cards: s.trick };
  s.won[winner]!.push(s.trick.map((p) => p.card));
  s.lastTrick = done;
  s.trick = [];
  s.tricks += 1;
  s.current = winner;
  return done;
}
export const handsEmpty = (s: TrickCore) => s.hands.every((h) => !h.length);
