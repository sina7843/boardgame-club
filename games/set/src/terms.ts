import type { Term } from '@bg/ui';

/** Set terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  set: { fa: 'ست', bg: 'Set' },
  diamond: { fa: 'لوزی', bg: 'Diamond' }, squiggle: { fa: 'موج', bg: 'Squiggle' }, oval: { fa: 'بیضی', bg: 'Oval' },
  solid: { fa: 'توپر', bg: 'Solid' }, striped: { fa: 'هاشور', bg: 'Striped' }, open: { fa: 'توخالی', bg: 'Open' }
} satisfies Record<string, Term>;
