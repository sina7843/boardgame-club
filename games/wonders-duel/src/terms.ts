import type { Term } from '@bg/ui';

/** 7 Wonders Duel terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  wood: { fa: 'چوب', bg: 'Wood' }, clay: { fa: 'رس', bg: 'Clay' }, stone: { fa: 'سنگ', bg: 'Stone' }, glass: { fa: 'شیشه', bg: 'Glass' }, papyrus: { fa: 'پاپیروس', bg: 'Papyrus' },
  raw: { fa: 'مواد خام', bg: 'Raw materials' }, manufactured: { fa: 'کالا', bg: 'Manufactured goods' }, civilian: { fa: 'مدنی', bg: 'Civilian' },
  military: { fa: 'نظامی', bg: 'Military' }, science: { fa: 'علمی', bg: 'Science' }, commercial: { fa: 'تجاری', bg: 'Commercial' }, guild: { fa: 'صنف', bg: 'Guild' },
  wonder: { fa: 'شگفتی', bg: 'Wonder' }, wonders: { fa: 'شگفتی‌ها', bg: 'Wonders' },
  progressToken: { fa: 'نشان پیشرفت', bg: 'Progress token' }, progressTokens: { fa: 'نشان‌های پیشرفت', bg: 'Progress tokens' },
  agriculture: { fa: 'کشاورزی', bg: 'Agriculture' }, architecture: { fa: 'معماری', bg: 'Architecture' }, economy: { fa: 'اقتصاد', bg: 'Economy' },
  law: { fa: 'قانون', bg: 'Law' }, masonry: { fa: 'بنّایی', bg: 'Masonry' }, mathematics: { fa: 'ریاضیات', bg: 'Mathematics' },
  philosophy: { fa: 'فلسفه', bg: 'Philosophy' }, strategy: { fa: 'راهبرد', bg: 'Strategy' }, theology: { fa: 'الهیات', bg: 'Theology' }, urbanism: { fa: 'شهرسازی', bg: 'Urbanism' }
} satisfies Record<string, Term>;
