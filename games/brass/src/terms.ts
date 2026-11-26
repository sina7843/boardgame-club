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
  canalScoring: { fa: 'امتیازشماری پایان دورهٔ کانال', bg: 'Canal Era scoring' }, railScoring: { fa: 'امتیازشماری پایان دورهٔ راه‌آهن', bg: 'Rail Era scoring' },
  // resources and components (HUD labels sent by rules.ts publicSummary must match these `fa` exactly)
  coal: { fa: 'زغال', bg: 'Coal' }, iron: { fa: 'آهن', bg: 'Iron' }, beer: { fa: 'آبجو', bg: 'Beer' }, beerEz: { fa: 'آبجوی', bg: 'Beer' },
  vp: { fa: 'امتیاز', bg: 'VP' }, income: { fa: 'درآمد', bg: 'Income' }, spent: { fa: 'خرج این دور', bg: 'Spent this round' },
  card: { fa: 'کارت', bg: 'Card' }, cardI: { fa: 'کارتی', bg: 'Card' }, cardsPl: { fa: 'کارت‌ها', bg: 'Cards' }, cardsEz: { fa: 'کارت‌های', bg: 'Cards' },
  hand: { fa: 'دست', bg: 'Hand' }, deck: { fa: 'دسته', bg: 'Deck' }, era: { fa: 'دوره', bg: 'Era' }, round: { fa: 'دور', bg: 'Round' },
  link: { fa: 'مسیر', bg: 'Link' }, linksPl: { fa: 'مسیرها', bg: 'Links' }, tile: { fa: 'کاشی', bg: 'Tile' }, tilesPl: { fa: 'کاشی‌ها', bg: 'Tiles' },
  tilesEz: { fa: 'کاشی‌های', bg: 'Tiles' }, merchant: { fa: 'تاجر', bg: 'Merchant' }, merchantsPl: { fa: 'تاجرها', bg: 'Merchants' },
  market: { fa: 'بازار', bg: 'Market' }, industry: { fa: 'صنعت', bg: 'Industry' }, industryMat: { fa: 'صفحهٔ صنعت', bg: 'Industry Mat' },
  playerMat: { fa: 'صفحهٔ بازیکن', bg: 'Player Mat' }, myMat: { fa: 'صفحهٔ من', bg: 'My Mat' }, playerAid: { fa: 'راهنمای بازیکن', bg: 'Player Aid' },
  wildLocation: { fa: 'شهر آزاد', bg: 'Wild Location' }, wildIndustry: { fa: 'صنعت آزاد', bg: 'Wild Industry' }, wildCard: { fa: 'کارت آزاد', bg: 'Wild Card' }, wild: { fa: 'آزاد', bg: 'Wild' },
  flipped: { fa: 'برگشته', bg: 'Flipped' }, level: { fa: 'سطح', bg: 'Level' }, action: { fa: 'اقدام', bg: 'Action' }, actionsPl: { fa: 'اقدام‌ها', bg: 'Actions' },
  board: { fa: 'نقشه', bg: 'Board' }, boardEz: { fa: 'نقشهٔ', bg: 'Board' }, birmingham: { fa: 'بیرمنگام', bg: 'Birmingham' },
  networkEz: { fa: 'شبکهٔ', bg: 'Network' }, developEz: { fa: 'توسعهٔ', bg: 'Develop' }, barrelEz: { fa: 'بشکهٔ', bg: 'Barrel' }, barrelsEz: { fa: 'بشکه‌های', bg: 'Barrels' },
  shortfall: { fa: 'کسری پول', bg: 'Shortfall' }, scoring: { fa: 'امتیازشماری', bg: 'Scoring' }, character: { fa: 'شخصیت', bg: 'Character' }
} satisfies Record<string, Term>;
