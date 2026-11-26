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
  landmark: { fa: 'بنای بزرگ', bg: 'Landmark' }, landmarkSh: { fa: 'بنا', bg: 'Landmark' }, establishment: { fa: 'مغازه', bg: 'Establishment' },
  coins: { fa: 'سکه', bg: 'Coins' }, card: { fa: 'کارت', bg: 'Card' }, cardIndef: { fa: 'کارتی', bg: 'Card' }, cards: { fa: 'کارت‌ها', bg: 'Cards' },
  die: { fa: 'تاس', bg: 'Dice' }, dice: { fa: 'تاس‌ها', bg: 'Dice' }, roller: { fa: 'تاس‌انداز', bg: 'Roller' }, orchardSh: { fa: 'باغ', bg: 'Orchard' },
  swapCard: { fa: 'جابه‌جایی کارت', bg: 'Swap Card' }, rollDice: { fa: 'تاس بریزید', bg: 'Roll the dice' }, rolling: { fa: 'در حال ریختن', bg: 'Rolling' },
  rerollQ: { fa: 'دوباره می‌ریزید', bg: 'Reroll' }, keepQ: { fa: 'همین را نگه می‌دارید', bg: 'Keep' }, swapQ: { fa: 'عوض می‌کنید', bg: 'Swap' },
  buildV: { fa: 'بسازید', bg: 'Build' }, buildV2: { fa: 'بسازد', bg: 'Build' }, income: { fa: 'درآمد', bg: 'Income' },
  rerollB: { fa: 'دوباره', bg: 'Reroll' }, rollB: { fa: 'ریختن', bg: 'Roll' }, keepB: { fa: 'همین را نگه دار', bg: 'Keep' }, swapB: { fa: 'عوض کن', bg: 'Swap' },
  number: { fa: 'عدد', bg: 'Number' }, built: { fa: 'ساخته شده', bg: 'Built' }, supply: { fa: 'بازار ساخت', bg: 'Supply' }, buildN: { fa: 'ساختن', bg: 'Build' },
  cost: { fa: 'قیمت', bg: 'cost' }, left: { fa: 'مانده', bg: 'left' }, city: { fa: 'شهر', bg: 'City' }, cities: { fa: 'شهرها', bg: 'Cities' }, passB: { fa: 'چیزی نمی‌سازم', bg: 'Pass' }
} satisfies Record<string, Term>;
