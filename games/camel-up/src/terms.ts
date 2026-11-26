import type { Term } from '@bg/ui';

/** Camel Up terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  pyramid: { fa: 'هرم', bg: 'Pyramid' }, desertTile: { fa: 'کاشی بیابان', bg: 'Desert Tile' },
  oasis: { fa: 'واحه', bg: 'Oasis' }, mirage: { fa: 'سراب', bg: 'Mirage' },
  legBet: { fa: 'شرط مرحله', bg: 'Leg Bet' }, overallBet: { fa: 'شرط نهایی', bg: 'Overall Bet' }
} satisfies Record<string, Term>;
