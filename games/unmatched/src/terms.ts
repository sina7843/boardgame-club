import type { Term } from '@bg/ui';

/** Unmatched terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  attack: { fa: 'حمله', bg: 'Attack' }, defense: { fa: 'دفاع', bg: 'Defense' }, versatile: { fa: 'همه‌کاره', bg: 'Versatile' },
  scheme: { fa: 'نقشه', bg: 'Scheme' }, boost: { fa: 'تقویت', bg: 'Boost' }, maneuver: { fa: 'مانور', bg: 'Maneuver' },
  sidekick: { fa: 'یاور', bg: 'Sidekick' }, ranged: { fa: 'دوربرد', bg: 'Ranged' }, melee: { fa: 'نزدیک‌زن', bg: 'Melee' },
  deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریخته', bg: 'Discard' }
} satisfies Record<string, Term>;
