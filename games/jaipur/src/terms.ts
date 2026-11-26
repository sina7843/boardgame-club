import type { Term } from '@bg/ui';

/** Jaipur terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  diamond: { fa: 'الماس', bg: 'Diamonds' }, gold: { fa: 'طلا', bg: 'Gold' }, silver: { fa: 'نقره', bg: 'Silver' },
  cloth: { fa: 'پارچه', bg: 'Cloth' }, spice: { fa: 'ادویه', bg: 'Spice' }, leather: { fa: 'چرم', bg: 'Leather' },
  camel: { fa: 'شتر', bg: 'Camel' }, herd: { fa: 'گلهٔ', bg: 'Herd' }
} satisfies Record<string, Term>;
