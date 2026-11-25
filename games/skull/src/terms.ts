import type { Term } from '@bg/ui';

/** Skull terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  skull: { fa: 'جمجمه', bg: 'Skull' }, rose: { fa: 'گل', bg: 'Rose' },
  bid: { fa: 'پیشنهاد', bg: 'Bid' }, pass: { fa: 'پاس', bg: 'Pass' }
} satisfies Record<string, Term>;
