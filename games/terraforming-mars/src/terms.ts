import type { Term } from '@bg/ui';

/** Terraforming Mars terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  // resources and production
  mc: { fa: 'مگاکردیت', bg: 'M€' }, steel: { fa: 'فولاد', bg: 'Steel' }, titanium: { fa: 'تیتانیوم', bg: 'Titanium' }, plants: { fa: 'گیاه', bg: 'Plants' },
  energy: { fa: 'انرژی', bg: 'Energy' }, heat: { fa: 'گرما', bg: 'Heat' }, production: { fa: 'تولید', bg: 'Production' },
  // tags
  tagBuilding: { fa: 'ساختمان', bg: 'Building' }, tagSpace: { fa: 'فضا', bg: 'Space' }, tagScience: { fa: 'علم', bg: 'Science' }, tagPower: { fa: 'انرژی', bg: 'Power' },
  tagEarth: { fa: 'زمین', bg: 'Earth' }, tagJovian: { fa: 'مشتری', bg: 'Jovian' }, tagPlant: { fa: 'گیاه', bg: 'Plant' }, tagMicrobe: { fa: 'میکروب', bg: 'Microbe' },
  tagAnimal: { fa: 'جانور', bg: 'Animal' }, tagCity: { fa: 'شهر', bg: 'City' }, tagEvent: { fa: 'رویداد', bg: 'Event' },
  // tiles, global parameters, scoring
  greenery: { fa: 'فضای سبز', bg: 'Greenery' }, ocean: { fa: 'اقیانوس', bg: 'Ocean' }, city: { fa: 'شهر', bg: 'City' },
  oxygen: { fa: 'اکسیژن', bg: 'Oxygen' }, temperature: { fa: 'دما', bg: 'Temperature' }, generation: { fa: 'نسل', bg: 'Generation' },
  tr: { fa: 'رتبهٔ زمین‌سازی', bg: 'Terraform Rating' }, trShort: { fa: 'رتبه', bg: 'TR' },
  milestone: { fa: 'نقطهٔ عطف', bg: 'Milestone' }, award: { fa: 'جایزه', bg: 'Award' }, awardE: { fa: 'جایزهٔ', bg: 'Award' },
  corporation: { fa: 'شرکت', bg: 'Corporation' }, standardProject: { fa: 'پروژهٔ استاندارد', bg: 'Standard Project' },
  sellPatents: { fa: 'فروش امتیاز اختراع', bg: 'Sell Patents' }, powerPlant: { fa: 'نیروگاه', bg: 'Power Plant' }, asteroid: { fa: 'سیارک', bg: 'Asteroid' }, aquifer: { fa: 'سفرهٔ آب', bg: 'Aquifer' }
} satisfies Record<string, Term>;
