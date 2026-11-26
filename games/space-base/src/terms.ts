import type { Term } from '@bg/ui';

/** Space Base terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  ship: { fa: 'ناو', bg: 'Ship' }, credits: { fa: 'اعتبار', bg: 'Credits' }, income: { fa: 'درآمد', bg: 'Income' },
  sector: { fa: 'بخش', bg: 'Sector' }, sectorsPl: { fa: 'بخش‌های', bg: 'Sectors' }, sectorPl: { fa: 'بخش‌ها', bg: 'Sectors' },
  die: { fa: 'تاس', bg: 'Die' }, dicePl: { fa: 'تاس‌ها', bg: 'Dice' }, diceOne: { fa: 'تاسی', bg: 'a die' },
  rollYou: { fa: 'بریزید', bg: 'Roll' }, rollGer: { fa: 'ریختن', bg: 'Roll' }, sum: { fa: 'جمع', bg: 'Sum' }, activate: { fa: 'فعال کنید', bg: 'Activate' },
  buy: { fa: 'خرید', bg: 'Buy' }, buyYou: { fa: 'بخرید', bg: 'Buy' }, deployed: { fa: 'مستقر', bg: 'Deployed' }, yard: { fa: 'کارگاه', bg: 'Shipyard' },
  deckEz: { fa: 'دستهٔ', bg: 'Deck' }, vp: { fa: 'امتیاز', bg: 'VP' }
} satisfies Record<string, Term>;
