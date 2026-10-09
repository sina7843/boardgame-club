// UNO rules (official Mattel rulebook 42001): 2–10 players, 108 cards (blank cards are for house rules and are not
// used), hidden hands, UNO call + catch window, Wild Draw 4 challenge with a private hand reveal, scoring to a target.
import { z } from 'zod';
import type { Actor, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { uno } from './definition.ts';

export const COLORS = ['r', 'y', 'g', 'b'] as const;
export type Color = (typeof COLORS)[number];
export type Kind = 'num' | 'skip' | 'rev' | 'd2' | 'wild' | 'wd4';
export interface Card { id: string; color: Color | null; kind: Kind; value: number | null }

export const HAND_SIZE = 7;
const MAX_TIMEOUTS = 3;
const LOG_SIZE = 30;

export type LogEntry =
  | { t: 'start'; hand: number; dealer: number; top: Card }
  | { t: 'play'; seat: number; card: Card; color: Color; uno: boolean }
  | { t: 'draw'; seat: number; n: number; reason: 'turn' | 'd2' | 'wd4' | 'start' | 'penalty' | 'challenge' }
  | { t: 'pass'; seat: number }
  | { t: 'skip'; seat: number }
  | { t: 'uno'; seat: number }
  | { t: 'caught'; seat: number; by: number; n: number }
  | { t: 'challenge'; by: number; seat: number; guilty: boolean }
  | { t: 'color'; seat: number; color: Color }
  | { t: 'timeout'; seat: number }
  | { t: 'left'; seat: number; reason: 'resign' | 'timeout' }
  | { t: 'handEnd'; winner: number; points: number };

export interface UnoState {
  players: number;
  active: boolean[];
  hands: Card[][];
  draw: Card[];
  discard: Card[];
  color: Color | null;
  direction: 1 | -1;
  current: number;
  dealer: number;
  /** play: normal turn · drawn: drew a playable card · wd4: target decides challenge/accept · chooseColor: start Wild */
  phase: 'play' | 'drawn' | 'wd4' | 'chooseColor';
  drawnId: string | null;
  wd4: { offender: number; target: number; illegal: boolean } | null;
  /** Seat that played its next-to-last card without calling UNO and can still be caught. */
  unoWindow: number | null;
  /** Seats that called UNO for their current single card. */
  called: boolean[];
  /** Challenger's private view of the challenged hand (only projected to `to`). */
  reveal: { to: number; seat: number; cards: Card[]; seq: number } | null;
  scores: number[];
  hand: number;
  target: number | null;
  penalty: number;
  timeouts: number[];
  log: (LogEntry & { seq: number })[];
  seq: number;
  outcome: Outcome | null;
}

const colorSchema = z.enum(COLORS);
export const unoAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play'), card: z.string().max(16), color: colorSchema.optional(), uno: z.boolean().optional() }),
  z.strictObject({ type: z.literal('draw') }),
  z.strictObject({ type: z.literal('keep') }),
  z.strictObject({ type: z.literal('accept') }),
  z.strictObject({ type: z.literal('challenge') }),
  z.strictObject({ type: z.literal('chooseColor'), color: colorSchema }),
  z.strictObject({ type: z.literal('callUno') }),
  z.strictObject({ type: z.literal('catch'), seat: z.number().int().min(0).max(15) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type UnoAction = z.infer<typeof unoAction>;

export interface UnoView {
  players: number;
  active: boolean[];
  handCounts: number[];
  myHand: Card[] | null;
  top: Card | null;
  color: Color | null;
  direction: 1 | -1;
  current: number;
  dealer: number;
  phase: UnoState['phase'];
  /** Only the drawer learns which card was drawn. */
  drawnId: string | null;
  wd4: { offender: number; target: number } | null;
  unoWindow: number | null;
  called: boolean[];
  reveal: { seat: number; cards: Card[]; seq: number } | null;
  drawCount: number;
  discardCount: number;
  scores: number[];
  hand: number;
  target: number | null;
  penalty: number;
  log: (LogEntry & { seq: number })[];
  outcome: Outcome | null;
}

// ---------- cards ----------

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const c of COLORS) {
    deck.push({ id: `${c}0`, color: c, kind: 'num', value: 0 });
    for (const copy of ['a', 'b']) {
      for (let v = 1; v <= 9; v++) deck.push({ id: `${c}${v}${copy}`, color: c, kind: 'num', value: v });
      for (const k of ['skip', 'rev', 'd2'] as const) deck.push({ id: `${c}${k}${copy}`, color: c, kind: k, value: null });
    }
  }
  for (let i = 1; i <= 4; i++) {
    deck.push({ id: `wild${i}`, color: null, kind: 'wild', value: null });
    deck.push({ id: `wd4${i}`, color: null, kind: 'wd4', value: null });
  }
  return deck;
}

export const cardPoints = (c: Card) => (c.kind === 'num' ? c.value! : c.kind === 'wild' || c.kind === 'wd4' ? 50 : 20);

/** Can `card` go on `top` while `color` is the active colour? Wild cards always can. */
export function canPlay(card: Card, top: Card | null, color: Color | null): boolean {
  if (card.kind === 'wild' || card.kind === 'wd4') return true;
  if (!top) return true;
  if (card.color === color) return true;
  if (top.kind === 'num' && card.kind === 'num') return card.value === top.value;
  return top.kind !== 'num' && top.kind === card.kind;
}

function shuffle<T>(xs: T[], rng: EngineRng): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// ---------- state helpers (all mutate the cloned state the engine passes in) ----------

type Events = Transition<UnoState>['internalEvents'];

function log(s: UnoState, e: LogEntry) {
  s.seq += 1;
  s.log = [...s.log, { ...e, seq: s.seq }].slice(-LOG_SIZE);
}

const activeCount = (s: UnoState) => s.active.filter(Boolean).length;

/** k-th active seat after `from` in the current direction. */
function next(s: UnoState, from: number, k = 1): number {
  let seat = from;
  for (let i = 0; i < k; i++) {
    do seat = (seat + s.direction + s.players) % s.players;
    while (!s.active[seat]);
  }
  return seat;
}

const top = (s: UnoState) => s.discard[s.discard.length - 1] ?? null;

/** Draw n cards for a seat, reshuffling the discard pile (minus its top card) when the draw pile runs out. */
function drawCards(s: UnoState, seat: number, n: number, rng: EngineRng): Card[] {
  const got: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (s.draw.length === 0) {
      const t = s.discard.pop();
      s.draw = shuffle(s.discard, rng);
      s.discard = t ? [t] : [];
    }
    const c = s.draw.pop();
    if (!c) break;
    got.push(c);
  }
  s.hands[seat] = [...s.hands[seat]!, ...got];
  if (got.length) s.called[seat] = false;
  if (s.unoWindow === seat && s.hands[seat]!.length !== 1) s.unoWindow = null;
  return got;
}

function rankOutcome(s: UnoState): Outcome['placements'] {
  const live = s.scores.map((score, seat) => ({ seat, score })).filter((x) => s.active[x.seat]);
  const placements = live.map((x) => ({ seat: x.seat, score: x.score, place: 1 + live.filter((o) => o.score > x.score).length }));
  for (let seat = 0; seat < s.players; seat++) {
    if (!s.active[seat]) placements.push({ seat, score: s.scores[seat]!, place: live.length + 1 });
  }
  return placements;
}

/** Start a new hand: everyone active gets 7, flip the start card and apply its effect (rulebook "SET UP"). */
function dealHand(s: UnoState, rng: EngineRng, tutorialDeal = false) {
  s.hand += 1;
  s.direction = 1;
  s.called = s.called.map(() => false);
  s.unoWindow = null;
  s.wd4 = null;
  s.reveal = null;
  s.drawnId = null;
  if (tutorialDeal) {
    const deck = buildDeck();
    const take = (ids: string[]) => ids.map((id) => deck.splice(deck.findIndex((c) => c.id === id), 1)[0]!);
    s.hands = [take(TUTORIAL.learner), take(TUTORIAL.opponent)];
    const start = take([TUTORIAL.start]);
    // drawOrder[0] is drawn first, so it goes on top of the pile (the end of the array).
    const stacked = take(TUTORIAL.drawOrder).reverse();
    s.draw = [...shuffle(deck, rng), ...stacked];
    s.discard = start;
  } else {
    const deck = shuffle(buildDeck(), rng);
    s.hands = s.hands.map((_, seat) => (s.active[seat] ? deck.splice(-HAND_SIZE) : []));
    s.discard = [];
    s.draw = deck;
    // A Wild Draw 4 cannot start the game: return it to the deck and flip again.
    for (;;) {
      const c = s.draw.pop()!;
      if (c.kind !== 'wd4') { s.discard = [c]; break; }
      s.draw.splice(rng.nextInt(s.draw.length + 1), 0, c);
    }
  }
  const t = top(s)!;
  s.color = t.color;
  log(s, { t: 'start', hand: s.hand, dealer: s.dealer, top: t });
  const first = next(s, s.dealer);
  s.phase = 'play';
  s.current = first;
  if (t.kind === 'd2') {
    drawCards(s, first, 2, rng);
    log(s, { t: 'draw', seat: first, n: 2, reason: 'start' });
    s.current = next(s, first);
  } else if (t.kind === 'skip') {
    log(s, { t: 'skip', seat: first });
    s.current = next(s, first);
  } else if (t.kind === 'rev') {
    // "The player to the right [of the dealer] now plays first, and play goes to the right."
    s.direction = -1;
    s.current = next(s, s.dealer);
  } else if (t.kind === 'wild') {
    // The player to the left of the dealer chooses the colour, then plays.
    s.phase = 'chooseColor';
  }
}

function endHand(s: UnoState, winner: number, rng: EngineRng) {
  const points = s.hands.reduce((sum, h, seat) => sum + (seat === winner ? 0 : h.reduce((a, c) => a + cardPoints(c), 0)), 0);
  s.scores[winner]! += points;
  log(s, { t: 'handEnd', winner, points });
  if (s.target === null) {
    // One-hand match: winner first, the rest by the fewest points left in hand.
    const held = s.hands.map((h) => h.reduce((a, c) => a + cardPoints(c), 0));
    const live = s.active.flatMap((a, seat) => (a ? [seat] : []));
    s.outcome = {
      reason: 'score',
      placements: [
        ...live.map((seat) => ({ seat, score: s.scores[seat]!, place: seat === winner ? 1 : 2 + live.filter((o) => o !== winner && held[o]! < held[seat]!).length })),
        ...s.active.flatMap((a, seat) => (a ? [] : [{ seat, score: s.scores[seat]!, place: live.length + 1 }]))
      ]
    };
    return;
  }
  if (s.scores[winner]! >= s.target) {
    s.outcome = { reason: 'score', placements: rankOutcome(s) };
    return;
  }
  s.dealer = next(s, s.dealer);
  dealHand(s, rng);
}

function removeSeat(s: UnoState, seat: number, reason: 'resign' | 'timeout', rng: EngineRng) {
  s.active[seat] = false;
  s.draw = shuffle([...s.draw, ...s.hands[seat]!], rng);
  s.hands[seat] = [];
  if (s.unoWindow === seat) s.unoWindow = null;
  log(s, { t: 'left', seat, reason });
  if (activeCount(s) === 1) {
    s.outcome = { reason: 'resign', placements: rankOutcome(s) };
    s.outcome.placements = s.outcome.placements.map((p) => ({ ...p, place: s.active[p.seat] ? 1 : 2 }));
    return;
  }
  if (s.wd4 && (s.wd4.target === seat || s.wd4.offender === seat)) {
    // Target left: play continues after it. Offender left: nothing to challenge; the target simply plays.
    const target = s.wd4.target;
    s.wd4 = null;
    s.phase = 'play';
    s.current = target === seat ? next(s, seat) : target;
    return;
  }
  if (s.current === seat) {
    s.phase = 'play';
    s.drawnId = null;
    s.current = next(s, seat);
  }
  if (s.dealer === seat) s.dealer = next(s, seat);
}

/** The current player "begins their turn": an uncalled UNO can no longer be caught. */
const beginTurn = (s: UnoState) => { s.unoWindow = null; };

function playCard(s: UnoState, seat: number, card: Card, chosen: Color | undefined, saidUno: boolean, rng: EngineRng) {
  const prevColor = s.color;
  s.hands[seat] = s.hands[seat]!.filter((c) => c.id !== card.id);
  s.discard = [...s.discard, card];
  s.color = card.color ?? chosen!;
  s.drawnId = null;
  s.timeouts[seat] = 0;
  const left = s.hands[seat]!.length;
  log(s, { t: 'play', seat, card, color: s.color, uno: saidUno && left === 1 });
  if (left === 1) {
    s.called[seat] = saidUno;
    s.unoWindow = saidUno ? null : seat;
  }
  const two = activeCount(s) === 2;
  if (card.kind === 'wd4') {
    const target = next(s, seat);
    const illegal = s.hands[seat]!.some((c) => c.color !== null && c.color === prevColor);
    if (left === 0) {
      // Last card: the next player must still draw (counts for scoring).
      drawCards(s, target, 4, rng);
      log(s, { t: 'draw', seat: target, n: 4, reason: 'wd4' });
      return endHand(s, seat, rng);
    }
    s.wd4 = { offender: seat, target, illegal };
    s.phase = 'wd4';
    s.current = target;
    return;
  }
  if (card.kind === 'd2') {
    const target = next(s, seat);
    drawCards(s, target, 2, rng);
    log(s, { t: 'draw', seat: target, n: 2, reason: 'd2' });
    if (left === 0) return endHand(s, seat, rng);
    log(s, { t: 'skip', seat: target });
    s.phase = 'play';
    s.current = next(s, seat, 2);
    return;
  }
  if (left === 0) return endHand(s, seat, rng);
  s.phase = 'play';
  if (card.kind === 'skip') {
    log(s, { t: 'skip', seat: next(s, seat) });
    s.current = next(s, seat, 2);
  } else if (card.kind === 'rev') {
    s.direction = s.direction === 1 ? -1 : 1;
    // Two players: Reverse works like Skip — the same player plays again.
    s.current = two ? seat : next(s, seat);
  } else {
    s.current = next(s, seat);
  }
}

function finish(s: UnoState, events: Events, turnChanged: boolean): Transition<UnoState> {
  const scheduleChanges: Transition<UnoState>['scheduleChanges'] =
    s.outcome ? [{ kind: 'clear', deadlineKey: 'turn' }] : turnChanged ? [{ kind: 'set', deadlineKey: 'turn' }] : [];
  return { nextState: s, internalEvents: events, scheduleChanges };
}

const playable = (s: UnoState, seat: number) => s.hands[seat]!.filter((c) => canPlay(c, top(s), s.color));

// ---------- teaching deal (tutorial only; not selectable by hosts or admins) ----------

export const TUTORIAL = {
  start: 'r5a',
  learner: ['r7a', 'gd2a', 'wild1', 'y8a', 'r8a'],
  opponent: ['g7a', 'wd41', 'g9a', 'y6a', 'b3a', 'r1a', 'b5a'],
  /** Top of the draw pile in drawing order: +2 for the opponent, the learner's draw, the challenge penalty, the opponent's draw. */
  drawOrder: ['r2a', 'b4a', 'g3a', 'g1a', 'r6a', 'bskipa', 'r9a', 'g2a']
};

export const unoModule: GameModule<UnoState, UnoAction, UnoView> = {
  manifest: uno.manifest,
  actionSchema: unoAction,

  setup({ playerCount, options, rng }) {
    if (playerCount < 2 || playerCount > 10) throw new Error('uno needs 2–10 players');
    const tutorialDeal = options.deal === 'tutorial' && playerCount === 2;
    const length = options.matchLength ?? 'points500';
    const s: UnoState = {
      players: playerCount,
      active: Array<boolean>(playerCount).fill(true),
      hands: Array.from({ length: playerCount }, () => []),
      draw: [], discard: [], color: null, direction: 1, current: 0,
      // Rulebook: the dealer is chosen by a high-card draw; the engine draws a random dealer instead.
      dealer: tutorialDeal ? 1 : rng.nextInt(playerCount),
      phase: 'play', drawnId: null, wd4: null, unoWindow: null,
      called: Array<boolean>(playerCount).fill(false), reveal: null,
      scores: Array<number>(playerCount).fill(0), hand: 0,
      target: length === 'oneHand' || tutorialDeal ? null : length === 'points200' ? 200 : 500,
      penalty: options.unoPenalty === 2 ? 2 : 4,
      timeouts: Array<number>(playerCount).fill(0),
      log: [], seq: 0, outcome: null
    };
    dealHand(s, rng, tutorialDeal);
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    if (!s.active[seat]) return { ok: false, errorCode: 'NOT_IN_GAME' };
    switch (a.type) {
      case 'resign': return { ok: true };
      case 'callUno': return s.unoWindow === seat ? { ok: true } : { ok: false, errorCode: 'NOTHING_TO_CALL' };
      case 'catch':
        return a.seat !== seat && s.unoWindow === a.seat && s.hands[a.seat]?.length === 1 ? { ok: true } : { ok: false, errorCode: 'CANNOT_CATCH' };
    }
    if (seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'chooseColor': return s.phase === 'chooseColor' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'accept':
      case 'challenge': return s.phase === 'wd4' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'keep': return s.phase === 'drawn' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'draw': return s.phase === 'play' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'play': {
        if (s.phase !== 'play' && s.phase !== 'drawn') return { ok: false, errorCode: 'WRONG_PHASE' };
        if (s.phase === 'drawn' && a.card !== s.drawnId) return { ok: false, errorCode: 'ONLY_DRAWN_CARD' };
        const card = s.hands[seat]!.find((c) => c.id === a.card);
        if (!card) return { ok: false, errorCode: 'CARD_NOT_IN_HAND' };
        if (!canPlay(card, top(s), s.color)) return { ok: false, errorCode: 'CARD_DOES_NOT_MATCH' };
        if ((card.kind === 'wild' || card.kind === 'wd4') !== !!a.color) return { ok: false, errorCode: card.color ? 'COLOR_NOT_ALLOWED' : 'COLOR_REQUIRED' };
        return { ok: true };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    const events: Events = [];
    const before = { current: s.current, phase: s.phase, hand: s.hand };
    const turnChanged = () => s.current !== before.current || s.phase !== before.phase || s.hand !== before.hand;
    switch (a.type) {
      case 'resign':
        removeSeat(s, seat, 'resign', ctx.rng);
        events.push({ type: 'resigned', seat });
        return finish(s, events, turnChanged());
      case 'callUno':
        s.called[seat] = true;
        s.unoWindow = null;
        log(s, { t: 'uno', seat });
        return finish(s, events, false);
      case 'catch': {
        const target = a.seat;
        s.unoWindow = null;
        drawCards(s, target, s.penalty, ctx.rng);
        log(s, { t: 'caught', seat: target, by: seat, n: s.penalty });
        return finish(s, events, false);
      }
      case 'chooseColor':
        s.color = a.color;
        s.phase = 'play';
        log(s, { t: 'color', seat, color: a.color });
        return finish(s, events, true);
      case 'draw': {
        beginTurn(s);
        const [card] = drawCards(s, seat, 1, ctx.rng);
        log(s, { t: 'draw', seat, n: card ? 1 : 0, reason: 'turn' });
        events.push({ type: 'drew', seat, card: card?.id ?? null });
        s.timeouts[seat] = 0;
        if (card && canPlay(card, top(s), s.color)) {
          s.phase = 'drawn';
          s.drawnId = card.id;
        } else {
          log(s, { t: 'pass', seat });
          s.current = next(s, seat);
        }
        return finish(s, events, true);
      }
      case 'keep':
        s.phase = 'play';
        s.drawnId = null;
        log(s, { t: 'pass', seat });
        s.current = next(s, seat);
        return finish(s, events, true);
      case 'accept': {
        beginTurn(s);
        const { target } = s.wd4!;
        drawCards(s, target, 4, ctx.rng);
        log(s, { t: 'draw', seat: target, n: 4, reason: 'wd4' });
        log(s, { t: 'skip', seat: target });
        s.wd4 = null;
        s.phase = 'play';
        s.timeouts[seat] = 0;
        s.current = next(s, target);
        return finish(s, events, true);
      }
      case 'challenge': {
        beginTurn(s);
        const { offender, target, illegal } = s.wd4!;
        // "A challenged player must show his/her hand to the player who challenged" — privately.
        s.reveal = { to: target, seat: offender, cards: s.hands[offender]!.slice(), seq: s.seq + 1 };
        log(s, { t: 'challenge', by: target, seat: offender, guilty: illegal });
        events.push({ type: 'challenged', offender, target, illegal });
        s.wd4 = null;
        s.phase = 'play';
        s.timeouts[seat] = 0;
        if (illegal) {
          drawCards(s, offender, 4, ctx.rng);
          log(s, { t: 'draw', seat: offender, n: 4, reason: 'challenge' });
          s.current = target;
        } else {
          drawCards(s, target, 6, ctx.rng);
          log(s, { t: 'draw', seat: target, n: 6, reason: 'challenge' });
          log(s, { t: 'skip', seat: target });
          s.current = next(s, target);
        }
        return finish(s, events, true);
      }
      case 'play': {
        beginTurn(s);
        const card = s.hands[seat]!.find((c) => c.id === a.card)!;
        events.push({ type: 'played', seat, card: card.id });
        playCard(s, seat, card, a.color, !!a.uno, ctx.rng);
        // Two players: after Skip, Draw 2 or an accepted Wild Draw 4 the same player continues — still a new turn.
        return finish(s, events, true);
      }
    }
  },

  project(s, viewer) {
    const own = viewer.kind === 'player' && viewer.seat >= 0 && viewer.seat < s.players ? viewer.seat : null;
    const order = (c: Card) => (c.color ? COLORS.indexOf(c.color) : 4) * 100 + (c.kind === 'num' ? c.value! : { skip: 20, rev: 21, d2: 22, wild: 30, wd4: 31 }[c.kind as 'skip']);
    return {
      players: s.players,
      active: s.active.slice(),
      handCounts: s.hands.map((h) => h.length),
      myHand: own === null ? null : s.hands[own]!.slice().sort((x, y) => order(x) - order(y)),
      top: top(s),
      color: s.color,
      direction: s.direction,
      current: s.current,
      dealer: s.dealer,
      phase: s.phase,
      drawnId: own !== null && own === s.current ? s.drawnId : null,
      wd4: s.wd4 ? { offender: s.wd4.offender, target: s.wd4.target } : null,
      unoWindow: s.unoWindow,
      called: s.called.slice(),
      reveal: s.reveal && own === s.reveal.to ? { seat: s.reveal.seat, cards: s.reveal.cards.slice(), seq: s.reveal.seq } : null,
      drawCount: s.draw.length,
      discardCount: s.discard.length,
      scores: s.scores.slice(),
      hand: s.hand,
      target: s.target,
      penalty: s.penalty,
      log: s.log.slice(),
      outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.active[viewer.seat]) return [];
    const seat = viewer.seat;
    const out: { type: string; [k: string]: unknown }[] = [];
    if (s.unoWindow === seat) out.push({ type: 'callUno' });
    if (s.unoWindow !== null && s.unoWindow !== seat && s.hands[s.unoWindow]!.length === 1) out.push({ type: 'catch', seat: s.unoWindow });
    if (seat === s.current) {
      if (s.phase === 'chooseColor') for (const color of COLORS) out.push({ type: 'chooseColor', color });
      if (s.phase === 'wd4') out.push({ type: 'accept' }, { type: 'challenge' });
      if (s.phase === 'play') {
        for (const c of playable(s, seat)) out.push({ type: 'play', card: c.id, needsColor: c.color === null });
        out.push({ type: 'draw' });
      }
      if (s.phase === 'drawn') {
        const c = s.hands[seat]!.find((x) => x.id === s.drawnId)!;
        out.push({ type: 'play', card: c.id, needsColor: c.color === null }, { type: 'keep' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _event, ctx) {
    if (s.outcome) return finish(s, [], false);
    const seat = s.current;
    const events: Events = [{ type: 'timed-out', seat }];
    log(s, { t: 'timeout', seat });
    s.timeouts[seat] = (s.timeouts[seat] ?? 0) + 1;
    if (s.timeouts[seat]! >= MAX_TIMEOUTS) {
      removeSeat(s, seat, 'timeout', ctx.rng);
      return finish(s, events, true);
    }
    beginTurn(s);
    if (s.phase === 'chooseColor') {
      // Colour of the most common card in hand (deterministic), then the turn passes.
      const count = (c: Color) => s.hands[seat]!.filter((x) => x.color === c).length;
      const color = [...COLORS].sort((x, y) => count(y) - count(x))[0]!;
      s.color = color;
      log(s, { t: 'color', seat, color });
      s.phase = 'play';
      s.current = next(s, seat);
    } else if (s.phase === 'wd4') {
      const { target } = s.wd4!;
      drawCards(s, target, 4, ctx.rng);
      log(s, { t: 'draw', seat: target, n: 4, reason: 'wd4' });
      s.wd4 = null;
      s.phase = 'play';
      s.current = next(s, target);
    } else if (s.phase === 'drawn') {
      s.phase = 'play';
      s.drawnId = null;
      s.current = next(s, seat);
    } else {
      drawCards(s, seat, 1, ctx.rng);
      log(s, { t: 'draw', seat, n: 1, reason: 'turn' });
      s.current = next(s, seat);
    }
    log(s, { t: 'pass', seat });
    return finish(s, events, true);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 11,
    options: { deal: 'tutorial' },
    introFa: 'یک دست دونفره اونو. در هر نوبت روی کارت رو یک کارت هم‌رنگ، هم‌عدد یا هم‌نماد می‌گذارید؛ کارت‌های «رنگی» و «+۴» همیشه مجازند. اولین کسی که دستش خالی شود دست را می‌برد و امتیاز کارت‌های مانده در دست حریف را می‌گیرد. شما ۵ کارت دارید و اول بازی می‌کنید.',
    steps: [
      { instructionFa: 'کارت رو «۵ قرمز» است. «۷ قرمز» را بگذارید: هم‌رنگ بودن کافی است.', expected: { type: 'play', card: 'r7a' }, reply: { type: 'play', card: 'g7a' } },
      { instructionFa: 'حریف «۷ سبز» گذاشت (هم‌عدد با کارت شما) و رنگ سبز شد. «+۲ سبز» را بگذارید: حریف ۲ کارت می‌کشد و نوبتش می‌سوزد، پس در بازی دونفره دوباره نوبت شماست.', expected: { type: 'play', card: 'gd2a' }, reply: null },
      { instructionFa: 'حالا فقط کارت «رنگی» با سبز جور است، ولی بهتر است نگهش دارید. به‌جای بازی یک کارت از دسته بکشید؛ کشیدن همیشه مجاز است.', expected: { type: 'draw' }, reply: null },
      { instructionFa: 'کارت کشیده‌شده «۳ سبز» است و با کارت رو جور است، پس می‌توانید همین کارت را همین حالا بازی کنید (یا نگهش دارید و نوبت را تمام کنید). آن را بگذارید.', expected: { type: 'play', card: 'g3a' }, reply: { type: 'play', card: 'wd41', color: 'b' } },
      { instructionFa: 'حریف «+۴» گذاشت و آبی را انتخاب کرد. +۴ فقط وقتی مجاز است که بازیکن کارت هم‌رنگ کارت قبلی (اینجا سبز) نداشته باشد. اعتراض کنید: دستش فقط به شما نشان داده می‌شود؛ اگر سبز داشته باشد خودش ۴ کارت می‌کشد، وگرنه شما ۶ کارت می‌کشید.', expected: { type: 'challenge' }, reply: null },
      { instructionFa: 'اعتراض درست بود: حریف «۹ سبز» داشت و ۴ کارت جریمه کشید و نوبت به شما ماند. رنگ آبی است و آبی ندارید. کارت «رنگی» را بگذارید و زرد را انتخاب کنید تا با «۸ زرد» شما جور شود.', expected: { type: 'play', card: 'wild1', color: 'y' }, reply: { type: 'play', card: 'y6a' } },
      { instructionFa: 'دو کارت دارید. پیش از گذاشتن یکی‌مانده به آخرین کارت باید «اونو» بگویید، وگرنه حریف می‌تواند شما را بگیرد و جریمه کارت می‌کشید. دکمهٔ «اونو!» را بزنید و «۸ زرد» را بگذارید.', expected: { type: 'play', card: 'y8a', uno: true }, reply: { type: 'draw' } },
      { instructionFa: 'حریف کارت کشید ولی قابل بازی نبود، پس نوبتش گذشت. آخرین کارت شما «۸ قرمز» هم‌عدد کارت رو است: بگذارید و دست را ببرید.', expected: { type: 'play', card: 'r8a' }, reply: null }
    ],
    completedFa: 'بردید! دست شما خالی شد و امتیاز ۱۱ کارت مانده در دست حریف به شما رسید: کارت‌های عددی به اندازهٔ عددشان (۴۲ امتیاز) و یک «ردشدن آبی» ۲۰ امتیاز؛ روی‌هم ۶۲ امتیاز در برابر صفر. در بازی کامل دست‌ها پشت سر هم بازی می‌شوند تا یک نفر به ۵۰۰ امتیاز (یا هدف انتخاب‌شده) برسد.'
  }
};
