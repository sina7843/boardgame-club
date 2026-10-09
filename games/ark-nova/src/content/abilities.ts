// Ark Nova content chunk «abilities»: the 23 remaining Animal ability keywords — hunter, boost, action, inventive,
// fullThroated, multiplier, iconic, sunbathing, pouch, resistance, assertion, digging, sponsorMagnet, venom, dominance,
// pilfering, snapping, constriction, hypnosis, scavenging, posturing, perception, peacocking.
// (sprint, pack, jumping, clever, flock, determination, pettingZoo are in examples.ts.)
// API: ./README.md (worked examples in ./examples.ts). Tests: packages/game-engine/test/ark-nova-abilities.test.ts
//
// Interactive abilities (Venom, Constriction, Pilfering, Hypnosis) run in `now`, i.e. before the new animal's printed
// appeal is added, so that appeal never decides who is affected (glossary). Quarantine Lab (225) players are ignored
// entirely ("your counters on the tracks are ignored"), so the effect passes to the next player meeting the criterion.
import {
  ACTION_FA, ICON_FA, P, afterAction, ask, build, count, ctx, discardFromHand, displayFolders, drawDeck, gain, grantAction,
  hireWorker, isAnimal, isSponsor, later, log, nameOf, qany, refillDisplay, reveal, shuffle, toSlot1, toSlot5
} from '../core.ts';
import { type AbilityImpl, type AbilityKey, type ActionKey, type ContentChunk, type Cont, type Continent, type Ctx, type State } from '../types.ts';

const fa = (n: unknown) => Number(n).toLocaleString('fa-IR');
const act = (v: unknown) => ACTION_FA[v as ActionKey] ?? String(v);
const opt = (value: string, label: string) => ({ value, label });
const PRIMATES_PROJECT = 108;

/** Other players that interactive effects may affect: at least 5 appeal and not immune (Quarantine Lab). */
function targets(c: Ctx): number[] {
  return c.s.players.map((_, k) => k).filter((k) => k !== c.seat && c.s.players[k]!.appeal >= 5 && !qany(ctx(c.s, k, c.rng), 'immune'));
}
/** Players leading a track (ties: all of them); you take part in the comparison, so if you lead alone nobody is affected. */
function leaders(c: Ctx, track: 'appeal' | 'cp', min: number): number[] {
  const t = targets(c);
  const val = (k: number) => c.s.players[k]![track];
  const top = Math.max(val(c.seat), ...t.map(val));
  return top < min ? [] : t.filter((k) => val(k) === top);
}
const seatLabel = (s: State, k: number) => `بازیکن ${fa(k + 1)} (${fa(s.players[k]!.appeal)} جذابیت، ${fa(s.players[k]!.cp)} حفاظت)`;
/** Pick one affected player among `seats` (the acting player chooses among ties), then run `fx` with { victim }. */
function chooseVictim(c: Ctx, seats: number[], fx: string, label: string, data: Record<string, unknown> = {}) {
  if (seats.length === 1) later(c, fx, { ...data, victim: seats[0] });
  else if (seats.length > 1) ask.option(c, { options: seats.map((k) => opt(String(k), seatLabel(c.s, k))), label, fx: 'a:victim:chosen', data: { ...data, fx } });
}

/** Keep `keep` of the hidden cards in `ids` (prompt data only, never logged), discard the rest. */
function keepSome(c: Ctx, ids: number[], keep: number, choices: number[], label: string) {
  if (!ids.length) return;
  if (!choices.length) { c.s.discard.push(...ids); return; }
  ask.pick(c, { ids: choices, min: keep, max: keep, label, fx: 'a:keep', data: ids });
}

const impls: Partial<Record<AbilityKey, AbilityImpl>> = {
  hunter: {
    nameFa: 'شکارچی', textFa: (v) => `${fa(v)} کارت رویی دسته را آشکار کنید؛ ۱ کارت حیوان از میان آن‌ها به دست بگیرید و بقیه را دور بریزید (اگر حیوانی نبود همه دور ریخته می‌شوند).`,
    now: (c, v) => {
      const ids: number[] = [];
      for (let i = 0; i < Number(v); i++) { const id = reveal(c); if (id !== null) ids.push(id); }
      keepSome(c, ids, 1, ids.filter(isAnimal), 'شکارچی: ۱ کارت حیوان از کارت‌های آشکارشده بردارید');
    }
  },
  boost: {
    nameFa: 'تقویت', textFa: (v) => `پس از پایان کنش، می‌توانید کارت کنش ${act(v)} را در خانهٔ ۱ یا خانهٔ ۵ بگذارید.`,
    after: (c, v) => ask.option(c, {
      options: [opt('1', `${act(v)} به خانهٔ ۱`), opt('5', `${act(v)} به خانهٔ ۵`)], label: `تقویت: کارت ${act(v)} را جابه‌جا می‌کنید؟`,
      fx: 'a:boost', data: v, optional: true
    })
  },
  action: {
    nameFa: 'کنش', textFa: (v) => `پس از پایان کنش، می‌توانید کنش ${act(v)} را با قدرت خانه‌اش انجام دهید (سپس کارت به خانهٔ ۱ می‌رود).`,
    after: (c, v) => grantAction(c, { cards: [v as ActionKey], label: `کنش اضافه: ${act(v)} (اختیاری)`, optional: true })
  },
  inventive: {
    // The printed value is lossy: 0 marks the two variants, identified by card (411 Bear, 459/464 Primates).
    nameFa: 'مبتکر',
    textFa: (v, card) => (card === 411 ? 'به ازای هر نماد خرس در همهٔ باغ‌وحش‌ها ۱ نشان X بگیرید (حداکثر ۳).'
      : card === 459 || card === 464 ? 'با ۱/۳/۵ نماد نخستی در باغ‌وحش‌تان ۱/۲/۳ نشان X بگیرید.'
      : Number(v) > 0 ? `${fa(v)} نشان X بگیرید.`
      : 'خرس: به ازای هر نماد خرس در همهٔ باغ‌وحش‌ها ۱ نشان X (حداکثر ۳). نخستی: با ۱/۳/۵ نماد نخستی در باغ‌وحش‌تان ۱/۲/۳ نشان X.'),
    now: (c, v) => {
      if (c.card === 411) gain(c, 'x', Math.min(3, c.s.players.reduce((n, _, k) => n + count(c.s, k, 'bear'), 0)));
      else if (c.card === 459 || c.card === 464) { const n = count(c.s, c.seat, 'primate'); gain(c, 'x', n >= 5 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0); }
      else gain(c, 'x', Number(v));
    }
  },
  fullThroated: { nameFa: 'خوش‌صدا', textFa: () => '۱ کارمند انجمن استخدام کنید (اگر همه استخدام شده‌اند اثری ندارد).', now: (c) => hireWorker(c) },
  multiplier: {
    nameFa: 'دوبرابرکننده', textFa: (v) => `۱ نشان دوبرابرکننده روی کارت کنش ${act(v)} بگذارید.`,
    now: (c, v) => { P(c).tok[v as ActionKey].mult += 1; }
  },
  iconic: {
    nameFa: 'حیوان نمادین', textFa: (v) => `به ازای هر نماد ${ICON_FA[v as Continent] ?? v} در همهٔ باغ‌وحش‌ها ۱ جذابیت بگیرید (حداکثر ۸).`,
    now: (c, v) => gain(c, 'appeal', Math.min(8, c.s.players.reduce((n, _, k) => n + count(c.s, k, v as Continent), 0)))
  },
  sunbathing: {
    nameFa: 'آفتاب‌گیری', textFa: (v) => `تا ${fa(v)} کارت از دست را هر کدام ۴ پول بفروشید (دور بریزید).`,
    now: (c, v) => ask.pick(c, { ids: [...P(c).hand], min: 0, max: Number(v), label: `آفتاب‌گیری: تا ${fa(v)} کارت را هر کدام ۴ پول بفروشید`, fx: 'a:sunbathing', optional: true })
  },
  pouch: {
    nameFa: 'کیسه', textFa: (v) => `تا ${fa(v)} کارت از دست را زیر این حیوان بگذارید و به ازای هر کارت ۲ جذابیت بگیرید.`,
    now: (c, v) => ask.pick(c, { ids: [...P(c).hand], min: 0, max: Number(v), label: `کیسه: تا ${fa(v)} کارت زیر حیوان (هر کدام ۲ جذابیت)`, fx: 'a:pouch', optional: true })
  },
  resistance: {
    nameFa: 'مقاومت', textFa: () => '۲ کارت امتیاز پایانی بکشید؛ ۱ را نگه دارید و دیگری را دور بیندازید.',
    now: (c) => {
      const ids = c.s.finalsDeck.splice(0, 2);
      if (ids.length) ask.pick(c, { ids, min: 1, max: 1, label: 'مقاومت: ۱ کارت امتیاز پایانی نگه دارید', fx: 'a:resistance', data: ids });
    }
  },
  assertion: {
    nameFa: 'ادعا', textFa: () => 'از میان پروژه‌های پایهٔ استفاده‌نشده، ۱ پروژه به انتخاب خود به دست بگیرید.',
    now: (c) => ask.pick(c, { ids: [...c.s.baseDeck], min: 1, max: 1, label: 'ادعا: ۱ پروژهٔ پایهٔ استفاده‌نشده به دست بگیرید', fx: 'a:project', optional: true })
  },
  digging: {
    nameFa: 'کندوکاو', textFa: (v) => `تا ${fa(v)} بار: ۱ کارت از ویترین دور بریزید (ویترین فوراً پر می‌شود) یا ۱ کارت از دست دور بریزید و ۱ کارت از دسته بکشید.`,
    now: (c, v) => later(c, 'a:digging', Number(v))
  },
  sponsorMagnet: {
    nameFa: 'آهنربای حامی', textFa: () => 'همهٔ کارت‌های حامی ویترین را (بدون توجه به محدودهٔ اعتبار) به دست بگیرید.',
    now: (c) => {
      c.s.display.forEach((id, i) => { if (id !== null && isSponsor(id)) { P(c).hand.push(id); c.s.display[i] = null; } });
    }
  },
  venom: {
    nameFa: 'زهر', textFa: (v) => `هر بازیکن با جذابیت بیشتر از شما (دست‌کم ۵) روی ${fa(v)} کارت کنش کم‌ارزش‌ترین خانه‌هایش نشان زهر می‌گیرد.`,
    now: (c, v) => {
      const hit = targets(c).filter((k) => c.s.players[k]!.appeal > P(c).appeal);
      for (const k of hit) { const o = c.s.players[k]!; for (const card of o.slots.slice(0, Number(v))) o.tok[card].venom = 1; }
      if (hit.length) log(c, 'venomed', { seats: hit, n: Number(v) });
    }
  },
  dominance: {
    nameFa: 'سلطه', textFa: () => 'اگر پروژهٔ پایهٔ «نخستی‌ها» هنوز در بازی نیست، می‌توانید آن را به دست بگیرید.',
    now: (c) => {
      if (c.s.baseDeck.includes(PRIMATES_PROJECT)) {
        ask.option(c, { options: [opt('take', `برداشتن پروژهٔ ${nameOf(PRIMATES_PROJECT)}`)], label: 'سلطه', fx: 'a:dominance', optional: true });
      }
    }
  },
  pilfering: {
    nameFa: 'دستبرد',
    textFa: (v) => (Number(v) >= 2
      ? 'از باغ‌وحش با بیشترین جذابیت و از باغ‌وحش با بیشترین حفاظت (دست‌کم ۱): ۵ پول بگیرید یا ۱ کارت تصادفی از دستش بکشید؛ انتخاب با اوست.'
      : 'از باغ‌وحش با بیشترین جذابیت: ۵ پول بگیرید یا ۱ کارت تصادفی از دستش بکشید؛ انتخاب با اوست.'),
    now: (c, v) => {
      chooseVictim(c, leaders(c, 'appeal', 5), 'a:pilfer', 'دستبرد: کدام باغ‌وحش با بیشترین جذابیت؟');
      if (Number(v) >= 2) chooseVictim(c, leaders(c, 'cp', 1), 'a:pilfer', 'دستبرد: کدام باغ‌وحش با بیشترین حفاظت؟');
    }
  },
  snapping: {
    nameFa: 'قاپیدن', textFa: (v) => (Number(v) >= 2 ? `${fa(v)} بار: هر کارت دلخواه ویترین را بردارید (می‌توانید در میانه ویترین را پر کنید).` : 'هر کارت دلخواه ویترین را بردارید.'),
    now: (c, v) => { later(c, 'core:snap'); if (Number(v) > 1) later(c, 'a:snapping', Number(v) - 1); }
  },
  constriction: {
    nameFa: 'فشردن', textFa: () => 'هر بازیکن جلوتر از شما در جذابیت و/یا حفاظت (دست‌کم ۵ جذابیت) به ازای هر مسیر ۱ نشان فشردن روی کارت‌های کنش پرارزش‌ترین خانه‌ها (۵، سپس ۴) می‌گیرد.',
    now: (c) => {
      const me = P(c);
      const hit: number[] = [];
      for (const k of targets(c)) {
        const o = c.s.players[k]!;
        const n = (o.appeal > me.appeal ? 1 : 0) + (o.cp > me.cp ? 1 : 0);
        if (!n) continue;
        hit.push(k);
        for (const card of o.slots.slice(5 - n)) o.tok[card].con = 1;
      }
      if (hit.length) log(c, 'constricted', { seats: hit });
    }
  },
  hypnosis: {
    nameFa: 'هیپنوتیزم', textFa: (v) => `پس از پایان کنش، می‌توانید با یکی از کارت‌های کنش خانهٔ ۱ تا ${fa(v)} باغ‌وحش با بیشترین جذابیت (دست‌کم ۵، نه خودتان) یک کنش انجام دهید.`,
    // The target is decided now (this animal's appeal must not count); the action itself comes after finishing.
    now: (c, v) => { const seats = leaders(c, 'appeal', 5); if (seats.length) afterAction(c, 'a:hypnosis', { seats, n: Number(v) }); }
  },
  scavenging: {
    nameFa: 'لاشه‌خواری', textFa: (v) => `کارت‌های دورریخته را بُر بزنید و ${fa(v)} کارت بکشید؛ ۱ را به دست بگیرید و بقیه را دور بریزید.`,
    now: (c, v) => {
      shuffle(c.rng, c.s.discard);
      const ids = c.s.discard.splice(0, Number(v));
      keepSome(c, ids, 1, ids, 'لاشه‌خواری: ۱ کارت نگه دارید');
    }
  },
  posturing: {
    nameFa: 'خودنمایی', textFa: (v) => `تا ${fa(v)} بار: یک کیوسک یا آلاچیق رایگان بسازید (قوانین معمول ساخت).`,
    now: (c, v) => posture(c, Number(v))
  },
  perception: {
    nameFa: 'ادراک', textFa: (v) => `${fa(v)} کارت از دسته بکشید؛ ${fa(Math.max(1, Math.floor(Number(v) / 2)))} کارت را نگه دارید و بقیه را دور بریزید.`,
    now: (c, v) => {
      const ids: number[] = [];
      for (let i = 0; i < Number(v); i++) { const id = reveal(c); if (id !== null) ids.push(id); }
      const keep = Math.max(1, Math.floor(Number(v) / 2));
      keepSome(c, ids, keep, ids, `ادراک: ${fa(keep)} کارت نگه دارید`);
    }
  },
  peacocking: {
    nameFa: 'پرافشانی', textFa: () => 'می‌توانید قفس بزرگ پرندگان را رایگان بسازید، حتی بدون ارتقای کنش ساخت.',
    now: (c) => ask.place(c, { kinds: ['ba'], free: true, optional: true, label: 'پرافشانی: ساخت رایگان قفس بزرگ پرندگان', fx: 'a:peacocking' })
  }
};

function posture(c: Ctx, left: number) {
  ask.place(c, { kinds: ['kiosk', 'pavilion'], free: true, optional: true, label: `خودنمایی: کیوسک یا آلاچیق رایگان (${fa(left)} بار باقی)`, fx: 'a:posturing', data: left });
}

const fx: Record<string, Cont> = {
  'a:victim:chosen': (c, d: { fx: string }, ans) => later(c, d.fx, { ...d, victim: Number(ans.value) }),
  /** The kept card(s) go to the hand, the rest to the discard pile. */
  'a:keep': (c, ids: number[], ans) => {
    const kept = ans.ids ?? [];
    P(c).hand.push(...kept);
    c.s.discard.push(...ids.filter((x) => !kept.includes(x)));
  },
  'a:boost': (c, v: ActionKey, ans) => { if (!ans.skip) (ans.value === '5' ? toSlot5 : toSlot1)(P(c), v); },
  'a:sunbathing': (c, _d, ans) => {
    const ids = (ans.ids ?? []).filter((x) => P(c).hand.includes(x));
    discardFromHand(c, ids);
    gain(c, 'money', 4 * ids.length);
  },
  'a:pouch': (c, _d, ans) => {
    const p = P(c);
    const ids = (ans.ids ?? []).filter((x) => p.hand.includes(x));
    if (!ids.length || c.card === undefined) return;
    p.hand = p.hand.filter((x) => !ids.includes(x));
    p.under[c.card] = [...(p.under[c.card] ?? []), ...ids];
    gain(c, 'appeal', 2 * ids.length);
  },
  'a:resistance': (c, ids: number[], ans) => {
    const keep = ans.ids![0]!;
    P(c).finals.push(keep);
    c.s.finalsDeck.push(...ids.filter((x) => x !== keep));
  },
  'a:project': (c, _d, ans) => {
    const id = ans.ids?.[0];
    if (id === undefined || !c.s.baseDeck.includes(id)) return;
    c.s.baseDeck = c.s.baseDeck.filter((x) => x !== id);
    P(c).hand.push(id);
  },
  'a:dominance': (c, _d, ans) => {
    if (ans.skip || !c.s.baseDeck.includes(PRIMATES_PROJECT)) return;
    c.s.baseDeck = c.s.baseDeck.filter((x) => x !== PRIMATES_PROJECT);
    P(c).hand.push(PRIMATES_PROJECT);
  },
  'a:digging': (c, left: number) => {
    const options = displayFolders(c.s).map((f) => opt(`f${f}`, `دور ریختن ${nameOf(c.s.display[f - 1]!)} از ویترین ${fa(f)}`));
    if (P(c).hand.length) options.push(opt('hand', 'دور ریختن ۱ کارت از دست و کشیدن ۱ کارت از دسته'));
    ask.option(c, { options, label: `کندوکاو (${fa(left)} بار باقی، اختیاری)`, fx: 'a:dug', data: left, optional: true });
  },
  'a:dug': (c, left: number, ans) => {
    if (ans.skip) return;
    if (ans.value === 'hand') { ask.pick(c, { ids: [...P(c).hand], min: 1, max: 1, label: 'کندوکاو: ۱ کارت از دست دور بریزید', fx: 'a:dugHand', data: left }); return; }
    // Discard from the display: the higher folders slide down and the new card goes into folder 6.
    const i = Number(ans.value!.slice(1)) - 1;
    c.s.discard.push(c.s.display[i]!);
    c.s.display.splice(i, 1);
    c.s.display.push(reveal(c));
    if (left > 1) later(c, 'a:digging', left - 1);
  },
  'a:dugHand': (c, left: number, ans) => {
    discardFromHand(c, ans.ids ?? []);
    drawDeck(c, 1);
    if (left > 1) later(c, 'a:digging', left - 1);
  },
  'a:snapping': (c, left: number) => {
    ask.option(c, { options: [opt('refill', 'پر کردن ویترین پیش از برداشتن بعدی')], label: 'قاپیدن: ویترین را پر می‌کنید؟', fx: 'a:snapRefill', data: left, optional: true });
    later(c, 'core:snap');
    if (left > 1) later(c, 'a:snapping', left - 1);
  },
  'a:snapRefill': (c, _d, ans) => { if (!ans.skip) refillDisplay(c); },
  /** Pilfering on one victim: the victim (c.seat) decides; forced choices resolve directly. */
  'a:pilfer': (c, d: { victim: number }) => {
    const v = ctx(c.s, d.victim, c.rng, c.card);
    const p = P(v);
    const data = { thief: c.seat };
    if (p.hand.length && p.money >= 5) {
      ask.option(v, { options: [opt('money', 'دادن ۵ پول'), opt('card', 'کشیدن ۱ کارت تصادفی از دست شما')], label: `دستبرد بازیکن ${fa(c.seat + 1)}: ۵ پول می‌دهید یا ۱ کارت؟`, fx: 'a:pilfered', data });
    } else pilfer(v, data.thief, p.hand.length ? 'card' : 'money');
  },
  'a:pilfered': (c, d: { thief: number }, ans) => pilfer(c, d.thief, ans.value as 'money' | 'card'),
  'a:hypnosis': (c, d: { seats: number[]; n: number }) => chooseVictim(c, d.seats, 'a:hypnotize', 'هیپنوتیزم: کدام باغ‌وحش با بیشترین جذابیت؟', { n: d.n }),
  'a:hypnotize': (c, d: { victim: number; n: number }) => {
    const o = c.s.players[d.victim]!;
    grantAction(c, { from: d.victim, cards: o.slots.slice(0, d.n), label: `هیپنوتیزم: یک کنش با کارت‌های بازیکن ${fa(d.victim + 1)} (اختیاری)`, optional: true });
  },
  'a:posturing': (c, left: number, ans) => {
    if (ans.skip) return;
    build(c, ans.kind!, ans.cells!, true);
    if (left > 1) posture(c, left - 1);
  },
  'a:peacocking': (c, _d, ans) => {
    if (ans.skip) return;
    build(c, 'ba', ans.cells!, true);
    later(c, 'core:moveAnimals', 'ba');
  }
};

/** Victim `v` gives the thief 5 money (or all their money if less) or a random hand card. */
function pilfer(v: Ctx, thief: number, what: 'money' | 'card') {
  const p = P(v);
  const t = ctx(v.s, thief, v.rng);
  if (what === 'card' && p.hand.length) {
    const [id] = p.hand.splice(v.rng.nextInt(p.hand.length), 1);
    P(t).hand.push(id!);
    log(v, 'pilferCard', { thief });
  } else {
    const n = Math.min(5, p.money);
    gain(v, 'money', -n);
    gain(t, 'money', n);
    log(v, 'pilferMoney', { thief, n });
  }
}

export const abilities: ContentChunk = { abilities: impls, fx };
