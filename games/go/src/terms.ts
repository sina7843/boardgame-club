import type { Term } from '@bg/ui';

/** Go terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  pass: { fa: 'پاس', bg: 'Pass' }, komi: { fa: 'کومی', bg: 'Komi' }, capture: { fa: 'اسیر', bg: 'Captures' },
  territory: { fa: 'قلمرو', bg: 'Territory' }, ko: { fa: 'کو', bg: 'Ko' }, liberty: { fa: 'آزادی', bg: 'Liberty' },
  stone: { fa: 'سنگ', bg: 'Stone' }, deadStones: { fa: 'سنگ‌های مرده', bg: 'Dead stones' }, deadGroups: { fa: 'گروه‌های مرده', bg: 'Dead groups' },
  dead: { fa: 'مرده', bg: 'Dead' }, scoring: { fa: 'شمارش', bg: 'Scoring' }, intersection: { fa: 'تقاطع', bg: 'Intersection' },
  groupTheir: { fa: 'گروهشان', bg: 'group' }, groupIndef: { fa: 'گروهی', bg: 'group' }
} satisfies Record<string, Term>;
