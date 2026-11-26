import type { Term } from '@bg/ui';

/** Othello terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  disc: { fa: 'مهره', bg: 'Disc' }, discEz: { fa: 'مهرهٔ', bg: 'Disc' }, discs: { fa: 'مهره‌های', bg: 'Discs' },
  flip: { fa: 'برمی‌گردند', bg: 'Flip' }, flipOne: { fa: 'برمی‌گردد', bg: 'Flip' }, passed: { fa: 'رد شد', bg: 'Passed' }
} satisfies Record<string, Term>;
