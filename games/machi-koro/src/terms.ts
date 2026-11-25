import type { Term } from '@bg/ui';

/** Machi Koro terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  wheat: { fa: 'گندم‌زار', bg: 'Wheat Field' }, ranch: { fa: 'دامداری', bg: 'Ranch' }, bakery: { fa: 'نانوایی', bg: 'Bakery' },
  cafe: { fa: 'قهوه‌خانه', bg: 'Cafe' }, store: { fa: 'بقالی', bg: 'Convenience Store' }, forest: { fa: 'جنگل', bg: 'Forest' },
  stadium: { fa: 'ورزشگاه', bg: 'Stadium' }, tv: { fa: 'ایستگاه تلویزیون', bg: 'TV Station' }, business: { fa: 'مرکز تجاری', bg: 'Business Center' },
  cheese: { fa: 'پنیرسازی', bg: 'Cheese Factory' }, furniture: { fa: 'مبل‌سازی', bg: 'Furniture Factory' }, mine: { fa: 'معدن', bg: 'Mine' },
  restaurant: { fa: 'رستوران', bg: 'Family Restaurant' }, orchard: { fa: 'باغ میوه', bg: 'Apple Orchard' }, market: { fa: 'بازار میوه', bg: 'Fruit & Veg Market' },
  station: { fa: 'ایستگاه قطار', bg: 'Train Station' }, mall: { fa: 'مرکز خرید', bg: 'Shopping Mall' }, park: { fa: 'شهربازی', bg: 'Amusement Park' },
  radio: { fa: 'برج رادیو', bg: 'Radio Tower' },
  landmark: { fa: 'بنای بزرگ', bg: 'Landmark' }
} satisfies Record<string, Term>;
