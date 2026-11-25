import type { Term } from '@bg/ui';

/** Go terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  pass: { fa: 'پاس', bg: 'Pass' }, komi: { fa: 'کومی', bg: 'Komi' }, capture: { fa: 'اسیر', bg: 'Captures' },
  territory: { fa: 'قلمرو', bg: 'Territory' }, ko: { fa: 'کو', bg: 'Ko' }, liberty: { fa: 'آزادی', bg: 'Liberty' }
} satisfies Record<string, Term>;
