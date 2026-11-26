import type { Term } from '@bg/ui';

/** Catan terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Colour names stay Persian. */
export const terms = {
  robber: { fa: 'راهزن', bg: 'Robber' }, longestRoad: { fa: 'طولانی‌ترین جاده', bg: 'Longest Road' }, longestRoadAlt: { fa: 'بلندترین جاده', bg: 'Longest Road' },
  largestArmy: { fa: 'بزرگ‌ترین ارتش', bg: 'Largest Army' }, harbor: { fa: 'بندر', bg: 'Harbor' },
  devCard: { fa: 'کارت توسعه', bg: 'Development Card' }, devCards: { fa: 'کارت‌های توسعه', bg: 'Development Cards' },
  knight: { fa: 'شوالیه', bg: 'Knight' }, victoryPoint: { fa: 'امتیاز پیروزی', bg: 'Victory Point' },
  roadBuilding: { fa: 'جاده‌سازی', bg: 'Road Building' }, yearOfPlenty: { fa: 'سال فراوانی', bg: 'Year of Plenty' },
  monopoly: { fa: 'انحصار', bg: 'Monopoly' },
  brick: { fa: 'آجر', bg: 'Brick' }, brickAlt: { fa: 'خشت', bg: 'Brick' }, lumber: { fa: 'چوب', bg: 'Lumber' }, wool: { fa: 'پشم', bg: 'Wool' },
  grain: { fa: 'گندم', bg: 'Grain' }, ore: { fa: 'سنگ', bg: 'Ore' },
  hills: { fa: 'تپه', bg: 'Hills' }, forest: { fa: 'جنگل', bg: 'Forest' }, pasture: { fa: 'مرتع', bg: 'Pasture' }, fields: { fa: 'مزرعه', bg: 'Fields' },
  mountains: { fa: 'کوهستان', bg: 'Mountains' }, desert: { fa: 'بیابان', bg: 'Desert' },
  road: { fa: 'جاده', bg: 'Road' }, settlement: { fa: 'آبادی', bg: 'Settlement' }, city: { fa: 'شهر', bg: 'City' },
  dice: { fa: 'تاس', bg: 'Dice' }, diceP: { fa: 'تاس‌ها', bg: 'Dice' }, rollDice: { fa: 'ریختن تاس', bg: 'Roll dice' },
  bank: { fa: 'بانک', bg: 'Bank' }, trade: { fa: 'معامله', bg: 'Trade' }, tradedPast: { fa: 'معامله کرد', bg: 'traded' }, tradeOffer: { fa: 'پیشنهاد معامله', bg: 'Trade offer' },
  hex: { fa: 'شش‌ضلعی', bg: 'Hex' }, intersection: { fa: 'تقاطع', bg: 'Intersection' },
  resource: { fa: 'منبع', bg: 'Resource' }, resources: { fa: 'منابع', bg: 'Resources' }, resourceCard: { fa: 'کارت منبع', bg: 'Resource card' },
  card: { fa: 'کارت', bg: 'Card' }, cardsPl: { fa: 'کارت‌ها', bg: 'Cards' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, cardsYi: { fa: 'کارت‌هایی', bg: 'Cards' },
  discard: { fa: 'دور ریختن', bg: 'Discard' }, discardPast: { fa: 'دور ریخت', bg: 'discarded' }, discardImp: { fa: 'دور بریزید', bg: 'Discard' },
  discardMust: { fa: 'دور بریزد', bg: 'discard' }, discardNow: { fa: 'دور می‌ریزید', bg: 'discard' },
  steal: { fa: 'دزدی', bg: 'Steal' }, stealImp: { fa: 'بدزدید', bg: 'Steal' }, stealPast: { fa: 'دزدید', bg: 'stole' },
  buildV: { fa: 'ساختن', bg: 'Build' }, build: { fa: 'ساخت', bg: 'Build' }, buildPast: { fa: 'ساخت', bg: 'built' }, buildImp: { fa: 'بسازید', bg: 'Build' },
  buyPast: { fa: 'خرید', bg: 'bought' }, playedPast: { fa: 'بازی کرد', bg: 'played' }, production: { fa: 'تولید', bg: 'Production' },
  endTurn: { fa: 'پایان نوبت', bg: 'End turn' }, army: { fa: 'ارتش', bg: 'Army' }, roadLen: { fa: 'جاده بلند', bg: 'Road length' },
  deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' }, supply: { fa: 'مهره‌های باقی‌مانده', bg: 'Supply' },
  distanceRule: { fa: 'قاعده فاصله', bg: 'Distance rule' }, map: { fa: 'نقشه جزیره کاتان', bg: 'Catan island map' }, cost: { fa: 'هزینهٔ ساخت', bg: 'Building cost' }
} satisfies Record<string, Term>;
