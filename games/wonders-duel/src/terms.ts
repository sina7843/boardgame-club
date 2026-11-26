import { getTermsLang, type Term } from '@bg/ui';

/** 7 Wonders Duel terms. `fa` = Persian words used today; `bg` = Latin term for «فارسی بردگیمی». */
export const terms = {
  wood: { fa: 'چوب', bg: 'Wood' }, clay: { fa: 'رس', bg: 'Clay' }, stone: { fa: 'سنگ', bg: 'Stone' }, glass: { fa: 'شیشه', bg: 'Glass' }, papyrus: { fa: 'پاپیروس', bg: 'Papyrus' },
  raw: { fa: 'مواد خام', bg: 'Raw materials' }, manufactured: { fa: 'کالا', bg: 'Manufactured goods' }, civilian: { fa: 'مدنی', bg: 'Civilian' },
  military: { fa: 'نظامی', bg: 'Military' }, science: { fa: 'علمی', bg: 'Science' }, commercial: { fa: 'تجاری', bg: 'Commercial' }, guild: { fa: 'صنف', bg: 'Guild' },
  wonder: { fa: 'شگفتی', bg: 'Wonder' }, wonders: { fa: 'شگفتی‌ها', bg: 'Wonders' },
  progressToken: { fa: 'نشان پیشرفت', bg: 'Progress token' }, progressTokens: { fa: 'نشان‌های پیشرفت', bg: 'Progress tokens' },
  agriculture: { fa: 'کشاورزی', bg: 'Agriculture' }, architecture: { fa: 'معماری', bg: 'Architecture' }, economy: { fa: 'اقتصاد', bg: 'Economy' },
  law: { fa: 'قانون', bg: 'Law' }, masonry: { fa: 'بنّایی', bg: 'Masonry' }, mathematics: { fa: 'ریاضیات', bg: 'Mathematics' },
  philosophy: { fa: 'فلسفه', bg: 'Philosophy' }, strategy: { fa: 'راهبرد', bg: 'Strategy' }, theology: { fa: 'الهیات', bg: 'Theology' }, urbanism: { fa: 'شهرسازی', bg: 'Urbanism' },
  // components / actions
  coin: { fa: 'سکه', bg: 'Coins' }, card: { fa: 'کارت', bg: 'Card' }, age: { fa: 'دوران', bg: 'Age' }, conflict: { fa: 'نبرد', bg: 'Military' }, war: { fa: 'جنگ', bg: 'Military' },
  progressShort: { fa: 'نشان', bg: 'Progress' }, shield: { fa: 'سپر', bg: 'Shield' }, free: { fa: 'رایگان', bg: 'Free' }, cost: { fa: 'هزینه', bg: 'Cost' },
  chain: { fa: 'زنجیره', bg: 'Chain' }, city: { fa: 'شهر', bg: 'City' }, opponent: { fa: 'حریف', bg: 'Opponent' }, wealth: { fa: 'ثروت', bg: 'Wealth' },
  coinsFor: { fa: 'سکه برای', bg: 'Coins for' }, toOne: { fa: 'به ۱', bg: 'for 1' }, replay: { fa: 'نوبت دوباره', bg: 'Play again' },
  fromDiscard: { fa: 'ساخت از دورریز', bg: 'Build from discard' }, hiddenToken: { fa: 'نشان پنهان', bg: 'Progress token (hidden)' },
  builtP: { fa: ' (ساخته‌شده)', bg: ' (Built)' }, noBuildings: { fa: 'هنوز ساختمانی نیست', bg: 'No buildings yet' },
  faceDown: { fa: 'کارت پشت‌ورو', bg: 'Face-down card' }, cardActions: { fa: 'کار با کارت', bg: 'Card actions' },
  scienceSymbol: { fa: 'نشان علمی', bg: 'Science symbols' },
  // verbs / action names
  build: { fa: 'ساختن', bg: 'Build' }, cantBuild: { fa: 'ناتوان', bg: 'unavailable' }, sell: { fa: 'فروختن', bg: 'Discard' }, sale: { fa: 'فروش', bg: 'Discard' },
  wonderOf: { fa: 'بنای', bg: 'Build' }, take: { fa: 'گرفتن', bg: 'Take' }, destroyN: { fa: 'نابودی', bg: 'Destroy' }, buildFromDiscard: { fa: 'ساختن از دورریز', bg: 'Build from discard' },
  buildV: { fa: 'بسازید', bg: 'Build' }, sellV: { fa: 'بفروشید', bg: 'Discard' }, pick: { fa: 'انتخاب', bg: 'Pick' }, picks: { fa: 'انتخاب می‌کند', bg: 'picks' },
  // server summary / move texts (rules.ts publicSummary)
  mvBuild: { fa: 'کارت ساخت', bg: 'Built a card' }, mvDiscard: { fa: 'کارت فروخت', bg: 'Discarded a card' }, mvWonder: { fa: 'شگفتی بنا کرد', bg: 'Built a Wonder' },
  mvProgress: { fa: 'نشان علم برداشت', bg: 'Took a Progress token' }
} satisfies Record<string, Term>;

/** Progress token effect texts (Persian prose; the term words convert). */
export const PROGRESS_DESC: Record<string, Term> = {
  agriculture: { fa: '۶ سکه و ۴ امتیاز', bg: '6 Coins and 4 VP' }, architecture: { fa: 'شگفتی‌ها ۲ منبع ارزان‌تر', bg: 'Wonders cost 2 fewer resources' },
  economy: { fa: 'پول خرید منابع حریف به شما می‌رسد', bg: 'Gain the Coins your opponent pays for resources' }, law: { fa: 'یک نماد علمی', bg: 'A Science symbol' },
  masonry: { fa: 'کارت‌های آبی ۲ منبع ارزان‌تر', bg: 'Civilian cards cost 2 fewer resources' }, mathematics: { fa: '۳ امتیاز برای هر نشان', bg: '3 VP per Progress token' },
  philosophy: { fa: '۷ امتیاز', bg: '7 VP' }, strategy: { fa: 'کارت‌های قرمز تازه یک سپر بیشتر', bg: 'New Military cards get 1 extra Shield' },
  theology: { fa: 'همهٔ شگفتی‌ها نوبت دوباره', bg: 'All Wonders: Play again' }, urbanism: { fa: '۶ سکه و ۴ سکه برای هر ساخت زنجیره‌ای', bg: '6 Coins and 4 Coins per Chain build' }
};

/** Status phrases (fa exactly as shown today). */
export const phrases = {
  pickWonder: { fa: 'یک شگفتی انتخاب کنید', bg: 'Pick a Wonder' }, destroyCard: { fa: 'یک کارت حریف را نابود کنید', bg: "Destroy an opponent's Card" },
  buildDiscarded: { fa: 'یک کارت دورریخته را رایگان بسازید', bg: 'Build a discarded Card for free' }, takeProgress: { fa: 'یک نشان پیشرفت بردارید', bg: 'Take a Progress token' },
  pickFree: { fa: 'یک کارت آزاد از هرم بردارید', bg: 'Pick a free Card from the pyramid' }, buildSellWonder: { fa: 'بسازید، بفروشید یا شگفتی بنا کنید', bg: 'Build, Discard or construct a Wonder' }
} satisfies Record<string, Term>;

const CARD_EN: Record<string, string> = {
  'چوب‌بری': 'Lumber Yard', 'اردوگاه هیزم': 'Logging Camp', 'آبگیر رس': 'Clay Pool', 'گودال رس': 'Clay Pit', 'معدن سنگ': 'Quarry', 'گودال سنگ': 'Stone Pit',
  'شیشه‌گری': 'Glassworks', 'کاغذسازی': 'Press', 'برج نگهبانی': 'Guard Tower', 'اصطبل': 'Stable', 'پادگان': 'Garrison', 'حصار چوبی': 'Palisade',
  'کارگاه': 'Workshop', 'عطاری': 'Apothecary', 'کتابت‌خانه': 'Scriptorium', 'داروخانه': 'Pharmacist', 'تماشاخانه': 'Theater', 'محراب': 'Altar', 'گرمابه': 'Baths',
  'انبار سنگ': 'Stone Reserve', 'انبار رس': 'Clay Reserve', 'انبار چوب': 'Wood Reserve', 'قهوه‌خانه': 'Tavern',
  'کارخانهٔ چوب': 'Sawmill', 'آجرپزی': 'Brickyard', 'معدن پلکانی': 'Shelf Quarry', 'شیشه‌دمی': 'Glassblower', 'خشک‌خانه': 'Drying Room',
  'باروها': 'Walls', 'پرورشگاه اسب': 'Horse Breeders', 'سربازخانه': 'Barracks', 'میدان تیراندازی': 'Archery Range', 'میدان رژه': 'Parade Ground',
  'کتابخانه': 'Library', 'درمانگاه': 'Dispensary', 'مکتب‌خانه': 'School', 'آزمایشگاه': 'Laboratory', 'دادگاه': 'Courthouse', 'تندیس': 'Statue', 'معبد': 'Temple',
  'قنات': 'Aqueduct', 'سکوی خطابه': 'Rostrum', 'میدان': 'Forum', 'کاروانسرا': 'Caravansery', 'گمرک': 'Customs House', 'شربت‌خانه': 'Brewery',
  'زرادخانه': 'Arsenal', 'قرارگاه': 'Pretorium', 'استحکامات': 'Fortifications', 'کارگاه محاصره': 'Siege Workshop', 'میدان نمایش': 'Circus',
  'آکادمی': 'Academy', 'اتاق مطالعه': 'Study', 'دانشگاه': 'University', 'رصدخانه': 'Observatory', 'کاخ': 'Palace', 'تالار شهر': 'Town Hall', 'ستون یادبود': 'Obelisk',
  'باغ‌ها': 'Gardens', 'نیایشگاه بزرگ': 'Pantheon', 'انجمن شهر': 'Senate', 'اتاق بازرگانی': 'Chamber of Commerce', 'بندر': 'Port', 'اسلحه‌خانه': 'Armory',
  'فانوس دریایی': 'Lighthouse', 'ورزشگاه': 'Arena',
  'صنف بازرگانان': 'Merchants Guild', 'صنف کشتی‌داران': 'Shipowners Guild', 'صنف معماران': 'Builders Guild', 'صنف دادرسان': 'Magistrates Guild',
  'صنف دانشمندان': 'Scientists Guild', 'صنف صرافان': 'Moneylenders Guild', 'صنف فرماندهان': 'Tacticians Guild',
  // wonders
  'جادهٔ شاهی': 'The Appian Way', 'میدان بزرگ': 'Circus Maximus', 'غول مفرغی': 'The Colossus', 'کتابخانهٔ بزرگ': 'The Great Library', 'فانوس بزرگ': 'The Great Lighthouse',
  'باغ‌های معلق': 'The Hanging Gardens', 'آرامگاه': 'The Mausoleum', 'بندرگاه': 'Piraeus', 'هرم‌ها': 'The Pyramids', 'ابوالهول': 'The Sphinx',
  'تندیس خدای آسمان': 'The Statue of Zeus', 'پرستشگاه ماه': 'The Temple of Artemis'
};
/** Card / wonder name: official English in «فارسی بردگیمی». */
export const nameOf = (fa: string): string => (getTermsLang() === 'fa-bg' ? CARD_EN[fa] ?? fa : fa);
