import type { Term } from '@bg/ui';

/** High Society terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  prestige: { fa: 'افتخار', bg: 'Prestige' }, passe: { fa: 'از مد افتاده', bg: 'Passé' }, scandal: { fa: 'رسوایی', bg: 'Scandal' },
  faux: { fa: 'گاف', bg: 'Faux Pas' }, disgrace: { fa: 'رسوایی', bg: 'Disgrace' }, bid: { fa: 'پیشنهاد', bg: 'Bid' }
} satisfies Record<string, Term>;
