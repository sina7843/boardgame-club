import type { Term } from '@bg/ui';

/** Sea Salt & Paper terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  duo: { fa: 'جفت', bg: 'Duo' }, stop: { fa: 'بس', bg: 'Stop' }, lastChance: { fa: 'آخرین فرصت', bg: 'Last Chance' },
  crab: { fa: 'خرچنگ', bg: 'Crab' }, boat: { fa: 'قایق', bg: 'Boat' }, fish: { fa: 'ماهی', bg: 'Fish' },
  swimmer: { fa: 'شناگر', bg: 'Swimmer' }, shark: { fa: 'کوسه', bg: 'Shark' }, shell: { fa: 'صدف', bg: 'Shell' },
  octopus: { fa: 'هشت‌پا', bg: 'Octopus' }, penguin: { fa: 'پنگوئن', bg: 'Penguin' }, sailor: { fa: 'ملوان', bg: 'Sailor' },
  lighthouse: { fa: 'فانوس', bg: 'Lighthouse' }, shoal: { fa: 'دسته‌ماهی', bg: 'Shoal of Fish' },
  colony: { fa: 'کلونی', bg: 'Penguin Colony' }, captain: { fa: 'ناخدا', bg: 'Captain' }, mermaid: { fa: 'پری دریایی', bg: 'Mermaid' }
} satisfies Record<string, Term>;
