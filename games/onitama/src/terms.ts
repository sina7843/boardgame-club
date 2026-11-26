import type { Term } from '@bg/ui';

/** Onitama terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  master: { fa: 'استاد', bg: 'Master' }, student: { fa: 'شاگرد', bg: 'Student' }, temple: { fa: 'معبد', bg: 'Temple Arch' },
  wayStone: { fa: 'راه سنگ', bg: 'Way of the Stone' }, wayStream: { fa: 'راه رود', bg: 'Way of the Stream' },
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌های', bg: 'Cards' }, piece: { fa: 'مهره', bg: 'Piece' },
  swap: { fa: 'عوض کردن', bg: 'Swap' }, sideCard: { fa: 'کارت کنار صفحه', bg: 'Spare card' }, nextCard: { fa: 'کارت بعدی', bg: 'Next card' },
  draw: { fa: 'مساوی', bg: 'Draw' }, threefold: { fa: 'تکرار سه‌باره', bg: 'Threefold repetition' }
} satisfies Record<string, Term>;
