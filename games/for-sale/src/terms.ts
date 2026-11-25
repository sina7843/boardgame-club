import type { Term } from '@bg/ui';

/** For Sale terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  property: { fa: 'ملک', bg: 'Property' }, cheque: { fa: 'چک', bg: 'Cheque' }, bid: { fa: 'پیشنهاد', bg: 'Bid' }
} satisfies Record<string, Term>;
