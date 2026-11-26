import type { Term } from '@bg/ui';

/** Azul terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  factory: { fa: 'کارگاه', bg: 'Factory' }, factories: { fa: 'کارگاه‌ها', bg: 'Factories' },
  floor: { fa: 'کف', bg: 'Floor' }, wall: { fa: 'دیوار', bg: 'Wall' },
  patternLines: { fa: 'ردیف‌های الگو', bg: 'Pattern lines' }, bag: { fa: 'کیسه', bg: 'Bag' }
} satisfies Record<string, Term>;
