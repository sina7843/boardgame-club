import type { Term } from '@bg/ui';

/** Hive terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  queen: { fa: 'ملکه زنبور', bg: 'Queen Bee' }, queenShort: { fa: 'ملکه', bg: 'Queen Bee' },
  spider: { fa: 'عنکبوت', bg: 'Spider' }, beetle: { fa: 'سوسک', bg: 'Beetle' },
  grasshopper: { fa: 'ملخ', bg: 'Grasshopper' }, ant: { fa: 'مورچه', bg: 'Soldier Ant' }
} satisfies Record<string, Term>;
