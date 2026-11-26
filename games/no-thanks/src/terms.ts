import type { Term } from '@bg/ui';

/** No Thanks! terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  noThanks: { fa: 'نه، مرسی!', bg: 'No Thanks!' }, chip: { fa: 'ژتون', bg: 'Chip' }
,
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, cardYi: { fa: 'کارتی', bg: 'a Card' }, deck: { fa: 'دسته', bg: 'Deck' }, cardPoints: { fa: 'امتیاز کارت‌ها', bg: 'Card Points' }, pot: { fa: 'سکه وسط', bg: 'Pot' },
  chips: { fa: 'ژتون‌ها', bg: 'Chips' }, chipsEz: { fa: 'ژتون‌های', bg: 'Chips' }, runEz: { fa: 'رشتهٔ', bg: 'Run' },
  takeV: { fa: 'بردارید', bg: 'Take' }, passV: { fa: 'رد کنید', bg: 'Pass' }, takeMe: { fa: 'برمی‌دارم', bg: 'Take' }
} satisfies Record<string, Term>;
