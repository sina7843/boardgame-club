// King of Tokyo («غول‌های شهر»), 2–6 players, base rules with a single Tokyo spot at every player count (no Tokyo
// Bay). 10 health, 0 VP. A turn: roll six dice up to three times keeping any; resolve: three of a number scores that
// number (+1 per extra die), hearts heal (not in Tokyo), bolts give energy, claws hit Tokyo (from outside) or everyone
// outside (from Tokyo). A hit Tokyo monster may yield and the attacker enters. An empty Tokyo is taken by the active
// monster (+1 VP); starting a turn in Tokyo gives +2 VP. Then buy power cards with energy (2 energy sweeps the market).
// 20 VP or last monster standing wins. The power deck is a curated set of base-game-style keep/discard effects with
// Persian names — not the full original 66 cards. Perfect information apart from the deck order.
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition } from '@bg/game-sdk';
import { kingOfTokyo } from './definition.ts';

export type Face = '1' | '2' | '3' | 'heart' | 'bolt' | 'claw';
export const FACES: Face[] = ['1', '2', '3', 'heart', 'bolt', 'claw'];
export type Effect =
  | { kind: 'vp'; n: number; selfDamage?: number; healAfter?: number; damageOthers?: number }
  | { kind: 'energy'; n: number }
  | { kind: 'heal'; n: number }
  | { kind: 'othersLoseVp'; n: number }
  | { kind: 'damageOthers'; n: number }
  | { kind: 'keep'; power: 'armor' | 'acid' | 'regen' | 'friend' | 'bigger' | 'herbivore' | 'urbavore' | 'alpha' | 'solar' | 'underdog' };
export interface Power { id: number; nameFa: string; cost: number; effect: Effect; textFa: string }
export const POWERS: Power[] = [
  { nameFa: 'نیروگاه ذخیره', cost: 8, effect: { kind: 'energy', n: 9 }, textFa: '+۹ انرژی' },
  { nameFa: 'جعبهٔ کمک‌های اولیه', cost: 3, effect: { kind: 'heal', n: 2 }, textFa: '+۲ جان' },
  { nameFa: 'جنگنده‌ها', cost: 5, effect: { kind: 'vp', n: 5, selfDamage: 4 }, textFa: '+۵ امتیاز، ۴ ضربه به خودتان' },
  { nameFa: 'برج مسکونی', cost: 5, effect: { kind: 'vp', n: 3 }, textFa: '+۳ امتیاز' },
  { nameFa: 'قطار شهری', cost: 4, effect: { kind: 'vp', n: 2 }, textFa: '+۲ امتیاز' },
  { nameFa: 'بقالی سر کوچه', cost: 3, effect: { kind: 'vp', n: 1 }, textFa: '+۱ امتیاز' },
  { nameFa: 'آسمان‌خراش', cost: 6, effect: { kind: 'vp', n: 4 }, textFa: '+۴ امتیاز' },
  { nameFa: 'پالایشگاه', cost: 6, effect: { kind: 'vp', n: 2, damageOthers: 3 }, textFa: '+۲ امتیاز، ۳ ضربه به بقیه' },
  { nameFa: 'نیروگاه هسته‌ای', cost: 6, effect: { kind: 'vp', n: 2, healAfter: 3 }, textFa: '+۲ امتیاز، +۳ جان' },
  { nameFa: 'تانک‌ها', cost: 4, effect: { kind: 'vp', n: 4, selfDamage: 3 }, textFa: '+۴ امتیاز، ۳ ضربه به خودتان' },
  { nameFa: 'دستور تخلیه', cost: 7, effect: { kind: 'othersLoseVp', n: 5 }, textFa: 'بقیه ۵ امتیاز از دست می‌دهند' },
  { nameFa: 'شعله‌افکن', cost: 3, effect: { kind: 'damageOthers', n: 2 }, textFa: '۲ ضربه به بقیه' },
  { nameFa: 'گارد ملی', cost: 3, effect: { kind: 'vp', n: 2, selfDamage: 2 }, textFa: '+۲ امتیاز، ۲ ضربه به خودتان' },
  { nameFa: 'زره', cost: 4, effect: { kind: 'keep', power: 'armor' }, textFa: 'ضربهٔ ۱ تایی به شما نمی‌خورد' },
  { nameFa: 'حملهٔ اسیدی', cost: 6, effect: { kind: 'keep', power: 'acid' }, textFa: 'هر نوبت ۱ ضربهٔ اضافه' },
  { nameFa: 'ترمیم', cost: 4, effect: { kind: 'keep', power: 'regen' }, textFa: 'وقتی جان می‌گیرید +۱' },
  { nameFa: 'محبوب بچه‌ها', cost: 3, effect: { kind: 'keep', power: 'friend' }, textFa: 'وقتی انرژی می‌گیرید +۱' },
  { nameFa: 'غول‌تر', cost: 4, effect: { kind: 'keep', power: 'bigger' }, textFa: 'حداکثر جان ۱۲، +۲ جان' },
  { nameFa: 'گیاه‌خوار', cost: 5, effect: { kind: 'keep', power: 'herbivore' }, textFa: 'نوبت بدون ضربه زدن +۱ امتیاز' },
  { nameFa: 'شهرخوار', cost: 4, effect: { kind: 'keep', power: 'urbavore' }, textFa: 'شروع نوبت در شهر +۱، ضربه از شهر +۱' },
  { nameFa: 'غول آلفا', cost: 5, effect: { kind: 'keep', power: 'alpha' }, textFa: 'هر حمله +۱ امتیاز' },
  { nameFa: 'خورشیدی', cost: 2, effect: { kind: 'keep', power: 'solar' }, textFa: 'پایان نوبت بی‌انرژی +۱ انرژی' },
  { nameFa: 'طرفدار ضعیف‌ها', cost: 3, effect: { kind: 'keep', power: 'underdog' }, textFa: 'پایان نوبت با کمترین امتیاز +۱ امتیاز' }
].map((p, id) => ({ ...p, id }) as Power);

export interface KotState {
  players: number;
  hp: number[];
  maxHp: number[];
  vp: number[];
  energy: number[];
  alive: boolean[];
  kept: number[][];
  tokyo: number | null;
  deck: number[];
  market: number[];
  current: number;
  phase: 'roll' | 'yield' | 'buy';
  dice: Face[];
  rolls: number;
  attacked: boolean;
  enteredBy: number | null;
  last: { seat: number; kind: string; detail?: string } | null;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type KotView = Omit<KotState, 'deck' | 'timeouts'> & { deckCount: number };

export const kotAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('roll'), keep: z.array(z.boolean()).length(6) }),
  z.strictObject({ type: z.literal('resolve') }),
  z.strictObject({ type: z.literal('yield'), leave: z.boolean() }),
  z.strictObject({ type: z.literal('buy'), slot: z.number().int().min(0).max(2) }),
  z.strictObject({ type: z.literal('sweep') }),
  z.strictObject({ type: z.literal('end') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type KotAction = z.infer<typeof kotAction>;

function shuffle<T>(rng: EngineRng, xs: T[]) {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rng.nextInt(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const has = (s: KotState, k: number, power: string) => s.kept[k]!.some((id) => { const e = POWERS[id]!.effect; return e.kind === 'keep' && e.power === power; });
const alive = (s: KotState) => s.alive.map((a, k) => (a ? k : -1)).filter((k) => k >= 0);

// ---------- module ----------

type Events = Transition<KotState>['internalEvents'];
const finish = (s: KotState, events: Events): Transition<KotState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });

function checkEnd(s: KotState): boolean {
  if (s.outcome) return true;
  const living = alive(s);
  const champ = living.find((k) => s.vp[k]! >= 20);
  if (living.length <= 1 || champ !== undefined) {
    const winner = champ ?? living[0];
    const order = s.vp.map((v, seat) => ({ seat, v, a: s.alive[seat] ? 1 : 0 })).sort((x, y) => (x.seat === winner ? -1 : y.seat === winner ? 1 : y.a - x.a || y.v - x.v));
    s.outcome = { placements: order.map((x, i) => ({ seat: x.seat, place: i + 1, score: x.v })), reason: 'win' };
    return true;
  }
  return false;
}

function damage(s: KotState, k: number, n: number) {
  if (!s.alive[k] || n <= 0) return;
  if (n === 1 && has(s, k, 'armor')) return;
  s.hp[k] = Math.max(0, s.hp[k]! - n);
  if (s.hp[k] === 0) { s.alive[k] = false; if (s.tokyo === k) s.tokyo = null; }
}
const heal = (s: KotState, k: number, n: number) => { if (n > 0) s.hp[k] = Math.min(s.maxHp[k]!, s.hp[k]! + n + (has(s, k, 'regen') ? 1 : 0)); };
const gainEnergy = (s: KotState, k: number, n: number) => { if (n > 0) s.energy[k]! += n + (has(s, k, 'friend') ? 1 : 0); };

function startTurn(s: KotState) {
  s.phase = 'roll'; s.rolls = 0; s.dice = []; s.attacked = false; s.enteredBy = null;
  if (s.tokyo === s.current) s.vp[s.current]! += 2 + (has(s, s.current, 'urbavore') ? 1 : 0);
  checkEnd(s);
}

function nextTurn(s: KotState) {
  const k = s.current;
  if (s.alive[k]) {
    if (has(s, k, 'solar') && s.energy[k] === 0) s.energy[k] = 1;
    if (has(s, k, 'underdog') && alive(s).every((o) => s.vp[o]! >= s.vp[k]!) && alive(s).some((o) => s.vp[o]! > s.vp[k]!)) s.vp[k]! += 1;
    if (has(s, k, 'herbivore') && !s.attacked) s.vp[k]! += 1;
  }
  if (checkEnd(s)) return;
  for (let i = 1; i <= s.players; i++) { const n = (k + i) % s.players; if (s.alive[n]) { s.current = n; break; } }
  startTurn(s);
}

function resolveDice(s: KotState) {
  const k = s.current;
  const count = (f: Face) => s.dice.filter((d) => d === f).length;
  for (const n of [1, 2, 3] as const) { const c = count(String(n) as Face); if (c >= 3) s.vp[k]! += n + (c - 3); }
  if (s.tokyo !== k) heal(s, k, count('heart'));
  gainEnergy(s, k, count('bolt'));
  let claws = count('claw') + (has(s, k, 'acid') ? 1 : 0);
  if (claws > 0 && s.tokyo === k && has(s, k, 'urbavore')) claws += 1;
  if (claws > 0) {
    s.attacked = true;
    if (has(s, k, 'alpha')) s.vp[k]! += 1;
    if (s.tokyo === k) { for (const o of alive(s)) if (o !== k) damage(s, o, claws); }
    else if (s.tokyo !== null) {
      const t = s.tokyo;
      damage(s, t, claws);
      if (checkEnd(s)) return;
      if (s.alive[t] && s.tokyo === t) { s.phase = 'yield'; return; }
    }
  }
  if (checkEnd(s)) return;
  enterIfEmpty(s);
}

function enterIfEmpty(s: KotState) {
  if (s.tokyo === null && s.alive[s.current]) { s.tokyo = s.current; s.vp[s.current]! += 1; s.enteredBy = s.current; }
  if (!checkEnd(s)) s.phase = 'buy';
}

function applyPower(s: KotState, k: number, p: Power) {
  const e = p.effect;
  switch (e.kind) {
    case 'vp': s.vp[k]! += e.n; if (e.selfDamage) damage(s, k, e.selfDamage); if (e.healAfter) heal(s, k, e.healAfter); if (e.damageOthers) for (const o of alive(s)) if (o !== k) damage(s, o, e.damageOthers); break;
    case 'energy': s.energy[k]! += e.n; break;
    case 'heal': heal(s, k, e.n); break;
    case 'othersLoseVp': for (const o of alive(s)) if (o !== k) s.vp[o] = Math.max(0, s.vp[o]! - e.n); break;
    case 'damageOthers': for (const o of alive(s)) if (o !== k) damage(s, o, e.n); break;
    case 'keep': s.kept[k]!.push(p.id); if (e.power === 'bigger') { s.maxHp[k] = 12; heal(s, k, 2); } break;
  }
}

function refill(s: KotState) { while (s.market.length < 3 && s.deck.length) s.market.push(s.deck.shift()!); }

export const kotModule: GameModule<KotState, KotAction, KotView> = {
  manifest: kingOfTokyo.manifest,
  actionSchema: kotAction,

  setup({ playerCount, rng, options }) {
    if (playerCount < 2 || playerCount > 6) throw new Error('king of tokyo needs 2–6 players');
    const deck = shuffle(rng, POWERS.map((p) => p.id));
    const s: KotState = {
      players: playerCount, hp: Array(playerCount).fill(10), maxHp: Array(playerCount).fill(10), vp: Array(playerCount).fill(0), energy: Array(playerCount).fill(0),
      alive: Array(playerCount).fill(true), kept: Array.from({ length: playerCount }, () => []), tokyo: null, deck, market: deck.splice(0, 3),
      current: rng.nextInt(playerCount), phase: 'roll', dice: [], rolls: 0, attacked: false, enteredBy: null, last: null, seq: 0, timeouts: Array(playerCount).fill(0), outcome: null
    };
    if (options.deal === 'tutorial') {
      // The opponent holds Tokyo; the learner (14 VP, 6 energy) faces a market with no points in it. With seed 2621
      // the first roll is claw,3,3,2,2,1 and keeping claw + both 3s rerolls into claw,3,3,3,claw,heart.
      Object.assign(s, { current: 0, vp: [14, 11], hp: [6, 7], energy: [6, 3], tokyo: 1, market: [0, 11, 1] });
      s.deck = [4, 13, 21, ...POWERS.map((p) => p.id).filter((x) => ![0, 11, 1, 4, 13, 21].includes(x))];
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat >= s.players || !s.alive[actor.seat]) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    if (a.type === 'resign') return { ok: true };
    const seat = actor.seat;
    if (s.phase === 'yield') return a.type === 'yield' && seat === s.tokyo ? { ok: true } : { ok: false, errorCode: 'WAIT_FOR_YIELD' };
    if (s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    switch (a.type) {
      case 'roll': return s.phase === 'roll' && s.rolls < 3 ? { ok: true } : { ok: false, errorCode: 'NO_ROLLS_LEFT' };
      case 'resolve': return s.phase === 'roll' && s.rolls > 0 ? { ok: true } : { ok: false, errorCode: 'ROLL_FIRST' };
      case 'buy': return s.phase === 'buy' && s.market[a.slot] !== undefined && s.energy[seat]! >= POWERS[s.market[a.slot]!]!.cost ? { ok: true } : { ok: false, errorCode: 'CANNOT_BUY' };
      case 'sweep': return s.phase === 'buy' && s.energy[seat]! >= 2 ? { ok: true } : { ok: false, errorCode: 'CANNOT_SWEEP' };
      case 'end': return s.phase === 'buy' ? { ok: true } : { ok: false, errorCode: 'RESOLVE_FIRST' };
      default: return { ok: false, errorCode: 'ILLEGAL_ACTION' };
    }
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    if (a.type === 'resign') {
      s.alive[seat] = false; s.hp[seat] = 0;
      if (s.tokyo === seat) s.tokyo = null;
      if (!checkEnd(s) && (s.current === seat || s.phase === 'yield')) { if (s.phase === 'yield') enterIfEmpty(s); if (s.current === seat) nextTurn(s); }
      return finish(s, [{ type: 'resigned', seat }]);
    }
    s.timeouts[seat] = 0;
    s.seq += 1;
    switch (a.type) {
      case 'roll':
        s.dice = Array.from({ length: 6 }, (_, i) => (s.rolls > 0 && a.keep[i] ? s.dice[i]! : FACES[ctx.rng.nextInt(6)]!));
        s.rolls += 1;
        s.last = { seat, kind: 'roll' };
        break;
      case 'resolve': s.last = { seat, kind: 'resolve', detail: s.dice.join(',') }; resolveDice(s); break;
      case 'yield':
        s.last = { seat, kind: a.leave ? 'leave' : 'stay' };
        if (a.leave) s.tokyo = null;
        enterIfEmpty(s);
        break;
      case 'buy': {
        const id = s.market.splice(a.slot, 1)[0]!;
        s.energy[seat]! -= POWERS[id]!.cost;
        applyPower(s, seat, POWERS[id]!);
        refill(s);
        s.last = { seat, kind: 'buy', detail: String(id) };
        checkEnd(s);
        if (!s.alive[seat] && !s.outcome) nextTurn(s);
        break;
      }
      case 'sweep': s.energy[seat]! -= 2; s.deck.push(...s.market); s.market = []; refill(s); s.last = { seat, kind: 'sweep' }; break;
      case 'end': nextTurn(s); break;
    }
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { deck, timeouts: _t, ...rest } = structuredClone(s);
    return { ...rest, deckCount: deck.length };
  },

  legalActions(s, viewer) {
    if (s.outcome || viewer.kind !== 'player' || !s.alive[viewer.seat]) return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'yield' && s.tokyo === seat) out.push({ type: 'yield' });
    if (s.current === seat && s.phase === 'roll') { if (s.rolls < 3) out.push({ type: 'roll' }); if (s.rolls > 0) out.push({ type: 'resolve' }); }
    if (s.current === seat && s.phase === 'buy') {
      s.market.forEach((id, i) => { if (s.energy[seat]! >= POWERS[id]!.cost) out.push({ type: 'buy', slot: i }); });
      if (s.energy[seat]! >= 2) out.push({ type: 'sweep' });
      out.push({ type: 'end' });
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = s.phase === 'yield' ? s.tokyo! : s.current;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: KotAction) => kotModule.apply(s, { kind: 'player', seat }, a, ctx);
    let t: Transition<KotState> = finish(s, []);
    if (s.phase === 'yield') t = run({ type: 'yield', leave: false });
    else {
      if (s.phase === 'roll' && s.rolls === 0) run({ type: 'roll', keep: Array(6).fill(false) });
      if (s.phase === 'roll') run({ type: 'resolve' });
      if ((s.phase as KotState['phase']) === 'yield') { s.timeouts[seat] = missed; return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] }; }
      if (!s.outcome && s.phase === 'buy' && s.current === seat) t = run({ type: 'end' });
    }
    s.timeouts[seat] = missed;
    return { ...t, internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'yield' ? [s.tokyo!] : [s.current]),

  tutorial: {
    seed: 2621,
    options: { deal: 'tutorial' },
    introFa: 'شما ۱۴ امتیاز، ۶ جان و ۶ انرژی دارید و غول حریف داخل شهر است. هر کس اول به ۲۰ امتیاز برسد (یا آخرین غول زنده بماند) برنده است. در نوبتتان شش تاس را تا ۳ بار می‌ریزید، بعد نتیجه حساب می‌شود و در پایان می‌توانید با انرژی کارت قدرت بخرید.',
    steps: [
      { instructionFa: 'دکمهٔ «بریز» را بزنید تا هر شش تاس ریخته شود.', expected: { type: 'roll', keep: [false, false, false, false, false, false] }, reply: null },
      { instructionFa: 'یک چنگ و دو تا ۳ آمده. سه تاس یکسانِ ۳ یعنی ۳ امتیاز، پس چنگ و هر دو ۳ را با لمس کردن نگه دارید (تاس‌های اول تا سوم) و «دوباره بریز» را بزنید؛ فقط تاس‌های نگه‌داشته‌نشده دوباره ریخته می‌شوند.', expected: { type: 'roll', keep: [true, true, true, false, false, false] }, reply: null },
      { instructionFa: 'عالی شد: سه تا ۳، دو چنگ و یک قلب. «همین‌ها» را بزنید تا حساب شود: سه تا ۳ یعنی ۳ امتیاز، قلب ۱ جان (چون بیرون شهرید)، و دو چنگ ۲ ضربه به غول داخل شهر. غول ضربه‌خورده می‌تواند شهر را ترک کند.', expected: { type: 'resolve' }, reply: { type: 'yield', leave: true } },
      { instructionFa: 'حریف از شهر بیرون رفت و شما جایش وارد شدید: ورود به شهر ۱ امتیاز دارد و حالا ۱۸ امتیاز دارید. هیچ کارتی در بازار امتیاز نمی‌دهد؛ «کارت‌های تازه» را بزنید تا با ۲ انرژی سه کارت بازار عوض شود.', expected: { type: 'sweep' }, reply: null },
      { instructionFa: '«قطار شهری» آمد: ۴ انرژی و ۲ امتیاز. آن را بخرید تا به ۲۰ امتیاز برسید.', expected: { type: 'buy', slot: 0 }, reply: null }
    ],
    completedFa: 'بردید! سه تا ۳ برایتان ۳ امتیاز آورد (۱۷)، ورود به شهر ۱ امتیاز (۱۸) و قطار شهری ۲ امتیاز: ۲۰ امتیاز در برابر ۱۱. اگر در شهر بمانید، شروع هر نوبتتان در شهر ۲ امتیاز می‌دهد، ولی چنگ‌های همهٔ غول‌های بیرون به شما می‌خورد و در شهر قلب جان نمی‌دهد.'
  }
};
