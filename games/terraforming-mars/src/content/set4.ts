// Terraforming Mars content chunk set4: official base cards 107-142 (32 cards; [CE] ones get ce: true).
// Tests: packages/game-engine/test/terraforming-mars-set4.test.ts
import { tagCount, vpPerRes, type CardDef, type Res } from '../api.ts';

/** Sabotage / Hired Raiders: pick one resource, then the (optional) target player. */
const pickRemove = (opts: [Res, number][], steal: boolean): Pick<CardDef, 'resolve'> => ({
  resolve: { pick: (g, a) => { const [res, n] = opts[a.index!]!; g.removeAny(res, n, steal); } }
});

export const set4: CardDef[] = [
  { id: '107', name: 'Media Archives', nameFa: 'آرشیو رسانه‌ها', kind: 'automated', cost: 8, tags: ['earth'], ce: true,
    textFa: 'به ازای هر کارت رویدادی که تاکنون هر بازیکنی بازی کرده ۱ مگاکردیت می‌گیرید.',
    play: (g) => g.gain('mc', g.eventsPlayed()) },
  { id: '108', name: 'Open City', nameFa: 'شهر باز', kind: 'automated', cost: 23, tags: ['city', 'building'], req: { oxygen: { min: 12 } }, vp: 1,
    textFa: 'نیاز: ۱۲٪ اکسیژن. ۱− تولید انرژی، ۴+ تولید مگاکردیت، ۲ گیاه. یک شهر بگذارید.',
    prod: { energy: -1, mc: 4 }, gain: { plants: 2 }, tiles: [{ kind: 'city' }] },
  { id: '109', name: 'Media Group', nameFa: 'گروه رسانه‌ای', kind: 'active', cost: 6, tags: ['earth'], ce: true,
    textFa: 'هر وقت کارت رویدادی بازی کنید ۳ مگاکردیت می‌گیرید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat && e.card.kind === 'event') g.gain('mc', 3); } },
  { id: '110', name: 'Business Network', nameFa: 'شبکهٔ تجاری', kind: 'active', cost: 4, tags: ['earth'], ce: true,
    textFa: '۱− تولید مگاکردیت. کنش: کارت روی دسته را ببینید؛ آن را با ۳ مگاکردیت بخرید یا دور بریزید.',
    prod: { mc: -1 },
    action: {
      run: (g) => {
        const cards = g.look(1);
        if (cards.length) g.prompt({ kind: 'cards', cards, min: 0, max: g.canPay(3) ? 1 : 0, data: { cards }, then: { card: '110', key: 'buy' }, labelFa: 'خرید با ۳ مگاکردیت یا دور ریختن' });
      }
    },
    resolve: {
      buy: (g, a, d) => {
        const buy = a.cards ?? [];
        if (buy.length && g.canPay(3)) { g.pay(3); g.p.hand.push(...buy); } else g.discardCards(d.cards as string[]);
      }
    } },
  { id: '112', name: 'Bribed Committee', nameFa: 'کمیتهٔ رشوه‌گیر', kind: 'event', cost: 7, tags: ['earth'], ce: true, vp: -2,
    textFa: 'رتبهٔ زمین‌سازی‌تان ۲ پله بالا می‌رود.', tr: 2 },
  { id: '113', name: 'Solar Power', nameFa: 'انرژی خورشیدی', kind: 'automated', cost: 11, tags: ['power', 'building'], vp: 1,
    textFa: '۱ تولید انرژی.', prod: { energy: 1 } },
  { id: '114', name: 'Breathing Filters', nameFa: 'فیلترهای تنفسی', kind: 'automated', cost: 11, tags: ['science'], req: { oxygen: { min: 7 } }, vp: 2,
    textFa: 'نیاز: ۷٪ اکسیژن.' },
  { id: '116', name: 'Artificial Lake', nameFa: 'دریاچهٔ مصنوعی', kind: 'automated', cost: 15, tags: ['building'], req: { temperature: { min: -6 } }, vp: 1,
    textFa: 'نیاز: دمای ۶− یا گرم‌تر. یک اقیانوس روی ناحیه‌ای که برای اقیانوس رزرو نشده بگذارید.',
    tiles: [{ kind: 'ocean', rule: 'landOcean' }] },
  { id: '117', name: 'Geothermal Power', nameFa: 'انرژی زمین‌گرمایی', kind: 'automated', cost: 11, tags: ['power', 'building'],
    textFa: '۲ تولید انرژی.', prod: { energy: 2 } },
  { id: '118', name: 'Farming', nameFa: 'کشاورزی', kind: 'automated', cost: 16, tags: ['plant'], req: { temperature: { min: 4 } }, vp: 2,
    textFa: 'نیاز: دمای ۴+ یا گرم‌تر. ۲ تولید مگاکردیت، ۲ تولید گیاه و ۲ گیاه.', prod: { mc: 2, plants: 2 }, gain: { plants: 2 } },
  { id: '119', name: 'Dust Seals', nameFa: 'آب‌بندهای گرد و غبار', kind: 'automated', cost: 2, tags: [], req: { oceans: { max: 3 } }, vp: 1,
    textFa: 'نیاز: حداکثر ۳ اقیانوس.' },
  { id: '120', name: 'Urbanized Area', nameFa: 'ناحیهٔ شهری', kind: 'automated', cost: 10, tags: ['city', 'building'],
    textFa: '۱− تولید انرژی، ۲+ تولید مگاکردیت. شهری کنار دست‌کم ۲ شهر دیگر بگذارید.',
    prod: { energy: -1, mc: 2 }, tiles: [{ kind: 'city', rule: 'twoCities' }] },
  { id: '121', name: 'Sabotage', nameFa: 'خرابکاری', kind: 'event', cost: 1, tags: [], ce: true,
    textFa: 'تا ۳ تیتانیوم، یا تا ۴ فولاد، یا تا ۷ مگاکردیت از یک بازیکن بردارید.',
    play: (g) => g.choose(['تا ۳ تیتانیوم', 'تا ۴ فولاد', 'تا ۷ مگاکردیت'], 'pick'),
    ...pickRemove([['titanium', 3], ['steel', 4], ['mc', 7]], false) },
  { id: '122', name: 'Moss', nameFa: 'خزه', kind: 'automated', cost: 4, tags: ['plant'], req: { oceans: { min: 3 } },
    textFa: 'نیاز: ۳ اقیانوس. ۱ گیاه از دست می‌دهید؛ ۱ تولید گیاه.', gain: { plants: -1 }, prod: { plants: 1 } },
  { id: '123', name: 'Industrial Center', nameFa: 'مرکز صنعتی', kind: 'active', cost: 4, tags: ['building'], ce: true,
    textFa: 'این کاشی را کنار یک شهر بگذارید. کنش: ۷ مگاکردیت بدهید و ۱ تولید فولاد بگیرید.',
    tiles: [{ kind: 'special', rule: 'nextToCity' }], action: { cost: 7, run: (g) => g.prod('steel', 1) } },
  { id: '124', name: 'Hired Raiders', nameFa: 'مزدوران', kind: 'event', cost: 1, tags: [], ce: true,
    textFa: 'تا ۲ فولاد یا تا ۳ مگاکردیت از یک بازیکن بدزدید.',
    play: (g) => g.choose(['تا ۲ فولاد', 'تا ۳ مگاکردیت'], 'pick'),
    ...pickRemove([['steel', 2], ['mc', 3]], true) },
  { id: '125', name: 'Hackers', nameFa: 'هکرها', kind: 'automated', cost: 3, tags: [], ce: true, vp: -1,
    textFa: '۱− تولید انرژی. تولید مگاکردیت یک بازیکن ۲ پله کم می‌شود و تولید مگاکردیت شما ۲ پله بالا می‌رود.',
    prod: { energy: -1, mc: 2 }, anyProd: { res: 'mc', n: 2 } },
  { id: '126', name: 'GHG Factories', nameFa: 'کارخانه‌های گاز گلخانه‌ای', kind: 'automated', cost: 11, tags: ['building'],
    textFa: '۱− تولید انرژی، ۴+ تولید گرما.', prod: { energy: -1, heat: 4 } },
  { id: '127', name: 'Subterranean Reservoir', nameFa: 'مخزن زیرزمینی', kind: 'event', cost: 11, tags: [],
    textFa: 'یک اقیانوس بگذارید.', oceans: 1 },
  { id: '128', name: 'Ecological Zone', nameFa: 'منطقهٔ زیست‌محیطی', kind: 'active', cost: 12, tags: ['animal', 'plant'], resource: 'animal',
    req: { greeneries: 1 }, vp: vpPerRes(2),
    textFa: 'نیاز: یک فضای سبز داشته باشید. این کاشی را کنار یک فضای سبز بگذارید. هر نشان جانور یا گیاه که بازی کنید (این ۲ تا هم) ۱ جانور به این کارت. ۱ امتیاز برای هر ۲ جانور.',
    tiles: [{ kind: 'special', rule: 'nextToGreenery' }],
    onCardPlayed: (g, e) => { if (e.seat === g.seat) g.addRes(tagCount(e.card, 'animal', 'plant')); } },
  { id: '129', name: 'Zeppelins', nameFa: 'زپلین‌ها', kind: 'automated', cost: 13, tags: [], req: { oxygen: { min: 5 } }, vp: 1,
    textFa: 'نیاز: ۵٪ اکسیژن. ۱ تولید مگاکردیت برای هر شهر روی مریخ.',
    prodBox: (g) => g.prod('mc', g.cities({ onMars: true })) },
  { id: '130', name: 'Worms', nameFa: 'کرم‌ها', kind: 'automated', cost: 8, tags: ['microbe'], req: { oxygen: { min: 4 } },
    textFa: 'نیاز: ۴٪ اکسیژن. ۱ تولید گیاه برای هر ۲ نشان میکروب شما (این هم).',
    prodBox: (g) => g.prod('plants', Math.floor(g.tags('microbe') / 2)) },
  { id: '132', name: 'Fusion Power', nameFa: 'انرژی همجوشی', kind: 'automated', cost: 14, tags: ['science', 'building', 'power'], req: { tags: { power: 2 } },
    textFa: 'نیاز: ۲ نشان انرژی. ۳ تولید انرژی.', prod: { energy: 3 } },
  { id: '133', name: 'Symbiotic Fungus', nameFa: 'قارچ همزیست', kind: 'active', cost: 4, tags: ['microbe'], req: { temperature: { min: -14 } },
    textFa: 'نیاز: دمای ۱۴− یا گرم‌تر. کنش: ۱ میکروب به کارت دیگری بیفزایید.',
    action: { can: (g) => g.cardsWith('microbe', { other: true }).length > 0, run: (g) => g.addToCard('microbe', 1, true) } },
  { id: '134', name: 'Extreme-Cold Fungus', nameFa: 'قارچ سرمادوست', kind: 'active', cost: 13, tags: ['microbe'], req: { temperature: { max: -10 } },
    textFa: 'نیاز: دمای ۱۰− یا سردتر. کنش: ۱ گیاه بگیرید یا ۲ میکروب به کارت دیگری بیفزایید.',
    action: {
      run: (g) => {
        if (g.cardsWith('microbe', { other: true }).length) g.choose(['۱ گیاه', '۲ میکروب به کارت دیگر'], 'pick');
        else g.gain('plants', 1);
      }
    },
    resolve: { pick: (g, a) => (a.index === 0 ? g.gain('plants', 1) : g.addToCard('microbe', 2, true)) } },
  { id: '135', name: 'Advanced Ecosystems', nameFa: 'زیست‌بوم‌های پیشرفته', kind: 'automated', cost: 11, tags: ['plant', 'microbe', 'animal'],
    req: { tags: { plant: 1, microbe: 1, animal: 1 } }, vp: 3, textFa: 'نیاز: یک نشان گیاه، یک نشان میکروب و یک نشان جانور.' },
  { id: '136', name: 'Great Dam', nameFa: 'سد بزرگ', kind: 'automated', cost: 12, tags: ['power', 'building'], req: { oceans: { min: 4 } }, vp: 1,
    textFa: 'نیاز: ۴ اقیانوس. ۲ تولید انرژی.', prod: { energy: 2 } },
  { id: '137', name: 'Cartel', nameFa: 'کارتل', kind: 'automated', cost: 8, tags: ['earth'], ce: true,
    textFa: '۱ تولید مگاکردیت برای هر نشان زمین شما (این هم).', prodBox: (g) => g.prod('mc', g.tags('earth')) },
  { id: '138', name: 'Strip Mine', nameFa: 'معدن روباز', kind: 'automated', cost: 25, tags: ['building'],
    textFa: '۲− تولید انرژی، ۲+ تولید فولاد، ۱+ تولید تیتانیوم. اکسیژن ۲ پله بالا می‌رود.',
    prod: { energy: -2, steel: 2, titanium: 1 }, raise: { oxygen: 2 } },
  { id: '139', name: 'Wave Power', nameFa: 'انرژی موج', kind: 'automated', cost: 8, tags: ['power'], req: { oceans: { min: 3 } }, vp: 1,
    textFa: 'نیاز: ۳ اقیانوس. ۱ تولید انرژی.', prod: { energy: 1 } },
  { id: '140', name: 'Lava Flows', nameFa: 'جریان گدازه', kind: 'event', cost: 18, tags: [],
    textFa: 'این کاشی را روی تارسیس تولوس، اسکرائوس، پاوونیس یا آرسیا بگذارید. دما ۲ پله بالا می‌رود.',
    raise: { temperature: 2 }, tiles: [{ kind: 'special', rule: 'volcanic' }] },
  { id: '142', name: 'Mohole Area', nameFa: 'ناحیهٔ موهول', kind: 'automated', cost: 20, tags: ['building'],
    textFa: '۴ تولید گرما. این کاشی را روی ناحیهٔ رزرو اقیانوس بگذارید.',
    prod: { heat: 4 }, tiles: [{ kind: 'special', rule: 'oceanArea' }] }
];
