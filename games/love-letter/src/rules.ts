// Love Letter («نامه عاشقانه»), classic 16-card edition for 2–4 players. Guard ×5 (1), Priest ×2 (2), Baron ×2 (3),
// Handmaid ×2 (4), Prince ×2 (5), King (6), Countess (7), Princess (8). One card is set aside unseen (2 players: three
// more face up). Everyone holds one card; on your turn draw one and play one. The round ends when one player is left
// or the deck runs out (highest card wins; tie → higher discard total; still tied → all tied win). Winners get a
// token; first to 7 / 5 / 4 tokens (2 / 3 / 4 players) wins the game.
// Hidden: hands, the deck, the set-aside card, and what a Priest (or a Baron tie) shows — only to the player concerned.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { loveLetter } from './definition.ts';

export const CARD_FA: Record<number, string> = { 1: 'نگهبان', 2: 'کشیش', 3: 'بارون', 4: 'ندیمه', 5: 'شاهزاده', 6: 'شاه', 7: 'کنتس', 8: 'شاهزاده‌خانم' };
const DECK = [1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8];
export const tokensToWin = (players: number) => (players === 2 ? 7 : players === 3 ? 5 : 4);

export type LogEntry =
  | { seq: number; t: 'play'; seat: number; card: number; target: number | null; guess: number | null; result: 'out' | 'miss' | 'none' | 'tie' | 'swap' | 'discard' | 'seen' | 'protect' }
  | { seq: number; t: 'out'; seat: number; card: number; by: 'guard' | 'baron' | 'princess' }
  | { seq: number; t: 'round'; winners: number[]; hands: (number | null)[]; round: number }
  | { seq: number; t: 'timeout' | 'resign'; seat: number };
type LogBody = LogEntry extends infer E ? (E extends LogEntry ? Omit<E, 'seq'> : never) : never;

export interface LoveLetterState {
  players: number;
  deck: number[];
  setAside: number | null;
  faceUp: number[];
  hands: number[][];
  discards: number[][];
  inRound: boolean[];
  protectedSeats: boolean[];
  active: boolean[];
  tokens: number[];
  goal: number;
  round: number;
  current: number;
  /** Private knowledge: seen[viewer] = what that viewer was shown last (Priest, Baron tie). */
  seen: ({ seat: number; card: number; seq: number } | null)[];
  log: LogEntry[];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface LoveLetterView {
  players: number;
  hand: number[] | null;
  handCounts: number[];
  deckCount: number;
  faceUp: number[];
  discards: number[][];
  inRound: boolean[];
  protectedSeats: boolean[];
  active: boolean[];
  tokens: number[];
  goal: number;
  round: number;
  current: number | null;
  seen: LoveLetterState['seen'][number];
  log: LogEntry[];
  outcome: Outcome | null;
}

export const loveLetterAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: z.number().int().min(1).max(8), target: z.number().int().min(0).max(3).optional(), guess: z.number().int().min(2).max(8).optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type LoveLetterAction = z.infer<typeof loveLetterAction>;

const TARGETED = new Set([1, 2, 3, 5, 6]);

/** Seats this card may target now (Prince may target yourself). */
export function targetsFor(s: Pick<LoveLetterState, 'players' | 'inRound' | 'protectedSeats' | 'current'>, card: number): number[] {
  const others = Array.from({ length: s.players }, (_, k) => k).filter((k) => k !== s.current && s.inRound[k] && !s.protectedSeats[k]);
  return card === 5 ? [...others, s.current] : others;
}
/** Countess must be played when held with King or Prince. */
export const mustPlayCountess = (hand: number[]) => hand.includes(7) && (hand.includes(5) || hand.includes(6));

function shuffle(rng: EngineRng, xs: number[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// ---------- module ----------

type Events = Transition<LoveLetterState>['internalEvents'];
const finish = (s: LoveLetterState, events: Events): Transition<LoveLetterState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const log = (s: LoveLetterState, e: LogBody) => { s.log.push({ ...e, seq: ++s.seq } as LogEntry); if (s.log.length > 40) s.log.shift(); };

function startRound(s: LoveLetterState, rng: EngineRng, first: number) {
  const d = shuffle(rng, DECK);
  s.setAside = d.shift()!;
  s.faceUp = s.players === 2 ? d.splice(0, 3) : [];
  s.hands = Array.from({ length: s.players }, (_, k) => (s.active[k] ? [d.shift()!] : []));
  s.deck = d;
  s.discards = Array.from({ length: s.players }, () => []);
  s.inRound = s.active.slice();
  s.protectedSeats = Array(s.players).fill(false);
  s.seen = Array(s.players).fill(null);
  s.current = first;
  beginTurn(s);
}

function beginTurn(s: LoveLetterState) {
  s.protectedSeats[s.current] = false;
  s.hands[s.current]!.push(s.deck.shift()!);
}

function knockOut(s: LoveLetterState, seat: number, by: 'guard' | 'baron' | 'princess') {
  s.inRound[seat] = false;
  const card = s.hands[seat]!.pop()!;
  s.discards[seat]!.push(card);
  log(s, { t: 'out', seat, card, by });
}

function endRound(s: LoveLetterState, rng: EngineRng) {
  const alive = s.inRound.map((v, k) => (v ? k : -1)).filter((k) => k >= 0);
  let winners = alive;
  if (alive.length > 1) {
    const best = Math.max(...alive.map((k) => s.hands[k]![0]!));
    winners = alive.filter((k) => s.hands[k]![0] === best);
    if (winners.length > 1) {
      const sumOf = (k: number) => s.discards[k]!.reduce((a, b) => a + b, 0);
      const top = Math.max(...winners.map(sumOf));
      winners = winners.filter((k) => sumOf(k) === top);
    }
  }
  log(s, { t: 'round', winners, hands: s.hands.map((h, k) => (s.inRound[k] ? h[0]! : null)), round: s.round });
  for (const w of winners) s.tokens[w]! += 1;
  if (s.tokens.some((t) => t >= s.goal)) {
    const ranked = s.tokens.map((t, seat) => ({ seat, t, out: !s.active[seat] })).sort((a, b) => Number(a.out) - Number(b.out) || b.t - a.t);
    const placements: Outcome['placements'] = [];
    ranked.forEach((r, i) => placements.push({ seat: r.seat, place: i > 0 && ranked[i - 1]!.t === r.t && ranked[i - 1]!.out === r.out ? placements[i - 1]!.place : i + 1, score: r.t }));
    s.outcome = { placements, reason: 'score' };
    return;
  }
  s.round += 1;
  startRound(s, rng, winners[0]!);
}

function nextTurn(s: LoveLetterState, rng: EngineRng) {
  const alive = s.inRound.filter(Boolean).length;
  if (alive <= 1 || s.deck.length === 0) { endRound(s, rng); return; }
  for (let k = 1; k <= s.players; k++) { const n = (s.current + k) % s.players; if (s.inRound[n]) { s.current = n; break; } }
  beginTurn(s);
}

function play(s: LoveLetterState, seat: number, card: number, target: number | undefined, guess: number | undefined, rng: EngineRng) {
  const hand = s.hands[seat]!;
  hand.splice(hand.indexOf(card), 1);
  s.discards[seat]!.push(card);
  const t = target ?? null;
  const entry = (result: Extract<LogEntry, { t: 'play' }>['result']) => log(s, { t: 'play', seat, card, target: t, guess: card === 1 ? guess ?? null : null, result });
  switch (card) {
    case 1:
      if (t === null) { entry('none'); break; }
      if (s.hands[t]![0] === guess) { entry('out'); knockOut(s, t, 'guard'); } else entry('miss');
      break;
    case 2:
      if (t === null) { entry('none'); break; }
      s.seen[seat] = { seat: t, card: s.hands[t]![0]!, seq: s.seq + 1 };
      entry('seen');
      break;
    case 3: {
      if (t === null) { entry('none'); break; }
      const mine = hand[0]!, theirs = s.hands[t]![0]!;
      if (mine === theirs) {
        s.seen[seat] = { seat: t, card: theirs, seq: s.seq + 1 };
        s.seen[t] = { seat, card: mine, seq: s.seq + 1 };
        entry('tie');
      } else { entry('out'); knockOut(s, mine < theirs ? seat : t, 'baron'); }
      break;
    }
    case 4: s.protectedSeats[seat] = true; entry('protect'); break;
    case 5: {
      const who = t ?? seat;
      entry('discard');
      const dropped = s.hands[who]!.pop()!;
      s.discards[who]!.push(dropped);
      if (dropped === 8) { s.inRound[who] = false; log(s, { t: 'out', seat: who, card: 8, by: 'princess' }); }
      else if (s.deck.length) s.hands[who]!.push(s.deck.shift()!);
      else { s.hands[who]!.push(s.setAside!); s.setAside = null; } // empty deck: the set-aside card
      break;
    }
    case 6:
      if (t === null) { entry('none'); break; }
      [s.hands[seat], s.hands[t]] = [s.hands[t]!, hand];
      entry('swap');
      break;
    case 7: entry('none'); break;
    case 8: entry('none'); s.inRound[seat] = false; s.discards[seat]!.push(...hand.splice(0)); log(s, { t: 'out', seat, card: 8, by: 'princess' }); break;
  }
  nextTurn(s, rng);
}

function passiveAction(s: LoveLetterState, rng: EngineRng): { card: number; target?: number; guess?: number } {
  const hand = s.hands[s.current]!;
  const options = hand.filter((c) => c !== 8 && (!mustPlayCountess(hand) || c === 7));
  const card = options.length ? Math.min(...options) : hand[0]!;
  const ts = targetsFor(s, card);
  return { card, ...(TARGETED.has(card) && ts.length ? { target: ts[rng.nextInt(ts.length)]! } : {}), ...(card === 1 && ts.length ? { guess: 2 + rng.nextInt(7) } : {}) };
}

export const loveLetterModule: GameModule<LoveLetterState, LoveLetterAction, LoveLetterView> = {
  manifest: loveLetter.manifest,
  actionSchema: loveLetterAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('love-letter needs 2–4 players');
    const s: LoveLetterState = {
      players: playerCount, deck: [], setAside: null, faceUp: [], hands: [], discards: [], inRound: [], protectedSeats: [],
      active: Array(playerCount).fill(true), tokens: Array(playerCount).fill(0), goal: options.length === 'short' ? 3 : tokensToWin(playerCount),
      round: 1, current: 0, seen: [], log: [], seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    startRound(s, rng, rng.nextInt(playerCount));
    if (options.deal === 'tutorial') {
      // Learner: Guard in hand, draws a Priest; the opponent holds a Baron and will draw a Guard.
      s.goal = 1; s.current = 0;
      s.hands = [[1, 2], [3]];
      s.deck = [1, 5, 6, 4, 2, 7, 1, 1];
      s.faceUp = [1, 4, 5]; s.setAside = 3;
      s.discards = [[], []]; s.inRound = [true, true]; s.protectedSeats = [false, false]; s.seen = [null, null];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || !s.active[actor.seat]) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const hand = s.hands[actor.seat]!;
    if (!hand.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
    if (mustPlayCountess(hand) && a.card !== 7) return { ok: false, errorCode: 'COUNTESS_REQUIRED' };
    if (!TARGETED.has(a.card)) return a.target === undefined ? { ok: true } : { ok: false, errorCode: 'NO_TARGET_NEEDED' };
    const ts = targetsFor(s, a.card);
    if (!ts.length) return a.target === undefined ? { ok: true } : { ok: false, errorCode: 'TARGET_PROTECTED' };
    if (a.target === undefined || !ts.includes(a.target)) return { ok: false, errorCode: 'BAD_TARGET' };
    if (a.card === 1 && a.guess === undefined) return { ok: false, errorCode: 'GUESS_REQUIRED' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.active[seat] = false;
      log(s, { t: 'resign', seat });
      if (s.inRound[seat]) { s.inRound[seat] = false; s.discards[seat]!.push(...s.hands[seat]!.splice(0)); }
      if (s.active.filter(Boolean).length <= 1) {
        const w = s.active.findIndex(Boolean);
        s.outcome = { placements: s.tokens.map((t, k) => ({ seat: k, place: k === w ? 1 : 2, score: t })), reason: 'resign' };
      } else if (s.current === seat) nextTurn(s, ctx.rng);
      else if (s.inRound.filter(Boolean).length <= 1) endRound(s, ctx.rng);
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    play(s, seat, a.card, a.target, a.guess, ctx.rng);
    return finish(s, [{ type: 'played', seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, handCounts: s.hands.map((h) => h.length), deckCount: s.deck.length,
      faceUp: s.faceUp.slice(), discards: s.discards.map((d) => d.slice()), inRound: s.inRound.slice(), protectedSeats: s.protectedSeats.slice(),
      active: s.active.slice(), tokens: s.tokens.slice(), goal: s.goal, round: s.round, current: s.outcome ? null : s.current,
      seen: me >= 0 ? s.seen[me] ?? null : null, log: s.log.slice(), outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) {
      const hand = s.hands[viewer.seat]!;
      for (const card of new Set(hand)) {
        if (mustPlayCountess(hand) && card !== 7) continue;
        const ts = TARGETED.has(card) ? targetsFor(s, card) : [];
        out.push({ type: 'play', card, targets: ts });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    s.timeouts[seat]! += 1;
    log(s, { t: 'timeout', seat });
    const a = passiveAction(s, ctx.rng);
    play(s, seat, a.card, a.target, a.guess, ctx.rng);
    return finish(s, [{ type: 'timed-out', seat }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 15,
    options: { deal: 'tutorial' },
    introFa: 'هر کس یک کارت در دست دارد؛ در نوبتتان یک کارت می‌کشید و یکی از دو کارت را بازی می‌کنید. هدف: آخرین نفر باقی‌مانده باشید یا وقتی دسته تمام شد بزرگ‌ترین کارت را داشته باشید.',
    steps: [
      { instructionFa: '«کشیش» را بازی کنید و حریف را انتخاب کنید تا کارت دستش را ببینید (فقط شما می‌بینید).', expected: { type: 'play', card: 2, target: 1 }, reply: { type: 'play', card: 1, target: 0, guess: 8 } },
      { instructionFa: 'دیدید که حریف «بارون» دارد. حالا «نگهبان» را بازی کنید، حریف را انتخاب کنید و «بارون» را حدس بزنید تا از دور حذف شود.', expected: { type: 'play', card: 1, target: 1, guess: 3 }, reply: null }
    ],
    completedFa: 'بردید! «ندیمه» شما را تا نوبت بعد محافظت می‌کند، «بارون» کارت‌ها را مقایسه می‌کند و هر کس «شاهزاده‌خانم» را دور بیندازد می‌بازد.'
  }
};
