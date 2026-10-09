// Dice Throne («نبرد تاس»), two players. Each picks one of four original heroes (no two the same). 30 HP, 2 CP
// (max 15). Turn: upkeep (wounds hurt 1 per stack; a stunned hero loses this offensive phase), +1 CP, then up to
// three rolls of five dice keeping any dice between rolls (2 CP buys an extra roll), then one ability whose dice
// pattern matches (symbol counts or small/large straights; tiers pick the best). Defendable attacks let the defender
// roll their defence dice (prevent / heal / strike back); ultimates are undefendable. HP ≤ 0 loses (both → draw).
// Simplification: no card deck — CP buys extra rolls and is moved by abilities. Dice are public (server RNG).
import { z } from 'zod';
import type { Actor, ActionHint, EngineRng, GameModule, Outcome, Transition, Viewer } from '@bg/game-sdk';
import { diceThrone } from './definition.ts';

export interface Effect { dmg?: number; heal?: number; cp?: number; steal?: number; wound?: number; stun?: boolean; shield?: boolean; undefendable?: boolean }
export interface Ability { name: string; need: { sym?: string; counts?: number[]; combo?: Record<string, number>; straight?: 4 | 5 }; tiers: Effect[] }
export interface Hero { key: string; name: string; faces: string[]; symFa: Record<string, string>; abilities: Ability[]; defense: { dice: number; per: Record<string, Effect> } }

export const HEROES: Hero[] = [
  {
    key: 'warrior', name: 'جنگجوی کوه', faces: ['sword', 'sword', 'sword', 'heart', 'heart', 'fist'], symFa: { sword: '⚔', heart: '♥', fist: '✊' },
    abilities: [
      { name: 'ضربهٔ شمشیر', need: { sym: 'sword', counts: [3, 4, 5] }, tiers: [{ dmg: 4 }, { dmg: 6 }, { dmg: 8 }] },
      { name: 'التیام خشم', need: { sym: 'heart', counts: [3] }, tiers: [{ heal: 4 }] },
      { name: 'ضربهٔ گیج‌کننده', need: { sym: 'fist', counts: [3] }, tiers: [{ dmg: 5, stun: true }] },
      { name: 'یورش', need: { straight: 4 }, tiers: [{ dmg: 6 }] },
      { name: 'خشم کوهستان', need: { sym: 'fist', counts: [5] }, tiers: [{ dmg: 14, undefendable: true }] }
    ],
    defense: { dice: 3, per: { heart: { heal: 1 }, fist: { dmg: 1 }, sword: {} } }
  },
  {
    key: 'shadow', name: 'سایه‌رو', faces: ['dagger', 'dagger', 'bag', 'bag', 'shade', 'shade'], symFa: { dagger: '🗡', bag: '💰', shade: '◐' },
    abilities: [
      { name: 'خنجر', need: { sym: 'dagger', counts: [3, 4, 5] }, tiers: [{ dmg: 4 }, { dmg: 5, wound: 1 }, { dmg: 6, wound: 2 }] },
      { name: 'دست‌برد', need: { sym: 'bag', counts: [3] }, tiers: [{ dmg: 2, steal: 2 }] },
      { name: 'نیش سایه', need: { combo: { dagger: 2, shade: 2 } }, tiers: [{ dmg: 5, wound: 1 }] },
      { name: 'شبیخون', need: { straight: 5 }, tiers: [{ dmg: 8, undefendable: true }] },
      { name: 'تاریکی مطلق', need: { sym: 'shade', counts: [5] }, tiers: [{ dmg: 12, steal: 2, undefendable: true }] }
    ],
    defense: { dice: 2, per: { shade: { shield: true }, dagger: { dmg: 1 }, bag: { cp: 1 } } }
  },
  {
    key: 'pyro', name: 'آتش‌افروز', faces: ['fire', 'fire', 'fire', 'spark', 'spark', 'meteor'], symFa: { fire: '🔥', spark: '✦', meteor: '☄' },
    abilities: [
      { name: 'شعله', need: { sym: 'fire', counts: [3, 4, 5] }, tiers: [{ dmg: 3, wound: 1 }, { dmg: 5, wound: 1 }, { dmg: 7, wound: 2 }] },
      { name: 'جرقه‌ها', need: { sym: 'spark', counts: [3] }, tiers: [{ dmg: 5, cp: 1 }] },
      { name: 'شهاب', need: { combo: { meteor: 2, fire: 2 } }, tiers: [{ dmg: 7 }] },
      { name: 'موج گرما', need: { straight: 4 }, tiers: [{ dmg: 5, wound: 1 }] },
      { name: 'باران شهاب', need: { sym: 'meteor', counts: [5] }, tiers: [{ dmg: 13, wound: 1, undefendable: true }] }
    ],
    defense: { dice: 3, per: { spark: { shield: true }, fire: { dmg: 1 }, meteor: {} } }
  },
  {
    key: 'paladin', name: 'نگهبان روشنایی', faces: ['sword', 'sword', 'helm', 'helm', 'heart', 'pray'], symFa: { sword: '⚔', helm: '⛨', heart: '♥', pray: '✚' },
    abilities: [
      { name: 'ضربهٔ عدالت', need: { sym: 'sword', counts: [3, 4, 5] }, tiers: [{ dmg: 4, heal: 1 }, { dmg: 5, heal: 1 }, { dmg: 6, heal: 2 }] },
      { name: 'دعا', need: { sym: 'pray', counts: [3] }, tiers: [{ heal: 5, cp: 2 }] },
      { name: 'سپر ایمان', need: { sym: 'helm', counts: [3] }, tiers: [{ dmg: 4, shield: true }] },
      { name: 'حملهٔ مقدس', need: { straight: 5 }, tiers: [{ dmg: 7, heal: 2 }] },
      { name: 'نور خیره‌کننده', need: { sym: 'pray', counts: [5] }, tiers: [{ dmg: 11, heal: 5, undefendable: true }] }
    ],
    defense: { dice: 2, per: { helm: { shield: true }, heart: { heal: 1 }, sword: {}, pray: {} } }
  }
];

export interface Fighter { hero: number | null; hp: number; cp: number; wound: number; stun: boolean; shield: boolean }
export interface DtState {
  phase: 'pick' | 'offense' | 'defense';
  fighters: Fighter[];
  current: number;
  dice: number[];
  rollsLeft: number;
  rolled: boolean;
  pending: { ability: number; effect: Effect } | null;
  defenseDice: number[];
  fixedDice: number[];
  log: { seat: number; text: string }[];
  turn: number;
  seq: number;
  timeouts: number[];
  outcome: Outcome | null;
}
export type DtView = Omit<DtState, 'fixedDice' | 'timeouts'>;
export const MAX_HP = 30;

export const dtAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('pickHero'), hero: z.number().int().min(0).max(3) }),
  z.strictObject({ type: z.literal('roll'), keep: z.array(z.boolean()).length(5) }),
  z.strictObject({ type: z.literal('attack'), ability: z.number().int().min(0).max(4) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('defend') }),
  z.strictObject({ type: z.literal('resign') })
]);
export type DtAction = z.infer<typeof dtAction>;

type Events = Transition<DtState>['internalEvents'];
const finish = (s: DtState, events: Events): Transition<DtState> =>
  ({ nextState: s, internalEvents: events, scheduleChanges: [{ kind: s.outcome ? 'clear' : 'set', deadlineKey: 'turn' }] });
const die = (s: DtState, rng: EngineRng) => s.fixedDice.shift() ?? 1 + rng.nextInt(6);
export const symOf = (hero: Hero, face: number) => hero.faces[face - 1]!;

/** Best tier effect of an ability for the given dice, or null when the pattern is not met. */
export function abilityEffect(hero: Hero, a: Ability, dice: number[]): Effect | null {
  const syms = dice.map((d) => symOf(hero, d));
  const n = (sym: string) => syms.filter((x) => x === sym).length;
  if (a.need.sym) {
    const tier = a.need.counts!.map((c, i) => (n(a.need.sym!) >= c ? i : -1)).filter((i) => i >= 0).pop();
    return tier === undefined ? null : a.tiers[tier]!;
  }
  if (a.need.combo) return Object.entries(a.need.combo).every(([sym, c]) => n(sym) >= c) ? a.tiers[0]! : null;
  const set = new Set(dice);
  const runs = a.need.straight === 5 ? [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]] : [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
  return runs.some((r) => r.every((x) => set.has(x))) ? a.tiers[0]! : null;
}

function hurt(s: DtState, seat: number, dmg: number) {
  const f = s.fighters[seat]!;
  if (dmg > 0 && f.shield) { f.shield = false; dmg = Math.max(0, dmg - 3); }
  f.hp -= dmg;
  return dmg;
}
function checkEnd(s: DtState) {
  const dead = s.fighters.map((f) => f.hp <= 0);
  if (dead[0] && dead[1]) s.outcome = { placements: [{ seat: 0, place: 1 }, { seat: 1, place: 1 }], reason: 'draw' };
  else if (dead[0] || dead[1]) { const w = dead[0] ? 1 : 0; s.outcome = { placements: [{ seat: w, place: 1 }, { seat: 1 - w, place: 2 }], reason: 'win' }; }
}

/** Applies an attack's effect (after defence). */
function resolve(s: DtState, seat: number, e: Effect, prevented: number) {
  const opp = 1 - seat;
  const me = s.fighters[seat]!, them = s.fighters[opp]!;
  const dealt = e.dmg ? hurt(s, opp, Math.max(0, e.dmg - prevented)) : 0;
  if (e.heal) me.hp = Math.min(MAX_HP, me.hp + e.heal);
  if (e.cp) me.cp = Math.min(15, me.cp + e.cp);
  if (e.steal) { const k = Math.min(e.steal, them.cp); them.cp -= k; me.cp = Math.min(15, me.cp + k); }
  if (e.wound) them.wound = Math.min(3, them.wound + e.wound);
  if (e.stun) them.stun = true;
  if (e.shield) me.shield = true;
  return dealt;
}

function startTurn(s: DtState, seat: number) {
  s.current = seat;
  s.phase = 'offense';
  s.turn += 1;
  s.dice = [1, 1, 1, 1, 1]; s.rollsLeft = 3; s.rolled = false; s.pending = null;
  const f = s.fighters[seat]!;
  if (f.wound) { f.hp -= f.wound; s.log.push({ seat, text: `زخم: −${f.wound.toLocaleString('fa-IR')}` }); checkEnd(s); if (s.outcome) return; }
  if (s.turn > 1) f.cp = Math.min(15, f.cp + 1);
  if (f.stun) { f.stun = false; s.log.push({ seat, text: 'گیج بود و نوبتش سوخت' }); startTurn(s, 1 - seat); }
}

export const dtModule: GameModule<DtState, DtAction, DtView> = {
  manifest: diceThrone.manifest,
  actionSchema: dtAction,

  setup({ rng, options }) {
    const fighter = (): Fighter => ({ hero: null, hp: MAX_HP, cp: 2, wound: 0, stun: false, shield: false });
    const s: DtState = {
      phase: 'pick', fighters: [fighter(), fighter()], current: rng.nextInt(2), dice: [1, 1, 1, 1, 1], rollsLeft: 3, rolled: false, pending: null,
      defenseDice: [], fixedDice: [], log: [], turn: 0, seq: 0, timeouts: [0, 0], outcome: null
    };
    if (options.deal === 'tutorial') {
      // Warrior (seat 0) against a Paladin on 15 HP. Scripted dice: turn 1 rolls two fists, keeps them, rolls a third
      // (stun attack); the Paladin's defence rolls helm + heart; the stunned Paladin loses a turn; turn 2 collects five
      // fists over three rolls and one 2-CP extra roll for the undefendable ultimate.
      s.fighters[0]!.hero = 0; s.fighters[1]!.hero = 3; s.fighters[1]!.hp = 15;
      s.fixedDice = [6, 6, 1, 4, 2, 6, 2, 4, 3, 5, 6, 6, 2, 3, 6, 6, 1, 4, 6];
      startTurn(s, 0);
    }
    return s;
  },

  validate(s, actor, a) {
    if (s.outcome) return { ok: false, errorCode: 'GAME_FINISHED' };
    if (actor.kind !== 'player' || actor.seat < 0 || actor.seat > 1) return { ok: false, errorCode: 'NOT_A_PLAYER' };
    const seat = actor.seat;
    if (a.type === 'resign') return { ok: true };
    if (a.type === 'pickHero') {
      if (s.phase !== 'pick' || s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
      return s.fighters.some((f) => f.hero === a.hero) ? { ok: false, errorCode: 'HERO_TAKEN' } : { ok: true };
    }
    if (a.type === 'defend') return s.phase === 'defense' && seat !== s.current ? { ok: true } : { ok: false, errorCode: 'NOT_DEFENDING' };
    if (s.phase !== 'offense' || s.current !== seat) return { ok: false, errorCode: 'NOT_YOUR_TURN' };
    const f = s.fighters[seat]!;
    if (a.type === 'roll') {
      if (!s.rolled && a.keep.some(Boolean)) return { ok: false, errorCode: 'ROLL_ALL_FIRST' };
      return s.rollsLeft > 0 || f.cp >= 2 ? { ok: true } : { ok: false, errorCode: 'NO_ROLLS' };
    }
    if (!s.rolled) return { ok: false, errorCode: 'ROLL_FIRST' };
    if (a.type === 'attack') return abilityEffect(HEROES[f.hero!]!, HEROES[f.hero!]!.abilities[a.ability]!, s.dice) ? { ok: true } : { ok: false, errorCode: 'PATTERN_NOT_MET' };
    return { ok: true };
  },

  apply(s, actor, a, ctx) {
    const seat = (actor as Extract<Actor, { kind: 'player' }>).seat;
    s.seq += 1;
    if (a.type === 'resign') { s.outcome = { placements: [{ seat: 1 - seat, place: 1 }, { seat, place: 2 }], reason: 'resign' }; return finish(s, [{ type: 'resigned', seat }]); }
    s.timeouts[seat] = 0;
    const f = s.fighters[seat]!;
    switch (a.type) {
      case 'pickHero':
        f.hero = a.hero;
        if (s.fighters.every((x) => x.hero !== null)) startTurn(s, 1 - seat);
        else s.current = 1 - seat;
        break;
      case 'roll':
        if (s.rollsLeft > 0) s.rollsLeft -= 1; else f.cp -= 2;
        s.dice = s.dice.map((d, i) => (a.keep[i] ? d : die(s, ctx.rng)));
        s.rolled = true;
        break;
      case 'pass':
        s.log.push({ seat, text: 'بدون حمله گذشت' });
        startTurn(s, 1 - seat);
        break;
      case 'attack': {
        const hero = HEROES[f.hero!]!;
        const e = abilityEffect(hero, hero.abilities[a.ability]!, s.dice)!;
        s.log.push({ seat, text: hero.abilities[a.ability]!.name });
        if (e.dmg && !e.undefendable) { s.pending = { ability: a.ability, effect: e }; s.phase = 'defense'; s.defenseDice = []; break; }
        resolve(s, seat, e, 0);
        checkEnd(s);
        if (!s.outcome) startTurn(s, 1 - seat);
        break;
      }
      case 'defend': {
        const att = s.current;
        const dh = HEROES[f.hero!]!;
        s.defenseDice = Array.from({ length: dh.defense.dice }, () => die(s, ctx.rng));
        let prevent = 0, back = 0, heal = 0, cp = 0, shield = false;
        for (const d of s.defenseDice) {
          const e = dh.defense.per[symOf(dh, d)] ?? {};
          back += e.dmg ?? 0; heal += e.heal ?? 0; cp += e.cp ?? 0; if (e.shield) { if (shield) prevent += 3; shield = true; }
        }
        if (shield) prevent += 3;
        const dealt = resolve(s, att, s.pending!.effect, prevent);
        f.hp = Math.min(MAX_HP, f.hp + heal);
        f.cp = Math.min(15, f.cp + cp);
        if (back) hurt(s, att, back);
        s.log.push({ seat, text: `دفاع: ${dealt.toLocaleString('fa-IR')} آسیب گرفت${back ? `، ${back.toLocaleString('fa-IR')} برگرداند` : ''}` });
        s.pending = null;
        checkEnd(s);
        if (!s.outcome) startTurn(s, 1 - att);
        break;
      }
    }
    if (s.log.length > 8) s.log = s.log.slice(-8);
    return finish(s, [{ type: a.type, seat }]);
  },

  project(s) {
    const { fixedDice: _f, timeouts: _t, ...rest } = structuredClone(s);
    return rest;
  },

  legalActions(s, viewer: Viewer) {
    if (s.outcome || viewer.kind !== 'player') return [];
    const seat = viewer.seat;
    const out: ActionHint[] = [];
    if (s.phase === 'pick' && s.current === seat) HEROES.forEach((_, hero) => { if (!s.fighters.some((f) => f.hero === hero)) out.push({ type: 'pickHero', hero }); });
    if (s.phase === 'defense' && seat !== s.current) out.push({ type: 'defend' });
    if (s.phase === 'offense' && s.current === seat) {
      const f = s.fighters[seat]!;
      if (s.rollsLeft > 0 || f.cp >= 2) out.push({ type: 'roll', extra: s.rollsLeft === 0 });
      if (s.rolled) {
        const hero = HEROES[f.hero!]!;
        hero.abilities.forEach((ab, ability) => { if (abilityEffect(hero, ab, s.dice)) out.push({ type: 'attack', ability }); });
        out.push({ type: 'pass' });
      }
    }
    out.push({ type: 'resign' });
    return out;
  },

  outcome: (s) => s.outcome,

  onTimeout(s, _e, ctx) {
    if (s.outcome) return { nextState: s, internalEvents: [], scheduleChanges: [] };
    const seat = dtModule.pendingSeats(s)[0]!;
    const missed = s.timeouts[seat]! + 1;
    const run = (a: DtAction) => dtModule.apply(s, { kind: 'player', seat }, a, ctx);
    if (s.phase === 'pick') run({ type: 'pickHero', hero: HEROES.findIndex((_, h) => !s.fighters.some((f) => f.hero === h)) });
    else if (s.phase === 'defense') run({ type: 'defend' });
    else {
      if (!s.rolled) run({ type: 'roll', keep: [false, false, false, false, false] });
      const hero = HEROES[s.fighters[seat]!.hero!]!;
      const best = hero.abilities.map((ab, i) => ({ i, e: abilityEffect(hero, ab, s.dice) })).filter((x) => x.e).sort((x, y) => (y.e!.dmg ?? 0) - (x.e!.dmg ?? 0))[0];
      run(best ? { type: 'attack', ability: best.i } : { type: 'pass' });
    }
    s.timeouts[seat] = missed;
    return { ...finish(s, []), internalEvents: [{ type: 'timed-out' }] };
  },

  pendingSeats: (s) => (s.outcome ? [] : s.phase === 'defense' ? [1 - s.current] : [s.current]),

  tutorial: {
    seed: 5,
    options: { deal: 'tutorial' },
    introFa: 'شما «جنگجوی کوه» هستید با ۳۰ جان و ۲ امتیاز رزم (CP)؛ حریف «نگهبان روشنایی» است با ۱۵ جان. تاس‌های شما: ۱ تا ۳ شمشیر ⚔، ۴ و ۵ قلب ♥ و ۶ مشت ✊. در نوبتتان پنج تاس را تا سه بار می‌ریزید و بعد یکی از توانایی‌هایی را که ترکیب تاس‌ها می‌سازد اجرا می‌کنید.',
    steps: [
      { instructionFa: 'نوبت اول همیشه با ریختن هر پنج تاس شروع می‌شود. «ریختن تاس‌ها» را بزنید.', expected: { type: 'roll', keep: [false, false, false, false, false] }, reply: null },
      { instructionFa: 'دو مشت آمد. «ضربهٔ گیج‌کننده» سه مشت می‌خواهد. دو مشت را نگه دارید (تاس‌های نگه‌داشته علامت خورده‌اند) و سه تاس دیگر را دوباره بریزید؛ هنوز دو ریختن دارید.', expected: { type: 'roll', keep: [true, true, false, false, false] }, reply: null },
      { instructionFa: 'سه مشت! لازم نیست ریختن سوم را مصرف کنید. «ضربهٔ گیج‌کننده» (۵ آسیب و گیجی) را بزنید. این حمله دفاع‌پذیر است، پس حریف تاس‌های دفاعش را می‌ریزد.', expected: { type: 'attack', ability: 2 }, reply: { type: 'defend' } },
      { instructionFa: 'نگهبان با دو تاس دفاع کرد: کلاه‌خود ⛨ سپر داد و ۳ آسیب را خنثی کرد (۵ − ۳ = ۲) و قلب ♥ ۱ جان برگرداند؛ جانش ۱۴ شد. ولی گیج شد و نوبتش سوخت، پس دوباره نوبت شماست و ۱ امتیاز رزم هم گرفتید (حالا ۳). هر پنج تاس را بریزید.', expected: { type: 'roll', keep: [false, false, false, false, false] }, reply: null },
      { instructionFa: 'سه مشت آمد. «خشم کوهستان»، توانایی نهایی، پنج مشت می‌خواهد و دفاع‌ناپذیر است. سه مشت را نگه دارید و دو تاس دیگر را بریزید.', expected: { type: 'roll', keep: [true, true, false, false, true] }, reply: null },
      { instructionFa: 'چهار مشت! این ریختن سوم و آخر نوبت است: چهار مشت را نگه دارید و تاس باقی‌مانده را بریزید.', expected: { type: 'roll', keep: [true, true, true, false, true] }, reply: null },
      { instructionFa: 'قلب آمد و ریختن‌ها تمام شد؛ ولی با ۲ امتیاز رزم یک ریختن اضافه می‌خرید. «ریختن اضافه» را بزنید (همان چهار مشت نگه داشته می‌شوند).', expected: { type: 'roll', keep: [true, true, true, false, true] }, reply: null },
      { instructionFa: 'پنج مشت! «خشم کوهستان» (۱۴ آسیب، دفاع‌ناپذیر) را بزنید؛ حریف حتی تاس دفاع هم نمی‌ریزد.', expected: { type: 'attack', ability: 4 }, reply: null }
    ],
    completedFa: 'بردید! ضربهٔ گیج‌کننده ۵ آسیب داشت؛ سپر نگهبان ۳ تا را خنثی کرد و قلبش ۱ جان برگرداند، پس جانش از ۱۵ به ۱۴ رسید و نوبتش هم با گیجی سوخت. در نوبت دوم با سه ریختن و یک ریختن اضافه (۲ امتیاز رزم از ۳ امتیازتان) پنج مشت جمع کردید و «خشم کوهستان» دفاع‌ناپذیر ۱۴ جان باقی‌ماندهٔ او را تمام کرد.'
  }
};
