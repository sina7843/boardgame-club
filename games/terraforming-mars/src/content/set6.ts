// Terraforming Mars content chunk set6: official base cards 177-208 (32 cards; [CE] ones get ce: true).
// Tests: packages/game-engine/test/terraforming-mars-set6.test.ts
import { tagCount, vpPerRes, type CardDef, type Ctx } from '../api.ts';

/** Olympus Conference: resolve one science tag, then the remaining ones (the choice depends on the current count). */
function olympus(g: Ctx, left: number) {
  if (left <= 0) return;
  if (g.resOn() > 0) g.choose(['۱ منبع علمی به این کارت', '۱ منبع علمی بردارید و ۱ کارت بکشید'], 'pick', { left });
  else { g.addRes(1); olympus(g, left - 1); }
}

export const set6: CardDef[] = [
  { id: '177', name: 'Water Splitting Plant', nameFa: 'نیروگاه تجزیهٔ آب', kind: 'active', cost: 12, tags: ['building'], req: { oceans: { min: 2 } },
    textFa: 'نیاز: ۲ اقیانوس. کنش: ۳ انرژی خرج کنید و اکسیژن را ۱ پله بالا ببرید.',
    action: { can: (g) => g.p.res.energy >= 3, run: (g) => { g.gain('energy', -3); g.raise('oxygen', 1); } } },
  { id: '178', name: 'Heat Trappers', nameFa: 'تله‌های گرما', kind: 'automated', cost: 6, tags: ['power', 'building'], vp: -1,
    textFa: '۲− تولید گرمای یک بازیکن؛ ۱ تولید انرژی برای شما.', prod: { energy: 1 }, anyProd: { res: 'heat', n: 2 } },
  { id: '179', name: 'Soil Factory', nameFa: 'کارخانهٔ خاک', kind: 'automated', cost: 9, tags: ['building'], vp: 1,
    textFa: '۱− تولید انرژی، ۱+ تولید گیاه.', prod: { energy: -1, plants: 1 } },
  { id: '180', name: 'Fuel Factory', nameFa: 'کارخانهٔ سوخت', kind: 'automated', cost: 6, tags: ['building'], ce: true,
    textFa: '۱− تولید انرژی، ۱+ تولید تیتانیوم و ۱+ تولید مگاکردیت.', prod: { energy: -1, titanium: 1, mc: 1 } },
  { id: '181', name: 'Ice Cap Melting', nameFa: 'ذوب کلاهک یخی', kind: 'event', cost: 5, tags: [], req: { temperature: { min: 2 } },
    textFa: 'نیاز: دمای ۲+ یا گرم‌تر. ۱ اقیانوس بگذارید.', oceans: 1 },
  { id: '182', name: 'Corporate Stronghold', nameFa: 'دژ شرکتی', kind: 'automated', cost: 11, tags: ['city', 'building'], ce: true, vp: -2,
    textFa: '۱− تولید انرژی، ۳+ تولید مگاکردیت. یک شهر بگذارید.', prod: { energy: -1, mc: 3 }, tiles: [{ kind: 'city' }] },
  { id: '183', name: 'Biomass Combustors', nameFa: 'کوره‌های زیست‌توده', kind: 'automated', cost: 4, tags: ['power', 'building'], vp: -1,
    req: { oxygen: { min: 6 } }, textFa: 'نیاز: ۶٪ اکسیژن. ۱− تولید گیاه یک بازیکن؛ ۲ تولید انرژی برای شما.',
    prod: { energy: 2 }, anyProd: { res: 'plants', n: 1 } },
  { id: '184', name: 'Livestock', nameFa: 'دام‌ها', kind: 'active', cost: 13, tags: ['animal'], resource: 'animal', req: { oxygen: { min: 9 } },
    textFa: 'نیاز: ۹٪ اکسیژن. ۱− تولید گیاه، ۲+ تولید مگاکردیت. کنش: ۱ جانور به این کارت. ۱ امتیاز برای هر جانور.',
    prod: { plants: -1, mc: 2 }, action: { run: (g) => g.addRes(1) }, vp: vpPerRes(1) },
  { id: '185', name: 'Olympus Conference', nameFa: 'همایش المپوس', kind: 'active', cost: 10, tags: ['science', 'earth', 'building'], ce: true,
    resource: 'science', vp: 1,
    textFa: 'هر نشان علم که بازی کنید (این هم): ۱ منبع علمی به این کارت، یا ۱ منبع علمی از آن بردارید و ۱ کارت بکشید.',
    onCardPlayed: (g, e) => { if (e.seat === g.seat) olympus(g, tagCount(e.card, 'science')); },
    resolve: {
      pick: (g, a, d) => {
        if (a.index === 1) { g.addRes(-1); g.draw(1); } else g.addRes(1);
        olympus(g, (d.left as number) - 1);
      }
    } },
  { id: '186', name: 'Rad-Suits', nameFa: 'لباس‌های ضدتشعشع', kind: 'automated', cost: 6, tags: [], ce: true, vp: 1, req: { cities: 2 },
    textFa: 'نیاز: ۲ کاشی شهر در بازی. ۱+ تولید مگاکردیت.', prod: { mc: 1 } },
  { id: '187', name: 'Aquifer Pumping', nameFa: 'پمپاژ سفرهٔ آب', kind: 'active', cost: 18, tags: ['building'],
    textFa: 'کنش: ۸ مگاکردیت (فولاد هم قبول است) بدهید و یک اقیانوس بگذارید.',
    action: { cost: 8, payWith: { steel: true }, can: (g) => g.s.oceans < 9, run: (g) => g.ocean() } },
  { id: '188', name: 'Flooding', nameFa: 'سیل', kind: 'event', cost: 7, tags: [], vp: -1,
    textFa: '۱ اقیانوس بگذارید؛ سپس می‌توانید تا ۴ مگاکردیت از صاحب یکی از کاشی‌های کنار آن بردارید.',
    play: (g) => g.tile('ocean', 'ocean', { card: '188', key: 'flood' }),
    resolve: {
      flood: (g, a) => {
        const owners = [...new Set(g.adjacent(a.space!).map((x) => g.tileAt(x)?.owner).filter((o): o is number => o != null))]
          .filter((o) => o !== g.seat && g.s.players[o]!.res.mc > 0).sort((x, y) => x - y);
        if (owners.length) g.prompt({ kind: 'player', options: owners, optional: true, then: { card: null, key: 'removeRes' }, data: { res: 'mc', n: 4, steal: false }, labelFa: 'برداشتن تا ۴ مگاکردیت از صاحب یک کاشی مجاور' });
      }
    } },
  { id: '189', name: 'Energy Saving', nameFa: 'صرفه‌جویی انرژی', kind: 'automated', cost: 15, tags: ['power'],
    textFa: '۱ تولید انرژی برای هر کاشی شهر در بازی.', prodBox: (g) => g.prod('energy', g.cities()) },
  { id: '190', name: 'Local Heat Trapping', nameFa: 'به‌دام‌اندازی گرمای محلی', kind: 'event', cost: 1, tags: [],
    textFa: '۵ گرما خرج کنید و ۴ گیاه بگیرید یا ۲ جانور به کارت دیگری بیفزایید.', gain: { heat: -5 },
    play: (g) => { if (g.cardsWith('animal').length) g.choose(['۴ گیاه', '۲ جانور به یک کارت'], 'pick'); else g.gain('plants', 4); },
    resolve: { pick: (g, a) => (a.index === 1 ? g.addToCard('animal', 2) : g.gain('plants', 4)) } },
  { id: '191', name: 'Permafrost Extraction', nameFa: 'استخراج یخ‌زار دائمی', kind: 'event', cost: 8, tags: [], req: { temperature: { min: -8 } },
    textFa: 'نیاز: دمای ۸− یا گرم‌تر. ۱ اقیانوس بگذارید.', oceans: 1 },
  { id: '192', name: 'Invention Contest', nameFa: 'مسابقهٔ اختراع', kind: 'event', cost: 2, tags: ['science'], ce: true,
    textFa: '۳ کارت رو را ببینید؛ ۱ تا را به دست بگیرید و بقیه را دور بریزید.',
    play: (g) => {
      const cards = g.look(3);
      if (cards.length) g.prompt({ kind: 'cards', cards, min: 1, max: 1, data: { cards }, then: { card: '192', key: 'keep' }, labelFa: '۱ کارت برای نگه داشتن' });
    },
    resolve: {
      keep: (g, a, d) => {
        const keep = a.cards ?? [];
        g.p.hand.push(...keep);
        g.discardCards((d.cards as string[]).filter((c) => !keep.includes(c)));
      }
    } },
  { id: '193', name: 'Plantation', nameFa: 'کشتزار', kind: 'automated', cost: 15, tags: ['plant'], req: { tags: { science: 2 } },
    textFa: 'نیاز: ۲ نشان علم. یک کاشی فضای سبز بگذارید و اکسیژن را ۱ پله بالا ببرید.', tiles: [{ kind: 'greenery' }] },
  { id: '194', name: 'Power Infrastructure', nameFa: 'زیرساخت برق', kind: 'active', cost: 4, tags: ['power', 'building'], ce: true,
    textFa: 'کنش: هر چند انرژی خرج کنید و همان اندازه مگاکردیت بگیرید.',
    action: {
      can: (g) => g.p.res.energy >= 1,
      run: (g) => g.prompt({ kind: 'amount', min: 1, max: g.p.res.energy, then: { card: '194', key: 'x' }, labelFa: 'چند انرژی؟' })
    },
    resolve: { x: (g, a) => { g.gain('energy', -a.amount!); g.gain('mc', a.amount!); } } },
  { id: '195', name: 'Indentured Workers', nameFa: 'کارگران قراردادی', kind: 'event', cost: 0, tags: [], ce: true, vp: -1,
    textFa: 'کارت بعدی که در این نسل بازی می‌کنید ۸ مگاکردیت ارزان‌تر است.', play: (g) => { g.p.nextDiscount = 8; } },
  { id: '196', name: 'Lagrange Observatory', nameFa: 'رصدخانهٔ لاگرانژ', kind: 'automated', cost: 9, tags: ['science', 'space'], ce: true, vp: 1,
    textFa: '۱ کارت بکشید.', draw: 1 },
  { id: '197', name: 'Terraforming Ganymede', nameFa: 'زمین‌سازی گانیمد', kind: 'automated', cost: 33, tags: ['jovian', 'space'], ce: true, vp: 2,
    textFa: 'به ازای هر نشان مشتری که دارید (این هم) ۱ رتبهٔ زمین‌سازی.', play: (g) => g.tr(g.tags('jovian')) },
  { id: '198', name: 'Immigration Shuttles', nameFa: 'شاتل‌های مهاجرت', kind: 'automated', cost: 31, tags: ['earth', 'space'],
    textFa: '۵+ تولید مگاکردیت. ۱ امتیاز برای هر ۳ کاشی شهر در بازی.', prod: { mc: 5 }, vp: (g) => Math.floor(g.cities() / 3) },
  { id: '199', name: 'Restricted Area', nameFa: 'منطقهٔ ممنوعه', kind: 'active', cost: 11, tags: ['science'], ce: true,
    textFa: 'این کاشی ویژه را بگذارید. کنش: ۲ مگاکردیت بدهید و ۱ کارت بکشید.', tiles: [{ kind: 'special', rule: 'land' }],
    action: { cost: 2, run: (g) => { g.draw(1); } } },
  { id: '200', name: 'Immigrant City', nameFa: 'شهر مهاجران', kind: 'active', cost: 13, tags: ['city', 'building'],
    textFa: '۱− تولید انرژی، ۲− تولید مگاکردیت. یک شهر بگذارید. هر بار هر کسی شهری بگذارد (این هم) ۱+ تولید مگاکردیت.',
    prod: { energy: -1, mc: -2 }, tiles: [{ kind: 'city' }], onTilePlaced: (g, e) => { if (e.kind === 'city') g.prod('mc', 1); } },
  { id: '201', name: 'Energy Tapping', nameFa: 'برداشت انرژی', kind: 'automated', cost: 3, tags: ['power'], ce: true, vp: -1,
    textFa: '۱− تولید انرژی یک بازیکن؛ ۱ تولید انرژی برای شما.', prod: { energy: 1 }, anyProd: { res: 'energy', n: 1 } },
  { id: '202', name: 'Underground Detonations', nameFa: 'انفجارهای زیرزمینی', kind: 'active', cost: 6, tags: ['building'],
    textFa: 'کنش: ۱۰ مگاکردیت بدهید و ۲ تولید گرما بگیرید.', action: { cost: 10, run: (g) => g.prod('heat', 2) } },
  { id: '203', name: 'Soletta', nameFa: 'سولتا', kind: 'automated', cost: 35, tags: ['space'], textFa: '۷+ تولید گرما.', prod: { heat: 7 } },
  { id: '204', name: 'Technology Demonstration', nameFa: 'نمایش فناوری', kind: 'event', cost: 5, tags: ['science', 'space'], ce: true,
    textFa: '۲ کارت بکشید.', draw: 2 },
  { id: '205', name: 'Rad-Chem Factory', nameFa: 'کارخانهٔ شیمی پرتویی', kind: 'automated', cost: 8, tags: ['building'],
    textFa: '۱− تولید انرژی؛ ۲ رتبهٔ زمین‌سازی.', prod: { energy: -1 }, tr: 2 },
  { id: '206', name: 'Special Design', nameFa: 'طراحی ویژه', kind: 'event', cost: 4, tags: ['science'],
    textFa: 'کارت بعدی که در این نسل بازی می‌کنید می‌تواند شرط‌های سراسری را تا ۲ پله نادیده بگیرد.', play: (g) => { g.p.nextReqBonus = 2; } },
  { id: '207', name: 'Medical Lab', nameFa: 'آزمایشگاه پزشکی', kind: 'automated', cost: 13, tags: ['science', 'building'], ce: true, vp: 1,
    textFa: '۱ تولید مگاکردیت برای هر ۲ نشان ساختمان که دارید (این هم).', prodBox: (g) => g.prod('mc', Math.floor(g.tags('building') / 2)) },
  { id: '208', name: 'AI Central', nameFa: 'مرکز هوش مصنوعی', kind: 'active', cost: 21, tags: ['science', 'building'], ce: true, vp: 1,
    req: { tags: { science: 3 } }, textFa: 'نیاز: ۳ نشان علم. ۱− تولید انرژی. کنش: ۲ کارت بکشید.',
    prod: { energy: -1 }, action: { run: (g) => { g.draw(2); } } }
];
