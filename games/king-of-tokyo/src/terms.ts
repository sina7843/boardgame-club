import type { Term } from '@bg/ui';

/** King of Tokyo terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Monster and power-card names come from the rules data. */
export const terms = {
  energy: { fa: 'انرژی', bg: 'Energy' }, claw: { fa: 'چنگ', bg: 'Claw' }, heart: { fa: 'قلب', bg: 'Heart' },
  powerCards: { fa: 'کارت‌های قدرت', bg: 'Power Cards' }, keepCards: { fa: 'کارت‌های نگه‌داشته', bg: 'Keep Cards' }
} satisfies Record<string, Term>;
