// Sea Salt & Paper («کاغذ و دریا»), 2–4 players. 58 cards: duos crab 9, boat 8, fish 7, swimmer 5, shark 5;
// collectors shell 6, octopus 5, penguin 3, sailor 2; multipliers lighthouse, shoal, penguin colony, captain; mermaid 4.
// Every card has one of nine colours (mermaids are white and count for nothing); colours are assigned in a fixed
// rotation, not copied from the printed cards. A turn: draw two from the deck (keep one, put the other on a discard
// pile — an empty pile first) or take the top of a discard pile; then play any duos (crab: take any card from a
// discard pile; boat: an extra turn; fish: draw the top deck card; swimmer+shark: steal a random card); then, with 7+
// points, «بس» (round ends, everybody scores) or «آخرین فرصت» (everybody else gets one more turn: if the caller still
// has the most points they score points + colour bonus and the others only their colour bonus; otherwise the caller
// scores only the colour bonus and the others their points). An exhausted deck ends the round without points.
// Four mermaids win at once. Target: 40 / 35 / 30 points for 2 / 3 / 4 players.
// Hidden: hands, the deck, the two cards drawn, and a pile searched with crabs (to everyone but the searcher).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { seaSaltPaper } from './definition.ts';

export const KINDS = ['crab', 'boat', 'fish', 'swimmer', 'shark', 'shell', 'octopus', 'penguin', 'sailor', 'lighthouse', 'shoal', 'colony', 'captain', 'mermaid'] as const;
export type Kind = (typeof KINDS)[number];
const COUNT: Record<Kind, number> = { crab: 9, boat: 8, fish: 7, swimmer: 5, shark: 5, shell: 6, octopus: 5, penguin: 3, sailor: 2, lighthouse: 1, shoal: 1, colony: 1, captain: 1, mermaid: 4 };
export const COLORS = ['navy', 'sky', 'black', 'yellow', 'green', 'purple', 'gray', 'orange', 'pink'] as const;
export type Color = (typeof COLORS)[number] | 'white';
export interface Card { id: number; kind: Kind; color: Color }
export const CARDS: Card[] = (() => {
  const out: Card[] = [];
  let k = 0;
  for (const kind of KINDS) for (let i = 0; i < COUNT[kind]; i++) out.push({ id: out.length, kind, color: kind === 'mermaid' ? 'white' : COLORS[(k++ * 4) % 9]! });
  return out;
})();
const TARGET: Record<number, number> = { 2: 40, 3: 35, 4: 30 };

export interface SspState {
  players: number;
  deck: number[];
  piles: [number[], number[]];
  hands: number[][];
  played: number[][];
  scores: number[];
  current: number;
  phase: 'draw' | 'choose' | 'act' | 'crab' | 'end';
  drawn: number[];
  crabPile: 0 | 1 | null;
  extraTurn: boolean;
  lastChance: { caller: number; left: number[] } | null;
  round: number;
  roundLog: { call: 'stop' | 'last' | 'empty'; by: number | null; gains: number[] }[];
  last: { seat: number; kind: string; detail?: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface SspView {
  players: number;
  hand: number[] | null;
  handCount: number[];
  played: number[][];
  piles: [number | null, number | null];
  pileCounts: [number, number];
  deckCount: number;
  scores: number[];
  current: number;
  phase: SspState['phase'];
  drawn: number[] | null;
  crabCards: number[] | null;
  extraTurn: boolean;
  lastChance: SspState['lastChance'];
  round: number;
  target: number;
  roundLog: SspState['roundLog'];
  myPoints: number | null;
  last: SspState['last'];
  seq: number;
  outcome: Outcome | null;
}

export const sspAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('draw') }),
  z.strictObject({ type: z.literal('keep'), card: z.number().int().min(0).max(57), pile: z.union([z.literal(0), z.literal(1)]) }),
  z.strictObject({ type: z.literal('take'), pile: z.union([z.literal(0), z.literal(1)]) }),
  z.strictObject({ type: z.literal('duo'), cards: z.tuple([z.number().int().min(0).max(57), z.number().int().min(0).max(57)]), pile: z.union([z.literal(0), z.literal(1)]).optional(), target: z.number().int().min(0).max(3).optional() }),
  z.strictObject({ type: z.literal('crabTake'), card: z.number().int().min(0).max(57) }),
  z.strictObject({ type: z.literal('end'), call: z.enum(['pass', 'stop', 'last']) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SspAction = z.infer<typeof sspAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const kind = (id: number) => CARDS[id]!.kind;
export function duoKind(a: number, b: number): 'crab' | 'boat' | 'fish' | 'shark' | null {
  const x = kind(a), y = kind(b);
  if (a === b) return null;
  if (x === y && (x === 'crab' || x === 'boat' || x === 'fish')) return x;
  if ((x === 'swimmer' && y === 'shark') || (x === 'shark' && y === 'swimmer')) return 'shark';
  return null;
}

/** Card points of a hand plus played cards (no colour bonus). */
export function points(cards: number[]): number {
  const n = (k: Kind) => cards.filter((id) => kind(id) === k).length;
  let p = Math.floor(n('crab') / 2) + Math.floor(n('boat') / 2) + Math.floor(n('fish') / 2) + Math.min(n('swimmer'), n('shark'));
  p += [0, 0, 2, 4, 6, 8, 10][n('shell')]! + [0, 0, 3, 6, 9, 12][n('octopus')]! + [0, 1, 3, 5][n('penguin')]! + [0, 0, 5][n('sailor')]!;
  if (n('lighthouse')) p += n('boat');
  if (n('shoal')) p += n('fish');
  if (n('colony')) p += 2 * n('penguin');
  if (n('captain')) p += 3 * n('sailor');
  const byColor = COLORS.map((c) => cards.filter((id) => CARDS[id]!.color === c).length).sort((a, b) => b - a);
  for (let i = 0; i < n('mermaid'); i++) p += byColor[i] ?? 0;
  return p;
}
export const colorBonus = (cards: number[]) => Math.max(0, ...COLORS.map((c) => cards.filter((id) => CARDS[id]!.color === c).length));
const all = (s: SspState, k: number) => [...s.hands[k]!, ...s.played[k]!];

// ---------- module ----------

type Events = Transition<SspState>['internalEvents'];
const finish = (s: SspState, events: Events): Transition<SspState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: SspState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: s.scores[seat]! })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function deal(s: SspState, rng: EngineRng) {
  s.deck = shuffle(rng, CARDS.map((c) => c.id));
  s.piles = [[s.deck.shift()!], [s.deck.shift()!]];
  s.hands = Array.from({ length: s.players }, () => []);
  s.played = Array.from({ length: s.players }, () => []);
  s.phase = 'draw'; s.drawn = []; s.crabPile = null; s.extraTurn = false; s.lastChance = null;
}

function endRound(s: SspState, rng: EngineRng, call: 'stop' | 'last' | 'empty', by: number | null) {
  const pts = s.hands.map((_, k) => points(all(s, k)));
  let gains = pts.map(() => 0);
  if (call === 'stop') gains = pts;
  else if (call === 'last') {
    const best = pts[by!]! >= Math.max(...pts.filter((_, k) => k !== by));
    gains = pts.map((p, k) => { const bonus = colorBonus(all(s, k)); return best ? (k === by ? p + bonus : bonus) : (k === by ? bonus : p); });
  }
  gains.forEach((g, k) => { s.scores[k]! += g; });
  s.roundLog.push({ call, by, gains });
  const target = TARGET[s.players]!;
  if (s.scores.some((x) => x >= target)) { s.phase = 'end'; s.outcome = { placements: rank(s, s.scores.map((_, k) => k)), reason: 'score' }; return; }
  s.round += 1;
  s.current = by ?? (s.current + 1) % s.players;
  deal(s, rng);
}

function startTurn(s: SspState, rng: EngineRng) {
  s.phase = 'draw';
  if (!s.deck.length && !s.piles[0].length && !s.piles[1].length) endRound(s, rng, 'empty', null);
}

function endTurn(s: SspState, rng: EngineRng) {
  if (s.extraTurn) { s.extraTurn = false; startTurn(s, rng); return; }
  if (s.lastChance) {
    s.lastChance.left = s.lastChance.left.filter((k) => k !== s.current);
    if (!s.lastChance.left.length) { endRound(s, rng, 'last', s.lastChance.caller); return; }
    s.current = s.lastChance.left[0]!;
    startTurn(s, rng);
    return;
  }
  s.current = (s.current + 1) % s.players;
  if (!s.deck.length) { endRound(s, rng, 'empty', null); return; }
  startTurn(s, rng);
}

export const sspModule: GameModule<SspState, SspAction, SspView> = {
  manifest: seaSaltPaper.manifest,
  actionSchema: sspAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 4) throw new Error('sea salt & paper needs 2–4 players');
    const s = { players: playerCount, scores: Array(playerCount).fill(0), current: rng.nextInt(playerCount), round: 1, roundLog: [], last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null } as unknown as SspState;
    deal(s, rng);
    if (options.deal === 'tutorial') {
      const ofKind = (k: Kind) => CARDS.filter((c) => c.kind === k).map((c) => c.id);
      const shells = ofKind('shell');
      s.current = 0;
      s.scores = [35, 30];
      s.hands = [shells.slice(0, 4), [ofKind('crab')[0]!, ofKind('boat')[0]!]];
      s.piles = [[shells[4]!], [ofKind('fish')[0]!]];
      s.deck = s.deck.filter((id) => !s.hands.flat().includes(id) && id !== shells[4] && id !== ofKind('fish')[0]);
      s.phase = 'draw';
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'draw': return s.phase === 'draw' && s.deck.length > 0 ? { ok: true } : { ok: false, errorCode: 'CANNOT_DRAW' };
      case 'take': return s.phase === 'draw' && s.piles[a.pile].length > 0 ? { ok: true } : { ok: false, errorCode: 'EMPTY_PILE' };
      case 'keep': {
        if (s.phase !== 'choose' || !s.drawn.includes(a.card)) return { ok: false, errorCode: 'NOT_DRAWN' };
        return s.piles.some((p) => !p.length) && s.piles[a.pile].length ? { ok: false, errorCode: 'FILL_EMPTY_PILE' } : { ok: true };
      }
      case 'crabTake': return s.phase === 'crab' && s.crabPile !== null && s.piles[s.crabPile].includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_IN_PILE' };
      case 'duo': {
        if (s.phase !== 'act') return { ok: false, errorCode: 'DRAW_FIRST' };
        const h = s.hands[seat]!;
        if (!h.includes(a.cards[0]) || !h.includes(a.cards[1])) return { ok: false, errorCode: 'NOT_IN_HAND' };
        const d = duoKind(a.cards[0], a.cards[1]);
        if (!d) return { ok: false, errorCode: 'NOT_A_DUO' };
        if (d === 'crab' && (a.pile === undefined || !s.piles[a.pile].length)) return { ok: false, errorCode: 'CHOOSE_PILE' };
        if (d === 'shark' && (a.target === undefined || a.target === seat || a.target >= s.players || !s.hands[a.target]!.length)) return { ok: false, errorCode: 'CHOOSE_TARGET' };
        if (d === 'fish' && !s.deck.length) return { ok: false, errorCode: 'EMPTY_DECK' };
        return { ok: true };
      }
      case 'end': {
        if (s.phase !== 'act') return { ok: false, errorCode: 'DRAW_FIRST' };
        if (a.call === 'pass') return { ok: true };
        if (s.lastChance) return { ok: false, errorCode: 'LAST_CHANCE_RUNNING' };
        return points(all(s, seat)) >= 7 ? { ok: true } : { ok: false, errorCode: 'NEED_SEVEN' };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.phase = 'end';
      s.outcome = { placements: [...rank(s, s.scores.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: s.scores[seat]! }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    const h = s.hands[seat]!;
    switch (a.type) {
      case 'draw': s.drawn = s.deck.splice(0, 2); s.phase = s.drawn.length === 2 ? 'choose' : 'act'; if (s.drawn.length === 1) { h.push(s.drawn[0]!); s.drawn = []; } s.last = { seat, kind: 'draw' }; break;
      case 'keep': {
        h.push(a.card);
        const other = s.drawn.find((x) => x !== a.card)!;
        s.piles[a.pile].push(other);
        s.drawn = [];
        s.phase = 'act';
        s.last = { seat, kind: 'keep' };
        break;
      }
      case 'take': h.push(s.piles[a.pile].pop()!); s.phase = 'act'; s.last = { seat, kind: 'take', detail: String(h.at(-1)) }; break;
      case 'crabTake': {
        const pile = s.piles[s.crabPile!];
        pile.splice(pile.indexOf(a.card), 1);
        h.push(a.card);
        s.crabPile = null;
        s.phase = 'act';
        break;
      }
      case 'duo': {
        const d = duoKind(a.cards[0], a.cards[1])!;
        s.hands[seat] = h.filter((x) => x !== a.cards[0] && x !== a.cards[1]);
        s.played[seat]!.push(a.cards[0], a.cards[1]);
        s.last = { seat, kind: 'duo', detail: d };
        if (d === 'crab') { s.crabPile = a.pile!; s.phase = 'crab'; }
        else if (d === 'boat') s.extraTurn = true;
        else if (d === 'fish') s.hands[seat]!.push(s.deck.shift()!);
        else { const t = s.hands[a.target!]!; const i = ctx.rng.nextInt(t.length); s.hands[seat]!.push(t.splice(i, 1)[0]!); }
        if (s.hands[seat]!.filter((x) => kind(x) === 'mermaid').length + s.played[seat]!.filter((x) => kind(x) === 'mermaid').length >= 4) win4(s, seat);
        break;
      }
      case 'end': {
        s.last = { seat, kind: a.call };
        if (a.call === 'stop') { endRound(s, ctx.rng, 'stop', seat); break; }
        if (a.call === 'last') { s.lastChance = { caller: seat, left: Array.from({ length: s.players - 1 }, (_, i) => (seat + 1 + i) % s.players) }; s.extraTurn = false; s.current = s.lastChance.left[0]!; startTurn(s, ctx.rng); break; }
        endTurn(s, ctx.rng);
        break;
      }
    }
    if (!s.outcome && (a.type === 'keep' || a.type === 'take' || a.type === 'crabTake' || a.type === 'draw') && s.hands[seat]!.filter((x) => kind(x) === 'mermaid').length >= 4) win4(s, seat);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, handCount: s.hands.map((x) => x.length), played: s.played.map((x) => x.slice()),
      piles: [s.piles[0].at(-1) ?? null, s.piles[1].at(-1) ?? null], pileCounts: [s.piles[0].length, s.piles[1].length], deckCount: s.deck.length,
      scores: s.scores.slice(), current: s.current, phase: s.phase, drawn: me === s.current && s.drawn.length ? s.drawn.slice() : null,
      crabCards: me === s.current && s.crabPile !== null ? s.piles[s.crabPile].slice() : null, extraTurn: s.extraTurn, lastChance: s.lastChance ? structuredClone(s.lastChance) : null,
      round: s.round, target: TARGET[s.players]!, roundLog: structuredClone(s.roundLog), myPoints: me >= 0 ? points(all(s, me)) : null, last: s.last ? { ...s.last } : null, seq: s.seq, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.current === seat) {
      if (s.phase === 'draw') { if (s.deck.length) out.push({ type: 'draw' }); [0, 1].forEach((p) => { if (s.piles[p as 0 | 1].length) out.push({ type: 'take', pile: p }); }); }
      if (s.phase === 'choose') out.push({ type: 'keep', options: s.drawn.slice(), mustPile: s.piles.findIndex((p) => !p.length) });
      if (s.phase === 'crab') out.push({ type: 'crabTake' });
      if (s.phase === 'act') {
        out.push({ type: 'end', call: 'pass' });
        if (!s.lastChance && points(all(s, seat)) >= 7) { out.push({ type: 'end', call: 'stop' }); out.push({ type: 'end', call: 'last' }); }
        out.push({ type: 'duo' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.current;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: SspAction) => sspModule.apply(s, { kind: 'player', seat }, a, ctx);
    if (s.phase === 'draw') {
      const p = s.piles[0].length ? 0 : s.piles[1].length ? 1 : null;
      run(p !== null ? { type: 'take', pile: p } : { type: 'draw' });
    }
    if (s.phase === 'choose') { const empty = s.piles.findIndex((p) => !p.length); run({ type: 'keep', card: s.drawn[0]!, pile: (empty < 0 ? 0 : empty) as 0 | 1 }); }
    if (s.phase === 'crab') run({ type: 'crabTake', card: s.piles[s.crabPile!][0]! });
    const t = s.phase === 'act' && !s.outcome ? run({ type: 'end', call: 'pass' }) : finish(s, []);
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 53,
    options: { deal: 'tutorial' },
    introFa: 'شما چهار صدف دارید (۶ امتیاز) و ۳۵ امتیاز جمع کرده‌اید؛ هدف ۴۰ است. روی کپهٔ اول یک صدف دیگر است.',
    steps: [
      { instructionFa: 'صدف روی کپهٔ اول را بردارید: پنج صدف ۸ امتیاز است.', expected: { type: 'take', pile: 0 }, reply: null },
      { instructionFa: 'حالا بیش از ۷ امتیاز دارید: «بس» را بزنید تا دست تمام شود.', expected: { type: 'end', call: 'stop' }, reply: null }
    ],
    completedFa: 'بردید! ۸ امتیاز این دست شما را به ۴۳ رساند.'
  }
};

function win4(s: SspState, seat: number) {
  s.phase = 'end';
  s.outcome = { placements: [{ seat, place: 1, score: s.scores[seat]! }, ...s.scores.map((_, k) => k).filter((k) => k !== seat).map((k) => ({ seat: k, place: 2, score: s.scores[k]! }))], reason: 'win' };
}
