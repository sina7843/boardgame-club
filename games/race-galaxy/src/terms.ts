import type { Term } from '@bg/ui';

/** Race for the Galaxy terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  explore: { fa: 'کاوش', bg: 'Explore' }, develop: { fa: 'توسعه', bg: 'Develop' }, settle: { fa: 'استقرار', bg: 'Settle' },
  consume: { fa: 'مصرف', bg: 'Consume' }, produce: { fa: 'تولید', bg: 'Produce' },
  development: { fa: 'پیشرفت', bg: 'Development' }, world: { fa: 'جهان', bg: 'World' }, military: { fa: 'نظامی', bg: 'Military' },
  windfall: { fa: 'بادآورده', bg: 'Windfall' }, production: { fa: 'تولیدی', bg: 'Production' },
  goods: { fa: 'کالا', bg: 'Goods' }, goodsPl: { fa: 'کالاها', bg: 'Goods' },
  chip: { fa: 'نشان', bg: 'VP chip' }, vpPool: { fa: 'مخزن امتیاز', bg: 'VP pool' },
  discard: { fa: 'دورریخته', bg: 'Discard' }
} satisfies Record<string, Term>;
