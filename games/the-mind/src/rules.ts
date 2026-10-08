// The Mind («هم‌فکر»), cooperative, 2–4 players. Level n deals n cards (1–100) to everyone. Anyone may play their
// lowest card at any time (actions are ordered by arrival). Playing while someone holds a lower card costs a life
// and discards every lower card from all hands. A throwing star needs everyone still holding cards to agree; then
// each discards their lowest card. Levels: 12/10/8 for 2/3/4 players; lives = players, one star; rewards: a star
// after levels 2, 5, 8 and a life after 3, 6, 9 (max 5 lives, 3 stars). No lives left → the team loses.
// Outcome: a team win is every seat in first place with reason 'win'; a team loss is every seat in second place.
// Hidden: hands and the deck. The pile, discarded cards and hand sizes are public.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { theMind } from './definition.ts';

const LEVELS: Record<number, number> = { 2: 12, 3: 10, 4: 8 };
const STAR_AFTER = new Set([2, 5, 8]);
const LIFE_AFTER = new Set([3, 6, 9]);

export interface Event { kind: 'play' | 'mistake' | 'star' | 'level'; seat?: number; card?: number; lost?: { seat: number; card: number }[] }
export interface TheMindState {
  players: number;
  level: number;
  levels: number;
  lives: number;
  stars: number;
  hands: number[][];
  pile: number[];
  votes: boolean[];
  last: Event | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface TheMindView {
  players: number;
  level: number;
  levels: number;
  lives: number;
  stars: number;
  hand: number[] | null;
  handCount: number[];
  pile: number[];
  votes: boolean[];
  last: Event | null;
  seq: number;
  outcome: Outcome | null;
}

export const theMindAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play') }),
  z.strictObject({ type: z.literal('star'), on: z.boolean() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type TheMindAction = z.infer<typeof theMindAction>;

function shuffle(rng: EngineRng) {
  const a = Array.from({ length: 100 }, (_, k) => k + 1);
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const holding = (s: TheMindState) => s.hands.map((h, k) => (h.length ? k : -1)).filter((k) => k >= 0);
const teamOutcome = (s: TheMindState, won: boolean, reason: Outcome['reason']): Outcome =>
  ({ placements: s.hands.map((_, seat) => ({ seat, place: won ? 1 : 2, score: s.level - (won ? 0 : 1) })), reason });

function deal(s: TheMindState, rng: EngineRng) {
  const d = shuffle(rng);
  s.hands = Array.from({ length: s.players }, (_, k) => d.slice(k * s.level, (k + 1) * s.level).sort((a, b) => a - b));
  s.pile = [];
  s.votes = Array(s.players).fill(false);
}

function afterChange(s: TheMindState, rng: EngineRng) {
  if (s.lives <= 0) { s.outcome = teamOutcome(s, false, 'score'); return; }
  if (holding(s).length) return;
  if (s.level >= s.levels) { s.outcome = teamOutcome(s, true, 'win'); return; }
  if (STAR_AFTER.has(s.level)) s.stars = Math.min(3, s.stars + 1);
  if (LIFE_AFTER.has(s.level)) s.lives = Math.min(5, s.lives + 1);
  s.level += 1;
  s.last = { kind: 'level' };
  deal(s, rng);
}

function play(s: TheMindState, seat: number, rng: EngineRng) {
  const card = s.hands[seat]!.shift()!;
  s.pile.push(card);
  const lost: { seat: number; card: number }[] = [];
  s.hands.forEach((h, k) => { while (h.length && h[0]! < card) lost.push({ seat: k, card: h.shift()! }); });
  if (lost.length) s.lives -= 1;
  s.votes = Array(s.players).fill(false);
  s.seq += 1;
  s.last = { kind: lost.length ? 'mistake' : 'play', seat, card, ...(lost.length ? { lost } : {}) };
  afterChange(s, rng);
}

// ---------- module ----------

type Events = Transition<TheMindState>['internalEvents'];
const finish = (s: TheMindState, events: Events): Transition<TheMindState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

export const theMindModule: GameModule<TheMindState, TheMindAction, TheMindView> = {
  manifest: theMind.manifest,
  actionSchema: theMindAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('the mind needs 2–4 players');
    const s: TheMindState = {
      players: playerCount, level: 1, levels: LEVELS[playerCount]!, lives: playerCount, stars: 1, hands: [], pile: [], votes: [],
      last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    deal(s, rng);
    if (options.deal === 'tutorial') { s.levels = 1; s.hands = [[12, 80], [57]]; }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (!s.hands[actor.seat]!.length) return { ok: false, errorCode: 'NO_CARDS' };
    if (a.type === 'star' && a.on && s.stars < 1) return { ok: false, errorCode: 'NO_STARS' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = teamOutcome(s, false, 'resign');
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'play') play(s, seat, ctx.rng);
    else {
      s.votes[seat] = a.on;
      s.seq += 1;
      if (holding(s).every((k) => s.votes[k])) {
        const lost = holding(s).map((k) => ({ seat: k, card: s.hands[k]!.shift()! }));
        s.stars -= 1;
        s.votes = Array(s.players).fill(false);
        s.last = { kind: 'star', lost };
        afterChange(s, ctx.rng);
      }
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, level: s.level, levels: s.levels, lives: s.lives, stars: s.stars, hand: me >= 0 ? s.hands[me]!.slice() : null,
      handCount: s.hands.map((h) => h.length), pile: s.pile.slice(), votes: s.votes.slice(), last: s.last ? structuredClone(s.last) : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    if (s.hands[viewer.seat]!.length) {
      out.push({ type: 'play', card: s.hands[viewer.seat]![0] });
      if (s.stars > 0 || s.votes[viewer.seat]) out.push({ type: 'star', on: !s.votes[viewer.seat] });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    // Nobody dared for a whole minute: the lowest card on the table is played for its holder (never a mistake).
    const seat = holding(s).sort((a, b) => s.hands[a]![0]! - s.hands[b]![0]!)[0]!;
    s.timeouts[seat]! += 1;
    play(s, seat, ctx.rng);
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : holding(s)),

  tutorial: {
    seed: 29,
    options: { deal: 'tutorial' },
    introFa: 'شما و هم‌تیمی‌تان باید بدون حرف زدن کارت‌ها را به ترتیب صعودی بگذارید. کارت‌های شما ۱۲ و ۸۰ است؛ کارت‌های حریف را نمی‌بینید.',
    steps: [
      { instructionFa: '۱۲ خیلی کوچک است — احتمالاً اول نوبت شماست. «بگذار» را بزنید.', expected: { type: 'play' }, reply: { type: 'play' } },
      { instructionFa: 'هم‌تیمی‌تان ۵۷ را گذاشت. حالا ۸۰ را بگذارید.', expected: { type: 'play' }, reply: null }
    ],
    completedFa: 'بردید! ۱۲، ۵۷، ۸۰ — به ترتیب و بدون اشتباه. در بازی واقعی مراحل بعدی کارت‌های بیشتری دارند.'
  }
};
