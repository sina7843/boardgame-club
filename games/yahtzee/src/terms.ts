import type { Term } from '@bg/ui';

/** Yahtzee terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  threeKind: { fa: 'سه‌تایی', bg: 'Three of a Kind' }, fourKind: { fa: 'چهارتایی', bg: 'Four of a Kind' },
  fullHouse: { fa: 'فول‌هاوس', bg: 'Full House' }, smallStraight: { fa: 'ردیف کوچک', bg: 'Small Straight' },
  largeStraight: { fa: 'ردیف بزرگ', bg: 'Large Straight' }, yahtzee: { fa: 'یاتزی', bg: 'Yahtzee' },
  chance: { fa: 'شانس', bg: 'Chance' }, bonus: { fa: 'پاداش', bg: 'Bonus' },
  upperSection: { fa: 'بخش بالا', bg: 'Upper Section' }, lowerSection: { fa: 'بخش پایین', bg: 'Lower Section' }
} satisfies Record<string, Term>;
