import type { Term } from '@bg/ui';

/** Ludo terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  token: { fa: 'مهره', bg: 'Token' }, tokensEz: { fa: 'مهره‌های', bg: 'Tokens' }, tokenEz: { fa: 'مهرهٔ', bg: 'Token' }, tokenAny: { fa: 'مهره‌ای', bg: 'a Token' },
  tokensOwn: { fa: 'مهره‌هایش', bg: 'their Tokens' },
  die: { fa: 'تاس', bg: 'Die' }, rollBtn: { fa: 'تاس بریز', bg: 'Roll' }, rollPrompt: { fa: 'تاس بریزید', bg: 'Roll the die' }, bonus: { fa: 'جایزه', bg: 'Bonus' },
  base: { fa: 'لانه', bg: 'Base' }, baseOwn: { fa: 'لانه‌اش', bg: 'its Base' }, fromBase: { fa: 'از لانه', bg: 'From Base' },
  home: { fa: 'خانهٔ مرکزی', bg: 'Home' }, homeWord: { fa: 'خانه', bg: 'Home' }, toHome: { fa: 'به خانه', bg: 'To Home' }, homeColumn: { fa: 'ستون خانه', bg: 'Home Column' },
  start: { fa: 'شروع', bg: 'Start' }, capture: { fa: 'زد', bg: 'Capture' },
  yardLabel: { fa: 'در خانه', bg: 'In Base' }, doneLabel: { fa: 'در مقصد', bg: 'At Home' },
  board: { fa: 'صفحه منچ', bg: 'Ludo Board' }
} satisfies Record<string, Term>;
