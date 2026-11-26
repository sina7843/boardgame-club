import type { Term } from '@bg/ui';
import { tx } from '@bg/ui';
import { TYPE } from './rules.ts';

/** Star Realms terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  trade: { fa: 'تجارت', bg: 'Trade' }, combat: { fa: 'نبرد', bg: 'Combat' }, authority: { fa: 'اعتبار', bg: 'Authority' }, authorityS: { fa: 'اقتدار', bg: 'Authority' },
  scrap: { fa: 'اسقاط', bg: 'Scrap' }, scrapPool: { fa: 'نابودی', bg: 'Scrap' }, scrapped: { fa: 'نابودشده‌ها', bg: 'Scrapped' },
  base: { fa: 'پایگاه', bg: 'Base' }, baseP: { fa: 'پایگاه‌های', bg: 'Bases' }, outpost: { fa: 'پاسگاه', bg: 'Outpost' }, explorer: { fa: 'کاوشگر', bg: 'Explorer' },
  tradeRow: { fa: 'ردیف بازار', bg: 'Trade Row' }, tradeDeck: { fa: 'دستهٔ تجارت', bg: 'Trade Deck' }, market: { fa: 'بازار', bg: 'Trade Deck' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریز', bg: 'Discard' }, hand: { fa: 'دست', bg: 'Hand' },
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, cardI: { fa: 'کارتی', bg: 'a Card' },
  opp: { fa: 'حریف', bg: 'Opponent' }, faction: { fa: 'گروه', bg: 'Faction' }, fleet: { fa: 'ناوگان', bg: 'Fleet' }, inPlay: { fa: 'ناوهای بازی‌شده', bg: 'In Play' },
  allyAbility: { fa: 'توانایی هم‌پیمان', bg: 'Ally ability' }, play: { fa: 'بازی', bg: 'Play' }, attack: { fa: 'حمله', bg: 'Attack' },
  buyV: { fa: 'بخرید', bg: 'Buy' }, buyN: { fa: 'خرید', bg: 'Buy' }, destroyN: { fa: 'نابود کردن', bg: 'Destroy' }, destroyed: { fa: 'نابودی', bg: 'Destroy' },
  discardV: { fa: 'دور بریزید', bg: 'Discard' }, discardN: { fa: 'دور ریختن', bg: 'Discard' }, endTurn: { fa: 'پایان نوبت', bg: 'End Turn' },
  scrapRowFx: { fa: 'پاک‌سازی بازار', bg: 'Scrap Trade Row' }, scrapRowBtn: { fa: 'پاک کردن', bg: 'Scrap' },
  fed: { fa: 'فدراسیون', bg: 'Trade Federation' }, blob: { fa: 'هیولاها', bg: 'Blob' }, cult: { fa: 'ماشین‌پرستان', bg: 'Machine Cult' }, emp: { fa: 'امپراتوری', bg: 'Star Empire' }
} satisfies Record<string, Term>;

/** Official English card names by engine type (the Persian names come from the engine's own table). */
const CARD_EN: Record<string, string> = {
  scout: 'Scout', viper: 'Viper', explorer: 'Explorer',
  shuttle: 'Federation Shuttle', cutter: 'Cutter', yacht: 'Embassy Yacht', freighter: 'Freighter', flagship: 'Flagship', command: 'Command Ship',
  tradepost: 'Trading Post', barter: 'Barter World', port: 'Port of Call',
  bfighter: 'Blob Fighter', tradepod: 'Trade Pod', battlepod: 'Battle Pod', ram: 'Ram', wheel: 'Blob Wheel', destroyer: 'Blob Destroyer', mothership: 'Mothership', blobworld: 'Blob World',
  tradebot: 'Trade Bot', battlebot: 'Battle Mech', supplybot: 'Supply Bot', patrol: 'Patrol Mech', station: 'Battle Station', machinebase: 'Mech World', missile: 'Missile Mech',
  ifighter: 'Imperial Fighter', frigate: 'Imperial Frigate', corvette: 'Corvette', survey: 'Survey Ship', spacestation: 'Space Station', cruiser: 'Battlecruiser', redoubt: 'Royal Redoubt', dreadnaught: 'Dreadnaught'
};
export const cardName = (key: string): string => tx({ fa: TYPE[key]!.name, bg: CARD_EN[key] ?? TYPE[key]!.name });
