import type { Term } from '@bg/ui';

/** Uno terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  skip: { fa: 'ردشدن', bg: 'Skip' }, reverse: { fa: 'برگشت', bg: 'Reverse' },
  wild: { fa: 'رنگی', bg: 'Wild' }, wildDrawFour: { fa: 'رنگی +۴', bg: 'Wild Draw Four' },
  uno: { fa: 'اونو', bg: 'UNO' }
} satisfies Record<string, Term>;
