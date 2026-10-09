// Terraforming Mars content chunk set2: official base cards 040-072 (32 cards; [CE] ones get ce: true).
// Tests: packages/game-engine/test/terraforming-mars-set2.test.ts
//  040 Asteroid Mining, 041 Food Factory, 042 ArchaeBacteria, 043 Carbonate Processing, 044 Natural Preserve,
//  045 Nuclear Power, 046 Lightning Harvest [CE], 047 Algae, 048 Adapted Lichen, 049 Tardigrades [CE], 050 Virus [CE],
//  051 Miranda Resort [CE], 053 Lake Marineris, 054 Small Animals, 055 Kelp Farming, 056 Mine [CE],
//  057 Vesta Shipyard [CE], 058 Beam From A Thorium Asteroid, 059 Mangrove, 060 Trees,
//  061 Great Escarpment Consortium [CE], 062 Mineral Deposit [CE], 063 Mining Expedition, 064 Mining Area [CE],
//  065 Building Industries [CE], 066 Land Claim [CE], 067 Mining Rights, 068 Sponsors [CE], 069 Electro Catapult [CE],
//  070 Earth Catapult [CE], 071 Advanced Alloys [CE], 072 Birds
import { vpPerRes, type CardDef, type Ctx, type TileEvent } from '../api.ts';

/** Virus: animal cards of any player that may lose animals (not protected, not Pets-like, holding at least 1). */
const animalTargets = (g: Ctx) => g.s.players.flatMap((_, k) => (g.isProtected(k) ? [] : g.cardsWith('animal', { seat: k, min: 1 })))
  .filter((id) => !g.card(id).keepsResources);
/** Virus: opponents with plants that are not protected (same targets as g.removeAny). */
const plantTargets = (g: Ctx) => g.s.players.some((p, k) => k !== g.seat && p.res.plants > 0 && !g.isProtected(k));

/**
 * Mining Rights / Mining Area: the tile comes from `tiles` (so the engine refuses the card without a legal area),
 * the production step follows the placed area. prodBox reads the placed tile so Robotic Workforce copies it; on the
 * initial play the tile is still queued, so prodBox does nothing and onTilePlaced grants the step.
 */
const miningProd = (g: Ctx, space: string) => g.prod(g.space(space).bonus.includes('titanium') ? 'titanium' : 'steel', 1);
const mining = {
  prodBox: (g: Ctx) => { const sp = g.tileOf(); if (sp) miningProd(g, sp); },
  onTilePlaced: (g: Ctx, e: TileEvent) => { if (e.card === g.self && e.seat === g.seat) miningProd(g, e.space); }
};

export const set2: CardDef[] = [
  { id: '040', name: 'Asteroid Mining', nameFa: 'استخراج از سیارک', kind: 'automated', cost: 30, tags: ['jovian', 'space'], vp: 2,
    textFa: '۲ تولید تیتانیوم.', prod: { titanium: 2 } },
  { id: '041', name: 'Food Factory', nameFa: 'کارخانهٔ غذا', kind: 'automated', cost: 12, tags: ['building'], vp: 1,
    textFa: '۱− تولید گیاه، ۴+ تولید مگاکردیت.', prod: { plants: -1, mc: 4 } },
  { id: '042', name: 'ArchaeBacteria', nameFa: 'آرکی‌باکتری', kind: 'automated', cost: 6, tags: ['microbe'], req: { temperature: { max: -18 } },
    textFa: 'نیاز: دمای ۱۸− یا سردتر. ۱ تولید گیاه.', prod: { plants: 1 } },
  { id: '043', name: 'Carbonate Processing', nameFa: 'فرآوری کربنات', kind: 'automated', cost: 6, tags: ['building'],
    textFa: '۱− تولید انرژی، ۳+ تولید گرما.', prod: { energy: -1, heat: 3 } },
  { id: '044', name: 'Natural Preserve', nameFa: 'منطقهٔ حفاظت‌شدهٔ طبیعی', kind: 'automated', cost: 9, tags: ['science', 'building'], vp: 1,
    req: { oxygen: { max: 4 } }, textFa: 'نیاز: حداکثر ۴٪ اکسیژن. ۱ تولید مگاکردیت. این کاشی را جایی بگذارید که کنار هیچ کاشی دیگری نباشد.',
    prod: { mc: 1 }, tiles: [{ kind: 'special', rule: 'isolated' }] },
  { id: '045', name: 'Nuclear Power', nameFa: 'نیروی هسته‌ای', kind: 'automated', cost: 10, tags: ['power', 'building'],
    textFa: '۲− تولید مگاکردیت، ۳+ تولید انرژی.', prod: { mc: -2, energy: 3 } },
  { id: '046', name: 'Lightning Harvest', nameFa: 'برداشت آذرخش', kind: 'automated', cost: 8, tags: ['power'], ce: true, vp: 1,
    req: { tags: { science: 3 } }, textFa: 'نیاز: ۳ نشان علم. ۱ تولید انرژی و ۱ تولید مگاکردیت.', prod: { energy: 1, mc: 1 } },
  { id: '047', name: 'Algae', nameFa: 'جلبک', kind: 'automated', cost: 10, tags: ['plant'], req: { oceans: { min: 5 } },
    textFa: 'نیاز: ۵ اقیانوس. ۱ گیاه و ۲ تولید گیاه.', gain: { plants: 1 }, prod: { plants: 2 } },
  { id: '048', name: 'Adapted Lichen', nameFa: 'گلسنگ سازگار', kind: 'automated', cost: 9, tags: ['plant'],
    textFa: '۱ تولید گیاه.', prod: { plants: 1 } },
  { id: '049', name: 'Tardigrades', nameFa: 'خرس‌های آبی', kind: 'active', cost: 4, tags: ['microbe'], ce: true, resource: 'microbe', vp: vpPerRes(4),
    textFa: 'کنش: ۱ میکروب به این کارت. ۱ امتیاز برای هر ۴ میکروب.', action: { run: (g) => g.addRes(1) } },
  { id: '050', name: 'Virus', nameFa: 'ویروس', kind: 'event', cost: 1, tags: ['microbe'], ce: true,
    textFa: 'تا ۲ جانور از یک کارت بردارید، یا تا ۵ گیاه از یک بازیکن بردارید.',
    play: (g) => {
      const opts = [...(animalTargets(g).length ? ['animals'] : []), ...(plantTargets(g) ? ['plants'] : [])];
      if (opts.length === 2) g.choose(['برداشتن تا ۲ جانور از یک کارت', 'برداشتن تا ۵ گیاه از یک بازیکن'], 'pick');
      else if (opts[0] === 'animals') g.prompt({ kind: 'card', options: animalTargets(g), optional: true, then: { card: '050', key: 'kill' }, labelFa: 'کارتی که از آن تا ۲ جانور برمی‌دارید' });
      else if (opts[0] === 'plants') g.removeAny('plants', 5);
    },
    resolve: {
      pick: (g, a) => {
        if (a.index === 0) g.prompt({ kind: 'card', options: animalTargets(g), optional: true, then: { card: '050', key: 'kill' }, labelFa: 'کارتی که از آن تا ۲ جانور برمی‌دارید' });
        else g.removeAny('plants', 5);
      },
      kill: (g, a) => g.addRes(-2, a.card)
    } },
  { id: '051', name: 'Miranda Resort', nameFa: 'تفرجگاه میراندا', kind: 'automated', cost: 12, tags: ['jovian', 'space'], ce: true, vp: 1,
    textFa: '۱ تولید مگاکردیت برای هر نشان زمین که دارید.', prodBox: (g) => g.prod('mc', g.tags('earth')) },
  { id: '053', name: 'Lake Marineris', nameFa: 'دریاچهٔ مارینریس', kind: 'automated', cost: 18, tags: [], vp: 2, req: { temperature: { min: 0 } },
    textFa: 'نیاز: دمای ۰ یا گرم‌تر. ۲ اقیانوس بگذارید.', oceans: 2 },
  { id: '054', name: 'Small Animals', nameFa: 'جانوران کوچک', kind: 'active', cost: 6, tags: ['animal'], resource: 'animal', vp: vpPerRes(2),
    req: { oxygen: { min: 6 } }, textFa: 'نیاز: ۶٪ اکسیژن. ۱− تولید گیاه یک بازیکن. کنش: ۱ جانور به این کارت. ۱ امتیاز برای هر ۲ جانور.',
    anyProd: { res: 'plants', n: 1 }, action: { run: (g) => g.addRes(1) } },
  { id: '055', name: 'Kelp Farming', nameFa: 'پرورش کِلپ', kind: 'automated', cost: 17, tags: ['plant'], vp: 1, req: { oceans: { min: 6 } },
    textFa: 'نیاز: ۶ اقیانوس. ۲ تولید مگاکردیت، ۳ تولید گیاه و ۲ گیاه.', prod: { mc: 2, plants: 3 }, gain: { plants: 2 } },
  { id: '056', name: 'Mine', nameFa: 'معدن', kind: 'automated', cost: 4, tags: ['building'], ce: true,
    textFa: '۱ تولید فولاد.', prod: { steel: 1 } },
  { id: '057', name: 'Vesta Shipyard', nameFa: 'کارخانهٔ کشتی‌سازی وستا', kind: 'automated', cost: 15, tags: ['jovian', 'space'], ce: true, vp: 1,
    textFa: '۱ تولید تیتانیوم.', prod: { titanium: 1 } },
  { id: '058', name: 'Beam From A Thorium Asteroid', nameFa: 'پرتو از سیارک توریمی', kind: 'automated', cost: 32, tags: ['jovian', 'space', 'power'], vp: 1,
    req: { tags: { jovian: 1 } }, textFa: 'نیاز: ۱ نشان مشتری. ۳ تولید گرما و ۳ تولید انرژی.', prod: { heat: 3, energy: 3 } },
  { id: '059', name: 'Mangrove', nameFa: 'جنگل حرا', kind: 'automated', cost: 12, tags: ['plant'], vp: 1, req: { temperature: { min: 4 } },
    textFa: 'نیاز: دمای ۴+ یا گرم‌تر. یک کاشی فضای سبز روی ناحیهٔ مخصوص اقیانوس بگذارید (اکسیژن ۱ پله).',
    tiles: [{ kind: 'greenery', rule: 'oceanArea' }] },
  { id: '060', name: 'Trees', nameFa: 'درختان', kind: 'automated', cost: 13, tags: ['plant'], vp: 1, req: { temperature: { min: -4 } },
    textFa: 'نیاز: دمای ۴− یا گرم‌تر. ۳ تولید گیاه و ۱ گیاه.', prod: { plants: 3 }, gain: { plants: 1 } },
  { id: '061', name: 'Great Escarpment Consortium', nameFa: 'کنسرسیوم پرتگاه بزرگ', kind: 'automated', cost: 6, tags: [], ce: true,
    req: { prod: { steel: 1 } }, textFa: 'نیاز: تولید فولاد. ۱− تولید فولاد یک بازیکن؛ ۱+ تولید فولاد خودتان.',
    prod: { steel: 1 }, anyProd: { res: 'steel', n: 1 } },
  { id: '062', name: 'Mineral Deposit', nameFa: 'ذخیرهٔ معدنی', kind: 'event', cost: 5, tags: [], ce: true,
    textFa: '۵ فولاد بگیرید.', gain: { steel: 5 } },
  { id: '063', name: 'Mining Expedition', nameFa: 'هیئت اکتشاف معدن', kind: 'event', cost: 12, tags: [],
    textFa: 'اکسیژن ۱ پله بالا می‌رود. تا ۲ گیاه از یک بازیکن بردارید. ۲ فولاد بگیرید.',
    raise: { oxygen: 1 }, removeAny: { res: 'plants', n: 2 }, gain: { steel: 2 } },
  { id: '064', name: 'Mining Area', nameFa: 'منطقهٔ معدنی', kind: 'automated', cost: 4, tags: ['building'], ce: true,
    textFa: 'این کاشی را روی ناحیه‌ای با پاداش فولاد یا تیتانیوم، کنار یکی از کاشی‌های خودتان بگذارید؛ ۱ پله تولید همان منبع.',
    tiles: [{ kind: 'special', rule: 'steelTiOwnAdj' }], ...mining },
  { id: '065', name: 'Building Industries', nameFa: 'صنایع ساختمانی', kind: 'automated', cost: 6, tags: ['building'], ce: true,
    textFa: '۱− تولید انرژی، ۲+ تولید فولاد.', prod: { energy: -1, steel: 2 } },
  { id: '066', name: 'Land Claim', nameFa: 'ادعای زمین', kind: 'event', cost: 1, tags: [], ce: true,
    textFa: 'نشانهٔ خود را روی یک ناحیهٔ غیررزرو بگذارید؛ فقط شما می‌توانید آنجا کاشی بگذارید.', play: (g) => g.claim() },
  { id: '067', name: 'Mining Rights', nameFa: 'حق استخراج', kind: 'automated', cost: 9, tags: ['building'],
    textFa: 'این کاشی را روی ناحیه‌ای با پاداش فولاد یا تیتانیوم بگذارید؛ ۱ پله تولید همان منبع.',
    tiles: [{ kind: 'special', rule: 'steelTi' }], ...mining },
  { id: '068', name: 'Sponsors', nameFa: 'حامیان مالی', kind: 'automated', cost: 6, tags: ['earth'], ce: true,
    textFa: '۲ تولید مگاکردیت.', prod: { mc: 2 } },
  { id: '069', name: 'Electro Catapult', nameFa: 'منجنیق الکتریکی', kind: 'active', cost: 17, tags: ['building'], ce: true, vp: 1,
    req: { oxygen: { max: 8 } }, textFa: 'نیاز: حداکثر ۸٪ اکسیژن. ۱− تولید انرژی. کنش: ۱ گیاه یا ۱ فولاد بدهید و ۷ مگاکردیت بگیرید.',
    prod: { energy: -1 },
    action: {
      can: (g) => g.p.res.plants > 0 || g.p.res.steel > 0,
      run: (g) => {
        if (g.p.res.plants > 0 && g.p.res.steel > 0) g.choose(['۱ گیاه بدهید', '۱ فولاد بدهید'], 'spend');
        else { g.gain(g.p.res.plants > 0 ? 'plants' : 'steel', -1); g.gain('mc', 7); }
      }
    },
    resolve: { spend: (g, a) => { g.gain(a.index === 0 ? 'plants' : 'steel', -1); g.gain('mc', 7); } } },
  { id: '070', name: 'Earth Catapult', nameFa: 'منجنیق زمین', kind: 'active', cost: 23, tags: ['earth'], ce: true, vp: 2,
    textFa: 'کارت‌هایی که بازی می‌کنید ۲ مگاکردیت ارزان‌تر.', discount: () => 2 },
  { id: '071', name: 'Advanced Alloys', nameFa: 'آلیاژهای پیشرفته', kind: 'active', cost: 9, tags: ['science'], ce: true,
    textFa: 'ارزش هر فولاد و هر تیتانیوم ۱ مگاکردیت بیشتر است.', steelBonus: 1, titaniumBonus: 1 },
  { id: '072', name: 'Birds', nameFa: 'پرندگان', kind: 'active', cost: 10, tags: ['animal'], resource: 'animal', vp: vpPerRes(1),
    req: { oxygen: { min: 13 } }, textFa: 'نیاز: ۱۳٪ اکسیژن. ۲− تولید گیاه یک بازیکن. کنش: ۱ جانور به این کارت. ۱ امتیاز برای هر جانور.',
    anyProd: { res: 'plants', n: 2 }, action: { run: (g) => g.addRes(1) } }
];
