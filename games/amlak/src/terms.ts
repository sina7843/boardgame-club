import type { Term } from '@bg/ui';

/** Amlak (Monopoly-style) terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  auction: { fa: 'مزایده', bg: 'Auction' }, mortgage: { fa: 'رهن', bg: 'Mortgage' }, unmortgage: { fa: 'فک رهن', bg: 'Unmortgage' },
  chance: { fa: 'شانس', bg: 'Chance' }, chest: { fa: 'صندوق', bg: 'Community Chest' },
  hotel: { fa: 'هتل', bg: 'Hotel' }, jail: { fa: 'زندان', bg: 'Jail' }
} satisfies Record<string, Term>;
