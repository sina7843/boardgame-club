// Skull («جمجمه»): each player has four discs — three roses, one skull. A round: everyone places one disc face down
// (in turn order); then on your turn either add a disc to your stack or open the bidding with how many discs you
// promise to turn up. Players raise or pass; when everyone else has passed (or the bid equals every disc on the table)
// the challenger turns up all of their own discs first, then chooses opponents' top discs one by one. All roses: a
// point (two points win). A skull: the challenger loses a disc at random (only they learn which) and, if their own
// skull stopped them, starts the next round; otherwise the skull's owner starts it. Losing every disc eliminates you;
// the last player standing wins. Official for 3–6; the 2-player game is offered (unofficial) for tutorials.
// Hidden: what each player holds and has placed (counts are public), and the type of a lost disc.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { skull } from './definition.ts';

export type Disc = 'rose' | 'skull';
export interface SkullState {
  players: number;
  /** Discs still held (not placed). */
  hands: Disc[][];
  /** Placed stacks, bottom → top. */
  stacks: Disc[][];
  /** Discs still owned (hand + stack); 0 = eliminated. */
  owned: number[];
  points: number[];
  current: number;
  starter: number;
  phase: 'first' | 'place' | 'bid' | 'reveal' | 'end';
  /** Players that still have to place their first disc this round. */
  firstLeft: number[];
  bid: { seat: number; n: number } | null;
  passed: boolean[];
  /** Reveal phase: discs turned so far (seat + disc), and how many remain to turn. */
  turned: { seat: number; disc: Disc }[];
  log: ({ seq: number; seat: number } & ({ t: 'place' } | { t: 'bid'; n: number } | { t: 'pass' } | { t: 'flip'; of: number; disc: Disc } | { t: 'win-challenge' } | { t: 'lose-disc'; eliminated: boolean } | { t: 'timeout' } | { t: 'resign' }))[];
  seq: number;
  /** Private: the type of the disc each player lost last (only that player sees it). */
  lostLast: (Disc | null)[];
  timeouts: number[];
  outcome: Outcome | null;
}
export interface SkullView {
  players: number;
  hand: Disc[] | null;
  myStack: Disc[] | null;
  handCounts: number[];
  stackCounts: number[];
  owned: number[];
  points: number[];
  current: number | null;
  phase: SkullState['phase'];
  bid: SkullState['bid'];
  passed: boolean[];
  turned: SkullState['turned'];
  maxBid: number;
  log: SkullState['log'];
  lostLast: Disc | null;
  outcome: Outcome | null;
}

export const skullAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), disc: z.enum(['rose', 'skull']) }),
  z.strictObject({ type: z.literal('bid'), n: z.number().int().min(1).max(24) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('flip'), seat: z.number().int().min(0).max(5) }),
  z.strictObject({ type: z.literal('resign') })
]);
export type SkullAction = z.infer<typeof skullAction>;

const onTable = (s: SkullState) => s.stacks.reduce((a, st) => a + st.length, 0);
const alive = (s: SkullState) => s.owned.map((o, k) => (o > 0 ? k : -1)).filter((k) => k >= 0);

// ---------- module ----------

type Events = Transition<SkullState>['internalEvents'];
const finish = (s: SkullState, events: Events): Transition<SkullState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const log = (s: SkullState, e: Record<string, unknown>) => { s.log.push({ ...e, seq: ++s.seq } as SkullState['log'][number]); if (s.log.length > 40) s.log.shift(); };

function nextAlive(s: SkullState, from: number, skip: (k: number) => boolean = () => false) {
  for (let k = 1; k <= s.players; k++) { const n = (from + k) % s.players; if (s.owned[n]! > 0 && !skip(n)) return n; }
  return from;
}

function startRound(s: SkullState, starter: number) {
  for (let k = 0; k < s.players; k++) { s.hands[k]!.push(...s.stacks[k]!.splice(0)); }
  s.starter = s.owned[starter]! > 0 ? starter : nextAlive(s, starter);
  s.current = s.starter;
  s.phase = 'first';
  s.firstLeft = alive(s);
  s.bid = null;
  s.passed = Array(s.players).fill(false);
  s.turned = [];
}

function endGame(s: SkullState, winner: number, reason: Outcome['reason']) {
  s.phase = 'end';
  const others = Array.from({ length: s.players }, (_, k) => k).filter((k) => k !== winner)
    .sort((a, b) => s.points[b]! - s.points[a]! || s.owned[b]! - s.owned[a]!);
  s.outcome = { placements: [{ seat: winner, place: 1, score: s.points[winner] }, ...others.map((seat, i) => ({ seat, place: i + 2, score: s.points[seat] }))], reason };
}

/** Turn up the challenger's own discs first; stop at a skull. Returns true when the reveal is decided. */
function flipOwn(s: SkullState, rng: EngineRng): boolean {
  const c = s.bid!.seat;
  const own = s.stacks[c]!;
  for (let i = own.length - 1; i >= 0 && s.turned.length < s.bid!.n; i--) {
    const disc = own[i]!;
    s.turned.push({ seat: c, disc });
    log(s, { t: 'flip', seat: c, of: c, disc });
    if (disc === 'skull') { failChallenge(s, c, rng); return true; }
  }
  if (s.turned.length >= s.bid!.n) { winChallenge(s); return true; }
  return false;
}

function winChallenge(s: SkullState) {
  const c = s.bid!.seat;
  s.points[c]! += 1;
  log(s, { t: 'win-challenge', seat: c });
  if (s.points[c]! >= 2) { endGame(s, c, 'win'); return; }
  startRound(s, c);
}

function failChallenge(s: SkullState, skullOwner: number, rng: EngineRng) {
  const c = s.bid!.seat;
  // The challenger loses one disc at random from everything they own (only they learn which).
  const all = [...s.hands[c]!, ...s.stacks[c]!];
  const idx = rng.nextInt(all.length);
  const lost = all.splice(idx, 1)[0]!;
  s.hands[c] = all; s.stacks[c] = [];
  s.owned[c]! -= 1;
  s.lostLast[c] = lost;
  log(s, { t: 'lose-disc', seat: c, eliminated: s.owned[c] === 0 });
  const left = alive(s);
  if (left.length === 1) { endGame(s, left[0]!, 'win'); return; }
  // The skull's owner starts the next round (the challenger, if it was their own skull).
  startRound(s, skullOwner);
}

function afterFirst(s: SkullState) {
  s.firstLeft = s.firstLeft.filter((k) => k !== s.current);
  if (s.firstLeft.length) { s.current = nextAlive(s, s.current, (k) => !s.firstLeft.includes(k)); return; }
  s.phase = 'place';
  s.current = s.starter;
}

function closeBidding(s: SkullState, rng: EngineRng) {
  s.phase = 'reveal';
  s.current = s.bid!.seat;
  s.turned = [];
  flipOwn(s, rng);
}

function nextBidder(s: SkullState, rng: EngineRng) {
  const active = alive(s).filter((k) => !s.passed[k]);
  if (active.length === 1 || s.bid!.n >= onTable(s)) { closeBidding(s, rng); return; }
  s.current = nextAlive(s, s.current, (k) => s.passed[k]!);
}

export const skullModule: GameModule<SkullState, SkullAction, SkullView> = {
  manifest: skull.manifest,
  actionSchema: skullAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('skull needs 2–6 players');
    const s: SkullState = {
      players: playerCount, hands: Array.from({ length: playerCount }, () => ['rose', 'rose', 'rose', 'skull']), stacks: Array.from({ length: playerCount }, () => []),
      owned: Array(playerCount).fill(4), points: Array(playerCount).fill(0), current: 0, starter: 0, phase: 'first', firstLeft: [], bid: null,
      passed: Array(playerCount).fill(false), turned: [], log: [], seq: 0, lostLast: Array(playerCount).fill(null), timeouts: Array(playerCount).fill(0), outcome: null
    };
    startRound(s, options.deal === 'tutorial' ? 0 : rng.nextInt(playerCount));
    // Tutorial: the learner starts and both sides already have one successful challenge (one more wins).
    if (options.deal === 'tutorial') s.points = [1, 1];
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || s.owned[actor.seat] === 0) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    if (actor.seat !== s.current) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const seat = actor.seat;
    switch (a.type) {
      case 'place':
        if (s.phase !== 'first' && s.phase !== 'place') return { ok: false, errorCode: 'WRONG_PHASE' };
        return s.hands[seat]!.includes(a.disc) ? { ok: true } : { ok: false, errorCode: 'NO_SUCH_DISC' };
      case 'bid': {
        if (s.phase !== 'place' && s.phase !== 'bid') return { ok: false, errorCode: 'WRONG_PHASE' };
        const min = (s.bid?.n ?? 0) + 1;
        return a.n >= min && a.n <= onTable(s) ? { ok: true } : { ok: false, errorCode: 'BAD_BID' };
      }
      case 'pass':
        return s.phase === 'bid' ? { ok: true } : { ok: false, errorCode: 'WRONG_PHASE' };
      case 'flip':
        if (s.phase !== 'reveal') return { ok: false, errorCode: 'WRONG_PHASE' };
        if (a.seat === seat) return { ok: false, errorCode: 'OWN_DISCS_FIRST' };
        return s.stacks[a.seat]!.length - s.turned.filter((t) => t.seat === a.seat).length > 0 ? { ok: true } : { ok: false, errorCode: 'NOTHING_TO_FLIP' };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.owned[seat] = 0; s.hands[seat] = []; s.stacks[seat] = [];
      log(s, { t: 'resign', seat });
      const left = alive(s);
      if (left.length === 1) endGame(s, left[0]!, 'resign');
      else startRound(s, s.current === seat ? nextAlive(s, seat) : s.starter);
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    if (a.type === 'place') {
      const h = s.hands[seat]!;
      h.splice(h.indexOf(a.disc), 1);
      s.stacks[seat]!.push(a.disc);
      log(s, { t: 'place', seat });
      if (s.phase === 'first') afterFirst(s); else s.current = nextAlive(s, seat);
    } else if (a.type === 'bid') {
      s.bid = { seat, n: a.n };
      s.phase = 'bid';
      log(s, { t: 'bid', seat, n: a.n });
      nextBidder(s, ctx.rng);
    } else if (a.type === 'pass') {
      s.passed[seat] = true;
      log(s, { t: 'pass', seat });
      nextBidder(s, ctx.rng);
    } else {
      // Flip the top unturned disc of that stack.
      const stack = s.stacks[a.seat]!;
      const done = s.turned.filter((t) => t.seat === a.seat).length;
      const disc = stack[stack.length - 1 - done]!;
      s.turned.push({ seat: a.seat, disc });
      log(s, { t: 'flip', seat, of: a.seat, disc });
      if (disc === 'skull') failChallenge(s, a.seat, ctx.rng);
      else if (s.turned.length >= s.bid!.n) winChallenge(s);
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    return {
      players: s.players, hand: me >= 0 ? s.hands[me]!.slice() : null, myStack: me >= 0 ? s.stacks[me]!.slice() : null,
      handCounts: s.hands.map((h) => h.length), stackCounts: s.stacks.map((st) => st.length), owned: s.owned.slice(), points: s.points.slice(),
      current: s.outcome ? null : s.current, phase: s.phase, bid: s.bid, passed: s.passed.slice(), turned: s.turned.slice(), maxBid: onTable(s),
      log: s.log.slice(), lostLast: me >= 0 ? s.lostLast[me] ?? null : null, outcome: s.outcome
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || s.owned[viewer.seat] === 0) return [];
    const out: ActionHint[] = [];
    if (viewer.seat === s.current) {
      const seat = viewer.seat;
      if (s.phase === 'first' || s.phase === 'place') for (const d of new Set(s.hands[seat]!)) out.push({ type: 'place', disc: d });
      if (s.phase === 'place' || s.phase === 'bid') { const min = (s.bid?.n ?? 0) + 1; if (min <= onTable(s)) out.push({ type: 'bid', min, max: onTable(s) }); }
      if (s.phase === 'bid') out.push({ type: 'pass' });
      if (s.phase === 'reveal') for (let k = 0; k < s.players; k++) if (k !== seat && s.stacks[k]!.length - s.turned.filter((t) => t.seat === k).length > 0) out.push({ type: 'flip', seat: k });
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
    const hints = skullModule.legalActions(s, { kind: 'player', seat }).filter((h) => h.type !== 'resign');
    const pick = hints.find((h) => h.type === 'place' && h.disc === 'rose') ?? hints.find((h) => h.type === 'pass') ?? hints.find((h) => h.type === 'flip') ?? hints[0]!;
    const action = (pick.type === 'bid' ? { type: 'bid', n: pick.min } : pick.type === 'place' ? { type: 'place', disc: pick.disc } : pick.type === 'flip' ? { type: 'flip', seat: pick.seat } : { type: pick.type }) as SkullAction;
    return skullModule.apply(s, { kind: 'player', seat }, action, ctx);
  },

  pendingSeats: (s) => (s.outcome ? [] : [s.current]),

  tutorial: {
    seed: 16,
    options: { deal: 'tutorial' },
    introFa: 'هر بازیکن چهار دیسک دارد: سه گل و یک جمجمه. دیسک‌ها رو به پایین روی هم گذاشته می‌شوند و کسی نمی‌داند زیر هر دسته چیست. با «پیشنهاد» قول می‌دهید آن تعداد دیسک را رو کنید و فقط گل ببینید؛ موفقیت یک امتیاز دارد و دو امتیاز یعنی برد. شما و حریف هر کدام یک امتیاز دارید و این آموزش دو دور طول می‌کشد.',
    steps: [
      { instructionFa: 'شروع هر دور همه باید یک دیسک بگذارند. یک «گل» بگذارید. حریف هم دیسک اولش را می‌گذارد.', expected: { type: 'place', disc: 'rose' }, reply: { type: 'place', disc: 'rose' } },
      { instructionFa: 'حالا در نوبتتان یا دیسک دیگری می‌گذارید یا پیشنهاد می‌دهید. بلوف بزنید: «جمجمه» را روی گلتان بگذارید. حریف پیشنهاد ۲ می‌دهد، یعنی قول می‌دهد ۲ دیسک را بدون جمجمه رو کند.', expected: { type: 'place', disc: 'skull' }, reply: { type: 'bid', n: 2 } },
      { instructionFa: 'یا باید عدد بالاتری بگویید یا کنار بکشید. «کنار می‌کشم» را بزنید. حریف تنها مانده و باید اول گل خودش و بعد دیسک بالایی شما را رو کند، که همان جمجمه است.', expected: { type: 'pass' }, reply: { type: 'flip', seat: 0 } },
      { instructionFa: 'حریف به جمجمهٔ شما رسید و یکی از دیسک‌هایش به‌تصادف و مخفیانه حذف شد (حالا ۳ دیسک دارد). صاحب جمجمه، یعنی شما، دور بعد را شروع می‌کند و همه دیسک‌هایشان را پس گرفته‌اند. اولین دیسک این دور را بگذارید: یک «گل».', expected: { type: 'place', disc: 'rose' }, reply: { type: 'place', disc: 'rose' } },
      { instructionFa: 'یک «گل» دیگر بگذارید. حالا ۳ دیسک روی میز است. حریف پیشنهاد ۲ می‌دهد.', expected: { type: 'place', disc: 'rose' }, reply: { type: 'bid', n: 2 } },
      { instructionFa: 'عدد را بالا ببرید: ۳ را انتخاب کنید و «پیشنهاد ۳» را بزنید. پیشنهاد به تعداد کل دیسک‌های میز رسیده، پس رقابت فوراً تمام می‌شود و شما باید رو کنید. قانون مهم: اول همهٔ دیسک‌های خودتان رو می‌شود؛ دو گل شما خودکار رو می‌شوند.', expected: { type: 'bid', n: 3 }, reply: null },
      { instructionFa: 'یک دیسک دیگر لازم است و باید از دستهٔ حریف باشد. دیسک بالایی حریف را رو کنید.', expected: { type: 'flip', seat: 1 }, reply: null }
    ],
    completedFa: 'بردید! هر سه دیسکی که رو کردید گل بود، پس دومین امتیازتان را گرفتید و دو امتیاز یعنی پیروزی (۲ در برابر ۱). دور اول هم نشان داد چرا بلوف کار می‌کند: حریف به جمجمهٔ شما خورد و یک دیسک از دست داد. کسی که همهٔ دیسک‌هایش را از دست بدهد بیرون می‌رود و آخرین بازیکن باقی‌مانده هم برنده است.'
  }
};
