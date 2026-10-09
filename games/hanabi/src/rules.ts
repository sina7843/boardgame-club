// Hanabi («آتش‌بازی»), cooperative, 2–5 players. 50 cards: five colours × (1,1,1,2,2,3,3,4,4,5). Hands of 5 (4 with
// 4–5 players), held so that everyone but the owner sees them. 8 clue tokens, 3 fuses. A turn: clue a teammate about
// one colour or one number (every matching card is marked; costs a token), discard (regains a token), or play (the
// next number of its colour, else a fuse burns and the card is discarded; finishing a colour with its 5 regains a
// token). When the deck runs out everyone gets one more turn. Three fuses lose for the team; otherwise the team
// scores the sum of the stacks — the result is a team win (everyone first) carrying that score.
// Hidden: each player's own hand (they see only the clues they received) and the deck.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { hanabi } from './definition.ts';

export const COLORS = ['r', 'y', 'g', 'b', 'w'] as const;
export type Color = (typeof COLORS)[number];
const RANKS = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
export const CARDS = COLORS.flatMap((c) => RANKS.map((r) => ({ c, r })));
export interface HandCard { id: number; color: Color | null; rank: number | null; notColors: Color[]; notRanks: number[] }

export interface HanabiState {
  players: number;
  deck: number[];
  hands: HandCard[][];
  stacks: Record<Color, number>;
  discard: number[];
  clues: number;
  fuses: number;
  current: number;
  finalLeft: number | null;
  last: { seat: number; kind: 'clue' | 'play' | 'discard'; to?: number; color?: Color; rank?: number; card?: number; ok?: boolean; touched?: number[] } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface HanabiView extends Omit<HanabiState, 'deck' | 'hands' | 'timeouts'> {
  deckCount: number;
  /** Other hands with their cards; own hand with clue knowledge only (id null). */
  hands: (HandCard & { card: { c: Color; r: number } | null })[][];
  score: number;
}

const color = z.enum(COLORS);
export const hanabiAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('clue'), to: z.number().int().min(0).max(4), color: color.optional(), rank: z.number().int().min(1).max(5).optional() }),
  z.strictObject({ type: z.literal('play'), index: z.number().int().min(0).max(4) }),
  z.strictObject({ type: z.literal('discard'), index: z.number().int().min(0).max(4) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type HanabiAction = z.infer<typeof hanabiAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const fresh = (id: number): HandCard => ({ id, color: null, rank: null, notColors: [], notRanks: [] });
export const score = (st: Record<Color, number>) => COLORS.reduce((a, c) => a + st[c], 0);

// ---------- module ----------

type Events = Transition<HanabiState>['internalEvents'];
const finish = (s: HanabiState, events: Events): Transition<HanabiState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

const team = (s: HanabiState, won: boolean, reason: Outcome['reason']): Outcome =>
  ({ placements: s.hands.map((_, seat) => ({ seat, place: won ? 1 : 2, score: won ? score(s.stacks) : 0 })), reason });

function draw(s: HanabiState, seat: number) {
  const id = s.deck.shift();
  if (id !== undefined) s.hands[seat]!.push(fresh(id));
  if (!s.deck.length && s.finalLeft === null) s.finalLeft = s.players + 1; // this turn counts down below
}

function endTurn(s: HanabiState) {
  if (s.fuses <= 0) { s.outcome = team(s, false, 'score'); return; }
  if (score(s.stacks) === 25) { s.outcome = team(s, true, 'win'); return; }
  if (s.finalLeft !== null) { s.finalLeft -= 1; if (s.finalLeft <= 0) { s.outcome = team(s, true, 'win'); return; } }
  s.current = (s.current + 1) % s.players;
}

export const hanabiModule: GameModule<HanabiState, HanabiAction, HanabiView> = {
  manifest: hanabi.manifest,
  actionSchema: hanabiAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('hanabi needs 2–5 players');
    const deck = shuffle(rng, CARDS.map((_, i) => i));
    const size = playerCount <= 3 ? 5 : 4;
    const s: HanabiState = {
      players: playerCount, deck, hands: Array.from({ length: playerCount }, () => deck.splice(0, size).map(fresh)), stacks: { r: 0, y: 0, g: 0, b: 0, w: 0 },
      discard: [], clues: 8, fuses: 3, current: rng.nextInt(playerCount), finalLeft: null, last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // A late-game teaching position: stacks red 3, yellow 4, green 2, blue 2, white 1 (12 points), 3 clue tokens,
      // 2 fuses left and 5 cards in the deck. The learner already knows their red 4 and a «1» (useless: every stack has
      // its 1). Draws: partner w4, learner y1, b1, partner r1, learner y2 — the last one empties the deck.
      const id = (c: Color, r: number, nth = 0) => CARDS.map((x, i) => (x.c === c && x.r === r ? i : -1)).filter((i) => i >= 0)[nth]!;
      s.current = 0;
      s.hands = [
        [{ ...fresh(id('r', 4)), color: 'r', rank: 4 }, { ...fresh(id('g', 1)), rank: 1 }, fresh(id('b', 4)), fresh(id('r', 5)), fresh(id('w', 3))],
        [fresh(id('y', 5)), fresh(id('b', 3)), fresh(id('g', 3)), fresh(id('w', 2)), fresh(id('r', 2))]
      ];
      s.deck = [id('w', 4), id('y', 1), id('b', 1), id('r', 1), id('y', 2)];
      s.stacks = { r: 3, y: 4, g: 2, b: 2, w: 1 };
      s.clues = 3;
      s.fuses = 2;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    if (a.type === 'clue') {
      if (s.clues <= 0) return { ok: false, errorCode: 'NO_CLUES' };
      if (a.to === seat || a.to >= s.players) return { ok: false, errorCode: 'BAD_TARGET' };
      if ((a.color === undefined) === (a.rank === undefined)) return { ok: false, errorCode: 'COLOUR_OR_NUMBER' };
      const touches = s.hands[a.to]!.some((h) => (a.color ? CARDS[h.id]!.c === a.color : CARDS[h.id]!.r === a.rank));
      return touches ? { ok: true } : { ok: false, errorCode: 'TOUCHES_NOTHING' };
    }
    if (a.index >= s.hands[seat]!.length) return { ok: false, errorCode: 'NO_SUCH_CARD' };
    if (a.type === 'discard' && s.clues >= 8) return { ok: false, errorCode: 'CLUES_FULL' };
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') { s.outcome = team(s, false, 'resign'); return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'clue') {
      s.clues -= 1;
      const touched: number[] = [];
      s.hands[a.to]!.forEach((h, i) => {
        const card = CARDS[h.id]!;
        if (a.color) { if (card.c === a.color) { h.color = a.color; touched.push(i); } else if (!h.notColors.includes(a.color)) h.notColors.push(a.color); }
        else { if (card.r === a.rank) { h.rank = a.rank!; touched.push(i); } else if (!h.notRanks.includes(a.rank!)) h.notRanks.push(a.rank!); }
      });
      s.last = { seat, kind: 'clue', to: a.to, ...(a.color ? { color: a.color } : { rank: a.rank }), touched };
    } else {
      const [h] = s.hands[seat]!.splice(a.index, 1);
      const card = CARDS[h!.id]!;
      if (a.type === 'discard') { s.discard.push(h!.id); s.clues += 1; s.last = { seat, kind: 'discard', card: h!.id }; }
      else if (s.stacks[card.c] === card.r - 1) {
        s.stacks[card.c] = card.r;
        if (card.r === 5 && s.clues < 8) s.clues += 1;
        s.last = { seat, kind: 'play', card: h!.id, ok: true };
      } else { s.discard.push(h!.id); s.fuses -= 1; s.last = { seat, kind: 'play', card: h!.id, ok: false }; }
      draw(s, seat);
    }
    endTurn(s);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, deckCount: s.deck.length,
      hands: s.hands.map((h, k) => h.map((c) => ({ ...c, notColors: c.notColors.slice(), notRanks: c.notRanks.slice(), id: k === me && !s.outcome ? -1 : c.id, card: k === me && !s.outcome ? null : CARDS[c.id]! }))),
      stacks: { ...s.stacks }, discard: s.discard.slice(), clues: s.clues, fuses: s.fuses, current: s.current, finalLeft: s.finalLeft,
      last: s.last ? { ...s.last, ...(s.last.touched ? { touched: s.last.touched.slice() } : {}) } : null, seq: s.seq, outcome: s.outcome, score: score(s.stacks)
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.current === viewer.seat) {
      out.push({ type: 'play' });
      if (s.clues < 8) out.push({ type: 'discard' });
      if (s.clues > 0) out.push({ type: 'clue' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const to = (seat + 1) % s.players;
    const a: HanabiAction = s.clues < 8 ? { type: 'discard', index: 0 } : { type: 'clue', to, color: CARDS[s.hands[to]![0]!.id]!.c };
    const t = hanabiModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 57,
    options: { deal: 'tutorial' },
    introFa: 'هانابی گروهی است: همه با هم می‌برید یا با هم می‌بازید. کارت‌های خودتان را نمی‌بینید و فقط سرنخ‌هایی که گرفته‌اید رویشان نوشته می‌شود، ولی کارت‌های هم‌تیمی را می‌بینید. آتش‌بازی‌ها حالا قرمز ۳، زرد ۴، سبز ۲، آبی ۲ و سفید ۱ هستند (۱۲ امتیاز). ۳ ژتون سرنخ، ۲ فیوز سالم و ۵ کارت در دسته مانده است.',
    steps: [
      { instructionFa: 'هم‌تیمی‌تان «۵ زرد» دارد و زرد روی ۴ است. «سرنخ بده» را بزنید و رنگ «زرد» را انتخاب کنید. سرنخ یک ژتون خرج می‌کند و همهٔ کارت‌های زرد او را نشان می‌دهد؛ اینجا فقط همان ۵.', expected: { type: 'clue', to: 1, color: 'y' }, reply: { type: 'play', index: 0 } },
      { instructionFa: 'او ۵ زرد را بازی کرد و چون یک رنگ کامل شد، یک ژتون سرنخ برگشت. کارت اول شما از سرنخ‌های قبلی «قرمز ۴» است و قرمز روی ۳ است: انتخابش کنید و «بازی» را بزنید. بعد از هر بازی یا دور انداختن یک کارت تازه می‌کشید.', expected: { type: 'play', index: 0 }, reply: { type: 'clue', to: 0, rank: 5 } },
      { instructionFa: 'هم‌تیمی‌تان به شما سرنخ «۵» داد و فقط کارت سوم شما را نشان داد. وقتی کسی فقط یک کارت را نشان می‌دهد یعنی «این را بازی کن»؛ قرمز هم تنها رنگی است که منتظر ۵ است. کارت سوم را بازی کنید.', expected: { type: 'play', index: 2 }, reply: { type: 'clue', to: 0, rank: 4 } },
      { instructionFa: 'قرمز هم کامل شد. هم‌تیمی‌تان کارت دوم شما را «۴» نشان داد؛ آبی روی ۲ است، پس هنوز زود است. اول باید ۳ آبی بیاید: به او سرنخ عدد «۳» بدهید. سرنخ عددی هر دو ۳ او (آبی و سبز) را نشان می‌دهد.', expected: { type: 'clue', to: 1, rank: 3 }, reply: { type: 'play', index: 0 } },
      { instructionFa: 'او ۳ آبی را بازی کرد. فقط ۱ ژتون سرنخ مانده. کارت اول شما «۱» است و همهٔ رنگ‌ها ۱ را دارند، پس به درد نمی‌خورد: انتخابش کنید و «دور انداختن» را بزنید تا یک ژتون پس بگیرید. این آخرین کارت دسته را می‌کشد؛ از اینجا هر نفر فقط یک نوبت دیگر دارد.', expected: { type: 'discard', index: 0 }, reply: { type: 'play', index: 0 } },
      { instructionFa: 'هم‌تیمی‌تان در نوبت آخرش ۳ سبز را بازی کرد. نوبت آخر شماست: کارت اول، همان «۴» نشان‌دار، حالا ۴ آبی است و آبی روی ۳ است. بازی‌اش کنید.', expected: { type: 'play', index: 0 }, reply: null }
    ],
    completedFa: 'بردید! بدون سوختن حتی یک فیوز بازی تمام شد. آتش‌بازی‌ها: قرمز ۵، زرد ۵، سبز ۳، آبی ۴ و سفید ۱، یعنی ۱۸ امتیاز تیمی. امتیاز جمع بالاترین عدد هر رنگ است و ۲۵ امتیاز کامل است. اگر سه فیوز بسوزد، کل تیم می‌بازد.'
  }
};
