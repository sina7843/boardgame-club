import type { Term } from '@bg/ui';

/** Onitama terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  master: { fa: 'استاد', bg: 'Master' }, student: { fa: 'شاگرد', bg: 'Student' }, temple: { fa: 'معبد', bg: 'Temple Arch' },
  wayStone: { fa: 'راه سنگ', bg: 'Way of the Stone' }, wayStream: { fa: 'راه رود', bg: 'Way of the Stream' }
} satisfies Record<string, Term>;
