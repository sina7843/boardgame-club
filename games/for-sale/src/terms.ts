import type { Term } from '@bg/ui';

/** For Sale terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  property: { fa: 'ملک', bg: 'Property' }, cheque: { fa: 'چک', bg: 'Cheque' }, bid: { fa: 'پیشنهاد', bg: 'Bid' }
,
  coin: { fa: 'سکه', bg: 'Coin' }, deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' }, phase: { fa: 'مرحله', bg: 'Phase' }, buy: { fa: 'خرید', bg: 'Buy' }, sell: { fa: 'فروش', bg: 'Sell' },
  properties: { fa: 'املاک', bg: 'Properties' }, propertyYi: { fa: 'ملکی', bg: 'a Property' }, chequesEz: { fa: 'چک‌های', bg: 'Cheques' },
  passN: { fa: 'کنار کشیدن', bg: 'Pass' }, passV: { fa: 'کنار می‌کشید', bg: 'Pass' }, passPol: { fa: 'کنار بکشید', bg: 'Pass' }, passMe: { fa: 'کنار می‌کشم', bg: 'Pass' }, passed: { fa: 'کنار کشید', bg: 'Passed' },
  bidYour: { fa: 'پیشنهادتان', bg: 'Bid' }, highest: { fa: 'بالاترین', bg: 'Highest' }
} satisfies Record<string, Term>;
