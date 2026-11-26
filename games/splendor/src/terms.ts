import type { Term } from '@bg/ui';

/** Splendor terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  diamond: { fa: 'الماس', bg: 'Diamond' }, sapphire: { fa: 'یاقوت کبود', bg: 'Sapphire' }, emerald: { fa: 'زمرد', bg: 'Emerald' },
  ruby: { fa: 'یاقوت سرخ', bg: 'Ruby' }, onyx: { fa: 'عقیق سیاه', bg: 'Onyx' }, gold: { fa: 'طلا', bg: 'Gold' },
  gem: { fa: 'گوهر', bg: 'Gem' }, prestige: { fa: 'اعتبار', bg: 'Prestige' },
  noble: { fa: 'بزرگ', bg: 'Noble' }, nobles: { fa: 'بزرگان', bg: 'Nobles' },
  reserve: { fa: 'رزرو', bg: 'Reserve' }, reserves: { fa: 'رزروها', bg: 'Reserved' },
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, token: { fa: 'ژتون', bg: 'Token' },
  level1: { fa: 'معدن', bg: 'Level I' }, level2: { fa: 'کارگاه', bg: 'Level II' }, level3: { fa: 'کاروان', bg: 'Level III' },
  cost: { fa: 'قیمت', bg: 'Cost' }, bank: { fa: 'بانک', bg: 'Bank' }, round: { fa: 'دور', bg: 'Round' }, lastRound: { fa: 'دور آخر', bg: 'Final Round' },
  takeV: { fa: 'بردارید', bg: 'Take' }, takeN: { fa: 'برداشتن', bg: 'Take' }, buyV: { fa: 'بخرید', bg: 'Buy' }, buyN: { fa: 'خرید', bg: 'Buy' },
  returnV: { fa: 'پس بدهید', bg: 'Return' }, returnN: { fa: 'پس دادن', bg: 'Return' }, passTurn: { fa: 'رد کردن نوبت', bg: 'Pass' },
  missing: { fa: 'کمبود', bg: 'Missing' },
  // Sent by the server (rules.ts publicSummary): seat-card labels.
  sPoints: { fa: 'امتیاز', bg: 'Prestige' }, sGems: { fa: 'جواهر', bg: 'Gems' }, sNobles: { fa: 'اشراف', bg: 'Nobles' }
} satisfies Record<string, Term>;
