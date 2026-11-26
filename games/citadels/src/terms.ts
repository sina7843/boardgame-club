import type { Term } from '@bg/ui';

/** Citadels terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Character and district names come from the rules data and stay Persian. */
export const terms = {
  crown: { fa: 'تاج', bg: 'Crown' }, district: { fa: 'محله', bg: 'District' },
  character: { fa: 'شخصیت', bg: 'Character' }, characters: { fa: 'شخصیت‌ها', bg: 'Characters' },
  ability: { fa: 'توانایی', bg: 'Ability' }
} satisfies Record<string, Term>;
