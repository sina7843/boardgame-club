import type { Term } from '@bg/ui';

/** Set terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  set: { fa: 'ست', bg: 'Set' },
  card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت', bg: 'Cards' }, deck: { fa: 'دسته', bg: 'Deck' },
  findSet: { fa: 'همه هم‌زمان: سه کارت ست را پیدا کنید', bg: 'Everyone at once: find a Set of three Cards' },
  railRule: { fa: 'سه کارت ست‌اند اگر در هر ویژگی (تعداد، شکل، رنگ، پرشدگی) یا همه یکسان باشند یا همه متفاوت. اعلام اشتباه ۱ امتیاز کم می‌کند.', bg: 'Three Cards form a Set if, in each attribute (Number, Shape, Color, Shading), they are all the same or all different. A wrong call costs 1 point.' },
  locked: { fa: 'اعلام اشتباه: تا برداشته شدن ست بعدی نمی‌توانید اعلام کنید', bg: 'Wrong call: you cannot call until the next Set is taken' },
  tableCards: { fa: 'کارت‌های روی میز', bg: 'Cards on the table' }, pickThree: { fa: 'سه کارت انتخاب کنید', bg: 'Pick three Cards' },
  waitingNext: { fa: 'منتظر ست بعدی', bg: 'Waiting for the next Set' },
  misses: { fa: 'خطا', bg: 'Misses' }, tookSet: { fa: 'ست گرفت', bg: 'Took a Set' }, wrongCall: { fa: 'اعلام اشتباه', bg: 'Wrong call' },
  diamond: { fa: 'لوزی', bg: 'Diamond' }, squiggle: { fa: 'موج', bg: 'Squiggle' }, oval: { fa: 'بیضی', bg: 'Oval' },
  solid: { fa: 'توپر', bg: 'Solid' }, striped: { fa: 'هاشور', bg: 'Striped' }, open: { fa: 'توخالی', bg: 'Open' }
} satisfies Record<string, Term>;
