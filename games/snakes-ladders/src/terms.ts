import type { Term } from '@bg/ui';

/** Snakes & Ladders terms. `fa` = Persian words used today (client text and server publicSummary labels); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  snake: { fa: 'مار', bg: 'Snake' }, ladder: { fa: 'نردبان', bg: 'Ladder' },
  snakeHead: { fa: 'سر مار', bg: 'Snake Head' }, ladderFoot: { fa: 'پای نردبان', bg: 'Ladder Foot' },
  token: { fa: 'مهرهٔ', bg: 'Token' }, die: { fa: 'تاس', bg: 'Die' },
  square: { fa: 'خانه', bg: 'Square' }, start: { fa: 'شروع', bg: 'Start' },
  rollBtn: { fa: 'ریختن تاس', bg: 'Roll' }, rollBtn2: { fa: 'تاس بریز', bg: 'Roll' }, rollPrompt: { fa: 'تاس بریزید', bg: 'Roll the die' },
  board: { fa: 'صفحه مارپله', bg: 'Snakes & Ladders Board' }
} satisfies Record<string, Term>;
