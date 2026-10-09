// Ark Nova content chunk «sponsors-b»: Sponsor cards 233-242 and 244-264 (31 cards incl. the unique buildings 244-257;
// 243 is in examples.ts).
// API: ./README.md (worked examples in ./examples.ts). Tests: packages/game-engine/test/ark-nova-sponsors-b.test.ts
// Unique building shapes: axial [q, r] offsets from the printed tiles (same axial convention as hex.ts).
import {
  ask, buildingSpaces, categoriesIn, connected, continentsIn, count, coveredCells, gain, icons, isFull, isolated, isSponsor,
  isStandard, later, mapOf, nameOf, P, REG, runFx, sponsorError, sponsorLevel
} from '../core.ts';
import { around, isBorder, neighbors } from '../hex.ts';
import { CATEGORIES, CONTINENTS, type CardDef, type Category, type ContentChunk, type Ctx, type Icon } from '../types.ts';

type Ev = { seat: number; icons: Partial<Record<Icon, number>> };
const n = (e: Ev, i: Icon) => e.icons[i] ?? 0;
const own = (c: Ctx, e: { seat: number }) => e.seat === c.seat;

/** 233-235 Sponsorship: 1 appeal per icon now; income 3/6/9 money for 1-2/3-4/5+ icons. */
const sponsorship = (id: number, i: Category, nameFa: string, iconFa: string): CardDef => ({
  id, nameFa,
  textFa: `به ازای هر نماد ${iconFa} در باغ‌وحش‌تان ۱ جذابیت بگیرید. درآمد هر استراحت: ۱–۲ نماد ${iconFa} ۳ پول، ۳–۴ نماد ۶ پول، ۵+ نماد ۹ پول.`,
  onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, i)),
  income: (c) => { const k = count(c.s, c.seat, i); gain(c, 'money', k >= 5 ? 9 : k >= 3 ? 6 : k >= 1 ? 3 : 0); }
});
/** 236-240: 3 money per icon of the category played into ANY zoo. */
const expert = (id: number, i: Category, nameFa: string, iconFa: string): CardDef => ({
  id, nameFa, textFa: `به ازای هر نماد ${iconFa} که وارد هر باغ‌وحشی (از جمله باغ‌وحش دیگران) می‌شود ۳ پول بگیرید.`,
  on: { icons: (c, e) => gain(c, 'money', 3 * n(e, i)) }
});
/** 244-247: 2 appeal per icon played into your zoo; end: 1 CP for 6+ such icons. */
const twoAppeal = (id: number, i: Icon, nameFa: string, iconFa: string, where: string, shape: [number, number][], terr: { rock?: number; water?: number }): CardDef => ({
  id, nameFa,
  textFa: `سازهٔ یکتا ${where}. به ازای هر نماد ${iconFa} که وارد باغ‌وحش خود می‌کنید ۲ جذابیت. پایان بازی: ۶+ نماد ${iconFa} ۱ امتیاز حفاظت.`,
  building: { nameFa, shape, ...terr },
  on: { icons: (c, e) => { if (own(c, e)) gain(c, 'appeal', 2 * n(e, i)); } },
  endgame: (c) => { if (count(c.s, c.seat, i) >= 6) gain(c, 'cp', 1); }
});

/** Uncovered map spaces of a terrain adjacent to the given cells (241, 242). */
const nearTerrain = (c: Ctx, cells: string[], t: 'rock' | 'water') => {
  const p = P(c);
  const cov = coveredCells(p);
  const set = new Set(mapOf(p)[t].filter((x) => !cov.has(x)));
  return cells.filter((x) => neighbors(x).some((y) => set.has(y))).length;
};
/** Every uncovered terrain space touches a covered space (241, 242 end). */
const allConnected = (c: Ctx, t: 'rock' | 'water') => {
  const p = P(c);
  const cov = coveredCells(p);
  return mapOf(p)[t].filter((x) => !cov.has(x)).every((x) => neighbors(x).some((y) => cov.has(y)));
};
/** 258/259/264: spaces of a list that are connected / isolated. */
const connectedOf = (c: Ctx, cells: string[]) => cells.filter((x) => connected(P(c), x)).length;
const isolatedOf = (c: Ctx, cells: string[]) => cells.filter((x) => isolated(P(c), x)).length;
const native = (id: number, t: 'rock' | 'water', nameFa: string, tFa: string): CardDef => ({
  id, nameFa,
  textFa: `به ازای هر خانهٔ ${tFa} متصل ۱ جذابیت بگیرید. پایان بازی: به ازای هر ۲ خانهٔ ${tFa} جدا ۱ امتیاز حفاظت.`,
  onPlay: (c) => gain(c, 'appeal', connectedOf(c, mapOf(P(c))[t])),
  endgame: (c) => gain(c, 'cp', Math.floor(isolatedOf(c, mapOf(P(c))[t]) / 2))
});
/** 260 end: floor(size / 6) per contiguous group of empty building spaces. */
export function emptyGroups(c: Ctx): number[] {
  const p = P(c);
  const cov = coveredCells(p);
  const empty = new Set(buildingSpaces(p).filter((x) => !cov.has(x)));
  const out: number[] = [];
  for (const start of empty) {
    let size = 0;
    const stack = [start];
    empty.delete(start);
    while (stack.length) {
      const x = stack.pop()!;
      size += 1;
      for (const y of neighbors(x)) if (empty.has(y)) { empty.delete(y); stack.push(y); }
    }
    out.push(size);
  }
  return out;
}
const kinds = (c: Ctx) => categoriesIn(c.s, c.seat) + continentsIn(c.s, c.seat);
type Okapi = { tok: number };
const okapiTokens = (c: Ctx) => (P(c).data[253] as Okapi | undefined)?.tok ?? 3;

const cards: CardDef[] = [
  sponsorship(233, 'bird', 'حمایت مالی: کرکس‌ها', 'پرنده'),
  sponsorship(234, 'predator', 'حمایت مالی: شیرها', 'شکارچی'),
  sponsorship(235, 'herbivore', 'حمایت مالی: فیل‌ها', 'گیاه‌خوار'),
  expert(236, 'primate', 'نخستی‌شناس', 'نخستی'),
  expert(237, 'reptile', 'خزنده‌شناس', 'خزنده'),
  expert(238, 'bird', 'پرنده‌شناس', 'پرنده'),
  expert(239, 'predator', 'کارشناس شکارچیان', 'شکارچی'),
  expert(240, 'herbivore', 'کارشناس گیاه‌خواران', 'گیاه‌خوار'),
  {
    id: 241, nameFa: 'آب‌شناس',
    textFa: 'به ازای هر نماد آب در باغ‌وحش‌تان (روی این کارت و نیازهای آب کارت‌ها) ۱ جذابیت بگیرید. هر بار خانه‌ای کنار یک خانهٔ آب را می‌پوشانید، به ازای هر چنین خانه‌ای ۱ پول. پایان بازی: اگر همهٔ خانه‌های آب متصل باشند ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'appeal', count(c.s, c.seat, 'water')),
    on: { covered: (c, e) => { if (own(c, e)) gain(c, 'money', nearTerrain(c, e.cells, 'water')); } },
    endgame: (c) => { if (allConnected(c, 'water')) gain(c, 'cp', 1); }
  },
  {
    id: 242, nameFa: 'زمین‌شناس',
    textFa: 'به ازای هر ۲ نماد صخره در باغ‌وحش‌تان ۳ جذابیت بگیرید. هر بار خانه‌ای کنار یک خانهٔ صخره را می‌پوشانید، به ازای هر چنین خانه‌ای ۱ پول. پایان بازی: اگر همهٔ خانه‌های صخره متصل باشند ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'appeal', 3 * Math.floor(count(c.s, c.seat, 'rock') / 2)),
    on: { covered: (c, e) => { if (own(c, e)) gain(c, 'money', nearTerrain(c, e.cells, 'rock')); } },
    endgame: (c) => { if (allConnected(c, 'rock')) gain(c, 'cp', 1); }
  },
  twoAppeal(244, 'bird', 'استخر پنگوئن', 'پرنده', 'کنار دست‌کم ۱ خانهٔ آب', [[0, 0], [-1, 0], [1, -1], [1, 0]], { water: 1 }),
  twoAppeal(245, 'water', 'آکواریوم', 'آب', 'کنار دست‌کم ۲ خانهٔ آب', [[0, 0], [-1, 1], [1, 0], [1, 1]], { water: 2 }),
  twoAppeal(246, 'rock', 'تله‌کابین', 'صخره', 'کنار دست‌کم ۲ خانهٔ صخره', [[0, 0], [1, -1], [-1, 1], [-2, 2]], { rock: 2 }),
  twoAppeal(247, 'primate', 'صخرهٔ بابون', 'نخستی', 'کنار دست‌کم ۱ خانهٔ صخره', [[0, 0], [-1, 0], [1, 0], [0, 1]], { rock: 1 }),
  {
    id: 248, nameFa: 'پارک میمون رزوس', textFa: 'سازهٔ یکتا. به ازای هر نماد نخستی که وارد باغ‌وحش خود می‌کنید ۱ نشان X بگیرید (حداکثر ۵ نشان).',
    building: { nameFa: 'پارک میمون رزوس', shape: [[0, 0], [-1, 0], [-2, 1], [1, 0]] },
    on: { icons: (c, e) => { if (own(c, e)) gain(c, 'x', n(e, 'primate')); } }
  },
  {
    id: 249, nameFa: 'کلبهٔ جغد راه‌راه', textFa: 'سازهٔ یکتا. به ازای هر نماد پرنده که وارد باغ‌وحش خود می‌کنید: ۲ کارت از دسته بکشید، ۱ را نگه دارید و دیگری را دور بیندازید (ادراک ۲).',
    building: { nameFa: 'کلبهٔ جغد راه‌راه', shape: [[0, 0], [-1, 0], [1, 0]] },
    on: { icons: (c, e) => { if (own(c, e)) for (let k = 0; k < n(e, 'bird'); k++) REG.abilities.perception?.now?.(c, 2); } }
  },
  {
    id: 250, nameFa: 'مخزن لاک‌پشت دریایی', textFa: 'سازهٔ یکتا کنار دست‌کم ۱ خانهٔ آب. به ازای هر نماد خزنده که وارد باغ‌وحش خود می‌کنید می‌توانید تا ۲ کارت از دست را هر کدام ۴ پول بفروشید (آفتاب‌گیری ۲).',
    building: { nameFa: 'مخزن لاک‌پشت دریایی', shape: [[0, 0], [-1, 0], [1, -1], [0, 1]], water: 1 },
    on: { icons: (c, e) => { if (own(c, e)) for (let k = 0; k < n(e, 'reptile'); k++) REG.abilities.sunbathing?.now?.(c, 2); } }
  },
  {
    id: 251, nameFa: 'نمایشگاه خرس قطبی', textFa: 'سازهٔ یکتا کنار دست‌کم ۱ خانهٔ آب. به ازای هر نماد خرس که وارد هر باغ‌وحشی می‌شود ۲ جذابیت. پایان بازی: ۳–۵ نماد خرس ۱ امتیاز حفاظت، ۶+ نماد ۲.',
    building: { nameFa: 'نمایشگاه خرس قطبی', shape: [[0, 0], [-1, 1], [1, 0], [2, -1]], water: 1 },
    on: { icons: (c, e) => gain(c, 'appeal', 2 * n(e, 'bear')) },
    endgame: (c) => { const k = count(c.s, c.seat, 'bear'); gain(c, 'cp', k >= 6 ? 2 : k >= 3 ? 1 : 0); }
  },
  {
    id: 252, nameFa: 'محوطهٔ کفتار خال‌دار', textFa: 'سازهٔ یکتا کنار دست‌کم ۱ خانهٔ صخره. به ازای هر نماد شکارچی که وارد باغ‌وحش خود می‌کنید: شکارچی X (X = نمادهای شکارچی باغ‌وحش‌تان).',
    building: { nameFa: 'محوطهٔ کفتار خال‌دار', shape: [[0, 0], [-1, 0], [1, -1], [2, -2]], rock: 1 },
    on: {
      icons: (c, e) => {
        if (!own(c, e)) return;
        for (let k = 0; k < n(e, 'predator'); k++) REG.abilities.hunter?.now?.(c, count(c.s, c.seat, 'predator'));
      }
    }
  },
  {
    id: 253, nameFa: 'اصطبل اوکاپی',
    textFa: 'سازهٔ یکتا. ۳ نشان روی این کارت بگذارید. به ازای هر نماد گیاه‌خوار که وارد باغ‌وحش خود می‌کنید می‌توانید ۱ نشان را بردارید و یک حامی از دست را با پرداخت پول به اندازهٔ سطحش بازی کنید (حداکثر ۳ بار در بازی).',
    building: { nameFa: 'اصطبل اوکاپی', shape: [[0, 0], [-2, 1], [-1, 1], [1, 0]] },
    // The card's own herbivore icon counts (its icons event runs before onPlay), so the tokens default to 3.
    onPlay: (c) => { if (P(c).data[253] === undefined) P(c).data[253] = { tok: 3 } satisfies Okapi; },
    on: { icons: (c, e) => { if (own(c, e)) for (let k = 0; k < n(e, 'herbivore'); k++) later(c, 's253:offer'); } }
  },
  {
    id: 254, nameFa: 'مدرسهٔ باغ‌وحش', textFa: 'سازهٔ یکتا روی دست‌کم ۲ خانهٔ مرزی. ۱ اعتبار و ۱ امتیاز حفاظت بگیرید و ۱ کارت از محدودهٔ اعتبار یا دسته بردارید.',
    building: { nameFa: 'مدرسهٔ باغ‌وحش', shape: [[0, 0], [-1, 0], [1, -1]], border: 2 },
    onPlay: (c) => later(c, 'core:card1')
  },
  {
    id: 255, nameFa: 'زمین بازی ماجراجویی', textFa: '۴ جذابیت بگیرید. سازهٔ یکتا کنار دست‌کم ۱ خانهٔ صخره.',
    building: { nameFa: 'زمین بازی ماجراجویی', shape: [[0, 0], [1, 0]], rock: 1 }
  },
  {
    id: 256, nameFa: 'زمین بازی آبی', textFa: '۴ جذابیت بگیرید. سازهٔ یکتا کنار دست‌کم ۱ خانهٔ آب.',
    building: { nameFa: 'زمین بازی آبی', shape: [[0, 0], [1, 0]], water: 1 }
  },
  {
    id: 257, nameFa: 'ورودی جانبی',
    textFa: 'سازهٔ یکتا روی ۲ خانهٔ مرزی؛ لازم نیست کنار سازه‌های دیگر باشد و از این پس می‌توانید کنار آن بسازید. درآمد هر استراحت: به ازای هر سازهٔ کنار آن (جز محوطه‌های استاندارد خالی) ۲ پول. پایان بازی: اگر نقشه کاملاً پوشیده باشد ۵ جذابیت.',
    building: { nameFa: 'ورودی جانبی', shape: [[0, 0], [1, 0]], border: 2, anywhere: true },
    income: (c) => {
      const p = P(c);
      const me = p.buildings.find((b) => b.kind === 'u257');
      if (!me) return;
      const adj = new Set(around(me.cells));
      gain(c, 'money', 2 * p.buildings.filter((b) => b !== me && b.cells.some((x) => adj.has(x)) && !(isStandard(b) && !b.full)).length);
    },
    endgame: (c) => { if (isFull(P(c))) gain(c, 'appeal', 5); }
  },
  native(258, 'water', 'پرندگان دریایی بومی', 'آب'),
  native(259, 'rock', 'مارمولک‌های بومی', 'صخره'),
  {
    id: 260, nameFa: 'دام‌های بومی',
    textFa: 'به ازای هر خانهٔ ساخت مرزی که متصل است ولی پوشیده نیست ۱ جذابیت بگیرید. پایان بازی: به ازای هر ۶ خانهٔ ساخت خالی در هر گروه پیوسته ۱ امتیاز حفاظت (خانه‌های نیازمند ساخت II هم حساب می‌شوند).',
    onPlay: (c) => gain(c, 'appeal', connectedOf(c, buildingSpaces(P(c)).filter(isBorder))),
    endgame: (c) => gain(c, 'cp', emptyGroups(c).reduce((a, g) => a + Math.floor(g / 6), 0))
  },
  {
    id: 261, nameFa: 'بازدیدهای آموزشی مدارس', textFa: '۱ امتیاز حفاظت و ۱ جذابیت بگیرید. پایان بازی: اگر دست‌کم ۵ نماد دستهٔ جانوری (با خرس و باغ‌وحش کودکان) در باغ‌وحش‌تان باشد ۱ امتیاز حفاظت.',
    endgame: (c) => { const ic = icons(c.s, c.seat); if (CATEGORIES.reduce((a, k) => a + ic[k], 0) >= 5) gain(c, 'cp', 1); }
  },
  {
    id: 262, nameFa: 'کاشف',
    textFa: 'به ازای هر نماد قاره یا دستهٔ جانوری متفاوت در باغ‌وحش‌تان ۲ پول بگیرید. هر بار نماد قاره یا دستهٔ جانوری‌ای وارد باغ‌وحش خود می‌کنید که هنوز ندارید، ۱ جذابیت و ۲ پول بگیرید (برای هر نوع نماد یک بار).',
    onPlay: (c) => gain(c, 'money', 2 * kinds(c)),
    on: {
      icons: (c, e) => {
        if (!own(c, e)) return;
        const ic = icons(c.s, c.seat);
        for (const i of [...CATEGORIES, ...CONTINENTS]) if (n(e, i) > 0 && ic[i] === n(e, i)) { gain(c, 'appeal', 1); gain(c, 'money', 2); }
      }
    }
  },
  {
    id: 263, nameFa: 'برنامهٔ حیوانات بزرگ WAZA',
    textFa: 'می‌توانید یک محوطهٔ ۵ خانه رایگان بسازید. هر بار حیوان بزرگ (محوطهٔ ۴ یا ۵ خانه) بازی می‌کنید می‌توانید یکی از شرط‌هایش را نادیده بگیرید (نه نیاز صخره یا آب).',
    onPlay: (c) => ask.place(c, { kinds: ['e5'], free: true, optional: true, label: 'ساخت رایگان محوطهٔ ۵ خانه' }),
    q: { ignoreConditions: (_c, card) => ('size' in card && card.std && card.size >= 4 ? 1 : 0) }
  },
  {
    id: 264, nameFa: 'میمون‌های آزاد دنیای نو',
    textFa: 'به ازای هر خانهٔ متصل دارای پاداش جایگذاری ۱ جذابیت بگیرید. پایان بازی: به ازای هر ۲ خانهٔ جدا دارای پاداش جایگذاری ۱ امتیاز حفاظت.',
    onPlay: (c) => gain(c, 'appeal', connectedOf(c, Object.keys(mapOf(P(c)).bonuses))),
    endgame: (c) => gain(c, 'cp', Math.floor(isolatedOf(c, Object.keys(mapOf(P(c)).bonuses)) / 2))
  }
];

/** Okapi Stable: offer one Sponsor from hand for money equal to its level, paid with one token from the card. */
const okapiIds = (c: Ctx) => {
  const p = P(c);
  return p.hand.filter((id) => isSponsor(id) && !sponsorError(c, id, p.up.sponsors) && p.money >= sponsorLevel(c, id));
};
const fx: ContentChunk['fx'] = {
  's253:offer': (c) => {
    if (okapiTokens(c) <= 0) return;
    ask.option(c, {
      options: okapiIds(c).map((id) => ({ value: String(id), label: `${nameOf(id)} — ${sponsorLevel(c, id)} پول` })),
      label: 'اصطبل اوکاپی: با برداشتن ۱ نشان، یک حامی از دست را با پرداخت پول به اندازهٔ سطحش بازی کنید (اختیاری)',
      fx: 's253:play', optional: true
    });
  },
  's253:play': (c, _d, ans) => {
    if (ans.skip || okapiTokens(c) <= 0) return;
    P(c).data[253] = { tok: okapiTokens(c) - 1 } satisfies Okapi;
    runFx(c, 'core:sponsorPaid', null, ans);
  }
};

export const sponsorsB: ContentChunk = { cards, fx };
