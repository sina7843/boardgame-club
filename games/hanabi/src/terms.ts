import type { Term } from '@bg/ui';

/** Hanabi terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  clue: { fa: 'سرنخ', bg: 'Hint' }, fuse: { fa: 'فیوز', bg: 'Fuse' }
} satisfies Record<string, Term>;
