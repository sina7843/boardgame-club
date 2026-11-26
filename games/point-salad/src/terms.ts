import type { Term } from '@bg/ui';

/** Point Salad terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  pointCard: { fa: 'دستور', bg: 'Point Card' }, pointCards: { fa: 'دستورها', bg: 'Point Cards' },
  rule: { fa: 'قانون', bg: 'Point Cards' },
  veggie: { fa: 'سبزی', bg: 'Veggie' }, pile: { fa: 'دسته', bg: 'Pile' }, pileEz: { fa: 'دستهٔ', bg: 'Pile' },
  market: { fa: 'بازار', bg: 'Market' }, cards: { fa: 'کارت', bg: 'cards' }, empty: { fa: 'خالی', bg: 'Empty' },
  take: { fa: 'برداشتن', bg: 'Take' }, flipToVeg: { fa: 'برگرداندن به سبزی', bg: 'Flip to Veggie' },
  tomato: { fa: 'گوجه', bg: 'Tomato' }, lettuce: { fa: 'کاهو', bg: 'Lettuce' }, carrot: { fa: 'هویج', bg: 'Carrot' },
  cabbage: { fa: 'کلم', bg: 'Cabbage' }, pepper: { fa: 'فلفل', bg: 'Pepper' }, onion: { fa: 'پیاز', bg: 'Onion' },
  even: { fa: 'زوج', bg: 'Even' }, odd: { fa: 'فرد', bg: 'Odd' }, most: { fa: 'بیشترین', bg: 'Most' }, fewest: { fa: 'کمترین', bg: 'Fewest' },
  mostTotal: { fa: 'بیشترین سبزی کل', bg: 'Most Veggies' }, fewestTotal: { fa: 'کمترین سبزی کل', bg: 'Fewest Veggies' },
  setOfSix: { fa: 'هر دست شش‌تایی', bg: 'Set of 6' },
  tookPointCard: { fa: 'یک دستور برداشت', bg: 'Took a Point Card' },
  tookPointCardFlipped: { fa: 'یک دستور برداشت، یک دستور را برگرداند', bg: 'Took a Point Card, flipped a Point Card' }
} satisfies Record<string, Term>;
