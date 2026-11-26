import type { Term } from '@bg/ui';

/** Santorini terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  worker: { fa: 'کارگر', bg: 'Worker' }, workers: { fa: 'کارگرها', bg: 'Workers' },
  dome: { fa: 'گنبد', bg: 'Dome' }, build: { fa: 'ساخت', bg: 'Build' },
  buildImp: { fa: 'بسازید', bg: 'Build' }, level: { fa: 'طبقه', bg: 'Level' }, levelEz: { fa: 'طبقهٔ', bg: 'Level' },
  blocks: { fa: 'بلوک‌ها', bg: 'Blocks' }, ground: { fa: 'زمین', bg: 'Ground' }
} satisfies Record<string, Term>;
