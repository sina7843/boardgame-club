// Blood Rage («خشم خون»): static data. Cards follow the Board Game Arena card list (82 cards, copies per player count);
// the board layout (provinces, regions, villages, fjords) follows the printed board shown in the rulebook; the stat track
// steps are reconstructed (see DECISIONS.md, «Blood Rage»).

export type Region = 'manheim' | 'alfheim' | 'jotunheim';
export type ProvinceId = 'ygg' | 'myr' | 'elv' | 'ang' | 'gim' | 'and' | 'utg' | 'hor' | 'mus';
export type FjordId = 'f1' | 'f2' | 'f3' | 'f4';
export type Place = ProvinceId | FjordId;

export interface ProvinceDef { nameFa: string; region: Region | null; villages: number }
/** Outer provinces in ring order (clockwise); Yggdrasil in the middle touches all of them. */
export const RING: Exclude<ProvinceId, 'ygg'>[] = ['myr', 'elv', 'ang', 'mus', 'hor', 'utg', 'and', 'gim'];
export const PROVINCES: Record<ProvinceId, ProvinceDef> = {
  ygg: { nameFa: 'ایگدراسیل', region: null, villages: 0 },
  myr: { nameFa: 'میرک‌ولر', region: 'manheim', villages: 3 },
  elv: { nameFa: 'الواگر', region: 'manheim', villages: 4 },
  ang: { nameFa: 'آنگربودا', region: 'manheim', villages: 5 },
  gim: { nameFa: 'گیملی', region: 'alfheim', villages: 5 },
  and: { nameFa: 'آندلانگ', region: 'alfheim', villages: 3 },
  utg: { nameFa: 'اوتگارد', region: 'jotunheim', villages: 3 },
  hor: { nameFa: 'هورگر', region: 'jotunheim', villages: 4 },
  mus: { nameFa: 'موسپل‌هایم', region: 'jotunheim', villages: 5 }
};
export const REGION_FA: Record<Region, string> = { manheim: 'مانهایم', alfheim: 'آلفهایم', jotunheim: 'یوتون‌هایم' };
export const PROVINCE_IDS = Object.keys(PROVINCES) as ProvinceId[];
export const OUTER = RING;

/** Each fjord lies between two neighbouring provinces and supports both. */
export const FJORDS: Record<FjordId, [ProvinceId, ProvinceId]> = {
  f1: ['elv', 'ang'], f2: ['mus', 'hor'], f3: ['utg', 'and'], f4: ['gim', 'myr']
};
export const FJORD_IDS = Object.keys(FJORDS) as FjordId[];
export const isFjord = (p: Place): p is FjordId => p.startsWith('f');
/** Fjords that support a province. */
export const fjordsOf = (p: ProvinceId): FjordId[] => FJORD_IDS.filter((f) => FJORDS[f].includes(p));
/** Everything a province «contains» for battle and quests: itself and its supporting fjords. */
export const placesOf = (p: ProvinceId): Place[] => [p, ...fjordsOf(p)];

export function adjacent(a: ProvinceId, b: ProvinceId): boolean {
  if (a === b) return false;
  if (a === 'ygg' || b === 'ygg') return true;
  const i = RING.indexOf(a), j = RING.indexOf(b);
  const d = Math.abs(i - j);
  return d === 1 || d === RING.length - 1;
}

// ---------- clan stats ----------
export type Stat = 'rage' | 'axes' | 'horns';
export const STATS: Stat[] = ['rage', 'axes', 'horns'];
export const STAT_FA: Record<Stat, string> = { rage: 'خشم', axes: 'تبر', horns: 'شاخ' };
/** Value at each step (index = step, 0 = start). The 4th and 5th step (index 3, 4) give +10 at the end, the last step +20. */
export const TRACKS: Record<Stat, number[]> = {
  rage: [6, 7, 8, 9, 10, 11],
  axes: [3, 4, 5, 6, 7, 8],
  horns: [4, 5, 6, 7, 8, 9]
};
export const LAST_STEP = 5;

// ---------- figures ----------
export type FigureKind = 'leader' | 'warrior' | 'ship' | 'monster';
export const BASE_STR: Record<Exclude<FigureKind, 'monster'>, number> = { leader: 2, warrior: 1, ship: 3 };
export const WARRIORS = 8;

// ---------- pillage rewards ----------
export type Reward = 'rage' | 'axes' | 'horns' | 'glory' | 'all';
export const REWARD_FA: Record<Reward, string> = { rage: 'یک پلهٔ خشم', axes: 'یک پلهٔ تبر', horns: 'یک پلهٔ شاخ', glory: '۵ افتخار', all: 'یک پله به هر سه ویژگی' };
export const OUTER_REWARDS: Reward[] = ['rage', 'rage', 'axes', 'axes', 'horns', 'horns', 'glory', 'glory'];
export const GLORY_REWARD = 5;
/** Glory per figure that dies in Ragnarök, by age (1-based). */
export const RAGNAROK_GLORY = [0, 2, 3, 4];
/** Provinces destroyed at the start by player count. */
export const DESTROYED_AT_START: Record<number, number> = { 2: 3, 3: 2, 4: 1, 5: 0 };
export const ENDGAME_BONUS_STEP = 10;
export const ENDGAME_BONUS_LAST = 20;

// ---------- cards ----------
export type CardKind = 'clan' | 'warrior' | 'ship' | 'leader' | 'monster' | 'battle' | 'quest';
export type CardId = string;
export interface CardDef {
  id: CardId; age: 1 | 2 | 3; kind: CardKind; nameFa: string; nameEn: string;
  /** Rage to upgrade (upgrade cards). */
  cost?: number;
  /** +STR of a battle card; `null` = Heimdall's Sight (copies the best enemy card). */
  str?: number | null;
  /** Monster strength. */
  mstr?: number;
  /** Quest glory. */
  glory?: number;
  /** Copies for 2 / 3 / 4 / 5 players. */
  n: [number, number, number, number];
  textFa: string;
}

const c = (def: CardDef): CardDef => def;
const Q = (age: 1 | 2 | 3, key: string, nameFa: string, nameEn: string, glory: number, n: CardDef['n'], textFa: string) =>
  c({ id: `q${age}-${key}`, age, kind: 'quest', nameFa, nameEn, glory, n, textFa });

export const CARDS: CardDef[] = [
  // ---- Age 1 ----
  c({ id: 'u1-charm', age: 1, kind: 'clan', nameFa: 'افسون فریگا', nameEn: "Frigga's Charm", cost: 0, n: [1, 1, 1, 1], textFa: 'کارت‌های ارتقا یک خشم کمتر هزینه دارند (حداقل صفر).' }),
  c({ id: 'u1-succor', age: 1, kind: 'clan', nameFa: 'یاری فریگا', nameEn: "Frigga's Succor", cost: 2, n: [0, 1, 1, 1], textFa: 'وقتی با یک نیرو حمله می‌کنید، می‌توانید یک جنگجوی دیگر را هم رایگان در همان استان بگذارید.' }),
  c({ id: 'u1-glory', age: 1, kind: 'clan', nameFa: 'شکوه ثور', nameEn: "Thor's Glory", cost: 2, n: [1, 1, 1, 1], textFa: 'در نبردی که حضور دارید اگر دست‌کم ۲ نیروی دشمن نابود شوند، ۲ افتخار می‌گیرید.' }),
  c({ id: 'u1-tyrdomain', age: 1, kind: 'clan', nameFa: 'قلمرو تیر', nameEn: "Tyr's Domain", cost: 0, n: [0, 1, 1, 1], textFa: 'در نبرد می‌توانید یک کارت مأموریت را مثل کارت نبرد با ۳+ بازی کنید.' }),
  c({ id: 'u1-lokidomain', age: 1, kind: 'clan', nameFa: 'قلمرو لوکی', nameEn: "Loki's Domain", cost: 1, n: [1, 1, 1, 1], textFa: 'به‌ازای هر نیرویی که از والهالا آزاد می‌کنید ۱ افتخار می‌گیرید.' }),
  c({ id: 'u1-blessing', age: 1, kind: 'clan', nameFa: 'برکت لوکی', nameEn: "Loki's Blessing", cost: 1, n: [0, 0, 1, 1], textFa: 'اگر در نبردی ببازید، می‌توانید یک جنگجو را رایگان در همان استان بگذارید.' }),
  c({ id: 'w1-brothers', age: 1, kind: 'warrior', nameFa: 'برادران رزم', nameEn: 'Brothers in Arms', cost: 1, n: [1, 1, 1, 2], textFa: 'هر دو جنگجوی شما در یک استان روی هم قدرت ۳ دارند.' }),
  c({ id: 's1-loki', age: 1, kind: 'ship', nameFa: 'اژدهایان لوکی', nameEn: "Loki's Dragons", cost: 2, n: [1, 1, 1, 2], textFa: 'وقتی کشتی شما نابود شود ۴ افتخار می‌گیرید.' }),
  c({ id: 'l1-hammers', age: 1, kind: 'leader', nameFa: 'سالار چکش‌ها', nameEn: 'Lord of Hammers', cost: 3, n: [1, 1, 1, 2], textFa: 'پس از غارت موفق با رهبرتان می‌توانید او را به استانی مجاور ببرید.' }),
  c({ id: 'm1-dwarf', age: 1, kind: 'monster', nameFa: 'سرکردهٔ کوتوله‌ها', nameEn: 'Dwarf Chieftain', cost: 0, mstr: 2, n: [1, 1, 1, 1], textFa: 'قدرت ۲؛ ارتقا و حمله‌اش خشم نمی‌خواهد.' }),
  c({ id: 'm1-troll', age: 1, kind: 'monster', nameFa: 'ترول', nameEn: 'Troll', cost: 2, mstr: 2, n: [1, 1, 1, 1], textFa: 'قدرت ۲؛ وقتی با او حمله می‌کنید همهٔ جنگجویان دشمن آن استان نابود می‌شوند.' }),
  c({ id: 'm1-serpent', age: 1, kind: 'monster', nameFa: 'مار دریایی', nameEn: 'Sea Serpent', cost: 3, mstr: 3, n: [0, 1, 1, 1], textFa: 'قدرت ۳؛ مثل کشتی حساب می‌شود (فقط در خلیج‌ها).' }),
  c({ id: 'b1-trickery', age: 1, kind: 'battle', nameFa: 'حقهٔ لوکی', nameEn: "Loki's Trickery", str: 0, n: [1, 1, 2, 2], textFa: 'اگر ببازید، ۱ خشم از برنده می‌دزدید.' }),
  c({ id: 'b1-hammer', age: 1, kind: 'battle', nameFa: 'چکش ثور', nameEn: "Thor's Hammer", str: 1, n: [1, 1, 1, 2], textFa: 'اگر برنده شوید ۳ افتخار می‌گیرید.' }),
  c({ id: 'b1-smite', age: 1, kind: 'battle', nameFa: 'ضربت اودین', nameEn: "Odin's Smite", str: 1, n: [1, 2, 2, 2], textFa: 'پیش از مقایسهٔ قدرت، یک جنگجوی هر حریف در این استان نابود می‌شود.' }),
  c({ id: 'b1-bash', age: 1, kind: 'battle', nameFa: 'کوبش تیر', nameEn: "Tyr's Bash", str: 2, n: [1, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b1-grace', age: 1, kind: 'battle', nameFa: 'لطف فریگا', nameEn: "Frigga's Grace", str: 2, n: [1, 1, 2, 2], textFa: 'اگر غارت موفق باشد، یک ویژگی دیگر را هم یک پله بالا می‌برید.' }),
  c({ id: 'b1-smash', age: 1, kind: 'battle', nameFa: 'خردکردن تیر', nameEn: "Tyr's Smash", str: 3, n: [1, 2, 2, 3], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b1-crush', age: 1, kind: 'battle', nameFa: 'له‌کردن تیر', nameEn: "Tyr's Crush", str: 4, n: [0, 0, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b1-tsmite', age: 1, kind: 'battle', nameFa: 'کوبندگی تیر', nameEn: "Tyr's Smite", str: 5, n: [1, 1, 1, 2], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b1-sight', age: 1, kind: 'battle', nameFa: 'نگاه هایمدال', nameEn: "Heimdall's Sight", str: null, n: [1, 1, 1, 1], textFa: 'قدرتش برابر بالاترین کارت آشکارشدهٔ حریفان است.' }),
  Q(1, 'alf', 'آلفهایم!', 'Alfheim!', 5, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های آلفهایم داشته باشید.'),
  Q(1, 'man', 'مانهایم!', 'Manheim!', 5, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های مانهایم داشته باشید.'),
  Q(1, 'jot', 'یوتون‌هایم!', 'Jotunheim!', 5, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های یوتون‌هایم داشته باشید.'),
  Q(1, 'ygg', 'ایگدراسیل!', 'Yggdrasil!', 6, [0, 1, 1, 1], 'بیشترین قدرت را در ایگدراسیل داشته باشید.'),
  Q(1, 'death', 'مرگ پرافتخار!', 'Glorious Death!', 6, [1, 1, 2, 3], 'پیش از راگناروک دست‌کم ۴ نیروی شما در والهالا باشد.'),
  Q(1, 'wide', 'گسترده!', 'Widespread!', 7, [0, 0, 0, 1], 'بیشترین قدرت را در دست‌کم ۲ استان متفاوت داشته باشید.'),
  // ---- Age 2 ----
  c({ id: 'u2-protection', age: 2, kind: 'clan', nameFa: 'حمایت فریگا', nameEn: "Frigga's Protection", cost: 0, n: [1, 1, 1, 1], textFa: 'با پرداخت ۱ خشم از نابودی یکی از نیروهایتان در نبرد جلوگیری می‌کنید.' }),
  c({ id: 'u2-prowess', age: 2, kind: 'clan', nameFa: 'دلیری تیر', nameEn: "Tyr's Prowess", cost: 2, n: [0, 1, 1, 1], textFa: 'اگر نبردی را ببرید، می‌توانید کارت‌های بازی‌شده‌تان را به‌ازای هر کدام ۱ خشم نگه دارید.' }),
  c({ id: 'u2-challenge', age: 2, kind: 'clan', nameFa: 'چالش تیر', nameEn: "Tyr's Challenge", cost: 0, n: [1, 1, 1, 1], textFa: 'به‌عنوان یک کنش، ۲ خشم بدهید و استانی را که قبلاً غارت شده دوباره غارت کنید.' }),
  c({ id: 'u2-inspiration', age: 2, kind: 'clan', nameFa: 'الهام اودین', nameEn: "Odin's Inspiration", cost: 2, n: [1, 1, 1, 1], textFa: 'افتخار مردن در راگناروک برای نیروهای شما دو برابر می‌شود.' }),
  c({ id: 'u2-eminence', age: 2, kind: 'clan', nameFa: 'والایی لوکی', nameEn: "Loki's Eminence", cost: 2, n: [0, 1, 1, 1], textFa: 'به‌ازای هر نیرویی که از والهالا آزاد می‌کنید ۲ افتخار می‌گیرید.' }),
  c({ id: 'u2-thordomain', age: 2, kind: 'clan', nameFa: 'قلمرو ثور', nameEn: "Thor's Domain", cost: 1, n: [0, 0, 1, 1], textFa: 'پس از حمله به یک استان می‌توانید ۲ خشم بدهید و بی‌درنگ آن را غارت کنید.' }),
  c({ id: 'w2-experts', age: 2, kind: 'warrior', nameFa: 'استادان رزم', nameEn: 'Experts in Arms', cost: 2, n: [1, 1, 1, 2], textFa: 'جنگجویان شما حالا قدرت ۲ دارند.' }),
  c({ id: 's2-fire', age: 2, kind: 'ship', nameFa: 'اژدهایان آتشین', nameEn: 'Fire Dragons', cost: 2, n: [1, 1, 1, 2], textFa: 'وقتی کشتی شما نابود شود ۸ افتخار می‌گیرید.' }),
  c({ id: 'l2-axes', age: 2, kind: 'leader', nameFa: 'سالار تبرها', nameEn: 'Lord of Axes', cost: 3, n: [1, 1, 1, 2], textFa: 'پس از غارت موفق با رهبرتان یکی از ویژگی‌هایتان را یک پله بالا می‌برید.' }),
  c({ id: 'm2-fire', age: 2, kind: 'monster', nameFa: 'غول آتشین', nameEn: 'Fire Giant', cost: 4, mstr: 4, n: [0, 1, 1, 1], textFa: 'قدرت ۴؛ وقتی با او حمله می‌کنید همهٔ نیروهای غیرهیولای دشمن آن استان نابود می‌شوند.' }),
  c({ id: 'm2-elf', age: 2, kind: 'monster', nameFa: 'جن تاریک', nameEn: 'Dark Elf', cost: 1, mstr: 1, n: [1, 1, 1, 1], textFa: 'قدرت ۱؛ می‌تواند به ایگدراسیل حمله کند و آنجا قدرتش ۳ است.' }),
  c({ id: 'm2-valkyrie', age: 2, kind: 'monster', nameFa: 'والکیری', nameEn: 'Valkyrie', cost: 2, mstr: 2, n: [1, 1, 1, 1], textFa: 'قدرت ۲؛ در نبردی که حضور دارد به‌ازای هر نیروی نابودشدهٔ دشمن ۲ افتخار می‌گیرید.' }),
  c({ id: 'b2-backstab', age: 2, kind: 'battle', nameFa: 'خنجر پشت لوکی', nameEn: "Loki's Backstab", str: 0, n: [1, 1, 2, 2], textFa: 'اگر ببازید، ۲ افتخار از برنده می‌دزدید.' }),
  c({ id: 'b2-watch', age: 2, kind: 'battle', nameFa: 'دیده‌بانی هایمدال', nameEn: "Heimdall's Watch", str: 0, n: [1, 1, 1, 1], textFa: 'همهٔ کارت‌های آشکارشده کنار می‌روند، به‌اندازهٔ مجموع +قدرتشان افتخار می‌گیرید و همه دوباره کارت بازی می‌کنند.' }),
  c({ id: 'b2-oath', age: 2, kind: 'battle', nameFa: 'سوگند ثور', nameEn: "Thor's Oath", str: 1, n: [1, 1, 1, 1], textFa: 'اگر ببرید، یکی از ویژگی‌هایتان را یک پله بالا می‌برید.' }),
  c({ id: 'b2-tide', age: 2, kind: 'battle', nameFa: 'سیل اودین', nameEn: "Odin's Tide", str: 1, n: [1, 1, 2, 2], textFa: 'پیش از مقایسه، هر بازیکن همهٔ نیروهای خود در این نبرد به‌جز یکی را نابود می‌کند.' }),
  c({ id: 'b2-eye', age: 2, kind: 'battle', nameFa: 'چشم هایمدال', nameEn: "Heimdall's Eye", str: 2, n: [2, 3, 3, 4], textFa: 'پس از آشکار شدن کارت‌های دیگران تصمیم می‌گیرید بازیش کنید یا نه.' }),
  c({ id: 'b2-smash', age: 2, kind: 'battle', nameFa: 'خردکردن تیر', nameEn: "Tyr's Smash", str: 3, n: [0, 0, 1, 2], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b2-crush', age: 2, kind: 'battle', nameFa: 'له‌کردن تیر', nameEn: "Tyr's Crush", str: 4, n: [1, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b2-tsmite', age: 2, kind: 'battle', nameFa: 'کوبندگی تیر', nameEn: "Tyr's Smite", str: 5, n: [0, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b2-rage', age: 2, kind: 'battle', nameFa: 'غرّش تیر', nameEn: "Tyr's Rage", str: 6, n: [1, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  Q(2, 'alf', 'آلفهایم!', 'Alfheim!', 7, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های آلفهایم داشته باشید.'),
  Q(2, 'man', 'مانهایم!', 'Manheim!', 7, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های مانهایم داشته باشید.'),
  Q(2, 'jot', 'یوتون‌هایم!', 'Jotunheim!', 7, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های یوتون‌هایم داشته باشید.'),
  Q(2, 'ygg', 'ایگدراسیل!', 'Yggdrasil!', 8, [0, 1, 1, 1], 'بیشترین قدرت را در ایگدراسیل داشته باشید.'),
  Q(2, 'death', 'مرگ پرافتخار!', 'Glorious Death!', 8, [1, 1, 2, 3], 'پیش از راگناروک دست‌کم ۴ نیروی شما در والهالا باشد.'),
  Q(2, 'wide', 'گسترده!', 'Widespread!', 10, [0, 0, 0, 1], 'بیشترین قدرت را در دست‌کم ۲ استان متفاوت داشته باشید.'),
  // ---- Age 3 ----
  c({ id: 'u3-domain', age: 3, kind: 'clan', nameFa: 'قلمرو فریگا', nameEn: "Frigga's Domain", cost: 0, n: [1, 1, 1, 1], textFa: 'با پرداخت ۱ خشم با یکی از نیروهایتان که در والهالاست حمله کنید.' }),
  c({ id: 'u3-sacrifice', age: 3, kind: 'clan', nameFa: 'قربانی فریگا', nameEn: "Frigga's Sacrifice", cost: 1, n: [0, 1, 1, 1], textFa: 'به‌عنوان یک کنش، ۲ نیروی خود را از صفحه نابود کنید تا یکی از ویژگی‌هایتان یک پله بالا برود.' }),
  c({ id: 'u3-wrath', age: 3, kind: 'clan', nameFa: 'غضب تیر', nameEn: "Tyr's Wrath", cost: 0, n: [0, 1, 1, 1], textFa: 'در نبرد می‌توانید یک کارت مأموریت را مثل کارت نبرد با ۵+ بازی کنید.' }),
  c({ id: 'u3-lokiwrath', age: 3, kind: 'clan', nameFa: 'غضب لوکی', nameEn: "Loki's Wrath", cost: 3, n: [0, 0, 1, 1], textFa: 'به‌ازای هر نیرویی که از والهالا آزاد می‌کنید ۳ افتخار می‌گیرید.' }),
  c({ id: 'u3-conquest', age: 3, kind: 'clan', nameFa: 'فتح ثور', nameEn: "Thor's Conquest", cost: 3, n: [1, 1, 1, 1], textFa: 'به‌ازای هر نیرویتان که پایان بازی روی صفحه است ۳ افتخار می‌گیرید.' }),
  c({ id: 'u3-throne', age: 3, kind: 'clan', nameFa: 'تخت اودین', nameEn: "Odin's Throne", cost: 2, n: [1, 1, 1, 1], textFa: 'افتخار مأموریت‌های انجام‌شده‌تان دو برابر می‌شود.' }),
  c({ id: 'w3-masters', age: 3, kind: 'warrior', nameFa: 'سرداران رزم', nameEn: 'Masters in Arms', cost: 2, n: [1, 1, 1, 2], textFa: 'هر دو جنگجوی شما در یک استان روی هم قدرت ۶ دارند.' }),
  c({ id: 's3-eternal', age: 3, kind: 'ship', nameFa: 'اژدهایان جاودان', nameEn: 'Eternal Dragons', cost: 2, n: [1, 1, 1, 2], textFa: 'وقتی کشتی شما نابود شود ۱۲ افتخار می‌گیرید.' }),
  c({ id: 'l3-spears', age: 3, kind: 'leader', nameFa: 'سالار نیزه‌ها', nameEn: 'Lord of Spears', cost: 3, n: [1, 1, 1, 2], textFa: 'پس از غارت موفق با رهبرتان هر سه ویژگی را یک پله بالا می‌برید.' }),
  c({ id: 'm3-frost', age: 3, kind: 'monster', nameFa: 'غول یخی', nameEn: 'Frost Giant', cost: 4, mstr: 4, n: [1, 1, 1, 1], textFa: 'قدرت ۴؛ پس از غارت موفقی که در آن حضور دارد، پاداش غارت را دوباره می‌گیرید.' }),
  c({ id: 'm3-hel', age: 3, kind: 'monster', nameFa: 'سرباز هل', nameEn: 'Soldier from Hel', cost: 0, mstr: 3, n: [1, 1, 1, 1], textFa: 'قدرت ۳؛ ارتقا و حمله‌اش خشم نمی‌خواهد.' }),
  c({ id: 'm3-volur', age: 3, kind: 'monster', nameFa: 'جادوگر ولور', nameEn: 'Volur Witch', cost: 3, mstr: 3, n: [0, 1, 1, 1], textFa: 'قدرت ۳؛ به‌جای نابود شدن در یک استان بیرونی به ایگدراسیل می‌گریزد.' }),
  c({ id: 'b3-poison', age: 3, kind: 'battle', nameFa: 'زهر لوکی', nameEn: "Loki's Poison", str: 0, n: [1, 1, 2, 2], textFa: 'اگر ببازید، کارت‌های آشکارشدهٔ برنده را به دست خود می‌گیرید.' }),
  c({ id: 'b3-watch', age: 3, kind: 'battle', nameFa: 'دیده‌بانی هایمدال', nameEn: "Heimdall's Watch", str: 0, n: [1, 1, 1, 1], textFa: 'همهٔ کارت‌های آشکارشده کنار می‌روند، به‌اندازهٔ مجموع +قدرتشان افتخار می‌گیرید و همه دوباره کارت بازی می‌کنند.' }),
  c({ id: 'b3-ascension', age: 3, kind: 'battle', nameFa: 'اوج ثور', nameEn: "Thor's Ascension", str: 1, n: [1, 1, 2, 2], textFa: 'اگر ببرید ۳ خشم و ۳ افتخار می‌گیرید.' }),
  c({ id: 'b3-judgement', age: 3, kind: 'battle', nameFa: 'داوری اودین', nameEn: "Odin's Judgement", str: 2, n: [1, 1, 2, 2], textFa: 'به‌ازای هر نیروی نابودشده در این نبرد (از خودتان هم) ۲ افتخار می‌گیرید.' }),
  c({ id: 'b3-primacy', age: 3, kind: 'battle', nameFa: 'برتری ثور', nameEn: "Thor's Primacy", str: 3, n: [1, 2, 2, 2], textFa: 'متن کارت نبرد همهٔ حریفان را بی‌اثر می‌کند.' }),
  c({ id: 'b3-gaze', age: 3, kind: 'battle', nameFa: 'خیرگی هایمدال', nameEn: "Heimdall's Gaze", str: 3, n: [1, 2, 2, 2], textFa: 'پس از آشکار شدن کارت‌های دیگران تصمیم می‌گیرید بازیش کنید یا نه.' }),
  c({ id: 'b3-crush', age: 3, kind: 'battle', nameFa: 'له‌کردن تیر', nameEn: "Tyr's Crush", str: 4, n: [1, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b3-tsmite', age: 3, kind: 'battle', nameFa: 'کوبندگی تیر', nameEn: "Tyr's Smite", str: 5, n: [0, 0, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b3-rage', age: 3, kind: 'battle', nameFa: 'غرّش تیر', nameEn: "Tyr's Rage", str: 6, n: [1, 1, 1, 1], textFa: 'اثر ویژه ندارد.' }),
  c({ id: 'b3-judge', age: 3, kind: 'battle', nameFa: 'قضاوت تیر', nameEn: "Tyr's Judgement", str: 8, n: [0, 0, 0, 1], textFa: 'اثر ویژه ندارد.' }),
  Q(3, 'alf', 'آلفهایم!', 'Alfheim!', 9, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های آلفهایم داشته باشید.'),
  Q(3, 'man', 'مانهایم!', 'Manheim!', 9, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های مانهایم داشته باشید.'),
  Q(3, 'jot', 'یوتون‌هایم!', 'Jotunheim!', 9, [1, 1, 2, 2], 'بیشترین قدرت را دست‌کم در یکی از استان‌های یوتون‌هایم داشته باشید.'),
  Q(3, 'ygg', 'ایگدراسیل!', 'Yggdrasil!', 10, [0, 1, 1, 1], 'بیشترین قدرت را در ایگدراسیل داشته باشید.'),
  Q(3, 'death', 'مرگ پرافتخار!', 'Glorious Death!', 11, [1, 1, 2, 3], 'پیش از راگناروک دست‌کم ۴ نیروی شما در والهالا باشد.'),
  Q(3, 'wide', 'گسترده!', 'Widespread!', 15, [0, 0, 0, 1], 'بیشترین قدرت را در دست‌کم ۲ استان متفاوت داشته باشید.')
];
export const CARD_BY_ID: Record<CardId, CardDef> = Object.fromEntries(CARDS.map((x) => [x.id, x]));
export const isUpgrade = (k: CardKind) => k === 'clan' || k === 'warrior' || k === 'ship' || k === 'leader' || k === 'monster';

/** Copies of each card in the deck of one age for `players` (2–5). */
export function ageDeck(age: 1 | 2 | 3, players: number): CardId[] {
  const col = players - 2;
  return CARDS.filter((x) => x.age === age).flatMap((x) => Array.from({ length: x.n[col]! }, () => x.id));
}
