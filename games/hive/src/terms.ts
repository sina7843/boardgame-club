import type { Term } from '@bg/ui';

/** Hive terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  queen: { fa: 'ملکه زنبور', bg: 'Queen Bee' }, queenShort: { fa: 'ملکه', bg: 'Queen Bee' },
  spider: { fa: 'عنکبوت', bg: 'Spider' }, beetle: { fa: 'سوسک', bg: 'Beetle' },
  grasshopper: { fa: 'ملخ', bg: 'Grasshopper' }, ant: { fa: 'مورچه', bg: 'Soldier Ant' },
  hive: { fa: 'کندو', bg: 'Hive' }, piece: { fa: 'مهره', bg: 'Piece' }, pieceEz: { fa: 'مهرهٔ', bg: 'Piece' }, pieceIndef: { fa: 'مهره‌ای', bg: 'Piece' },
  pieces: { fa: 'مهره‌های', bg: 'Pieces' }, reserve: { fa: 'ذخیره', bg: 'Reserve' }, reserveEz: { fa: 'ذخیرهٔ', bg: 'Reserve' },
  onTable: { fa: 'روی میز', bg: 'In play' }, draw: { fa: 'مساوی', bg: 'Draw' }, surrounded: { fa: 'محاصره شد', bg: 'Surrounded' },
  queenSurrounded: { fa: 'ملکه محاصره', bg: 'Queen Bee surrounded' }, pass: { fa: 'رد نوبت', bg: 'Pass' }
} satisfies Record<string, Term>;
