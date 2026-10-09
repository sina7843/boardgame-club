// Terraforming Mars content chunk set1: official base cards 001-039 (32 cards; [CE] ones get ce: true).
// Tests: packages/game-engine/test/terraforming-mars-set1.test.ts
import { hasTag, vpPerRes, type CardDef, type Ctx } from '../api.ts';

/** Animal cards this player may take from: any player's (unprotected, not Pets-like), not this card, with 1+ animal. */
const animalSources = (g: Ctx) => g.s.players.flatMap((_, k) => (g.isProtected(k) ? [] : g.cardsWith('animal', { seat: k, min: 1 })))
  .filter((id) => id !== g.self && !g.card(id).keepsResources);

/** Regolith Eaters / GHG Producing Bacteria: add 1 microbe, or remove 2 to raise a parameter 1 step. */
const microbeRaise = (param: 'oxygen' | 'temperature', labelFa: string): Pick<CardDef, 'action' | 'resolve'> => ({
  action: { run: (g) => (g.resOn() >= 2 ? g.choose(['۱ میکروب به این کارت', labelFa], 'pick') : g.addRes(1)) },
  resolve: { pick: (g, a) => { if (a.index === 0) g.addRes(1); else { g.addRes(-2); g.raise(param, 1); } } }
});

const IH_OPTS = [['plants', '۳ گیاه'], ['microbe', '۳ میکروب به کارتی دیگر'], ['animal', '۲ جانور به کارتی دیگر']] as const;

export const set1: CardDef[] = [
  { id: '001', name: 'Colonizer Training Camp', nameFa: 'اردوگاه آموزش مهاجران', kind: 'automated', cost: 8, tags: ['jovian', 'building'],
    req: { oxygen: { max: 5 } }, vp: 2, textFa: 'نیاز: اکسیژن حداکثر ۵٪.' },
  { id: '002', name: 'Asteroid Mining Consortium', nameFa: 'کنسرسیوم استخراج سیارک', kind: 'automated', cost: 13, tags: ['jovian'], ce: true,
    req: { prod: { titanium: 1 } }, vp: 1, prod: { titanium: 1 }, anyProd: { res: 'titanium', n: 1 },
    textFa: 'نیاز: تولید تیتانیوم. ۱ پله تولید تیتانیوم یک بازیکن کم و ۱ پله تولید تیتانیوم خودتان زیاد می‌شود.' },
  { id: '004', name: 'Cloud Seeding', nameFa: 'بارورسازی ابرها', kind: 'automated', cost: 11, tags: [], req: { oceans: { min: 3 } },
    prod: { mc: -1, plants: 2 }, anyProd: { res: 'heat', n: 1 },
    textFa: 'نیاز: ۳ اقیانوس. ۱− تولید مگاکردیت شما و ۱− تولید گرمای یک بازیکن؛ ۲+ تولید گیاه.' },
  { id: '005', name: 'Search For Life', nameFa: 'جست‌وجوی حیات', kind: 'active', cost: 3, tags: ['science'], resource: 'science',
    req: { oxygen: { max: 6 } }, vp: (g) => (g.resOn() >= 1 ? 3 : 0),
    textFa: 'نیاز: اکسیژن حداکثر ۶٪. کنش: ۱ مگاکردیت بدهید و کارت رویی دسته را رو کنید؛ اگر نشان میکروب داشت ۱ منبع علمی به این کارت. ۳ امتیاز اگر دست‌کم ۱ منبع علمی دارد.',
    action: { cost: 1, can: (g) => g.s.deck.length + g.s.discard.length > 0, run: (g) => { const c = g.reveal(); if (c && hasTag(g.card(c), 'microbe')) g.addRes(1); } } },
  { id: '006', name: "Inventors' Guild", nameFa: 'انجمن مخترعان', kind: 'active', cost: 9, tags: ['science'], ce: true,
    textFa: 'کنش: کارت رویی دسته را ببینید و یا با ۳ مگاکردیت بخرید یا دور بریزید.',
    action: {
      run: (g) => {
        const cards = g.look(1);
        if (cards.length) g.prompt({ kind: 'cards', cards, min: 0, max: g.canPay(3) ? 1 : 0, data: { cards }, then: { card: '006', key: 'buy' }, labelFa: 'خرید با ۳ مگاکردیت (یا هیچ)' });
      }
    },
    resolve: {
      buy: (g, a, d) => {
        const buy = a.cards ?? [];
        if (buy.length) { g.pay(3); g.p.hand.push(...buy); }
        g.discardCards((d.cards as string[]).filter((c) => !buy.includes(c)));
      }
    } },
  { id: '007', name: 'Martian Rails', nameFa: 'راه‌آهن مریخی', kind: 'active', cost: 13, tags: ['building'],
    textFa: 'کنش: ۱ انرژی خرج کنید و به ازای هر کاشی شهر روی مریخ ۱ مگاکردیت بگیرید.',
    action: { can: (g) => g.p.res.energy >= 1, run: (g) => { g.gain('energy', -1); g.gain('mc', g.cities({ onMars: true })); } } },
  { id: '010', name: 'Comet', nameFa: 'دنباله‌دار', kind: 'event', cost: 21, tags: ['space'], raise: { temperature: 1 }, oceans: 1, removeAny: { res: 'plants', n: 3 },
    textFa: 'دما ۱ پله بالا می‌رود و ۱ اقیانوس بگذارید. تا ۳ گیاه از هر بازیکن بردارید.' },
  { id: '011', name: 'Big Asteroid', nameFa: 'سیارک بزرگ', kind: 'event', cost: 27, tags: ['space'], raise: { temperature: 2 }, gain: { titanium: 4 },
    removeAny: { res: 'plants', n: 4 }, textFa: 'دما ۲ پله بالا می‌رود و ۴ تیتانیوم می‌گیرید. تا ۴ گیاه از هر بازیکن بردارید.' },
  { id: '013', name: 'Space Elevator', nameFa: 'آسانسور فضایی', kind: 'active', cost: 27, tags: ['space', 'building'], ce: true, vp: 2, prod: { titanium: 1 },
    textFa: '۱ تولید تیتانیوم. کنش: ۱ فولاد خرج کنید و ۵ مگاکردیت بگیرید.',
    action: { can: (g) => g.p.res.steel >= 1, run: (g) => { g.gain('steel', -1); g.gain('mc', 5); } } },
  { id: '014', name: 'Development Center', nameFa: 'مرکز توسعه', kind: 'active', cost: 11, tags: ['science', 'building'], ce: true,
    textFa: 'کنش: ۱ انرژی خرج کنید و ۱ کارت بکشید.',
    action: { can: (g) => g.p.res.energy >= 1, run: (g) => { g.gain('energy', -1); g.draw(1); } } },
  { id: '015', name: 'Equatorial Magnetizer', nameFa: 'مغناطیس‌گر استوایی', kind: 'active', cost: 11, tags: ['building'],
    textFa: 'کنش: ۱ پله تولید انرژی خود را کم کنید و ۱ رتبهٔ زمین‌سازی بگیرید.',
    action: { can: (g) => g.p.prod.energy >= 1, run: (g) => { g.prod('energy', -1); g.tr(1); } } },
  { id: '016', name: 'Domed Crater', nameFa: 'دهانهٔ گنبدی', kind: 'automated', cost: 24, tags: ['city', 'building'], req: { oxygen: { max: 7 } }, vp: 1,
    prod: { energy: -1, mc: 3 }, tiles: [{ kind: 'city' }], gain: { plants: 3 },
    textFa: 'نیاز: اکسیژن حداکثر ۷٪. ۱− تولید انرژی، ۳+ تولید مگاکردیت. یک شهر بگذارید و ۳ گیاه بگیرید.' },
  { id: '017', name: 'Noctis City', nameFa: 'شهر نوکتیس', kind: 'automated', cost: 18, tags: ['city', 'building'], prod: { energy: -1, mc: 3 },
    tiles: [{ kind: 'city', rule: 'noctis' }], textFa: '۱− تولید انرژی، ۳+ تولید مگاکردیت. شهر را روی ناحیهٔ ویژهٔ نوکتیس بگذارید.' },
  { id: '018', name: 'Methane From Titan', nameFa: 'متان از تیتان', kind: 'automated', cost: 28, tags: ['jovian', 'space'], req: { oxygen: { min: 2 } }, vp: 2,
    prod: { heat: 2, plants: 2 }, textFa: 'نیاز: ۲٪ اکسیژن. ۲+ تولید گرما و ۲+ تولید گیاه.' },
  { id: '019', name: 'Imported Hydrogen', nameFa: 'هیدروژن وارداتی', kind: 'event', cost: 16, tags: ['earth', 'space'], oceans: 1,
    textFa: '۳ گیاه بگیرید، یا ۳ میکروب یا ۲ جانور به کارتی دیگر بیفزایید. ۱ اقیانوس بگذارید.',
    play: (g) => {
      const opts = IH_OPTS.filter(([k]) => k === 'plants' || g.cardsWith(k).length).map(([k]) => k);
      if (opts.length === 1) g.gain('plants', 3);
      else g.choose(opts.map((k) => IH_OPTS.find(([x]) => x === k)![1]), 'pick', { opts });
    },
    resolve: {
      pick: (g, a, d) => {
        const k = (d.opts as string[])[a.index!];
        if (k === 'microbe') g.addToCard('microbe', 3); else if (k === 'animal') g.addToCard('animal', 2); else g.gain('plants', 3);
      }
    } },
  { id: '020', name: 'Research Outpost', nameFa: 'پایگاه پژوهشی', kind: 'active', cost: 18, tags: ['science', 'city', 'building'],
    tiles: [{ kind: 'city', rule: 'isolatedCity' }], discount: () => 1,
    textFa: 'اثر: هر کارت ۱ مگاکردیت ارزان‌تر. یک شهر بگذارید که کنار هیچ کاشی دیگری نباشد.' },
  { id: '021', name: 'Phobos Space Haven', nameFa: 'پناهگاه فضایی فوبوس', kind: 'automated', cost: 25, tags: ['space', 'city'], vp: 3, prod: { titanium: 1 },
    tiles: [{ kind: 'city', rule: 'phobos' }], textFa: '۱+ تولید تیتانیوم. شهر را روی ناحیهٔ پناهگاه فوبوس (بیرون از مریخ) بگذارید.' },
  { id: '022', name: 'Black Polar Dust', nameFa: 'غبار قطبی سیاه', kind: 'automated', cost: 15, tags: [], prod: { mc: -2, heat: 3 }, oceans: 1,
    textFa: '۲− تولید مگاکردیت، ۳+ تولید گرما. ۱ اقیانوس بگذارید.' },
  { id: '024', name: 'Predators', nameFa: 'شکارچیان', kind: 'active', cost: 14, tags: ['animal'], resource: 'animal', req: { oxygen: { min: 11 } }, vp: vpPerRes(1),
    textFa: 'نیاز: ۱۱٪ اکسیژن. کنش: ۱ جانور از هر کارتی بردارید و به این کارت بیفزایید. ۱ امتیاز برای هر جانور.',
    action: {
      can: (g) => animalSources(g).length > 0,
      run: (g) => g.prompt({ kind: 'card', options: animalSources(g), then: { card: '024', key: 'take' }, labelFa: 'کارتی که از آن جانور برمی‌دارید' })
    },
    resolve: { take: (g, a) => { g.addRes(-1, a.card); g.addRes(1); } } },
  { id: '026', name: 'Eos Chasma National Park', nameFa: 'پارک ملی ائوس کاسما', kind: 'automated', cost: 16, tags: ['plant', 'building'],
    req: { temperature: { min: -12 } }, vp: 1, addCard: { type: 'animal', n: 1 }, gain: { plants: 3 }, prod: { mc: 2 },
    textFa: 'نیاز: دمای ۱۲− یا گرم‌تر. ۱ جانور به یکی از کارت‌هایتان، ۳ گیاه و ۲+ تولید مگاکردیت.' },
  { id: '027', name: 'Interstellar Colony Ship', nameFa: 'فضاپیمای مهاجر میان‌ستاره‌ای', kind: 'event', cost: 24, tags: ['earth', 'space'], ce: true,
    req: { tags: { science: 5 } }, vp: 4, textFa: 'نیاز: ۵ نشان علم.' },
  { id: '028', name: 'Security Fleet', nameFa: 'ناوگان امنیتی', kind: 'active', cost: 12, tags: ['space'], ce: true, resource: 'fighter', vp: vpPerRes(1),
    textFa: 'کنش: ۱ تیتانیوم خرج کنید و ۱ جنگنده به این کارت بیفزایید. ۱ امتیاز برای هر جنگنده.',
    action: { can: (g) => g.p.res.titanium >= 1, run: (g) => { g.gain('titanium', -1); g.addRes(1); } } },
  { id: '029', name: 'Cupola City', nameFa: 'شهر گنبدی کوپولا', kind: 'automated', cost: 16, tags: ['city', 'building'], req: { oxygen: { max: 9 } },
    prod: { energy: -1, mc: 3 }, tiles: [{ kind: 'city' }], textFa: 'نیاز: اکسیژن حداکثر ۹٪. ۱− تولید انرژی، ۳+ تولید مگاکردیت. یک شهر بگذارید.' },
  { id: '030', name: 'Lunar Beam', nameFa: 'پرتو ماه', kind: 'automated', cost: 13, tags: ['earth', 'power'], prod: { mc: -2, heat: 2, energy: 2 },
    textFa: '۲− تولید مگاکردیت، ۲+ تولید گرما و ۲+ تولید انرژی.' },
  { id: '031', name: 'Optimal Aerobraking', nameFa: 'ترمز هوایی بهینه', kind: 'active', cost: 7, tags: ['space'],
    textFa: 'اثر: هر رویداد فضایی که بازی کنید ۳ مگاکردیت و ۳ گرما می‌گیرید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat && e.card.kind === 'event' && hasTag(e.card, 'space')) { g.gain('mc', 3); g.gain('heat', 3); } } },
  { id: '032', name: 'Underground City', nameFa: 'شهر زیرزمینی', kind: 'automated', cost: 18, tags: ['city', 'building'], prod: { energy: -2, steel: 2 },
    tiles: [{ kind: 'city' }], textFa: '۲− تولید انرژی، ۲+ تولید فولاد. یک شهر بگذارید.' },
  { id: '033', name: 'Regolith Eaters', nameFa: 'رگولیت‌خوارها', kind: 'active', cost: 13, tags: ['science', 'microbe'], resource: 'microbe',
    textFa: 'کنش: ۱ میکروب به این کارت بیفزایید، یا ۲ میکروب از آن بردارید و اکسیژن را ۱ پله بالا ببرید.',
    ...microbeRaise('oxygen', '۲ میکروب بردارید: اکسیژن ۱ پله') },
  { id: '034', name: 'GHG Producing Bacteria', nameFa: 'باکتری‌های تولیدکنندهٔ گاز گلخانه‌ای', kind: 'active', cost: 8, tags: ['science', 'microbe'],
    resource: 'microbe', req: { oxygen: { min: 4 } },
    textFa: 'نیاز: ۴٪ اکسیژن. کنش: ۱ میکروب به این کارت بیفزایید، یا ۲ میکروب از آن بردارید و دما را ۱ پله بالا ببرید.',
    ...microbeRaise('temperature', '۲ میکروب بردارید: دما ۱ پله') },
  { id: '036', name: 'Release of Inert Gases', nameFa: 'رهاسازی گازهای بی‌اثر', kind: 'event', cost: 14, tags: [], tr: 2,
    textFa: 'رتبهٔ زمین‌سازی شما ۲ پله بالا می‌رود.' },
  { id: '037', name: 'Nitrogen-Rich Asteroid', nameFa: 'سیارک غنی از نیتروژن', kind: 'event', cost: 31, tags: ['space'], tr: 2, raise: { temperature: 1 },
    prodBox: (g) => g.prod('plants', g.tags('plant') >= 3 ? 4 : 1),
    textFa: '۲ رتبهٔ زمین‌سازی و دما ۱ پله. ۱ تولید گیاه، یا ۴ تولید گیاه اگر ۳ نشان گیاه دارید.' },
  { id: '038', name: 'Rover Construction', nameFa: 'ساخت کاوشگر', kind: 'active', cost: 8, tags: ['building'], vp: 1,
    textFa: 'اثر: هر بار هر کاشی شهری گذاشته شود (روی مریخ یا بیرون آن) ۲ مگاکردیت می‌گیرید.',
    onTilePlaced: (g, e) => { if (e.kind === 'city') g.gain('mc', 2); } },
  { id: '039', name: 'Deimos Down', nameFa: 'سقوط دیموس', kind: 'event', cost: 31, tags: ['space'], raise: { temperature: 3 }, gain: { steel: 4 },
    removeAny: { res: 'plants', n: 8 }, textFa: 'دما ۳ پله بالا می‌رود و ۴ فولاد می‌گیرید. تا ۸ گیاه از هر بازیکن بردارید.' }
];
