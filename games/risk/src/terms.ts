import type { Term } from '@bg/ui';

/** Risk terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  reinforcement: { fa: 'نیروی کمکی', bg: 'Reinforcement' }, fortify: { fa: 'جابه‌جایی', bg: 'Fortify' }, blitz: { fa: 'حمله سریع', bg: 'Blitz' }
} satisfies Record<string, Term>;
