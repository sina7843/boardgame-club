import type { Term } from '@bg/ui';

/** Cryptid terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». Colour names stay Persian. */
export const terms = {
  clue: { fa: 'سرنخ', bg: 'Clue' }, cluesPl: { fa: 'سرنخ‌ها', bg: 'Clues' }, clueYour: { fa: 'سرنختان', bg: 'clue' },
  cube: { fa: 'مکعب', bg: 'Cube' }, disc: { fa: 'دیسک', bg: 'Disc' },
  territory: { fa: 'قلمرو', bg: 'Territory' }, standingStone: { fa: 'سنگ ایستاده', bg: 'Standing Stone' }, standingStoneEz: { fa: 'سنگ ایستادهٔ', bg: 'Standing Stone' },
  abandonedShack: { fa: 'کلبهٔ متروک', bg: 'Abandoned Shack' }, shackEz: { fa: 'کلبهٔ', bg: 'Shack' },
  structureEz: { fa: 'سازهٔ', bg: 'Structure' }, animals: { fa: 'جانوران', bg: 'Animals' }, cryptid: { fa: 'جانور', bg: 'Cryptid' },
  bear: { fa: 'خرس', bg: 'Bear' }, cougar: { fa: 'پوما', bg: 'Cougar' },
  forest: { fa: 'جنگل', bg: 'Forest' }, desert: { fa: 'بیابان', bg: 'Desert' }, swamp: { fa: 'مرداب', bg: 'Swamp' }, mountain: { fa: 'کوهستان', bg: 'Mountain' }, water: { fa: 'آب', bg: 'Water' },
  column: { fa: 'ستون', bg: 'Column' }, row: { fa: 'ردیف', bg: 'Row' }, space: { fa: 'خانه', bg: 'Space' }, spaceAny: { fa: 'خانه‌ای', bg: 'Space' },
  ask: { fa: 'پرسیدن', bg: 'Ask' }, question: { fa: 'پرسش', bg: 'Question' }, search: { fa: 'جست‌وجو', bg: 'Search' }, searchEz: { fa: 'جست‌وجوی', bg: 'Search' },
  startCube: { fa: 'مکعب شروع', bg: 'Start cube' }, penaltyCube: { fa: 'مکعب اجباری', bg: 'Penalty cube' }
} satisfies Record<string, Term>;
