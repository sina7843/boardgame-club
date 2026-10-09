// Worked examples, one per effect kind (owned by the architect). Chunk files copy these patterns.
import { tagCount, vpPerRes, vpPerTag, type CardDef, type Ctx } from '../api.ts';

/** Cards holding microbes that this player may take from (own or unprotected opponents', not this card). */
const microbeSources = (g: Ctx) => g.s.players.flatMap((_, k) => (g.isProtected(k) ? [] : g.cardsWith('microbe', { seat: k, min: 1 })))
  .filter((id) => id !== g.self);

export const examples: CardDef[] = [
  // Data only: production + global parameter.
  { id: '003', name: 'Deep Well Heating', nameFa: 'گرمایش چاه عمیق', kind: 'automated', cost: 13, tags: ['power', 'building'],
    textFa: '۱ تولید انرژی؛ دما ۱ پله بالا می‌رود.', prod: { energy: 1 }, raise: { temperature: 1 } },
  { id: '141', name: 'Power Plant', nameFa: 'نیروگاه', kind: 'automated', cost: 4, tags: ['power', 'building'], textFa: '۱ تولید انرژی.', prod: { energy: 1 } },
  // Event: raise + gain + optional "remove up to N from any player".
  { id: '009', name: 'Asteroid', nameFa: 'سیارک', kind: 'event', cost: 14, tags: ['space'],
    textFa: 'دما ۱ پله بالا می‌رود و ۲ تیتانیوم می‌گیرید. تا ۳ گیاه از هر بازیکن بردارید.', raise: { temperature: 1 }, gain: { titanium: 2 }, removeAny: { res: 'plants', n: 3 } },
  { id: '078', name: 'Ice Asteroid', nameFa: 'سیارک یخی', kind: 'event', cost: 23, tags: ['space'], textFa: '۲ اقیانوس بگذارید.', oceans: 2 },
  // Requirement + special city tile (its own tile, `card` = '008') + production change + VP computed from the map.
  { id: '008', name: 'Capital', nameFa: 'پایتخت', kind: 'automated', cost: 26, tags: ['city', 'building'], req: { oceans: { min: 4 } },
    textFa: 'نیاز: ۴ اقیانوس. ۲− تولید انرژی، ۵+ تولید مگاکردیت. این شهر را بگذارید؛ ۱ امتیاز برای هر اقیانوس کنارش.',
    prod: { energy: -2, mc: 5 }, tiles: [{ kind: 'city' }],
    vp: (g) => { const sp = g.tileOf(); return sp ? g.adjacent(sp).filter((a) => g.tileAt(a)?.kind === 'ocean').length : 0; } },
  // Blue action with a cost payable with titanium + VP per tag.
  { id: '012', name: 'Water Import From Europa', nameFa: 'واردات آب از اروپا', kind: 'active', cost: 25, tags: ['jovian', 'space'],
    textFa: 'کنش: ۱۲ مگاکردیت (تیتانیوم هم قبول است) بدهید و یک اقیانوس بگذارید. ۱ امتیاز برای هر نشان مشتری.',
    action: { cost: 12, payWith: { titanium: true }, can: (g) => g.s.oceans < 9, run: (g) => g.ocean() }, vp: vpPerTag('jovian') },
  // Triggered effect on any player's tile.
  { id: '023', name: 'Arctic Algae', nameFa: 'جلبک قطبی', kind: 'active', cost: 12, tags: ['plant'], req: { temperature: { max: -12 } },
    textFa: 'نیاز: دمای ۱۲− یا سردتر. ۱ گیاه. هر وقت هر کسی اقیانوس بگذارد ۲ گیاه می‌گیرید.', gain: { plants: 1 },
    onTilePlaced: (g, e) => { if (e.kind === 'ocean') g.gain('plants', 2); } },
  // Discount.
  { id: '025', name: 'Space Station', nameFa: 'ایستگاه فضایی', kind: 'active', cost: 10, tags: ['space'], ce: true, vp: 1,
    textFa: 'کارت‌های فضایی ۲ مگاکردیت ارزان‌تر.', discount: (c) => (c.tags.includes('space') ? 2 : 0) },
  // Requirement tolerance.
  { id: '153', name: 'Adaptation Technology', nameFa: 'فناوری سازگاری', kind: 'active', cost: 12, tags: ['science'], vp: 1, reqTolerance: 2,
    textFa: 'شرط‌های سراسری کارت‌هایتان ۲ پله به سود شما جابه‌جا می‌شوند.' },
  // Card resources: action taking from any card (card prompt + resolver), VP per 2 resources.
  { id: '035', name: 'Ants', nameFa: 'مورچه‌ها', kind: 'active', cost: 9, tags: ['microbe'], resource: 'microbe', req: { oxygen: { min: 4 } },
    textFa: 'نیاز: ۴٪ اکسیژن. کنش: ۱ میکروب از هر کارتی بردارید و به این کارت بیفزایید. ۱ امتیاز برای هر ۲ میکروب.', vp: vpPerRes(2),
    action: {
      can: (g) => microbeSources(g).length > 0,
      run: (g) => g.prompt({ kind: 'card', options: microbeSources(g), then: { card: '035', key: 'take' }, labelFa: 'کارتی که از آن میکروب برمی‌دارید' })
    },
    resolve: { take: (g, a) => { g.addRes(-1, a.card); g.addRes(1); } } },
  // Mandatory "decrease any production" (anyProd) + action adding to self.
  { id: '052', name: 'Fish', nameFa: 'ماهی‌ها', kind: 'active', cost: 9, tags: ['animal'], resource: 'animal', req: { temperature: { min: 2 } },
    textFa: 'نیاز: دمای ۲+ یا گرم‌تر. ۱− تولید گیاه یک بازیکن. کنش: ۱ جانور به این کارت. ۱ امتیاز برای هر جانور.',
    anyProd: { res: 'plants', n: 1 }, action: { run: (g) => g.addRes(1) }, vp: vpPerRes(1) },
  // Dynamic production box ("including this": the card is already in play when prodBox runs).
  { id: '102', name: 'Power Grid', nameFa: 'شبکهٔ برق', kind: 'automated', cost: 18, tags: ['power'],
    textFa: '۱ تولید انرژی برای هر نشان انرژی که دارید (این هم).', prodBox: (g) => g.prod('energy', g.tags('power')) },
  // Look at cards and keep some ('cards' prompt).
  { id: '111', name: 'Business Contacts', nameFa: 'ارتباطات تجاری', kind: 'event', cost: 7, tags: ['earth'], ce: true,
    textFa: '۴ کارت رو را ببینید؛ ۲ تا را به دست بگیرید و بقیه را دور بریزید.',
    play: (g) => {
      const cards = g.look(4);
      const n = Math.min(2, cards.length);
      if (cards.length) g.prompt({ kind: 'cards', cards, min: n, max: n, data: { cards }, then: { card: '111', key: 'keep' }, labelFa: '۲ کارت برای نگه داشتن' });
    },
    resolve: {
      keep: (g, a, d) => {
        const keep = a.cards ?? [];
        g.p.hand.push(...keep);
        g.discardCards((d.cards as string[]).filter((c) => !keep.includes(c)));
      }
    } },
  // Choice.
  { id: '115', name: 'Artificial Photosynthesis', nameFa: 'فتوسنتز مصنوعی', kind: 'automated', cost: 12, tags: ['science'],
    textFa: '۱ تولید گیاه یا ۲ تولید انرژی.',
    play: (g) => g.choose(['۱ تولید گیاه', '۲ تولید انرژی'], 'pick'),
    resolve: { pick: (g, a) => (a.index === 0 ? g.prod('plants', 1) : g.prod('energy', 2)) } },
  // Amount (X).
  { id: '152', name: 'Insulation', nameFa: 'عایق‌بندی', kind: 'automated', cost: 2, tags: [],
    textFa: 'هر چند پله تولید گرما را کم کنید و به همان اندازه تولید مگاکردیت بگیرید.',
    play: (g) => { if (g.p.prod.heat > 0) g.prompt({ kind: 'amount', min: 0, max: g.p.prod.heat, then: { card: '152', key: 'x' }, labelFa: 'چند پله؟' }); },
    resolve: { x: (g, a) => { g.prod('heat', -a.amount!); g.prod('mc', a.amount!); } } },
  // Tag trigger "including this".
  { id: '131', name: 'Decomposers', nameFa: 'تجزیه‌کننده‌ها', kind: 'active', cost: 5, tags: ['microbe'], resource: 'microbe', req: { oxygen: { min: 3 } },
    textFa: 'نیاز: ۳٪ اکسیژن. هر نشان جانور، گیاه یا میکروب که بازی کنید (این هم) ۱ میکروب به این کارت. ۱ امتیاز برای هر ۳ میکروب.', vp: vpPerRes(3),
    onCardPlayed: (g, e) => { if (e.seat === g.seat) g.addRes(tagCount(e.card, 'animal', 'plant', 'microbe')); } }
];
