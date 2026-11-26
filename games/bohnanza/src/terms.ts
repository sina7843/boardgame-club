import type { Term } from '@bg/ui';
import { BEAN_INFO } from './rules.ts';

/** Bohnanza terms. `fa` = Persian words used today (bean names read from the rules table); `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  coffee: { fa: BEAN_INFO.coffee.name, bg: 'Coffee' }, wax: { fa: BEAN_INFO.wax.name, bg: 'Wax' }, blue: { fa: BEAN_INFO.blue.name, bg: 'Blue' },
  chili: { fa: BEAN_INFO.chili.name, bg: 'Chili' }, stink: { fa: BEAN_INFO.stink.name, bg: 'Stink' }, green: { fa: BEAN_INFO.green.name, bg: 'Green' },
  soy: { fa: BEAN_INFO.soy.name, bg: 'Soy' }, blackeye: { fa: BEAN_INFO.blackeye.name, bg: 'Black-eyed' }, red: { fa: BEAN_INFO.red.name, bg: 'Red' },
  garden: { fa: BEAN_INFO.garden.name, bg: 'Garden' },
  harvest: { fa: 'برداشت', bg: 'Harvest' }, trade: { fa: 'معامله', bg: 'Trade' },
  bean: { fa: 'لوبیا', bg: 'Bean' }, beanEz: { fa: 'لوبیای', bg: 'Bean' }, card: { fa: 'کارت', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' },
  field: { fa: 'مزرعه', bg: 'Field' }, fieldEz: { fa: 'مزرعهٔ', bg: 'Field' }, fields: { fa: 'مزرعه‌ها', bg: 'Fields' }, fieldsEz: { fa: 'مزرعه‌های', bg: 'Fields' },
  plantN: { fa: 'کاشتن', bg: 'Plant' }, plantImp: { fa: 'بکارید', bg: 'Plant' }, plants: { fa: 'بکارد', bg: 'Plant' }, planted: { fa: 'کاشته', bg: 'Planted' },
  hand: { fa: 'دست', bg: 'Hand' }, handYour: { fa: 'دستتان', bg: 'Hand' }, deck: { fa: 'دسته', bg: 'Deck' }, coin: { fa: 'سکه', bg: 'Coin' },
  offer: { fa: 'پیشنهاد', bg: 'Offer' }, accept: { fa: 'پذیرفتن', bg: 'Accept' }, decline: { fa: 'رد کردن', bg: 'Decline' },
  donate: { fa: 'ببخشید', bg: 'Donate' }, donateN: { fa: 'بخشیدن', bg: 'Donate' }, donation: { fa: 'بخشش', bg: 'Donation' }, gift: { fa: 'هدیه', bg: 'Gift' },
  flipImp: { fa: 'رو کنید', bg: 'Flip' }, flipN: { fa: 'رو کردن', bg: 'Flip' }, buy: { fa: 'خرید', bg: 'Buy' }
} satisfies Record<string, Term>;
