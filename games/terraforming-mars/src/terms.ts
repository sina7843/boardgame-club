import { getTermsLang, type Term } from '@bg/ui';

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
  sellPatents: { fa: 'فروش امتیاز اختراع', bg: 'Sell Patents' }, powerPlant: { fa: 'نیروگاه', bg: 'Power Plant' }, asteroid: { fa: 'سیارک', bg: 'Asteroid' }, aquifer: { fa: 'سفرهٔ آب', bg: 'Aquifer' },
  // HUD labels sent by rules.ts publicSummary (the shell swaps a label when it equals a `fa` here)
  vp: { fa: 'امتیاز', bg: 'VP' }, card: { fa: 'کارت', bg: 'Card' }, firstPlayer: { fa: 'نفر اول', bg: 'First Player' }, deck: { fa: 'دسته', bg: 'Deck' }, discard: { fa: 'دورریز', bg: 'Discard Pile' },
  trLabel: { fa: 'رتبه', bg: 'TR' }
} satisfies Record<string, Term>;

// Whole-vocabulary replacement for descriptive sentences (card texts, prompts, tooltips, status lines).
// In `fa` it returns the text untouched; in `fa-bg` every known Persian game word, also inside compounds, becomes its Latin term.
// Plural/ezafe forms are listed explicitly (a Latin word never takes «‌ها»); longest entries win.
const EXTRA: [string, string][] = [
  ['فضای سبز', 'Greenery'], ['اقیانوسی', 'Ocean'], ['اقیانوس', 'Ocean'], ['اکسیژن', 'Oxygen'], ['دما', 'Temperature'], ['پلهٔ', 'Step'],
  ['گیاه', 'Plants'], ['انرژی', 'Energy'], ['گرما', 'Heat'], ['فولاد', 'Steel'], ['تیتانیوم', 'Titanium'], ['مگاکردیت', 'M€'], ['تولید', 'Production'],
  ['ساختمان', 'Building'], ['علمی', 'Science'], ['علم', 'Science'], ['مشتری', 'Jovian'], ['میکروب', 'Microbe'], ['جانور', 'Animal'], ['رویداد', 'Event'], ['فضا', 'Space'], ['زمین', 'Earth'],
  ['شهرها', 'Cities'], ['شهر', 'City'], ['ادعای زمین', 'Land Claim'], ['ناحیهٔ', 'Area'], ['پاداش', 'Bonus'],
  ['رتبهٔ زمین‌سازی', 'Terraform Rating'], ['زمین‌سازی', 'Terraforming'], ['رتبه', 'TR'], ['نسل', 'Generation'], ['نقطه‌های عطف', 'Milestones'], ['نقطهٔ عطف', 'Milestone'], ['جایزه‌ها', 'Awards'], ['جایزهٔ', 'Award'], ['جایزه', 'Award'],
  ['پروژه‌های استاندارد', 'Standard Projects'], ['پروژهٔ استاندارد', 'Standard Project'], ['فروش امتیاز اختراع', 'Sell Patents'], ['نیروگاه', 'Power Plant'], ['سیارک', 'Asteroid'], ['سفرهٔ آب', 'Aquifer'],
  ['شرکتتان', 'Corporation'], ['شرکت', 'Corporation'], ['کارت‌های', 'Cards'], ['کارت‌ها', 'Cards'], ['کارت', 'Card'], ['نشان‌ها', 'Tags'], ['نشان', 'Tag'],
  ['کنش‌ها', 'Actions'], ['کنش', 'Action'], ['پاس', 'Pass'], ['امتیاز', 'VP'], ['فروش', 'Sell'], ['تبدیل‌ها', 'Conversions'], ['تبدیل', 'Convert'], ['هزینهٔ', 'Cost'], ['هزینه', 'Cost'],
  ['دسته', 'Deck'], ['دورریز', 'Discard Pile'], ['نفر اول', 'First Player'], ['صفحهٔ تارسیس', 'Tharsis Board'], ['صفحهٔ مریخ', 'Mars Board'], ['مریخ', 'Mars'], ['پارامترهای جهانی', 'Global Parameters'],
  ['امتیاز پایانی', 'Final Scoring'], ['درفت', 'Draft'], ['پژوهش', 'Research']
];
// Whole-string only (a bare word that is too common to replace inside sentences).
const EXACT = new Map<string, string>([['دست', 'Hand'], ['دست شما', 'Your Hand'], ['پروژه', 'Project'], ['پلاک', 'Plaque']]);
const TFMAP = new Map<string, string>([...Object.values(terms).map((x): [string, string] => [x.fa, x.bg]), ...EXTRA]);
const TFRX = new RegExp([...TFMAP.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
export const tf = (s: string): string => (getTermsLang() === 'fa-bg' ? (EXACT.get(s) ?? s.replace(TFRX, (m) => TFMAP.get(m) ?? m)) : s);
