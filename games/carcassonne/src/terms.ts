import type { Term } from '@bg/ui';

/** Carcassonne terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  meeple: { fa: 'پیرو', bg: 'Meeple' }, city: { fa: 'شهر', bg: 'City' },
  road: { fa: 'جاده', bg: 'Road' }, monastery: { fa: 'صومعه', bg: 'Monastery' }
} satisfies Record<string, Term>;
