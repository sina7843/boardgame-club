import type { Term } from '@bg/ui';

/** Tak terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  flat: { fa: 'سنگ تخت', bg: 'Flat stone' }, wall: { fa: 'دیوار', bg: 'Standing stone' },
  cap: { fa: 'سرستون', bg: 'Capstone' }, road: { fa: 'جاده', bg: 'Road' }
} satisfies Record<string, Term>;
