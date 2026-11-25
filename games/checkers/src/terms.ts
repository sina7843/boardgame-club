import type { Term } from '@bg/ui';

/** Checkers terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  king: { fa: 'شاه', bg: 'King' }, flyingKing: { fa: 'شاه پرنده', bg: 'Flying king' }
} satisfies Record<string, Term>;
