import type { Term } from '@bg/ui';

/** Backgammon terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  bar: { fa: 'بار', bg: 'Bar' }, bearOff: { fa: 'بیرون بردن', bg: 'Bear off' }, pip: { fa: 'پیپ', bg: 'Pip' },
  cube: { fa: 'کیوب', bg: 'Doubling cube' }, double: { fa: 'دوبل', bg: 'Double' },
  gammon: { fa: 'مارس', bg: 'Gammon' }, backgammon: { fa: 'مارس ترکی', bg: 'Backgammon' }
} satisfies Record<string, Term>;
