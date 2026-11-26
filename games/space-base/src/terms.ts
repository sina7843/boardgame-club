import type { Term } from '@bg/ui';

/** Space Base terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  ship: { fa: 'ناو', bg: 'Ship' }, credits: { fa: 'اعتبار', bg: 'Credits' }, income: { fa: 'درآمد', bg: 'Income' }
} satisfies Record<string, Term>;
