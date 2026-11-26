import type { Term } from '@bg/ui';

/** Patchwork terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  patch: { fa: 'تکه', bg: 'Patch' }, patchOf: { fa: 'تکهٔ', bg: 'Patch' }, patches: { fa: 'تکه‌ها', bg: 'Patches' },
  button: { fa: 'دکمه', bg: 'Button' }, buttons: { fa: 'دکمه‌های', bg: 'Buttons' }, quilt: { fa: 'لحاف', bg: 'Quilt' },
  leather: { fa: 'تکهٔ چرمی', bg: 'Leather patch' }, income: { fa: 'درآمد', bg: 'Income' }, neutral: { fa: 'مهرهٔ خنثی', bg: 'Neutral token' },
  timeTrack: { fa: 'مسیر زمان', bg: 'Time track' }, time: { fa: 'زمان', bg: 'Time' }
} satisfies Record<string, Term>;
