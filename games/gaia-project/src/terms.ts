import { getTermsLang, type Term } from '@bg/ui';

/** Gaia Project terms (official English names). `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  // resources
  credits: { fa: 'اعتبار', bg: 'Credits' }, ore: { fa: 'سنگ معدن', bg: 'Ore' }, knowledge: { fa: 'دانش', bg: 'Knowledge' },
  powerCharge: { fa: 'شارژ قدرت', bg: 'Power Charge' }, powerToken: { fa: 'ژتون قدرت', bg: 'Power Token' }, brainStone: { fa: 'سنگ مغز', bg: 'Brain Stone' },
  // structures
  mine: { fa: 'معدن', bg: 'Mine' }, tradingStation: { fa: 'ایستگاه تجاری', bg: 'Trading Station' }, researchLab: { fa: 'آزمایشگاه پژوهشی', bg: 'Research Lab' },
  planetaryInstitute: { fa: 'مؤسسهٔ سیاره‌ای', bg: 'Planetary Institute' }, knowledgeAcademy: { fa: 'آکادمی دانش', bg: 'Knowledge Academy' },
  qicAcademy: { fa: 'آکادمی QIC', bg: 'QIC Academy' }, gaiaformer: { fa: 'گایاساز', bg: 'Gaiaformer' }, spaceStation: { fa: 'ایستگاه فضایی', bg: 'Space Station' },
  lostPlanet: { fa: 'سیارهٔ گمشده', bg: 'Lost Planet' },
  // research tracks
  terraforming: { fa: 'زمین‌سازی', bg: 'Terraforming' }, navigation: { fa: 'ناوبری', bg: 'Navigation' }, ai: { fa: 'هوش مصنوعی', bg: 'Artificial Intelligence' },
  gaiaProject: { fa: 'پروژهٔ گایا', bg: 'Gaia Project' }, economy: { fa: 'اقتصاد', bg: 'Economy' }, science: { fa: 'دانش', bg: 'Science' },
  // actions and tiles
  buildMine: { fa: 'ساخت معدن', bg: 'Build Mine' }, upgrade: { fa: 'ارتقای سازه', bg: 'Upgrade' }, research: { fa: 'پژوهش', bg: 'Research' },
  federation: { fa: 'فدراسیون', bg: 'Federation' }, formFederation: { fa: 'تشکیل فدراسیون', bg: 'Form Federation' }, pass: { fa: 'پاس', bg: 'Pass' },
  booster: { fa: 'بوستر', bg: 'Booster' }, techStd: { fa: 'فناوری استاندارد', bg: 'Standard Tech Tile' }, techAdv: { fa: 'فناوری پیشرفته', bg: 'Advanced Tech Tile' },
  fedToken: { fa: 'توکن فدراسیون', bg: 'Federation Token' }, fedTokens: { fa: 'توکن‌های فدراسیون', bg: 'Federation Tokens' },
  // HUD labels sent by rules.ts publicSummary (the shell swaps a label when it equals a `fa` here)
  vp: { fa: 'امتیاز', bg: 'VP' }, oreShort: { fa: 'سنگ', bg: 'Ore' }, round: { fa: 'دور', bg: 'Round' }, level: { fa: 'سطح', bg: 'Level' },
  // factions (nameFa -> official English name)
  fHadsch: { fa: 'هادش هالا', bg: 'Hadsch Hallas' }, fXenos: { fa: 'زنوس', bg: 'Xenos' }, fGeodens: { fa: 'ژئودن‌ها', bg: 'Geodens' }, fFiraks: { fa: 'فیراک‌ها', bg: 'Firaks' },
  fTerrans: { fa: 'ترن‌ها', bg: 'Terrans' }, fLantids: { fa: 'لانتیدها', bg: 'Lantids' }, fIvits: { fa: 'آیویت‌ها', bg: 'Ivits' }, fBalTaks: { fa: 'بال‌تاک‌ها', bg: "Bal T'aks" },
  fGleens: { fa: 'گلین‌ها', bg: 'Gleens' }, fAmbas: { fa: 'آمباس‌ها', bg: 'Ambas' }, fTaklons: { fa: 'تاکلون‌ها', bg: 'Taklons' }, fBescods: { fa: 'بسکادها', bg: 'Bescods' },
  fItars: { fa: 'ایتارها', bg: 'Itars' }, fNevlas: { fa: 'نِولاها', bg: 'Nevlas' }
} satisfies Record<string, Term>;

// Whole-vocabulary replacement for descriptive sentences (tile/booster/federation/faction texts, prompts, tooltips).
// In `fa` it returns the text untouched; in `fa-bg` every known Persian game word, also inside compounds, becomes its Latin term.
// Plural/ezafe forms are listed explicitly (a Latin word never takes «‌ها»); longest entries win.
const EXTRA: [string, string][] = [
  ['پروژهٔ گایا', 'Gaia Project'], ['ناحیهٔ گایا', 'Gaia Area'], ['سیارهٔ گایا', 'Gaia Planet'], ['سیارهٔ گمشده', 'Lost Planet'], ['سیارهٔ خانگی', 'Home Planet'], ['سیارهٔ', 'Planet'], ['سیاره', 'Planet'],
  ['ایستگاه‌های تجاری', 'Trading Stations'], ['ایستگاه تجاری', 'Trading Station'], ['ایستگاه فضایی', 'Space Station'],
  ['آزمایشگاه‌های پژوهشی', 'Research Labs'], ['آزمایشگاه پژوهشی', 'Research Lab'], ['آزمایشگاه‌ها', 'Research Labs'], ['آزمایشگاه', 'Research Lab'],
  ['مؤسسهٔ سیاره‌ای', 'Planetary Institute'], ['مؤسسه', 'Planetary Institute'], ['آکادمی دانش', 'Knowledge Academy'], ['آکادمی QIC', 'QIC Academy'], ['آکادمی‌ها', 'Academies'], ['آکادمی', 'Academy'],
  ['گایاساز', 'Gaiaformer'], ['زمین‌سازی', 'Terraforming'], ['ناوبری', 'Navigation'], ['هوش مصنوعی', 'Artificial Intelligence'], ['اقتصاد', 'Economy'],
  ['مسیر پژوهش', 'Research Track'], ['پژوهش', 'Research'], ['گایا', 'Gaia'],
  ['توکن‌های فدراسیون', 'Federation Tokens'], ['توکن فدراسیون', 'Federation Token'], ['فدراسیون‌های', 'Federations'], ['فدراسیون‌ها', 'Federations'], ['فدراسیون', 'Federation'],
  ['ژتون‌های قدرت', 'Power Tokens'], ['ژتون قدرت', 'Power Token'], ['ژتون‌ها', 'Tokens'], ['ژتون', 'Token'], ['شارژ قدرت', 'Power Charge'], ['شارژ', 'Charge'],
  ['سوزاندن قدرت', 'Burn Power'], ['اقدام ویژه', 'Special Action'], ['اقدام قدرت', 'Power Action'], ['اقدام QIC', 'QIC Action'], ['قدرت', 'Power'],
  ['سنگ معدن', 'Ore'], ['سنگ', 'Ore'], ['اعتبار', 'Credits'], ['دانش', 'Knowledge'], ['معدن‌ها', 'Mines'], ['معدن', 'Mine'],
  ['ماهواره‌ها', 'Satellites'], ['ماهوارهٔ', 'Satellite'], ['ماهواره', 'Satellite'], ['بوسترهای', 'Boosters'], ['بوسترها', 'Boosters'], ['بوستر', 'Booster'],
  ['کاشی امتیاز دور', 'Round Scoring Tile'], ['کاشی‌های فناوری', 'Tech Tiles'], ['کاشی فناوری', 'Tech Tile'], ['کاشی‌های', 'Tiles'], ['کاشی‌ها', 'Tiles'], ['کاشی', 'Tile'], ['فناوری', 'Tech'],
  ['سازه‌های', 'Structures'], ['سازه‌ها', 'Structures'], ['سازهٔ', 'Structure'], ['سازه', 'Structure'],
  ['کاسه‌های', 'Bowls'], ['کاسه‌ها', 'Bowls'], ['کاسهٔ', 'Bowl'], ['کاسه', 'Bowl'],
  ['امتیاز پایانی', 'Final Scoring'], ['امتیاز', 'VP'], ['ارتقا', 'Upgrade'], ['پاس', 'Pass'], ['جناحتان', 'Faction'], ['جناح', 'Faction'], ['درآمد', 'Income'],
  ['صفحهٔ امتیاز', 'Scoring Board'], ['صفحهٔ پژوهش', 'Research Board'], ['صفحهٔ جناح', 'Faction Board'], ['صفحهٔ', 'Board'], ['ذخیرهٔ', 'Supply'], ['نقشهٔ فضا', 'Space Map'], ['نقشه', 'Map'],
  ['فضای خالی', 'Empty Space'], ['بخشی', 'Sector'], ['بخش', 'Sector'], ['هزینهٔ', 'Cost'], ['هزینه', 'Cost']
];
const TFMAP = new Map<string, string>([...Object.values(terms).map((x): [string, string] => [x.fa, x.bg]), ...EXTRA]);
const TFRX = new RegExp([...TFMAP.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
export const tf = (s: string): string => (getTermsLang() === 'fa-bg' ? s.replace(TFRX, (m) => TFMAP.get(m) ?? m) : s);
