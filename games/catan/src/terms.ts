import type { Term } from '@bg/ui';

/** Catan terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Resources, terrain and buildings stay Persian (as the Iranian community says them). */
export const terms = {
  robber: { fa: 'راهزن', bg: 'Robber' }, longestRoad: { fa: 'طولانی‌ترین جاده', bg: 'Longest Road' },
  largestArmy: { fa: 'بزرگ‌ترین ارتش', bg: 'Largest Army' }, harbor: { fa: 'بندر', bg: 'Harbor' },
  devCard: { fa: 'کارت توسعه', bg: 'Development Card' }, devCards: { fa: 'کارت‌های توسعه', bg: 'Development Cards' },
  knight: { fa: 'شوالیه', bg: 'Knight' }, victoryPoint: { fa: 'امتیاز پیروزی', bg: 'Victory Point' },
  roadBuilding: { fa: 'جاده‌سازی', bg: 'Road Building' }, yearOfPlenty: { fa: 'سال فراوانی', bg: 'Year of Plenty' },
  monopoly: { fa: 'انحصار', bg: 'Monopoly' }
} satisfies Record<string, Term>;
