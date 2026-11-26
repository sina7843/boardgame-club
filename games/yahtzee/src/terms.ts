import type { Term } from '@bg/ui';

/** Yahtzee terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  threeKind: { fa: 'سه‌تایی', bg: 'Three of a Kind' }, fourKind: { fa: 'چهارتایی', bg: 'Four of a Kind' },
  fullHouse: { fa: 'فول‌هاوس', bg: 'Full House' }, smallStraight: { fa: 'ردیف کوچک', bg: 'Small Straight' },
  largeStraight: { fa: 'ردیف بزرگ', bg: 'Large Straight' }, yahtzee: { fa: 'یاتزی', bg: 'Yahtzee' },
  chance: { fa: 'شانس', bg: 'Chance' }, bonus: { fa: 'پاداش', bg: 'Bonus' },
  upperSection: { fa: 'بخش بالا', bg: 'Upper Section' }, lowerSection: { fa: 'بخش پایین', bg: 'Lower Section' },
  ones: { fa: 'یک‌ها', bg: 'Ones' }, twos: { fa: 'دوها', bg: 'Twos' }, threes: { fa: 'سه‌ها', bg: 'Threes' },
  fours: { fa: 'چهارها', bg: 'Fours' }, fives: { fa: 'پنج‌ها', bg: 'Fives' }, sixes: { fa: 'شش‌ها', bg: 'Sixes' },
  upperBonus: { fa: 'پاداش بخش بالا', bg: 'Upper Section Bonus' }, upperTotal: { fa: 'جمع بالا', bg: 'Upper Total' }, grandTotal: { fa: 'امتیاز کل', bg: 'Grand Total' },
  upper: { fa: 'بالا', bg: 'Upper' }, box: { fa: 'خانه', bg: 'Box' }, boxesThat: { fa: 'خانه‌هایی', bg: 'Boxes' }, round: { fa: 'دور', bg: 'Round' },
  die: { fa: 'تاس', bg: 'Die' }, dice: { fa: 'تاس‌ها', bg: 'Dice' }, diceThat: { fa: 'تاس‌هایی', bg: 'Dice' }, dieAny: { fa: 'تاسی', bg: 'a Die' },
  rollBtn: { fa: 'بریز', bg: 'Roll' }, rerollBtn: { fa: 'دوباره بریز', bg: 'Roll Again' }, rollPrompt: { fa: 'تاس بریزید', bg: 'Roll the dice' }, rolls: { fa: 'ریختن', bg: 'Rolls' },
  keep: { fa: 'نگه‌دار', bg: 'Keep' }, kept: { fa: 'نگه داشته شده', bg: 'Kept' }, scoreBtn: { fa: 'ثبت در جدول', bg: 'Score' }, jokerRule: { fa: 'قانون جوکر', bg: 'Joker Rule' }
} satisfies Record<string, Term>;
