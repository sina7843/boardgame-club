import type { Term } from '@bg/ui';

/** El Dorado terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Card names: see CARD_EN (Persian names live in the rules data). */
export const terms = {
  machete: { fa: 'قمه', bg: 'Machete' }, paddle: { fa: 'پارو', bg: 'Paddle' }, coin: { fa: 'سکه', bg: 'Coin' }, coins: { fa: 'سکه', bg: 'Coins' },
  joker: { fa: 'همه‌کاره', bg: 'Joker' }, rubble: { fa: 'آوار', bg: 'Rubble' }, camp: { fa: 'اردوگاه', bg: 'Base Camp' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریز', bg: 'Discard' }, market: { fa: 'بازار', bg: 'Market' },
  jungle: { fa: 'جنگل', bg: 'Jungle' }, water: { fa: 'آب', bg: 'Water' }, village: { fa: 'روستا', bg: 'Village' }, mountain: { fa: 'کوه', bg: 'Mountain' }, start: { fa: 'شروع', bg: 'Start' },
  card: { fa: 'کارت', bg: 'Card' }, cardOne: { fa: 'کارتی', bg: 'Card' }, hand: { fa: 'دست', bg: 'Hand' },
  drawImp: { fa: 'بکش', bg: 'Draw' }, freeMove: { fa: 'حرکت آزاد', bg: 'Free move' }, singleUse: { fa: 'یک‌بار مصرف', bg: 'Single use' },
  map: { fa: 'نقشه', bg: 'Map' }, moveTo: { fa: 'رفتن به', bg: 'Move to' }, arrived: { fa: 'رسید', bg: 'Arrived' }, distance: { fa: 'فاصله', bg: 'Distance' },
  use: { fa: 'استفاده', bg: 'Use' }, continueWith: { fa: 'ادامه با', bg: 'Continue with' }, buyImp: { fa: 'بخرید', bg: 'Buy' }, boughtThisTurn: { fa: 'این نوبت خرید شد', bg: 'Bought this turn' },
  hex: { fa: 'خانه', bg: 'Hex' }, hexEz: { fa: 'خانهٔ', bg: 'Hex' }, hexesEz: { fa: 'خانه‌های', bg: 'Hexes' }, entryCost: { fa: 'هزینهٔ ورود', bg: 'Entry cost' },
  discardV: { fa: 'دور ریختن', bg: 'Discard' }, forRubble: { fa: 'برای', bg: 'For' }, endTurn: { fa: 'پایان نوبت', bg: 'End turn' },
  endTurnDiscard: { fa: 'پایان نوبت و دور ریختن دست', bg: 'End turn and discard hand' }
} satisfies Record<string, Term>;

/** English card names by card key. */
export const CARD_EN: Record<string, string> = {
  explorer: 'Explorer', sailor: 'Sailor', traveller: 'Traveller', scout: 'Scout', trailblazer: 'Trailblazer', pioneer: 'Pioneer',
  machete: 'Giant Machete', captain: 'Captain', photographer: 'Photographer', journalist: 'Journalist', chest: 'Treasure Chest',
  millionaire: 'Millionaire', jack: 'Jack of all Trades', adventurer: 'Adventurer', plane: 'Propeller Plane', cartographer: 'Cartographer',
  compass: 'Compass', scientist: 'Scientist', native: 'Native'
};
