import type { Term } from '@bg/ui';

/** Love Letter terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  guard: { fa: 'نگهبان', bg: 'Guard' }, priest: { fa: 'کشیش', bg: 'Priest' }, baron: { fa: 'بارون', bg: 'Baron' },
  handmaid: { fa: 'ندیمه', bg: 'Handmaid' }, prince: { fa: 'شاهزاده', bg: 'Prince' }, king: { fa: 'شاه', bg: 'King' },
  countess: { fa: 'کنتس', bg: 'Countess' }, princess: { fa: 'شاهزاده‌خانم', bg: 'Princess' }
} satisfies Record<string, Term>;
