import type { Term } from '@bg/ui';

/** Splendor terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  diamond: { fa: 'الماس', bg: 'Diamond' }, sapphire: { fa: 'یاقوت کبود', bg: 'Sapphire' }, emerald: { fa: 'زمرد', bg: 'Emerald' },
  ruby: { fa: 'یاقوت سرخ', bg: 'Ruby' }, onyx: { fa: 'عقیق سیاه', bg: 'Onyx' }, gold: { fa: 'طلا', bg: 'Gold' },
  gem: { fa: 'گوهر', bg: 'Gem' }, prestige: { fa: 'اعتبار', bg: 'Prestige' },
  noble: { fa: 'بزرگ', bg: 'Noble' }, nobles: { fa: 'بزرگان', bg: 'Nobles' },
  reserve: { fa: 'رزرو', bg: 'Reserve' }, reserves: { fa: 'رزروها', bg: 'Reserved' }
} satisfies Record<string, Term>;
