import type { Term } from '@bg/ui';

/** Kingdomino terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  domino: { fa: 'دومینو', bg: 'Domino' }, dominoOf: { fa: 'دومینوی', bg: 'Domino' }, crown: { fa: 'تاج', bg: 'Crown' }, castle: { fa: 'قلعه', bg: 'Castle' },
  kingdom: { fa: 'سرزمین', bg: 'Kingdom' },
  wheat: { fa: 'گندم‌زار', bg: 'Wheat' }, forest: { fa: 'جنگل', bg: 'Forest' }, lake: { fa: 'دریاچه', bg: 'Lake' },
  grassland: { fa: 'چمنزار', bg: 'Grassland' }, swamp: { fa: 'باتلاق', bg: 'Swamp' }, mine: { fa: 'معدن', bg: 'Mine' },
  largestArea: { fa: 'بزرگ‌ترین ناحیه', bg: 'Largest area' }
} satisfies Record<string, Term>;
