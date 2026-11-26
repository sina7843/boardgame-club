import type { Term } from '@bg/ui';

/** The Mind terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  level: { fa: 'مرحله', bg: 'Level' }, life: { fa: 'جان', bg: 'Life' }
} satisfies Record<string, Term>;
