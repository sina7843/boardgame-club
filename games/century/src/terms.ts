import type { Term } from '@bg/ui';

/** Century: Spice Road terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Spice names stay Persian. */
export const terms = {
  caravan: { fa: 'کاروان', bg: 'Caravan' }, merchant: { fa: 'تاجر', bg: 'Merchant' }, merchants: { fa: 'تاجرها', bg: 'Merchants' },
  upgrade: { fa: 'ارتقا', bg: 'Upgrade' }, trade: { fa: 'معاوضه', bg: 'Trade' }, rest: { fa: 'استراحت', bg: 'Rest' }
} satisfies Record<string, Term>;
