import type { Term } from '@bg/ui';

/** Scout terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  scout: { fa: 'دیدبانی', bg: 'Scout' }, show: { fa: 'نمایش', bg: 'Show' },
  scoutAndShow: { fa: 'دیدبانی و نمایش', bg: 'Scout & Show' }
} satisfies Record<string, Term>;
