import type { Term } from '@bg/ui';

/** Carcassonne terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». `*Ez` variants carry the Persian ezafe. */
export const terms = {
  meeple: { fa: 'پیرو', bg: 'Meeple' }, meepleHud: { fa: 'سرباز', bg: 'Meeple' }, city: { fa: 'شهر', bg: 'City' },
  road: { fa: 'جاده', bg: 'Road' }, roadEz: { fa: 'جادهٔ', bg: 'Road' }, monastery: { fa: 'صومعه', bg: 'Monastery' }, monasteryEz: { fa: 'صومعهٔ', bg: 'Monastery' },
  tile: { fa: 'کاشی', bg: 'Tile' }, shield: { fa: 'سپر', bg: 'Shield' }, rotate: { fa: 'چرخاندن', bg: 'Rotate' }
} satisfies Record<string, Term>;
