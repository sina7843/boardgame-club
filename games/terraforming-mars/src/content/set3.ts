// Terraforming Mars content chunk set3: official base cards 073-106 (32 cards; [CE] ones get ce: true).
// Tests: packages/game-engine/test/terraforming-mars-set3.test.ts
import { hasTag, tagCount, vpPerTag, type CardDef, type Ctx, type Res } from '../api.ts';

const floor = (r: Res) => (r === 'mc' ? -5 : 0);
/** Robotic Workforce targets: own building cards (not corporations) with a production box whose decreases are payable. */
const workforceTargets = (g: Ctx) => g.tableau().filter((id) => {
  const c = g.card(id);
  if (c.kind === 'corporation' || !hasTag(c, 'building') || (!c.prod && !c.prodBox)) return false;
  return Object.entries(c.prod ?? {}).every(([r, n]) => n >= 0 || g.p.prod[r as Res] + n >= floor(r as Res))
    && (!c.anyProd || g.canReduceAnyProd(c.anyProd.res, c.anyProd.n));
});
/** Mars University: optional discard-then-draw; chained so each prompt sees the current hand. */
const universityPrompt = (g: Ctx, left: number) => {
  if (left > 0 && g.p.hand.length) {
    g.prompt({ kind: 'card', options: [...g.p.hand], optional: true, onSkip: true, then: { card: '073', key: 'swap' }, data: { left: left - 1 },
      labelFa: 'کارتی برای دور ریختن (و کشیدن یک کارت)' });
  }
};
const smelter = (id: string, nameFa: string, name: string, cost: number, res: 'steel' | 'titanium', n: number, textFa: string): CardDef => ({
  id, name, nameFa, kind: 'active', cost, tags: ['building'], textFa,
  action: { can: (g) => g.p.res.energy >= 4, run: (g) => { g.gain('energy', -4); g.gain(res, n); g.raise('oxygen', 1); } }
});

export const set3: CardDef[] = [
  { id: '073', name: 'Mars University', nameFa: 'دانشگاه مریخ', kind: 'active', cost: 8, tags: ['science', 'building'], ce: true, vp: 1,
    textFa: 'هر نشان علم که بازی کنید (این هم) می‌توانید ۱ کارت از دست دور بریزید و ۱ کارت بکشید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat) universityPrompt(g, tagCount(e.card, 'science')); },
    resolve: {
      swap: (g, a, d) => {
        if (!a.skip) { g.p.hand = g.p.hand.filter((c) => c !== a.card); g.discardCards([a.card!]); g.draw(1); }
        universityPrompt(g, d.left as number);
      }
    } },
  { id: '074', name: 'Viral Enhancers', nameFa: 'تقویت‌کننده‌های ویروسی', kind: 'active', cost: 9, tags: ['science', 'microbe'], ce: true,
    textFa: 'هر نشان گیاه، میکروب یا جانور که بازی کنید (این هم): ۱ گیاه بگیرید یا ۱ منبع به همان کارت بیفزایید.',
    onCardPlayed: (g, e) => {
      if (e.seat !== g.seat) return;
      const n = tagCount(e.card, 'plant', 'microbe', 'animal');
      const holds = (e.card.resource === 'microbe' || e.card.resource === 'animal') && g.tableau().includes(e.card.id);
      for (let i = 0; i < n; i++) {
        if (holds) g.choose(['۱ گیاه', `۱ منبع روی ${e.card.nameFa}`], 'pick', { card: e.card.id });
        else g.gain('plants', 1);
      }
    },
    resolve: { pick: (g, a, d) => (a.index === 0 ? g.gain('plants', 1) : g.addRes(1, d.card as string)) } },
  { id: '075', name: 'Towing A Comet', nameFa: 'یدک‌کشیدن دنباله‌دار', kind: 'event', cost: 23, tags: ['space'],
    textFa: '۲ گیاه بگیرید، اکسیژن ۱ پله بالا می‌رود و ۱ اقیانوس بگذارید.', gain: { plants: 2 }, raise: { oxygen: 1 }, oceans: 1 },
  { id: '076', name: 'Space Mirrors', nameFa: 'آینه‌های فضایی', kind: 'active', cost: 3, tags: ['power', 'space'],
    textFa: 'کنش: ۷ مگاکردیت بدهید و ۱ تولید انرژی بگیرید.', action: { cost: 7, run: (g) => g.prod('energy', 1) } },
  { id: '077', name: 'Solar Wind Power', nameFa: 'نیروی باد خورشیدی', kind: 'automated', cost: 11, tags: ['science', 'space', 'power'],
    textFa: '۱ تولید انرژی و ۲ تیتانیوم.', prod: { energy: 1 }, gain: { titanium: 2 } },
  { id: '079', name: 'Quantum Extractor', nameFa: 'استخراج‌گر کوانتومی', kind: 'active', cost: 13, tags: ['science', 'power'], ce: true,
    req: { tags: { science: 4 } }, textFa: 'نیاز: ۴ نشان علم. ۴ تولید انرژی. کارت‌های فضایی ۲ مگاکردیت ارزان‌تر.',
    prod: { energy: 4 }, discount: (c) => (hasTag(c, 'space') ? 2 : 0) },
  { id: '080', name: 'Giant Ice Asteroid', nameFa: 'سیارک یخی غول‌پیکر', kind: 'event', cost: 36, tags: ['space'],
    textFa: 'دما ۲ پله بالا می‌رود و ۲ اقیانوس بگذارید. تا ۶ گیاه از هر بازیکن بردارید.',
    raise: { temperature: 2 }, oceans: 2, removeAny: { res: 'plants', n: 6 } },
  { id: '081', name: 'Ganymede Colony', nameFa: 'مستعمرهٔ گانیمد', kind: 'automated', cost: 20, tags: ['jovian', 'space', 'city'],
    textFa: 'یک شهر در ناحیهٔ ویژهٔ گانیمد بگذارید. ۱ امتیاز برای هر نشان مشتری.',
    tiles: [{ kind: 'city', rule: 'ganymede' }], vp: vpPerTag('jovian') },
  { id: '082', name: 'Callisto Penal Mines', nameFa: 'معادن تأدیبی کالیستو', kind: 'automated', cost: 24, tags: ['jovian', 'space'], ce: true, vp: 2,
    textFa: '۳ تولید مگاکردیت.', prod: { mc: 3 } },
  { id: '083', name: 'Giant Space Mirror', nameFa: 'آینهٔ فضایی غول‌پیکر', kind: 'automated', cost: 17, tags: ['power', 'space'],
    textFa: '۳ تولید انرژی.', prod: { energy: 3 } },
  { id: '084', name: 'Trans-Neptune Probe', nameFa: 'کاوشگر فرانپتونی', kind: 'automated', cost: 6, tags: ['science', 'space'], ce: true, vp: 1,
    textFa: '۱ امتیاز.' },
  { id: '085', name: 'Commercial District', nameFa: 'منطقهٔ تجاری', kind: 'automated', cost: 16, tags: ['building'], ce: true,
    textFa: '۱− تولید انرژی و ۴+ تولید مگاکردیت. این کاشی را بگذارید؛ ۱ امتیاز برای هر شهر کنارش.',
    prod: { energy: -1, mc: 4 }, tiles: [{ kind: 'special', rule: 'land' }],
    vp: (g) => { const sp = g.tileOf(); return sp ? g.adjacent(sp).filter((a) => g.tileAt(a)?.kind === 'city').length : 0; } },
  { id: '086', name: 'Robotic Workforce', nameFa: 'نیروی کار رباتیک', kind: 'automated', cost: 9, tags: ['science'], ce: true,
    textFa: 'جعبهٔ تولید یکی از کارت‌های ساختمانی خود را تکرار کنید.',
    canPlay: (g) => workforceTargets(g).length > 0,
    play: (g) => g.prompt({ kind: 'card', options: workforceTargets(g), then: { card: '086', key: 'copy' }, labelFa: 'کارت ساختمانی برای تکرار تولید' }),
    resolve: { copy: (g, a) => g.copyProduction(a.card!) } },
  { id: '087', name: 'Grass', nameFa: 'علف', kind: 'automated', cost: 11, tags: ['plant'], req: { temperature: { min: -16 } },
    textFa: 'نیاز: دمای ۱۶− یا گرم‌تر. ۱ تولید گیاه و ۳ گیاه.', prod: { plants: 1 }, gain: { plants: 3 } },
  { id: '088', name: 'Heather', nameFa: 'خلنگ', kind: 'automated', cost: 6, tags: ['plant'], req: { temperature: { min: -14 } },
    textFa: 'نیاز: دمای ۱۴− یا گرم‌تر. ۱ تولید گیاه و ۱ گیاه.', prod: { plants: 1 }, gain: { plants: 1 } },
  { id: '089', name: 'Peroxide Power', nameFa: 'نیروی پراکسید', kind: 'automated', cost: 7, tags: ['power', 'building'],
    textFa: '۱− تولید مگاکردیت و ۲+ تولید انرژی.', prod: { mc: -1, energy: 2 } },
  { id: '090', name: 'Research', nameFa: 'پژوهش', kind: 'automated', cost: 11, tags: ['science', 'science'], ce: true, vp: 1,
    textFa: '۲ کارت بکشید. (۲ نشان علم)', draw: 2 },
  { id: '091', name: 'Gene Repair', nameFa: 'ترمیم ژن', kind: 'automated', cost: 12, tags: ['science'], ce: true, vp: 2,
    req: { tags: { science: 3 } }, textFa: 'نیاز: ۳ نشان علم. ۲ تولید مگاکردیت.', prod: { mc: 2 } },
  { id: '092', name: 'Io Mining Industries', nameFa: 'صنایع معدنی آیو', kind: 'automated', cost: 41, tags: ['jovian', 'space'], ce: true,
    textFa: '۲ تولید تیتانیوم و ۲ تولید مگاکردیت. ۱ امتیاز برای هر نشان مشتری.', prod: { titanium: 2, mc: 2 }, vp: vpPerTag('jovian') },
  { id: '093', name: 'Bushes', nameFa: 'بوته‌ها', kind: 'automated', cost: 10, tags: ['plant'], req: { temperature: { min: -10 } },
    textFa: 'نیاز: دمای ۱۰− یا گرم‌تر. ۲ تولید گیاه و ۲ گیاه.', prod: { plants: 2 }, gain: { plants: 2 } },
  { id: '094', name: 'Mass Converter', nameFa: 'مبدل جرم', kind: 'active', cost: 8, tags: ['science', 'power'], ce: true,
    req: { tags: { science: 5 } }, textFa: 'نیاز: ۵ نشان علم. ۶ تولید انرژی. کارت‌های فضایی ۲ مگاکردیت ارزان‌تر.',
    prod: { energy: 6 }, discount: (c) => (hasTag(c, 'space') ? 2 : 0) },
  { id: '095', name: 'Physics Complex', nameFa: 'مجتمع فیزیک', kind: 'active', cost: 12, tags: ['science', 'building'], ce: true, resource: 'science',
    textFa: 'کنش: ۶ انرژی بدهید و ۱ منبع علمی به این کارت بیفزایید. ۲ امتیاز برای هر منبع علمی.',
    action: { can: (g) => g.p.res.energy >= 6, run: (g) => { g.gain('energy', -6); g.addRes(1); } }, vp: (g) => 2 * g.resOn() },
  { id: '096', name: 'Greenhouses', nameFa: 'گلخانه‌ها', kind: 'automated', cost: 6, tags: ['plant', 'building'],
    textFa: '۱ گیاه برای هر شهر در بازی.', play: (g) => g.gain('plants', g.cities()) },
  { id: '097', name: 'Nuclear Zone', nameFa: 'منطقهٔ هسته‌ای', kind: 'automated', cost: 10, tags: ['earth'], vp: -2,
    textFa: 'این کاشی را بگذارید؛ دما ۲ پله بالا می‌رود.', tiles: [{ kind: 'special', rule: 'land' }], raise: { temperature: 2 } },
  { id: '098', name: 'Tropical Resort', nameFa: 'استراحتگاه گرمسیری', kind: 'automated', cost: 13, tags: ['building'], ce: true, vp: 2,
    textFa: '۲− تولید گرما و ۳+ تولید مگاکردیت.', prod: { heat: -2, mc: 3 } },
  { id: '099', name: 'Toll Station', nameFa: 'ایستگاه عوارض', kind: 'automated', cost: 12, tags: ['space'], ce: true,
    textFa: '۱ تولید مگاکردیت برای هر نشان فضایی حریفان.',
    prodBox: (g) => g.prod('mc', g.s.players.reduce((n, _, k) => (k === g.seat ? n : n + g.tags('space', k)), 0)) },
  { id: '100', name: 'Fueled Generators', nameFa: 'مولدهای سوختی', kind: 'automated', cost: 1, tags: ['power', 'building'],
    textFa: '۱− تولید مگاکردیت و ۱+ تولید انرژی.', prod: { mc: -1, energy: 1 } },
  smelter('101', 'کارخانهٔ آهن', 'Ironworks', 11, 'steel', 1, 'کنش: ۴ انرژی بدهید، ۱ فولاد بگیرید و اکسیژن ۱ پله بالا می‌رود.'),
  smelter('103', 'کارخانهٔ فولاد', 'Steelworks', 15, 'steel', 2, 'کنش: ۴ انرژی بدهید، ۲ فولاد بگیرید و اکسیژن ۱ پله بالا می‌رود.'),
  smelter('104', 'فرآوری سنگ معدن', 'Ore Processor', 13, 'titanium', 1, 'کنش: ۴ انرژی بدهید، ۱ تیتانیوم بگیرید و اکسیژن ۱ پله بالا می‌رود.'),
  { id: '105', name: 'Earth Office', nameFa: 'دفتر زمین', kind: 'active', cost: 1, tags: ['earth'], ce: true,
    textFa: 'کارت‌های زمینی ۳ مگاکردیت ارزان‌تر.', discount: (c) => (hasTag(c, 'earth') ? 3 : 0) },
  { id: '106', name: 'Acquired Company', nameFa: 'شرکت خریداری‌شده', kind: 'automated', cost: 10, tags: ['earth'], ce: true,
    textFa: '۳ تولید مگاکردیت.', prod: { mc: 3 } }
];
