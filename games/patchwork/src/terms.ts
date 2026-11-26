import type { Term } from '@bg/ui';

/** Patchwork terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  patch: { fa: 'تکه', bg: 'Patch' }, patchOf: { fa: 'تکهٔ', bg: 'Patch' }, patches: { fa: 'تکه‌ها', bg: 'Patches' },
  button: { fa: 'دکمه', bg: 'Button' }, buttons: { fa: 'دکمه‌های', bg: 'Buttons' }, quilt: { fa: 'لحاف', bg: 'Quilt' },
  leather: { fa: 'تکهٔ چرمی', bg: 'Leather patch' }, income: { fa: 'درآمد', bg: 'Income' }, neutral: { fa: 'مهرهٔ خنثی', bg: 'Neutral token' },
  timeTrack: { fa: 'مسیر زمان', bg: 'Time track' }, time: { fa: 'زمان', bg: 'Time' },
  rotate: { fa: 'چرخاندن', bg: 'Rotate' }, flip: { fa: 'برعکس کردن', bg: 'Flip' }, place: { fa: 'بدوز', bg: 'Place' },
  advance: { fa: 'جلو رفتن', bg: 'Advance' }, advanceV: { fa: 'جلو بروید', bg: 'Advance' }, advanceTo: { fa: 'جلوتر از حریف بروید', bg: 'Advance past your opponent' }, buyV: { fa: 'بخرید', bg: 'Buy' },
  emptySquare: { fa: 'خانهٔ خالی', bg: 'Empty space' }, empty: { fa: 'خالی', bg: 'Empty' },
  cornerEz: { fa: 'گوشهٔ', bg: 'Corner' }, row: { fa: 'ردیف', bg: 'Row' }, column: { fa: 'ستون', bg: 'Column' },
  tile: { fa: 'کاشی', bg: 'Tile' }, taken: { fa: 'گرفته شد', bg: 'Taken' }, goneW: { fa: 'رفت', bg: 'Taken' }, free: { fa: 'آزاد', bg: 'Free' }, stillFree: { fa: 'هنوز آزاد است', bg: 'still available' },
  score: { fa: 'امتیاز', bg: 'Score' }, bonus77: { fa: 'پاداش ۷×۷', bg: '7×7 Bonus' }, pocket: { fa: 'جیب دکمه', bg: 'Button pocket' },
  buttonAdj: { fa: 'دکمه‌ای', bg: 'Button' }, spaceEz: { fa: 'خانهٔ', bg: 'space' }, spaces: { fa: 'خانه', bg: 'spaces' }, pawn: { fa: 'مهره', bg: 'Pawn' }
} satisfies Record<string, Term>;
