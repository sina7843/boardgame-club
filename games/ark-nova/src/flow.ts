// Ark Nova turn flow: the turn prompt, the 5 actions (both sides), Multiplier repetitions, end of turn (Venom, display),
// the break, the end trigger and final scoring. Everything is driven by the step queue: `settle` runs system steps and
// stops at the first prompt that has a legal answer.
import type { EngineRng } from '@bg/game-sdk';
import {
  ACTION_FA, ANIMAL, BONUS_FA, MAX_CP, adjacentTerrain, vacateFor, KIND_FA, PROJECT, REG, UNI_FA, ICON_FA, advanceBreak, animalLabel, animalOptions, animalValue, appealIncome,
  ask, bonusFa, build, canPlaceKind, crossed, ctx, discardFromHand, displayFolders, donationCost, drawDeck, emit, flush, gain, gainBonus,
  handLimit, hireWorker, inRange, isSpecial, isSponsor, isStandard, kindSize, later, log, mapOf, nameOf, P, partnerOptions, placeError, placements,
  playAnimal, playSponsor, projectLabel, projectOptions, projectValue, qany, qsum, refillDisplay, reveal, runFx, seatsFrom, sponsorError,
  sponsorLevel, strengthOf, supportProject, takeDisplay, takePartner, takeUni, target, toSlot1, uniOptions, type AnimalOpt, type ProjectOpt
} from './core.ts';
import { around } from './hex.ts';
import { ACTION_KEYS, CONTINENTS, UNIS, type ActionKey, type Answer, type AssocTask, type Ctx, type Prompt, type State } from './types.ts';

const fx = REG.fx;
const opt = (value: string, label: string) => ({ value, label });

// ---------------- Bonus tiles (conservation spaces 5 and 8) ----------------
export const TILES: Record<string, { nameFa: string; can?: (c: Ctx) => boolean; gain: (c: Ctx) => void }> = {
  rep2: { nameFa: '۲ اعتبار', gain: (c) => gain(c, 'rep', 2) },
  money10: { nameFa: '۱۰ پول', gain: (c) => gain(c, 'money', 10) },
  enc3: { nameFa: 'محوطهٔ ۳ خانهٔ رایگان', gain: (c) => gainBonus(c, { k: 'enclosure', n: 3 }) },
  mult: { nameFa: 'نشان دوبرابرکننده روی هر کارت کنش', gain: (c) => gainBonus(c, { k: 'multiplier' }) },
  x3: { nameFa: '۳ نشان X', gain: (c) => gain(c, 'x', 3) },
  card3: { nameFa: '۳ کارت از محدودهٔ اعتبار یا دسته', gain: (c) => gainBonus(c, { k: 'card', n: 3 }) },
  uni: { nameFa: 'یک دانشگاه', can: (c) => uniOptions(c).length > 0, gain: (c) => gainBonus(c, { k: 'uni' }) },
  partner: { nameFa: 'یک باغ‌وحش همکار', can: (c) => partnerOptions(c).length > 0, gain: (c) => gainBonus(c, { k: 'partner' }) },
  sponsor: { nameFa: 'بازی یک حامی از دست با پرداخت پول به اندازهٔ سطحش', gain: (c) => gainBonus(c, { k: 'sponsor' }) }
};

// ---------------- Action tables ----------------
const CARDS_TABLE = { I: [[1, 1], [1, 0], [2, 1], [2, 0], [3, 1]], II: [[1, 0], [2, 1], [2, 0], [3, 1], [4, 1]] } as const;
export const cardsTable = (str: number, up: boolean) => CARDS_TABLE[up ? 'II' : 'I'][Math.min(5, Math.max(1, str)) - 1]!;
export const animalMax = (str: number, up: boolean) => (up ? [1, 1, 2, 2, 2] : [0, 1, 1, 1, 2])[Math.min(5, Math.max(1, str)) - 1]!;
const TASK_VALUE: Record<AssocTask, number> = { rep: 2, zoo: 3, uni: 4, project: 5 };
export const taskValue = (c: Ctx, t: AssocTask) => Math.max(1, TASK_VALUE[t] - (t === 'project' ? qsum(c, 'projectStrength') : 0));
/** Workers needed for a task: 1, or 2 if one of yours is already there; impossible once 3 are there. */
export function workersNeeded(s: State, seat: number, t: AssocTask): number {
  const mine = s.assoc[t].filter((k) => k === seat).length;
  return mine === 0 ? 1 : mine < 3 ? 2 : 99;
}

// ---------------- Option builders (also used by canDo) ----------------
export function buildKinds(c: Ctx, remaining: number, up: boolean, built: string[], first: boolean, extraUsed: boolean): string[] {
  const p = P(c);
  const extra = !extraUsed && qany(c, 'extraBuild');
  const kinds = ['e1', 'e2', 'e3', 'e4', 'e5', 'kiosk', 'pavilion', 'pz', ...(up ? ['rh', 'ba'] : [])];
  return kinds.filter((k) => {
    const size = kindSize(k);
    const again = built.includes(k);
    if (again && !(extra && k !== 'pz' && k !== 'rh' && k !== 'ba')) return false;
    if (!again && (size > remaining || (!up && !first))) return false;
    return 2 * size <= p.money && canPlaceKind(c, k, up);
  });
}
interface AssocState { strength: number; up: boolean; tasks: AssocTask[]; levels: number }
export function assocOptions(c: Ctx, a: AssocState): { value: string; label: string }[] {
  const s = c.s;
  const p = P(c);
  const left = a.strength - a.levels;
  const ok = (t: AssocTask) => !a.tasks.includes(t) && (a.up || !a.tasks.length) && taskValue(c, t) <= left && p.workers >= workersNeeded(s, c.seat, t);
  const out: { value: string; label: string }[] = [];
  if (ok('rep')) out.push(opt('rep', 'افزایش ۲ اعتبار'));
  if (ok('zoo')) for (const z of partnerOptions(c, a.up)) out.push(opt(`zoo:${z}`, `باغ‌وحش همکار ${ICON_FA[z]}`));
  if (ok('uni')) for (const u of uniOptions(c)) out.push(opt(`uni:${u}`, UNI_FA[u]));
  if (ok('project')) for (const o of projectOptions(c, a.up)) out.push(opt(projectValue(o), projectLabel(o)));
  return out;
}
export function sponsorOptions(c: Ctx, budget: number, up: boolean): { value: string; label: string }[] {
  const p = P(c);
  const out: { value: string; label: string }[] = [];
  const srcs: [number, number][] = p.hand.map((id) => [id, 0]);
  if (up) for (const f of inRange(c)) srcs.push([c.s.display[f - 1]!, f]);
  for (const [id, f] of srcs) {
    if (!isSponsor(id) || sponsorLevel(c, id) > budget || p.money < f || sponsorError(c, id, up)) continue;
    out.push(opt(`sp:${id}:${f}`, `${nameOf(id)} (سطح ${sponsorLevel(c, id)})${f ? ` — ویترین ${f}، ${f} پول` : ''}`));
  }
  return out;
}
/** Can this action do anything at this strength? ("You may not do nothing.") */
export function canDo(c: Ctx, card: ActionKey, str: number, up: boolean): boolean {
  const s = c.s;
  switch (card) {
    case 'cards': return s.deck.length + s.discard.length + displayFolders(s).length > 0;
    case 'build': return buildKinds(c, str, up, [], true, false).length > 0;
    case 'animals': return animalMax(str, up) > 0 && animalOptions(c, up, up).length > 0;
    case 'association': return assocOptions(c, { strength: str, up, tasks: [], levels: 0 }).length > 0;
    case 'sponsors': return true;
  }
}

// ---------------- Turn prompt ----------------
export interface TurnData { label: string; extra: boolean; cards?: ActionKey[]; from?: number; optional?: boolean }
export function turnOptions(c: Ctx, d: TurnData): { value: string; label: string }[] {
  const s = c.s;
  const p = P(c);
  const owner = d.from ?? c.seat;
  const o = s.players[owner]!;
  const out: { value: string; label: string }[] = [];
  for (const card of o.slots) {
    if (d.cards && !d.cards.includes(card)) continue;
    const base0 = strengthOf(o, card);
    for (let x = 0; x <= p.x; x++) {
      const str = base0 + x;
      if (str < 1 || !canDo(c, card, str, o.up[card])) continue;
      out.push(opt(`a:${card}:${x}`, `${ACTION_FA[card]}${o.up[card] ? ' II' : ''} با قدرت ${str}${x ? ` (${x} نشان X)` : ''}`));
    }
    if (d.from === undefined && !d.cards && p.x < 5) out.push(opt(`x:${card}`, `کنش نشان X با کارت ${ACTION_FA[card]}`));
  }
  const t = REG.maps.get(p.map)?.turn;
  if (!d.extra && t && !s.turnUsed.includes(t.key) && t.can(c)) out.push(opt('ability', t.labelFa));
  return out;
}
fx['core:turnPrompt'] = (c, d: TurnData) => ask.option(c, { options: turnOptions(c, d), label: d.label, fx: 'core:turn', data: d, ...(d.optional ? { optional: true } : {}) });
fx['core:turn'] = (c, d: TurnData, ans) => {
  if (ans.skip) return;
  const s = c.s;
  const v = ans.value!;
  if (v === 'ability') {
    const t = mapOf(P(c)).turn!;
    s.turnUsed.push(t.key);
    t.run(c);
    later(c, 'core:turnPrompt', d);
    return;
  }
  if (!d.extra) s.inTurn = true;
  const [kind, card, x] = v.split(':') as [string, ActionKey, string];
  const owner = d.from ?? c.seat;
  const o = s.players[owner]!;
  if (o.tok[card].venom) { o.tok[card].venom = 0; s.venomCleared = true; }
  if (kind === 'x') {
    // A card with Multiplier tokens gives 1 X-token per action (FAQ: «take 2 X-tokens from a card with a x2 token»).
    const extra = owner === c.seat ? o.tok[card].mult : 0;
    o.tok[card].mult -= extra;
    gain(c, 'x', 1 + extra);
    toSlot1(o, card);
    log(c, 'xtoken', { card });
    return;
  }
  const spent = Number(x);
  const base0 = strengthOf(o, card);
  P(c).x -= spent;
  // Every Multiplier token on the card gives one repetition (FAQ: 2 tokens = up to 3 actions); none on another player's card.
  const mult = owner === c.seat ? o.tok[card].mult : 0;
  o.tok[card].mult -= mult;
  s.act = {
    seat: c.seat, card, owner, strength: base0 + spent, base: base0, up: o.up[card], count: 0, kinds: [], tasks: [], donated: false, levels: 0,
    extraUsed: false, small: true, mult, after: []
  };
  log(c, 'action', { card, strength: base0 + spent });
  emit(s, c.rng, { t: 'action', seat: c.seat, card, strength: base0 + spent });
  later(c, 'core:rep');
};
/** Start the next repetition of the current action. */
fx['core:rep'] = (c) => {
  const a = c.s.act!;
  if (a.card === 'cards') advanceBreak(c, 2);
  if (a.card === 'animals' && a.up && a.strength >= 5) ask.option(c, { options: [opt('rep', '+۱ اعتبار در آغاز کنش')], label: 'اعتبار اضافه', fx: 'core:animalRep', optional: true });
  later(c, `core:${a.card}Step`);
};
fx['core:repeat'] = (c, _d, ans) => {
  const a = c.s.act!;
  if (ans.skip) return;
  const x = Number(ans.value!.slice(1));
  P(c).x -= x;
  Object.assign(a, { strength: a.base + x, count: 0, kinds: [], tasks: [], donated: false, levels: 0, extraUsed: false, small: true });
  later(c, 'core:rep');
};
fx['core:abilityAfter'] = (c, d: { k: keyof typeof REG.abilities; v: string | number | null }) => REG.abilities[d.k]?.after?.(c, d.v);

// ---------------- Cards ----------------
fx['core:cardsStep'] = (c) => {
  const a = c.s.act!;
  const [draw] = cardsTable(a.strength, a.up);
  const options: { value: string; label: string }[] = [];
  if (c.s.deck.length + c.s.discard.length) options.push(opt('deck', a.up ? 'کشیدن ۱ کارت از دسته' : `کشیدن ${draw} کارت از دسته`));
  if (a.up) for (const f of inRange(c)) options.push(opt(`f${f}`, `برداشتن ${nameOf(c.s.display[f - 1]!)} از ویترین ${f}`));
  if (a.count === 0 && a.strength >= (a.up ? 3 : 5)) for (const f of displayFolders(c.s)) options.push(opt(`s${f}`, `قاپیدن ${nameOf(c.s.display[f - 1]!)} (ویترین ${f})`));
  if (options.length) ask.option(c, { options, label: a.up ? `کارت ${a.count + 1} از ${draw}` : 'کنش کارت‌ها', fx: 'core:cards' });
  else later(c, 'core:cardsDiscard');
};
fx['core:cards'] = (c, _d, ans) => {
  const a = c.s.act!;
  const [draw] = cardsTable(a.strength, a.up);
  const v = ans.value!;
  if (v.startsWith('s')) { takeDisplay(c, Number(v.slice(1))); log(c, 'snap'); return; }
  if (v === 'deck') { const n = a.up ? 1 : draw; drawDeck(c, n); a.count += n; }
  else { takeDisplay(c, Number(v.slice(1))); a.count += 1; }
  if (a.up && a.count < draw) later(c, 'core:cardsStep');
  else later(c, 'core:cardsDiscard');
};
fx['core:cardsDiscard'] = (c) => {
  const a = c.s.act!;
  const [, n] = cardsTable(a.strength, a.up);
  if (n) ask.pick(c, { ids: [...P(c).hand], min: n, max: n, label: `${n} کارت دور بریزید`, fx: 'core:discard' });
};
fx['core:discard'] = (c, _d, ans) => { discardFromHand(c, ans.ids ?? []); };

// ---------------- Build ----------------
fx['core:buildStep'] = (c) => {
  const a = c.s.act!;
  const kinds = buildKinds(c, a.strength - a.levels, a.up, a.kinds, a.count === 0, a.extraUsed);
  if (!kinds.length) return;
  ask.place(c, { kinds, free: false, optional: a.count > 0, label: a.count ? 'ساختمان بعدی (اختیاری)' : 'یک ساختمان بسازید', fx: 'core:build', upgraded: a.up });
};
fx['core:build'] = (c, _d, ans) => {
  if (ans.skip) return;
  const a = c.s.act!;
  const kind = ans.kind!;
  const size = kindSize(kind);
  if (a.kinds.includes(kind)) a.extraUsed = true; else { a.kinds.push(kind); a.levels += size; }
  a.count += 1;
  gain(c, 'money', -2 * size);
  build(c, kind, ans.cells!, false);
  if (kind === 'rh' || kind === 'ba') later(c, 'core:moveAnimals', kind);
  later(c, 'core:buildStep');
};
/** Reptile House / Large Bird Aviary: animals may move in once, freeing their standard enclosures. */
fx['core:moveAnimals'] = (c, kind: string) => {
  const p = P(c);
  const ids = p.zoo.filter((id) => ANIMAL[id]?.sp?.k === kind);
  ask.pick(c, { ids, min: 0, max: ids.length, label: `حیوانات منتقل‌شونده به ${KIND_FA[kind]}`, fx: 'core:moved', data: kind, optional: true, open: true });
};
fx['core:moved'] = (c, kind: string, ans) => {
  const p = P(c);
  const home = p.buildings.find((b) => b.kind === kind)!;
  const terr = qany(c, 'coverTerrain');
  for (const id of ans.ids ?? []) {
    const an = ANIMAL[id]!;
    // The special enclosure must have room and meet the animal's rock/water needs too; then its standard enclosure is freed.
    if (5 - (home.used ?? 0) < an.sp!.n) continue;
    if (!terr && (adjacentTerrain(p, home.cells, 'rock') < an.rock || adjacentTerrain(p, home.cells, 'water') < an.water)) continue;
    if (!vacateFor(c, an)) continue;
    home.used = (home.used ?? 0) + an.sp!.n;
  }
};
/** Default continuation of `ask.place`: pay 2 per space unless free, then build. */
fx['core:placed'] = (c, d: { free: boolean }, ans) => {
  if (ans.skip) return;
  if (!d.free) gain(c, 'money', -2 * kindSize(ans.kind!));
  build(c, ans.kind!, ans.cells!, d.free);
};

// ---------------- Animals ----------------
fx['core:animalRep'] = (c, _d, ans) => { if (!ans.skip) gain(c, 'rep', 1); };
fx['core:animalsStep'] = (c) => {
  const a = c.s.act!;
  if (a.count >= animalMax(a.strength, a.up)) return;
  const os = animalOptions(c, a.up, a.up);
  ask.option(c, { options: os.map((o) => opt(animalValue(o), animalLabel(c, o))), label: a.count ? 'حیوان بعدی (اختیاری)' : 'یک حیوان بازی کنید', fx: 'core:animal', optional: a.count > 0 });
};
fx['core:animal'] = (c, _d, ans) => {
  if (ans.skip) return;
  const a = c.s.act!;
  const o = animalOptions(c, a.up, a.up).find((x) => animalValue(x) === ans.value)!;
  playAnimal(c, o);
  later(c, 'core:animalsStep');
};

// ---------------- Association ----------------
fx['core:associationStep'] = (c) => {
  const a = c.s.act!;
  if (!a.up && a.count) return;
  const options = assocOptions(c, a);
  if (a.up && a.count && !a.donated && P(c).money >= donationCost(c.s)) options.push(opt('donate', `اهدای ${donationCost(c.s)} پول (+۱ حفاظت)`));
  ask.option(c, { options, label: a.count ? 'کار انجمن بعدی (اختیاری)' : 'یک کار انجمن', fx: 'core:assoc', optional: a.count > 0 });
};
fx['core:assoc'] = (c, _d, ans) => {
  if (ans.skip) return;
  const s = c.s;
  const a = s.act!;
  const p = P(c);
  const v = ans.value!;
  if (v === 'donate') {
    gain(c, 'money', -donationCost(s));
    s.donations += 1; a.donated = true;
    log(c, 'donate');
    gain(c, 'cp', 1);
    later(c, 'core:associationStep');
    return;
  }
  const task: AssocTask = v === 'rep' ? 'rep' : v.startsWith('zoo') ? 'zoo' : v.startsWith('uni') ? 'uni' : 'project';
  const need = workersNeeded(s, c.seat, task);
  p.workers -= need;
  for (let i = 0; i < need; i++) s.assoc[task].push(c.seat);
  a.tasks.push(task); a.levels += taskValue(c, task); a.count += 1;
  if (task === 'rep') { gain(c, 'rep', 2); log(c, 'rep'); }
  else if (task === 'zoo') takePartner(c, v.slice(4) as never);
  else if (task === 'uni') takeUni(c, v.slice(4) as never);
  else {
    const o = projectOptions(c, a.up).find((x) => projectValue(x) === v)!;
    supportProject(c, o);
  }
  later(c, 'core:associationStep');
};

// ---------------- Sponsors ----------------
fx['core:sponsorsStep'] = (c) => {
  const a = c.s.act!;
  if (!a.up && a.count) return;
  const budget = a.up ? a.strength + 1 - a.levels : a.strength;
  const options = sponsorOptions(c, budget, a.up);
  if (!a.count) options.push(opt('break', `پیشروی ${a.strength} خانه در مسیر استراحت و ${a.up ? 2 * a.strength : a.strength} پول`));
  ask.option(c, { options, label: a.count ? 'حامی بعدی (اختیاری)' : 'یک حامی بازی کنید یا پول بگیرید', fx: 'core:sponsor', optional: a.count > 0 });
};
fx['core:sponsor'] = (c, _d, ans) => {
  if (ans.skip) return;
  const a = c.s.act!;
  if (ans.value === 'break') {
    advanceBreak(c, a.strength);
    gain(c, 'money', a.up ? 2 * a.strength : a.strength);
    log(c, 'sponsorBreak', { n: a.strength });
    return;
  }
  const [, id, f] = ans.value!.split(':').map(Number) as [number, number, number];
  a.levels += sponsorLevel(c, id); a.count += 1;
  playSponsor(c, id, f);
  later(c, 'core:sponsorsStep');
};

// ---------------- Bonus prompts ----------------
fx['core:upgrade'] = (c) => {
  const p = P(c);
  ask.option(c, { options: ACTION_KEYS.filter((k) => !p.up[k]).map((k) => opt(k, `ارتقای ${ACTION_FA[k]}`)), label: 'یک کارت کنش را ارتقا دهید', fx: 'core:upgraded' });
};
fx['core:upgraded'] = (c, _d, ans) => { P(c).up[ans.value as ActionKey] = true; log(c, 'upgrade', { card: ans.value }); };
fx['core:snap'] = (c) => {
  ask.option(c, { options: displayFolders(c.s).map((f) => opt(String(f), `${nameOf(c.s.display[f - 1]!)} (ویترین ${f})`)), label: 'یک کارت از ویترین بردارید', fx: 'core:snapped' });
};
fx['core:snapped'] = (c, _d, ans) => { takeDisplay(c, Number(ans.value)); };
fx['core:card1'] = (c) => {
  const options = inRange(c).map((f) => opt(`f${f}`, `${nameOf(c.s.display[f - 1]!)} (ویترین ${f})`));
  if (c.s.deck.length + c.s.discard.length) options.push(opt('deck', 'کشیدن از دسته'));
  ask.option(c, { options, label: 'یک کارت از محدودهٔ اعتبار یا دسته', fx: 'core:card1ed' });
};
fx['core:card1ed'] = (c, _d, ans) => { if (ans.value === 'deck') drawDeck(c, 1); else takeDisplay(c, Number(ans.value!.slice(1))); };
fx['core:partner'] = (c) => ask.option(c, { options: partnerOptions(c).map((z) => opt(z, `باغ‌وحش همکار ${ICON_FA[z]}`)), label: 'یک باغ‌وحش همکار بگیرید', fx: 'core:partnered' });
fx['core:partnered'] = (c, _d, ans) => takePartner(c, ans.value as never);
fx['core:uni'] = (c) => ask.option(c, { options: uniOptions(c).map((u) => opt(u, UNI_FA[u])), label: 'یک دانشگاه بگیرید', fx: 'core:unied' });
fx['core:unied'] = (c, _d, ans) => takeUni(c, ans.value as never);
fx['core:clever'] = (c) => ask.option(c, { options: P(c).slots.map((k) => opt(k, `${ACTION_FA[k]} به خانهٔ ۱`)), label: 'یک کارت کنش را به خانهٔ ۱ ببرید', fx: 'core:clevered', optional: true });
fx['core:clevered'] = (c, _d, ans) => { if (!ans.skip) toSlot1(P(c), ans.value as ActionKey); };
fx['core:multiplier'] = (c, cards: ActionKey[] | null) =>
  ask.option(c, { options: (cards ?? [...ACTION_KEYS]).map((k) => opt(k, `دوبرابرکننده روی ${ACTION_FA[k]}`)), label: 'نشان دوبرابرکننده را بگذارید', fx: 'core:multiplied' });
fx['core:multiplied'] = (c, _d, ans) => { P(c).tok[ans.value as ActionKey].mult += 1; };
fx['core:sponsorForMoney'] = (c) => {
  const p = P(c);
  const ids = p.hand.filter((id) => isSponsor(id) && !sponsorError(c, id, p.up.sponsors) && p.money >= sponsorLevel(c, id));
  ask.option(c, { options: ids.map((id) => opt(String(id), `${nameOf(id)} — ${sponsorLevel(c, id)} پول`)), label: 'یک حامی از دست با پرداخت پول بازی کنید', fx: 'core:sponsorPaid', optional: true });
};
fx['core:sponsorPaid'] = (c, _d, ans) => {
  if (ans.skip) return;
  const id = Number(ans.value);
  gain(c, 'money', -sponsorLevel(c, id));
  playSponsor(c, id, 0);
};
fx['core:leftToken'] = (c) => {
  const p = P(c);
  const m = mapOf(p);
  const options = p.left.map((on, i) => (on ? opt(String(i), `${bonusFa(m.left[i]!.b)}${m.left[i]!.income ? ' (و در هر استراحت)' : ''}`) : null)).filter((x) => x !== null);
  ask.option(c, { options, label: 'نشان کدام خانهٔ لبهٔ نقشه را برمی‌دارید؟', fx: 'core:leftTaken' });
};
fx['core:leftTaken'] = (c, _d, ans) => {
  const p = P(c);
  const i = Number(ans.value);
  p.left[i] = false;
  gainBonus(c, mapOf(p).left[i]!.b);
};
fx['core:cpMilestone'] = (c, m: number) => {
  const p = P(c);
  const options: { value: string; label: string }[] = [];
  if (m === 2) {
    for (const k of ACTION_KEYS) if (!p.up[k]) options.push(opt(`up:${k}`, `ارتقای ${ACTION_FA[k]}`));
    if (p.hired < 3) options.push(opt('worker', 'یک کارمند انجمن'));
  } else {
    options.push(opt('money', '۵ پول'));
    for (const t of c.s.bonusTiles[m as 5 | 8]) if (TILES[t]!.can?.(c) ?? true) options.push(opt(`tile:${t}`, TILES[t]!.nameFa));
  }
  ask.option(c, { options, label: `پاداش ${m} امتیاز حفاظت`, fx: 'core:cpChoice', data: m });
};
fx['core:cpChoice'] = (c, m: 5 | 8 | 2, ans) => {
  const v = ans.value!;
  if (v === 'worker') hireWorker(c);
  else if (v.startsWith('up:')) P(c).up[v.slice(3) as ActionKey] = true;
  else if (v === 'money') gain(c, 'money', 5);
  else {
    const t = v.slice(5);
    c.s.bonusTiles[m as 5 | 8] = c.s.bonusTiles[m as 5 | 8].filter((x) => x !== t);
    TILES[t]!.gain(c);
  }
};
fx['core:finalDiscard'] = (c) => {
  const p = P(c);
  if (p.finals.length > 1) ask.pick(c, { ids: [...p.finals], min: 1, max: 1, label: 'یک کارت امتیاز پایانی را کنار بگذارید', fx: 'core:finalDiscarded' });
};
fx['core:finalDiscarded'] = (c, _d, ans) => {
  const p = P(c);
  const id = ans.ids![0]!;
  p.finals = p.finals.filter((x) => x !== id);
  c.s.finalsDeck.push(id); // face down under the pile of remaining Final Scoring cards
};

// ---------------- Action end, turn end ----------------
function finishAction(c: Ctx) {
  const s = c.s;
  const a = s.act!;
  const p = P(c);
  if (a.mult > 0) {
    a.mult -= 1;
    const options = Array.from({ length: p.x + 1 }, (_, x) => opt(`x${x}`, `تکرار ${ACTION_FA[a.card]} با قدرت ${a.base + x}${x ? ` (${x} نشان X)` : ''}`))
      .filter((o, x) => canDo(c, a.card, a.base + x, a.up) && o);
    ask.option(c, { options, label: 'دوبرابرکننده: کنش را تکرار می‌کنید؟', fx: 'core:repeat', optional: true });
    return;
  }
  const o = s.players[a.owner]!;
  toSlot1(o, a.card);
  o.tok[a.card].con = 0;
  s.queue.unshift(...a.after);
  s.act = null;
}
function endTurn(c: Ctx) {
  const s = c.s;
  const p = P(c);
  // ponytail: Venom with less than 2 money takes what is left instead of forcing a different action (the rules' undo);
  // add a pre-check in turnOptions if exact fidelity is ever needed.
  if (!s.venomCleared && ACTION_KEYS.some((k) => p.tok[k].venom)) { gain(c, 'money', -2); log(c, 'venom'); }
  refillDisplay(c);
  s.inTurn = false; s.turnsDone += 1; s.turnUsed = []; s.venomCleared = false;
  // Only the active player's counters end the game at the end of a turn; others wait for their own turn or a break (FAQ).
  if (s.endAt === null && crossed(p)) s.endAt = s.turnsDone + s.n - 1;
  if (s.breakDue !== null) { later(ctx(s, s.breakDue, c.rng), 'core:break'); later(c, 'core:afterBreak'); }
  else nextPlayer(c);
}
function nextPlayer(c: Ctx) {
  const s = c.s;
  if (s.endAt !== null && s.turnsDone >= s.endAt) { startFinal(c); return; }
  s.current = (s.current + 1) % s.n;
  beginTurn(ctx(s, s.current, c.rng));
}
export function beginTurn(c: Ctx) { later(c, 'core:turnPrompt', { label: 'کنش این نوبت را انتخاب کنید', extra: false } satisfies TurnData); }

// ---------------- Break ----------------
fx['core:break'] = (c) => {
  for (const k of seatsFrom(c.s, c.seat)) {
    const ck = ctx(c.s, k, c.rng);
    const extra = P(ck).hand.length - handLimit(ck);
    if (extra > 0) ask.pick(ck, { ids: [...P(ck).hand], min: extra, max: extra, label: `استراحت: ${extra} کارت دور بریزید (سقف دست)`, fx: 'core:discard' });
  }
  later(c, 'core:upkeep');
};
fx['core:upkeep'] = (c) => {
  const s = c.s;
  log(c, 'breakRun');
  for (const p of s.players) {
    for (const k of ACTION_KEYS) p.tok[k] = { mult: 0, venom: 0, con: 0 };
    p.workers = 1 + p.hired;
  }
  s.assoc = { rep: [], zoo: [], uni: [], project: [] };
  s.zoosAvail = CONTINENTS.filter((z) => !s.players.every((p) => p.partners.includes(z)));
  s.unisAvail = UNIS.filter((u) => !s.players.every((p) => p.unis.includes(u)));
  for (const i of [0, 1]) { const id = s.display[i]; if (id !== null && id !== undefined) s.discard.push(id); s.display[i] = null; }
  refillDisplay(c);
  for (const k of seatsFrom(s, c.seat)) later(ctx(s, k, c.rng), 'core:income');
};
/** Kiosk income: 1 per adjacent unique building, special enclosure, occupied standard enclosure and pavilion. */
export function kioskIncome(p: State['players'][number]): number {
  let n = 0;
  for (const k of p.buildings.filter((b) => b.kind === 'kiosk')) {
    const adj = new Set(around(k.cells));
    n += p.buildings.filter((b) => b.id !== k.id && b.cells.some((x) => adj.has(x)) && (b.kind === 'pavilion' || isSpecial(b) || b.kind.startsWith('u') || (isStandard(b) && b.full))).length;
  }
  return n;
}
fx['core:income'] = (c) => {
  const p = P(c);
  const m = mapOf(p);
  gain(c, 'money', appealIncome(p.appeal) + kioskIncome(p));
  m.left.forEach((l, i) => { if (l.income && !p.left[i]) gainBonus(c, l.b); });
  for (const id of [...p.zoo]) REG.cards.get(id)?.income?.({ ...c, card: id });
  m.income?.(c);
  later(c, 'core:refill');
};
fx['core:refill'] = (c) => refillDisplay(c);
fx['core:afterBreak'] = (c) => {
  const s = c.s;
  s.brk = 0; s.breakDue = null;
  if (s.endAt === null && s.players.some(crossed)) s.endAt = s.turnsDone + s.n;
  nextPlayer(c);
};

// ---------------- Final scoring ----------------
function startFinal(c: Ctx) {
  const s = c.s;
  if (!s.cp10) for (const k of seatsFrom(s, s.first)) later(ctx(s, k, c.rng), 'core:finalDiscard');
  later(c, 'core:final');
}
export function rank(s: State, seats: number[]) {
  const r = seats.map((seat) => ({ seat, v: s.players[seat]!.appeal - target(s.players[seat]!.cp), t: s.players[seat]!.supported })).sort((a, b) => b.v - a.v || b.t - a.t);
  const out: { seat: number; place: number; score: number }[] = [];
  r.forEach((x, i) => { const q = r[i - 1]; out.push({ seat: x.seat, place: q && q.v === x.v && q.t === x.t ? out[i - 1]!.place : i + 1, score: x.v }); });
  return out;
}
fx['core:final'] = (c) => {
  const s = c.s;
  for (const seat of seatsFrom(s, s.first)) {
    const ck = ctx(s, seat, c.rng);
    const p = P(ck);
    let cp = 0;
    for (const id of p.finals) cp += Math.min(4, Math.max(0, REG.scoring.get(id)?.score(ck) ?? 0));
    p.cp = Math.min(MAX_CP, p.cp + cp);
    for (const id of [...p.zoo]) REG.cards.get(id)?.endgame?.({ ...ck, card: id });
    mapOf(p).endgame?.(ck);
  }
  s.final = s.players.map((p, seat) => ({ seat, vp: p.appeal - target(p.cp), appeal: p.appeal, cp: p.cp, target: target(p.cp) }));
  s.outcome = { placements: rank(s, s.players.map((_, k) => k)), reason: 'score' };
  s.stage = 'over';
  s.queue = [];
  log(c, 'end');
};

// ---------------- The loop ----------------
/** Does this prompt have at least one legal answer? (Prompts without one are skipped.) */
export function hasAnswer(c: Ctx, q: Prompt): boolean {
  if (q.k === 'option') return q.options.length > 0;
  if (q.k === 'pick') return q.ids.length > 0;
  return q.kinds.some((k) => canPlaceKind(c, k, q.upgraded ?? P(c).up.build) && (q.free || 2 * kindSize(k) <= P(c).money));
}
/** Every legal placement for a place prompt. */
export const placeOptions = (c: Ctx, q: Extract<Prompt, { k: 'place' }>) =>
  q.kinds.filter((k) => q.free || 2 * kindSize(k) <= P(c).money).flatMap((kind) => placements(c, kind, q.upgraded ?? P(c).up.build).map((cells) => ({ kind, cells })));
export function answerError(c: Ctx, q: Prompt, a: Answer): string | null {
  if (a.skip) return q.optional ? null : 'NOT_OPTIONAL';
  if (q.k === 'option') return q.options.some((o) => o.value === a.value) ? null : 'BAD_CHOICE';
  if (q.k === 'pick') {
    const ids = a.ids ?? [];
    if (new Set(ids).size !== ids.length || !ids.every((x) => q.ids.includes(x))) return 'BAD_CHOICE';
    return ids.length >= q.min && ids.length <= q.max ? null : 'BAD_COUNT';
  }
  if (!a.kind || !q.kinds.includes(a.kind) || !a.cells) return 'BAD_BUILDING';
  if (!q.free && 2 * kindSize(a.kind) > P(c).money) return 'CANNOT_AFFORD';
  return placeError(c, a.kind, a.cells, q.upgraded ?? P(c).up.build);
}
/** Run system steps and the turn machinery until a prompt waits for a player (or the game is over). */
export function settle(s: State, rng: EngineRng) {
  for (let guard = 0; guard < 100000; guard++) {
    flush(s);
    if (s.outcome) { s.queue = []; return; }
    const head = s.queue[0];
    if (head) {
      const c = ctx(s, head.seat, rng, head.card);
      if (head.k === 'sys') { s.queue.shift(); runFx(c, head.fx, head.data, {}); continue; }
      if (!hasAnswer(c, head)) { s.queue.shift(); continue; }
      return;
    }
    if (s.act) { finishAction(ctx(s, s.act.seat, rng)); continue; }
    if (s.inTurn) { endTurn(ctx(s, s.current, rng)); continue; }
    return;
  }
  throw new Error('ark-nova: runaway step loop');
}
/** Answer the head prompt (validated) and continue. */
export function answer(s: State, rng: EngineRng, a: Answer) {
  const q = s.queue.shift()! as Prompt;
  runFx(ctx(s, q.seat, rng, q.card), q.fx, q.data, a);
  settle(s, rng);
}
export { BONUS_FA, PROJECT, reveal, gainBonus, runFx, type AnimalOpt, type ProjectOpt };
