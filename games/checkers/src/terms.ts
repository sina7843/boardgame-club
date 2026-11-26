import type { Term } from '@bg/ui';

/** Checkers terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  king: { fa: 'شاه', bg: 'King' }, flyingKing: { fa: 'شاه پرنده', bg: 'Flying king' },
  piece: { fa: 'مهره', bg: 'Piece' }, pieces: { fa: 'مهره‌ها', bg: 'Pieces' }, pieceIndef: { fa: 'مهره‌ای', bg: 'Piece' },
  capture: { fa: 'زدن', bg: 'Capture' }, jump: { fa: 'گرفتن', bg: 'Capture' }, kingRow: { fa: 'ردیف آخر', bg: 'King row' },
  draw: { fa: 'مساوی', bg: 'Draw' }, drawAlt: { fa: 'تساوی', bg: 'Draw' }, threefold: { fa: 'تکرار سه‌باره', bg: 'Threefold repetition' }
} satisfies Record<string, Term>;
