import type { Term } from '@bg/ui';

/** No Thanks! terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  noThanks: { fa: 'نه، مرسی!', bg: 'No Thanks!' }, chip: { fa: 'ژتون', bg: 'Chip' }
} satisfies Record<string, Term>;
