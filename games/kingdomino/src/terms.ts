import type { Term } from '@bg/ui';

/** Kingdomino terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  domino: { fa: 'دومینو', bg: 'Domino' }, dominoOf: { fa: 'دومینوی', bg: 'Domino' }, crown: { fa: 'تاج', bg: 'Crown' }, castle: { fa: 'قلعه', bg: 'Castle' },
  kingdom: { fa: 'سرزمین', bg: 'Kingdom' },
  wheat: { fa: 'گندم‌زار', bg: 'Wheat' }, forest: { fa: 'جنگل', bg: 'Forest' }, lake: { fa: 'دریاچه', bg: 'Lake' },
  grassland: { fa: 'چمنزار', bg: 'Grassland' }, swamp: { fa: 'باتلاق', bg: 'Swamp' }, mine: { fa: 'معدن', bg: 'Mine' },
  largestArea: { fa: 'بزرگ‌ترین ناحیه', bg: 'Largest area' },
  area: { fa: 'ناحیه', bg: 'Area' }, squares: { fa: 'خانه‌ها', bg: 'Squares' }, squareEz: { fa: 'خانهٔ', bg: 'Square' }, terrains: { fa: 'زمین‌های', bg: 'terrains' },
  crowns: { fa: 'تاج‌ها', bg: 'Crowns' }, crownsIs: { fa: 'تاج‌هاست', bg: 'Crowns' }, dominoes: { fa: 'دومینوها', bg: 'Dominoes' },
  line: { fa: 'ردیف', bg: 'Line' }, thisRound: { fa: 'این دور', bg: 'Current line' }, nextRound: { fa: 'دور بعد', bg: 'Next line' }, bag: { fa: 'کیسه', bg: 'Draw pile' },
  rotate: { fa: 'چرخاندن', bg: 'Rotate' }, rotateV: { fa: 'بچرخانید', bg: 'Rotate' }, rotation: { fa: 'چرخش', bg: 'Rotate' },
  discard: { fa: 'دور انداختن', bg: 'Discard' }, discardV: { fa: 'دور بیندازید', bg: 'Discard' }, deck: { fa: 'دسته', bg: 'Deck' },
  score: { fa: 'امتیاز', bg: 'Score' }, tally: { fa: 'شمارش', bg: 'Tally' }, land: { fa: 'زمین', bg: 'Land' }, squaresEz: { fa: 'خانه‌های', bg: 'Squares' }
} satisfies Record<string, Term>;
