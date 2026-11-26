import type { Term } from '@bg/ui';

/** Backgammon terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  bar: { fa: 'بار', bg: 'Bar' }, bearOff: { fa: 'بیرون بردن', bg: 'Bear off' }, pip: { fa: 'پیپ', bg: 'Pip' },
  cube: { fa: 'کیوب', bg: 'Doubling cube' }, double: { fa: 'دوبل', bg: 'Double' },
  gammon: { fa: 'مارس', bg: 'Gammon' }, backgammon: { fa: 'مارس ترکی', bg: 'Backgammon' },
  point: { fa: 'خانه', bg: 'Point' }, checker: { fa: 'مهره', bg: 'Checker' }, checkers: { fa: 'مهره‌ها', bg: 'Checkers' },
  checkerIndef: { fa: 'مهره‌ای', bg: 'Checker' }, off: { fa: 'بیرون', bg: 'Off' }, borneOff: { fa: 'بیرون‌برده', bg: 'Borne off' },
  dice: { fa: 'تاس‌ها', bg: 'Dice' }, roll: { fa: 'تاس بریز', bg: 'Roll' }, rollPolite: { fa: 'تاس بریزید', bg: 'Roll' },
  take: { fa: 'قبول', bg: 'Take' }, drop: { fa: 'واگذار', bg: 'Drop' }, homeBoard: { fa: 'خانهٔ شما', bg: 'Home board' },
  offHud: { fa: 'خارج‌شده', bg: 'Borne off' }, cubeHud: { fa: 'مکعب', bg: 'Doubling cube' }
} satisfies Record<string, Term>;
