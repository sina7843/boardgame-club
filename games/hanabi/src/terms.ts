import type { Term } from '@bg/ui';

/** Hanabi terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  clue: { fa: 'سرنخ', bg: 'Hint' }, fuse: { fa: 'فیوز', bg: 'Fuse' }
,
  clueSign: { fa: 'نشانه', bg: 'Hint' }, clueToken: { fa: 'ژتون سرنخ', bg: 'Hint token' }, token: { fa: 'ژتون', bg: 'Token' }, giveImp: { fa: 'بده', bg: 'Give' },
  card: { fa: 'کارت', bg: 'Card' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' }, deck: { fa: 'دسته', bg: 'Deck' }, fireworks: { fa: 'آتش‌بازی‌ها', bg: 'Fireworks' },
  playV: { fa: 'بازی کنید', bg: 'Play' }, playN: { fa: 'بازی', bg: 'Play' }, playP: { fa: 'بازی کرد', bg: 'Played' },
  discardV: { fa: 'دور بیندازید', bg: 'Discard' }, discardN: { fa: 'دور انداختن', bg: 'Discard' }, discardP: { fa: 'دور انداخت', bg: 'Discarded' },
  discards: { fa: 'دورریخته‌ها', bg: 'Discards' }, discarded: { fa: 'دورریخته', bg: 'Discard' }
} satisfies Record<string, Term>;
