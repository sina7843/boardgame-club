// Ark Nova content chunk «animals»: Persian names (nameFa, optional textFa) of the 128 Animal cards 401-528, Persian
// names/texts of the 32 conservation projects 101-132, and the Final Scoring cards 2 and 4-11 (1 and 3 are in examples.ts).
// API: ./README.md (worked examples in ./examples.ts). Tests: packages/game-engine/test/ark-nova-animals.test.ts
import { animalsIn, buildingSpaces, count, coveredCells, fromTable, P, SCORING_DATA, small, sponsorsIn, terrain } from '../core.ts';
import { isBorder, neighbors } from '../hex.ts';
import { CATEGORIES, type CardDef, type ContentChunk, type Ctx, type ScoringDef } from '../types.ts';

// Animal effects come from their ability keywords (data.ts + abilities chunk); here only the Persian common names.
const NAMES: Record<number, string> = {
  401: 'یوزپلنگ', 402: 'شیر', 403: 'پلنگ', 404: 'کاراکال', 405: 'روباه فنک', 406: 'ببر سیبری', 407: 'ببر سوماترا',
  408: 'خرس تنبل', 409: 'خرس مالایی', 410: 'سمور گلوزرد', 411: 'خرس گریزلی', 412: 'جگوار', 413: 'شیر کوهی',
  414: 'کوآتی آمریکای جنوبی', 415: 'راکون', 416: 'خرس قهوه‌ای اوراسیایی', 417: 'گرگ', 418: 'سیاه‌گوش اوراسیایی',
  419: 'گورکن اروپایی', 420: 'قاقم', 421: 'فک خزدار نیوزیلندی', 422: 'شیر دریایی استرالیایی', 423: 'شیر دریایی نیوزیلندی',
  424: 'دینگوی استرالیایی', 425: 'شیطان تاسمانی', 426: 'فیل بوته‌زار آفریقایی', 427: 'کرگدن سفید', 428: 'زرافهٔ شمالی',
  429: 'گورخر گروی', 430: 'اسب آبی کوتوله', 431: 'فیل آسیایی', 432: 'کرگدن هندی', 433: 'پاندای غول‌پیکر', 434: 'پاندای سرخ',
  435: 'تاپیر مالایی', 436: 'گاومیش کوهان‌دار آمریکایی', 437: 'گاو مشک', 438: 'گوزن شمالی', 439: 'لاما', 440: 'تاپیر کوهی',
  441: 'گاومیش کوهان‌دار اروپایی', 442: 'گوزن موس', 443: 'مرال', 444: 'بز کوهی آلپ', 445: 'تشی کاکل‌دار', 446: 'دوگونگ',
  447: 'کانگوروی قرمز', 448: 'کوآلا', 449: 'نوک‌اردکی', 450: 'ومبات معمولی',
  451: 'میمون دماغ‌دراز', 452: 'گالاگوی سنگالی', 453: 'منگابی یقه‌دار', 454: 'لمور دم‌حلقه‌ای', 455: 'گرزای ردادار',
  456: 'ماکاک بربری', 457: 'ماندریل', 458: 'ماکاک ژاپنی', 459: 'دوک ساق‌سرخ', 460: 'میمون برگ‌خوار تیره',
  461: 'تارسیر هورسفیلد', 462: 'لانگور خاکستری دشت‌های شمالی', 463: 'کاپوچین سفیدصورت پانامایی', 464: 'میمون عنکبوتی قهوه‌ای',
  465: 'تامارین شیری طلایی', 466: 'زوزه‌کش سرخ بولیوی', 467: 'میمون سنجابی اکوادوری', 468: 'تامارین پنبه‌سر',
  469: 'تمساح نیل', 470: 'مامبای سبز غربی', 471: 'لاک‌پشت خاردار آفریقایی', 472: 'بزمجهٔ صخره‌ای', 473: 'آگامای معمولی',
  474: 'پیتون صخره‌ای هندی', 475: 'کبرای هندی', 476: 'اژدهای کومودو', 477: 'آفتاب‌پرست نقاب‌دار', 478: 'اژدهای آبی چینی',
  479: 'آلیگاتور آمریکایی', 480: 'کایمن پوزه‌پهن', 481: 'لاک‌پشت غول‌پیکر گالاپاگوس', 482: 'آناکوندا', 483: 'مار بوآ',
  484: 'لاک‌پشت برکه‌ای اروپایی', 485: 'افعی اروپایی', 486: 'مارمولک دیواری', 487: 'مار علفی', 488: 'مارمولک بی‌پا',
  489: 'تمساح آب‌شور', 490: 'بزمجهٔ گولد', 491: 'مارمولک یقه‌دار', 492: 'تایپان سرزمین‌های داخلی', 493: 'شیطان خاردار',
  494: 'شترمرغ آفریقایی', 495: 'پرندهٔ منشی', 496: 'لک‌لک مارابو', 497: 'فلامینگوی کوچک', 498: 'لک‌لک نوک‌کفشی',
  499: 'کرکس سیاه', 500: 'کرکس نوک‌بلند', 501: 'طاووس هندی', 502: 'نوک‌شاخی بزرگ', 503: 'جغد برفی', 504: 'کندور آند',
  505: 'عقاب سرسفید', 506: 'کرکس شاه', 507: 'رئای بزرگ', 508: 'ماکائوی سرخ', 509: 'عقاب طلایی', 510: 'لک‌لک سفید',
  511: 'فلامینگوی بزرگ', 512: 'شاه‌بوف', 513: 'جغد انبار', 514: 'امو', 515: 'پلیکان استرالیایی', 516: 'کاسواری شمالی',
  517: 'کوکابورای خندان', 518: 'پرندهٔ بهشتی کوچک',
  519: 'بز', 520: 'گوسفند', 521: 'اسب', 522: 'الاغ', 523: 'خرگوش اهلی', 524: 'خوک مانگالیتسا', 525: 'خوکچهٔ هندی',
  526: 'آلپاکا', 527: 'لوریکیت نارگیلی', 528: 'والابی بنت'
};
const cards: CardDef[] = Object.entries(NAMES).map(([id, nameFa]) => ({ id: Number(id), nameFa }));

// ---------------- Conservation projects ----------------
const icons = (what: string) => `در باغ‌وحش‌تان نماد ${what} داشته باشید (هر سطح تعداد مشخصی می‌خواهد).`;
const release = (what: string) =>
  `یک حیوان ${what} را از باغ‌وحش‌تان در طبیعت رها کنید: سطح‌ها به ترتیب حیوانی با محوطهٔ استاندارد ۴–۵، ۳ و ۱–۲ خانه می‌خواهند. حیوان و جذابیتش را از دست می‌دهید. با بازی کردن این کارت ۱ اعتبار می‌گیرید.`;
const breed = (what: string) =>
  `یک ${what} در باغ‌وحش‌تان که قارهٔ آن با یکی از باغ‌وحش‌های همکارتان یکی باشد؛ هر سطح آزاد را می‌توانید انتخاب کنید.`;
const projects: { id: number; nameFa: string; textFa: string }[] = [
  { id: 101, nameFa: 'تنوع گونه‌ها', textFa: 'نمادهای دستهٔ جانوری متفاوت در باغ‌وحش‌تان: ۵ → ۵، ۴ → ۳، ۳ → ۲ حفاظت.' },
  { id: 102, nameFa: 'تنوع زیستگاه‌ها', textFa: 'نمادهای قارهٔ متفاوت در باغ‌وحش‌تان: ۵ → ۵، ۴ → ۳، ۳ → ۲ حفاظت.' },
  { id: 103, nameFa: 'آفریقا', textFa: icons('آفریقا') },
  { id: 104, nameFa: 'آمریکا', textFa: icons('آمریکا') },
  { id: 105, nameFa: 'استرالیا', textFa: icons('استرالیا') },
  { id: 106, nameFa: 'آسیا', textFa: icons('آسیا') },
  { id: 107, nameFa: 'اروپا', textFa: icons('اروپا') },
  { id: 108, nameFa: 'نخستی‌ها', textFa: icons('نخستی') },
  { id: 109, nameFa: 'خزندگان', textFa: icons('خزنده') },
  { id: 110, nameFa: 'شکارچی‌ها', textFa: icons('شکارچی') },
  { id: 111, nameFa: 'گیاه‌خواران', textFa: icons('گیاه‌خوار') },
  { id: 112, nameFa: 'پرندگان', textFa: icons('پرنده') },
  { id: 113, nameFa: 'پارک ملی جنگل باواریا', textFa: release('دارای نماد اروپا') },
  { id: 114, nameFa: 'پارک ملی یوسمیتی', textFa: release('دارای نماد آمریکا') },
  { id: 115, nameFa: 'پارک ملی آنگ‌تونگ', textFa: release('دارای نماد آسیا') },
  { id: 116, nameFa: 'پارک ملی سرنگتی', textFa: release('دارای نماد آفریقا') },
  { id: 117, nameFa: 'پارک ملی کوه‌های آبی', textFa: release('دارای نماد استرالیا') },
  { id: 118, nameFa: 'ساوانا', textFa: release('شکارچی') },
  { id: 119, nameFa: 'رشته‌کوه کم‌ارتفاع', textFa: release('پرنده') },
  { id: 120, nameFa: 'جنگل بامبو', textFa: release('گیاه‌خوار') },
  { id: 121, nameFa: 'غار دریایی', textFa: release('خزنده') },
  { id: 122, nameFa: 'جنگل بارانی', textFa: release('نخستی') },
  { id: 123, nameFa: 'برنامهٔ تکثیر پرندگان', textFa: breed('پرنده') },
  { id: 124, nameFa: 'برنامهٔ تکثیر شکارچی‌ها', textFa: breed('شکارچی') },
  { id: 125, nameFa: 'برنامهٔ تکثیر خزندگان', textFa: breed('خزنده') },
  { id: 126, nameFa: 'برنامهٔ تکثیر گیاه‌خواران', textFa: breed('گیاه‌خوار') },
  { id: 127, nameFa: 'برنامهٔ تکثیر نخستی‌ها', textFa: breed('نخستی') },
  { id: 128, nameFa: 'آبزیان', textFa: icons('آب') },
  { id: 129, nameFa: 'زمین‌شناسی', textFa: icons('صخره') },
  { id: 130, nameFa: 'حیوانات کوچک', textFa: 'حیوانات کوچک (محوطهٔ ۱–۲ خانه یا حیوان باغ‌وحش کودکان) در باغ‌وحش‌تان: ۸ → ۴، ۵ → ۳، ۲ → ۲ حفاظت.' },
  { id: 131, nameFa: 'حیوانات بزرگ', textFa: 'حیوانات بزرگ (محوطهٔ ۴–۵ خانه) در باغ‌وحش‌تان: ۴ → ۴، ۳ → ۳، ۲ → ۲ حفاظت.' },
  { id: 132, nameFa: 'پژوهش', textFa: icons('پژوهش') }
];

// ---------------- Final Scoring cards ----------------
const table = (id: number, n: number) => fromTable(SCORING_DATA[id]!.table, n);
/** Architectural Zoo: 1 CP per condition (only uncovered rock/water spaces must be connected; building spaces exclude rock/water). */
export function architectural(c: Ctx): number {
  const p = P(c);
  const cov = coveredCells(p);
  const linked = (t: 'rock' | 'water') => terrain(p, t).every((x) => neighbors(x).some((n) => cov.has(n)));
  const spaces = buildingSpaces(p);
  return [linked('water'), linked('rock'), spaces.filter(isBorder).every((x) => cov.has(x)), spaces.every((x) => cov.has(x))].filter(Boolean).length;
}
/** Diverse Species Zoo: categories where you have strictly more icons than the player to your right (previous seat). */
export function diverse(c: Ctx): number {
  const right = (c.seat - 1 + c.s.n) % c.s.n;
  return Math.min(4, CATEGORIES.filter((k) => count(c.s, c.seat, k) > count(c.s, right, k)).length);
}
const scoring: ScoringDef[] = [
  { id: 2, nameFa: 'باغ‌وحش حیوانات کوچک', textFa: 'حیوانات کوچک: ۳ → ۱، ۶ → ۲، ۸ → ۳، ۱۰+ → ۴ حفاظت.', score: (c) => table(2, animalsIn(c.s, c.seat).filter(small).length) },
  {
    id: 4, nameFa: 'باغ‌وحش معماری',
    textFa: 'هر شرط ۱ حفاظت: همهٔ خانه‌های آب به سازه وصل باشند؛ همهٔ خانه‌های صخره به سازه وصل باشند؛ همهٔ خانه‌های ساخت‌وساز لبهٔ نقشه پوشیده باشند؛ همهٔ خانه‌های ساخت‌وساز نقشه پوشیده باشند.',
    score: architectural
  },
  { id: 5, nameFa: 'باغ‌وحش حفاظتی', textFa: 'پروژه‌های حفاظتی پشتیبانی‌شده: ۳ → ۱، ۴ → ۲، ۵ → ۳، ۶+ → ۴ حفاظت.', score: (c) => table(5, P(c).supported) },
  {
    id: 6, nameFa: 'باغ‌وحش طبیعت‌گرایان', textFa: 'خانه‌های ساخت‌وساز خالی (خانه‌های ساخت II هم حساب می‌شوند): ۶ → ۱، ۱۲ → ۲، ۱۸ → ۳، ۲۴+ → ۴ حفاظت.',
    score: (c) => { const cov = coveredCells(P(c)); return table(6, buildingSpaces(P(c)).filter((x) => !cov.has(x)).length); }
  },
  { id: 7, nameFa: 'باغ‌وحش محبوب', textFa: 'اعتبار: ۶ → ۱، ۹ → ۲، ۱۲ → ۳، ۱۵ → ۴ حفاظت.', score: (c) => table(7, P(c).rep) },
  { id: 8, nameFa: 'باغ‌وحش حمایت‌شده', textFa: 'کارت‌های حامی در باغ‌وحش‌تان: ۳ → ۱، ۶ → ۲، ۸ → ۳، ۱۰+ → ۴ حفاظت.', score: (c) => table(8, sponsorsIn(c.s, c.seat).length) },
  {
    id: 9, nameFa: 'باغ‌وحش گونه‌های متنوع',
    textFa: 'به ازای هر دستهٔ جانوری (پرنده، گیاه‌خوار، شکارچی، نخستی، خزنده، خرس، باغ‌وحش کودکان) که نمادش را بیشتر از بازیکن قبلی در ترتیب نوبت دارید ۱ حفاظت؛ حداکثر ۴. تساوی امتیاز ندارد.',
    score: diverse
  },
  { id: 10, nameFa: 'پارک صخره‌نوردی', textFa: 'نمادهای صخره: ۱ → ۱، ۳ → ۲، ۵ → ۳، ۷+ → ۴ حفاظت.', score: (c) => table(10, count(c.s, c.seat, 'rock')) },
  { id: 11, nameFa: 'پارک آبی', textFa: 'نمادهای آب: ۲ → ۱، ۴ → ۲، ۶ → ۳، ۸+ → ۴ حفاظت.', score: (c) => table(11, count(c.s, c.seat, 'water')) }
];

export const animals: ContentChunk = { cards, projects, scoring };
