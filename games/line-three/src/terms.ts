import type { Term } from '@bg/ui';

/** Line Three (tic-tac-toe) terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  mark: { fa: 'نشان', bg: 'Mark' }, row: { fa: 'ردیف', bg: 'Row' }, column: { fa: 'ستون', bg: 'Column' },
  diagonal: { fa: 'قطر', bg: 'Diagonal' }, draw: { fa: 'مساوی', bg: 'Draw' }, cell: { fa: 'خانه', bg: 'Cell' },
  firstPlayer: { fa: 'شروع‌کننده', bg: 'First player' }, secondPlayer: { fa: 'نفر دوم', bg: 'Second player' }
} satisfies Record<string, Term>;
