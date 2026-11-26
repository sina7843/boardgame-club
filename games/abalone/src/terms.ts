import type { Term } from '@bg/ui';

/** Abalone terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  marble: { fa: 'گوی', bg: 'Marble' }, marblesYour: { fa: 'گوی‌هایتان', bg: 'Marbles' }, marblesEz: { fa: 'گوی‌های', bg: 'Marbles' },
  lostMarbles: { fa: 'گوی‌های از دست‌رفته', bg: 'Marbles lost' }, score: { fa: 'امتیاز', bg: 'Score' },
  push: { fa: 'هل', bg: 'Push' }, sidestep: { fa: 'حرکت از پهلو', bg: 'Side-step' },
  arrow: { fa: 'فلش', bg: 'Arrow' }
} satisfies Record<string, Term>;
