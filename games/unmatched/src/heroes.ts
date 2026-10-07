// Battle of Legends, Volume One: King Arthur, Medusa, Sinbad, Alice. Card values, BOOST values and copy counts are
// from the published deck lists; effect text is a Persian rendering of the official card text. Effects themselves are
// implemented in rules.ts (keyed by slug).

export type CardType = 'attack' | 'defense' | 'versatile' | 'scheme';
/** Banner: which fighters may use the card. */
export type Banner = 'any' | 'hero' | 'sidekick';

export interface CardDef {
  slug: string;
  nameFa: string;
  nameEn: string;
  type: CardType;
  value: number | null;
  boost: number;
  banner: Banner;
  count: number;
  /** Persian effect text, with its timing label (فوری / حین نبرد / پس از نبرد). Empty for no effect. */
  textFa: string;
  /** Jekyll & Hyde: the card may only be used in this form. */
  form?: 'jekyll' | 'hyde';
}

export interface FighterDef { nameFa: string; nameEn: string; hp: number; ranged: boolean }

export interface HeroDef {
  id: string;
  set: string;
  hero: FighterDef;
  /** count 0 = no sidekick. */
  sidekick: FighterDef & { count: number };
  move: number;
  abilityFa: string;
  color: string;
  cards: CardDef[];
}

const c = (slug: string, nameFa: string, nameEn: string, type: CardType, value: number | null, boost: number, banner: Banner, count: number, textFa = '', form?: 'jekyll' | 'hyde'): CardDef =>
  ({ slug, nameFa, nameEn, type, value, boost, banner, count, textFa, ...(form ? { form } : {}) });
const NONE = { nameFa: '', nameEn: '', hp: 0, ranged: false, count: 0 };
const VOL1 = 'Battle of Legends, Vol. 1';
const COBBLE = 'Cobble & Fog';

const FEINT = 'فوری: همه اثرهای کارت حریف لغو می‌شود.';
const REGROUP = 'پس از نبرد: ۱ کارت بکشید. اگر نبرد را بردید، به‌جایش ۲ کارت بکشید.';
const SHIFT = 'حین نبرد: اگر مبارز شما این نوبت را در خانه دیگری شروع کرده باشد، ارزش این کارت ۵ است.';
const SKIRMISH = 'پس از نبرد: اگر نبرد را بردید، یکی از دو مبارز نبرد را تا ۲ خانه جابه‌جا کنید.';
const VOYAGE = 'حین نبرد: به‌ازای هر کارت «سفر» دیگر در دورریخته‌های شما، ارزش این کارت ۱+ می‌شود.';

export const HEROES: Record<string, HeroDef> = {
  arthur: {
    id: 'arthur', set: VOL1,
    hero: { nameFa: 'شاه آرتور', nameEn: 'King Arthur', hp: 18, ranged: false },
    sidekick: { nameFa: 'مرلین', nameEn: 'Merlin', hp: 7, ranged: true, count: 1 },
    move: 2,
    color: '#c8323a',
    abilityFa: 'وقتی شاه آرتور حمله می‌کند، می‌توانید حمله را تقویت کنید: یک کارت تقویت را رو به پایین همراه کارت حمله بازی کنید. اگر حریف اثرهای کارت حمله را لغو کند، تقویت بی‌اثر دور ریخته می‌شود.',
    cards: [
      c('skirmish', 'زد و خورد', 'Skirmish', 'versatile', 4, 1, 'any', 3, SKIRMISH),
      c('noble-sacrifice', 'فداکاری شرافتمندانه', 'Noble Sacrifice', 'attack', 2, 3, 'hero', 3, 'حین نبرد: می‌توانید این حمله را تقویت کنید (علاوه بر تقویتِ توانایی شاه آرتور).'),
      c('excalibur', 'اکسکالیبور', 'Excalibur', 'attack', 6, 3, 'hero', 1),
      c('the-aid-of-morgana', 'یاری مورگانا', 'The Aid of Morgana', 'attack', 4, 2, 'hero', 1, 'پس از نبرد: ۲ کارت بکشید.'),
      c('divine-intervention', 'مداخله الهی', 'Divine Intervention', 'versatile', 3, 2, 'hero', 2, 'پس از نبرد: شاه آرتور را تا ۵ خانه جابه‌جا کنید.'),
      c('the-holy-grail', 'جام مقدس', 'The Holy Grail', 'defense', 1, 2, 'hero', 1, 'پس از نبرد: اگر شاه آرتور ۴ سلامتی یا کمتر دارد ولی شکست نخورده، سلامتی‌اش ۸ می‌شود.'),
      c('the-lady-of-the-lake', 'بانوی دریاچه', 'The Lady of the Lake', 'scheme', null, 2, 'hero', 1, 'کارت «اکسکالیبور» را در دسته و دورریخته‌هایتان پیدا کنید و به دستتان اضافه کنید. اگر در دسته گشتید، آن را بُر بزنید.'),
      c('prophecy', 'پیشگویی', 'Prophecy', 'scheme', null, 2, 'sidekick', 1, '۴ کارت بالای دسته‌تان را ببینید. ۲ تا را به دستتان اضافه کنید و ۲ تای دیگر را به هر ترتیبی روی دسته برگردانید.'),
      c('bewilderment', 'سردرگمی', 'Bewilderment', 'defense', 0, 2, 'sidekick', 2, 'حین نبرد: همه آسیب‌ها خنثی می‌شود. پس از نبرد: می‌توانید مبارزتان را در هر خانه خالی بگذارید.'),
      c('aid-the-chosen-one', 'یاری برگزیده', 'Aid the Chosen One', 'attack', 4, 2, 'sidekick', 1, 'پس از نبرد: اگر نبرد را بردید، ۲ کارت بکشید.'),
      c('restless-spirits', 'ارواح ناآرام', 'Restless Spirits', 'scheme', null, 2, 'sidekick', 1, 'یک خانه در منطقه مرلین انتخاب کنید. به هر مبارز حریف در آن خانه و در یک خانه مجاورش ۲ آسیب بزنید. اگر دست‌کم یکی شکست خورد، ۱ کارت بکشید.'),
      c('command-the-storms', 'فرمان طوفان‌ها', 'Command the Storms', 'scheme', null, 2, 'sidekick', 2, 'هر مبارز را، از جمله مبارزان حریف، تا ۳ خانه جابه‌جا کنید.'),
      c('swift-strike', 'ضربه سریع', 'Swift Strike', 'attack', 3, 2, 'any', 2, 'پس از نبرد: مبارزتان را تا ۴ خانه جابه‌جا کنید.'),
      c('momentous-shift', 'جابه‌جایی سرنوشت‌ساز', 'Momentous Shift', 'versatile', 3, 1, 'any', 3, SHIFT),
      c('feint', 'فریب', 'Feint', 'versatile', 2, 1, 'any', 3, FEINT),
      c('regroup', 'تجدید قوا', 'Regroup', 'versatile', 1, 1, 'any', 3, REGROUP)
    ]
  },
  medusa: {
    id: 'medusa', set: VOL1,
    hero: { nameFa: 'مدوسا', nameEn: 'Medusa', hp: 16, ranged: true },
    sidekick: { nameFa: 'هارپی', nameEn: 'Harpy', hp: 1, ranged: false, count: 3 },
    move: 3,
    color: '#3f8f4f',
    abilityFa: 'در شروع نوبتتان می‌توانید به یک مبارز حریف در منطقه مدوسا ۱ آسیب بزنید.',
    cards: [
      c('dash', 'یورش', 'Dash', 'versatile', 3, 1, 'any', 3, 'پس از نبرد: مبارزتان را تا ۳ خانه جابه‌جا کنید.'),
      c('gaze-of-stone', 'نگاه سنگی', 'Gaze of Stone', 'attack', 2, 4, 'hero', 3, 'پس از نبرد: اگر نبرد را بردید، به مبارز حریف ۸ آسیب بزنید.'),
      c('a-momentary-glance', 'نگاهی گذرا', 'A Momentary Glance', 'scheme', null, 4, 'hero', 2, 'به یک مبارز دلخواه در منطقه مدوسا ۲ آسیب بزنید.'),
      c('hiss-and-slither', 'هیس و خزیدن', 'Hiss and Slither', 'defense', 4, 3, 'hero', 3, 'پس از نبرد: حریف ۱ کارت دور می‌ریزد.'),
      c('the-hounds-of-mighty-zeus', 'سگان زئوس توانا', 'The Hounds of Mighty Zeus', 'versatile', 4, 3, 'sidekick', 2, 'پس از نبرد: هر هارپی را تا ۳ خانه جابه‌جا کنید.'),
      c('clutching-claws', 'چنگال‌های گیرا', 'Clutching Claws', 'versatile', 3, 2, 'sidekick', 3, 'پس از نبرد: حریف ۱ کارت دور می‌ریزد.'),
      c('winged-frenzy', 'جنون بال‌دار', 'Winged Frenzy', 'scheme', null, 2, 'any', 2, 'هر یک از مبارزانتان را تا ۳ خانه جابه‌جا کنید؛ می‌توانند از خانه‌های مبارزان حریف عبور کنند. سپس یک هارپی شکست‌خورده (اگر هست) را به یک خانه در منطقه مدوسا برگردانید.'),
      c('second-shot', 'تیر دوم', 'Second Shot', 'attack', 3, 3, 'hero', 3, 'حین نبرد: می‌توانید این حمله را تقویت کنید.'),
      c('snipe', 'تک‌تیر', 'Snipe', 'versatile', 3, 1, 'any', 3, 'پس از نبرد: ۱ کارت بکشید.'),
      c('feint', 'فریب', 'Feint', 'versatile', 2, 2, 'any', 3, FEINT),
      c('regroup', 'تجدید قوا', 'Regroup', 'versatile', 1, 2, 'any', 3, REGROUP)
    ]
  },
  sinbad: {
    id: 'sinbad', set: VOL1,
    hero: { nameFa: 'سندباد', nameEn: 'Sinbad', hp: 15, ranged: false },
    sidekick: { nameFa: 'باربر', nameEn: 'The Porter', hp: 6, ranged: false, count: 1 },
    move: 2,
    color: '#d98a1f',
    abilityFa: 'هفت سفر: وقتی مانور می‌دهید، مبارزانتان به‌ازای هر کارت «سفر» در دورریخته‌هایتان ۱ خانه بیشتر حرکت می‌کنند.',
    cards: [
      c('exploit', 'بهره‌برداری', 'Exploit', 'versatile', 4, 1, 'any', 2, 'پس از نبرد: ۱ کارت بکشید.'),
      c('toil-and-danger', 'رنج و خطر', 'Toil and Danger', 'versatile', 3, 1, 'hero', 4, 'پس از نبرد: سندباد را تا ۳ خانه جابه‌جا کنید.'),
      c('voyage-home', 'سفر بازگشت', 'Voyage Home', 'attack', 2, 1, 'hero', 1, `${VOYAGE} پس از نبرد: همه کارت‌های «سفر» دیگر را از دورریخته‌ها به دستتان برگردانید.`),
      c('riches-beyond-compare', 'ثروت بی‌همتا', 'Riches Beyond Compare', 'scheme', null, 1, 'hero', 2, '۳ کارت بکشید.'),
      c('by-fortune-and-fate', 'به بخت و تقدیر', 'By Fortune and Fate', 'attack', 3, 1, 'sidekick', 3, 'پس از نبرد: ۲ کارت بکشید.'),
      c('voyage-to-the-island-that-was-a-whale', 'سفر به جزیره‌ای که نهنگ بود', 'Voyage to the Island That Was a Whale', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: سندباد ۲ سلامتی بازمی‌یابد.`),
      c('voyage-to-the-valley-of-the-giant-snakes', 'سفر به دره مارهای غول‌پیکر', 'Voyage to the Valley of the Giant Snakes', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: دست حریف را ببینید.`),
      c('voyage-to-the-creature-with-eyes-like-coals-of-fire', 'سفر به موجودی با چشمانی چون اخگر', 'Voyage to the Creature With Eyes Like Coals of Fire', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: حریف ۱ کارت تصادفی دور می‌ریزد.`),
      c('voyage-to-the-cannibals-with-the-root-of-madness', 'سفر به آدم‌خوارها و ریشه جنون', 'Voyage to the Cannibals With the Root of Madness', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: می‌توانید سندباد را تا ۲ خانه جابه‌جا کنید.`),
      c('voyage-to-the-city-of-the-man-eating-apes', 'سفر به شهر میمون‌های آدم‌خوار', 'Voyage to the City of the Man-Eating Apes', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: به مبارز حریف ۲ آسیب بزنید.`),
      c('voyage-to-the-city-of-the-king-of-serendib', 'سفر به شهر پادشاه سراندیب', 'Voyage to the City of the King of Serendib', 'attack', 2, 0, 'hero', 1, `${VOYAGE} پس از نبرد: ۱ کارت بکشید.`),
      c('commanding-impact', 'ضربه فرمان‌دهنده', 'Commanding Impact', 'attack', 5, 2, 'any', 1, 'پس از نبرد: ۱ کارت بکشید.'),
      c('leap-away', 'جهش', 'Leap Away', 'versatile', 4, 1, 'any', 2, 'پس از نبرد: اگر نبرد را بردید، یکی از دو مبارز نبرد را تا ۴ خانه جابه‌جا کنید.'),
      c('momentous-shift', 'جابه‌جایی سرنوشت‌ساز', 'Momentous Shift', 'versatile', 3, 1, 'any', 3, SHIFT),
      c('feint', 'فریب', 'Feint', 'versatile', 2, 1, 'any', 3, FEINT),
      c('regroup', 'تجدید قوا', 'Regroup', 'versatile', 1, 1, 'any', 3, REGROUP)
    ]
  },
  alice: {
    id: 'alice', set: VOL1,
    hero: { nameFa: 'آلیس', nameEn: 'Alice', hp: 13, ranged: false },
    sidekick: { nameFa: 'جبرواک', nameEn: 'The Jabberwock', hp: 8, ranged: false, count: 1 },
    move: 2,
    color: '#2f7fc1',
    abilityFa: 'عجیب و عجیب‌تر: هنگام چیدن آلیس، بزرگ یا کوچک بودنش را انتخاب کنید. آلیسِ بزرگ ۲+ به ارزش کارت‌های حمله‌اش می‌گیرد و آلیسِ کوچک ۱+ به ارزش کارت‌های دفاعش.',
    cards: [
      c('claws-that-catch', 'چنگال‌هایی که می‌گیرند', 'Claws That Catch', 'attack', 3, 2, 'sidekick', 2, 'حین نبرد: اگر مبارز حریف قهرمان باشد، ارزش این کارت ۵ است.'),
      c('momentous-shift', 'جابه‌جایی سرنوشت‌ساز', 'Momentous Shift', 'versatile', 3, 1, 'any', 2, SHIFT),
      c('skirmish', 'زد و خورد', 'Skirmish', 'versatile', 4, 1, 'any', 2, SKIRMISH),
      c('mad-as-a-hatter', 'دیوانه مثل کلاه‌دوز', 'Mad as a Hatter', 'versatile', 3, 1, 'hero', 2, 'پس از نبرد: هر یک از مبارزانتان را تا ۲ خانه جابه‌جا کنید. اندازه را عوض کنید.'),
      c('manxome-foe', 'دشمن هولناک', 'Manxome Foe', 'versatile', 3, 2, 'any', 2, 'حین نبرد: کارت بالای دسته‌تان را دور بریزید و ارزش تقویتش را به ارزش این کارت اضافه کنید.'),
      c('feint', 'فریب', 'Feint', 'versatile', 2, 2, 'any', 3, FEINT),
      c('regroup', 'تجدید قوا', 'Regroup', 'versatile', 1, 2, 'any', 3, REGROUP),
      c('looking-glass', 'آینه', 'Looking Glass', 'defense', 2, 4, 'hero', 2, 'پس از نبرد: ۲ اثر متفاوت انتخاب کنید: ۲ کارت بکشید · آلیس ۳ سلامتی بازیابد · آلیس را در هر خانه خالی دیگری بگذارید.'),
      c('snicker-snack', 'شَرَق‌شُرُق', 'Snicker-Snack', 'attack', 3, 4, 'hero', 1, 'پس از نبرد: اگر نبرد را بردید، دست حریف را ببینید و ۱ کارت را برای دور ریختن انتخاب کنید.'),
      c('o-frabjous-day', 'ای روز فرخنده!', 'O Frabjous Day!', 'attack', 4, 4, 'hero', 1, 'پس از نبرد: اندازه را عوض کنید.'),
      c('the-other-side-of-the-mushroom', 'آن سوی قارچ', 'The Other Side of the Mushroom', 'attack', 3, 4, 'hero', 1, 'پس از نبرد: آلیس را تا ۳ خانه جابه‌جا کنید. اندازه را عوض کنید.'),
      c('eat-me', 'مرا بخور', 'Eat Me', 'scheme', null, 3, 'hero', 2, 'آلیس را تا ۳ خانه جابه‌جا کنید. اندازه را عوض کنید.'),
      c('i-m-late-i-m-late', 'دیرم شد، دیرم شد', "I'm Late, I'm Late", 'versatile', 2, 3, 'hero', 3, 'پس از نبرد: آلیس را تا ۵ خانه جابه‌جا کنید. اندازه را عوض کنید.'),
      c('drink-me', 'مرا بنوش', 'Drink Me', 'scheme', null, 2, 'hero', 2, '۲ کارت بکشید. اندازه را عوض کنید.'),
      c('jaws-that-bite', 'آرواره‌هایی که می‌گزند', 'Jaws That Bite', 'attack', 4, 2, 'sidekick', 2, 'پس از نبرد: به یک مبارز مجاور جبرواک ۲ آسیب بزنید.')
    ]
  },
  // ---------- Cobble & Fog ----------
  holmes: {
    id: 'holmes', set: COBBLE,
    hero: { nameFa: 'شرلوک هولمز', nameEn: 'Sherlock Holmes', hp: 16, ranged: false },
    sidekick: { nameFa: 'دکتر واتسون', nameEn: 'Dr. Watson', hp: 8, ranged: true, count: 1 },
    move: 2,
    color: '#5b6b7f',
    abilityFa: 'حریف نمی‌تواند اثرهای کارت‌های «هولمز» و «دکتر واتسون» را لغو کند (اثر کارت‌های «هر مبارز» لغوشدنی است).',
    cards: [
      c('feint', 'فریب', 'Feint', 'versatile', 2, 1, 'any', 3, FEINT),
      c('education-never-ends', 'آموختن پایانی ندارد', 'Education Never Ends', 'versatile', 3, 1, 'any', 2, 'پس از نبرد: اگر نبرد را بردید، حریف ۱ کارت می‌کشد. اگر باختید، ۲ کارت بکشید.'),
      c('study-methods', 'روش‌شناسی', 'Study Methods', 'versatile', 3, 2, 'any', 2, 'پس از نبرد: اگر نبرد را بردید، دست حریف را ببینید.'),
      c('deduce-strategy', 'استنتاج نقشه', 'Deduce Strategy', 'versatile', 3, 1, 'hero', 3, 'حین نبرد: می‌توانید ارزش چاپی کارت حریف را برابر ارزش تقویتش کنید.'),
      c('counterpunch', 'ضدضربه', 'Counterpunch', 'versatile', 3, 1, 'hero', 3, 'پس از نبرد: اگر هولمز مجاور مبارز حریف است، به آن ۲ آسیب بزنید.'),
      c('fixed-point-in-a-changing-age', 'نقطه ثابت در عصر تغییر', 'Fixed Point in a Changing Age', 'versatile', 3, 1, 'sidekick', 2, 'پس از نبرد: اگر دکتر واتسون مجاور هولمز است، هر دو ۱ سلامتی بازمی‌یابند.'),
      c('the-game-is-afoot', 'بازی شروع شده', 'The Game is Afoot', 'attack', 5, 2, 'hero', 2, 'پس از نبرد: هولمز را تا ۳ خانه جابه‌جا کنید.'),
      c('service-revolver', 'هفت‌تیر خدمت', 'Service Revolver', 'attack', 5, 3, 'sidekick', 2),
      c('elementary', 'بدیهی است', 'Elementary', 'defense', 3, 3, 'hero', 2, 'این کارت را رو به بالا بازی کنید و ارزش چاپی حمله حریف را پیش‌بینی کنید. حین نبرد: اگر درست گفتید، همه اثرهای کارت حریف لغو و ارزش حمله‌اش نادیده گرفته می‌شود.'),
      c('confirm-suspicion', 'تأیید سوءظن', 'Confirm Suspicion', 'scheme', null, 1, 'hero', 3, 'حریفی را انتخاب کنید و عددی بگویید. او باید یک کارت با همان ارزش حمله یا دفاع دور بریزد و قهرمانش به اندازه تقویت آن کارت آسیب می‌بیند. اگر چنین کارتی ندارد، دستش را نشان می‌دهد.'),
      c('eliminate-the-impossible', 'حذف ناممکن‌ها', 'Eliminate the Impossible', 'scheme', null, 2, 'hero', 2, 'حریفی را انتخاب کنید. دستش را ببینید و ۱ کارت را برای دور ریختن انتخاب کنید.'),
      c('master-of-disguise', 'استاد تغییر چهره', 'Master of Disguise', 'scheme', null, 2, 'hero', 2, 'حریفی را انتخاب کنید. هولمز با قهرمان او جا عوض می‌کند. به آن قهرمان ۱ آسیب بزنید.'),
      c('administer-aid', 'کمک‌رسانی', 'Administer Aid', 'scheme', null, 2, 'sidekick', 2, 'دکتر واتسون را در خانه‌ای مجاور هولمز بگذارید. هولمز ۱ سلامتی بازمی‌یابد. ۱ کارت بکشید.')
    ]
  },
  dracula: {
    id: 'dracula', set: COBBLE,
    hero: { nameFa: 'دراکولا', nameEn: 'Dracula', hp: 13, ranged: false },
    sidekick: { nameFa: 'خواهر', nameEn: 'Sister', hp: 1, ranged: false, count: 3 },
    move: 2,
    color: '#8e1f2f',
    abilityFa: 'تشنه خون: در شروع نوبتتان می‌توانید به یک مبارز مجاور دراکولا ۱ آسیب بزنید؛ اگر زدید، ۱ کارت بکشید.',
    cards: [
      c('feint', 'فریب', 'Feint', 'versatile', 2, 2, 'any', 3, FEINT),
      c('dash', 'یورش', 'Dash', 'versatile', 3, 1, 'any', 3, 'پس از نبرد: مبارزتان را تا ۳ خانه جابه‌جا کنید.'),
      c('exploit', 'بهره‌برداری', 'Exploit', 'versatile', 4, 1, 'any', 2, 'پس از نبرد: ۱ کارت بکشید.'),
      c('ambush', 'کمین', 'Ambush', 'attack', 2, 3, 'any', 2, 'حین نبرد: حریف ۱ کارت تصادفی دور می‌ریزد؛ ارزش تقویت آن به ارزش حمله این کارت اضافه می‌شود.'),
      c('feeding-frenzy', 'جنون تغذیه', 'Feeding Frenzy', 'attack', 2, 3, 'hero', 2, 'حین نبرد: به‌ازای هر خواهر در منطقه مبارز حریف، ارزش این کارت ۱+ می‌شود.'),
      c('beastform', 'هیبت جانور', 'Beastform', 'attack', 6, 4, 'hero', 2, 'حین نبرد: می‌توانید هر تعداد کارت از دستتان دور بریزید؛ به‌ازای هر کدام ۱+.'),
      c('do-my-bidding', 'فرمانم را ببر', 'Do My Bidding', 'defense', 3, 3, 'hero', 2, 'فوری: کارت حمله حریف به دستش برمی‌گردد. دستش را ببینید و یک کارت حمله یا همه‌کاره برایش انتخاب کنید تا بازی کند (می‌تواند همان کارت باشد).'),
      c('look-into-my-eyes', 'به چشمانم نگاه کن', 'Look Into My Eyes', 'defense', 1, 2, 'hero', 2, 'حین نبرد: ارزش تقویت کارت حمله حریف را به ارزش دفاع این کارت اضافه کنید.'),
      c('mistform', 'هیبت مه', 'Mistform', 'scheme', null, 2, 'hero', 2, 'دراکولا را در هر خانه‌ای بگذارید. ۱ اقدام اضافه بگیرید.'),
      c('prey-upon', 'شکار', 'Prey Upon', 'scheme', null, 4, 'hero', 2, 'به همه مبارزان حریفِ مجاور دراکولا ۱ آسیب بزنید. دراکولا به‌ازای هر آسیب ۱ سلامتی بازمی‌یابد.'),
      c('baptism-of-blood', 'غسل خون', 'Baptism of Blood', 'scheme', null, 2, 'hero', 2, '۲ سلامتی بازیابید. یک خواهر شکست‌خورده (اگر هست) را به یک خانه در منطقه دراکولا برگردانید.'),
      c('thirst-for-sustenance', 'عطش خوراک', 'Thirst for Sustenance', 'attack', 3, 3, 'sidekick', 3, 'پس از نبرد: اگر نبرد را بردید، دراکولا را در خانه‌ای مجاور مبارز حریف بگذارید.'),
      c('ravening-seduction', 'اغوای درنده', 'Ravening Seduction', 'scheme', null, 2, 'sidekick', 3, 'هر مبارزی را تا ۲ خانه جابه‌جا کنید. سپس به‌ازای هر خواهرِ مجاورش ۱ آسیب به آن بزنید.')
    ]
  },
  jekyll: {
    id: 'jekyll', set: COBBLE,
    hero: { nameFa: 'جکیل و هاید', nameEn: 'Jekyll & Hyde', hp: 16, ranged: false },
    sidekick: NONE,
    move: 2,
    color: '#4f7a3a',
    abilityFa: 'سرم: بازی را در قالب دکتر جکیل شروع می‌کنید. در شروع هر نوبت می‌توانید به جکیل یا هاید تبدیل شوید. در قالب آقای هاید، پس از هر مانور ۱ آسیب می‌خورید. کارت‌های «دکتر جکیل» و «آقای هاید» فقط در همان قالب قابل استفاده‌اند.',
    cards: [
      c('feint', 'فریب', 'Feint', 'versatile', 2, 2, 'any', 3, FEINT),
      c('skirmish', 'زد و خورد', 'Skirmish', 'versatile', 4, 1, 'any', 3, SKIRMISH),
      c('duality-of-man', 'دوگانگی انسان', 'Duality of Man', 'versatile', 3, 1, 'any', 2, 'حین نبرد: اگر دکتر جکیل هستید و با این کارت دفاع می‌کنید، یا آقای هاید هستید و حمله می‌کنید، ارزش آن ۶ است.'),
      c('distracted-triage', 'درمان شتاب‌زده', 'Distracted Triage', 'versatile', 3, 3, 'hero', 2, 'پس از نبرد: اگر نبرد را بردید، ۲ سلامتی بازیابید.', 'jekyll'),
      c('succumb-to-compulsion', 'تسلیم وسوسه', 'Succumb to Compulsion', 'versatile', 2, 2, 'hero', 3, 'پس از نبرد: تا ۲ خانه جابه‌جا شوید. به آقای هاید تبدیل شوید.', 'jekyll'),
      c('madness-relents', 'فروکش جنون', 'Madness Relents', 'versatile', 4, 2, 'hero', 2, 'پس از نبرد: به دکتر جکیل تبدیل شوید.', 'hyde'),
      c('recoiling-blow', 'ضربه پس‌زننده', 'Recoiling Blow', 'attack', 5, 2, 'hero', 2, 'پس از نبرد: آقای هاید را در خانه‌ای از منطقه‌اش بگذارید. به دکتر جکیل تبدیل شوید.', 'hyde'),
      c('forever-hyde', 'هاید برای همیشه', 'Forever Hyde', 'attack', 5, 2, 'hero', 2, 'حین نبرد: می‌توانید کارت‌های «دکتر جکیل» را دور بریزید؛ به‌ازای هر کدام ۲+.', 'hyde'),
      c('with-haste', 'با شتاب!', 'With Haste!', 'defense', 4, 3, 'hero', 2, 'پس از نبرد: دکتر جکیل را تا ۴ خانه جابه‌جا کنید.', 'jekyll'),
      c('scientific-method', 'روش علمی', 'Scientific Method', 'defense', 2, 2, 'hero', 2, 'پس از نبرد: به تعداد آسیبی که خوردید کارت بکشید.', 'jekyll'),
      c('calming-research', 'پژوهش آرام‌بخش', 'Calming Research', 'scheme', null, 3, 'hero', 2, '۲ سلامتی بازیابید. تا ۳ کارت بالای دسته را بکشید؛ یکی را نگه دارید و بقیه را به هر ترتیبی زیر دسته بگذارید.', 'jekyll'),
      c('pure-evil', 'شر محض', 'Pure Evil', 'scheme', null, 3, 'hero', 3, 'آقای هاید را در خانه‌ای از منطقه‌اش بگذارید. هاید به همه مبارزان مجاورش ۲ آسیب می‌زند.', 'hyde'),
      c('strange-case', 'ماجرای عجیب', 'Strange Case', 'scheme', null, 2, 'hero', 2, 'کارت بالای دسته‌تان را رو کنید. به یک مبارز مجاور به اندازه تقویت آن آسیب بزنید. کارت را به دستتان اضافه کنید.', 'hyde')
    ]
  },
  invisible: {
    id: 'invisible', set: COBBLE,
    hero: { nameFa: 'مرد نامرئی', nameEn: 'Invisible Man', hp: 15, ranged: false },
    sidekick: NONE,
    move: 2,
    color: '#6f6f7a',
    abilityFa: 'در شروع بازی، پس از چیدن مرد نامرئی، ۳ نشان مه در خانه‌های جدا در منطقه او بگذارید. وقتی روی خانه مه‌دار است، ارزش کارت‌های دفاعش ۱+ می‌شود. بین دو خانه مه‌دار می‌تواند طوری حرکت کند که انگار مجاورند.',
    cards: [
      c('covert-preparation', 'تدارک پنهانی', 'Covert Preparation', 'versatile', 2, 1, 'hero', 3, 'پس از نبرد: ۱ کارت بکشید. یک نشان مه را تا ۲ خانه جابه‌جا کنید؛ سپس حریف نشان مه دیگری را تا ۲ خانه جابه‌جا می‌کند.'),
      c('dreaming-of-revenge', 'رؤیای انتقام', 'Dreaming of Revenge', 'versatile', 3, 1, 'hero', 2, 'پس از نبرد: اگر مرد نامرئی روی خانه مه‌دار است، همه مبارزان حریفِ روی خانه‌های مه‌دار ۱ آسیب می‌بینند.'),
      c('confound', 'سردرگم کردن', 'Confound', 'versatile', 3, 2, 'hero', 2, 'پس از نبرد: حریف می‌تواند ۱ کارت دور بریزد. اگر نریخت، می‌توانید هر نشان مه را به هر خانه دیگری ببرید.'),
      c('impossible-to-see', 'دیده‌نشدنی', 'Impossible to See', 'versatile', 2, 2, 'hero', 2, 'فوری: ارزش حمله یا دفاع حریف ۰ است و با اثر کارت‌ها تغییر نمی‌کند (اثرهای دیگر اجرا می‌شوند).'),
      c('surprise-attack', 'حمله غافلگیرانه', 'Surprise Attack', 'attack', 5, 1, 'hero', 2, 'فوری: همه اثرهای کارت حریف لغو می‌شود. پس از نبرد: اگر مرد نامرئی روی خانه مه‌دار است، آن مه را به خانه دیگری ببرید.'),
      c('slip-away', 'گریز', 'Slip Away', 'attack', 3, 2, 'hero', 3, 'پس از نبرد: یک نشان مه را به خانه‌ای بدون مبارز ببرید و مرد نامرئی را روی آن بگذارید.'),
      c('emerge-from-mist', 'برآمدن از مه', 'Emerge From Mist', 'attack', 3, 2, 'hero', 2, 'حین نبرد: اگر مرد نامرئی این نوبت را روی خانه مه‌دار شروع کرده، ارزش این کارت ۵ است.'),
      c('lurking', 'کمین‌نشستن', 'Lurking', 'defense', 2, 2, 'hero', 2, 'پس از نبرد: ۱ کارت بکشید و یکی را انتخاب کنید: مرد نامرئی به خانه‌ای مه‌دار برود · یک نشان مه را تا ۳ خانه جابه‌جا کنید.'),
      c('into-thin-air', 'دود شدن در هوا', 'Into Thin Air', 'defense', 4, 1, 'hero', 2, 'پس از نبرد: مرد نامرئی را تا ۱ خانه جابه‌جا کنید. سپس حریف یک نشان مه را تا ۳ خانه جابه‌جا می‌کند.'),
      c('coded-notes', 'یادداشت‌های رمزی', 'Coded Notes', 'defense', 3, 2, 'hero', 2, 'پس از نبرد: ۳ کارت بکشید، سپس ۲ کارت از دستتان را به هر ترتیبی روی دسته بگذارید.'),
      c('reign-of-terror', 'حکومت وحشت', 'Reign of Terror', 'scheme', null, 1, 'hero', 2, 'اگر مرد نامرئی روی خانه مه‌دار است، به یک مبارز حریف دلخواه ۲ آسیب بزنید.'),
      c('vanish', 'ناپدید شدن', 'Vanish', 'scheme', null, 3, 'hero', 2, '۱ سلامتی بازیابید. مرد نامرئی را از صفحه بردارید؛ در شروع نوبت بعدتان او را در هر خانه‌ای بگذارید. (اگر اقدام اول بود، نوبتتان تمام می‌شود.)'),
      c('step-lightly', 'آهسته قدم بردار', 'Step Lightly', 'scheme', null, 1, 'hero', 2, 'به یک مبارز مجاور ۱ آسیب بزنید؛ اگر مرد نامرئی روی خانه مه‌دار است، ۳ آسیب. سپس حریف یک نشان مه را تا ۲ خانه جابه‌جا می‌کند.'),
      c('rolling-fog', 'مه غلتان', 'Rolling Fog', 'scheme', null, 1, 'hero', 2, 'یک نشان مه را به خانه دیگری ببرید. ۱ اقدام اضافه بگیرید.')
    ]
  }
};

export const HERO_IDS = Object.keys(HEROES);
export const isVoyage = (slug: string) => slug.startsWith('voyage');
