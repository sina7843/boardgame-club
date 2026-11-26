import type { Term } from '@bg/ui';

/** Tak terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  flat: { fa: 'سنگ تخت', bg: 'Flat stone' }, wall: { fa: 'دیوار', bg: 'Standing stone' },
  cap: { fa: 'سرستون', bg: 'Capstone' }, road: { fa: 'جاده', bg: 'Road' },
  roadIndef: { fa: 'جاده‌ای', bg: 'Road' }, stone: { fa: 'سنگ', bg: 'Stone' }, stones: { fa: 'سنگ‌ها', bg: 'Stones' },
  flats: { fa: 'سنگ‌های تخت', bg: 'Flats' }, stack: { fa: 'پشته', bg: 'Stack' }, stackIndef: { fa: 'پشته‌ای', bg: 'Stack' },
  place: { fa: 'گذاشتن', bg: 'Place' }, lift: { fa: 'برداشتن', bg: 'Pick up' }
} satisfies Record<string, Term>;
