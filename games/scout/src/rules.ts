// Scout («سیرک»), 2–5 players. 45 cards — every pair of distinct numbers 1–10. 3 players drop the cards with a 10,
// 4 players the 9/10, 5 players use all; 2 players (unofficial) drop every card with a 9 or 10. All cards are dealt
// in a random orientation; each player decides once per round whether to turn the whole hand over. The hand order is
// fixed. A turn: Show adjacent hand cards forming a set (same number) or a run (consecutive, either direction) that
// beats the table show (more cards; then set over run; then the higher lowest number) — the beaten show becomes your
// points; or Scout a card from either end of the table show (optionally flipped) into any gap in your hand, giving the
// show's owner a point chip; once per round Scout & Show (scout, then show at once). The round ends when a hand is
// emptied, or when everyone else scouted in a row back to the show's owner (who then loses nothing for their hand).
// Round score: captured cards + chips − cards in hand. One round per player (two in the 2-player variant).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { scout } from './definition.ts';

export const CARDS: [number, number][] = [];
for (let a = 1; a <= 10; a++) for (let b = a + 1; b <= 10; b++) CARDS.push([a, b]);
export interface HandCard { id: number; up: number }
export const down = (h: HandCard) => (CARDS[h.id]![0] === h.up ? CARDS[h.id]![1] : CARDS[h.id]![0]);

export interface ScoutState {
  players: number;
  hands: HandCard[][];
  table: { cards: HandCard[]; owner: number } | null;
  captured: number[];
  chips: number[];
  scores: number[];
  usedSS: boolean[];
  oriented: boolean[];
  phase: 'orient' | 'play' | 'show';
  current: number;
  scoutsInRow: number;
  round: number;
  rounds: number;
  starter: number;
  roundLog: number[][];
  last: { seat: number; kind: 'show' | 'scout'; cards?: HandCard[]; beat?: number } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface ScoutView extends Omit<ScoutState, 'hands' | 'timeouts'> { hand: HandCard[] | null; handCount: number[] }

export const scoutAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('orient'), flip: z.boolean() }),
  z.strictObject({ type: z.literal('show'), from: z.number().int().min(0).max(17), count: z.number().int().min(1).max(18) }),
  z.strictObject({ type: z.literal('scout'), end: z.enum(['first', 'last']), flip: z.boolean(), at: z.number().int().min(0).max(18), andShow: z.boolean().optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type ScoutAction = z.infer<typeof scoutAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Kind and strength of a show, or null when the cards are neither a set nor a run. */
export function showKind(vals: number[]): { set: boolean; n: number; low: number } | null {
  if (!vals.length) return null;
  const low = Math.min(...vals);
  if (vals.every((v) => v === vals[0])) return { set: true, n: vals.length, low };
  const up = vals.every((v, i) => i === 0 || v === vals[i - 1]! + 1);
  const dn = vals.every((v, i) => i === 0 || v === vals[i - 1]! - 1);
  return up || dn ? { set: false, n: vals.length, low } : null;
}
export function beats(a: NonNullable<ReturnType<typeof showKind>>, b: ReturnType<typeof showKind>) {
  if (!b) return true;
  if (a.n !== b.n) return a.n > b.n;
  if (a.set !== b.set) return a.set;
  return a.low > b.low;
}
export function validShows(hand: HandCard[], table: ScoutState['table']) {
  const t = table ? showKind(table.cards.map((c) => c.up)) : null;
  const out: { from: number; count: number }[] = [];
  for (let from = 0; from < hand.length; from++) for (let count = 1; from + count <= hand.length; count++) {
    const k = showKind(hand.slice(from, from + count).map((c) => c.up));
    if (!k) break;
    if (beats(k, t)) out.push({ from, count });
  }
  return out;
}

// ---------- module ----------

type Events = Transition<ScoutState>['internalEvents'];
const finish = (s: ScoutState, events: Events): Transition<ScoutState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: ScoutState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.scores[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function deal(s: ScoutState, rng: EngineRng) {
  const drop = (c: [number, number]) => (s.players === 2 ? c[1] >= 9 : s.players === 3 ? c[1] === 10 : s.players === 4 ? c[0] === 9 && c[1] === 10 : false);
  const ids = shuffle(rng, CARDS.map((c, i) => (drop(c) ? -1 : i)).filter((i) => i >= 0));
  const per = ids.length / s.players;
  s.hands = Array.from({ length: s.players }, (_, k) => ids.slice(k * per, (k + 1) * per).map((id) => ({ id, up: CARDS[id]![rng.nextInt(2)]! })));
  s.table = null;
  s.captured = Array(s.players).fill(0);
  s.chips = Array(s.players).fill(0);
  s.usedSS = Array(s.players).fill(false);
  s.oriented = Array(s.players).fill(false);
  s.phase = 'orient';
  s.current = s.starter;
  s.scoutsInRow = 0;
}

function endRound(s: ScoutState, rng: EngineRng, exempt: number | null) {
  const pts = s.hands.map((h, k) => s.captured[k]! + s.chips[k]! - (k === exempt ? 0 : h.length));
  s.roundLog.push(pts);
  pts.forEach((p, k) => { s.scores[k]! += p; });
  if (s.round >= s.rounds) { s.outcome = { placements: rank(s, s.scores.map((_, k) => k)), reason: 'score' }; return; }
  s.round += 1;
  s.starter = (s.starter + 1) % s.players;
  deal(s, rng);
}

function nextTurn(s: ScoutState, rng: EngineRng) {
  s.current = (s.current + 1) % s.players;
  if (s.table && s.current === s.table.owner && s.scoutsInRow >= s.players - 1) endRound(s, rng, s.table.owner);
}

function doShow(s: ScoutState, seat: number, from: number, count: number, rng: EngineRng) {
  const cards = s.hands[seat]!.splice(from, count);
  const beat = s.table ? s.table.cards.length : 0;
  s.captured[seat]! += beat;
  s.table = { cards, owner: seat };
  s.scoutsInRow = 0;
  s.phase = 'play';
  s.last = { seat, kind: 'show', cards, beat };
  if (!s.hands[seat]!.length) { endRound(s, rng, null); return; }
  nextTurn(s, rng);
}

export const scoutModule: GameModule<ScoutState, ScoutAction, ScoutView> = {
  manifest: scout.manifest,
  actionSchema: scoutAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('scout needs 2–5 players');
    const s = {
      players: playerCount, scores: Array(playerCount).fill(0), round: 1, rounds: playerCount === 2 ? 2 : playerCount, starter: rng.nextInt(playerCount),
      roundLog: [], last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    } as unknown as ScoutState;
    deal(s, rng);
    if (options.deal === 'tutorial') {
      // One teaching round with an empty ring. Turned over, the learner's hand reads 2 2 5 6 3 3 3: a pair to open
      // with, a gap that the scouted 4/7 fills (5 6 7), and a three-card set that later beats a run and empties the hand.
      const id = (a: number, b: number) => CARDS.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b));
      const c = (up: number, other: number): HandCard => ({ id: id(up, other), up });
      s.rounds = 1; s.starter = 0; s.current = 0;
      s.hands = [
        [c(5, 3), c(6, 3), c(8, 3), c(1, 6), c(1, 5), c(5, 2), c(8, 2)],
        [c(4, 7), c(4, 8), c(6, 2), c(7, 1), c(8, 5), c(1, 2), c(3, 2), c(5, 4), c(6, 8)]
      ];
      s.table = null;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.phase === 'orient') return a.type === 'orient' && !s.oriented[seat] ? { ok: true } : { ok: false, errorCode: 'ORIENT_FIRST' };
    if (a.type === 'orient') return { ok: false, errorCode: 'ALREADY_ORIENTED' };
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const hand = s.hands[seat]!;
    if (a.type === 'show') return validShows(hand, s.table).some((x) => x.from === a.from && x.count === a.count) ? { ok: true } : { ok: false, errorCode: 'WEAK_SHOW' };
    if (s.phase === 'show') return { ok: false, errorCode: 'SHOW_NOW' };
    if (!s.table || s.table.owner === seat) return { ok: false, errorCode: 'NOTHING_TO_SCOUT' };
    if (a.at > hand.length) return { ok: false, errorCode: 'BAD_GAP' };
    if (a.andShow && s.usedSS[seat]) return { ok: false, errorCode: 'SCOUT_SHOW_USED' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.scores.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.scores[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    if (a.type === 'orient') {
      if (a.flip) s.hands[seat] = s.hands[seat]!.map((h) => ({ id: h.id, up: down(h) })).reverse();
      s.oriented[seat] = true;
      if (s.oriented.every(Boolean)) s.phase = 'play';
    } else if (a.type === 'show') doShow(s, seat, a.from, a.count, ctx.rng);
    else {
      const t = s.table!;
      const card = a.end === 'first' ? t.cards.shift()! : t.cards.pop()!;
      s.hands[seat]!.splice(a.at, 0, a.flip ? { id: card.id, up: down(card) } : card);
      s.chips[t.owner]! += 1;
      s.last = { seat, kind: 'scout', cards: [card] };
      if (!t.cards.length) s.table = { cards: [], owner: t.owner };
      if (a.andShow) { s.usedSS[seat] = true; s.phase = 'show'; if (!validShows(s.hands[seat]!, s.table!.cards.length ? s.table : null).length) { s.phase = 'play'; s.scoutsInRow += 1; nextTurn(s, ctx.rng); } }
      else { s.scoutsInRow += 1; nextTurn(s, ctx.rng); }
    }
    if (s.table && !s.table.cards.length && !s.outcome) s.table = null;
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const { hands, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, hand: me >= 0 ? hands[me]! : null, handCount: hands.map((h) => h.length) };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'orient' && !s.oriented[seat]) out.push({ type: 'orient' });
    if (s.phase !== 'orient' && s.current === seat) {
      const shows = validShows(s.hands[seat]!, s.table);
      if (shows.length) out.push({ type: 'show', options: shows });
      if (s.phase === 'play' && s.table && s.table.owner !== seat) out.push({ type: 'scout', canShow: !s.usedSS[seat] });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    let t: Transition<ScoutState> = { nextState: s, internalEvents: [], scheduleChanges: [] };
    if (s.phase === 'orient') {
      for (const k of s.oriented.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0)) { const missed = s.timeouts[k]! + 1; t = scoutModule.apply(s, { kind: 'player', seat: k }, { type: 'orient', flip: false }, ctx); s.timeouts[k] = missed; }
      return { ...t, internalEvents: [{ type: 'timed-out' }] };
    }
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const shows = validShows(s.hands[seat]!, s.table);
    const a: ScoutAction = s.phase === 'play' && s.table && s.table.owner !== seat ? { type: 'scout', end: 'last', flip: false, at: 0 } : { type: 'show', from: shows[0]!.from, count: shows[0]!.count };
    t = scoutModule.apply(s, { kind: 'player', seat }, a, ctx);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'orient' ? s.oriented.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0) : [s.current]),

  tutorial: {
    seed: 47,
    options: { deal: 'tutorial' },
    introFa: 'یک دست کامل دونفره بازی می‌کنید. هر کارت دو عدد دارد و فقط عدد بالایی حساب می‌شود؛ ترتیب کارت‌های دستتان را نمی‌شود عوض کرد. دست شما الان «۵ ۶ ۸ ۱ ۱ ۵ ۸» است، ولی اگر برگردانید «۲ ۲ ۵ ۶ ۳ ۳ ۳» می‌شود که دسته‌ها و ردیف بهتری دارد.',
    steps: [
      { instructionFa: '«برگرداندن دست» را بزنید. همهٔ کارت‌ها وارونه می‌شوند و ترتیبشان هم برعکس می‌شود؛ این انتخاب فقط یک بار در شروع هر دست است.', expected: { type: 'orient', flip: true }, reply: { type: 'orient', flip: false } },
      { instructionFa: 'وسط میز خالی است، پس هر نمایشی قبول است. دو کارت ۲ اول دست را انتخاب کنید و نمایش بدهید: کارت‌های کنار هم با عدد یکسان یک «دسته» می‌سازند.', expected: { type: 'show', from: 0, count: 2 }, reply: { type: 'show', from: 0, count: 2 } },
      { instructionFa: 'حریف با دستهٔ ۴ ۴ نمایش شما را برد (تعداد برابر، عدد بزرگ‌تر) و دو کارتتان را امتیاز گرفت. حالا ۴ اول نمایش او را بزنید، «برگرداندن کارت» را بزنید تا ۷ شود، «دیدبانی و نمایش» را تیک بزنید و کارت را بعد از ۶ بگذارید (قبل از کارت سوم). حریف برای این دیدبانی یک ژتون می‌گیرد.', expected: { type: 'scout', end: 'first', flip: true, at: 2, andShow: true }, reply: null },
      { instructionFa: 'حالا ردیف ۵ ۶ ۷ دارید. هر سه را نمایش بدهید: سه کارت از یک کارت ۴ ماندهٔ وسط قوی‌تر است و آن کارت امتیاز شما می‌شود.', expected: { type: 'show', from: 0, count: 3 }, reply: { type: 'show', from: 0, count: 3 } },
      { instructionFa: 'حریف با ردیف ۶ ۷ ۸ جواب داد: تعداد برابر و کوچک‌ترین عددش بزرگ‌تر است. ولی با تعداد برابر، دسته از ردیف قوی‌تر است: سه کارت ۳ را نمایش بدهید تا دستتان خالی شود و دست تمام شود.', expected: { type: 'show', from: 0, count: 3 }, reply: null }
    ],
    completedFa: 'بردید! دستتان خالی شد و دست تمام شد. شما ۴ کارت بردید (یک کارت ۴ و ردیف ۶ ۷ ۸) و کارتی در دست نداشتید: ۴ امتیاز. حریف ۵ کارت برد و ۱ ژتون گرفت، ولی ۴ کارت در دستش ماند: ۵ + ۱ − ۴ = ۲ امتیاز. نتیجهٔ نهایی ۴ در برابر ۲.'
  }
};
