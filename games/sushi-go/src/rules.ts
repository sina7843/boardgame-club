// Sushi Go! («سوشی گردان»): 108 cards — tempura 14, sashimi 14, dumpling 14, maki 1/2/3 (6/12/8), salmon 10, squid 5,
// egg 5, pudding 10, wasabi 6, chopsticks 4. Hands: 10/9/8/7 for 2/3/4/5 players; three rounds. Every turn all players
// secretly pick one card (two with chopsticks on the table; the chopsticks go back into the hand), reveal, and pass the
// rest of the hand to the next seat. Round scoring: tempura pairs 5, sashimi sets 10, dumplings 1/3/6/10/15, nigiri
// 1/2/3 (×3 on an unused wasabi), maki most 6 / second 3 (ties split, rounded down; a tie for most gives no second).
// Puddings are kept: at the end most +6, fewest −6 (not with two players), ties split. Tie on score: more puddings.
// Hidden: hands, the deck, picks until everyone has picked. Tableaux are public.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { sushiGo } from './definition.ts';

export const KINDS = ['tempura', 'sashimi', 'dumpling', 'maki1', 'maki2', 'maki3', 'salmon', 'squid', 'egg', 'pudding', 'wasabi', 'chopsticks'] as const;
export type Kind = (typeof KINDS)[number];
const COUNT: Record<Kind, number> = { tempura: 14, sashimi: 14, dumpling: 14, maki1: 6, maki2: 12, maki3: 8, salmon: 10, squid: 5, egg: 5, pudding: 10, wasabi: 6, chopsticks: 4 };
export const NIGIRI: Partial<Record<Kind, number>> = { egg: 1, salmon: 2, squid: 3 };
export const MAKI: Partial<Record<Kind, number>> = { maki1: 1, maki2: 2, maki3: 3 };
const HAND: Record<number, number> = { 2: 10, 3: 9, 4: 8, 5: 7 };
const DUMPLING = [0, 1, 3, 6, 10, 15];

export interface Played { kind: Kind; wasabi?: boolean }
export interface SushiGoState {
  players: number;
  deck: Kind[];
  hands: Kind[][];
  table: Played[][];
  puddings: number[];
  picks: (Kind[] | null)[];
  round: number;
  rounds: number;
  scores: number[];
  lastRound: number[][];
  /** Cards revealed in the last turn per seat. */
  revealed: Kind[][];
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface SushiGoView {
  players: number;
  hand: Kind[] | null;
  table: Played[][];
  puddings: number[];
  picked: (Kind[] | boolean)[];
  round: number;
  rounds: number;
  scores: number[];
  lastRound: number[][];
  revealed: Kind[][];
  handSize: number;
  seq: number;
  outcome: Outcome | null;
}

const kind = z.enum(KINDS);
export const sushiGoAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pick'), card: kind, extra: kind.optional() }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SushiGoAction = z.infer<typeof sushiGoAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const n = (t: Played[], k: Kind) => t.filter((c) => c.kind === k).length;
const makiCount = (t: Played[]) => t.reduce((a, c) => a + (MAKI[c.kind] ?? 0), 0);

/** Points of one tableau without maki and pudding. */
export function setScore(t: Played[]) {
  return Math.floor(n(t, 'tempura') / 2) * 5 + Math.floor(n(t, 'sashimi') / 3) * 10 + DUMPLING[Math.min(5, n(t, 'dumpling'))]!
    + t.reduce((a, c) => a + (NIGIRI[c.kind] ?? 0) * (c.wasabi ? 3 : 1), 0);
}

/** Award `pts` to the seats with the highest (or lowest) value, split and rounded down; returns the winners. */
function award(vals: number[], pts: number, out: number[], pick: 'max' | 'min', among = vals.map((_, k) => k)) {
  if (!among.length) return [];
  const best = pick === 'max' ? Math.max(...among.map((k) => vals[k]!)) : Math.min(...among.map((k) => vals[k]!));
  const win = among.filter((k) => vals[k] === best);
  win.forEach((k) => { out[k]! += Math.floor(pts / win.length); });
  return win;
}

export function roundScores(table: Played[][]) {
  const pts = table.map(setScore);
  const maki = table.map(makiCount);
  const withMaki = maki.map((_, k) => k).filter((k) => maki[k]! > 0);
  const first = award(maki, 6, pts, 'max', withMaki);
  if (first.length === 1) award(maki, 3, pts, 'max', withMaki.filter((k) => k !== first[0]));
  return pts;
}

export function puddingScores(puddings: number[]) {
  const out = puddings.map(() => 0);
  if (puddings.every((p) => p === puddings[0])) return out;
  award(puddings, 6, out, 'max');
  if (puddings.length > 2) award(puddings, -6, out, 'min');
  return out;
}

// ---------- module ----------

type Events = Transition<SushiGoState>['internalEvents'];
const finish = (s: SushiGoState, events: Events): Transition<SushiGoState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: SushiGoState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, sc: s.scores[seat]!, pu: s.puddings[seat]! })).sort((a, b) => b.sc - a.sc || b.pu - a.pu);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const p = r[i - 1]; out.push({ seat: x.seat, place: p && p.sc === x.sc && p.pu === x.pu ? out[i - 1]!.place : i + 1, score: x.sc }); });
  return out;
}

function deal(s: SushiGoState, size: number) {
  s.hands = Array.from({ length: s.players }, () => s.deck.splice(0, size));
  s.table = Array.from({ length: s.players }, () => []);
  s.picks = Array(s.players).fill(null);
}

function play(t: Played[], k: Kind) {
  const freeWasabi = n(t, 'wasabi') - t.filter((c) => c.wasabi).length;
  t.push(NIGIRI[k] && freeWasabi > 0 ? { kind: k, wasabi: true } : { kind: k });
}

function resolveTurn(s: SushiGoState) {
  s.revealed = s.picks.map((p) => p!.slice());
  s.picks.forEach((p, seat) => {
    const hand = s.hands[seat]!;
    for (const k of p!) { hand.splice(hand.indexOf(k), 1); play(s.table[seat]!, k); }
    if (p!.length === 2) { const t = s.table[seat]!; t.splice(t.findIndex((c) => c.kind === 'chopsticks'), 1); hand.push('chopsticks'); }
  });
  s.seq += 1;
  // Pass hands to the next seat.
  s.hands = s.hands.map((_, k) => s.hands[(k - 1 + s.players) % s.players]!);
  s.picks = Array(s.players).fill(null);
  if (s.hands[0]!.length) return;
  const pts = roundScores(s.table);
  s.table.forEach((t, k) => { s.puddings[k]! += n(t, 'pudding'); s.scores[k]! += pts[k]!; });
  s.lastRound.push(pts);
  if (s.round >= s.rounds) {
    const pud = puddingScores(s.puddings);
    pud.forEach((p, k) => { s.scores[k]! += p; });
    s.lastRound.push(pud);
    s.outcome = { placements: rank(s, s.scores.map((_, k) => k)), reason: 'score' };
    return;
  }
  s.round += 1;
  deal(s, HAND[s.players]!);
}

export const sushiGoModule: GameModule<SushiGoState, SushiGoAction, SushiGoView> = {
  manifest: sushiGo.manifest,
  actionSchema: sushiGoAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 5) throw new Error('sushi go needs 2–5 players');
    const s: SushiGoState = {
      players: playerCount, deck: shuffle(rng, KINDS.flatMap((k) => Array<Kind>(COUNT[k]).fill(k))), hands: [], table: [],
      puddings: Array(playerCount).fill(0), picks: [], round: 1, rounds: 3, scores: Array(playerCount).fill(0), lastRound: [],
      revealed: Array.from({ length: playerCount }, () => []), seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    deal(s, HAND[playerCount]!);
    if (options.deal === 'tutorial') {
      // One seven-card round for two players (hands swap every turn). The learner's line: wasabi, squid on it,
      // chopsticks, two tempura at once, the biggest maki, then puddings. The opponent's picks are scripted replies.
      s.rounds = 1;
      s.hands = [
        ['wasabi', 'tempura', 'chopsticks', 'dumpling', 'maki3', 'salmon', 'pudding'],
        ['maki2', 'squid', 'dumpling', 'tempura', 'tempura', 'pudding', 'egg']
      ];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (s.picks[actor.seat] !== null) return { ok: false, errorCode: 'ALREADY_PICKED' };
    const hand = s.hands[actor.seat]!.slice();
    for (const k of a.extra ? [a.card, a.extra] : [a.card]) { const i = hand.indexOf(k); if (i < 0) return { ok: false, errorCode: 'NOT_IN_HAND' }; hand.splice(i, 1); }
    if (a.extra && !s.table[actor.seat]!.some((c) => c.kind === 'chopsticks')) return { ok: false, errorCode: 'NO_CHOPSTICKS' };
    return { ok: true };
  },

  apply(s, actor, a) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.scores.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.scores[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.picks[seat] = a.extra ? [a.card, a.extra] : [a.card];
    if (s.picks.every((p) => p !== null)) resolveTurn(s);
    return finish(s, [{ type: 'pick', seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, table: s.table.map((t) => t.map((c) => ({ ...c }))), puddings: s.puddings.slice(),
      picked: s.picks.map((p, k) => (k === me ? (p ? p.slice() : false) : p !== null)), round: s.round, rounds: s.rounds, scores: s.scores.slice(),
      lastRound: s.lastRound.map((r) => r.slice()), revealed: s.revealed.map((r) => r.slice()), handSize: s.hands[0]?.length ?? 0, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const out: ActionHint[] = [];
    const seat = viewer.seat;
    if (s.picks[seat] === null) {
      for (const card of new Set(s.hands[seat]!)) out.push({ type: 'pick', card });
      if (s.table[seat]!.some((c) => c.kind === 'chopsticks') && s.hands[seat]!.length >= 2) out.push({ type: 'chopsticks' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    s.picks.forEach((p, seat) => { if (p === null) { s.timeouts[seat]! += 1; s.picks[seat] = [s.hands[seat]![0]!]; } });
    resolveTurn(s);
    return finish(s, [{ type: 'timed-out' }]);
  },

  pendingSeats: (s) => (s.outcome ? [] : s.picks.map((p, k) => (p === null ? k : -1)).filter((k) => k >= 0)),

  tutorial: {
    seed: 25,
    options: { deal: 'tutorial' },
    introFa: 'یک دور کوتاه دونفره با دست‌های ۷ کارتی. هر نوبت شما و حریف هم‌زمان و مخفیانه یک کارت برمی‌دارید، کارت‌ها رو می‌شوند و باقی دست به نفر بعد می‌رسد؛ پس کارتی که برنمی‌دارید به دست حریف می‌رود. امتیاز در پایان دور از ترکیب کارت‌های جلوی هر نفر حساب می‌شود.',
    steps: [
      { instructionFa: '«واسابی» را بردارید. واسابی خودش امتیاز ندارد، ولی اولین نیگیری‌ای که بعد از آن بردارید رویش می‌نشیند و سه برابر امتیاز می‌گیرد.', expected: { type: 'pick', card: 'wasabi' }, reply: { type: 'pick', card: 'maki2' } },
      { instructionFa: 'دست‌ها عوض شد و حالا دست حریف پیش شماست. «نیگیری ماهی مرکب» (۳ امتیاز) را بردارید: روی واسابی ۹ امتیاز می‌شود.', expected: { type: 'pick', card: 'squid' }, reply: { type: 'pick', card: 'tempura' } },
      { instructionFa: '«چاپستیک» را بردارید. در یکی از نوبت‌های بعد با آن می‌توانید دو کارت هم‌زمان بردارید؛ بعد چاپستیک به دستی که رد می‌کنید برمی‌گردد.', expected: { type: 'pick', card: 'chopsticks' }, reply: { type: 'pick', card: 'dumpling' } },
      { instructionFa: 'دو تمپورا در این دست است و هر جفت تمپورا ۵ امتیاز دارد (یکی تنها هیچ). دکمهٔ «چاپستیک: دو کارت بردار» را بزنید و هر دو تمپورا را بردارید.', expected: { type: 'pick', card: 'tempura', extra: 'tempura' }, reply: { type: 'pick', card: 'dumpling' } },
      { instructionFa: 'حریف رول ماکی ۲تایی دارد. «ماکی ۳» را بردارید: در پایان دور، بیشترین تعداد رول ماکی ۶ امتیاز و دومی ۳ امتیاز می‌گیرد. اگر برش ندارید به دست حریف می‌رسد.', expected: { type: 'pick', card: 'maki3' }, reply: { type: 'pick', card: 'chopsticks' } },
      { instructionFa: '«پودینگ» را بردارید. پودینگ تا آخر بازی می‌ماند و آن‌وقت بیشترین پودینگ ۶ امتیاز می‌گیرد (با سه نفر یا بیشتر، کمترین ۶ امتیاز از دست می‌دهد).', expected: { type: 'pick', card: 'pudding' }, reply: { type: 'pick', card: 'salmon' } },
      { instructionFa: 'آخرین کارت دستتان یک پودینگ دیگر است؛ آن را بردارید تا دور و بازی تمام شود.', expected: { type: 'pick', card: 'pudding' }, reply: { type: 'pick', card: 'egg' } }
    ],
    completedFa: 'بردید! ماهی مرکب روی واسابی ۹ + جفت تمپورا ۵ + بیشترین ماکی (۳ رول در برابر ۲) ۶ = ۲۰ امتیاز دور، و با ۲ پودینگ در برابر صفر ۶ امتیاز دیگر: ۲۶. حریف از دو دامپلینگ ۳، نیگیری سالمون ۲، تخم‌مرغ ۱ و ماکی دوم ۳ امتیاز گرفت: ۹. تمپورای تنها و چاپستیک استفاده‌نشده‌اش امتیازی نداشت. بازی واقعی سه دور است و پودینگ‌ها در آخر شمرده می‌شوند.'
  }
};
