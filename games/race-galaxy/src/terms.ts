import type { Term } from '@bg/ui';

/** Race for the Galaxy terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  explore: { fa: 'کاوش', bg: 'Explore' }, develop: { fa: 'توسعه', bg: 'Develop' }, settle: { fa: 'استقرار', bg: 'Settle' },
  consume: { fa: 'مصرف', bg: 'Consume' }, produce: { fa: 'تولید', bg: 'Produce' },
  development: { fa: 'پیشرفت', bg: 'Development' }, world: { fa: 'جهان', bg: 'World' }, military: { fa: 'نظامی', bg: 'Military' },
  windfall: { fa: 'بادآورده', bg: 'Windfall' }, production: { fa: 'تولیدی', bg: 'Production' },
  goods: { fa: 'کالا', bg: 'Goods' }, goodsPl: { fa: 'کالاها', bg: 'Goods' },
  chip: { fa: 'نشان', bg: 'VP chip' }, vpPool: { fa: 'مخزن امتیاز', bg: 'VP pool' },
  discard: { fa: 'دورریخته', bg: 'Discard' },
  card: { fa: 'کارت', bg: 'Card' }, cardOne: { fa: 'کارتی', bg: 'A card' }, drawnCards: { fa: 'کارت‌های کشیده', bg: 'Drawn cards' },
  draw: { fa: 'بکش', bg: 'Draw' }, keepImp: { fa: 'نگه دار', bg: 'Keep' }, keepYou: { fa: 'نگه دارید', bg: 'Keep' },
  placeImp: { fa: 'بگذار', bg: 'Place' }, placeGer: { fa: 'گذاشتن', bg: 'Place' }, skip: { fa: 'صرف‌نظر', bg: 'Skip' }, skipYou: { fa: 'صرف‌نظر کنید', bg: 'Skip' },
  pay: { fa: 'پرداخت', bg: 'Pay' }, cost: { fa: 'هزینه', bg: 'Cost' }, chooser: { fa: 'انتخاب‌کننده', bg: 'Chooser' }, bonus: { fa: 'جایزه', bg: 'Bonus' },
  vp: { fa: 'امتیاز', bg: 'VP' }, vpBank: { fa: 'بانک امتیاز', bg: 'VP pool' }, vpChip: { fa: 'ژتون', bg: 'VP chip' },
  phase: { fa: 'مرحله', bg: 'Phase' }, phaseEz: { fa: 'مرحلهٔ', bg: 'Phase' }, phasePl: { fa: 'مرحله‌ها', bg: 'Phases' }, phasePlEz: { fa: 'مرحله‌های', bg: 'Phases' },
  round: { fa: 'دور', bg: 'Round' }, deck: { fa: 'دسته', bg: 'Deck' }, hand: { fa: 'دست', bg: 'Hand' }, handYou: { fa: 'دست شما', bg: 'Your hand' }, handYour: { fa: 'دستتان', bg: 'Your hand' },
  empires: { fa: 'امپراتوری‌ها', bg: 'Empires' }
} satisfies Record<string, Term>;
