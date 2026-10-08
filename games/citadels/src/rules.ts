// Citadels («ارگ‌ها»), 2–7 players, base characters 1–8 and the 54 coloured districts (no purple specials — noted).
// Draft each round from the crowned player: one character is removed face down (and 2/1 face up with 4/5 players;
// the King is never face up); everyone takes one (2–3 players take two each, in turn order). Characters are called
// 1→8: the holder takes 2 gold or draws 2 and keeps 1, may build (one district; the Architect three, after drawing two
// extra cards) and uses the ability — Assassin kills a character (it skips its turn), Thief robs one (gets its gold
// when it is called), Magician swaps hands with a player or redraws cards, King takes the crown, Bishop is safe from
// the Warlord, Merchant +1 gold, Warlord destroys a district for its cost − 1 (not in a completed city). King, Bishop,
// Merchant and Warlord collect 1 gold per district of their colour. No two identical districts in a city. Building an
// eighth district ends the game after the round: costs + 3 for all four colours + 4 first to finish + 2 other finishers.
// Hidden: hands, the deck, picked characters until called, removed face-down character, the draft pool (to non-pickers).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { citadels } from './definition.ts';

export type Color = 'yellow' | 'blue' | 'green' | 'red';
export interface District { id: number; name: string; color: Color; cost: number }
const LIST: [string, Color, number, number][] = [
  ['عمارت', 'yellow', 3, 5], ['قصر کوچک', 'yellow', 4, 4], ['کاخ', 'yellow', 5, 3],
  ['معبد', 'blue', 1, 3], ['کلیسا', 'blue', 2, 3], ['صومعه', 'blue', 3, 3], ['جامع', 'blue', 5, 2],
  ['کاروانسرا', 'green', 1, 5], ['بازارچه', 'green', 2, 4], ['تیمچه', 'green', 2, 3], ['اسکله', 'green', 3, 3], ['بندر', 'green', 4, 3], ['دارالحکومه', 'green', 5, 2],
  ['برج دیده‌بانی', 'red', 1, 3], ['زندان', 'red', 2, 3], ['میدان نبرد', 'red', 3, 3], ['دژ', 'red', 5, 2]
];
export const DISTRICTS: District[] = LIST.flatMap(([name, color, cost, n]) => Array.from({ length: n }, () => ({ name, color, cost }))).map((d, id) => ({ ...d, id }));
export const CHARACTERS = ['', 'آدم‌کش', 'دزد', 'شعبده‌باز', 'شاه', 'اسقف', 'بازرگان', 'معمار', 'سردار'];
const COLOR_OF: Record<number, Color> = { 4: 'yellow', 5: 'blue', 6: 'green', 8: 'red' };

export interface CitadelsState {
  players: number;
  deck: number[];
  hands: number[][];
  cities: number[][];
  gold: number[];
  crown: number;
  round: number;
  phase: 'draft' | 'income' | 'choose' | 'act' | 'end';
  pool: number[];
  faceDown: number | null;
  faceUp: number[];
  draftOrder: number[];
  draftIdx: number;
  picks: number[][];
  calling: number;
  killed: number | null;
  robbed: { char: number; by: number } | null;
  drawn: number[];
  buildsLeft: number;
  abilityUsed: boolean;
  firstComplete: number | null;
  revealed: number[];
  last: { seat: number; kind: string; detail?: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export interface CitadelsView extends Omit<CitadelsState, 'deck' | 'hands' | 'pool' | 'faceDown' | 'picks' | 'drawn' | 'timeouts'> {
  deckCount: number;
  hand: number[] | null;
  handCount: number[];
  pool: number[] | null;
  myPicks: number[];
  pickCounts: number[];
  drawn: number[] | null;
  /** Holder of each revealed character (called this round). */
  holders: Record<number, number>;
  scores: number[];
}

export const citadelsAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pick'), char: z.number().int().min(1).max(8) }),
  z.strictObject({ type: z.literal('income'), take: z.enum(['gold', 'cards']) }),
  z.strictObject({ type: z.literal('keep'), card: z.number().int().min(0).max(53) }),
  z.strictObject({ type: z.literal('build'), card: z.number().int().min(0).max(53) }),
  z.strictObject({ type: z.literal('kill'), char: z.number().int().min(2).max(8) }),
  z.strictObject({ type: z.literal('rob'), char: z.number().int().min(3).max(8) }),
  z.strictObject({ type: z.literal('swap'), target: z.number().int().min(0).max(6) }),
  z.strictObject({ type: z.literal('redraw'), cards: z.array(z.number().int().min(0).max(53)).min(1).max(20) }),
  z.strictObject({ type: z.literal('destroy'), target: z.number().int().min(0).max(6), card: z.number().int().min(0).max(53) }),
  z.strictObject({ type: z.literal('end') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type CitadelsAction = z.infer<typeof citadelsAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const holder = (s: CitadelsState, c: number) => s.picks.findIndex((p) => p.includes(c));
export function scoreOf(s: Pick<CitadelsState, 'cities' | 'firstComplete'>, k: number) {
  const city = s.cities[k]!;
  let pts = city.reduce((a, id) => a + DISTRICTS[id]!.cost, 0);
  if (new Set(city.map((id) => DISTRICTS[id]!.color)).size === 4) pts += 3;
  if (city.length >= 8) pts += s.firstComplete === k ? 4 : 2;
  return pts;
}

// ---------- module ----------

type Events = Transition<CitadelsState>['internalEvents'];
const finish = (s: CitadelsState, events: Events): Transition<CitadelsState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function rank(s: CitadelsState, seats: number[]): Outcome['placements'] {
  const r = seats.map((seat) => ({ seat, p: scoreOf(s, seat) })).sort((a, b) => b.p - a.p);
  const out: Outcome['placements'] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.p === x.p ? out[i - 1]!.place : i + 1, score: x.p }); });
  return out;
}

function draw(s: CitadelsState, n: number) { return s.deck.splice(0, n); }

function startDraft(s: CitadelsState, rng: EngineRng) {
  s.round += 1;
  s.phase = 'draft';
  s.picks = s.hands.map(() => []);
  s.killed = null; s.robbed = null; s.revealed = [];
  let chars = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8]);
  s.faceDown = chars.shift()!;
  const up = s.players === 4 ? 2 : s.players === 5 ? 1 : 0;
  s.faceUp = [];
  for (let i = 0; i < chars.length && s.faceUp.length < up; i++) if (chars[i] !== 4) { s.faceUp.push(chars[i]!); }
  chars = chars.filter((c) => !s.faceUp.includes(c));
  s.pool = chars.sort((a, b) => a - b);
  const perPlayer = s.players <= 3 ? 2 : 1;
  s.draftOrder = Array.from({ length: s.players * perPlayer }, (_, i) => (s.crown + i) % s.players);
  s.draftIdx = 0;
}

function callNext(s: CitadelsState, rng: EngineRng) {
  for (let c = s.calling + 1; c <= 8; c++) {
    const h = holder(s, c);
    if (h < 0) continue;
    s.revealed.push(c);
    if (c === s.killed) continue;
    s.calling = c;
    if (s.robbed?.char === c) { s.gold[s.robbed.by]! += s.gold[h]!; s.gold[h] = 0; }
    if (c === 4) s.crown = h;
    const col = COLOR_OF[c];
    if (col) s.gold[h]! += s.cities[h]!.filter((id) => DISTRICTS[id]!.color === col).length;
    if (c === 6) s.gold[h]! += 1;
    if (c === 7) s.hands[h]!.push(...draw(s, 2));
    s.buildsLeft = c === 7 ? 3 : 1;
    s.abilityUsed = false;
    s.phase = 'income';
    return;
  }
  endRound(s, rng);
}

function endRound(s: CitadelsState, rng: EngineRng) {
  const king = holder(s, 4);
  if (king >= 0) s.crown = king;
  if (s.firstComplete !== null) { s.phase = 'end'; s.outcome = { placements: rank(s, s.cities.map((_, k) => k)), reason: 'score' }; return; }
  s.calling = 0;
  startDraft(s, rng);
}

export const current = (s: Pick<CitadelsState, 'phase' | 'draftOrder' | 'draftIdx' | 'picks' | 'calling' | 'outcome'>) =>
  (s.outcome ? -1 : s.phase === 'draft' ? s.draftOrder[s.draftIdx]! : s.picks.findIndex((p) => p.includes(s.calling)));

export const citadelsModule: GameModule<CitadelsState, CitadelsAction, CitadelsView> = {
  manifest: citadels.manifest,
  actionSchema: citadelsAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 7) throw new Error('citadels needs 2–7 players');
    const deck = shuffle(rng, DISTRICTS.map((d) => d.id));
    const s = {
      players: playerCount, deck, hands: Array.from({ length: playerCount }, () => deck.splice(0, 4)), cities: Array.from({ length: playerCount }, () => []),
      gold: Array(playerCount).fill(2), crown: rng.nextInt(playerCount), round: 0, calling: 0, drawn: [], buildsLeft: 1, abilityUsed: false, firstComplete: null,
      revealed: [], last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    } as unknown as CitadelsState;
    startDraft(s, rng);
    if (options.deal === 'tutorial') {
      const ofName = (n: string, k = 0) => DISTRICTS.filter((d) => d.name === n)[k]!.id;
      s.phase = 'income';
      s.picks = [[6], [1, 3]];
      s.calling = 6;
      s.revealed = [1, 3, 6];
      s.cities = [[ofName('عمارت'), ofName('کاخ'), ofName('معبد'), ofName('جامع'), ofName('کاروانسرا'), ofName('بندر'), ofName('دژ')], [ofName('بازارچه'), ofName('زندان')]];
      s.hands = [[ofName('دارالحکومه')], [ofName('کلیسا')]];
      s.deck = s.deck.filter((id) => !s.cities.flat().includes(id) && !s.hands.flat().includes(id));
      s.gold = [3, 4];
      s.buildsLeft = 1;
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (current(s) !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const c = s.calling;
    switch (a.type) {
      case 'pick': return s.phase === 'draft' && s.pool.includes(a.char) ? { ok: true } : { ok: false, errorCode: 'NOT_AVAILABLE' };
      case 'income': return s.phase === 'income' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'keep': return s.phase === 'choose' && s.drawn.includes(a.card) ? { ok: true } : { ok: false, errorCode: 'NOT_DRAWN' };
      case 'end': return s.phase === 'act' ? { ok: true } : { ok: false, errorCode: 'NOT_NOW' };
      case 'build': {
        if (s.phase !== 'act' || s.buildsLeft <= 0) return { ok: false, errorCode: 'NO_BUILD' };
        if (!s.hands[seat]!.includes(a.card)) return { ok: false, errorCode: 'NOT_IN_HAND' };
        if (s.cities[seat]!.some((id) => DISTRICTS[id]!.name === DISTRICTS[a.card]!.name)) return { ok: false, errorCode: 'DUPLICATE' };
        return s.gold[seat]! >= DISTRICTS[a.card]!.cost ? { ok: true } : { ok: false, errorCode: 'NO_GOLD' };
      }
      default: break;
    }
    if ((s.phase !== 'act' && s.phase !== 'income') || s.abilityUsed) return { ok: false, errorCode: 'ABILITY_USED' };
    switch (a.type) {
      case 'kill': return c === 1 ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_ABILITY' };
      case 'rob': return c === 2 && a.char !== s.killed ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_ABILITY' };
      case 'swap': return c === 3 && a.target !== seat && a.target < s.players ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_ABILITY' };
      case 'redraw': return c === 3 && a.cards.every((id) => s.hands[seat]!.includes(id)) ? { ok: true } : { ok: false, errorCode: 'NOT_YOUR_ABILITY' };
      case 'destroy': {
        if (c !== 8 || s.phase !== 'act') return { ok: false, errorCode: 'NOT_YOUR_ABILITY' };
        if (!s.cities[a.target]?.includes(a.card) || s.cities[a.target]!.length >= 8) return { ok: false, errorCode: 'CANNOT_DESTROY' };
        const bishop = holder(s, 5);
        if (bishop === a.target && s.killed !== 5) return { ok: false, errorCode: 'BISHOP_PROTECTS' };
        return s.gold[seat]! >= DISTRICTS[a.card]!.cost - 1 ? { ok: true } : { ok: false, errorCode: 'NO_GOLD' };
      }
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.outcome = { placements: [...rank(s, s.cities.map((_, k) => k).filter((k) => k !== seat)), { seat, place: s.players, score: scoreOf(s, seat) }], reason: 'resign' };
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    switch (a.type) {
      case 'pick':
        s.pool = s.pool.filter((c) => c !== a.char);
        s.picks[seat]!.push(a.char);
        s.draftIdx += 1;
        s.last = { seat, kind: 'pick' };
        if (s.draftIdx >= s.draftOrder.length) { s.calling = 0; callNext(s, ctx.rng); }
        break;
      case 'income':
        if (a.take === 'gold') { s.gold[seat]! += 2; s.phase = 'act'; }
        else { s.drawn = draw(s, 2); s.phase = s.drawn.length ? 'choose' : 'act'; if (s.drawn.length === 1) { s.hands[seat]!.push(s.drawn[0]!); s.drawn = []; s.phase = 'act'; } }
        s.last = { seat, kind: a.take };
        break;
      case 'keep': s.hands[seat]!.push(a.card); s.deck.push(...s.drawn.filter((x) => x !== a.card)); s.drawn = []; s.phase = 'act'; break;
      case 'build':
        s.hands[seat] = s.hands[seat]!.filter((x) => x !== a.card);
        s.cities[seat]!.push(a.card);
        s.gold[seat]! -= DISTRICTS[a.card]!.cost;
        s.buildsLeft -= 1;
        if (s.cities[seat]!.length >= 8 && s.firstComplete === null) s.firstComplete = seat;
        s.last = { seat, kind: 'build', detail: DISTRICTS[a.card]!.name };
        break;
      case 'kill': s.killed = a.char; s.abilityUsed = true; s.last = { seat, kind: 'kill', detail: CHARACTERS[a.char] }; break;
      case 'rob': s.robbed = { char: a.char, by: seat }; s.abilityUsed = true; s.last = { seat, kind: 'rob', detail: CHARACTERS[a.char] }; break;
      case 'swap': [s.hands[seat], s.hands[a.target]] = [s.hands[a.target]!, s.hands[seat]!]; s.abilityUsed = true; s.last = { seat, kind: 'swap' }; break;
      case 'redraw': s.hands[seat] = s.hands[seat]!.filter((x) => !a.cards.includes(x)); s.deck.push(...a.cards); s.hands[seat]!.push(...draw(s, a.cards.length)); s.abilityUsed = true; s.last = { seat, kind: 'redraw' }; break;
      case 'destroy':
        s.cities[a.target] = s.cities[a.target]!.filter((x) => x !== a.card);
        s.gold[seat]! -= DISTRICTS[a.card]!.cost - 1;
        s.deck.push(a.card);
        s.abilityUsed = true;
        s.last = { seat, kind: 'destroy', detail: DISTRICTS[a.card]!.name };
        break;
      case 'end': s.last = { seat, kind: 'end' }; callNext(s, ctx.rng); break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s, viewer: Viewer) {
    const me = viewer.kind === 'player' ? viewer.seat : -1;
    const holders: Record<number, number> = {};
    for (const c of s.revealed) holders[c] = holder(s, c);
    const cur = current(s);
    const { deck, hands, pool, faceDown: _f, picks, drawn, timeouts: _t, ...rest } = structuredClone(s);
    return {
      ...rest, deckCount: deck.length, hand: me >= 0 ? hands[me]! : null, handCount: hands.map((h) => h.length), pool: s.phase === 'draft' && cur === me ? pool : null,
      myPicks: me >= 0 ? picks[me]! : [], pickCounts: picks.map((p) => p.length), drawn: cur === me && drawn.length ? drawn : null, holders,
      scores: s.cities.map((_, k) => scoreOf(s, k))
    };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (current(s) === seat) {
      if (s.phase === 'draft') out.push({ type: 'pick', chars: s.pool.slice() });
      if (s.phase === 'income') out.push({ type: 'income' });
      if (s.phase === 'choose') out.push({ type: 'keep', cards: s.drawn.slice() });
      if (s.phase === 'act') {
        if (s.buildsLeft > 0) for (const id of s.hands[seat]!) if (s.gold[seat]! >= DISTRICTS[id]!.cost && !s.cities[seat]!.some((x) => DISTRICTS[x]!.name === DISTRICTS[id]!.name)) out.push({ type: 'build', card: id });
        out.push({ type: 'end' });
      }
      if ((s.phase === 'act' || s.phase === 'income') && !s.abilityUsed) out.push({ type: 'ability', char: s.calling });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = current(s);
    const missed = s.timeouts[seat]! + 1;
    const run = (a: CitadelsAction) => citadelsModule.apply(s, { kind: 'player', seat }, a, ctx);
    let t: Transition<CitadelsState>;
    if (s.phase === 'draft') t = run({ type: 'pick', char: s.pool[0]! });
    else {
      if (s.phase === 'income') run({ type: 'income', take: 'gold' });
      if (s.phase === 'choose') run({ type: 'keep', card: s.drawn[0]! });
      t = run({ type: 'end' });
    }
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => { const c = current(s); return c < 0 ? [] : [c]; },

  tutorial: {
    seed: 67,
    options: { deal: 'tutorial' },
    introFa: 'نقش شما «بازرگان» است و هفت محله ساخته‌اید. «دارالحکومه» در دستتان ۵ طلا قیمت دارد و شما ۳ طلا دارید (بازرگان برای محله‌های سبز و خودش طلای اضافه گرفته).',
    steps: [
      { instructionFa: '۲ طلا بگیرید.', expected: { type: 'income', take: 'gold' }, reply: null },
      { instructionFa: 'حالا «دارالحکومه» را بسازید: این هشتمین محلهٔ شهرتان است.', expected: { type: 'build', card: 41 }, reply: null },
      { instructionFa: 'نوبت را تمام کنید؛ با تمام شدن دور، بازی هم تمام می‌شود.', expected: { type: 'end' }, reply: null }
    ],
    completedFa: 'بردید! شهر کامل شما (+۴) و چهار رنگ محله (+۳) شما را جلو انداخت.'
  }
};
