import type { Term } from '@bg/ui';

/** Coup terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  duke: { fa: 'دوک', bg: 'Duke' }, assassin: { fa: 'آدم‌کش', bg: 'Assassin' }, captain: { fa: 'کاپیتان', bg: 'Captain' },
  ambassador: { fa: 'سفیر', bg: 'Ambassador' }, contessa: { fa: 'کنتس', bg: 'Contessa' },
  income: { fa: 'درآمد', bg: 'Income' }, foreignAid: { fa: 'کمک خارجی', bg: 'Foreign Aid' }, coup: { fa: 'کودتا', bg: 'Coup' },
  tax: { fa: 'مالیات', bg: 'Tax' }, assassinate: { fa: 'ترور', bg: 'Assassinate' }, steal: { fa: 'دزدی', bg: 'Steal' },
  exchange: { fa: 'مبادله', bg: 'Exchange' }, challenge: { fa: 'چالش', bg: 'Challenge' }, block: { fa: 'جلوگیری', bg: 'Block' },
  influence: { fa: 'نفوذ', bg: 'Influence' }
} satisfies Record<string, Term>;
