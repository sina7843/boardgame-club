// Ark Nova content: worked examples by the architect, one of each effect kind. See ./README.md.
// Owns: Map A; abilities sprint, pack, jumping, clever, flock, determination, pettingZoo; sponsors 201 Science Lab,
// 202 Spokesperson, 229 Expert in Small Animals, 243 Meerkat Den; final scoring 1 Large Animal Zoo, 3 Research Zoo.
import {
  ask, animalsIn, count, drawDeck, fromTable, gain, grantAction, later, large, P, small, SCORING_DATA, advanceBreak, abilityValue
} from '../core.ts';
import type { AbilityImpl, AbilityKey, CardDef, ContentChunk, MapDef, ScoringDef } from '../types.ts';

const fa = (n: unknown) => Number(n).toLocaleString('fa-IR');

const abilities: Partial<Record<AbilityKey, AbilityImpl>> = {
  // Immediate effect with a value.
  sprint: { nameFa: 'دونده', textFa: (v) => `${fa(v)} کارت از دسته بکشید.`, now: (c, v) => { drawDeck(c, Number(v)); } },
  // Immediate effect counting icons (the card counts itself: it is already in the zoo).
  pack: { nameFa: 'گله', textFa: () => 'به ازای هر نماد شکارچی در باغ‌وحش‌تان ۱ جذابیت بگیرید.', now: (c) => gain(c, 'appeal', count(c.s, c.seat, 'predator')) },
  jumping: {
    nameFa: 'جهش', textFa: (v) => `نشان استراحت را ${fa(v)} خانه جلو ببرید و ${fa(v)} پول بگیرید.`,
    now: (c, v) => { advanceBreak(c, Number(v)); gain(c, 'money', Number(v)); }
  },
  // "After finishing" effect that asks a question (engine prompt core:clever).
  clever: { nameFa: 'باهوش', textFa: () => 'پس از پایان کنش، می‌توانید هر کارت کنش را به خانهٔ ۱ ببرید.', after: (c) => later(c, 'core:clever') },
  // "After finishing" extra action.
  determination: {
    nameFa: 'اراده', textFa: () => 'پس از پایان کنش، می‌توانید یک کنش دیگر انجام دهید.',
    after: (c) => grantAction(c, { label: 'اراده: یک کنش دیگر (اختیاری)' })
  },
  // A query answered for the animal itself while it is being played (subject `a`).
  flock: {
    nameFa: 'گله‌زی', textFa: () => 'اگر گیاه‌خوار دیگری با محوطهٔ هم‌اندازه یا بزرگ‌تر دارید، این حیوان به محوطه نیاز ندارد.',
    q: {
      noEnclosure: (c, a) => abilityValue(a.id, 'flock') !== undefined &&
        animalsIn(c.s, c.seat).some((o) => o.id !== a.id && o.icons.includes('herbivore') && o.std && o.size >= a.size)
    }
  },
  pettingZoo: {
    nameFa: 'حیوان باغ‌وحش کودکان', textFa: () => 'اولین حیوان باغ‌وحش کودکان ۳، دومی ۶ و سومی ۹ جذابیت می‌دهد.',
    now: (c) => gain(c, 'appeal', 3 * count(c.s, c.seat, 'pet'))
  }
};

const cards: CardDef[] = [
  {
    // Immediate effect + income (each break) + end-game scoring.
    id: 201, nameFa: 'آزمایشگاه علمی',
    textFa: 'هنگام بازی و در درآمد هر استراحت: یک کارت از محدودهٔ اعتبار یا دسته بگیرید. پایان بازی: ۳–۵ نماد پژوهش ۱ حفاظت، ۶+ نماد ۲ حفاظت.',
    onPlay: (c) => later(c, 'core:card1'),
    income: (c) => later(c, 'core:card1'),
    endgame: (c) => { const n = count(c.s, c.seat, 'science'); gain(c, 'cp', n >= 6 ? 2 : n >= 3 ? 1 : 0); }
  },
  {
    // Recurring trigger on icons played into YOUR zoo (counts its own icon when played).
    id: 202, nameFa: 'سخنگو', textFa: 'به ازای هر نماد پژوهش که وارد باغ‌وحش خود می‌کنید ۱ اعتبار بگیرید.',
    on: { icons: (c, e) => { if (e.seat === c.seat) gain(c, 'rep', e.icons.science ?? 0); } }
  },
  {
    // Immediate + passive cost modifier (query).
    id: 229, nameFa: 'کارشناس حیوانات کوچک', textFa: 'به ازای هر حیوان کوچک در باغ‌وحش‌تان ۱ جذابیت. هر حیوان کوچک ۳ پول ارزان‌تر است.',
    onPlay: (c) => gain(c, 'appeal', animalsIn(c.s, c.seat).filter(small).length),
    q: { animalCost: (_c, a) => (small(a) ? -3 : 0) }
  },
  {
    // Unique building (placed by the engine when played) + trigger + end-game.
    id: 243, nameFa: 'لانهٔ میرکت', textFa: 'سازهٔ یکتا کنار دست‌کم ۱ صخره. به ازای هر نماد گیاه‌خوار که وارد باغ‌وحش می‌کنید ۲ جذابیت. پایان بازی: ۶+ نماد گیاه‌خوار ۱ حفاظت.',
    building: { nameFa: 'لانهٔ میرکت', shape: [[0, 0], [-1, 1], [1, 0]], rock: 1 },
    on: { icons: (c, e) => { if (e.seat === c.seat) gain(c, 'appeal', 2 * (e.icons.herbivore ?? 0)); } },
    endgame: (c) => { if (count(c.s, c.seat, 'herbivore') >= 6) gain(c, 'cp', 1); }
  }
];

const scoring: ScoringDef[] = [
  { id: 1, nameFa: 'باغ‌وحش حیوانات بزرگ', textFa: 'حیوانات بزرگ: ۱ → ۱، ۲ → ۲، ۴ → ۳، ۵+ → ۴ حفاظت.', score: (c) => fromTable(SCORING_DATA[1]!.table, animalsIn(c.s, c.seat).filter(large).length) },
  { id: 3, nameFa: 'باغ‌وحش پژوهشی', textFa: 'نمادهای پژوهش: ۳ → ۱، ۴ → ۲، ۵ → ۳، ۶+ → ۴ حفاظت.', score: (c) => fromTable(SCORING_DATA[3]!.table, count(c.s, c.seat, 'science')) }
];

/** Map A: the beginner map (no special ability; a kiosk and an empty 3-space enclosure are printed on it). */
export const MAP_A: MapDef = {
  id: 'A', nameFa: 'نقشهٔ A', textFa: 'نقشهٔ آغازین: یک کیوسک و یک محوطهٔ خالی ۳ خانه از ابتدا ساخته شده‌اند. توانایی ویژه ندارد.',
  water: ['2_1', '2_11', '3_12', '4_1', '5_8', '6_7', '7_0', '8_1', '8_3'],
  rock: ['1_0', '1_2', '1_12', '2_3', '3_0', '5_4', '6_9'],
  upgrade: ['7_12', '8_11'],
  bonuses: {
    '0_1': { k: 'rep', n: 2 }, '0_3': { k: 'x', n: 1 }, '2_5': { k: 'card', n: 1 }, '2_9': { k: 'money', n: 5 }, '3_2': { k: 'money', n: 5 },
    '4_7': { k: 'x', n: 1 }, '5_0': { k: 'x', n: 1 }, '5_6': { k: 'card', n: 1 }, '5_10': { k: 'card', n: 1 }, '7_2': { k: 'worker' },
    '7_10': { k: 'rep', n: 2 }, '8_5': { k: 'money', n: 10 }
  },
  left: [
    { b: { k: 'snap' }, income: true }, { b: { k: 'enclosure', n: 2 }, income: true }, { b: { k: 'money', n: 5 }, income: true },
    { b: { k: 'cp', n: 1 }, income: true }, { b: { k: 'rep', n: 2 }, income: false }, { b: { k: 'money', n: 12 }, income: false },
    { b: { k: 'x', n: 3 }, income: false }
  ],
  partner: { 2: { k: 'upgrade' }, 3: { k: 'worker' }, 4: { k: 'cp', n: 2 } },
  uni: { 2: { k: 'upgrade' }, 3: { k: 'cp', n: 2 } },
  worker: { 3: { k: 'cp', n: 2 } },
  preset: [{ kind: 'kiosk', cells: ['0_7'] }, { kind: 'e3', cells: ['0_9', '0_11', '1_10'] }]
};

// Unused helpers kept out; `ask` and `P` are re-exported for chunk authors who copy these examples.
void ask; void P;

export const examples: ContentChunk = { abilities, cards, scoring, maps: [MAP_A] };
