import type { Term } from '@bg/ui';

/** Brass: Birmingham terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  cotton: { fa: 'کارخانهٔ پنبه', bg: 'Cotton Mill' }, manufacturer: { fa: 'تولیدی', bg: 'Manufacturer' }, pottery: { fa: 'سفال‌گری', bg: 'Pottery' },
  coalMine: { fa: 'معدن زغال', bg: 'Coal Mine' }, ironWorks: { fa: 'ذوب‌آهن', bg: 'Iron Works' }, brewery: { fa: 'آبجوسازی', bg: 'Brewery' },
  build: { fa: 'ساخت صنعت', bg: 'Build' }, network: { fa: 'ساخت مسیر', bg: 'Network' }, develop: { fa: 'توسعه', bg: 'Develop' },
  sell: { fa: 'فروش', bg: 'Sell' }, loan: { fa: 'وام', bg: 'Loan' }, scout: { fa: 'پیشاهنگ', bg: 'Scout' }, pass: { fa: 'رد کردن', bg: 'Pass' },
  canal: { fa: 'کانال', bg: 'Canal' }, rail: { fa: 'ریل', bg: 'Rail' },
  canalEra: { fa: 'دورهٔ کانال', bg: 'Canal Era' }, railEra: { fa: 'دورهٔ راه‌آهن', bg: 'Rail Era' },
  endCanalEra: { fa: 'پایان دورهٔ کانال', bg: 'End of the Canal Era' }, endRailEra: { fa: 'پایان دورهٔ راه‌آهن', bg: 'End of the Rail Era' },
  canalScoring: { fa: 'امتیازشماری پایان دورهٔ کانال', bg: 'Canal Era scoring' }, railScoring: { fa: 'امتیازشماری پایان دورهٔ راه‌آهن', bg: 'Rail Era scoring' }
} satisfies Record<string, Term>;
